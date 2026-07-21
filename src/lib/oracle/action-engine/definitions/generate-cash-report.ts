// ═══════════════════════════════════════════════════════════════════════════════
// Action: Generate Cash Report
// ═══════════════════════════════════════════════════════════════════════════════
//
// Builds a markdown cash report over a period (7d / 30d / 90d / ytd) in
// summary or detailed format. Pulls cash flow via getCashFlow() and the
// dashboard KPIs via getDashboard() from the Banking Service.
//
// Returns:
//   • summary (markdown) — inflow, outflow, net, top categories, reconciled %
//   • data: { period, totalInflow, totalOutflow, netFlow, reconciledPct }
//   • artifacts: table with monthly breakdown
//
// Oracle calls the Banking Service directly (NOT the API routes, NOT Prisma).
// ═══════════════════════════════════════════════════════════════════════════════

import { getBankingService } from '@/lib/banking-service';
import { emitTimelineEvent } from '@/lib/timeline/emit';
import {
  registerAction,
  inr,
  logActivity,
  type OracleAction,
  type ValidationResult,
  type ActionPreview,
  type ActionResult,
} from '../registry';

const VALID_PERIODS = ['7d', '30d', '90d', 'ytd'] as const;
const VALID_FORMATS = ['summary', 'detailed'] as const;

