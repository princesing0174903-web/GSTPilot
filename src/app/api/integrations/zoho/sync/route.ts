// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/sync
// GET  /api/integrations/zoho/sync
// ═══════════════════════════════════════════════════════════════════════════════
//
// Triggers the full Zoho Books data synchronization (13 modules) or returns the
// current sync status.
//
// POST body:
//   { mode: "full" | "incremental" }   (default: "full")
//
// Headers:
//   x-gstpilot-orgid: <organizationId>   (required)
//   x-gstpilot-actor: <userId>           (optional — system sync if omitted)
//
// POST response: SyncEngineResult JSON with per-module counts + status.
// GET  response: current sync status (for UI polling of live progress).
//
// The sync runs synchronously in this request (it may take 10-60s depending on
// data volume). The UI polls GET /sync/status to show "Fetching Customers…"
// "Fetching Invoices…" etc. in real time via the ZohoSyncLog.currentEntity field.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { runZohoFullSync, getSyncStatus, type SyncMode } from '@/lib/integrations/zoho-books/sync-engine';
import { resolveOrgUserFromHeaders } from '@/lib/integrations/zoho-books/oauth';
import { emitTimelineEvent } from '@/lib/timeline/emit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — sync can take a while for large orgs

// ─── POST: trigger a sync ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(request);

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'Organization ID is required (x-gstpilot-orgid header or ?organizationId=).' },
        { status: 400 },
      );
    }

    // Parse mode from body (default: full)
    let mode: SyncMode = 'full';
    try {
      const body = await request.json();
      if (body?.mode === 'incremental' || body?.mode === 'full') {
        mode = body.mode;
      }
    } catch {
      // No body or invalid JSON — default to full sync
    }

    const result = await runZohoFullSync({
      organizationId: orgId,
      userId,
      mode,
    });

    // ── Business Timeline — emit zoho.sync.completed (fire-and-forget) ──
    // Only emit when the sync actually imported or updated at least one record
    // (skips the "Zoho not connected" / "no data" cases — those return ok:false
    // with totals of 0 and would only spam the timeline).
    if (result.ok && (result.totalImported > 0 || result.totalUpdated > 0)) {
      const recordsSynced = result.totalImported + result.totalUpdated;
      const entityTypes = result.modules
        .filter((m) => m.status !== 'skipped' && (m.imported > 0 || m.updated > 0))
        .map((m) => m.module);
      await emitTimelineEvent({
        organizationId: orgId,
        type: 'zoho.sync.completed',
        title: `Zoho Books sync complete — ${recordsSynced} record${recordsSynced === 1 ? '' : 's'}`,
        description:
          result.status === 'partial'
            ? `Partial sync: ${result.totalImported} imported, ${result.totalUpdated} updated, ${result.totalFailed} failed across ${entityTypes.length} module${entityTypes.length === 1 ? '' : 's'} in ${(result.durationMs / 1000).toFixed(1)}s.`
            : `Synced ${result.totalImported} imported, ${result.totalUpdated} updated across ${entityTypes.length} module${entityTypes.length === 1 ? '' : 's'} in ${(result.durationMs / 1000).toFixed(1)}s.`,
        actor: userId ? { userId } : undefined,
        metadata: {
          recordsSynced,
          imported: result.totalImported,
          updated: result.totalUpdated,
          failed: result.totalFailed,
          entityTypes,
          mode: result.mode,
          durationMs: result.durationMs,
          status: result.status,
          syncLogId: result.syncLogId,
          zohoOrgId: result.zohoOrgId,
        },
        severity: result.status === 'partial' ? 'warning' : 'success',
      });
    }

    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
    });
  } catch (error) {
    console.error('POST /api/integrations/zoho/sync error:', error);
    return NextResponse.json(
      {
        ok: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Sync failed unexpectedly.',
      },
      { status: 500 },
    );
  }
}

// ─── GET: current sync status (for UI polling) ────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { orgId } = resolveOrgUserFromHeaders(request);
    // Fallback: accept ?organizationId= query param (for non-hook callers)
    const queryOrgId = request.nextUrl.searchParams.get('organizationId');

    const finalOrgId = orgId || queryOrgId;

    if (!finalOrgId) {
      return NextResponse.json(
        { status: 'idle', error: 'Organization ID is required.' },
        { status: 400 },
      );
    }

    const status = await getSyncStatus(finalOrgId);
    return NextResponse.json(status);
  } catch (error) {
    console.error('GET /api/integrations/zoho/sync error:', error);
    return NextResponse.json(
      { status: 'idle', error: error instanceof Error ? error.message : 'Failed to fetch sync status.' },
      { status: 500 },
    );
  }
}
