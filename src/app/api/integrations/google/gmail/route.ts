// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/google/gmail
// ═══════════════════════════════════════════════════════════════════════════════
// Proxies real Gmail API calls for the calling (org, user).
//
// Query params:
//   ?action=profile            → GET gmail.googleapis.com/gmail/v1/users/me/profile
//   ?action=messages&max=N     → list recent messages + fetch each one's
//                                 metadata (snippet, headers, internalDate).
//                                 Default max = 10, capped at 50.
//
// Returns:
//   • 200 { ok: true, data: <gmail-api-shape> }
//   • 401 { ok: false, code: 'NOT_CONNECTED' }   — never connected
//   • 401 { ok: false, code: 'AUTH_REVOKED' }    — refresh token revoked
//   • 503 { ok: false, code: 'AUTH_STALE' }      — temp refresh failure
//   • 502 { ok: false, code: 'GMAIL_API_ERROR' } — Google returned non-2xx
//   • 500 { ok: false, code: 'INTERNAL_ERROR' }
//
// The Google access token NEVER leaves the server — only the proxied API
// response is returned to the client.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getValidAccessToken,
  resolveOrgFromHeaders,
} from '@/lib/integrations/google/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function gmailError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

async function gmailFetch(path: string, accessToken: string) {
  const res = await fetch(`https://gmail.googleapis.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  return res;
}

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgId = resolveOrgFromHeaders(req);
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
  if (!orgId) {
    return gmailError(400, 'NO_ORG_CONTEXT', 'Missing workspace context.');
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? 'profile';
  const maxRaw = Number.parseInt(url.searchParams.get('max') ?? '10', 10);
  const max = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 50) : 10;

  // ── Resolve a valid access token (refresh if needed) ──
  const tokenResult = await getValidAccessToken(orgId, userId);
  if (!tokenResult.accessToken) {
    if (tokenResult.permanent) {
      return gmailError(401, 'AUTH_REVOKED', 'Google access was revoked. Please reconnect.');
    }
    return gmailError(
      503,
      'AUTH_STALE',
      'Temporarily unable to reach Google. Please retry in a moment.'
    );
  }

  const accessToken = tokenResult.accessToken;

  try {
    if (action === 'profile') {
      const res = await gmailFetch('/gmail/v1/users/me/profile', accessToken);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return gmailError(502, 'GMAIL_API_ERROR', data.error?.message ?? 'Gmail API error.');
      }
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'messages') {
      // 1. List recent message IDs.
      const listRes = await gmailFetch(
        `/gmail/v1/users/me/messages?maxResults=${max}`,
        accessToken
      );
      const listData = (await listRes.json().catch(() => ({}))) as {
        messages?: { id: string }[];
        error?: { message?: string };
      };
      if (!listRes.ok) {
        return gmailError(502, 'GMAIL_API_ERROR', listData.error?.message ?? 'Gmail API error.');
      }
      const ids = listData.messages ?? [];

      // 2. Fetch each message's metadata in parallel (Gmail requires a
      //    separate GET per message).
      const messages = await Promise.all(
        ids.slice(0, max).map(async (m) => {
          try {
            const r = await gmailFetch(
              `/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=To&metadataHeaders=Date`,
              accessToken
            );
            if (!r.ok) return null;
            return (await r.json().catch(() => null)) as unknown;
          } catch {
            return null;
          }
        })
      );

      return NextResponse.json({
        ok: true,
        data: {
          messages: messages.filter(Boolean),
          count: messages.filter(Boolean).length,
        },
      });
    }

    return gmailError(400, 'BAD_ACTION', `Unknown action: ${action}`);
  } catch (e) {
    console.error('[google/gmail] error:', e);
    return gmailError(500, 'INTERNAL_ERROR', 'Unexpected error.');
  }
}
