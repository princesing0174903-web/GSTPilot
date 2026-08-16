// POST /api/oracle/analyze — Deep analysis of a business topic
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { reason } from '@/lib/oracle-core/reasoning';
import { gatherBusinessContext, formatContextForPrompt } from '@/lib/oracle-core/context';
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

  const topic: string = body.topic || body.question || '';
  if (!topic) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  try {
    // 1. Gather fresh context (force refresh for deep analysis)
    const ctx = await gatherBusinessContext();

    // 2. Run deep reasoning
    const firmId0 = body.firmId || body.orgId || body.organizationId || '';
    const orgResult = await requireOrgMembership(uid, firmId0);
    if (orgResult instanceof NextResponse) return orgResult;

    const reasoning = await reason({
      firmId: firmId0 || 'gstpilot-default-firm',
      userId: body.userId ?? null,
      request: topic,
      requestType: 'analyze',
      executives: body.executives,
      callLLM: body.callLLM !== false,
      preferredTier: body.preferredTier || 'deep',
    });

    await auditLog({
      userId: body.userId,
      action: 'analyze',
      endpoint: '/api/oracle/analyze',
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestBody: { topic: topic.slice(0, 500) },
      rbacRole: body.role || 'user',
    }).catch(() => {});

    return NextResponse.json({
      analysis: {
        topic,
        reasoning,
        contextSnapshot: {
          estimatedTokens: ctx.estimatedTokens,
          finance: ctx.finance,
          twin: ctx.twin,
          graph: ctx.graph,
          connectedSystems: ctx.connectedSystems,
        },
        formattedContext: formatContextForPrompt(ctx),
        createdAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
