// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/gst-reconciliation/[id]/resolve
// ═══════════════════════════════════════════════════════════════════════════════
// Mark a reconciliation match as resolved (or reopen it).
// Body: { matchId, resolved: true|false, note? }
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { id: runId } = await params;
    const body = await request.json();
    const { matchId, resolved, note } = body;

    if (!matchId || typeof resolved !== 'boolean') {
      return NextResponse.json({ error: 'matchId and resolved are required', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    const run = await db.gSTReconciliationRun.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const memberResult = await requireOrgMembership(uid, run.organizationId);
    if (memberResult instanceof NextResponse) return memberResult;

    // SECURITY: scope the match update by BOTH matchId AND runId. Without
    // runId scoping, an authenticated user in any org could resolve a
    // mismatch in another org by knowing the cuid. Mirrors the bulk route.
    const updated = await db.gSTReconciliationMatch.update({
      where: { id: matchId, runId },
      data: {
        resolved,
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? uid : null,
        resolutionNote: note || null,
      },
    });

    // ── Unified SaaS: invalidate the canonical Business Snapshot cache ──
    // Resolution changes ITC-at-risk + reconciliation aggregates that the
    // snapshot exposes to dashboard/Oracle/reports. Phase 1 wired this for
    // the run route; the resolve/bulk/auto-fix routes must also invalidate.
    const { invalidateBusinessSnapshotCache } = await import('@/lib/business/snapshot');
    invalidateBusinessSnapshotCache(run.organizationId);

    return NextResponse.json({ ok: true, match: updated });
  } catch (error) {
    return friendlyApiError(error, 'Could not update reconciliation status.');
  }
}
