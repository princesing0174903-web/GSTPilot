// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle CFO™ — Analyze API (the THINK step)
//
// POST /api/oracle/cfo/analyze
//
// Input:  { message, organizationId, firmId, userId, userEmail, userRole }
// Output: { detected, decisionCards, approvalRequests, liveData, hasActionableIntent }
//
// This route:
//   1. Loads live business data (clients, invoices, returns, GST profile)
//   2. Runs the intent router to detect actionable tools
//   3. For each detected tool, builds an explainable decision card
//   4. For tools requiring approval, creates a persistent approval request
//   5. Writes an "analyze" audit entry
//   6. Returns everything the client needs to render the CFO panel
//
// Never throws — always returns a valid response with meaningful errors.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { loadLiveBusinessData, type ToolContext } from '@/lib/oracle-cfo/tools';
import { routeIntent } from '@/lib/oracle-cfo/intent';
import { buildDecisionCard } from '@/lib/oracle-cfo/explain';
import { createApprovalRequest, writeCfoAudit } from '@/lib/oracle-cfo/approval';

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

  const message: string = body.message || '';
  if (!message || message.trim().length < 3) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const ctx: ToolContext = {
    organizationId: String(body.organizationId ?? 'preview-org'),
    firmId: body.firmId ? String(body.firmId) : null,
    userId: String(body.userId ?? 'preview-user'),
    userEmail: String(body.userEmail ?? 'preview@gstpilot.in'),
    userRole: (body.userRole as ToolContext['userRole']) ?? 'manager',
  };

  const orgId0 = String(body.organizationId ?? body.orgId ?? body.firmId ?? '');
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    // ─── 1. Load live business data ──────────────────────────────────────
    const liveData = await loadLiveBusinessData(ctx.organizationId);

    // ─── 2. Detect intent ────────────────────────────────────────────────
    const intentResult = await routeIntent(message, ctx, liveData);

    // ─── 3. Build decision cards + approval requests ─────────────────────
    const decisionCards = [];
    const approvalRequests = [];

    for (const detected of intentResult.detected) {
      const card = buildDecisionCard(detected, liveData, ctx);
      decisionCards.push(card);

      // Build the full input map (extracted + defaults)
      const inputMap: Record<string, unknown> = {};
      const tool = detected.toolId;
      // We need the tool's inputSchema to know all fields — re-import here
      const { getTool } = await import('@/lib/oracle-cfo/tools');
      const toolDef = getTool(tool);
      if (toolDef) {
        for (const field of toolDef.inputSchema) {
          const extracted = detected.extractedParams.find((p) => p.key === field.key);
          inputMap[field.key] = extracted?.value ?? field.defaultValue ?? '';
        }
      }

      // Create approval request for tools that need it
      if (detected.approvalRequired) {
        try {
          const approval = await createApprovalRequest(detected, inputMap, card, ctx);
          approvalRequests.push({
            approvalId: approval.approvalId,
            toolId: approval.toolId,
            toolName: approval.toolName,
            toolIcon: approval.toolIcon,
            category: approval.category,
            input: approval.input,
            decisionCard: approval.decisionCard,
            missingParams: detected.missingParams,
            createdAt: approval.createdAt,
          });
        } catch (e) {
          console.warn('[Oracle CFO] failed to create approval request:', e);
        }
      }

      // Write an "analyze" audit entry for each detected intent
      await writeCfoAudit({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        userEmail: ctx.userEmail,
        toolId: detected.toolId,
        toolName: detected.toolName,
        category: detected.category,
        action: 'analyze',
        status: 'pending',
        input: inputMap,
        recordsAffected: [],
        decisionCard: card,
        aiProvider: 'oracle-cfo-router',
        executionMs: Date.now() - startedAt,
      }).catch(() => {});
    }

    return NextResponse.json({
      hasActionableIntent: intentResult.hasActionableIntent,
      summary: intentResult.summary,
      detected: intentResult.detected,
      decisionCards,
      approvalRequests,
      liveData: {
        clientCount: liveData.clients.length,
        invoiceCount: liveData.recentInvoices.length,
        overdueCount: liveData.overdueInvoices.length,
        pendingReturnsCount: liveData.pendingReturns.length,
        hasGstProfile: liveData.gstProfile !== null,
        topClients: liveData.clients.slice(0, 5).map((c) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone })),
        topOverdue: liveData.overdueInvoices.slice(0, 5),
      },
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Oracle CFO analysis failed. Please try rephrasing your request.',
        detail: message,
        hasActionableIntent: false,
        detected: [],
        decisionCards: [],
        approvalRequests: [],
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}
