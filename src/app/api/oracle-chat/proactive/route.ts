// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE CHAT — Proactive Insights API
// GET /api/oracle-chat/proactive
//
// Returns Oracle's proactive "I noticed…" observations derived from real data.
// The frontend polls this on load and surfaces insights in a side panel.
// ═══════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { executeTool } from '@/lib/oracle-chat/tools';
import type { ProactiveInsight } from '@/lib/oracle-chat/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [cash, overdue, recv, gst, payables, kpis] = await Promise.all([
      executeTool('cash_flow_summary', ''),
      executeTool('overdue_invoices', ''),
      executeTool('receivables_summary', ''),
      executeTool('search_gst_returns', ''),
      executeTool('payables_summary', ''),
      executeTool('executive_kpis', ''),
    ]);

    const insights: ProactiveInsight[] = [];
    const now = Date.now();

    // Cash runway
    try {
      const d = JSON.parse(cash.summary);
      if (typeof d.cashRunwayDays === 'number') {
        if (d.cashRunwayDays < 30) {
          insights.push({
            id: `pro-cash-${now}`,
            severity: 'critical',
            category: 'cash_flow',
            headline: `Cash runway is only ${d.cashRunwayDays} days`,
            detail: `Bank balance ₹${d.bankBalance} vs monthly burn ₹${d.monthlyBurnRate}. Action needed.`,
            sources: [],
            suggestedAction: 'Accelerate collections and freeze discretionary spend',
          });
        } else if (d.cashRunwayDays < 90) {
          insights.push({
            id: `pro-cash-${now}`,
            severity: 'warning',
            category: 'cash_flow',
            headline: `Cash runway is ${d.cashRunwayDays} days`,
            detail: `Bank balance ₹${d.bankBalance} vs monthly burn ₹${d.monthlyBurnRate}. Below the 90-day healthy threshold.`,
            sources: [],
            suggestedAction: 'Monitor weekly and maintain collection discipline',
          });
        }
      }
    } catch { /* ignore */ }

    // Overdue invoices
    if (overdue.recordCount > 0) {
      insights.push({
        id: `pro-overdue-${now}`,
        severity: overdue.recordCount > 5 ? 'critical' : 'warning',
        category: 'receivables',
        headline: `${overdue.recordCount} invoice${overdue.recordCount === 1 ? '' : 's'} became overdue`,
        detail: `${overdue.recordCount} invoice${overdue.recordCount === 1 ? ' is' : 's are'} past the due date. Each day of delay impacts cash flow.`,
        sources: overdue.sources.slice(0, 5),
        suggestedAction: 'Send reminders to these customers today',
      });
    }

    // GST not filed
    try {
      const d = JSON.parse(gst.summary);
      const pending = [...(d.gstReturns || []), ...(d.gstFilings || [])].filter(
        (r: { status: string }) => r.status === 'not_started' || r.status === 'draft',
      );
      if (pending.length > 0) {
        const next = pending[0];
        insights.push({
          id: `pro-gst-${now}`,
          severity: 'warning',
          category: 'gst',
          headline: `GST ${next.type || 'return'} for ${next.period} is not filed`,
          detail: `${pending.length} GST return${pending.length === 1 ? '' : 's'} in draft/not-started state. Filing deadline approaching.`,
          sources: gst.sources.slice(0, 3),
          suggestedAction: 'Prepare and file before the due date to avoid late fees',
        });
      }
    } catch { /* ignore */ }

    // Receivables concentration
    try {
      const d = JSON.parse(recv.summary);
      if (d.totals?.overdue?.amount > 0) {
        insights.push({
          id: `pro-recv-${now}`,
          severity: 'warning',
          category: 'receivables',
          headline: `₹${d.totals.overdue.amount} in overdue receivables`,
          detail: `${d.totals.overdue.count} invoice(s) overdue. Money sitting outside your bank.`,
          sources: recv.sources.slice(0, 5),
          suggestedAction: 'Prioritize collection on the oldest overdue invoices',
        });
      }
    } catch { /* ignore */ }

    // Payables due
    try {
      const d = JSON.parse(payables.summary);
      if (d.totalVendorOutstanding > 0) {
        insights.push({
          id: `pro-pay-${now}`,
          severity: 'info',
          category: 'payables',
          headline: `₹${d.totalVendorOutstanding} payable to ${d.vendorCount} vendor(s)`,
          detail: `Outstanding vendor payables. Plan payments to maintain supplier relationships.`,
          sources: payables.sources.slice(0, 3),
          suggestedAction: 'Schedule vendor payments aligned with your cash position',
        });
      }
    } catch { /* ignore */ }

    // Collection rate health
    try {
      const d = JSON.parse(kpis.summary);
      const rate = d.kpis?.collectionRate;
      if (typeof rate === 'number' && rate < 60 && d.kpis?.revenue30d) {
        insights.push({
          id: `pro-coll-${now}`,
          severity: 'warning',
          category: 'cash_flow',
          headline: `Collection rate is only ${rate}%`,
          detail: `You've collected ${rate}% of last 30 days' invoiced revenue. Industry healthy benchmark is 80%+.`,
          sources: [],
          suggestedAction: 'Tighten credit terms and follow-up cadence',
        });
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      insights,
      hasData: cash.recordCount > 0 || overdue.recordCount > 0 || recv.recordCount > 0 || kpis.recordCount > 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load proactive insights';
    return NextResponse.json(
      { generatedAt: new Date().toISOString(), insights: [], hasData: false, error: msg },
      { status: 500 },
    );
  }
}
