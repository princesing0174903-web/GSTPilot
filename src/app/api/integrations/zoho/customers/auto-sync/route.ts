// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/customers/auto-sync
//
// Toggles the auto-sync flag for the current (org, user) pair. When enabled,
// a periodic background job will call POST /api/integrations/zoho/customers/sync
// with trigger=auto at the configured interval (default 60 minutes).
//
// Body:
//   { enabled: boolean, intervalMinutes?: number }
//
// Response:
//   { ok: boolean, autoSync: { enabled: boolean, intervalMinutes: number }, error: string | null }
//
// Auth:
//   - x-gstpilot-orgid header (required)
//   - x-gstpilot-actor header (required)
//   - Zoho Books must be connected (we don't persist a toggle for a
//     disconnected account — it would have no effect).
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getConnectionStatus,
  resolveOrgFromHeaders,
} from '@/lib/integrations/zoho-books';
import { setAutoSyncFlag } from '@/lib/integrations/zoho-books/customers';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
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

    const status = await getConnectionStatus(orgId, userId);
    if (!status.connected) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Zoho Books is not connected. Connect your account before enabling auto-sync.',
          needsReconnect: true,
        },
        { status: 401 },
      );
    }

    let enabled: boolean;
    let intervalMinutes: number | undefined;
    try {
      const body = (await req.json()) as { enabled?: boolean; intervalMinutes?: number };
      if (typeof body.enabled !== 'boolean') {
        return NextResponse.json(
          { ok: false, error: 'enabled (boolean) is required in the body.' },
          { status: 400 },
        );
      }
      enabled = body.enabled;
      if (typeof body.intervalMinutes === 'number') {
        if (body.intervalMinutes < 5 || body.intervalMinutes > 1440) {
          return NextResponse.json(
            { ok: false, error: 'intervalMinutes must be between 5 and 1440 (24h).' },
            { status: 400 },
          );
        }
        intervalMinutes = body.intervalMinutes;
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body. Expected { enabled: boolean, intervalMinutes?: number }.' },
        { status: 400 },
      );
    }

    const result = await setAutoSyncFlag({
      organizationId: orgId,
      userId,
      enabled,
      intervalMinutes,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, autoSync: { enabled: !enabled, intervalMinutes: intervalMinutes ?? 60 } },
        { status: 500 },
      );
    }

    // Best-effort audit.
    try {
      await safeAudit({
        userId,
        action: enabled ? 'ZOHO_CUSTOMER_AUTO_SYNC_ENABLED' : 'ZOHO_CUSTOMER_AUTO_SYNC_DISABLED',
        entity: 'ZohoBooksToken',
        details: `Auto-sync ${enabled ? 'enabled' : 'disabled'}${intervalMinutes ? ` (interval=${intervalMinutes}min)` : ''}`,
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json({
      ok: true,
      autoSync: {
        enabled,
        intervalMinutes: intervalMinutes ?? 60,
      },
      error: null,
    });
  } catch (err) {
    console.error('[/api/integrations/zoho/customers/auto-sync] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to toggle auto-sync.' },
      { status: 500 },
    );
  }
}
