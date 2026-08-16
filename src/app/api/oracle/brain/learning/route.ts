// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Learning API
// GET  /api/oracle/brain/learning?firmId=...
// POST /api/oracle/brain/learning  { firmId, userId, kind, detail }  (record behavior)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  recordLearning,
  listLearnings,
  getLearnedPreferences,
  inferPreferencesFromBehavior,
  getLearningStats,
  type BehaviorEvent,
} from '@/lib/oracle/brain/learning-engine';
import type { LearningSignal } from '@/lib/oracle/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('firmId') || url.searchParams.get('orgId') || '';
  const orgResult = await requireOrgMembership(uid, orgId0);
  if (orgResult instanceof NextResponse) return orgResult;

  try {
    const firmId = url.searchParams.get('firmId') || 'preview-org';
    const action = url.searchParams.get('action') || 'list';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const signal = url.searchParams.get('signal') as LearningSignal | null;

    let result: unknown;
    if (action === 'stats') {
      result = await getLearningStats(firmId);
    } else if (action === 'preferences') {
      result = await getLearnedPreferences(firmId);
    } else {
      result = await listLearnings({ firmId, signal: signal ?? undefined, limit });
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const orgId0 = (body.firmId as string) || (body.orgId as string) || '';
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
    const firmId = (body.firmId as string) || 'preview-org';
    const userId = (body.userId as string) || 'user';

    // Behavior-event mode: map a UI event to a learning signal.
    if (body.kind) {
      const learning = await inferPreferencesFromBehavior(
        firmId,
        userId,
        {
          kind: body.kind as BehaviorEvent,
          detail: body.detail as string | undefined,
        },
      );
      return NextResponse.json({ ok: true, data: learning });
    }

    // Direct record mode.
    const learning = await recordLearning({
      firmId,
      userId,
      signal: body.signal as LearningSignal,
      pattern: body.pattern as string,
      observation: body.observation as string | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ ok: true, data: learning });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
