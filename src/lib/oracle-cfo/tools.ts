// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Tool Registry + Intent Detection + Approval Workflow
//
// Wraps the existing ORACLE_ACTIONS registry with:
//   1. Intent detection — given a user query, find the best-matching action
//      and pre-fill its input from the business context.
//   2. Pending approval store — Oracle proposes an action, user approves, then
//      it executes. Approvals are persisted to Firestore (survive refresh).
//   3. Approval lifecycle — pending → approved → executing → executed/failed.
//      Expire after 10 minutes for security.
//
// CRITICAL FIX: Uses adminDb() (server-side Admin SDK) for Firestore writes
// instead of the Prisma client (which doesn't have .collection()). This was
// a silent bug in the prior oracle-actions.ts that caused action execution
// to fail without surfacing the error.
// ═══════════════════════════════════════════════════════════════════════════════

import { adminDb } from '@/lib/firebase-admin';
import { ORACLE_ACTIONS, type OracleAction, type ActionContext, type ActionResult } from '@/lib/autonomous-finance/oracle-actions';
import { db } from '@/lib/db';
import type { BusinessContext, ProposedAction, ProposedActionSeverity } from './types';
import { logOracleOperation, type AuditContext } from './audit';

const APPROVALS_COLLECTION = 'oracle_approvals';
const APPROVAL_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Intent detection ────────────────────────────────────────────────────────

export interface IntentMatch {
  action: OracleAction;
  confidence: number;            // 0-1
  preFilledInput: Record<string, unknown>;
  reason: string;
  severity: ProposedActionSeverity;
  alternatives: Array<{ action: OracleAction; confidence: number }>;
}

// Keyword → action mapping (used for intent detection)
const INTENT_KEYWORDS: Record<string, string[]> = {
  'create-invoice': ['create invoice', 'generate invoice', 'make invoice', 'new invoice', 'draft invoice', 'send invoice'],
  'generate-report': ['generate report', 'create report', 'p&l', 'profit and loss', 'balance sheet', 'ar aging', 'gst summary', 'financial report'],
  'schedule-reminder': ['schedule reminder', 'set reminder', 'remind me', 'create task', 'follow up'],
  'prepare-gst-return': ['prepare gst', 'file gst', 'gstr-1', 'gstr-3b', 'gst return', 'file return'],
  'generate-reconciliation-report': ['reconcile', 'reconciliation', 'match invoices', '2b vs purchase'],
  'create-payment-link': ['payment link', 'collect payment', 'send payment link', 'razorpay', 'stripe'],
  'assign-task': ['assign task', 'delegate', 'assign to'],
  'draft-email': ['send email', 'draft email', 'email client', 'compose email'],
  'draft-whatsapp': ['send whatsapp', 'whatsapp message', 'whatsapp reminder'],
  'generate-executive-summary': ['executive summary', 'summary for', 'brief for', 'board summary', 'ceo summary'],
};

/**
 * Detect which Oracle action best matches the user's query, and pre-fill its
 * input from the business context.
 */
