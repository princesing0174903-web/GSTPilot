// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — PLAYBACK™ ENGINE
//
// Allows business owners to replay history. Aggregates timeline events and
// period state into frames so the user can "scrub" through time.
//
// Supports ranges: yesterday, last_week, last_month, last_quarter, q1–q4,
// this_year, last_year, all.
//
// Every frame contains the state at that point + the events that led to it,
// plus the delta from the previous frame. The final `evolution` shows the
// overall change from start to end of the range.
// ═══════════════════════════════════════════════════════════════════════════════

import { computeBusinessTimeline } from './timeline';
import { computeSnapshotBundle } from './snapshots';
import type {
  PlaybackRange,
  PlaybackResult,
  PlaybackFrame,
  PlaybackState,
  StateDelta,
  TimelineEvent,
  BusinessSnapshot,
} from './types';

// ─── Resolve a playback range to [start, end] ────────────────────────────────

function resolveRange(range: PlaybackRange): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'yesterday': {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - 1);
      const end = new Date(todayStart);
      end.setMilliseconds(-1);
      return { start, end };
    }
    case 'last_week': {
      const end = new Date(todayStart);
      end.setMilliseconds(-1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case 'last_month': {
      const end = new Date(todayStart);
      end.setMilliseconds(-1);
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start, end };
    }
    case 'last_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      const end = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
      return { start, end };
    }
    case 'q1':
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 2, 31, 23, 59, 59, 999) };
    case 'q2':
      return { start: new Date(now.getFullYear(), 3, 1), end: new Date(now.getFullYear(), 5, 30, 23, 59, 59, 999) };
    case 'q3':
      return { start: new Date(now.getFullYear(), 6, 1), end: new Date(now.getFullYear(), 8, 30, 23, 59, 59, 999) };
    case 'q4':
      return { start: new Date(now.getFullYear(), 9, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
    case 'this_year':
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    case 'last_year':
      return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999) };
    case 'all':
      return { start: new Date(now.getFullYear() - 10, 0, 1), end: now };
  }
}

// ─── Convert a snapshot to a playback state ──────────────────────────────────

function snapshotToState(s: BusinessSnapshot): PlaybackState {
  return {
    revenue: s.revenue,
    profit: s.profit,
    cash: s.cash,
    healthScore: s.healthScore,
    riskScore: s.riskScore,
    collections: s.collections,
    expenses: s.expenses,
    employees: s.employees,
  };
}

// ─── Compute deltas between two states ───────────────────────────────────────

function computeStateDeltas(from: PlaybackState, to: PlaybackState): StateDelta[] {
  const keys: Array<{ key: keyof PlaybackState; label: string }> = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'profit', label: 'Profit' },
    { key: 'cash', label: 'Cash' },
    { key: 'healthScore', label: 'Health Score' },
    { key: 'riskScore', label: 'Risk Score' },
    { key: 'collections', label: 'Collections' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'employees', label: 'Employees' },
  ];

  return keys.map(({ key, label }) => {
    const f = Number(from[key] || 0);
    const t = Number(to[key] || 0);
    const delta = t - f;
    const deltaPct = f !== 0 ? ((t - f) / Math.abs(f)) * 100 : (t > 0 ? 100 : 0);
    const direction: StateDelta['direction'] = Math.abs(deltaPct) < 1 ? 'stable' : delta > 0 ? 'up' : 'down';
    return { metric: label, from: f, to: t, delta, deltaPct, direction };
  });
}

// ─── Build frames by bucketing events into period chunks ─────────────────────

