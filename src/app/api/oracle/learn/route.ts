// POST /api/oracle/learn — Record a learning signal for the Self-Improvement Engine
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { recordLearning } from '@/lib/oracle-core/learning';
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

  const category = body.category;
  const signal = body.signal;
  const lessonLearned = body.lessonLearned;

  if (!category || !signal || !lessonLearned) {
    return NextResponse.json(
      { error: 'category, signal, and lessonLearned are required' },
      { status: 400 },
    );
  }

  try {
    const orgId0 = body.firmId || body.orgId || body.organizationId || '';
    if (orgId0) {
      const orgResult = await requireOrgMembership(uid, orgId0);
      if (orgResult instanceof NextResponse) return orgResult;
    }

    const record = await recordLearning({
      firmId: body.firmId,
      category,
      signal,
      evidence: body.evidence || {},
      lessonLearned,
      weight: body.weight,
    });

    await auditLog({
      userId: body.userId,
      action: 'learn',
      endpoint: '/api/oracle/learn',
      method: 'POST',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      requestBody: { category, signal: signal.slice(0, 200) },
      rbacRole: body.role || 'user',
    }).catch(() => {});

    return NextResponse.json({ learning: record });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
