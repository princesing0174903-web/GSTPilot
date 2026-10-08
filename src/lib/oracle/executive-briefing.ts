// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Executive Daily Briefing (Upgraded)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Upgrades the existing daily-briefing.ts into a true executive briefing with
// 8 sections. Reads from the Unified Oracle Financial Context (single source
// of truth — no duplicate fetching). Deterministic — no LLM call. The LLM can
// later polish the prose, but the structure + numbers are fixed so the
// briefing is always usable + auditable.
//
// SECTIONS:
//   1. TODAY'S FINANCIAL STATUS  — headline numbers (revenue, cash, receivables, GST)
//   2. TOP 3 RISKS               — from ctx.risk.signals
//   3. TOP 3 OPPORTUNITIES       — collections to chase, ITC to recover, etc.
//   4. COLLECTIONS TO CHASE      — top overdue customers by balance
//   5. GST ACTIONS               — pending/overdue returns + ITC at risk
//   6. CASH FLOW ALERTS          — runway, burn, decline warnings
//   7. IMPORTANT CUSTOMER EVENTS — top customer activity, new customers
//   8. PENDING ACTIONS           — items awaiting user approval
//
// Every item carries: why it matters, evidence, recommended action.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getUnifiedOracleContext } from '@/lib/oracle/context/builder';
import { detectAnomalies } from '@/lib/oracle/intelligence/anomaly-detector';
import type { UnifiedOracleContext, Evidence } from '@/lib/oracle/context/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefingSectionItem {
  id: string;
  title: string;
  detail: string;
  whyItMatters: string;
  recommendedAction: string;
  /** Optional ₹ amount. */
  amount?: number;
  /** Optional deep-link. */
  actionView?: string;
  /** Evidence backing this item. */
  evidenceId?: string;
  /** Tone for the UI. */
  tone: 'critical' | 'high' | 'medium' | 'low' | 'positive' | 'info';
}

export interface ExecutiveBriefing {
  computedAt: string;
  organizationId: string;
  isDemoWorkspace: boolean;

  // Section 1: Today's Financial Status
  financialStatus: {
    headline: string;
    revenue: number;
    cash: number;
    receivables: number;
    overdueReceivables: number;
    gstLiability: number;
    healthScore: number;
    healthLabel: string;
    revenueTrend: 'up' | 'down' | 'flat';
    revenueChangePct: number | null;
    evidenceId: string;
  };

  // Section 2: Top 3 Risks
  topRisks: BriefingSectionItem[];

  // Section 3: Top 3 Opportunities
  topOpportunities: BriefingSectionItem[];

  // Section 4: Collections to Chase
  collectionsToChase: BriefingSectionItem[];

  // Section 5: GST Actions
  gstActions: BriefingSectionItem[];

  // Section 6: Cash Flow Alerts
  cashFlowAlerts: BriefingSectionItem[];

  // Section 7: Important Customer Events
  customerEvents: BriefingSectionItem[];

  // Section 8: Pending Actions
  pendingActions: BriefingSectionItem[];

  // Proactive anomaly detection (from the statistical engine, not the LLM)
  anomalies: Array<{
    id: string;
    title: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    hasSufficientData: boolean;
  }>;

