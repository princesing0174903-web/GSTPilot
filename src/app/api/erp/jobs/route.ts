// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Sync Jobs List API
//
// GET /api/erp/jobs?organizationId=xxx&limit=20
//   Returns: { ok: true, jobs: ERPSyncJob[] }
//
// One-shot read of recent ERP sync jobs for an org. The client hook uses
// real-time subscriptions instead, but this route is useful for diagnostics.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { getDocs, collection, query, where, orderBy, limit as limitFn } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ERP_COLLECTIONS, toSyncJob } from '@/lib/erp-provider/service';
import { ERPError, friendlyERPError } from '@/lib/erp-provider/errors';
import type { ERPSyncJob } from '@/lib/erp-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const organizationId = req.nextUrl.searchParams.get('organizationId');
    const limitCount = Number(req.nextUrl.searchParams.get('limit') ?? '20');
    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: 'organizationId query param is required.' },
        { status: 400 },
      );
    }

    const q = query(
      collection(db, ERP_COLLECTIONS.SYNC_JOBS),
      where('organizationId', '==', organizationId),
      orderBy('createdAt', 'desc'),
      limitFn(limitCount),
    );
    const snap = await getDocs(q).catch(() => ({ docs: [] as Array<{ id: string; data: () => Record<string, unknown> }> }));
    const jobs: ERPSyncJob[] = snap.docs.map((d) => toSyncJob(d.id, d.data() as Record<string, unknown>));

    return NextResponse.json({ ok: true, jobs });
  } catch (err) {
    const statusCode = err instanceof ERPError ? err.statusCode : 500;
    const code = err instanceof ERPError ? err.code : 'UNKNOWN';
    console.error('[api/erp/jobs] error:', code, friendlyERPError(err));
    return NextResponse.json(
      { ok: false, error: friendlyERPError(err), code },
      { status: statusCode },
    );
  }
}
