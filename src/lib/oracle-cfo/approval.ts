// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Approval & Audit Layer
//
// APPROVAL:
//   Critical actions never auto-execute. The analyze route creates a pending
//   approval request (persisted to Firestore) containing the toolId, input,
//   decision card, and ctx. The user sees it and clicks Approve/Reject.
//   On Approve → execute route runs the real tool + writes audit.
//
// AUDIT:
//   Every CFO action (approved or rejected, success or failure) creates an
//   audit entry in the oracle_cfo_actions Firestore collection with:
//     timestamp, user, action, recordsAffected, aiProvider, executionMs,
//     result, rollbackStatus, decisionCard
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection, doc, setDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ToolContext, ToolResult } from './tools';
import type { DecisionCard } from './explain';
import type { DetectedToolCall } from './intent';

const CFO_ACTIONS_COLLECTION = 'oracle_cfo_actions';
const CFO_APPROVALS_COLLECTION = 'oracle_cfo_approvals';

// ─── Approval Types ─────────────────────────────────────────────────────────

export interface ApprovalRequest {
  approvalId: string;
  toolId: string;
  toolName: string;
  toolIcon: string;
  category: string;
  input: Record<string, unknown>;
  detectedCall: DetectedToolCall;
  decisionCard: DecisionCard;
  ctx: ToolContext;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  createdAt: string;
  decidedAt?: string;
  executedAt?: string;
  result?: ToolResult;
  decidedBy?: string;
}

export interface ApprovalResult {
  approvalId: string;
  status: ApprovalRequest['status'];
  message: string;
  result?: ToolResult;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function firestoreSet(collectionName: string, id: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

async function firestoreGet(collectionName: string, id: string): Promise<Record<string, unknown> | null> {
  try {
    const d = await getDoc(doc(db, collectionName, id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() };
  } catch {
    // Preview mode: Firestore rules deny reads. Return null so callers fall
    // back to inline approval objects passed from the client.
    return null;
  }
}

async function firestoreUpdate(collectionName: string, id: string, updates: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, collectionName, id), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// ─── Approval Workflow ──────────────────────────────────────────────────────

/**
 * Create a pending approval request. Persisted to Firestore (best-effort) so
 * it survives page refresh and can be audited even if the user never acts.
 * If the Firestore write fails (e.g. preview mode without auth), the approval
 * object is still returned — the client holds it in memory and passes it back
 * to /execute, which re-validates before running the tool.
 */
export async function createApprovalRequest(
  detectedCall: DetectedToolCall,
  input: Record<string, unknown>,
  decisionCard: DecisionCard,
  ctx: ToolContext,
): Promise<ApprovalRequest> {
  const approvalId = genId('cfo_appr');
  const request: ApprovalRequest = {
    approvalId,
    toolId: detectedCall.toolId,
    toolName: detectedCall.toolName,
    toolIcon: detectedCall.toolIcon,
    category: detectedCall.category,
    input,
    detectedCall,
    decisionCard,
    ctx,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    await firestoreSet(CFO_APPROVALS_COLLECTION, approvalId, {
      approvalId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      toolId: request.toolId,
      toolName: request.toolName,
      category: request.category,
      input: JSON.parse(JSON.stringify(input)),
      decisionCard: JSON.parse(JSON.stringify(decisionCard)),
      status: 'pending',
      createdAt: request.createdAt,
    });
  } catch (e) {
    // Best-effort persistence — in preview mode Firestore rules may deny
    // writes. The approval is still valid in-memory; the client passes it
    // back to /execute which re-validates before running the tool.
    console.warn('[Oracle CFO] approval persistence skipped (preview mode):', e instanceof Error ? e.message : e);
  }

  return request;
}

/**
 * Get a pending approval request by ID.
 */
export async function getApprovalRequest(approvalId: string): Promise<ApprovalRequest | null> {
  const raw = await firestoreGet(CFO_APPROVALS_COLLECTION, approvalId);
  if (!raw) return null;
  return raw as unknown as ApprovalRequest;
}

/**
 * Mark an approval as decided (approved/rejected) and record who decided.
 */
export async function decideApproval(
  approvalId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
): Promise<ApprovalRequest | null> {
  await firestoreUpdate(CFO_APPROVALS_COLLECTION, approvalId, {
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedBy,
  });
  return getApprovalRequest(approvalId);
}

/**
 * Mark an approval as executed (with result) after the tool runs.
 */
export async function completeApproval(
  approvalId: string,
  result: ToolResult,
): Promise<void> {
  await firestoreUpdate(CFO_APPROVALS_COLLECTION, approvalId, {
    status: result.success ? 'executed' : 'failed',
    executedAt: new Date().toISOString(),
    result: JSON.parse(JSON.stringify(result)),
  });
}

// ─── Audit Logging ──────────────────────────────────────────────────────────

export interface CfoAuditEntry {
  auditId: string;
  organizationId: string;
  userId: string;
  userEmail: string;
  toolId: string;
  toolName: string;
  category: string;
  action: 'analyze' | 'approve' | 'reject' | 'execute' | 'rollback';
  status: 'success' | 'failure' | 'pending' | 'rejected';
  input: Record<string, unknown>;
  recordsAffected: ToolResult['recordsAffected'];
  result?: ToolResult;
  decisionCard?: DecisionCard;
  aiProvider: string;
  executionMs: number;
  rollbackStatus?: string;
  timestamp: string;
}

/**
 * Write a CFO audit entry. Never throws — audit failures are logged to console.
 */
export async function writeCfoAudit(entry: Omit<CfoAuditEntry, 'auditId' | 'timestamp'>): Promise<string> {
  const auditId = genId('cfo_audit');
  try {
    await firestoreSet(CFO_ACTIONS_COLLECTION, auditId, {
      auditId,
      organizationId: entry.organizationId,
      userId: entry.userId,
      userEmail: entry.userEmail,
      toolId: entry.toolId,
      toolName: entry.toolName,
      category: entry.category,
      action: entry.action,
      status: entry.status,
      input: JSON.parse(JSON.stringify(entry.input)),
      recordsAffected: JSON.parse(JSON.stringify(entry.recordsAffected)),
      result: entry.result ? JSON.parse(JSON.stringify(entry.result)) : null,
      decisionCard: entry.decisionCard ? JSON.parse(JSON.stringify(entry.decisionCard)) : null,
      aiProvider: entry.aiProvider,
      executionMs: entry.executionMs,
      rollbackStatus: entry.rollbackStatus ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[Oracle CFO] audit write failed:', e);
  }
  return auditId;
}

/**
 * Get recent CFO audit entries for an organization.
 */
export async function getRecentCfoAudit(
  organizationId: string,
  limitCount = 20,
): Promise<CfoAuditEntry[]> {
  try {
    const q = query(
      collection(db, CFO_ACTIONS_COLLECTION),
      where('organizationId', '==', organizationId),
      orderBy('timestamp', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as unknown as CfoAuditEntry);
  } catch {
    return [];
  }
}

/**
 * Get pending approvals for an organization.
 */
export async function getPendingApprovals(
  organizationId: string,
  limitCount = 10,
): Promise<ApprovalRequest[]> {
  try {
    const q = query(
      collection(db, CFO_APPROVALS_COLLECTION),
      where('organizationId', '==', organizationId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as unknown as ApprovalRequest);
  } catch {
    return [];
  }
}
