// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/google/drive
// ═══════════════════════════════════════════════════════════════════════════════
// Lists the user's Drive files (only those created or opened by GSTPilot —
// the `drive.file` scope limits visibility to app-created files).
//
// Query params:
//   ?max=N    → page size (default 25, capped at 100)
//
// Calls `https://www.googleapis.com/drive/v3/files` with `fields` selected to
// keep the response payload small. The Google access token never leaves the
// server — only the proxied file list is returned.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getValidAccessToken,
  resolveOrgFromHeaders,
} from '@/lib/integrations/google/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function driveError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgId = resolveOrgFromHeaders(req);
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
  if (!orgId) {
    return driveError(400, 'NO_ORG_CONTEXT', 'Missing workspace context.');
  }

  const url = new URL(req.url);
  const maxRaw = Number.parseInt(url.searchParams.get('max') ?? '25', 10);
  const max = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 100) : 25;

  const tokenResult = await getValidAccessToken(orgId, userId);
  if (!tokenResult.accessToken) {
    if (tokenResult.permanent) {
      return driveError(401, 'AUTH_REVOKED', 'Google access was revoked. Please reconnect.');
    }
    return driveError(
      503,
      'AUTH_STALE',
      'Temporarily unable to reach Google. Please retry in a moment.'
    );
  }

  try {
    const params = new URLSearchParams({
      pageSize: String(max),
      orderBy: 'modifiedByMeTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink),nextPageToken',
      q: "trashed = false",
    });
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
        cache: 'no-store',
      }
    );

    const data = (await res.json().catch(() => ({}))) as {
      files?: unknown[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return driveError(502, 'DRIVE_API_ERROR', data.error?.message ?? 'Drive API error.');
    }

    return NextResponse.json({
      ok: true,
      data: { files: data.files ?? [], count: (data.files ?? []).length },
    });
  } catch (e) {
    console.error('[google/drive] error:', e);
    return driveError(500, 'INTERNAL_ERROR', 'Unexpected error.');
  }
}
