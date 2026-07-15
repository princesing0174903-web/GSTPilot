// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/sync
//
// Triggers a Zoho Books data sync for the current (org, user) pair.
//
// Phase 5: Fire-and-forget. The sync runs in a DETACHED background promise so
// the HTTP response returns IMMEDIATELY with { status: 'running', syncLogId }.
// The UI polls GET /sync/status every 1.5s for live progress
// (currentEntity, per-entity counts, "Fetching Customers…", etc.).
//
// This is safe because:
//   • The dev server process stays alive (watchdog auto-restarts it).
//   • The sync writes currentEntity to ZohoSyncLog before each entity, so a
//     crash mid-sync leaves a resumable state (lastEntity + lastCursor).
//   • The next sync with resume=true picks up from the last completed entity.
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
// Response (immediate — sync still running in background):
//   {
//     ok: true,
//     syncLogId: string,
//     status: 'running',
//     mode: 'full' | 'incremental',
//     message: 'Sync started in background. Poll GET /sync/status for progress.'
//   }
//
// The final result is available via GET /sync/status (status transitions:
// running → completed | partial | failed).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
  loadTokens,
  getValidAccessToken,
  runSync,
  type SyncMode,
} from '@/lib/integrations/zoho-books';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The HTTP request returns immediately, but keep maxDuration high in case the
// runtime decides to wait for background tasks.
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

    // ── Phase 5: Fire-and-forget ────────────────────────────────────────────
    //
    // Start the sync in a DETACHED background promise. We do NOT await it.
    // The sync writes `currentEntity` to the ZohoSyncLog row as it progresses
    // through each entity, so the UI can poll GET /sync/status for live
    // progress. The response returns immediately with the syncLogId.
    //
    // The promise is caught internally (runSync never throws — it returns
    // { ok: false, error } on failure and writes status='failed' to the log).

    void runSync({
      organizationId: orgId,
      userId,
      userEmail,
      zohoOrgId,
      accessToken,
      mode,
      resume,
      maxRecordsPerEntity: 10000,
    }).catch((syncErr) => {
      // Last-resort error handler — runSync should never throw, but if it
      // does (e.g., OOM, process crash), log it so we can diagnose.
      console.error('[/api/integrations/zoho/sync] background sync crashed:', syncErr);
    });

    return NextResponse.json({
      ok: true,
      status: 'running',
      mode,
      message: 'Sync started in background. Poll GET /sync/status for live progress.',
    });
  } catch (err) {
    console.error('[/api/integrations/zoho/sync] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Sync failed.' },
      { status: 500 },
    );
  }
}
