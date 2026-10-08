// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Workflow Engine: Executor
// ═══════════════════════════════════════════════════════════════════════════════
//
// Executes a WorkflowPlan step-by-step, streaming progress via a callback.
//
// For each step:
//   1. Resolve template variables in step.args against prior step outputs.
//   2. Evaluate step.skipCondition — if truthy, mark as skipped and continue.
//   3. Call the Action Engine's executeAndRefresh() — this runs the SAME
//      validate → execute → refresh pipeline as a single-action confirmation,
//      so audit logs, graph events, timeline events, and activity logs all
//      fire identically to a UI button click.
//   4. Capture the step's result data (used to resolve template vars in
//      subsequent steps).
//   5. If the step failed:
//        - critical: halt. Run rollback for every prior successful step that
//          declared a rollback action. Report partial completion.
//        - non-critical: continue. Mark as failed. Include in partial summary.
//   6. After all steps (or halt), do a final defaultRefreshContext() so the
//      dashboard reflects all the changes.
//
// Failure recovery (per the spec):
//   "If step 4 fails, Oracle should explain exactly what succeeded and what
//    failed, instead of stopping with a generic error."
//   The executor builds a per-step summary and an overall summary that lists
//   each step's outcome — never a generic error.
//
// Transaction safety (per the spec):
//   "Use database transactions where appropriate. Avoid partial writes when
//    multiple database changes must succeed together. Roll back when possible,
//    or clearly report partial completion when rollback isn't appropriate."
//   Prisma cross-action transactions aren't feasible (each action calls services
//   with their own writes + side effects), so the executor uses the saga
//   pattern: each step may declare a `rollback` action (e.g. createInvoice →
//   deleteInvoice). On critical failure, prior rollbacks run in reverse order.
//   When a step has no rollback, its partial write is reported (not silently
//   ignored).
// ═══════════════════════════════════════════════════════════════════════════════

import { executeAndRefresh, defaultRefreshContext, type ActionContext } from '@/lib/oracle/action-engine';
import { db } from '@/lib/db';
import { logActivity } from '@/lib/oracle/action-engine/registry';
import type {
  WorkflowPlan,
  WorkflowStep,
  WorkflowStepResult,
  WorkflowResult,
  WorkflowStreamEvent,
  WorkflowOverallStatus,
} from './types';

// ─── Template variable resolution ─────────────────────────────────────────────

const TEMPLATE_RE = /\{\{\s*([a-zA-Z0-9_.\[\]]+)\s*\}\}/g;

/**
 * Resolve `{{stepId.data.field}}` template variables against prior step outputs.
 * Walks the path: split on '.', descend into objects, supports array indices
 * (e.g. `step1.data.items[0].name`).
 *
 * If a path can't be resolved, the template string is left as-is (the action's
 * validate() will surface the missing field as an error).
 */
export function resolveTemplate(value: any, stepOutputs: Record<string, Record<string, any>>): any {
  if (value == null) return value;
  if (typeof value === 'string') {
    return resolveString(value, stepOutputs);
  }
  if (Array.isArray(value)) {
    return value.map(v => resolveTemplate(v, stepOutputs));
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveTemplate(v, stepOutputs);
    }
    return out;
  }
  return value;
}

function resolveString(s: string, stepOutputs: Record<string, Record<string, any>>): any {
  // Fast path: no template vars
  if (!s.includes('{{')) return s;
  // If the entire string is a single template var, return the raw value
  // (preserves type — e.g. a number from step data stays a number).
  const singleMatch = s.match(/^\{\{\s*([a-zA-Z0-9_.\[\]]+)\s*\}\}$/);
  if (singleMatch) {
    return resolvePath(singleMatch[1], stepOutputs) ?? s;
  }
  // Otherwise, interpolate all template vars as strings
  return s.replace(TEMPLATE_RE, (full, path) => {
    const val = resolvePath(path, stepOutputs);
    if (val == null) return full; // leave unresolved — validate() will catch it
    return String(val);
  });
}

