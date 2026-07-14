// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/sync
//
// Triggers a Zoho Books data sync for the current (org, user) pair.
//
// Body (optional JSON):
//   { mode?: 'full' | 'incremental', resume?: boolean }
//   - mode defaults to 'incremental' (only fetch records modified since the
//     last sync's watermark). Pass 'full' to re-import everything.
//   - resume defaults to true. If a stale 'running' ZohoSyncLog exists (e.g.,
//     a previous sync crashed), the new run continues from where it left off
//     instead of starting over. Pass false to force a fresh start.
//
// Auth:
//   - x-gstpilot-orgid header (required)
//   - x-gstpilot-actor header (required) — JSON: { uid, email, name, role }
//   - Zoho Books must be connected (valid access token is resolved via
//     getValidAccessToken, which auto-refreshes if expired)
//
// Response:
//   {
//     ok: true,
//     syncLogId: string,
//     mode: 'full' | 'incremental',
//     status: 'completed' | 'partial' | 'failed',
//     startedAt: string,            // ISO timestamp
//     stats: {                      // per-entity stats
//       customer:    { imported, updated, failed, skipped, pages, lastError },
//       vendor:      { ... },
//       tax:         { ... },
//       bank_account: { ... },
//       invoice:     { ... },
//       bill:        { ... },
//       expense:     { ... },
//       bank_transaction: { ... },
//       journal:     { ... }
//     },
//     error: string | null
//   }
//
// The sync runs inline (awaited). For very large Zoho orgs (>10k records per
// entity), consider splitting into a background queue — but for typical SMB
// Zoho Books accounts, inline is fast enough (each page is ~200 records, 50
// pages = 10k records in ~30s).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
  loadTokens,
  getValidAccessToken,
  runSync,
  type SyncMode,
  type TriggerSyncResponse,
} from '@/lib/integrations/zoho-books';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Sync can take a while for large orgs — give it up to 5 minutes.
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { orgId, userId, userEmail } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    // Verify Zoho Books is connected (and resolve zohoOrgId).
    const status = await getConnectionStatus(orgId, userId);
    if (!status.connected) {
      return NextResponse.json(
        { ok: false, error: 'Zoho Books is not connected.', needsReconnect: true },
        { status: 401 },
      );
    }
    if (!status.zohoOrgId) {
      return NextResponse.json(
        { ok: false, error: 'Zoho Books organization is not mapped. Reconnect to resolve.' },
        { status: 400 },
      );
    }

    // Parse body (optional).
    let mode: SyncMode = 'incremental';
    let resume = true;
    try {
      const body = (await req.json().catch(() => ({}))) as { mode?: SyncMode; resume?: boolean };
      if (body.mode === 'full' || body.mode === 'incremental') mode = body.mode;
      if (typeof body.resume === 'boolean') resume = body.resume;
    } catch {
      /* body is optional — defaults are fine */
    }

    // Resolve a valid (auto-refreshed) access token.
    const { accessToken, error: tokenErr } = await getValidAccessToken(orgId, userId);
    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: tokenErr ?? 'No access token.', needsReconnect: true },
        { status: 401 },
      );
    }

    // Look up the stored row for zohoOrgId (defensive — getConnectionStatus
    // already returned it, but we re-read to be safe).
    const { stored } = await loadTokens(orgId, userId);
    const zohoOrgId = stored?.zohoOrgId ?? status.zohoOrgId;

    // Run the sync.
    const result: TriggerSyncResponse = await runSync({
      organizationId: orgId,
      userId,
      userEmail,
      zohoOrgId,
      accessToken,
      mode,
      resume,
      maxRecordsPerEntity: 10000,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error('[/api/integrations/zoho/sync] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Sync failed.' },
      { status: 500 },
    );
  }
}
