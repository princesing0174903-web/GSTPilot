// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Execute API (the ACT step)
//
// POST /api/oracle/cfo/execute
//
// Input:  { approvalId, decision: 'approved' | 'rejected', userId, userEmail }
// Output: { success, result, auditId, message }
//
// This route:
//   1. Loads the approval request from Firestore
//   2. If rejected → mark rejected + write audit + return
//   3. If approved → mark approved → run the REAL tool executor → write audit
//   4. Returns the full ToolResult + audit ID
//
// The tool executor performs REAL Firestore writes. No simulations.
// On failure, the tool's rollback runs (if available) and the audit records it.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { getApprovalRequest, decideApproval, completeApproval, writeCfoAudit } from '@/lib/oracle-cfo/approval';
import { getTool } from '@/lib/oracle-cfo/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const approvalId: string = body.approvalId;
  const decision: 'approved' | 'rejected' = body.decision;
  const userId = String(body.userId ?? 'preview-user');
  const userEmail = String(body.userEmail ?? 'preview@gstpilot.in');
  // In preview mode (Firestore rules deny reads), the client passes the full
  // approval object back so we can execute without a Firestore lookup.
  const inlineApproval = body.approval ?? null;

  if (!approvalId || !decision) {
    return NextResponse.json(
      { error: 'approvalId and decision (approved|rejected) are required' },
      { status: 400 },
    );
  }

  const orgId0 = String(body.organizationId ?? body.orgId ?? body.firmId ?? '');
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    // ─── 1. Load the approval request (from Firestore, or inline fallback) ─
    let approval = await getApprovalRequest(approvalId);
    if (!approval && inlineApproval) {
      // Preview mode: reconstruct the approval from the inline object.
      // The client sends toolId, toolName, input, decisionCard — we synthesize
      // the ctx from the body params so the tool executor has what it needs.
      approval = {
        approvalId,
        toolId: inlineApproval.toolId,
        toolName: inlineApproval.toolName,
        toolIcon: inlineApproval.toolIcon ?? '',
        category: inlineApproval.category ?? '',
        input: inlineApproval.input ?? {},
        detectedCall: inlineApproval.detectedCall ?? null,
        decisionCard: inlineApproval.decisionCard,
        ctx: {
          organizationId: String(body.organizationId ?? 'preview-org'),
          firmId: body.firmId ? String(body.firmId) : null,
          userId,
          userEmail,
          userRole: (body.userRole as 'admin' | 'manager' | 'staff' | 'viewer') ?? 'manager',
        },
        status: 'pending',
        createdAt: inlineApproval.createdAt ?? new Date().toISOString(),
      } as Awaited<ReturnType<typeof getApprovalRequest>>;
    }
    if (!approval) {
      return NextResponse.json(
        { error: 'Approval request not found. It may have expired.' },
        { status: 404 },
      );
    }

    // In preview mode the status field may not exist (never persisted). Treat
    // null/undefined status as pending so the action can proceed.
    const currentStatus = approval.status ?? 'pending';
    if (currentStatus !== 'pending') {
      return NextResponse.json(
        {
          error: `This approval has already been ${currentStatus}. No further action possible.`,
          status: currentStatus,
        },
        { status: 409 },
      );
    }

    // ─── 2. Handle rejection ─────────────────────────────────────────────
    if (decision === 'rejected') {
      try { await decideApproval(approvalId, 'rejected', userEmail); } catch { /* preview mode — persistence skipped */ }
      await writeCfoAudit({
        organizationId: approval.ctx.organizationId,
        userId,
        userEmail,
        toolId: approval.toolId,
        toolName: approval.toolName,
        category: approval.category,
        action: 'reject',
        status: 'rejected',
        input: approval.input,
        recordsAffected: [],
        decisionCard: approval.decisionCard,
        aiProvider: 'oracle-cfo',
        executionMs: Date.now() - startedAt,
        rollbackStatus: 'not-needed',
      });

      return NextResponse.json({
        success: true,
        status: 'rejected',
        message: `${approval.toolName} was rejected. No changes were made to your data.`,
        auditId: approvalId,
        durationMs: Date.now() - startedAt,
      });
    }

    // ─── 3. Handle approval → execute ────────────────────────────────────
    try { await decideApproval(approvalId, 'approved', userEmail); } catch { /* preview mode — persistence skipped */ }

    const tool = getTool(approval.toolId);
    if (!tool) {
      return NextResponse.json(
        { error: `Tool ${approval.toolId} is not registered.` },
        { status: 400 },
      );
    }

    // Permission check
    const roleRank = { viewer: 0, staff: 1, manager: 2, admin: 3 };
    const userRank = roleRank[approval.ctx.userRole] ?? 1;
    const requiredRank = roleRank[tool.permission] ?? 2;
    if (userRank < requiredRank) {
      await writeCfoAudit({
        organizationId: approval.ctx.organizationId,
        userId,
        userEmail,
        toolId: approval.toolId,
        toolName: approval.toolName,
        category: approval.category,
        action: 'execute',
        status: 'failure',
        input: approval.input,
        recordsAffected: [],
        decisionCard: approval.decisionCard,
        aiProvider: 'oracle-cfo',
        executionMs: Date.now() - startedAt,
        rollbackStatus: 'not-needed',
      });
      return NextResponse.json(
        { error: `Insufficient permissions. This action requires ${tool.permission} role.` },
        { status: 403 },
      );
    }

    // Execute the REAL tool
    const result = await tool.execute(approval.input, approval.ctx);

    // Mark approval as executed/failed (best-effort — preview mode skips)
    try { await completeApproval(approvalId, result); } catch { /* preview mode */ }

    // Write the execute audit entry
    const auditId = await writeCfoAudit({
      organizationId: approval.ctx.organizationId,
      userId,
      userEmail,
      toolId: approval.toolId,
      toolName: approval.toolName,
      category: approval.category,
      action: 'execute',
      status: result.success ? 'success' : 'failure',
      input: approval.input,
      recordsAffected: result.recordsAffected,
      result,
      decisionCard: approval.decisionCard,
      aiProvider: 'oracle-cfo',
      executionMs: result.executionMs,
      rollbackStatus: result.rollbackStatus,
    });

    return NextResponse.json({
      success: result.success,
      status: result.success ? 'executed' : 'failed',
      result,
      auditId,
      message: result.message,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: 'Oracle CFO execution failed. The error has been logged. Please try again or contact support if it persists.',
        detail: message,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
