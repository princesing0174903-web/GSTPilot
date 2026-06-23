// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Execution Engine™ — MODULE 7: Execution Timeline™
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// ═══════════════════════════════════════════════════════════════════════════════
// The 09:02 / 09:07 / 09:12 / 09:14 / 09:17 style single-day activity stream.
// Stitched from ExecutionTask[] + the 6 pipeline stages so an Oracle / dashboard
// can render "what GSTPilot did today" as a chronological narrative.
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
// All seed timestamps use today's date in IST (Asia/Kolkata, UTC+5:30) with
// fixed HH:MM times. This keeps the timeline narrative stable across reloads
// while still falling on "today" for the todayCount metric.

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // +05:30

/** Returns YYYY-MM-DD for the current moment in IST. */
function getISTDateString(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.toISOString().slice(0, 10);
}

/** Builds an ISO timestamp for today's IST date at the given HH:MM (IST). */
function istTimestamp(hhmm: string): string {
  const dateStr = getISTDateString();
  // `new Date('2026-01-15T09:02:00+05:30')` parses correctly in Node + browsers.
  return new Date(`${dateStr}T${hhmm}:00+05:30`).toISOString();
}

/** Checks whether an ISO timestamp falls on today's IST date. */
function isTodayIST(iso: string): boolean {
  return getISTDateString(new Date(iso)) === getISTDateString();
}

// ─── Timeline Recipe — declarative spec for each seed entry ──────────────────
interface TimelineRecipe {
  taskIdx: number | null;     // 0-based index into tasks[], or null for ad-hoc
  stage: TimelineStage;
  title: string;
  description: string;
  agent: AgentName | 'oracle';
  timeIST: string;            // HH:MM in IST (today)
}