function resolvePath(path: string, stepOutputs: Record<string, Record<string, any>>): any {
  // Support array index syntax: items[0] → items.0
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cur: any = stepOutputs;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Evaluate a skipCondition template expression. Returns true if the step should
 * be skipped. Truthy values: "true", "1", any non-empty resolved string that
 * isn't "false"/"0"/"".
 */
function evaluateSkip(condition: string, stepOutputs: Record<string, Record<string, any>>): { skip: boolean; reason: string } {
  if (!condition) return { skip: false, reason: '' };
  const resolved = resolveString(condition, stepOutputs);
  if (resolved === condition) {
    // No template vars — treat as a literal truthy check
    const lower = String(resolved).toLowerCase().trim();
    return { skip: lower === 'true' || lower === '1', reason: lower === 'true' ? 'Condition met' : '' };
  }
  // Resolved to a value — truthy if non-empty and not "false"/"0"
  const str = String(resolved).toLowerCase().trim();
  if (str === '' || str === 'false' || str === '0' || str === 'undefined' || str === 'null') {
    return { skip: false, reason: '' };
  }
  return { skip: true, reason: `Condition met (${condition} → ${String(resolved).slice(0, 50)})` };
}

// ─── Executor ─────────────────────────────────────────────────────────────────

export interface ExecutorOptions {
  orgId: string;
  userId?: string;
  sessionId?: string;
  /** Called for every SSE event — the API route wires this to the stream. */
  onEvent?: (event: WorkflowStreamEvent) => void;
  /** Signal to abort the workflow (e.g. client disconnected). Checked between steps. */
  signal?: AbortSignal;
}

/**
 * Execute a WorkflowPlan. Streams progress via onEvent. Returns the final
 * WorkflowResult (also emitted as a 'workflow-complete' event).
 */
export async function executeWorkflow(
  plan: WorkflowPlan,
  opts: ExecutorOptions,
): Promise<WorkflowResult> {
  const t0 = Date.now();
  const ctx: ActionContext = {
    orgId: opts.orgId,
    userId: opts.userId,
    sessionId: opts.sessionId,
  };

  const stepResults: WorkflowStepResult[] = [];
  // stepOutputs[stepId] = the action's result.data — used for template resolution
  const stepOutputs: Record<string, Record<string, any>> = {};
  let halted = false;
  let criticalFailure: WorkflowStepResult | null = null;

  // Emit workflow-start
  opts.onEvent?.({
    type: 'workflow-start',
    plan: { id: plan.id, title: plan.title, category: plan.category, stepCount: plan.steps.length },
  });

  // Log the workflow start (activity timeline)
  await logActivity(opts.orgId, 'workflow', `Started workflow: ${plan.title}`, {
    workflowId: plan.id,
    templateId: plan.templateId,
    stepCount: plan.steps.length,
  }).catch(() => {});

  // ─── Main step loop ──────────────────────────────────────────────────────
  for (let i = 0; i < plan.steps.length; i++) {
    // Check for abort / client disconnect
    if (opts.signal?.aborted) {
      halted = true;
      break;
    }

    const step = plan.steps[i];
    const baseResult: WorkflowStepResult = {
      stepId: step.id,
      actionName: step.actionName,
      label: step.label,
      status: 'pending',
    };

    // ── 1. Evaluate skip condition ──
    if (step.skipCondition) {
      const { skip, reason } = evaluateSkip(step.skipCondition, stepOutputs);
      if (skip) {
        const skipped: WorkflowStepResult = { ...baseResult, status: 'skipped', summary: reason };
        stepResults.push(skipped);
        opts.onEvent?.({
          type: 'workflow-step-skipped',
          stepId: step.id,
          label: step.label,
          reason,
        });
        continue;
      }
    }

    // ── 2. Resolve template vars in args ──
    const resolvedArgs = resolveTemplate(step.args, stepOutputs);

    // ── 3. Emit step-start ──
    opts.onEvent?.({
      type: 'workflow-step-start',
      stepId: step.id,
      label: step.label,
      actionName: step.actionName,
      index: i + 1,
      total: plan.steps.length,
    });

    const stepStart = Date.now();
    const stepStartIso = new Date().toISOString();

    // ── 4. Execute via the Action Engine ──
    let stepResult: WorkflowStepResult;
    try {
      const actionResult = await executeAndRefresh(step.actionName, resolvedArgs, ctx);
      const durationMs = Date.now() - stepStart;

      if (actionResult.success) {
        stepResult = {
          ...baseResult,
          status: 'success',
          summary: actionResult.summary,
          data: actionResult.result,
          startedAt: stepStartIso,
          completedAt: new Date().toISOString(),
          durationMs,
        };
        stepOutputs[step.id] = actionResult.result ?? {};
        opts.onEvent?.({
          type: 'workflow-step-success',
          stepId: step.id,
          label: step.label,
          summary: actionResult.summary,
          data: actionResult.result,
          durationMs,
        });
      } else {
        // Action executed but returned ok:false (validation or runtime error)
        stepResult = {
          ...baseResult,
          status: 'failed',
          error: actionResult.summary,
          startedAt: stepStartIso,
          completedAt: new Date().toISOString(),
          durationMs,
        };
        const isCritical = step.critical !== false;
        opts.onEvent?.({
          type: 'workflow-step-failed',
          stepId: step.id,
          label: step.label,
          error: actionResult.summary,
          critical: isCritical,
          willRollback: isCritical && hasRollbackablePrior(stepResults, plan),
        });
        if (isCritical) {
          criticalFailure = stepResult;
          halted = true;
        }
      }
    } catch (e) {
      // Uncaught exception from executeAndRefresh (shouldn't happen — it catches
      // internally — but we defend in depth)
      const errMsg = (e as Error).message || 'Unknown execution error';
      const durationMs = Date.now() - stepStart;
      stepResult = {
        ...baseResult,
        status: 'failed',
        error: errMsg,
        startedAt: stepStartIso,
        completedAt: new Date().toISOString(),
        durationMs,
      };
      const isCritical = step.critical !== false;
      opts.onEvent?.({
        type: 'workflow-step-failed',
        stepId: step.id,
        label: step.label,
        error: errMsg,
        critical: isCritical,
        willRollback: isCritical && hasRollbackablePrior(stepResults, plan),
      });
      if (isCritical) {
        criticalFailure = stepResult;
        halted = true;
      }
    }

    stepResults.push(stepResult);

    if (halted) break;
  }

  // ─── Rollback (saga) on critical failure ─────────────────────────────────
  if (criticalFailure) {
    await runRollbacks(plan, stepResults, stepOutputs, ctx, opts);
  }

  // ─── Final dashboard refresh ────────────────────────────────────────────
  let refreshedContext;
  try {
    refreshedContext = await defaultRefreshContext(opts.orgId);
  } catch (e) {
    console.warn('[workflow-executor] final refresh failed:', (e as Error).message);
  }

  // ─── Build the overall result ───────────────────────────────────────────
  const completedCount = stepResults.filter(r => r.status === 'success').length;
  const failedCount = stepResults.filter(r => r.status === 'failed').length;
  const skippedCount = stepResults.filter(r => r.status === 'skipped').length;
  const rolledBackCount = stepResults.filter(r => r.status === 'rolled-back').length;

  let status: WorkflowOverallStatus;
  if (criticalFailure) {
    status = 'failed';
  } else if (failedCount > 0) {
    status = 'partial';
  } else {
    status = 'success';
  }

  const summary = buildOverallSummary(plan, stepResults, criticalFailure, status);
  const viewIn = buildViewInLinks(plan, stepOutputs);

  const result: WorkflowResult = {
    ok: status === 'success',
    status,
    steps: stepResults,
    summary,
    refreshedContext,
    completedCount,
    failedCount,
    skippedCount,
    durationMs: Date.now() - t0,
    viewIn,
  };

  // Log the workflow outcome (activity timeline)
  await logActivity(
    opts.orgId,
    'workflow',
    `Workflow ${status === 'success' ? 'completed' : status === 'partial' ? 'partially completed' : 'failed'}: ${plan.title}`,
    {
      workflowId: plan.id,
      templateId: plan.templateId,
      status,
      completedCount,
      failedCount,
      skippedCount,
      rolledBackCount,
      durationMs: result.durationMs,
    },
  ).catch(() => {});

  // Persist the workflow result to VEYRO AI audit log (best-effort)
  try {
    await db.oracleAIToolCall.create({
      data: {
        id: plan.id,
        sessionId: opts.sessionId,
        firmId: opts.orgId,
        userId: opts.userId,
        toolName: 'runWorkflow',
        args: JSON.stringify({ templateId: plan.templateId, title: plan.title, stepCount: plan.steps.length }),
        result: JSON.stringify({ status, completedCount, failedCount, summary: summary.slice(0, 2000) }),
        status: status === 'success' ? 'success' : status === 'partial' ? 'success' : 'error',
        durationMs: result.durationMs,
      },
    });
  } catch (e) {
    console.warn('[workflow-executor] audit persist failed:', (e as Error).message);
  }

  // Emit workflow-complete
  opts.onEvent?.({ type: 'workflow-complete', result });

  return result;
}

// ─── Rollback (saga) ──────────────────────────────────────────────────────────

function hasRollbackablePrior(stepResults: WorkflowStepResult[], plan: WorkflowPlan): boolean {
  return plan.steps.some(s =>
    s.rollback &&
    stepResults.some(r => r.stepId === s.id && r.status === 'success'),
  );
}

/**
 * Run compensating rollback actions for every prior successful step that
 * declared a rollback. Runs in REVERSE order (undo last first). Marks rolled-
 * back steps as 'rolled-back' in the results.
 */
async function runRollbacks(
  plan: WorkflowPlan,
  stepResults: WorkflowStepResult[],
  stepOutputs: Record<string, Record<string, any>>,
  ctx: ActionContext,
  opts: ExecutorOptions,
): Promise<void> {
  // Find successful steps with rollbacks, in reverse order
  const rollbackTargets: Array<{ step: WorkflowStep; resultIdx: number }> = [];
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step.rollback) continue;
    const resultIdx = stepResults.findIndex(r => r.stepId === step.id && r.status === 'success');
    if (resultIdx === -1) continue;
    rollbackTargets.push({ step, resultIdx });
  }
  rollbackTargets.reverse();

  for (const { step, resultIdx } of rollbackTargets) {
    if (!step.rollback) continue;
    opts.onEvent?.({
      type: 'workflow-rollback-start',
      stepId: step.id,
      actionName: step.rollback.actionName,
    });
    try {
      const rollbackArgs = resolveTemplate(step.rollback.args, stepOutputs);
      const rollbackResult = await executeAndRefresh(step.rollback.actionName, rollbackArgs, ctx);
      const ok = rollbackResult.success;
      // Mark the original step as rolled-back
      stepResults[resultIdx] = {
        ...stepResults[resultIdx],
        status: 'rolled-back',
        summary: `${stepResults[resultIdx].summary}  ⟲ Rolled back via ${step.rollback.actionName}.`,
      };
      opts.onEvent?.({
        type: 'workflow-rollback-done',
        stepId: step.id,
        ok,
        summary: ok ? rollbackResult.summary : rollbackResult.summary,
      });
    } catch (e) {
      const errMsg = (e as Error).message;
      // Rollback itself failed — leave the step as 'success' but note the
      // failed rollback in the summary (the data remains; manual cleanup needed).
      opts.onEvent?.({
        type: 'workflow-rollback-done',
        stepId: step.id,
        ok: false,
        summary: `Rollback failed: ${errMsg}`,
      });
    }
  }
}