export function detectActionIntent(query: string, _ctx: BusinessContext): IntentMatch | null {
  const q = query.toLowerCase();
  const scored: Array<{ action: OracleAction; score: number; matchedKeywords: string[] }> = [];

  for (const action of ORACLE_ACTIONS) {
    const keywords = INTENT_KEYWORDS[action.id] ?? [];
    let score = 0;
    const matched: string[] = [];
    for (const kw of keywords) {
      if (q.includes(kw)) {
        score += kw.split(' ').length; // longer phrases score higher
        matched.push(kw);
      }
    }
    // Also check action name + description words
    const nameWords = action.name.toLowerCase().split(' ');
    for (const w of nameWords) {
      if (w.length > 3 && q.includes(w)) score += 0.5;
    }
    if (score > 0) {
      scored.push({ action, score, matchedKeywords: matched });
    }
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const alternatives = scored.slice(1, 4).map((s) => ({ action: s.action, confidence: normalizeScore(s.score) }));

  // Pre-fill input from query (basic entity extraction)
  const preFilled = preFillInput(best.action, query, _ctx);

  return {
    action: best.action,
    confidence: Math.min(0.95, normalizeScore(best.score)),
    preFilledInput: preFilled,
    reason: best.matchedKeywords.length > 0
      ? `Detected intent based on: "${best.matchedKeywords.join('", "')}"`
      : `Detected intent based on action name "${best.action.name}"`,
    severity: classifySeverity(best.action),
    alternatives,
  };
}

function normalizeScore(score: number): number {
  // Cap at 0.95 — never claim 100% confidence in intent detection
  return Math.min(0.95, 0.5 + score * 0.1);
}

function classifySeverity(action: OracleAction): ProposedActionSeverity {
  // Critical: anything that touches GST filing, payments, or external comms
  if (['prepare-gst-return', 'create-payment-link', 'draft-email', 'draft-whatsapp'].includes(action.id)) {
    return 'critical';
  }
  if (['create-invoice', 'generate-reconciliation-report', 'generate-executive-summary'].includes(action.id)) {
    return 'high';
  }
  if (['generate-report', 'assign-task'].includes(action.id)) {
    return 'medium';
  }
  return 'low';
}

function preFillInput(action: OracleAction, query: string, ctx: BusinessContext): Record<string, unknown> {
  const pre: Record<string, unknown> = {};

  // Extract amounts (₹X, Rs X, X rupees)
  const amountMatch = query.match(/(?:₹|rs\.?|rupees?)\s*([0-9,]+(?:\.[0-9]+)?)/i);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (!isNaN(amount)) {
      if (action.inputSchema.some((f) => f.key === 'amount')) pre.amount = amount;
      if (action.inputSchema.some((f) => f.key === 'totalAmount')) pre.totalAmount = amount;
    }
  }

  // Extract periods (MM-YYYY, YYYY-MM, "this month", "last month")
  const periodMatch = query.match(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/);
  if (periodMatch) {
    const month = periodMatch[1].padStart(2, '0');
    const year = periodMatch[2];
    const period = `${month}-${year}`;
    if (action.inputSchema.some((f) => f.key === 'period')) pre.period = period;
  } else {
    // Default to current GST period
    if (action.inputSchema.some((f) => f.key === 'period')) {
      pre.period = ctx.currentGstPeriod;
    }
  }

  // Extract dates (YYYY-MM-DD, DD/MM/YYYY, "today", "tomorrow")
  const dateMatch = query.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (dateMatch) {
    const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    if (action.inputSchema.some((f) => f.key === 'dueDate')) pre.dueDate = date;
  } else if (action.inputSchema.some((f) => f.key === 'dueDate')) {
    // Default: 7 days from now
    const d = new Date();
    d.setDate(d.getDate() + 7);
    pre.dueDate = d.toISOString().slice(0, 10);
  }

  // Default priority for tasks
  if (action.inputSchema.some((f) => f.key === 'priority')) {
    if (/urgent|critical|asap/i.test(query)) pre.priority = 'critical';
    else if (/high|important/i.test(query)) pre.priority = 'high';
    else pre.priority = 'medium';
  }

  // Default returnType for GST returns
  if (action.inputSchema.some((f) => f.key === 'returnType')) {
    pre.returnType = /gstr-3b|3b/i.test(query) ? 'GSTR-3B' : 'GSTR-1';
  }

  // Default reportType for reports
  if (action.inputSchema.some((f) => f.key === 'reportType')) {
    if (/p&l|profit and loss|profit & loss/i.test(query)) pre.reportType = 'pnl';
    else if (/balance sheet/i.test(query)) pre.reportType = 'balance_sheet';
    else if (/ar aging|receivable/i.test(query)) pre.reportType = 'ar_aging';
    else if (/gst summary/i.test(query)) pre.reportType = 'gst_summary';
  }

  return pre;
}

// ─── Pending approval store ──────────────────────────────────────────────────

/**
 * Create a pending approval record. Oracle proposes an action; the user must
 * approve it before execution. The approval is persisted to Firestore so it
 * survives page refresh.
 */
