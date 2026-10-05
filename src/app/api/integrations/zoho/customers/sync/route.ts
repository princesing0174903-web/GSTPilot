// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/customers/sync
//
// Triggers a REAL customer sync from Zoho Books into the ZohoCustomer table.
//
// Flow:
//   1. Resolve (orgId, userId) from x-gstpilot-orgid / x-gstpilot-actor headers.
//   2. Verify Zoho Books is connected (getConnectionStatus).
//   3. Resolve a valid (auto-refreshed) access token (getValidAccessToken).
//   4. Call syncZohoCustomersIntoDb():
//        - GET /books/v3/contacts?contact_type=customer (paginated)
//        - upsert each into ZohoCustomer by (orgId, zohoOrgId, zohoContactId)
//        - persist a ZohoCustomerSyncRun row with count + duration
//   5. Return the sync result.
//
// Response (success):
//   {
//     ok: true,
//     status: 'completed' | 'partial',
//     totalFetched: number,
//     imported: number,
//     updated: number,
//     failed: number,
//     durationMs: number,
//     lastSyncedAt: string,    // ISO timestamp
//     syncRunId: string,
//     error: string | null
//   }
//
// Response (failure):
//   { ok: false, status: 'failed', error: string, ... }
//
// Auth:
//   - x-gstpilot-orgid header (required)
//   - x-gstpilot-actor header (required) — JSON: { uid, email, name, role }
//   - Zoho Books must be connected.
//
// HTTP error codes handled gracefully inside the sync (401/403/404/429/5xx) —
// the route returns 200 with the structured error so the UI can show the
// actionable message. Only auth/context failures return non-200.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getConnectionStatus,
  resolveOrgFromHeaders,
  loadTokens,
  getValidAccessToken,
} from '@/lib/integrations/zoho-books';
import { syncZohoCustomersIntoDb } from '@/lib/integrations/zoho-books/customers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Customer sync can take a while for large orgs — give it up to 5 minutes.
export const maxDuration = 300;

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
        {
          ok: false,
          status: 'failed',
          error: 'Organization + user context required.',
          totalFetched: 0,
          imported: 0,
          updated: 0,
          failed: 0,
          durationMs: 0,
          lastSyncedAt: null,
          syncRunId: null,
        },
        { status: 400 },
      );
    }

    // Verify Zoho Books is connected.
    const status = await getConnectionStatus(orgId, userId);
    if (!status.connected) {
      return NextResponse.json(
        {
          ok: false,
          status: 'failed',
          error: 'Zoho Books is not connected. Connect your account first.',
          needsReconnect: true,
          totalFetched: 0,
          imported: 0,
          updated: 0,
          failed: 0,
          durationMs: 0,
          lastSyncedAt: null,
          syncRunId: null,
        },
        { status: 401 },
      );
    }
    if (!status.zohoOrgId) {
      return NextResponse.json(
        {
          ok: false,
          status: 'failed',
          error: 'Zoho Books organization is not mapped. Reconnect to resolve.',
          totalFetched: 0,
          imported: 0,
          updated: 0,
          failed: 0,
          durationMs: 0,
          lastSyncedAt: null,
          syncRunId: null,
        },
        { status: 400 },
      );
    }

    // Resolve a valid (auto-refreshed) access token.
    const { accessToken, error: tokenErr } = await getValidAccessToken(orgId, userId);
    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          status: 'failed',
          error: tokenErr ?? 'No access token. Reconnect Zoho Books.',
          needsReconnect: true,
          totalFetched: 0,
          imported: 0,
          updated: 0,
          failed: 0,
          durationMs: 0,
          lastSyncedAt: null,
          syncRunId: null,
        },
        { status: 401 },
      );
    }

    // Look up the stored zohoOrgId (defensive — getConnectionStatus returned it
    // but we re-read to be safe in case of race with refresh).
    const { stored } = await loadTokens(orgId, userId);
    const zohoOrgId = stored?.zohoOrgId ?? status.zohoOrgId;

    // Optional body: { trigger?: 'manual' | 'auto' } — defaults to 'manual'.
    let trigger: 'manual' | 'auto' = 'manual';
    try {
      const body = (await req.json().catch(() => ({}))) as { trigger?: 'manual' | 'auto' };
      if (body.trigger === 'auto' || body.trigger === 'manual') trigger = body.trigger;
    } catch {
      /* body optional */
    }

    // Run the sync (real Zoho API + DB upsert + sync-run row).
    const result = await syncZohoCustomersIntoDb({
      organizationId: orgId,
      userId,
      userEmail,
      zohoOrgId,
      accessToken,
      trigger,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    console.error('[/api/integrations/zoho/customers/sync] error:', err);
    return NextResponse.json(
      {
        ok: false,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Customer sync failed.',
        totalFetched: 0,
        imported: 0,
        updated: 0,
        failed: 0,
        durationMs: 0,
        lastSyncedAt: null,
        syncRunId: null,
      },
      { status: 500 },
    );
  }
}
