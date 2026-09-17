// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/zoho/customers/sync-status
//
// Returns the customer-sync status for the current (org, user) pair:
//   • The most-recent ZohoCustomerSyncRun row (count, duration, status, error).
//   • The current count of synced customers in the DB.
//   • The auto-sync toggle state (enabled + intervalMinutes).
//   • Whether the connection is healthy (connected + zohoOrgId mapped).
//
// Response:
//   {
//     ok: true,
//     connected: boolean,
//     zohoOrgId: string | null,
//     customerCount: number,
//     lastSync: {
//       id: string,
//       trigger: 'manual' | 'auto',
//       status: 'running' | 'completed' | 'partial' | 'failed',
//       totalFetched: number,
//       imported: number,
//       updated: number,
//       failed: number,
//       durationMs: number,
//       error: string | null,
//       startedAt: string,
//       completedAt: string | null
//     } | null,
//     autoSync: { enabled: boolean, intervalMinutes: number }
//   }
//
// Auth:
//   - x-gstpilot-orgid header (required)
//   - x-gstpilot-actor header (required)
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  getConnectionStatus,
  resolveOrgUserFromHeaders,
  loadTokens,
} from '@/lib/integrations/zoho-books';
import {
  getLatestCustomerSyncRun,
  getAutoSyncFlag,
} from '@/lib/integrations/zoho-books/customers';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    const status = await getConnectionStatus(orgId, userId);
    const { stored } = await loadTokens(orgId, userId);
    const zohoOrgId = stored?.zohoOrgId ?? null;

    let customerCount = 0;
    let lastSync: Awaited<ReturnType<typeof getLatestCustomerSyncRun>> = null;
    let autoSync: { enabled: boolean; intervalMinutes: number } = { enabled: false, intervalMinutes: 60 };

    if (zohoOrgId) {
      const [count, last, auto] = await Promise.all([
        db.zohoCustomer.count({
          where: { organizationId: orgId, zohoOrgId },
        }),
        getLatestCustomerSyncRun({ organizationId: orgId, zohoOrgId }),
        getAutoSyncFlag({ organizationId: orgId, userId }),
      ]);
      customerCount = count;
      lastSync = last;
      if (auto) autoSync = auto;
    }

    return NextResponse.json({
      ok: true,
      connected: status.connected,
      zohoOrgId,
      organizationName: status.organizationName,
      customerCount,
      lastSync,
      autoSync,
    });
  } catch (err) {
    console.error('[/api/integrations/zoho/customers/sync-status] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to read sync status.' },
      { status: 500 },
    );
  }
}