function buildFrames(
  range: { start: Date; end: Date },
  events: TimelineEvent[],
  snapshots: BusinessSnapshot[],
  bucketCount: number,
): PlaybackFrame[] {
  const totalMs = range.end.getTime() - range.start.getTime();
  const bucketMs = totalMs / bucketCount;
  const frames: PlaybackFrame[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(range.start.getTime() + i * bucketMs);
    const bucketEnd = new Date(range.start.getTime() + (i + 1) * bucketMs);

    // Events in this bucket
    const bucketEvents = events.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= bucketStart && t < bucketEnd;
    });

    // Find the snapshot whose periodStart is closest to bucketStart
    let bestSnap: BusinessSnapshot | undefined;
    let bestDist = Infinity;
    for (const s of snapshots) {
      const sStart = new Date(s.periodStart).getTime();
      const dist = Math.abs(sStart - bucketStart.getTime());
      if (dist < bestDist) {
        bestDist = dist;
        bestSnap = s;
      }
    }

    const state: PlaybackState = bestSnap
      ? snapshotToState(bestSnap)
      : { revenue: 0, profit: 0, cash: 0, healthScore: 0, riskScore: 0, collections: 0, expenses: 0, employees: 0 };

    const prevFrame = frames[frames.length - 1];
    const deltaFromPrevious = prevFrame ? computeStateDeltas(prevFrame.state, state) : undefined;

    frames.push({
      timestamp: bucketStart.toISOString(),
      state,
      events: bucketEvents,
      deltaFromPrevious,
    });
  }

  return frames;
}

// ─── Build a narrative summary of the evolution ──────────────────────────────

function buildNarrative(
  range: PlaybackRange,
  evolution: StateDelta[],
  totalEvents: number,
): string {
  const rev = evolution.find((d) => d.metric === 'Revenue');
  const profit = evolution.find((d) => d.metric === 'Profit');
  const health = evolution.find((d) => d.metric === 'Health Score');
  const cash = evolution.find((d) => d.metric === 'Cash');

  const parts: string[] = [];
  parts.push(`Over ${range.replace(/_/g, ' ')}, the business recorded ${totalEvents} events.`);
  if (rev) {
    parts.push(`Revenue ${rev.direction === 'up' ? 'grew' : rev.direction === 'down' ? 'declined' : 'held steady'} ${Math.abs(rev.deltaPct).toFixed(1)}%${rev.delta !== 0 ? ` (₹${Math.abs(rev.delta).toLocaleString('en-IN')})` : ''}.`);
  }
  if (profit && profit.delta !== 0) {
    parts.push(`Profit ${profit.direction === 'up' ? 'increased' : 'decreased'} by ₹${Math.abs(profit.delta).toLocaleString('en-IN')}.`);
  }
  if (health && Math.abs(health.delta) >= 1) {
    parts.push(`Health score ${health.direction === 'up' ? 'improved' : 'declined'} by ${Math.abs(health.delta)} points.`);
  }
  if (cash && cash.delta !== 0) {
    parts.push(`Cash position ${cash.direction === 'up' ? 'strengthened' : 'weakened'} by ₹${Math.abs(cash.delta).toLocaleString('en-IN')}.`);
  }
  return parts.join(' ');
}

// ─── Main: compute playback for a range ──────────────────────────────────────

export async function computePlayback(range: PlaybackRange, bucketCount = 12): Promise<PlaybackResult> {
  const period = resolveRange(range);

  const [timeline, snapshotBundle] = await Promise.all([
    computeBusinessTimeline(1000),
    computeSnapshotBundle(),
  ]);

  // Filter events to the range
  const rangeEvents = timeline.events.filter((e) => {
    const t = new Date(e.timestamp);
    return t >= period.start && t <= period.end;
  });

  // Gather all snapshots (from all frequencies) to find best matches
  const allSnapshots: BusinessSnapshot[] = [
    ...snapshotBundle.daily,
    ...snapshotBundle.weekly,
    ...snapshotBundle.monthly,
    ...snapshotBundle.quarterly,
    ...snapshotBundle.yearly,
  ].filter((s) => {
    const sStart = new Date(s.periodStart);
    return sStart >= period.start && sStart <= period.end;
  });

  // Build frames
  const frames = buildFrames(period, rangeEvents, allSnapshots, bucketCount);

  // Determine start and end states
  const startState: PlaybackState = frames[0]?.state || { revenue: 0, profit: 0, cash: 0, healthScore: 0, riskScore: 0, collections: 0, expenses: 0, employees: 0 };
  const endState: PlaybackState = frames[frames.length - 1]?.state || startState;

  const evolution = computeStateDeltas(startState, endState);
  const narrative = buildNarrative(range, evolution, rangeEvents.length);

  return {
    range,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    totalEvents: rangeEvents.length,
    frames,
    startState,
    endState,
    evolution,
    narrative,
  };
}
