// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO ERP & Accounting Integrations™ — Sync API
//
// POST /api/erp/sync
//   Body: { organizationId, connectionId, provider, jobType? }
//   Returns: { ok: true, jobId, outcome, error }
//
// Runs a full manual sync — calls the provider for all 8 entity types,
// persists the records to Firestore, and updates the connection's lastSync +
// lastSyncSummary. The client's real-time subscriptions surface the new data
// instantly.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runManualSync } from '@/lib/erp-provider/server/scheduler';
import { startBackgroundSync } from '@/lib/erp-provider/server/scheduler';
import { ERPError, friendlyERPError } from '@/lib/erp-provider/errors';
import type { ERPProviderName, ERPSyncJobType } from '@/lib/erp-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PROVIDERS: ERPProviderName[] = ['tally', 'zoho_books', 'busy', 'quickbooks'];

export async function POST(req: NextRequest) {
  try {
    // Ensure the background scheduler is running (idempotent).
    startBackgroundSync();

    const body = await req.json();
    const { organizationId, connectionId, provider, jobType } = body as {
      organizationId?: string;
      connectionId?: string;
      provider?: ERPProviderName;
      jobType?: ERPSyncJobType;
    };

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (!connectionId) {
      return NextResponse.json({ ok: false, error: 'connectionId is required' }, { status: 400 });
    }
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { ok: false, error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
        { status: 400 },
      );
    }

    const result = await runManualSync(
      organizationId,
      connectionId,
      provider,
      jobType ?? 'full',
    );

    return NextResponse.json({
      ok: result.outcome === 'completed',
      jobId: result.jobId,
      outcome: result.outcome,
      error: result.error,
    });
  } catch (err) {
    const statusCode = err instanceof ERPError ? err.statusCode : 500;
    const code = err instanceof ERPError ? err.code : 'UNKNOWN';
    console.error('[api/erp/sync] error:', code, friendlyERPError(err));
    return NextResponse.json(
      { ok: false, error: friendlyERPError(err), code },
      { status: statusCode },
    );
  }
}
