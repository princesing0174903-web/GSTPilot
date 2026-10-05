// ═══════════════════════════════════════════════════════════════════════════════
// Shared helpers for the Google Workspace service routes.
// Resolves the org+user, fetches a valid access token, and returns a 401/403
// NextResponse if the user isn't connected or lacks permission.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from '@/lib/auth/session';
import { getValidAccessToken } from '@/lib/google-workspace';

export interface ResolvedGoogleAuth {
  accessToken: string | null;
  orgId: string;
  userId: string;
  response: NextResponse | null;
}

/**
 * Resolve a valid Google access token for the request's org+user context.
 * Returns `{ response }` if the caller should bail (401/403), otherwise
 * `{ accessToken, orgId, userId }`.
 */
export async function resolveGoogleAuth(req: Request): Promise<ResolvedGoogleAuth> {
  const orgId = req.headers.get('x-gstpilot-orgid');
  const { accessToken, error } = await getValidAccessToken(orgId, userId);
  if (!accessToken) {
    return {
      accessToken: null,
      orgId,
      userId,
      response: NextResponse.json(
        { ok: false, error: error ?? 'Google Workspace not connected.', needsReconnect: true },
        { status: 401 },
      ),
    };
  }
  return { accessToken, orgId, userId, response: null };
}

