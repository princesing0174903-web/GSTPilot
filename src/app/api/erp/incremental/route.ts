// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot ERP & Accounting Integrations™ — Incremental Sync API
//
// POST /api/erp/incremental
//   Body: { organizationId, connectionId, provider }
//   Returns: { ok: true, jobId, outcome, error }
//
// Runs an incremental sync — only fetches records modified since the
// connection's lastSync. Used by the automatic scheduler to keep data fresh
// without re-fetching the full history.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runIncrementalSync } from '@/lib/erp-provider/server/scheduler';
import { ERPError, friendlyERPError } from '@/lib/erp-provider/errors';
import type { ERPProviderName } from '@/lib/erp-provider/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_PROVIDERS: ERPProviderName[] = ['tally', 'zoho_books', 'busy', 'quickbooks'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, connectionId, provider } = body as {
      organizationId?: string;
      connectionId?: string;
      provider?: ERPProviderName;
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

    const result = await runIncrementalSync(organizationId, connectionId, provider);

    return NextResponse.json({
      ok: result.outcome === 'completed',
      jobId: result.jobId,
      outcome: result.outcome,
      error: result.error,
    });
  } catch (err) {
    const statusCode = err instanceof ERPError ? err.statusCode : 500;
    const code = err instanceof ERPError ? err.code : 'UNKNOWN';
    console.error('[api/erp/incremental] error:', code, friendlyERPError(err));
    return NextResponse.json(
      { ok: false, error: friendlyERPError(err), code },
      { status: statusCode },
    );
  }
}