function periodToDateRange(period: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  switch (period) {
    case '7d':
      from.setDate(to.getDate() - 7);
      break;
    case '30d':
      from.setDate(to.getDate() - 30);
      break;
    case '90d':
      from.setDate(to.getDate() - 90);
      break;
    case 'ytd': {
      from.setMonth(0, 1); // Jan 1 of current year
      from.setHours(0, 0, 0, 0);
      break;
    }
    default:
      from.setDate(to.getDate() - 30);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export const generateCashReportAction: OracleAction = {
  name: 'generateCashReport',
  displayName: 'Generate Cash Report',
  description: 'Generate a cash report (inflow, outflow, net flow, top categories, reconciled %) over 7d / 30d / 90d / ytd in summary or detailed format. Calls the Banking Service.',
  category: 'finance',
  icon: 'FileBarChart',
  intentKeywords: [
    'generate cash report', 'cash report', 'cash flow report', 'banking report',
  ],
  paramSchema: [
    { key: 'period', label: 'Period', type: 'enum', required: false, options: [...VALID_PERIODS], description: '7d | 30d (default) | 90d | ytd' },
    { key: 'format', label: 'Format', type: 'enum', required: false, options: [...VALID_FORMATS], description: 'summary (default) or detailed' },
  ],

  async validate(args, _orgId): Promise<ValidationResult> {
    const fields: ValidationResult['fields'] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const resolvedRefs: Record<string, any> = {};

    const period = String(args.period ?? '30d').toLowerCase();
    if (!VALID_PERIODS.includes(period as any)) {
      fields.push({ key: 'period', label: 'Period', status: 'warn', message: `Unknown — defaulting to "30d"`, resolvedValue: '30d' });
      warnings.push(`Unknown period "${period}" — defaulting to 30d.`);
      resolvedRefs.period = '30d';
    } else {
      fields.push({ key: 'period', label: 'Period', status: 'ok', resolvedValue: period });
      resolvedRefs.period = period;
    }

    const format = String(args.format ?? 'summary').toLowerCase();
    if (!VALID_FORMATS.includes(format as any)) {
      fields.push({ key: 'format', label: 'Format', status: 'warn', message: `Unknown — defaulting to "summary"`, resolvedValue: 'summary' });
      warnings.push(`Unknown format "${format}" — defaulting to summary.`);
      resolvedRefs.format = 'summary';
    } else {
      fields.push({ key: 'format', label: 'Format', status: 'ok', resolvedValue: format });
      resolvedRefs.format = format;
    }

    return { ok: errors.length === 0, fields, errors, warnings, resolvedRefs };
  },

  buildPreview(args, validation): ActionPreview {
    const refs = validation.resolvedRefs ?? {};
    const period = refs.period ?? '30d';
    const format = refs.format ?? 'summary';
    return {
      title: `Cash report — ${period} (${format})`,
      fields: [
        { label: 'Period', value: period, emphasize: true },
        { label: 'Format', value: format },
      ],
      note: 'Pulls live cash flow + dashboard data from the Banking Service and returns a markdown summary + structured table.',
    };
  },

  async execute(args, orgId, ctx): Promise<ActionResult> {
    const period = VALID_PERIODS.includes(String(args.period ?? '30d').toLowerCase() as any)
      ? (String(args.period ?? '30d').toLowerCase() as typeof VALID_PERIODS[number])
      : '30d';
    const format = VALID_FORMATS.includes(String(args.format ?? 'summary').toLowerCase() as any)
      ? (String(args.format ?? 'summary').toLowerCase() as 'summary' | 'detailed')
      : 'summary';

    let svc;
    try {
      svc = await getBankingService();
    } catch (e) {
      return { ok: false, summary: `Banking Service unavailable: ${(e as Error).message}` };
    }

    const { from, to } = periodToDateRange(period);

    const [cashflow, dashboard] = await Promise.all([
      svc.getCashFlow(orgId, { from, to }).catch((e) => {
        console.error('[generateCashReport] getCashFlow failed:', (e as Error).message);
        return null;
      }),
      svc.getDashboard(orgId).catch((e) => {
        console.error('[generateCashReport] getDashboard failed:', (e as Error).message);
        return null;
      }),
    ]);

    if (!cashflow) {
      return { ok: false, summary: `Failed to load cash flow data for the ${period} period.` };
    }

    const topInflow = [...(cashflow.inflowByCategory ?? [])]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const topOutflow = [...(cashflow.outflowByCategory ?? [])]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
    const reconciledPct = dashboard?.cards.reconciledPct ?? 0;

    // Monthly breakdown: bucket the daily series into months
    const monthlyBuckets = new Map<string, { inflow: number; outflow: number; net: number }>();
    for (const pt of cashflow.series ?? []) {
      const monthKey = (pt.date || '').slice(0, 7); // YYYY-MM
      if (!monthKey) continue;
      const bucket = monthlyBuckets.get(monthKey) ?? { inflow: 0, outflow: 0, net: 0 };
      bucket.inflow += pt.inflow ?? 0;
      bucket.outflow += pt.outflow ?? 0;
      bucket.net += pt.net ?? 0;
      monthlyBuckets.set(monthKey, bucket);
    }
    const monthlyRows = Array.from(monthlyBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        Month: month,
        Inflow: inr(v.inflow),
        Outflow: inr(v.outflow),
        Net: inr(v.net),
      }));

    const summary =
      `✅ **Cash Report — ${period}** (${format})\n\n` +
      `### Summary\n` +
      `• Total inflow: **${inr(cashflow.totalInflow)}**\n` +
      `• Total outflow: **${inr(cashflow.totalOutflow)}**\n` +
      `• Net flow: **${inr(cashflow.netFlow)}**\n` +
      `• Opening balance: ${inr(cashflow.openingBalance)}\n` +
      `• Closing balance: ${inr(cashflow.closingBalance)}\n` +
      `• Reconciled: **${reconciledPct.toFixed(1)}%**\n\n` +
      (topInflow.length > 0
        ? `### Top inflow categories\n${topInflow.map(c => `• ${c.category}: ${inr(c.amount)}`).join('\n')}\n\n`
        : '') +
      (topOutflow.length > 0
        ? `### Top outflow categories\n${topOutflow.map(c => `• ${c.category}: ${inr(c.amount)}`).join('\n')}\n\n`
        : '') +
      (format === 'detailed' && (cashflow.series?.length ?? 0) > 0
        ? `### Daily series (first 10 days)\n` +
          (cashflow.series.slice(0, 10).map(p => `• ${p.date.slice(0, 10)}: in ${inr(p.inflow)} / out ${inr(p.outflow)} / net ${inr(p.net)} / balance ${inr(p.balance)}`).join('\n'))
        : '');

    await logActivity(orgId, 'banking', `Generated ${period} cash report (${format}) — inflow ${inr(cashflow.totalInflow)}, outflow ${inr(cashflow.totalOutflow)}, net ${inr(cashflow.netFlow)}, ${reconciledPct.toFixed(0)}% reconciled`, {
      period, format,
      totalInflow: cashflow.totalInflow,
      totalOutflow: cashflow.totalOutflow,
      netFlow: cashflow.netFlow,
      reconciledPct,
    });

    await emitTimelineEvent({
      organizationId: orgId,
      type: 'banking.report_generated',
      title: `${period} cash report generated`,
      description: `Inflow ${inr(cashflow.totalInflow)} · outflow ${inr(cashflow.totalOutflow)} · net ${inr(cashflow.netFlow)} · ${reconciledPct.toFixed(0)}% reconciled.`,
      severity: 'info',
      actor: { userId: ctx.userId, userName: ctx.userId },
      metadata: {
        period, format,
        totalInflow: cashflow.totalInflow,
        totalOutflow: cashflow.totalOutflow,
        netFlow: cashflow.netFlow,
        reconciledPct,
      },
    });

    return {
      ok: true,
      summary,
      data: {
        period,
        format,
        totalInflow: cashflow.totalInflow,
        totalOutflow: cashflow.totalOutflow,
        netFlow: cashflow.netFlow,
        openingBalance: cashflow.openingBalance,
        closingBalance: cashflow.closingBalance,
        reconciledPct,
      },
      artifacts: monthlyRows.length > 0 ? [{
        kind: 'table',
        title: 'Monthly breakdown',
        columns: ['Month', 'Inflow', 'Outflow', 'Net'],
        rows: monthlyRows,
      }] : undefined,
      viewIn: { label: 'View banking', href: '/banking' },
    };
  },
};

registerAction(generateCashReportAction);
