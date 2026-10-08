// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Reminder Engine (PROMPT 6)
//
// Smart proactive reminders. Oracle watches the business snapshot and creates
// reminders autonomously: GST due, customer overdue, low bank balance, cash
// runway falling, revenue drop. Each reminder is deduplicated so the user
// isn't spammed.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  BrainReminder,
  ReminderType,
  ReminderSeverity,
  ReminderStatus,
} from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ReminderSeverity, number> = {
  critical: 0,
  warn: 1,
  watch: 2,
  info: 3,
};

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

function mapRow(row: ReminderRow): BrainReminder {
  return {
    id: row.id,
    firmId: row.firmId,
    userId: row.userId,
    type: row.type as ReminderType,
    title: row.title,
    message: row.message,
    severity: row.severity as ReminderSeverity,
    relatedType: row.relatedType,
    relatedId: row.relatedId,
    relatedLabel: row.relatedLabel,
    dueDate: row.dueDate?.toISOString() ?? null,
    triggerDate: row.triggerDate?.toISOString() ?? null,
    status: row.status as ReminderStatus,
    actionTaken: row.actionTaken,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sortReminders(reminders: BrainReminder[]): BrainReminder[] {
  return reminders.sort((a, b) => {
    const sr = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sr !== 0) return sr;
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CreateReminderInput {
  firmId: string;
  userId?: string;
  type: ReminderType;
  title: string;
  message: string;
  severity?: ReminderSeverity;
  relatedType?: string;
  relatedId?: string;
  relatedLabel?: string;
  dueDate?: Date;
  triggerDate?: Date;
}

/** Create a reminder. */
export async function createReminder(input: CreateReminderInput): Promise<BrainReminder> {
  try {
    const row = await db.oracleBrainReminder.create({
      data: {
        firmId: input.firmId,
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        severity: input.severity ?? 'info',
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        relatedLabel: input.relatedLabel ?? null,
        dueDate: input.dueDate ?? null,
        triggerDate: input.triggerDate ?? null,
        status: 'active',
      },
    });
    return mapRow(row as unknown as ReminderRow);
  } catch (err) {
    throw new Error(
      `createReminder failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Patch a reminder. */
export async function updateReminder(
  id: string,
  patch: Partial<{
    status: ReminderStatus;
    actionTaken: string;
    snoozedUntil: Date;
  }>,
): Promise<BrainReminder> {
  try {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.actionTaken !== undefined) data.actionTaken = patch.actionTaken;
    if (patch.snoozedUntil !== undefined) data.snoozedUntil = patch.snoozedUntil;
    const row = await db.oracleBrainReminder.update({ where: { id }, data });
    return mapRow(row as unknown as ReminderRow);
  } catch (err) {
    throw new Error(
      `updateReminder failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Fetch one reminder. */
export async function getReminder(id: string): Promise<BrainReminder | null> {
  try {
    const row = await db.oracleBrainReminder.findUnique({ where: { id } });
    return row ? mapRow(row as unknown as ReminderRow) : null;
  } catch (err) {
    throw new Error(
      `getReminder failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** List reminders with filters. */
export async function listReminders(opts: {
  firmId: string;
  status?: ReminderStatus;
  severity?: ReminderSeverity;
  type?: ReminderType;
  limit?: number;
}): Promise<BrainReminder[]> {
  try {
    const where: Record<string, unknown> = { firmId: opts.firmId };
    if (opts.status) where.status = opts.status;
    if (opts.severity) where.severity = opts.severity;
    if (opts.type) where.type = opts.type;
    const rows = await db.oracleBrainReminder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: (opts.limit ?? 30) * 3,
    });
    return sortReminders(rows.map((r) => mapRow(r as unknown as ReminderRow))).slice(
      0,
      opts.limit ?? 30,
    );
  } catch (err) {
    throw new Error(
      `listReminders failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Active reminders only. */
export async function getActiveReminders(
  firmId: string,
  limit = 20,
): Promise<BrainReminder[]> {
  return listReminders({ firmId, status: 'active', limit });
}

/** Snooze a reminder. */
export async function snoozeReminder(id: string, until: Date): Promise<BrainReminder> {
  return updateReminder(id, { status: 'snoozed', snoozedUntil: until });
}

/** Dismiss a reminder. */
export async function dismissReminder(id: string): Promise<BrainReminder> {
  return updateReminder(id, { status: 'dismissed' });
}

/** Mark a reminder acted upon. */
export async function markActed(id: string, actionTaken: string): Promise<BrainReminder> {
  return updateReminder(id, { status: 'acted', actionTaken });
}

// ─── Deduplication helper ─────────────────────────────────────────────────────

async function hasActiveReminder(
  firmId: string,
  type: ReminderType,
  relatedId?: string | null,
  withinHours?: number,
): Promise<boolean> {
  const where: Record<string, unknown> = {
    firmId,
    type,
    status: 'active',
  };
  if (relatedId) where.relatedId = relatedId;
  if (withinHours) {
    const since = new Date(Date.now() - withinHours * 3600 * 1000);
    where.createdAt = { gt: since };
  }
  const count = await db.oracleBrainReminder.count({ where });
  return count > 0;
}

// ─── Autonomous reminder generation from business snapshot ────────────────────

export interface ReminderSnapshotInput {
  gstLiability?: number;
  cashBalance?: number;
  monthlyBurn?: number;
  overdueInvoices?: {
    id: string;
    number: string;
    customer: string;
    amount: number;
    daysOverdue: number;
  }[];
  upcomingGst?: { title: string; dueDate: Date; daysLeft: number }[];
  revenueChangePct?: number;
}

/**
 * Autonomously create reminders based on real business data. Deduplicates so
 * the same condition doesn't create a duplicate reminder. Returns all newly
 * created reminders.
 */
export async function generateRemindersFromSnapshot(
  firmId: string,
  snapshot: ReminderSnapshotInput,
): Promise<BrainReminder[]> {
  const created: BrainReminder[] = [];

  // 1. Overdue invoices
  if (snapshot.overdueInvoices && snapshot.overdueInvoices.length > 0) {
    for (const inv of snapshot.overdueInvoices) {
      if (inv.daysOverdue <= 0) continue;
      const exists = await hasActiveReminder(firmId, 'customer_overdue', inv.id);
      if (exists) continue;
      const severity: ReminderSeverity =
        inv.daysOverdue > 30 ? 'critical' : inv.daysOverdue > 7 ? 'warn' : 'watch';
      const r = await createReminder({
        firmId,
        type: 'customer_overdue',
        title: `${inv.customer} — ${inv.daysOverdue}d overdue`,
        message: `${inv.customer} owes ₹${Math.round(inv.amount).toLocaleString('en-IN')} (invoice ${inv.number}, ${inv.daysOverdue} days overdue). Consider sending a reminder.`,
        severity,
        relatedType: 'invoice',
        relatedId: inv.id,
        relatedLabel: `${inv.number} — ${inv.customer}`,
      });
      created.push(r);
    }
  }

  // 2. Upcoming GST deadlines
  if (snapshot.upcomingGst && snapshot.upcomingGst.length > 0) {
    for (const g of snapshot.upcomingGst) {
      if (g.daysLeft > 7) continue;
      const exists = await hasActiveReminder(firmId, 'gst_due', null);
      if (exists) continue;
      const severity: ReminderSeverity =
        g.daysLeft < 0 ? 'critical' : g.daysLeft <= 3 ? 'warn' : 'watch';
      const r = await createReminder({
        firmId,
        type: 'gst_due',
        title: g.title,
        message:
          g.daysLeft < 0
            ? `${g.title} is ${Math.abs(g.daysLeft)} days overdue. File immediately to avoid penalties.`
            : `${g.title} due in ${g.daysLeft} days (due ${g.dueDate.toLocaleDateString('en-IN')}).`,
        severity,
        relatedType: 'return',
        relatedLabel: g.title,
        dueDate: g.dueDate,
      });
      created.push(r);
    }
  }

  // 3. Cash runway
  if (
    snapshot.cashBalance !== undefined &&
    snapshot.monthlyBurn &&
    snapshot.monthlyBurn > 0
  ) {
    const runwayMonths = snapshot.cashBalance / snapshot.monthlyBurn;
    if (runwayMonths < 3) {
      const exists = await hasActiveReminder(firmId, 'cash_runway', null, 24);
      if (!exists) {
        const severity: ReminderSeverity =
          runwayMonths < 1 ? 'critical' : runwayMonths < 2 ? 'warn' : 'watch';
        const r = await createReminder({
          firmId,
          type: 'cash_runway',
          title: `Cash runway ${runwayMonths.toFixed(1)} months`,
          message: `Cash runway ${runwayMonths.toFixed(1)} months at current burn ₹${Math.round(snapshot.monthlyBurn).toLocaleString('en-IN')}/mo. Balance: ₹${Math.round(snapshot.cashBalance).toLocaleString('en-IN')}.`,
          severity,
        });
        created.push(r);
      }
    }
  }

  // 4. Low balance
  if (snapshot.cashBalance !== undefined && snapshot.cashBalance < 50000) {
    const exists = await hasActiveReminder(firmId, 'low_balance', null, 24);
    if (!exists) {
      const r = await createReminder({
        firmId,
        type: 'low_balance',
        title: 'Bank balance low',
        message: `Bank balance low at ₹${Math.round(snapshot.cashBalance).toLocaleString('en-IN')}. Monitor expenses closely.`,
        severity: 'warn',
      });
      created.push(r);
    }
  }

  // 5. Revenue drop
  if (
    snapshot.revenueChangePct !== undefined &&
    snapshot.revenueChangePct < -10
  ) {
    const exists = await hasActiveReminder(firmId, 'revenue_drop', null, 24 * 7);
    if (!exists) {
      const severity: ReminderSeverity =
        snapshot.revenueChangePct < -30 ? 'critical' : 'warn';
      const r = await createReminder({
        firmId,
        type: 'revenue_drop',
        title: `Revenue down ${Math.abs(snapshot.revenueChangePct).toFixed(1)}%`,
        message: `Revenue dropped ${Math.abs(snapshot.revenueChangePct).toFixed(1)}% vs prior period. Investigate causes and consider corrective action.`,
        severity,
      });
      created.push(r);
    }
  }

  return created;
}

/** Aggregate reminder stats. */
export async function getReminderStats(
  firmId: string,
): Promise<{
  total: number;
  active: number;
  snoozed: number;
  dismissed: number;
  acted: number;
  critical: number;
}> {
  try {
    const rows = await db.oracleBrainReminder.findMany({
      where: { firmId },
      select: { status: true, severity: true },
    });
    const counts = { active: 0, snoozed: 0, dismissed: 0, acted: 0, critical: 0 };
    for (const r of rows) {
      if (r.status in counts) counts[r.status as keyof typeof counts]++;
      if (r.severity === 'critical' && r.status === 'active') counts.critical++;
    }
    return { total: rows.length, ...counts };
  } catch (err) {
    throw new Error(
      `getReminderStats failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
