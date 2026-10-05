// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Zoho Books Route-Auth Helper
//
// Shared helper for the Zoho Books service routes: resolves the org+user from
// request headers, fetches a valid (auto-refreshed) access token, and returns
// a 401 NextResponse if the user isn't connected.
//
// Mirrors `src/lib/google-workspace/route-auth.ts` exactly so service routes
// have the same shape:
//
//   export async function GET(req: Request) {
//     const { accessToken, zohoOrgId, response } = await resolveZohoAuth(req);
//     if (response || !accessToken) return response;
//     // … call zohoGet('/invoices', accessToken, { organizationId: zohoOrgId })
//   }
//
// SERVER-ONLY.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { getValidAccessToken, resolveOrgUserFromHeaders, loadTokens } from './oauth';

export interface ResolvedZohoAuth {
  accessToken: string | null;
  orgId: string;
  userId: string;
  /** Zoho Books numeric organization ID (multi-tenant) — null if not yet mapped. */
  zohoOrgId: string | null;
  /** NextResponse to return immediately if the user isn't connected. Null on success. */
  response: NextResponse | null;
}

/**
 * Resolve the Zoho Books auth context for an incoming request.
 *
 * Returns either:
 *   - `{ response: NextResponse, accessToken: null }` — caller should `return response` immediately, OR
 *   - `{ response: null, accessToken: <valid>, orgId, userId, zohoOrgId }` — caller proceeds.
 */
export async function resolveZohoAuth(req: Request): Promise<ResolvedZohoAuth> {
  const { orgId, userId } = resolveOrgUserFromHeaders(req);
  const { accessToken, error } = await getValidAccessToken(orgId, userId);
  if (!accessToken) {
    return {
      accessToken: null,
      orgId,
      userId,
      zohoOrgId: null,
      response: NextResponse.json(
        { ok: false, error: error ?? 'Zoho Books not connected.', needsReconnect: true },
        { status: 401 },
      ),
    };
  }

  // Best-effort: pull the stored zohoOrgId so service routes can pass it to
  // zohoGet/zohoPost as the `organization_id` query param.
  let zohoOrgId: string | null = null;
  try {
    const { stored } = await loadTokens(orgId, userId);
    zohoOrgId = stored?.zohoOrgId ?? null;
  } catch {
    /* non-fatal */
  }

  return { accessToken, orgId, userId, zohoOrgId, response: null };
}

