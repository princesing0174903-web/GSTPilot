// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Action Engine: Pipeline
// ═══════════════════════════════════════════════════════════════════════════════
//
// The generic pipeline that runs an Oracle action end-to-end:
//   1. validate(action, args, orgId)    — live DB checks before confirmation
//   2. buildConfirmation(action, args, orgId) — preview for the confirm card
//   3. execute(action, args, orgId, ctx) — real Prisma write (after user confirms)
//   4. refreshContext(orgId, action, result) — refresh dashboard + Oracle context
//   5. buildSuccessResponse(...) — structured response returned to the UI
//
// The brain route calls buildConfirmation() when the LLM emits a confirmation-
// required tool call. The /api/oracle/brain/confirm route calls execute() after
// the user approves. Neither route knows anything about specific actions — they
// just delegate to the engine.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import {
  getAction,
  isRegisteredAction,
  type OracleAction,
  type ActionResult,
  type ActionContext,
  type ValidationResult,
  type ActionPreview,
  type RefreshedContext,
} from './registry';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The enriched confirmation payload sent to the UI via the `action-confirm` SSE event. */
export interface ActionConfirmation {
  action: string;
  displayName: string;
  icon: string;
  category: string;
  preview: ActionPreview;
  validation: ValidationResult;
  args: Record<string, any>;
  /** Generated server-side; the UI echoes it back on confirm. */
  toolCallId: string;
}

/** The structured success response returned by the confirm endpoint. */
export interface ActionSuccessResponse {
  ok: boolean;
  success: boolean;
  action: string;
  displayName: string;
  summary: string;
  result?: ActionResult['data'];
  artifacts?: ActionResult['artifacts'];
  followUp?: { label: string; prompt: string };
  viewIn?: { label: string; href: string };
  refreshedContext: RefreshedContext;
  /** The new assistant message id (persisted server-side). */
  messageId?: string;
}

/** The cancellation response. */
export interface ActionCancelResponse {
  ok: boolean;
  cancelled: boolean;
  action: string;
  toolCallId: string;
}

// ─── Pipeline stages ──────────────────────────────────────────────────────────

/**
 * Stage 1+2: Validate the args and build the confirmation payload.
 * Called by the brain route when the LLM emits a confirmation-required tool call.
 * If validation hard-fails, returns ok:false so the brain route can ask the LLM
 * to correct the args instead of showing a confirm card with errors.
 */
export async function buildConfirmation(
  actionName: string,
  args: Record<string, any>,
  orgId: string,
): Promise<{ ok: true; confirmation: ActionConfirmation } | { ok: false; error: string; validation?: ValidationResult }> {
  const action = getAction(actionName);
  if (!action) {
    return { ok: false, error: `Unknown action: ${actionName}` };
  }
  let validation: ValidationResult;
  try {
    validation = await action.validate(args, orgId);
  } catch (e) {
    return { ok: false, error: `Validation failed: ${(e as Error).message}` };
  }
  // Hard validation errors → don't even show the confirm card; let the LLM correct
  if (validation.errors.length > 0) {
    return {
      ok: false,
      error: `Cannot proceed: ${validation.errors.join('; ')}`,
      validation,
    };
  }
  const preview = action.buildPreview(args, validation);
  const toolCallId = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    ok: true,
    confirmation: {
      action: action.name,
      displayName: action.displayName,
      icon: action.icon,
      category: action.category,
      preview,
      validation,
      args,
      toolCallId,
    },
  };
}

/**
 * Stage 3+4+5: Execute the action (after user confirms) and refresh context.
 * Called by /api/oracle/brain/confirm.
 */
