// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Google Calendar Collector
//
// Reads upcoming calendar events for the next 7 days. Detects scheduling
// conflicts (overlapping events) so the productivity analyzer can flag them.
//
// Graceful contract: if Google Workspace is not connected, returns an empty
// CalendarData — never throws.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';

// Google integration removed — stub for rebuild
const getValidAccessToken = async () => ({ accessToken: null, error: 'Google integration rebuilding', permanent: false });
const loadTokens = async () => ({ tokens: null, stored: null });
const calendar = { listEvents: async () => ({ events: [] }) };
import type {
  CalendarData,
  CalendarEventSummary,
  Collector,
  CollectorContext,
  CollectorResult,
} from '../types';

function emptyData(): CalendarData {
  return {
    upcoming: [],
    nextEventAt: null,
    weekLoad: 0,
    conflicts: 0,
  };
}

/**
 * Count overlapping event pairs in the next 7 days. Two events conflict if
 * their [start, end) intervals overlap (and they aren't the same event).
 */
function countConflicts(events: CalendarEventSummary[]): number {
  const inWeek = events.filter((e) => {
    const start = Date.parse(e.start);
    if (Number.isNaN(start)) return false;
    return start <= Date.now() + 7 * 24 * 60 * 60 * 1000;
  });
  let conflicts = 0;
  for (let i = 0; i < inWeek.length; i++) {
    for (let j = i + 1; j < inWeek.length; j++) {
      const aStart = Date.parse(inWeek[i].start);
      const aEnd = Date.parse(inWeek[i].end || inWeek[i].start);
      const bStart = Date.parse(inWeek[j].start);
      const bEnd = Date.parse(inWeek[j].end || inWeek[j].start);
      if (Number.isNaN(aStart) || Number.isNaN(aEnd) || Number.isNaN(bStart) || Number.isNaN(bEnd)) continue;
      if (aStart < bEnd && bStart < aEnd) conflicts += 1;
    }
  }
  return conflicts;
}

export const calendarCollector: Collector<CalendarData> = {
  id: 'calendar',
  label: 'Google Calendar',
  async collect(ctx: CollectorContext): Promise<CollectorResult<CalendarData>> {
    const collectedAt = new Date().toISOString();

    if (!ctx.organizationId) {
      return { source: 'calendar', connected: false, recordCount: 0, data: emptyData(), collectedAt };
    }

    const { tokens, stored } = await loadTokens(ctx.organizationId, ctx.userId);
    if (!tokens || !stored) {
      return { source: 'calendar', connected: false, recordCount: 0, data: emptyData(), collectedAt };
    }

    const { accessToken, error: tokenError } = await getValidAccessToken(
      ctx.organizationId,
      ctx.userId,
    );
    if (tokenError || !accessToken) {
      return {
        source: 'calendar',
        connected: false,
        recordCount: 0,
        data: emptyData(),
        error: tokenError ?? 'No access token.',
        collectedAt,
      };
    }

    const res = await calendar.listEvents(accessToken, 25);
    const rawEvents = res.data?.events ?? [];

    const upcoming: CalendarEventSummary[] = rawEvents.map((e) => ({
      id: e.id,
      summary: e.summary,
      start: e.start.dateTime ?? e.start.date ?? '',
      end: e.end.dateTime ?? e.end.date ?? '',
      attendees: [],
      hangoutLink: e.hangoutLink,
      location: undefined,
    }));

    const sorted = upcoming
      .filter((e) => e.start && Date.parse(e.start))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

    const nextEventAt = sorted.length > 0 ? sorted[0].start : null;
    const weekHorizon = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const weekLoad = sorted.filter((e) => Date.parse(e.start) <= weekHorizon).length;
    const conflicts = countConflicts(sorted);

    const data: CalendarData = {
      upcoming: sorted,
      nextEventAt,
      weekLoad,
      conflicts,
    };

    return {
      source: 'calendar',
      connected: true,
      recordCount: sorted.length,
      data,
      collectedAt,
    };
  },
};
