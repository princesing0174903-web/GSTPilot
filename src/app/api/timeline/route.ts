// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/timeline
// ═══════════════════════════════════════════════════════════════════════════════
//
// Returns the most recent Business Timeline events for an organization,
// newest first. Reads from the canonical `BusinessEvent` Prisma table via
// `listTimelineEvents` (src/lib/timeline/emit.ts).
//
// Query params:
//   organizationId (required) — the org/firm id
//   limit          (optional) — max events to return (default 20, capped at 200)
//
// Response shape:
//   { events: TimelineEvent[] }   // always 200 — empty array for local- or
//                                 // missing org IDs (no 4xx for missing org)
//
// DESIGN NOTE — why we always return 200:
// The dashboard polls this endpoint on mount and after mutations. Returning
// 4xx for "no org" or "local- org" would surface as an error in the hook and
// show a broken Timeline widget for guest users. Instead we return an empty
// events array — the widget then renders its existing "No activity yet"
// empty state, which is the correct UX.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { listTimelineEvents } from '@/lib/timeline/emit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') ?? '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 20;

    // No org id at all → empty events (the hook will fall back to the
    // "No activity yet" empty state in the UI).
    if (!organizationId) {
      return NextResponse.json({ events: [] });
    }

    // listTimelineEvents handles local- org IDs (returns []) and DB errors
    // (returns []) internally, so we just delegate.
    const events = await listTimelineEvents(organizationId, limit);
    return NextResponse.json({ events });
  } catch (err) {
    // Defensive — should never happen because listTimelineEvents swallows
    // errors, but if it does, we still return 200 with an empty array so
    // the dashboard never breaks.
    console.error(
      '[/api/timeline] error:',
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ events: [] });
  }
}
