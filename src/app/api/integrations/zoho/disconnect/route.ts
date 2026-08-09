// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/integrations/zoho/disconnect
//
// Disconnects Zoho Books for the current (org, user) pair:
//   1. Best-effort revokes the access token at Zoho (POST /token/revoke)
//   2. Marks the ZohoBooksToken row as revoked + clears encrypted tokens
//   3. Writes a safeAudit entry (ZOHO_BOOKS_DISCONNECT)
//
// Idempotent — calling disconnect when already disconnected returns ok:true.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import {
  disconnectZoho,
  resolveOrgUserFromHeaders,
  loadTokens,
} from '@/lib/integrations/zoho-books';
import { safeAudit } from '@/lib/audit/safe-write';
import { rateLimit, rateLimitedResponse } from '@/lib/rate-limit';

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

    // Rate limit: 5 disconnects per minute per user — destructive, low limit.
    const rl = rateLimit(req, { windowMs: 60_000, max: 5 }, 'zoho-disconnect', userId);
    if (rl.denied) {
      return rateLimitedResponse(rl.retryAfterSec, 'Too many disconnect requests. Please wait before retrying.');
    }

    // Capture the stored token id for audit before disconnect clears it.
    const { stored } = await loadTokens(orgId, userId);
    const tokenId = stored?.id ?? null;
    const orgName = stored?.zohoOrgName ?? null;

    const { error } = await disconnectZoho(orgId, userId);
    if (error) {
      return NextResponse.json({ ok: false, error }, { status: 500 });
    }

    // Production-grade audit logging (best-effort — never throws).
    try {
      await safeAudit({
        userId,
        action: 'ZOHO_BOOKS_DISCONNECT',
        entity: 'ZohoBooksToken',
        entityId: tokenId,
        oldValue: orgName ? JSON.stringify({ zohoOrgName: orgName }) : null,
        details: `Disconnected Zoho Books for org ${orgId}`,
      });
    } catch (auditErr) {
      console.warn('[/api/integrations/zoho/disconnect] audit log failed:', auditErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/integrations/zoho/disconnect] error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Disconnect failed.' },
      { status: 500 },
    );
  }
}