  // Integration status summary
  integrationsSummary: Array<{
    label: string;
    connected: boolean;
    environment: string;
    statusMessage: string;
  }>;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, { briefing: ExecutiveBriefing; ts: number }>();
const CACHE_TTL_MS = 60_000;

export interface GetBriefingOptions {
  forceRefresh?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inr(n: number): string {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}

function pct(n: number | null): string {
  if (n === null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

// ─── Main: assemble the executive briefing ────────────────────────────────────

export async function getExecutiveBriefing(
  organizationId: string,
  opts: GetBriefingOptions = {},
): Promise<ExecutiveBriefing> {
  if (!organizationId) return emptyBriefing('');

  const cached = cache.get(organizationId);
  if (!opts.forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.briefing;
  }

  const ctx = await getUnifiedOracleContext(organizationId, { forceRefresh: opts.forceRefresh });
  const anomalies = await detectAnomalies(ctx);

  const briefing = assembleBriefing(ctx, anomalies);
  cache.set(organizationId, { briefing, ts: Date.now() });
  return briefing;
}

export function invalidateBriefingCache(organizationId: string): void {
  cache.delete(organizationId);
}

function assembleBriefing(ctx: UnifiedOracleContext, anomalies: any[]): ExecutiveBriefing {
  const computedAt = new Date().toISOString();

  // ── Section 1: Today's Financial Status ──
  const financialStatus: ExecutiveBriefing['financialStatus'] = {
    headline: buildHeadline(ctx),
    revenue: ctx.revenue.invoicedRevenue,
    cash: ctx.cashFlow.currentBalance,
    receivables: ctx.revenue.outstandingReceivables,
    overdueReceivables: ctx.revenue.overdueReceivables,
    gstLiability: ctx.gst.liability,
    healthScore: ctx.health.score,
    healthLabel: ctx.health.label,
    revenueTrend: ctx.revenue.trend.direction,
    revenueChangePct: ctx.revenue.trend.changePct,
    evidenceId: 'invoices-fy',
  };

  // ── Section 2: Top 3 Risks ──
  const topRisks: BriefingSectionItem[] = ctx.risk.signals.slice(0, 3).map((s, i) => ({
    id: `risk-${i}-${s.kind}`,
    title: s.title,
    detail: s.detail,
    whyItMatters: s.estimatedImpact
      ? `Estimated ₹ impact: ${inr(s.estimatedImpact)}`
      : 'Affects business health score and risk profile.',
    recommendedAction: s.recommendedAction ?? 'Review and decide on a course of action.',
    amount: s.estimatedImpact,
    evidenceId: s.evidence.id,
    tone: s.severity,
  }));

  // ── Section 3: Top 3 Opportunities ──
  const topOpportunities: BriefingSectionItem[] = [];

  // Opportunity: overdue collections
  if (ctx.revenue.overdueReceivables > 0) {
    topOpportunities.push({
      id: 'opp-collect-overdue',
      title: `Collect ${inr(ctx.revenue.overdueReceivables)} in overdue receivables`,
      detail: `${ctx.invoices.totalInvoices > 0 ? ctx.customers.overdueCustomerCount + ' customers' : 'Customers'} have overdue balances. Sending reminders could recover this within 30 days.`,
      whyItMatters: `Recovering this would increase cash by ${inr(ctx.revenue.overdueReceivables)} and improve your collection rate from ${(ctx.invoices.collectionRate * 100).toFixed(0)}%.`,
      recommendedAction: 'Send payment reminders to the top 3 overdue customers.',
      amount: ctx.revenue.overdueReceivables,
      actionView: '/dashboard?view=receivables',
      evidenceId: 'invoices-fy',
      tone: 'positive',
    });
  }

  // Opportunity: ITC recovery
  if (ctx.gst.reconciliation.itcAtRisk > 0) {
    topOpportunities.push({
      id: 'opp-recover-itc',
      title: `Recover ${inr(ctx.gst.reconciliation.itcAtRisk)} in at-risk ITC`,
      detail: `${ctx.gst.reconciliation.mismatched + ctx.gst.reconciliation.missingIn2B} supplier invoices have GSTR-2B mismatches. Resolving these could recover the ITC.`,
      whyItMatters: `ITC on mismatched invoices may be denied by the department. Reconciling now protects ${inr(ctx.gst.reconciliation.itcAtRisk)} in input tax credit.`,
      recommendedAction: 'Review the GST reconciliation report and follow up with suppliers.',
      amount: ctx.gst.reconciliation.itcAtRisk,
      actionView: '/dashboard?view=gst-reconciliation',
      evidenceId: 'gst-fy',
      tone: 'positive',
    });
  }

  // Opportunity: top customer growth
  if (ctx.customers.topCustomers[0] && ctx.customers.topCustomers[0].revenue > 0) {
    const top = ctx.customers.topCustomers[0];
    topOpportunities.push({
      id: 'opp-grow-top-customer',
      title: `Grow relationship with ${top.name}`,
      detail: `Your top customer represents ${(top.share * 100).toFixed(0)}% of revenue (${inr(top.revenue)}).`,
      whyItMatters: 'Deepening this relationship could stabilise revenue, but over-reliance is a concentration risk.',
      recommendedAction: 'Schedule a quarterly business review with this customer.',
      actionView: `/dashboard?view=customers&id=${top.id}`,
      evidenceId: 'invoices-fy',
      tone: 'info',
    });
  }

  // ── Section 4: Collections to Chase ──
  const collectionsToChase: BriefingSectionItem[] = ctx.customers.topCustomers
    .filter(c => c.outstandingBalance > 0)
    .slice(0, 5)
    .map(c => ({
      id: `chase-${c.id}`,
      title: c.name,
      detail: `Outstanding ${inr(c.outstandingBalance)}${c.overdueBalance > 0 ? ` (₹${inr(c.overdueBalance)} overdue)` : ''}. Avg payment time: ${c.avgDaysToPay || '—'} days.`,
      whyItMatters: c.overdueBalance > 0
        ? `${c.overdueBalance > c.outstandingBalance * 0.5 ? 'Majority is overdue —' : 'Partially overdue —'} this customer may need a follow-up call.`
        : 'Prevent this from becoming overdue by sending a reminder before the due date.',
      recommendedAction: c.overdueBalance > 0
        ? 'Send a payment reminder now.'
        : 'Send a friendly heads-up before the due date.',
      amount: c.outstandingBalance,
      actionView: `/dashboard?view=customers&id=${c.id}`,
      evidenceId: 'invoices-fy',
      tone: c.overdueBalance > 0 ? 'high' : 'medium',
    }));

  // ── Section 5: GST Actions ──
  const gstActions: BriefingSectionItem[] = [];

  if (ctx.gst.overdueReturns > 0) {
    gstActions.push({
      id: 'gst-file-overdue',
      title: `File ${ctx.gst.overdueReturns} overdue GST return(s)`,
      detail: 'Overdue returns attract late fees (₹200/day) and interest. File immediately.',
      whyItMatters: `Late fees accrue daily. Filing now stops the bleed.`,
      recommendedAction: 'Prepare and file the overdue returns now.',
      amount: ctx.gst.overdueReturns * 200 * 30, // 30-day proxy
      actionView: '/dashboard?view=gst-returns',
      evidenceId: 'gst-fy',
      tone: 'critical',
    });
  }

  if (ctx.gst.pendingReturns > 0) {
    gstActions.push({
      id: 'gst-prepare-pending',
      title: `Prepare ${ctx.gst.pendingReturns} pending return(s)`,
      detail: 'These returns are not yet overdue but need preparation.',
      whyItMatters: 'Preparing early avoids last-minute errors and late fees.',
      recommendedAction: 'Generate the working paper for review.',
      actionView: '/dashboard?view=gst-returns',
      evidenceId: 'gst-fy',
      tone: 'medium',
    });
  }

  if (ctx.gst.liability > 0) {
    gstActions.push({
      id: 'gst-set-aside-liability',
      title: `Set aside ${inr(ctx.gst.liability)} for GST payment`,
      detail: `Net GST liability (output ${inr(ctx.gst.outputTax)} − input ${inr(ctx.gst.inputTax)}).`,
      whyItMatters: 'Ensure cash is available when the return is filed.',
      recommendedAction: 'Review the liability and confirm cash coverage.',
      amount: ctx.gst.liability,
      actionView: '/dashboard?view=gst',
      evidenceId: 'gst-fy',
      tone: ctx.gst.liability > ctx.cashFlow.currentBalance ? 'critical' : 'info',
    });
  }

  if (ctx.gst.reconciliation.itcAtRisk > 0) {
    gstActions.push({
      id: 'gst-reconcile-2b',
      title: `Reconcile GSTR-2B — ${inr(ctx.gst.reconciliation.itcAtRisk)} ITC at risk`,
      detail: `${ctx.gst.reconciliation.mismatched} mismatched, ${ctx.gst.reconciliation.missingIn2B} missing in 2B.`,
      whyItMatters: 'Unreconciled ITC may be denied by the department.',
      recommendedAction: 'Review the reconciliation report and follow up with suppliers.',
      amount: ctx.gst.reconciliation.itcAtRisk,
      actionView: '/dashboard?view=gst-reconciliation',
      evidenceId: 'gst-fy',
      tone: 'high',
    });
  }

  // ── Section 6: Cash Flow Alerts ──
  const cashFlowAlerts: BriefingSectionItem[] = [];

  if (ctx.cashFlow.currentBalance <= 0) {
    cashFlowAlerts.push({
      id: 'cash-zero',
      title: 'Cash position is zero or negative',
      detail: 'Operating expenses cannot be met from current cash.',
      whyItMatters: 'This is a critical situation — the business cannot pay its bills.',
      recommendedAction: 'Arrange a working capital facility or accelerate collections immediately.',
      evidenceId: ctx.cashFlow.evidence.id,
      tone: 'critical',
    });
  } else if (isFinite(ctx.cashFlow.runwayMonths) && ctx.cashFlow.runwayMonths < 3) {
    cashFlowAlerts.push({
      id: 'cash-short-runway',
      title: `Runway is only ${ctx.cashFlow.runwayMonths.toFixed(1)} months`,
      detail: `At the current burn rate, cash will run out in ${ctx.cashFlow.runwayMonths.toFixed(1)} months.`,
      whyItMatters: 'Less than 3 months of runway is a critical risk indicator.',
      recommendedAction: 'Reduce expenses or accelerate collections to extend runway.',
      evidenceId: ctx.cashFlow.evidence.id,
      tone: 'critical',
    });
  } else if (isFinite(ctx.cashFlow.runwayMonths) && ctx.cashFlow.runwayMonths < 6) {
    cashFlowAlerts.push({
      id: 'cash-medium-runway',
      title: `Runway is ${ctx.cashFlow.runwayMonths.toFixed(1)} months`,
      detail: 'Less than 6 months of runway warrants attention.',
      whyItMatters: 'Plan funding or revenue acceleration before runway drops below 3 months.',
      recommendedAction: 'Review the cash flow forecast and plan accordingly.',
      evidenceId: ctx.cashFlow.evidence.id,
      tone: 'medium',
    });
  }

  if (ctx.cashFlow.isEstimatedFromPaymentFlow) {
    cashFlowAlerts.push({
      id: 'cash-estimated',
      title: 'Cash is estimated from payment flow, not bank balances',
      detail: 'Banking is not connected. Cash position is computed from payments received minus payments made.',
      whyItMatters: 'This estimate may differ from the actual bank balance.',
      recommendedAction: 'Connect a bank account for accurate cash tracking.',
      actionView: '/dashboard?view=banking',
      evidenceId: ctx.cashFlow.evidence.id,
      tone: 'low',
    });
  }

  if (ctx.cashFlow.net < 0) {
    cashFlowAlerts.push({
      id: 'cash-negative-flow',
      title: `Net cash flow is negative (${inr(ctx.cashFlow.net)})`,
      detail: `Outflows exceed inflows this period.`,
      whyItMatters: 'Sustained negative cash flow will deplete reserves.',
      recommendedAction: 'Identify the largest outflows and review if any can be deferred.',
      amount: ctx.cashFlow.net,
      evidenceId: ctx.cashFlow.evidence.id,
      tone: 'high',
    });
  }

  // ── Section 7: Important Customer Events ──
  const customerEvents: BriefingSectionItem[] = [];

  // Top customer concentration warning
  if (ctx.customers.concentrationTop1 > 0.35) {
    customerEvents.push({
      id: 'cust-concentration',
      title: `Top customer is ${(ctx.customers.concentrationTop1 * 100).toFixed(0)}% of revenue`,
      detail: ctx.customers.topCustomers[0]?.name ?? 'Your top customer',
      whyItMatters: 'High concentration creates dependency risk.',
      recommendedAction: 'Diversify the customer base or negotiate shorter payment terms.',
      evidenceId: 'invoices-fy',
      tone: 'medium',
    });
  }

  // New customers this month
  // (deterministic check — no extra DB call; uses snapshot.customerCount)
  if (ctx.customers.totalCustomers > 0) {
    customerEvents.push({
      id: 'cust-total',
      title: `${ctx.customers.totalCustomers} active customers`,
      detail: `${ctx.customers.overdueCustomerCount} have overdue balances.`,
      whyItMatters: ctx.customers.overdueCustomerCount > 0
        ? 'Overdue customers need attention.'
        : 'All customers are in good standing.',
      recommendedAction: ctx.customers.overdueCustomerCount > 0
        ? 'Review the overdue customer list.'
        : 'Continue nurturing customer relationships.',
      actionView: '/dashboard?view=customers',
      evidenceId: 'invoices-fy',
      tone: ctx.customers.overdueCustomerCount > 0 ? 'medium' : 'positive',
    });
  }

  // ── Section 8: Pending Actions ──
  // Deterministic — checks for items that need user approval.
  const pendingActions: BriefingSectionItem[] = [];

  if (ctx.integrations.integrations.some(i => i.connectionState === 'expired')) {
    const expired = ctx.integrations.integrations.filter(i => i.connectionState === 'expired');
    pendingActions.push({
      id: 'pending-reconnect',
      title: `Reconnect ${expired.map(e => e.label).join(', ')}`,
      detail: 'Token has expired. Reconnect to restore data sync.',
      whyItMatters: 'Expired integrations mean Oracle cannot reason over that data source.',
      recommendedAction: 'Visit Settings → Integrations to reconnect.',
      actionView: '/dashboard?view=integrations',
      tone: 'high',
    });
  }

  if (ctx.banking.isSandbox) {
    pendingActions.push({
      id: 'pending-banking-live',
      title: 'Connect a live bank account',
      detail: 'Banking is currently in sandbox mode. Live banking requires Setu AA consent.',
      whyItMatters: 'Sandbox data is for development only — do not treat as live financial truth.',
      recommendedAction: 'When ready, initiate the Setu AA consent flow.',
      actionView: '/dashboard?view=banking',
      tone: 'low',
    });
  }

  // Stale integrations
  const stale = ctx.integrations.integrations.filter(i => i.environment === 'STALE' && i.connected);
  for (const s of stale) {
    pendingActions.push({
      id: `pending-sync-${s.provider}`,
      title: `Refresh ${s.label} data`,
      detail: s.statusMessage,
      whyItMatters: 'Stale data may not reflect the current state.',
      recommendedAction: `Trigger a sync for ${s.label}.`,
      actionView: '/dashboard?view=integrations',
      tone: 'medium',
    });
  }

  return {
    computedAt,
    organizationId: ctx.organizationId,
    isDemoWorkspace: ctx.isDemoWorkspace,
    financialStatus,
    topRisks,
    topOpportunities,
    collectionsToChase,
    gstActions,
    cashFlowAlerts,
    customerEvents,
    pendingActions,
    anomalies: anomalies.map(a => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      hasSufficientData: a.hasSufficientData,
    })),
    integrationsSummary: ctx.integrations.integrations.map(i => ({
      label: i.label,
      connected: i.connected,
      environment: i.environment,
      statusMessage: i.statusMessage,
    })),
  };
}

function buildHeadline(ctx: UnifiedOracleContext): string {
  const parts: string[] = [];
  if (ctx.revenue.invoicedRevenue > 0) {
    parts.push(`Revenue ${inr(ctx.revenue.invoicedRevenue)}`);
  }
  if (ctx.cashFlow.currentBalance > 0) {
    parts.push(`Cash ${inr(ctx.cashFlow.currentBalance)}`);
  }
  if (ctx.revenue.overdueReceivables > 0) {
    parts.push(`${inr(ctx.revenue.overdueReceivables)} overdue`);
  }
  if (ctx.gst.liability > 0) {
    parts.push(`GST liability ${inr(ctx.gst.liability)}`);
  }
  if (parts.length === 0) {
    return ctx.isDemoWorkspace
      ? 'Welcome to VEYRO. Add invoices, customers, or connect integrations to see your business status here.'
      : 'No business data yet. Once you add invoices or connect integrations, your daily briefing will appear here.';
  }
  const trend = ctx.revenue.trend.direction !== 'flat'
    ? ` (${pct(ctx.revenue.trend.changePct)} MoM)`
    : '';
  return `Health ${ctx.health.score}/100 · ${parts.join(' · ')}${trend}`;
}

function emptyBriefing(orgId: string): ExecutiveBriefing {
  return {
    computedAt: new Date().toISOString(),
    organizationId: orgId,
    isDemoWorkspace: true,
    financialStatus: {
      headline: 'No business data yet. Add invoices or connect integrations to see your briefing.',
      revenue: 0, cash: 0, receivables: 0, overdueReceivables: 0, gstLiability: 0,
      healthScore: 0, healthLabel: 'Critical',
      revenueTrend: 'flat', revenueChangePct: null, evidenceId: '',
    },
    topRisks: [],
    topOpportunities: [],
    collectionsToChase: [],
    gstActions: [],
    cashFlowAlerts: [],
    customerEvents: [],
    pendingActions: [],
    anomalies: [],
    integrationsSummary: [],
  };
}