// 17 entries — matches the spec's 09:02 → 17:30 narrative arc:
//   morning observe/think/decide/execute → afternoon confirm/learn
const SEED_TIMELINE_RECIPE: TimelineRecipe[] = [
  // ── Morning: observe → think → decide → execute ─────────────────────────
  {
    taskIdx: 0,
    stage: 'observe',
    title: 'Downloaded GSTR-2B',
    description:
      'Auto-fetched GSTR-2B from GST portal: 2,847 lines across 24 vendors. ITC value ₹2,10,000 unlocked for matching.',
    agent: 'gst_agent',
    timeIST: '09:02',
  },
  {
    taskIdx: 0,
    stage: 'think',
    title: 'Detected ITC mismatch',
    description:
      '38 invoices show ITC mismatch between GSTR-2B and purchase register — ₹16,000 ITC at risk. Reconciliation queued.',
    agent: 'gst_agent',
    timeIST: '09:07',
  },
  {
    taskIdx: 3,
    stage: 'decide',
    title: 'Sent payment reminders',
    description:
      'Queued WhatsApp + email reminders for 12 overdue clients (Verma Industries ₹18.2L, Reddy Suppliers ₹2.8L, others).',
    agent: 'collection_agent',
    timeIST: '09:12',
  },
  {
    taskIdx: 1,
    stage: 'execute',
    title: 'Prepared GSTR-3B',
    description:
      'Drafted GSTR-3B for Sharma Enterprises LLP — output ₹4,20,000, ITC ₹1,84,000, net liability ₹2,10,000. Awaiting CA sign-off.',
    agent: 'gst_agent',
    timeIST: '09:14',
  },
  {
    taskIdx: 6,
    stage: 'execute',
    title: 'Forecasted cash shortage',
    description:
      '13-week rolling forecast predicts ₹18,60,000 deficit in 12 days. Bank balance ₹18.4L against ₹28.4L outflows. Invoice-discounting bridge recommended.',
    agent: 'cfo_agent',
    timeIST: '09:17',
  },
  {
    taskIdx: 2,
    stage: 'observe',
    title: 'Bank credit detected',
    description:
      '₹3,20,000 UPI credit from Sharma Enterprises LLP matched against INV-2025-0184. Receivable auto-closed; client payment-pattern memory updated.',
    agent: 'cfo_agent',
    timeIST: '09:35',
  },
  {
    taskIdx: 2,
    stage: 'execute',
    title: 'Reconciled bank transactions',
    description:
      '1,240 bank transactions reconciled against invoices & payables — ₹18,40,000 amount reconciled. 1 shortage flagged (₹24,000).',
    agent: 'cfo_agent',
    timeIST: '09:42',
  },
  {
    taskIdx: 5,
    stage: 'decide',
    title: 'Approved vendor payment',
    description:
      'Patel & Sons ₹2,40,000 scheduled for Day 4 — captures ₹4,800 early-pay discount while preserving runway. Approved by CFO Priya Sharma.',
    agent: 'cfo_agent',
    timeIST: '10:15',
  },
  {
    taskIdx: 5,
    stage: 'execute',
    title: 'Sent invoices',
    description:
      'Dispatched INV-2026-0042 (₹3,20,000) to Sharma Enterprises LLP via WhatsApp + Email. Aging clock started (30-day terms).',
    agent: 'collection_agent',
    timeIST: '10:28',
  },
  {
    taskIdx: 4,
    stage: 'execute',
    title: 'Generated payroll',
    description:
      'January 2026 payroll for 18 employees — gross ₹8,42,000, net ₹7,27,800 (PF ₹71,200 + TDS ₹40,600 + PT ₹2,400). Bank file ready.',
    agent: 'compliance_agent',
    timeIST: '11:05',
  },
  // ── Midday: confirm stage (awaiting human input) ────────────────────────
  {
    taskIdx: 1,
    stage: 'confirm',
    title: 'GSTR-3B awaiting approval',
    description:
      'GSTR-3B draft sent to CA Anil Mehta for sign-off. Net liability ₹2,10,000 — cash ledger short by ₹1,15,000; funding must be arranged before filing.',
    agent: 'gst_agent',
    timeIST: '11:30',
  },
  {
    taskIdx: 8,
    stage: 'execute',
    title: 'Generated TDS challan',
    description:
      'ITNS-281 challan for Q3 TDS ₹3,40,000 ready — 194C ₹2,10,000 + 194J ₹95,000 + 194I ₹35,000. Approved by CA; deposit scheduled 31/01.',
    agent: 'compliance_agent',
    timeIST: '12:15',
  },
  {
    taskIdx: 13,
    stage: 'decide',
    title: 'Escalated Reddy Suppliers',
    description:
      'Drafted IBC Section 9 notice (MSME recovery) for Reddy Suppliers ₹2,80,000 — 68-day overdue, 41% default probability. Pending partner sign-off.',
    agent: 'compliance_agent',
    timeIST: '13:42',
  },
  {
    taskIdx: 3,
    stage: 'execute',
    title: 'Sent WhatsApp reminders',
    description:
      '12 reminders dispatched via WhatsApp Business API — 11 delivered, 4 read, 1 failed (Reddy Suppliers — invalid number).',
    agent: 'collection_agent',
    timeIST: '14:20',
  },
  {
    taskIdx: 2,
    stage: 'confirm',
    title: 'Bank reconciliation verified',
    description:
      'All 1,240 transactions tied out against open invoices & payables. 1 shortage (₹24,000) flagged for review — likely bank charge not yet booked.',
    agent: 'cfo_agent',
    timeIST: '15:05',
  },
  // ── Evening: learn stage (Oracle updates behaviour memory) ──────────────
  {
    taskIdx: 1,
    stage: 'learn',
    title: 'Learned user approves filings after ITC review',
    description:
      'Pattern detected: 87% of GSTR-3B filings approved within 30 min when ITC reconciliation step is shown first. Updating approval-flow preference.',
    agent: 'oracle',
    timeIST: '16:15',
  },
  {
    taskIdx: 0,
    stage: 'learn',
    title: 'Updated payment-pattern memory',
    description:
      'Sharma Enterprises LLP reclassified amber (47-day DSO vs 30-day terms, 92% confidence, 12-invoice sample). Cash forecast adjusted +17 days on ₹3.2L monthly bills.',
    agent: 'oracle',
    timeIST: '17:30',
  },
];

// ─── seedTimeline — materialise 17 demo timeline entries ─────────────────────
// Links each entry to a task positionally (when taskIdx is provided and within
// range). Falls back to null taskId for ad-hoc entries (e.g. Oracle learn
// observations that aren't tied to a specific task).
export function seedTimeline(tasks: ExecutionTask[]): ExecutionTimelineEntry[] {
  const entries: ExecutionTimelineEntry[] = SEED_TIMELINE_RECIPE.map((r, idx) => {
    const task = r.taskIdx != null ? tasks[r.taskIdx] : null;
    const taskId = task ? task.id : null;
    return {
      id: `tl_${String(idx + 1).padStart(3, '0')}`,
      taskId,
      agent: r.agent,
      stage: r.stage,
      title: r.title,
      description: r.description,
      timestamp: istTimestamp(r.timeIST),
    } satisfies ExecutionTimelineEntry;
  });

  // Sort by timestamp descending (most recent first) for UI rendering.
  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
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
