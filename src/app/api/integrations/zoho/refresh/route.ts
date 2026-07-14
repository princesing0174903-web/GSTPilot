// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/refresh
//
// Force-refresh the Zoho Books access token for the current (org, user) pair.
//
// Under normal operation, refresh is implicit — `getValidAccessToken()` checks
// expiry and refreshes automatically before every service call. This explicit
// endpoint exists for:
//   • Manual "Refresh connection" buttons in the UI
//   • Webhook-triggered re-sync flows
//   • Diagnosing token issues (the response surfaces the Zoho error if any)
//
// Also re-fetches the user's Zoho Books organization mapping (in case the
// user changed their default org in Zoho since the last connect).
//
// Returns:
//   { ok: true, refreshed: true, organizationName, zohoOrgId }
//   { ok: false, error: "...", needsReconnect: true }   // refresh failed
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  loadTokens,
  refreshAccessToken,
  refreshOrganizationMapping,
  resolveOrgUserFromHeaders,
  encrypt,
} from '@/lib/integrations/zoho-books';
import { db } from '@/lib/db';
import { safeAudit } from '@/lib/audit/safe-write';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { orgId, userId } = resolveOrgUserFromHeaders(req);
    if (!orgId || !userId) {
      return NextResponse.json(
        { ok: false, error: 'Organization + user context required.' },
        { status: 400 },
      );
    }

    const { tokens, stored } = await loadTokens(orgId, userId);
    if (!tokens || !stored) {
      return NextResponse.json(
        { ok: false, error: 'Zoho Books is not connected.', needsReconnect: true },
        { status: 401 },
      );
    }

    if (!tokens.refreshToken) {
      return NextResponse.json(
        { ok: false, error: 'No refresh token available. Please reconnect Zoho Books.', needsReconnect: true },
        { status: 401 },
      );
    }

    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (refreshed.error || !refreshed.accessToken) {
      // Audit the failure (best-effort).
      try {
        await safeAudit({
          userId,
          action: 'ZOHO_BOOKS_REFRESH_FAILED',
          entity: 'ZohoBooksToken',
          entityId: stored.id,
          details: refreshed.error ?? 'Token refresh failed.',
        });
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { ok: false, error: refreshed.error ?? 'Token refresh failed.', needsReconnect: true },
        { status: 401 },
      );
    }

    const newExpiry = refreshed.expiresIn
      ? new Date(Date.now() + refreshed.expiresIn * 1000)
      : null;

    try {
      await db.zohoBooksToken.update({
        where: { id: stored.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          expiryDate: newExpiry,
          apiDomain: refreshed.apiDomain ?? undefined,
        },
      });
    } catch (err) {
      console.warn('[/api/integrations/zoho/refresh] failed to persist refreshed token:', err);
    }

    // Re-fetch the Zoho Books organization mapping (in case the user changed
    // their default org in Zoho since the last connect).
    const orgMap = await refreshOrganizationMapping(orgId, userId, refreshed.accessToken);

    try {
      await safeAudit({
        userId,
        action: 'ZOHO_BOOKS_REFRESH',
        entity: 'ZohoBooksToken',
        entityId: stored.id,
        details: `Refreshed Zoho Books access token${orgMap.zohoOrgName ? ` (org: ${orgMap.zohoOrgName})` : ''}`,
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({
      ok: true,
      refreshed: true,
      organizationName: orgMap.zohoOrgName,
      zohoOrgId: orgMap.zohoOrgId,
      expiresAt: newExpiry?.toISOString() ?? null,
    });
  } catch (err) {
    console.error('[/api/integrations/zoho/refresh] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Refresh failed.' },
      { status: 500 },
    );
  }
}
