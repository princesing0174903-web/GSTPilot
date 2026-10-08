// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Workflow Engine: Planner
// ═══════════════════════════════════════════════════════════════════════════════
//
// Converts a natural-language user message into a WorkflowPlan.
//
// Two-stage planning:
//   STAGE 1 — Template matching (fast, free, deterministic)
//     Keyword/regex match against the pre-built templates in templates.ts.
//     If a template matches, the LLM's extracted args are fed to its build()
//     factory. This covers the 5 canonical workflows (sales, payment, gst,
//     crm, reports) without any LLM round-trip.
//
//   STAGE 2 — LLM fallback (for novel multi-step requests)
//     When no template matches, the planner calls the LLM with:
//       • the user message
//       • the list of all registered Action Engine actions (name + description
//         + param schema) so the LLM knows what building blocks are available
//       • the list of template summaries (so the LLM can recommend a template
//         if one fits but the regex missed it)
//     The LLM emits a JSON WorkflowPlan (custom steps chaining registered
//     actions). The planner validates that every step.actionName is a real
//     registered action — if not, the plan is rejected and the brain route
//     falls back to single-action mode.
//
// The planner NEVER executes anything — it only builds a plan. Execution +
// confirmation happens in the executor + UI.
// ═══════════════════════════════════════════════════════════════════════════════

import ZAI from 'z-ai-web-dev-sdk';
import { listActions, isRegisteredAction } from '@/lib/oracle/action-engine';
import { matchTemplate, buildCustomPlan, listTemplateSummaries } from './templates';
import type { WorkflowPlan, WorkflowStep, WorkflowPlannerInput, WorkflowCategory, WorkflowRiskLevel } from './types';

// ─── Result type ──────────────────────────────────────────────────────────────

export interface PlannerResult {
  ok: boolean;
  plan?: WorkflowPlan;
  /** Why planning failed (when ok === false). */
  error?: string;
  /** 'template' if matched a template, 'llm' if the LLM built a custom plan. */
  source?: 'template' | 'llm';
}

// ─── Stage 1: Template matching ───────────────────────────────────────────────

/**
 * Try to match the message against a known template. If matched, build the plan
 * from the LLM-extracted args.
 */
function tryTemplateMatch(input: WorkflowPlannerInput): WorkflowPlan | null {
  const tpl = matchTemplate(input.message);
  if (!tpl) return null;

  // Validate the extracted args
  if (tpl.validateArgs) {
    const missing = tpl.validateArgs(input.extractedArgs ?? {});
    if (missing.length > 0) {
      // Args insufficient — let the LLM planner handle it (the LLM will be
      // prompted to extract the missing args).
      return null;
    }
  }

  const plan = tpl.build(input.extractedArgs ?? {}, input.message);
  return plan;
}

// ─── Stage 2: LLM fallback ────────────────────────────────────────────────────

/**
 * Ask the LLM to build a custom workflow plan from the user message. The LLM
 * gets the list of registered actions + template summaries and emits a JSON
 * plan. Every step.actionName MUST be a registered action.
 */