// ─── Summary builders ─────────────────────────────────────────────────────────

/**
 * Build the overall human-readable summary. Lists each step's outcome so the
 * user sees EXACTLY what succeeded and what failed — never a generic error.
 */
function buildOverallSummary(
  plan: WorkflowPlan,
  stepResults: WorkflowStepResult[],
  criticalFailure: WorkflowStepResult | null,
  status: WorkflowOverallStatus,
): string {
  const lines: string[] = [];
  const icon = (s: WorkflowStepResult['status']): string => {
    switch (s) {
      case 'success': return '✓';
      case 'failed': return '✗';
      case 'skipped': return '⊘';
      case 'rolled-back': return '⟲';
      case 'running': return '…';
      default: return '○';
    }
  };

  if (status === 'success') {
    lines.push(`✅ **Workflow complete:** ${plan.title}\n`);
  } else if (status === 'partial') {
    lines.push(`⚠️ **Workflow partially complete:** ${plan.title}\n`);
  } else {
    lines.push(`❌ **Workflow failed:** ${plan.title}\n`);
    if (criticalFailure) {
      lines.push(`Critical step **${criticalFailure.label}** failed: ${criticalFailure.error}\n`);
    }
  }

  lines.push('**Steps:**');
  for (const r of stepResults) {
    const line = `${icon(r.status)} **${r.label}** — ${
      r.status === 'success' ? (r.summary ?? 'Done')
      : r.status === 'failed' ? `Failed: ${r.error ?? 'unknown error'}`
      : r.status === 'skipped' ? `Skipped (${r.summary ?? 'condition met'})`
      : r.status === 'rolled-back' ? 'Rolled back'
      : r.summary ?? r.status
    }`;
    lines.push(line);
  }

  const completed = stepResults.filter(r => r.status === 'success').length;
  const failed = stepResults.filter(r => r.status === 'failed').length;
  const skipped = stepResults.filter(r => r.status === 'skipped').length;
  const rolledBack = stepResults.filter(r => r.status === 'rolled-back').length;
  lines.push(`\n**Summary:** ${completed} completed, ${skipped} skipped, ${failed} failed${rolledBack > 0 ? `, ${rolledBack} rolled back` : ''}.`);

  if (status === 'partial') {
    lines.push('\n_The workflow continued past the failed step because it was not critical. The failed step may need manual attention._');
  } else if (status === 'failed' && rolledBack > 0) {
    lines.push('\n_Because a critical step failed, prior steps were rolled back to avoid leaving partial data. No further action is needed unless you want to retry._');
  } else if (status === 'failed') {
    lines.push('\n_The workflow halted at the critical step. Prior steps completed but could not be rolled back — please review them manually._');
  }

  return lines.join('\n');
}

/** Build view-in deep-links based on the plan category + the entities created. */
function buildViewInLinks(plan: WorkflowPlan, stepOutputs: Record<string, Record<string, any>>): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  const categoryLinkMap: Record<string, { label: string; href: string }> = {
    sales: { label: 'View in Invoices', href: '/invoices' },
    payment: { label: 'View in Payments', href: '/payments' },
    gst: { label: 'View in Returns', href: '/returns' },
    crm: { label: 'View in CRM', href: '/crm' },
    reports: { label: 'View in Reports', href: '/reports' },
    operations: { label: 'View Dashboard', href: '/dashboard' },
    custom: { label: 'View Dashboard', href: '/dashboard' },
  };
  const primary = categoryLinkMap[plan.category];
  if (primary) links.push(primary);
  return links;
}
