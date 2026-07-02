// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Communication Cloud™ — Report Distribution Engine™
// GST Summary, Cash Flow, Receivables, Payables, TDS, Payroll, AI CFO Report.
// Delivery channels: WhatsApp, Email, PDF, Dashboard.
// Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CommunicationChannel, ReportDistribution } from './types';

// ─── Report types ──────────────────────────────────────────────────────────────

export interface ReportTypeDef {
  type: string;
  label: string;
  description: string;
  defaultChannel: CommunicationChannel;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  icon: string; // emoji
}

export const REPORT_TYPES: ReportTypeDef[] = [
  {
    type: 'gst_summary',
    label: 'GST Summary',
    description: 'Monthly GST liability, ITC, net payable, and filing status',
    defaultChannel: 'email',
    frequency: 'monthly',
    icon: '📊',
  },
  {
    type: 'cash_flow',
    label: 'Cash Flow Report',
    description: '30-day cash inflow/outflow forecast with runway projection',
    defaultChannel: 'email',
    frequency: 'weekly',
    icon: '💰',
  },
  {
    type: 'receivables',
    label: 'Receivables Report',
    description: 'Aging buckets, top defaulters, collection forecast, DSO',
    defaultChannel: 'email',
    frequency: 'weekly',
    icon: '📥',
  },
  {
    type: 'payables',
    label: 'Payables Report',
    description: 'Vendor dues, payment schedule, cash allocation plan',
    defaultChannel: 'email',
    frequency: 'weekly',
    icon: '📤',
  },
  {
    type: 'tds',
    label: 'TDS Report',
    description: 'Quarterly TDS deduction, deposit, and return status',
    defaultChannel: 'email',
    frequency: 'quarterly',
    icon: '🧾',
  },
  {
    type: 'payroll',
    label: 'Payroll Report',
    description: 'Monthly payroll summary, PF/ESI/TDS, net payable',
    defaultChannel: 'email',
    frequency: 'monthly',
    icon: '👥',
  },
  {
    type: 'ai_cfo',
    label: 'AI CFO Report',
    description: 'Monthly executive briefing with health score, risks, and recommendations',
    defaultChannel: 'email',
    frequency: 'monthly',
    icon: '🧠',
  },
];

export const DELIVERY_CHANNELS: CommunicationChannel[] = ['whatsapp', 'email', 'pdf', 'dashboard'];

/** Get a report type definition by its type key. */
export function getReportTypeDef(type: string): ReportTypeDef | undefined {
  return REPORT_TYPES.find((r) => r.type === type);
}

// ─── Seed placeholder (no-op) ─────────────────────────────────────────────────
// Previously this module shipped 12 hardcoded report distribution records
// attributed to fake Indian recipients. The export name is preserved so
// existing callers continue to compile, but it now returns `[]` so the UI
// renders a proper empty state. Real report distributions come from
// `db.communicationLog.findMany({ where: { channel: 'email', category: 'report' } })`
// (or equivalent) via the API routes.

export function seedReportDistributions(): ReportDistribution[] {
  return [];
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

export interface ReportStats {
  total: number;
  byType: Record<string, number>;
  byChannel: Record<string, number>;
  deliveryRate: number; // %
}

/** Compute aggregate stats from a list of report distributions. */
export function getReportStats(distributions: ReportDistribution[]): ReportStats {
  const total = distributions.length;
  const byType: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  let delivered = 0;
  for (const d of distributions) {
    byType[d.reportType] = (byType[d.reportType] ?? 0) + 1;
    byChannel[d.channel] = (byChannel[d.channel] ?? 0) + 1;
    if (d.status === 'delivered' || d.status === 'opened' || d.status === 'read') {
      delivered++;
    }
  }
  return {
    total,
    byType,
    byChannel,
    deliveryRate: total > 0 ? round2((delivered / total) * 100) : 0,
  };
}

// ─── Report summary generation ─────────────────────────────────────────────────

/**
 * Generate a human-readable text summary for a report type using the provided data.
 * This summary is used in WhatsApp messages, SMS, and dashboard cards.
 */
export function generateReportSummary(
  type: string,
  data: Record<string, string | number>,
): string {
  switch (type) {
    case 'gst_summary':
      return `GST Summary ${data.period ?? ''} — Output ₹${data.output_gst ?? '—'}, ITC ₹${data.input_gst ?? '—'}, Net Payable ₹${data.net_payable ?? '—'}, Returns Filed: ${data.returns_filed ?? '—'}`;
    case 'cash_flow':
      return `Cash Flow Forecast — Inflow ₹${data.inflow ?? '—'}, Outflow ₹${data.outflow ?? '—'}, Net ₹${data.net_position ?? '—'}, Runway ${data.runway ?? '—'} days`;
    case 'receivables':
      return `Receivables Aging — Outstanding ₹${data.outstanding ?? '—'}, Overdue ₹${data.overdue ?? '—'}, Collection Rate ${data.collection_rate ?? '—'}%, DSO ${data.dso ?? '—'} days`;
    case 'payables':
      return `Payables Report — Total ₹${data.total_payable ?? '—'}, Due This Week ₹${data.due_this_week ?? '—'}, Overdue ₹${data.overdue ?? '—'}`;
    case 'tds':
      return `TDS ${data.quarter ?? ''} — Total Deducted ₹${data.total_tds ?? '—'}, Paid ₹${data.paid ?? '—'}, Pending ₹${data.pending ?? '—'}`;
    case 'payroll':
      return `Payroll ${data.period ?? ''} — ${data.employee_count ?? '—'} employees, Gross ₹${data.gross ?? '—'}, Net ₹${data.net ?? '—'}, Deductions ₹${data.deductions ?? '—'}`;
    case 'ai_cfo':
      return `AI CFO Briefing ${data.period ?? ''} — Revenue ₹${data.revenue ?? '—'}, Net Profit ₹${data.profit ?? '—'}, Cash ₹${data.cash ?? '—'}, Health ${data.health_score ?? '—'}/100`;
    default:
      return `Report: ${type}`;
  }
}

// ─── Scheduling ────────────────────────────────────────────────────────────────

export interface ReportSchedule {
  type: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  channel: CommunicationChannel;
  nextRunAt: string;
}

/**
 * Schedule a report for recurring distribution. Returns the schedule object
 * with the next run time computed based on the frequency.
 */
export function scheduleReport(
  type: string,
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly',
  channel: CommunicationChannel,
): ReportSchedule {
  const now = new Date();
  const next = new Date(now);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      break;
    case 'weekly':
      // Next Monday
      const dayOfWeek = next.getDay();
      const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
      next.setDate(next.getDate() + daysUntilMonday);
      next.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(9, 0, 0, 0);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      next.setDate(1);
      next.setHours(9, 0, 0, 0);
      break;
  }
  return { type, frequency, channel, nextRunAt: next.toISOString() };
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
