// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/gst/sync-jobs?organizationId=...&limit=20
// ═══════════════════════════════════════════════════════════════════════════════
// Returns the org's recent GSTR-2B sync jobs for the Sync Center history view.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership, friendlyApiError } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId is required.', code: 'MISSING_PARAMS' },
        { status: 400 },
      );
    }
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);

    const member = await requireOrgMembership(uid, organizationId);
    if (member instanceof NextResponse) return member;

    const jobs = await db.gSTSyncJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        gstin: true,
        period: true,
        providerKey: true,
        mode: true,
        status: true,
        trigger: true,
        recordsFetched: true,
        recordsImported: true,
        recordsUpdated: true,
        recordsSkipped: true,
        recordsFailed: true,
        recordsChanged: true,
        recordsRemoved: true,
        durationMs: true,
        errorMessage: true,
        retryOf: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      jobs: jobs.map((j) => ({
        ...j,
        startedAt: j.startedAt?.toISOString() ?? null,
        completedAt: j.completedAt?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return friendlyApiError(error, 'Unable to load sync history.');
  }
}
