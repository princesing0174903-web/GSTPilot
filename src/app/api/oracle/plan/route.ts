// POST /api/oracle/plan — Oracle creates an executive plan
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { reason } from '@/lib/oracle-core/reasoning';
import { runExecutiveConversation } from '@/lib/oracle-core/conversation';
import { auditLog } from '@/lib/oracle-core/security';

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

  const objective: string = body.objective || body.question || '';
  if (!objective) {
    return NextResponse.json({ error: 'objective is required' }, { status: 400 });
  }

  try {
    // 1. Run the executive conversation to gather perspectives
    const conversation = await runExecutiveConversation(`Plan: ${objective}`, {
      participants: body.participants,
      maxTurns: body.maxTurns || 10,
    });

    // 2. Generate structured reasoning with requestType='plan'
    const firmId0 = body.firmId || body.orgId || body.organizationId || '';
    const orgResult = await requireOrgMembership(uid, firmId0);
    if (orgResult instanceof NextResponse) return orgResult;

    const reasoning = await reason({
      firmId: firmId0 || 'gstpilot-default-firm',
      userId: body.userId ?? null,
      request: objective,
      requestType: 'plan',
      executives: body.participants,
      callLLM: body.callLLM !== false,
      preferredTier: body.preferredTier || 'deep',
    });

    await auditLog({
      userId: body.userId,
      action: 'plan',
      endpoint: '/api/oracle/plan',
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestBody: { objective: objective.slice(0, 500) },
      rbacRole: body.role || 'user',
    }).catch(() => {});

    return NextResponse.json({
      plan: {
        objective,
        conversation,
        reasoning,
        consensus: conversation.consensus,
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
