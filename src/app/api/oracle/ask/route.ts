// POST /api/oracle/ask — Ask Oracle a question. Returns structured reasoning.
import { NextRequest, NextResponse } from 'next/server';
import { reason } from '@/lib/oracle-core/reasoning';
import { explain } from '@/lib/oracle-core/explainable';
import { auditLog, rateLimitCheck } from '@/lib/oracle-core/security';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const question: string = body.question || body.request || '';
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  // Rate limit: 30 asks/minute per user (or IP fallback)
  const identifier = body.userId || request.headers.get('x-forwarded-for') || 'anonymous';
  const rl = rateLimitCheck(`ask:${identifier}`, 30);
  if (!rl.allowed) {
    await auditLog({
      action: 'ask',
      endpoint: '/api/oracle/ask',
      method: 'POST',
      statusCode: 429,
      userId: body.userId,
      rateLimited: true,
      errorMessage: 'Rate limit exceeded',
    }).catch(() => {});
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
      { status: 429 },
    );
  }

  try {
    const reasoning = await reason({
      firmId: body.firmId || 'gstpilot-default-firm',
      userId: body.userId ?? null,
      request: question,
      requestType: 'ask',
      executives: body.executives,
      callLLM: body.callLLM !== false, // default true
      preferredTier: body.preferredTier,
    });

    // Build explanation
    const explanation = await explain(reasoning.id).catch(() => null);

    // Audit log (success)
    await auditLog({
      userId: body.userId,
      action: 'ask',
      endpoint: '/api/oracle/ask',
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestBody: { question: question.slice(0, 500) },
      rbacRole: body.role || 'user',
    }).catch(() => {});

    return NextResponse.json({
      reasoning,
      explanation,
      durationMs: Date.now() - startedAt,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    await auditLog({
      userId: body.userId,
      action: 'ask',
      endpoint: '/api/oracle/ask',
      method: 'POST',
      statusCode: 500,
      durationMs: Date.now() - startedAt,
      errorMessage: message,
    }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