async function llmBuildPlan(input: WorkflowPlannerInput): Promise<WorkflowPlan | null> {
  const actions = listActions();
  const actionList = actions.map(a =>
    `- ${a.name} (${a.category}/${a.icon}): ${a.description}. Params: ${a.paramSchema.map(p => `${p.key}${p.required ? '*' : ''}`).join(', ')}`,
  ).join('\n');

  const templates = listTemplateSummaries();
  const templateList = templates.map(t => `- ${t.id}: ${t.name} — ${t.description}`).join('\n');

  const systemPrompt = `You are the VEYRO AI Workflow Planner. Your job is to convert a user's natural-language request into a multi-step WorkflowPlan that chains existing Action Engine actions.

Available Action Engine actions (you may ONLY use these as step.actionName):
${actionList}

Pre-built workflow templates (recommend one if it fits — the caller has already tried regex matching, so only suggest if the fit is clear and the user's intent needs a custom plan):
${templateList}

Output a JSON object with this exact shape (NO markdown, NO explanation — ONLY raw JSON):
{
  "title": "short human title",
  "description": "one-line description for the confirm card",
  "category": "sales" | "payment" | "gst" | "crm" | "reports" | "operations" | "custom",
  "riskLevel": "low" | "medium" | "high",
  "steps": [
    {
      "id": "uniqueStepId",
      "actionName": "MUST be one of the actions listed above",
      "label": "human label for the progress UI",
      "description": "why this step exists",
      "args": { "param": "value OR {{priorStepId.data.field}} template var" },
      "critical": true_or_false,
      "skipCondition": "optional {{template}} expr — omit if not needed",
      "rollback": { "actionName": "compensating action", "args": {} }
    }
  ]
}

Rules:
1. Every step.actionName MUST be a registered action from the list above.
2. Chain steps via template vars: step N can reference step M's output as {{stepM.data.fieldName}}.
3. Mark create/modify steps as critical:true; side-effects (email, reminder, export) as critical:false.
4. Add a rollback action for any step that creates data (e.g. createInvoice → rollback deleteInvoice).
5. Keep it minimal — only include steps the user actually asked for. Don't pad with unnecessary refresh/navigation steps (the executor auto-refreshes the dashboard at the end).
6. If the request is really a single action, return {"singleAction": true} — the caller will fall back to single-action mode.
7. Output ONLY the JSON. No prose, no code fences.`;

  const userPrompt = `User request: "${input.message}"

Extracted args (from the brain route's earlier param extraction, may be incomplete): ${JSON.stringify(input.extractedArgs ?? {})}

Build the workflow plan JSON.`;

  let llm: any;
  try {
    llm = await ZAI.create();
  } catch (e) {
    console.warn('[workflow-planner] ZAI init failed:', (e as Error).message);
    return null;
  }

  let raw: string;
  try {
    const resp = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });
    raw = resp.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    console.warn('[workflow-planner] LLM call failed:', (e as Error).message);
    return null;
  }

  // Extract JSON from the response (tolerate code fences / surrounding prose)
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    console.warn('[workflow-planner] no JSON in LLM response:', raw.slice(0, 200));
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.warn('[workflow-planner] JSON parse failed:', (e as Error).message);
    return null;
  }

  // Single-action escape hatch
  if (parsed.singleAction === true) return null;

  // Validate every step.actionName is registered
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) return null;
  for (const step of parsed.steps) {
    if (!step.actionName || !isRegisteredAction(step.actionName)) {
      console.warn(`[workflow-planner] step "${step.id}" references unknown action "${step.actionName}" — rejecting plan`);
      return null;
    }
  }

  // Normalize + build the WorkflowPlan
  const steps: WorkflowStep[] = parsed.steps.map((s: any, i: number) => ({
    id: String(s.id ?? `step${i + 1}`),
    actionName: String(s.actionName),
    label: String(s.label ?? s.actionName),
    description: s.description ? String(s.description) : undefined,
    args: (s.args && typeof s.args === 'object') ? s.args : {},
    skipCondition: s.skipCondition ? String(s.skipCondition) : undefined,
    critical: s.critical !== false, // default true
    rollback: (s.rollback && s.rollback.actionName && isRegisteredAction(s.rollback.actionName))
      ? { actionName: String(s.rollback.actionName), args: s.rollback.args ?? {} }
      : undefined,
  }));

  return buildCustomPlan(
    String(parsed.title ?? 'Custom workflow'),
    String(parsed.description ?? 'Multi-step workflow'),
    steps,
    input.message,
    (parsed.riskLevel as WorkflowRiskLevel) ?? 'medium',
  );
}

/** Extract the first balanced JSON object from a string (tolerates fences/prose). */
function extractJson(text: string): string | null {
  if (!text) return null;
  // Strip code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  // Find the first { … } balanced block
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Plan a workflow from a natural-language message.
 *
 * Stage 1: try template matching (fast, free).
 * Stage 2: if no template matches (or args are insufficient), call the LLM to
 *          build a custom plan from the registered actions.
 *
 * Returns { ok: true, plan } on success, or { ok: false, error } if planning
 * fails entirely (the caller falls back to single-action mode).
 */
export async function planWorkflow(input: WorkflowPlannerInput): Promise<PlannerResult> {
  // Stage 1: template match
  try {
    const templatePlan = tryTemplateMatch(input);
    if (templatePlan) {
      return { ok: true, plan: templatePlan, source: 'template' };
    }
  } catch (e) {
    console.warn('[workflow-planner] template match error:', (e as Error).message);
  }

  // Stage 2: LLM fallback
  try {
    const llmPlan = await llmBuildPlan(input);
    if (llmPlan) {
      return { ok: true, plan: llmPlan, source: 'llm' };
    }
  } catch (e) {
    console.warn('[workflow-planner] LLM fallback error:', (e as Error).message);
  }

  return { ok: false, error: 'No workflow template matched and the LLM could not build a custom plan.' };
}

/**
 * Quick check: does this message look like a workflow request (multi-step)?
 * Used by the brain route to decide whether to invoke the planner at all.
 * Heuristic: mentions 2+ action verbs, or contains "and then", "and also",
 * "after that", or a comma-separated list of actions.
 */
export function looksLikeWorkflowRequest(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  // Multi-step connectors
  const connectors = [' and then ', ' and also ', ' after that ', ' then also ', ', then ', ' and '];
  let connectorHits = 0;
  for (const c of connectors) {
    if (lower.includes(c)) connectorHits++;
  }
  // Action verbs
  const actionVerbs = ['create', 'send', 'email', 'record', 'schedule', 'generate', 'export', 'prepare', 'add', 'mark', 'file', 'sync'];
  let verbHits = 0;
  for (const v of actionVerbs) {
    const re = new RegExp(`\\b${v}\\b`, 'gi');
    const matches = lower.match(re);
    if (matches) verbHits += matches.length;
  }
  // 2+ verbs OR (1 connector AND 2+ verbs) → workflow candidate
  return verbHits >= 2 && connectorHits >= 1;
}
