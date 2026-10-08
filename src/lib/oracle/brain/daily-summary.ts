// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Daily Summary (PROMPT 6)
//
// The "good morning" summary shown when Oracle opens. Combines yesterday's
// conversations, today's priorities, pending tasks, upcoming GST deadlines,
// upcoming collections, business health changes, and active reminders — all
// from real data.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getBusinessSnapshot, type BusinessSnapshot } from '@/lib/business/snapshot';
import type { BrainTask, BrainReminder, DailySummary } from './types';

// Self-contained inline mappers (mirrors of the engine mappers, kept local to
// avoid circular imports and keep this module standalone).

// ─── Inline mappers ───────────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  firmId: string;
  userId: string | null;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  relatedType: string | null;
  relatedId: string | null;
  relatedLabel: string | null;
  dueDate: Date | null;
  reminderSentAt: Date | null;
  followUpSentAt: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
  completionNote: string | null;
  sourceMemoryId: string | null;
  autonomous: boolean;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
}

function mapTask(row: TaskRow): BrainTask {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata || '{}');
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    title: row.title,
    description: row.description,
    type: row.type as BrainTask['type'],
    status: row.status as BrainTask['status'],
    priority: row.priority as BrainTask['priority'],
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    relatedLabel: row.relatedLabel,
    dueDate: row.dueDate?.toISOString() ?? null,
    reminderSentAt: row.reminderSentAt?.toISOString() ?? null,
    followUpSentAt: row.followUpSentAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    completedBy: row.completedBy,
    completionNote: row.completionNote,
    sourceMemoryId: row.sourceMemoryId,
    autonomous: row.autonomous,
    metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface ReminderRow {
  id: string;
  firmId: string;
  userId: string | null;
  type: string;
  title: string;
  message: string;
  severity: string;
  relatedType: string | null;
  relatedId: string | null;
  relatedLabel: string | null;
  dueDate: Date | null;
  triggerDate: Date | null;
  status: string;
  actionTaken: string | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapReminder(row: ReminderRow): BrainReminder {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    type: row.type as BrainReminder['type'],
    title: row.title,
    message: row.message,
    severity: row.severity as BrainReminder['severity'],
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    relatedLabel: row.relatedLabel,
    dueDate: row.dueDate?.toISOString() ?? null,
    triggerDate: row.triggerDate?.toISOString() ?? null,
    status: row.status as BrainReminder['status'],
    actionTaken: row.actionTaken,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

async function safeSnapshot(firmId: string): Promise<BusinessSnapshot | null> {
  try {
    return await getBusinessSnapshot(firmId);
  } catch {
    return null;
  }
}

/** Compute the next GSTR-1 (11th) and GSTR-3B (20th) due dates. */
function getUpcomingGstDeadlines(): { title: string; dueDate: Date; daysLeft: number }[] {
  const now = new Date();
  const out: { title: string; dueDate: Date; daysLeft: number }[] = [];
  const tryDate = (day: number, label: string) => {
    const d = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 0);
    if (d < now) {
      // Next month
      d.setMonth(d.getMonth() + 1);
    }
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    out.push({ title: label, dueDate: d, daysLeft });
  };
  tryDate(11, 'GSTR-1');
  tryDate(20, 'GSTR-3B');
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Build the daily summary shown when Oracle opens. */
export async function getDailySummary(
  firmId: string,
  userId?: string,
): Promise<DailySummary> {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const endOfYesterday = new Date(startOfToday.getTime() - 1);

    const [snap, yesterdayConvs, pendingTaskRows, activeReminderRows, latestDaily] =
      await Promise.all([
        safeSnapshot(firmId),
        db.oracleBrainMemory.findMany({
          where: {
            firmId,
            type: 'conversation',
            createdAt: { gte: startOfYesterday, lte: endOfYesterday },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { title: true, summary: true },
        }),
        db.oracleBrainTask.findMany({
          where: { firmId, status: { notIn: ['completed', 'cancelled'] } },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
        db.oracleBrainReminder.findMany({
          where: { firmId, status: 'active' },
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
          take: 5,
        }),
        db.oracleBrainReport.findFirst({
          where: { firmId, type: 'daily' },
          orderBy: { createdAt: 'desc' },
          select: { metrics: true, period: true },
        }),
      ]);

    // Yesterday's summary
    let yesterdaySummary: string;
    if (yesterdayConvs.length === 0) {
      yesterdaySummary = 'No conversations were held yesterday.';
    } else {
      const titles = yesterdayConvs.map((c) => c.title).filter(Boolean);
      yesterdaySummary = `Yesterday you held ${yesterdayConvs.length} conversation(s) with Oracle${
        titles.length > 0 ? `: ${titles.join(' · ')}` : '.'
      }`;
    }

    // Today's priorities (derived from snapshot + tasks)
    const revenue = snap?.revenueThisMonth ?? 0;
    const cash = snap?.cash ?? 0;
    const receivables = snap?.receivables ?? 0;
    const overdueReceivables = snap?.overdueReceivables ?? 0;
    const health = snap?.healthScore ?? 0;
    const upcomingGst = getUpcomingGstDeadlines();
    const pendingTasks = pendingTaskRows.map((r) => mapTask(r as unknown as TaskRow));

    const todayPriorities: string[] = [];
    if (overdueReceivables > 0) {
      todayPriorities.push(`Collect ${formatINR(overdueReceivables)} in overdue receivables`);
    }
    const soonGst = upcomingGst.filter((g) => g.daysLeft <= 7);
    if (soonGst.length > 0) {
      const g = soonGst[0];
      todayPriorities.push(
        g.daysLeft < 0
          ? `${g.title} is overdue — file immediately`
          : `File ${g.title} (due in ${g.daysLeft} days)`,
      );
    }
    if (snap && snap.customerCount > 0 && snap.topCustomerShare > 0.6) {
      todayPriorities.push(
        `Diversify customer base (top customer at ${Math.round(snap.topCustomerShare * 100)}%)`,
      );
    }
    if (cash < 50000 && cash > 0) {
      todayPriorities.push(`Bank balance low at ${formatINR(cash)} — monitor burn`);
    }
    if (pendingTasks.length > 0) {
      todayPriorities.push(`${pendingTasks.length} pending task(s) need attention`);
    }
    if (todayPriorities.length === 0) {
      todayPriorities.push('Business is operating normally — no urgent priorities today.');
    }

    // Upcoming collections — derive from snapshot (no invoice detail in snapshot,
    // so we report the aggregate overdue amount if present).
    const upcomingCollections: { title: string; amount: number; daysOverdue: number }[] = [];
    if (overdueReceivables > 0) {
      upcomingCollections.push({
        title: 'Overdue receivables',
        amount: overdueReceivables,
        daysOverdue: 0, // aggregate — no per-invoice detail
      });
    }

    // Business health changes — compare to latest daily report
    const businessHealthChanges: {
      metric: string;
      change: string;
      direction: 'up' | 'down' | 'flat';
    }[] = [];
    if (latestDaily) {
      try {
        const priorMetrics = JSON.parse(latestDaily.metrics || '{}');
        const priorHealth = typeof priorMetrics.healthScore === 'number' ? priorMetrics.healthScore : null;
        if (priorHealth !== null && priorHealth !== health) {
          const delta = health - priorHealth;
          const direction: 'up' | 'down' | 'flat' =
            delta >= 3 ? 'up' : delta <= -3 ? 'down' : 'flat';
          businessHealthChanges.push({
            metric: 'Business Health',
            change: `${priorHealth} → ${health} (${delta >= 0 ? '+' : ''}${delta})`,
            direction,
          });
        }
      } catch {
        /* ignore */
      }
    }

    return {
      date: now.toISOString().slice(0, 10),
      yesterdaySummary,
      todayPriorities: todayPriorities.slice(0, 5),
      pendingTasks,
      upcomingGst: upcomingGst.map((g) => ({
        title: g.title,
        dueDate: g.dueDate.toISOString(),
        daysLeft: g.daysLeft,
      })),
      upcomingCollections,
      businessHealthChanges,
      activeReminders: activeReminderRows.map((r) =>
        mapReminder(r as unknown as ReminderRow),
      ),
    };
  } catch (err) {
    throw new Error(
      `getDailySummary failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
