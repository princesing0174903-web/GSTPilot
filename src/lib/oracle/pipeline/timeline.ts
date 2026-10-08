// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — AI Timeline Generator (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Oracle automatically builds an AI timeline from real business data:
//   • Today               — what's due/overdue today
//   • This Week           — deadlines in the next 7 days
//   • This Month          — milestones in the next 30 days
//   • Upcoming Deadlines  — GST filing dates, payment due dates
//   • Missed Actions      — overdue returns, unpaid invoices past due
//   • Important Events    — forecast milestones, concentration alerts
//
// Computed DETERMINISTICALLY from real Prisma data. No fabrication.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import { db } from '@/lib/db';
import type { AITimeline, TimelineItem } from './types';
import type { BusinessSnapshot } from '@/lib/business/snapshot';
import { inr } from './tools';

/** Get the next GSTR-1 due date (11th of next month). */
function nextGstr1Due(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 11);
  return d;
}

/** Get the next GSTR-3B due date (20th of next month). */
function nextGstr3bDue(now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 20);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function daysUntil(d: Date, now = new Date()): number {
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

/**
 * Build the AI timeline from real business data + GST calendar.
 */
export async function buildTimeline(
  snapshot: BusinessSnapshot | null,
  orgId: string,
): Promise<AITimeline> {
  const items: TimelineItem[] = [];
  const now = new Date();

  if (!snapshot) {
    return { items };
  }

  // ─── Today ──────────────────────────────────────────────────────────────────
  // Overdue invoices that are past due TODAY.
  if (snapshot.overdueInvoiceCount > 0) {
    items.push({
      bucket: 'today',
      when: 'Today',
      title: `${snapshot.overdueInvoiceCount} overdue invoice${snapshot.overdueInvoiceCount > 1 ? 's' : ''} — ${inr(snapshot.overdueReceivables)} to collect`,
      detail: 'Send reminders and generate payment links',
      severity: 'critical',
    });
  }

  if (snapshot.overdueReturns > 0) {
    items.push({
      bucket: 'today',
      when: 'Today',
      title: `${snapshot.overdueReturns} GST return${snapshot.overdueReturns > 1 ? 's' : ''} OVERDUE`,
      detail: `Late fees accruing at ~₹${snapshot.overdueReturns * 100}/day`,
      severity: 'critical',
    });
  }

  // ─── This Week (next 7 days) ────────────────────────────────────────────────
  const gstr1 = nextGstr1Due(now);
  const gstr1Days = daysUntil(gstr1, now);
  if (gstr1Days <= 7 && gstr1Days >= 0) {
    items.push({
      bucket: 'this_week',
      when: fmtDate(gstr1),
      title: `GSTR-1 filing due (${gstr1Days === 0 ? 'today' : `in ${gstr1Days}d`})`,
      detail: 'File by 11th to avoid late fees',
      severity: gstr1Days <= 2 ? 'critical' : 'watch',
    });
  }

  // ─── This Month (next 30 days) ──────────────────────────────────────────────
  const gstr3b = nextGstr3bDue(now);
  const gstr3bDays = daysUntil(gstr3b, now);
  if (gstr3bDays <= 30 && gstr3bDays >= 0) {
    items.push({
      bucket: 'this_month',
      when: fmtDate(gstr3b),
      title: `GSTR-3B filing due (${gstr3bDays === 0 ? 'today' : `in ${gstr3bDays}d`})`,
      detail: `Net GST payable: ${inr(snapshot.gstLiability)}`,
      severity: gstr3bDays <= 3 ? 'warn' : 'watch',
    });
  }

  // Forecast milestone.
  if (snapshot.forecast.nextMonthRevenue > 0) {
    items.push({
      bucket: 'this_month',
      when: 'Next 30d',
      title: `Revenue forecast: ${inr(snapshot.forecast.nextMonthRevenue)} (${snapshot.forecast.trend})`,
      detail: `${(snapshot.forecast.confidence * 100).toFixed(0)}% confidence`,
      severity: snapshot.forecast.trend === 'down' ? 'warn' : 'info',
    });
  }

  // ─── Upcoming Deadlines ─────────────────────────────────────────────────────
  // Pull open notices with due dates.
  try {
    if (orgId) {
      // dueDate is a String? column — query by ISO string, not Date object.
      const nowIso = now.toISOString();
      const notices = await db.notice.findMany({
        where: { client: { firmId: orgId }, status: 'open', dueDate: { gte: nowIso } },
        select: { subject: true, dueDate: true, priority: true },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }).catch(() => []);
      for (const n of notices) {
        const dDays = n.dueDate ? daysUntil(new Date(n.dueDate), now) : null;
        items.push({
          bucket: 'upcoming',
          when: n.dueDate ? fmtDate(new Date(n.dueDate)) : 'TBD',
          title: n.subject || 'Open notice',
          detail: `${n.priority} priority${dDays !== null ? ` · ${dDays <= 0 ? 'due now' : `in ${dDays}d`}` : ''}`,
          severity: n.priority === 'high' ? 'critical' : n.priority === 'medium' ? 'warn' : 'watch',
        });
      }
    }
  } catch { /* notices optional */ }

  // ─── Missed Actions ─────────────────────────────────────────────────────────
  if (snapshot.overdueReturns > 0) {
    items.push({
      bucket: 'missed',
      when: 'Past due',
      title: `File ${snapshot.overdueReturns} overdue GST return${snapshot.overdueReturns > 1 ? 's' : ''}`,
      detail: 'Penalties accruing daily',
      severity: 'critical',
    });
  }

  if (snapshot.overdueReceivables > 0) {
    items.push({
      bucket: 'missed',
      when: 'Past due',
      title: `Collect ${inr(snapshot.overdueReceivables)} in overdue receivables`,
      detail: `${snapshot.overdueInvoiceCount} invoices past their due date`,
      severity: 'warn',
    });
  }

  // ─── Important Events ───────────────────────────────────────────────────────
  if (snapshot.topCustomerShare > 0.3) {
    items.push({
      bucket: 'events',
      when: 'Ongoing',
      title: `Customer concentration alert — top customer at ${(snapshot.topCustomerShare * 100).toFixed(0)}%`,
      detail: 'Diversify revenue base',
      severity: 'warn',
    });
  }

  if (isFinite(snapshot.runwayDays) && snapshot.runwayDays < 60) {
    items.push({
      bucket: 'events',
      when: `${snapshot.runwayDays}d horizon`,
      title: `Cash runway alert — ${snapshot.runwayDays} days remaining`,
      detail: `Cash ${inr(snapshot.cash)} at current burn`,
      severity: snapshot.runwayDays < 30 ? 'critical' : 'warn',
    });
  }

  if (snapshot.forecast.trend === 'up') {
    items.push({
      bucket: 'events',
      when: 'This month',
      title: `Revenue momentum — forecast trending up`,
      detail: `Projected ${inr(snapshot.forecast.nextMonthRevenue)}`,
      severity: 'info',
    });
  }

  return { items };
}