export async function executeAndRefresh(
  actionName: string,
  args: Record<string, any>,
  ctx: ActionContext,
): Promise<ActionSuccessResponse> {
  const action = getAction(actionName);
  if (!action) {
    return {
      ok: false,
      success: false,
      action: actionName,
      displayName: actionName,
      summary: `Unknown action: ${actionName}`,
      refreshedContext: {},
    };
  }

  // Defense in depth: re-validate before executing (args might have been tampered
  // with between confirm and execute).
  const revalidation = await action.validate(args, ctx.orgId).catch(() => null);
  if (revalidation && revalidation.errors.length > 0) {
    return {
      ok: false,
      success: false,
      action: actionName,
      displayName: action.displayName,
      summary: `Action cannot be executed: ${revalidation.errors.join('; ')}`,
      refreshedContext: {},
    };
  }

  // Execute the real Prisma write
  const t0 = Date.now();
  let result: ActionResult;
  try {
    result = await action.execute(args, ctx.orgId, ctx);
  } catch (e) {
    const errorMsg = (e as Error).message;
    console.error(`[action-engine] execute "${actionName}" failed:`, errorMsg);
    // Update the tool-call audit row to 'error'
    if (ctx.toolCallId) {
      db.oracleAIToolCall.update({
        where: { id: ctx.toolCallId },
        data: { status: 'error', error: errorMsg, durationMs: Date.now() - t0 },
      }).catch(() => {});
    }
    return {
      ok: false,
      success: false,
      action: actionName,
      displayName: action.displayName,
      summary: `Action failed: ${errorMsg}`,
      refreshedContext: {},
    };
  }
  const durationMs = Date.now() - t0;

  // Update the tool-call audit row to 'success'
  if (ctx.toolCallId) {
    db.oracleAIToolCall.update({
      where: { id: ctx.toolCallId },
      data: {
        status: result.ok ? 'success' : 'error',
        result: JSON.stringify(result.data ?? result.summary).slice(0, 10000),
        error: result.ok ? null : result.summary,
        durationMs,
      },
    }).catch(() => {});
  }

  // Refresh affected dashboard context
  let refreshedContext: RefreshedContext = {};
  try {
    refreshedContext = action.refreshContext
      ? await action.refreshContext(result, ctx.orgId)
      : await defaultRefreshContext(ctx.orgId);
  } catch (e) {
    console.warn(`[action-engine] refreshContext failed:`, (e as Error).message);
  }

  return {
    ok: result.ok,
    success: result.ok,
    action: actionName,
    displayName: action.displayName,
    summary: result.summary,
    result: result.data,
    artifacts: result.artifacts,
    followUp: result.followUp,
    viewIn: result.viewIn,
    refreshedContext,
  };
}

/**
 * Cancel a pending action — marks the tool-call audit row as 'cancelled'.
 * No database write happens.
 */
export async function cancelAction(
  actionName: string,
  toolCallId: string,
  ctx: ActionContext,
): Promise<ActionCancelResponse> {
  if (toolCallId) {
    db.oracleAIToolCall.update({
      where: { id: toolCallId },
      data: { status: 'error', error: 'Cancelled by user', durationMs: 0 },
    }).catch(() => {});
  }
  return {
    ok: true,
    cancelled: true,
    action: actionName,
    toolCallId,
  };
}

// ─── Default context refresh ──────────────────────────────────────────────────

/**
 * Default refresh: pulls the fresh business snapshot, recent invoices (5),
 * recent activity (5), and Oracle memory facts. This is what most actions need.
 * Actions with specific refresh needs (e.g. sendReminder → communication logs)
 * override refreshContext in their definition.
 */
export async function defaultRefreshContext(orgId: string): Promise<RefreshedContext> {
  const [snapshot, recentInvoices, recentActivity, memory] = await Promise.all([
    getBusinessSnapshot(orgId, { forceRefresh: true }).catch(() => null),
    db.invoice.findMany({
      where: { client: { firmId: orgId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, invoiceNumber: true, buyerName: true, totalAmount: true,
        invoiceDate: true, paymentStatus: true, status: true,
      },
    }).catch(() => []),
    db.activity.findMany({
      where: { firmId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, type: true, description: true, createdAt: true },
    }).catch(() => []),
    db.oracleMemory.findMany({
      where: { firmId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, summary: true, category: true, importance: true, createdAt: true },
    }).catch(() => []),
  ]);

  return {
    snapshot: snapshot ? {
      revenue: snapshot.revenue,
      revenueThisMonth: snapshot.revenueThisMonth,
      expenses: snapshot.expenses,
      profit: snapshot.profit,
      cash: snapshot.cash,
      receivables: snapshot.receivables,
      payables: snapshot.payables,
      gstLiability: snapshot.gstLiability,
      customerCount: snapshot.customerCount,
      invoiceCount: snapshot.invoiceCount,
      overdueInvoiceCount: snapshot.overdueInvoiceCount,
      overdueReceivables: snapshot.overdueReceivables,
      healthScore: snapshot.healthScore,
      healthScoreLabel: snapshot.healthScoreLabel,
    } : null,
    recentInvoices,
    recentActivity: recentActivity.map(a => ({
      id: a.id,
      type: a.type,
      description: a.description,
      createdAt: a.createdAt.toISOString(),
    })),
    memory,
    revenue: snapshot?.revenue,
    receivables: snapshot?.receivables,
    cash: snapshot?.cash,
  };
}

// ─── Convenience exports ──────────────────────────────────────────────────────

export { getAction, isRegisteredAction, type OracleAction };
