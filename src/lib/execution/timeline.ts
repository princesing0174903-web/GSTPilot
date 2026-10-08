// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Execution Engine™ — MODULE 7: Execution Timeline™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// The 09:02 / 09:07 / 09:12 / 09:14 / 09:17 style single-day activity stream.
// Stitched from ExecutionTask[] + the 6 pipeline stages so an Oracle / dashboard
// can render "what VEYRO did today" as a chronological narrative.
//
// Stages:
//   observe → think → decide → execute → confirm → learn
//
// Exports:
//   • seedTimeline         — 17 demo entries spanning 09:02 to 17:30 IST
//   • getTimelineSummary   — total + todayCount + byStage/byAgent breakdowns
//   • addTimelineEntry     — factory for appending a new live entry
//
// Pure TypeScript — no Prisma, no React, no 'use client'.
// Importable from both Next.js API routes (server) and React components (client).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AgentName,
  ExecutionTask,
  ExecutionTimelineEntry,
  TimelineStage,
  TimelineSummary,
} from './types';

// ─── IST date helpers ─────────────────────────────────────────────────────────
// Helpers used to compute todayCount (entries from today's IST date) in
// getTimelineSummary below.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30

/** Returns YYYY-MM-DD for the current moment in IST. */
function getISTDateString(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

/** Checks whether an ISO timestamp falls on today's IST date. */
function isTodayIST(iso: string): boolean {
  return getISTDateString(new Date(iso)) === getISTDateString();
}

// ─── seedTimeline (no-op) ─────────────────────────────────────────────────────
// Previously this function synthesised demo timeline entries from a
// hardcoded recipe constant referencing fabricated clients, invoice
// numbers, and amounts. The export name is preserved so existing callers
// continue to compile, but it now returns `[]` so the UI renders a proper
// empty state. Real timeline entries come from
// `db.executionTimeline.findMany()` (or equivalent) via the API routes.
export function seedTimeline(_tasks: ExecutionTask[]): ExecutionTimelineEntry[] {
  return [];
}

// ─── getTimelineSummary — derive rollup metrics from a timeline stream ───────
// Returns total, todayCount (entries from today's IST date), byStage across all
// 6 TimelineStage keys, byAgent as Record<string, number>, and entries sorted
// by timestamp descending.
export function getTimelineSummary(
  entries: ExecutionTimelineEntry[],
): TimelineSummary {
  const byStage: Record<TimelineStage, number> = {
    observe: 0,
    think: 0,
    decide: 0,
    execute: 0,
    confirm: 0,
    learn: 0,
  };
  const byAgent: Record<string, number> = {};
  let todayCount = 0;

  for (const e of entries) {
    byStage[e.stage] = (byStage[e.stage] ?? 0) + 1;
    const agentKey = e.agent ?? 'unassigned';
    byAgent[agentKey] = (byAgent[agentKey] ?? 0) + 1;
    if (isTodayIST(e.timestamp)) todayCount += 1;
  }

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return {
    total: entries.length,
    todayCount,
    byStage,
    byAgent,
    entries: sortedEntries,
  };
}

// ─── addTimelineEntry — factory for appending a live entry ───────────────────
// Used by /api/execution and agent runners when a new event occurs at runtime.
// Generates a fresh ISO timestamp and a stable ID.
export function addTimelineEntry(opts: {
  taskId?: string | null;
  agent: AgentName | 'oracle' | null;
  stage: TimelineStage;
  title: string;
  description?: string | null;
}): ExecutionTimelineEntry {
  const now = new Date().toISOString();
  return {
    id: `tl_live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    taskId: opts.taskId ?? null,
    agent: opts.agent,
    stage: opts.stage,
    title: opts.title,
    description: opts.description ?? null,
    timestamp: now,
  } satisfies ExecutionTimelineEntry;
}
