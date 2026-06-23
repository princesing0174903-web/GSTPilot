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

// ─── Seed data ─────────────────────────────────────────────────────────────────

const daysAgo = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
};

/**
 * Returns 12 realistic report distribution records showing reports sent via
 * various channels to different recipients.
 */
export function seedReportDistributions(): ReportDistribution[] {
  return [
    {
      id: 'rpt-seed-001',
      reportType: 'gst_summary',
      recipient: 'priya@sharmasons.com',
      recipientName: 'Priya Sharma',
      channel: 'email',
      status: 'delivered',
      sentAt: daysAgo(3),
      summary: 'GST Summary Dec 2025 — Output ₹4.2L, ITC ₹1.4L, Net Payable ₹2.8L, Returns Filed: 4/4',
    },
    {
      id: 'rpt-seed-002',
      reportType: 'cash_flow',
      recipient: 'sunita@patelent.in',
      recipientName: 'Sunita Patel',
      channel: 'email',
      status: 'delivered',
      sentAt: daysAgo(1),
      summary: 'Cash Flow Forecast — Inflow ₹14.2L, Outflow ₹9.1L, Net Surplus ₹5.1L, Runway 180 days',
    },
    {
      id: 'rpt-seed-003',
      reportType: 'receivables',
      recipient: 'vikram@singhlogistics.in',
      recipientName: 'Vikram Singh',
      channel: 'email',
      status: 'opened',
      sentAt: daysAgo(3),
      summary: 'Receivables Aging — Outstanding ₹18.2L, Overdue ₹4.6L, Collection Rate 74%, DSO 47 days',
    },
    {
      id: 'rpt-seed-004',
      reportType: 'payables',
      recipient: 'accounts@vermaindustries.in',
      recipientName: 'Rajesh Verma',
      channel: 'email',
      status: 'opened',
      sentAt: daysAgo(2),
      summary: 'Payables Report — Total ₹8.6L, Due This Week ₹2.5L, Overdue ₹1.2L',
    },
    {
      id: 'rpt-seed-005',
      reportType: 'tds',
      recipient: 'pooja@bhatassociates.in',
      recipientName: 'Pooja Bhat',
      channel: 'email',
      status: 'opened',
      sentAt: daysAgo(4),
      summary: 'TDS Q3 FY26 — Total Deducted ₹84,000, Paid ₹84,000, Pending ₹0, 24 deductee records',
    },
    {
      id: 'rpt-seed-006',
      reportType: 'payroll',
      recipient: 'sai@krishnatraders.in',
      recipientName: 'Sai Krishna',
      channel: 'email',
      status: 'failed',
      sentAt: daysAgo(2),
      summary: 'Payroll Dec 2025 — 8 employees, Gross ₹6.4L, Net ₹5.2L, Deductions ₹1.2L',
    },
    {
      id: 'rpt-seed-007',
      reportType: 'ai_cfo',
      recipient: 'meera@joshiconsulting.in',
      recipientName: 'Meera Joshi',
      channel: 'email',
      status: 'opened',
      sentAt: daysAgo(2),
      summary: 'AI CFO Briefing Dec 2025 — Revenue ₹42L, Net Profit ₹8.4L, Cash ₹15.2L, Health 78/100',
    },
    {
      id: 'rpt-seed-008',
      reportType: 'gst_summary',
      recipient: '+91 98765 43210',
      recipientName: 'Rajesh Verma',
      channel: 'whatsapp',
      status: 'read',
      sentAt: daysAgo(3),
      summary: 'GST Summary Dec 2025 — Net Payable ₹2.8L. Full report sent to email.',
    },
    {
      id: 'rpt-seed-009',
      reportType: 'cash_flow',
      recipient: 'dashboard',
      recipientName: 'Dashboard',
      channel: 'dashboard',
      status: 'delivered',
      sentAt: daysAgo(1),
      summary: 'Cash Flow Forecast pinned to dashboard. Surplus ₹5.1L predicted.',
    },
    {
      id: 'rpt-seed-010',
      reportType: 'receivables',
      recipient: '+91 98200 11223',
      recipientName: 'Priya Sharma',
      channel: 'whatsapp',
      status: 'delivered',
      sentAt: daysAgo(2),
      summary: 'Receivables snapshot — Outstanding ₹18.2L, 3 invoices overdue. Full report on email.',
    },
    {
      id: 'rpt-seed-011',
      reportType: 'ai_cfo',
      recipient: 'pdf-download',
      recipientName: 'PDF Export',
      channel: 'pdf',
      status: 'delivered',
      sentAt: daysAgo(1),
      summary: 'AI CFO Monthly Briefing PDF generated. Revenue ₹42L, Health 78/100.',
    },
    {
      id: 'rpt-seed-012',
      reportType: 'gst_summary',
      recipient: 'amit@mehtatraders.in',
      recipientName: 'Amit Mehta',
      channel: 'email',
      status: 'opened',
      sentAt: daysAgo(5),
      summary: 'GST Summary Nov 2025 — Output ₹3.8L, ITC ₹1.2L, Net Payable ₹2.6L, Returns Filed: 4/4',
    },
  ];
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
