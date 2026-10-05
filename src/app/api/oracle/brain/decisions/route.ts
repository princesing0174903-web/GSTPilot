// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Brain — Decisions API
// GET  /api/oracle/brain/decisions?firmId=...&status=...&limit=...
// POST /api/oracle/brain/decisions  (log a new decision)
// PATCH /api/oracle/brain/decisions?id=...  (accept / reject / implement)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import {
  logDecision,
  updateDecision,
  getDecision,
  listDecisions,
  getOpenDecisions,
  markAccepted,
  markRejected,
  markImplemented,
  getDecisionStats,
} from '@/lib/oracle/brain/decision-log';
import type { DecisionStatus, DecisionOutcome } from '@/lib/oracle/brain/types';

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
    const limit = parseInt(url.searchParams.get('limit') || '30', 10);
    const status = url.searchParams.get('status') as DecisionStatus | null;
    const priority = url.searchParams.get('priority') || undefined;

    let result: unknown;
    if (action === 'stats') {
      result = await getDecisionStats(firmId);
    } else if (action === 'open') {
      result = await getOpenDecisions(firmId, limit);
    } else if (action === 'get' && url.searchParams.get('id')) {
      result = await getDecision(url.searchParams.get('id')!);
    } else {
      result = await listDecisions({
        firmId,
        status: status ?? undefined,
        priority,
        limit,
      });
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
    const decision = await logDecision({
      firmId: (body.firmId as string) || 'preview-org',
      userId: body.userId as string | undefined,
      title: body.title as string,
      recommendation: (body.recommendation as string) || '',
      reason: (body.reason as string) || '',
      evidence: body.evidence as string[] | undefined,
      expectedOutcome: body.expectedOutcome as string | undefined,
      confidence: body.confidence as number | undefined,
      priority: body.priority as 'P0' | 'P1' | 'P2' | 'P3' | undefined,
      sourceMemoryId: body.sourceMemoryId as string | undefined,
      metadata: body.metadata as Record<string, unknown> | undefined,
    });
    return NextResponse.json({ ok: true, data: decision });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  // ─── AUTH GUARD (ORACLE-AUTH-GUARDS) ──
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;
  const { uid } = authResult;
  const url = new URL(req.url);
  const orgId0 = url.searchParams.get('firmId') || url.searchParams.get('orgId') || '';
  if (orgId0) {
    const orgResult = await requireOrgMembership(uid, orgId0);
    if (orgResult instanceof NextResponse) return orgResult;
  }

  try {
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'id query param required' },
        { status: 400 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action as string | undefined;

    if (action === 'accept') {
      return NextResponse.json({
        ok: true,
        data: await markAccepted(id, body.outcomeNote as string | undefined),
      });
    }
    if (action === 'reject') {
      return NextResponse.json({
        ok: true,
        data: await markRejected(id, body.outcomeNote as string | undefined),
      });
    }
    if (action === 'implement') {
      return NextResponse.json({
        ok: true,
        data: await markImplemented(
          id,
          (body.outcome as DecisionOutcome) || 'pending',
          body.outcomeNote as string | undefined,
        ),
      });
    }

    const updated = await updateDecision(id, {
      status: body.status as DecisionStatus | undefined,
      outcome: body.outcome as DecisionOutcome | undefined,
      outcomeNote: body.outcomeNote as string | undefined,
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
