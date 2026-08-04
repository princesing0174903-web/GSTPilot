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

    const updated = await db.gSTReconciliationMatch.update({
      where: { id: matchId },
      data: {
        resolved,
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? uid : null,
        resolutionNote: note || null,
      },
    });

    return NextResponse.json({ ok: true, match: updated });
  } catch (error) {
    return friendlyApiError(error, 'Could not update reconciliation status.');
  }
}
