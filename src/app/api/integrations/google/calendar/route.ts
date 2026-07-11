// GET  /api/integrations/google/calendar/events — list upcoming events
// POST /api/integrations/google/calendar/events — create an event
//   Body: { summary, description?, start (ISO), end (ISO), attendees?: string[], location?, reminders?: [{minutes, method?}] }

import { NextResponse } from 'next/server';
import { calendar } from '@/lib/google-workspace';
import { resolveGoogleAuth } from '@/lib/google-workspace/route-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { accessToken, response } = await resolveGoogleAuth(req);
  if (response || !accessToken) return response;

  const url = new URL(req.url);
  const max = Math.min(Number(url.searchParams.get('max') ?? '20'), 100);
  const res = await calendar.listEvents(accessToken, max);
  if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, events: res.data?.events ?? [] });
}

export async function POST(req: Request) {
  const { accessToken, response } = await resolveGoogleAuth(req);
  if (response || !accessToken) return response;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.start || !body.end || !body.summary) {
    return NextResponse.json({ ok: false, error: 'summary, start, and end are required.' }, { status: 400 });
  }

  const res = await calendar.createEvent(accessToken, {
    summary: String(body.summary),
    description: body.description ? String(body.description) : undefined,
    start: String(body.start),
    end: String(body.end),
    attendees: Array.isArray(body.attendees) ? body.attendees.map(String) : undefined,
    location: body.location ? String(body.location) : undefined,
    reminders: Array.isArray(body.reminders)
      ? body.reminders.map((r) => {
          const obj = r as { minutes?: number; method?: string };
          return { minutes: Number(obj.minutes ?? 30), method: (obj.method as 'email' | 'popup' | undefined) };
        })
      : undefined,
  });
  if (res.error) return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, event: res.data });
}
