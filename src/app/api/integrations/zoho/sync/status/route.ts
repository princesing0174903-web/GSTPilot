// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/sync/status
//
// Returns the current Zoho Books sync status for the (org, user) pair:
//   - Most-recent ZohoSyncLog row (status, mode, startedAt, completedAt,
//     durationMs, error, per-entity stats)
//   - Aggregate "Records Imported" counts from ZohoEntityMap (per entity type
//     + total)
//   - isRunning flag (true if a sync is currently in progress)
//
// Used by the Zoho Books integration page UI to render:
//   - "Last Sync: 2 minutes ago"
//   - "Records Imported: 1,247"
//   - "Sync Status: Completed ✓ / Partial ⚠ / Failed ✗ / Running…"
//   - "Manual Sync" button (disables itself when isRunning=true)
//
// Auth:
//   - x-gstpilot-orgid header (required)
//   - x-gstpilot-actor header (required)
//   - Zoho Books must be connected (else returns connected:false with empty
//     sync data so the UI shows the "Connect Zoho Books" gate)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getConnectionStatus,
  getSyncStatusUnified,
  resolveOrgFromHeaders,
  loadTokens,
} from '@/lib/integrations/zoho-books';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const orgId = req.headers.get('x-gstpilot-orgid');
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    const conn = await getConnectionStatus(orgId, userId);
    if (!conn.connected) {
      // Not connected — return an empty status so the UI shows the gate.
      return NextResponse.json({
        ok: true,
        status: {
          connected: false,
          organizationName: null,
          zohoOrgId: null,
          lastSync: null,
          recordsImported: {},
          totalRecords: 0,
          isRunning: false,
        },
      });
    }

    // zohoOrgId from the stored token row (more reliable than the status
    // payload's zohoOrgId which could be stale).
    const { stored } = await loadTokens(orgId, userId);
    const zohoOrgId = stored?.zohoOrgId ?? conn.zohoOrgId;
    if (!zohoOrgId) {
      return NextResponse.json(
        { ok: false, error: 'Zoho Books organization is not mapped. Reconnect to resolve.' },
        { status: 400 },
      );
    }

    // Use the UNIFIED status reader — reads Phase 5's stats shape + counts
    // real records directly from the Zoho* Prisma tables.
    const syncStatus = await getSyncStatusUnified(orgId, zohoOrgId);

    return NextResponse.json({
      ok: true,
      status: {
        connected: true,
        organizationName: conn.organizationName,
        zohoOrgId,
        lastSync: syncStatus.lastSync,
        recordsImported: syncStatus.recordsImported,
        totalRecords: syncStatus.totalRecords,
        isRunning: syncStatus.isRunning,
      },
    });
  } catch (err) {
    console.error('[/api/integrations/zoho/sync/status] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Sync status check failed.' },
      { status: 500 },
    );
  }
}