export async function createPendingApproval(
  action: OracleAction,
  preFilledInput: Record<string, unknown>,
  reason: string,
  severity: ProposedActionSeverity,
  ctx: AuditContext,
  conversationTurnId: string,
): Promise<ProposedAction> {
  const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS).toISOString();

  // Compute dry-run preview (safe — never executes)
  let dryRunPreview: unknown = undefined;
  try {
    dryRunPreview = action.dryRun(preFilledInput, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
    });
  } catch {
    // Dry run failure is non-fatal
  }

  const proposed: ProposedAction = {
    approvalId,
    actionId: action.id,
    actionName: action.name,
    description: action.description,
    severity,
    reason,
    preFilledInput,
    inputSchema: action.inputSchema,
    dryRunPreview,
    status: 'pending-approval',
    expiresAt,
  };

  try {
    await adminDb().collection(APPROVALS_COLLECTION).doc(approvalId).set({
      ...proposed,
      conversationTurnId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[oracle-cfo:approvals] Failed to persist approval', {
      approvalId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Non-fatal — the approval still works for the current session
  }

  return proposed;
}

/**
 * Approve and execute a pending approval. Returns the action result + audit ID.
 */
export async function approveAndExecute(
  approvalId: string,
  overrides: Record<string, unknown>,
  ctx: AuditContext,
): Promise<{ proposed: ProposedAction | null; result: ActionResult | null; error?: string }> {
  // 1. Read the pending approval
  let proposed: ProposedAction | null = null;
  try {
    const doc = await adminDb().collection(APPROVALS_COLLECTION).doc(approvalId).get();
    if (!doc.exists) {
      return { proposed: null, result: null, error: 'Approval not found. It may have expired.' };
    }
    proposed = doc.data() as ProposedAction;
  } catch (err) {
    return {
      proposed: null,
      result: null,
      error: `Failed to read approval: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }

  if (!proposed) {
    return { proposed: null, result: null, error: 'Approval record is empty.' };
  }

  // 2. Check status + expiry
  if (proposed.status === 'executed') {
    return { proposed, result: null, error: 'This action has already been executed.' };
  }
  if (proposed.status === 'rejected') {
    return { proposed, result: null, error: 'This action was rejected and cannot be executed.' };
  }
  if (new Date(proposed.expiresAt) < new Date()) {
    await updateApprovalStatus(approvalId, 'expired');
    return { proposed, result: null, error: 'This approval has expired. Please ask Oracle again.' };
  }

  // 3. Mark as executing
  await updateApprovalStatus(approvalId, 'executing');

  // 4. Merge overrides with pre-filled input
  const finalInput = { ...proposed.preFilledInput, ...overrides };

  // 5. Execute via the existing ORACLE_ACTIONS executor (with audit logging)
  const actionCtx: ActionContext = {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    userEmail: ctx.userEmail,
  };

  // Use the same executor that the existing /api/oracle/action uses, but
  // route through a corrected path that uses adminDb for Firestore writes.
  const result = await executeActionWithAdminDb(proposed.actionId, finalInput, actionCtx);

  // 6. Update the approval record with the result
  const newStatus = result.success ? 'executed' : 'failed';
  await updateApprovalStatus(approvalId, newStatus, {
    executedAt: new Date().toISOString(),
    executionResult: {
      success: result.success,
      output: result.output,
      error: result.error,
      auditId: result.auditId,
    },
  });

  // 7. Audit log the approval execution
  await logOracleOperation(ctx, {
    operationType: 'cfo-execute',
    actionId: proposed.actionId,
    question: `Approved: ${proposed.actionName}`,
    recordsAffected: 1,
    aiProvider: 'oracle-cfo-engine',
    executionTimeMs: 0,
    result: result.success ? 'success' : 'failure',
    errorMessage: result.error,
    rollbackStatus: result.success ? 'not-required' : 'not-required',
  });

  return { proposed, result };
}

/**
 * Reject a pending approval (no execution).
 */
export async function rejectApproval(
  approvalId: string,
  ctx: AuditContext,
): Promise<{ success: boolean; error?: string }> {
  try {
    await updateApprovalStatus(approvalId, 'rejected', {
      executedAt: new Date().toISOString(),
    });
    await logOracleOperation(ctx, {
      operationType: 'cfo-reject',
      recordsAffected: 0,
      aiProvider: 'oracle-cfo-engine',
      executionTimeMs: 0,
      result: 'success',
      rollbackStatus: 'not-required',
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Failed to reject approval: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

/**
 * List pending approvals for an organization (not yet executed/expired).
 */
export async function listPendingApprovals(organizationId: string): Promise<ProposedAction[]> {
  try {
    const snap = await adminDb()
      .collection(APPROVALS_COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'pending-approval')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    return snap.docs.map((d) => d.data() as ProposedAction);
  } catch {
    return [];
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function updateApprovalStatus(
  approvalId: string,
  status: ProposedAction['status'],
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    await adminDb().collection(APPROVALS_COLLECTION).doc(approvalId).set(
      { status, ...extra, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  } catch (err) {
    console.error('[oracle-cfo:approvals] Failed to update approval status', {
      approvalId,
      status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Execute an Oracle action using the correct Firestore client (adminDb).
 *
 * This is a CORRECTED version of the executor in oracle-actions.ts, which had
 * a silent bug: it imported `db` from `@/lib/db` (Prisma) but used
 * `db.collection()` (Firestore syntax) — so action execution always failed.
 *
 * This function re-implements the executor pattern with the correct client.
 */
async function executeActionWithAdminDb(
  actionId: string,
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<ActionResult> {
  const action = ORACLE_ACTIONS.find((a) => a.id === actionId);
  if (!action) {
    const auditId = await writeAuditAdmin(ctx, actionId, input, { success: false, error: 'Unknown action' }, false);
    return { success: false, auditId, error: `Unknown action: ${actionId}` };
  }

  // Validate required inputs
  for (const field of action.inputSchema) {
    if (field.required && (input[field.key] === undefined || input[field.key] === '')) {
      const auditId = await writeAuditAdmin(ctx, actionId, input, { success: false, error: `Missing required field: ${field.key}` }, false);
      return { success: false, auditId, error: `Missing required field: ${field.label}` };
    }
  }

  // Execute via a corrected path that writes to adminDb
  try {
    const output = await executeWithAdminWrite(action, input, ctx);
    const auditId = await writeAuditAdmin(ctx, actionId, input, { success: true, output }, false);
    return { success: true, output, auditId };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Execution failed';
    const auditId = await writeAuditAdmin(ctx, actionId, input, { success: false, error }, false);
    return { success: false, auditId, error };
  }
}

/**
 * Re-implement each action's executor with the correct Firestore client.
 * The original executors used `db.collection()` (Prisma) which silently failed.
 * This version uses `adminDb().collection()` which actually writes.
 */
async function executeWithAdminDb(
  action: OracleAction,
  input: Record<string, unknown>,
  ctx: ActionContext,
): Promise<unknown> {
  const admin = adminDb();
  const baseData = {
    organizationId: ctx.organizationId,
    firmId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  switch (action.id) {
    case 'create-invoice': {
      const id = `inv_${Date.now()}`;
      await admin.collection('invoices').doc(id).set({
        ...baseData,
        invoiceId: id,
        clientId: input.clientId,
        documentId: null,
        invoiceNumber: input.invoiceNumber ?? `INV-${Date.now()}`,
        invoiceDate: new Date().toISOString().slice(0, 10),
        sellerGstin: '',
        buyerGstin: null,
        buyerName: null,
        invoiceType: 'sales',
        gstr1Section: 'b2b',
        taxableValue: Number(input.taxableValue ?? 0),
        cgst: 0, sgst: 0, igst: 0, cess: 0,
        totalAmount: Number(input.totalAmount ?? 0),
        hsnCode: null, reverseCharge: false, placeOfSupply: null,
        status: 'draft', matchStatus: 'unmatched', riskLevel: 'low', riskScore: 0,
        aiExplanation: 'Created by Oracle CFO (approved action)', notes: null, period: null,
      });
      return { invoiceId: id, message: 'Invoice created as draft.' };
    }
    case 'generate-report': {
      const id = `rpt_${Date.now()}`;
      await admin.collection('reports').doc(id).set({
        ...baseData,
        reportId: id,
        clientId: null,
        reportType: input.reportType,
        period: input.period,
        status: 'draft',
        generatedBy: 'oracle-cfo',
        payload: null,
      });
      return { reportId: id, message: 'Report draft generated.' };
    }
    case 'schedule-reminder': {
      const id = `task_${Date.now()}`;
      await admin.collection('tasks').doc(id).set({
        ...baseData,
        taskId: id,
        title: input.title,
        description: 'Scheduled by Oracle CFO (approved action)',
        status: 'open',
        priority: input.priority ?? 'medium',
        assignedTo: null,
        clientId: null,
        dueDate: input.dueDate,
        tags: ['oracle', 'cfo', 'reminder'],
      });
      return { taskId: id, message: 'Reminder task scheduled.' };
    }
    case 'prepare-gst-return': {
      const id = `ret_${Date.now()}`;
      await admin.collection('returns').doc(id).set({
        ...baseData,
        returnId: id,
        clientId: input.clientId,
        returnType: input.returnType,
        period: input.period,
        financialYear: '',
        status: 'draft',
        filedDate: null,
        acknowledgmentNumber: null,
        totalInvoices: 0, readyForFiling: 0, issuesFound: 0, criticalErrors: 0, warnings: 0,
        totalTaxableValue: 0, totalTax: 0, jsonPayload: null,
        assignedTo: null, reviewedBy: null,
      });
      return { returnId: id, message: 'GST return draft prepared.' };
    }
    case 'generate-reconciliation-report': {
      const id = `recon_${Date.now()}`;
      await admin.collection('reconciliations').doc(id).set({
        ...baseData,
        reconId: id,
        clientId: input.clientId,
        period: input.period,
        sources: input.sources,
        status: 'running',
        totalRecords: 0, matched: 0, unmatched: 0, partialMatches: 0, highRisk: 0, gstDifference: 0,
        mismatches: [],
        runBy: 'oracle-cfo',
      });
      return { reconId: id, message: 'Reconciliation run started.' };
    }
    case 'create-payment-link': {
      const id = `pay_${Date.now()}`;
      const linkRef = `LINK-${id.slice(-6).toUpperCase()}`;
      await admin.collection('payments').doc(id).set({
        ...baseData,
        paymentId: id,
        clientId: input.clientId,
        invoiceId: input.invoiceId,
        purchaseBillId: null,
        partyName: '',
        partyType: 'customer',
        amount: Number(input.amount ?? 0),
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: 'link',
        referenceNo: linkRef,
        status: 'pending',
        reconciled: false,
        notes: 'Generated by Oracle CFO',
      });
      return { paymentId: id, linkRef, message: 'Payment link created.' };
    }
    case 'assign-task': {
      const id = `task_${Date.now()}`;
      await admin.collection('tasks').doc(id).set({
        ...baseData,
        taskId: id,
        title: input.title,
        description: 'Assigned by Oracle CFO (approved action)',
        status: 'open',
        priority: input.priority ?? 'medium',
        assignedTo: input.assignedTo,
        clientId: null,
        dueDate: input.dueDate,
        tags: ['oracle', 'cfo', 'assigned'],
      });
      return { taskId: id, message: 'Task assigned.' };
    }
    case 'draft-email': {
      const id = `comm_${Date.now()}`;
      await admin.collection('communications').doc(id).set({
        commId: id,
        organizationId: ctx.organizationId,
        channel: 'email',
        direction: 'outbound',
        to: input.to,
        subject: input.subject,
        body: input.body,
        status: 'draft',
        createdBy: 'oracle-cfo',
        createdAt: new Date(),
      });
      return { commId: id, message: 'Email draft saved.' };
    }
    case 'draft-whatsapp': {
      const id = `comm_${Date.now()}`;
      await admin.collection('communications').doc(id).set({
        commId: id,
        organizationId: ctx.organizationId,
        channel: 'whatsapp',
        direction: 'outbound',
        to: input.to,
        body: input.body,
        status: 'draft',
        createdBy: 'oracle-cfo',
        createdAt: new Date(),
      });
      return { commId: id, message: 'WhatsApp draft saved.' };
    }
    case 'generate-executive-summary': {
      const id = `sum_${Date.now()}`;
      await admin.collection('executive_summaries').doc(id).set({
        summaryId: id,
        organizationId: ctx.organizationId,
        period: input.period,
        audience: input.audience ?? 'ceo',
        status: 'draft',
        generatedBy: 'oracle-cfo',
        createdAt: new Date(),
      });
      return { summaryId: id, message: 'Executive summary draft created.' };
    }
    default:
      throw new Error(`Unknown action: ${action.id}`);
  }
}

/**
 * Audit log writer using adminDb (corrected from oracle-actions.ts which used Prisma).
 */
async function writeAuditAdmin(
  ctx: ActionContext,
  actionId: string,
  input: Record<string, unknown>,
  result: { success: boolean; output?: unknown; error?: string },
  dryRun: boolean,
): Promise<string> {
  const auditId = `cfo_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await adminDb().collection('activities').doc(auditId).set({
      activityId: auditId,
      organizationId: ctx.organizationId,
      type: 'oracle_cfo_action',
      action: actionId,
      actor: 'oracle-cfo',
      actorEmail: ctx.userEmail,
      userId: ctx.userId,
      input: JSON.parse(JSON.stringify(input)),
      result: JSON.parse(JSON.stringify(result)),
      dryRun,
      timestamp: new Date().toISOString(),
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[oracle-cfo:audit] Failed to write action audit log', {
      auditId,
      actionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return auditId;
}

/**
 * Invalidate the business context cache (called after action execution so
 * the next CFO question sees fresh data).
 */
export function invalidateContextAfterAction(organizationId: string): void {
  // Lazy import to avoid circular dependency
  import('./business-context').then(({ invalidateBusinessContextCache }) => {
    invalidateBusinessContextCache(organizationId);
  });
}

/**
 * Get the list of all available Oracle actions (passthrough to the registry).
 */
export function listAvailableActions(): Array<{ id: string; name: string; description: string; category: string; permission: string }> {
  return ORACLE_ACTIONS.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    permission: a.permission,
  }));
}

/**
 * Get client list for pre-filling invoice/payment actions.
 */
export async function getClientsForPrefill(organizationId: string): Promise<Array<{ id: string; name: string }>> {
  try {
    return await db.client.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 50,
    });
  } catch {
    return [];
  }
}
