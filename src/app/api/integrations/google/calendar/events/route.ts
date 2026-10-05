// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/integrations/google/calendar/events
// ═══════════════════════════════════════════════════════════════════════════════
// Lists upcoming events from the user's primary Google Calendar.
//
// Query params:
//   ?max=N    → max results (default 10, capped at 50)
//
// Calls `https://www.googleapis.com/calendar/v3/calendars/primary/events` with
// `timeMin=now` + `singleEvents=true` + `orderBy=startTime` so the response is
// the user's next N upcoming events in chronological order.
//
// The Google access token never leaves the server — only the proxied event
// list is returned.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { requireAuth, requireOrgMembership } from "@/lib/auth/session";
import {
  getValidAccessToken,
  
} from '@/lib/integrations/google/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function calError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function GET(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const orgId = req.headers.get('x-gstpilot-orgid');
  const userId = authResult.uid;
  const memberResult = await requireOrgMembership(userId, orgId);
  if (memberResult instanceof NextResponse) return memberResult;
  if (!orgId) {
    return calError(400, 'NO_ORG_CONTEXT', 'Missing workspace context.');
  }

  const url = new URL(req.url);
  const maxRaw = Number.parseInt(url.searchParams.get('max') ?? '10', 10);
  const max = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 50) : 10;

  const tokenResult = await getValidAccessToken(orgId, userId);
  if (!tokenResult.accessToken) {
    if (tokenResult.permanent) {
      return calError(401, 'AUTH_REVOKED', 'Google access was revoked. Please reconnect.');
    }
    return calError(
      503,
      'AUTH_STALE',
      'Temporarily unable to reach Google. Please retry in a moment.'
    );
  }

  try {
    const params = new URLSearchParams({
      maxResults: String(max),
      timeMin: new Date().toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      fields:
        'items(id,summary,description,location,start,end,attendees,htmlLink,status,creator),nextPageToken,timeZone',
    });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
        cache: 'no-store',
      }
    );

    const data = (await res.json().catch(() => ({}))) as {
      items?: unknown[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return calError(502, 'CALENDAR_API_ERROR', data.error?.message ?? 'Calendar API error.');
    }

    return NextResponse.json({
      ok: true,
      data: { events: data.items ?? [], count: (data.items ?? []).length },
    });
  } catch (e) {
    console.error('[google/calendar/events] error:', e);
    return calError(500, 'INTERNAL_ERROR', 'Unexpected error.');
  }
}
