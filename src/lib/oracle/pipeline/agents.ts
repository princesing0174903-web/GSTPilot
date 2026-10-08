// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Multi-Agent Reasoning Engine (PROMPT 5)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Before generating a response, Oracle internally creates specialist agents.
// Each agent investigates INDEPENDENTLY and produces a finding grounded in
// real data. The user NEVER sees this internal reasoning — only the merged
// executive narrative.
//
// Agents:
//   • CFO Agent           — overall financial health, runway, profitability
//   • GST Agent           — tax liability, ITC, filing status, mismatches
//   • Risk Agent          — concentration, liquidity, compliance exposure
//   • Business Analyst    — revenue trends, customer mix, growth signals
//   • Collections Agent   — receivables, overdue, collection rate
//   • Forecast Agent      — revenue/cash projections, confidence
//   • Compliance Agent    — deadlines, notices, statutory exposure
//
// All agents run in PARALLEL (Promise.all). Each returns findings that feed
// the LLM system prompt + the structured UI render.
// ═══════════════════════════════════════════════════════════════════════════════

import 'server-only';
import type { AgentFinding, AgentId, AgentReport, IntentId } from './types';
import type { BusinessSnapshot } from '@/lib/business/snapshot';
import { inr, pct } from './tools';

/** Inputs each agent receives. */
interface AgentInput {
  snapshot: BusinessSnapshot | null;
  intent: IntentId;
}

type Agent = (inp: AgentInput) => AgentFinding[];

// ─── CFO Agent ─────────────────────────────────────────────────────────────────

const cfoAgent: Agent = ({ snapshot }) => {
  const findings: AgentFinding[] = [];
  if (!snapshot) return findings;

  // Overall health.
  findings.push({
    agent: 'cfo',
    headline: `Business health at ${snapshot.healthScore}/100 (${snapshot.healthScoreLabel})`,
    analysis: snapshot.healthScore >= 70
      ? `The business is financially sound with a health score of ${snapshot.healthScore}/100. Profitability is strong at ${pct(snapshot.profitMargin)} margin and cash position is ${inr(snapshot.cash)}.`
      : snapshot.healthScore >= 50
        ? `The business is in fair condition (${snapshot.healthScore}/100). Profitability of ${pct(snapshot.profitMargin)} is acceptable but liquidity or collections need attention.`
        : `Business health is concerning at ${snapshot.healthScore}/100. Immediate action required on liquidity and collections.`,
    severity: snapshot.healthScore >= 70 ? 'info' : snapshot.healthScore >= 50 ? 'watch' : 'critical',
    confidence: 100,
    evidence: [`health score ${snapshot.healthScore}`, `profit margin ${pct(snapshot.profitMargin)}`, `cash ${inr(snapshot.cash)}`],
  });

  // Runway.
  if (isFinite(snapshot.runwayDays) && snapshot.runwayDays < 60) {
    findings.push({
      agent: 'cfo',
      headline: `Cash runway at ${snapshot.runwayDays} days — ${snapshot.runwayDays < 30 ? 'CRITICAL' : 'watch closely'}`,
      analysis: `At current burn rate, cash lasts ${snapshot.runwayDays} days. ${snapshot.runwayDays < 30 ? 'This is critical — immediate collections or funding action required.' : 'Monitor closely and accelerate collections.'}`,
      severity: snapshot.runwayDays < 30 ? 'critical' : 'warn',
      confidence: 90,
      evidence: [`cash ${inr(snapshot.cash)}`, `runway ${snapshot.runwayDays}d`, `net cash flow ${inr(snapshot.netCashFlow)}`],
    });
  }

  // Profitability.
  if (snapshot.profitMargin < 0.1 && snapshot.revenue > 0) {
    findings.push({
      agent: 'cfo',
      headline: `Margin compression — net margin only ${pct(snapshot.profitMargin)}`,
      analysis: `Profit margin of ${pct(snapshot.profitMargin)} is below healthy thresholds (typically >15% for services). Expenses at ${inr(snapshot.expenses)} are eating into revenue of ${inr(snapshot.revenue)}.`,
      severity: 'warn',
      confidence: 100,
      evidence: [`revenue ${inr(snapshot.revenue)}`, `expenses ${inr(snapshot.expenses)}`, `margin ${pct(snapshot.profitMargin)}`],
    });
  }

  return findings;
};

// ─── GST Agent ─────────────────────────────────────────────────────────────────

const gstAgent: Agent = ({ snapshot }) => {
  const findings: AgentFinding[] = [];
  if (!snapshot) return findings;

  // GST liability.
  if (snapshot.gstLiability > 0) {
    findings.push({
      agent: 'gst',
      headline: `Net GST payable ${inr(snapshot.gstLiability)}`,
      analysis: `Output tax ${inr(snapshot.outputTax)} minus ITC ${inr(snapshot.inputTax)} = net liability ${inr(snapshot.gstLiability)}. ${snapshot.overdueReturns > 0 ? `${snapshot.overdueReturns} returns are OVERDUE — penalties accruing.` : 'File on time to avoid penalties.'}`,
      severity: snapshot.overdueReturns > 0 ? 'critical' : 'watch',
      confidence: 100,
      evidence: [`output tax ${inr(snapshot.outputTax)}`, `ITC ${inr(snapshot.inputTax)}`, `liability ${inr(snapshot.gstLiability)}`, `${snapshot.overdueReturns} overdue`],
    });
  }

  // Overdue returns.
  if (snapshot.overdueReturns > 0) {
    findings.push({
      agent: 'gst',
      headline: `${snapshot.overdueReturns} GST return${snapshot.overdueReturns > 1 ? 's' : ''} OVERDUE`,
      analysis: `Overdue GST returns trigger late fees (₹50-200/day) and notice risk. File immediately to stop penalty accrual.`,
      severity: 'critical',
      confidence: 100,
      evidence: [`${snapshot.overdueReturns} overdue returns`, `pending ${snapshot.pendingReturns}`],
    });
  }

  // ITC health.
  if (snapshot.inputTax > 0 && snapshot.outputTax > 0) {
    const itcRatio = snapshot.inputTax / snapshot.outputTax;
    if (itcRatio < 0.3) {
      findings.push({
        agent: 'gst',
        headline: `Low ITC utilization (${pct(itcRatio)} of output tax)`,
        analysis: `Only ${pct(itcRatio)} of output tax is offset by ITC. Review vendor invoices — you may be missing legitimate ITC claims.`,
        severity: 'watch',
        confidence: 95,
        evidence: [`output ${inr(snapshot.outputTax)}`, `ITC ${inr(snapshot.inputTax)}`, `ratio ${pct(itcRatio)}`],
      });
    }
  }

  return findings;
};

// ─── Risk Agent ────────────────────────────────────────────────────────────────

const riskAgent: Agent = ({ snapshot }) => {
  const findings: AgentFinding[] = [];
  if (!snapshot) return findings;

  // Customer concentration.
  if (snapshot.topCustomerShare > 0.3) {
    findings.push({
      agent: 'risk',
      headline: `Customer concentration risk — top customer = ${pct(snapshot.topCustomerShare)}`,
      analysis: `A single customer contributes ${pct(snapshot.topCustomerShare)} of revenue. Losing this client would cut revenue by ${pct(snapshot.topCustomerShare)}. Diversify immediately.`,
      severity: snapshot.topCustomerShare > 0.5 ? 'critical' : 'warn',
      confidence: 100,
      evidence: [`top customer ${pct(snapshot.topCustomerShare)}`, `${snapshot.customerCount} total customers`],
    });
  }

  // Liquidity risk.
  if (snapshot.cash < snapshot.expenses / 12 && snapshot.expenses > 0) {
    findings.push({
      agent: 'risk',
      headline: `Liquidity risk — cash below one month of expenses`,
      analysis: `Cash of ${inr(snapshot.cash)} is less than a month of expenses (${inr(snapshot.expenses / 12)}). Without collections this month, operations are at risk.`,
      severity: 'critical',
      confidence: 95,
      evidence: [`cash ${inr(snapshot.cash)}`, `monthly expenses ~${inr(snapshot.expenses / 12)}`],
    });
  }

  // Receivables aging.
  if (snapshot.overdueReceivables > snapshot.receivables * 0.5 && snapshot.receivables > 0) {
    findings.push({
      agent: 'risk',
      headline: `Aging receivables — ${pct(snapshot.overdueReceivables / snapshot.receivables)} overdue`,
      analysis: `More than half of receivables (${inr(snapshot.overdueReceivables)} of ${inr(snapshot.receivables)}) are overdue. Collection process needs immediate escalation.`,
      severity: 'warn',
      confidence: 100,
      evidence: [`overdue ${inr(snapshot.overdueReceivables)}`, `total receivables ${inr(snapshot.receivables)}`, `${snapshot.overdueInvoiceCount} overdue invoices`],
    });
  }

  // Compliance exposure.
  if (snapshot.overdueReturns > 0) {
    findings.push({
      agent: 'risk',
      headline: `Compliance exposure — ${snapshot.overdueReturns} overdue GST returns`,
      analysis: `Overdue filings expose the business to late fees (₹50-200/day per return) and potential notices. Estimated daily penalty exposure: ₹${snapshot.overdueReturns * 100}.`,
      severity: 'critical',
      confidence: 100,
      evidence: [`${snapshot.overdueReturns} overdue returns`, `risk score ${snapshot.riskScore}/100`],
    });
  }

  return findings;
};

// ─── Business Analyst ──────────────────────────────────────────────────────────

const analystAgent: Agent = ({ snapshot }) => {
  const findings: AgentFinding[] = [];
  if (!snapshot) return findings;

  // Revenue momentum.
  const growth = snapshot.revenueLastMonth > 0
    ? (snapshot.revenueThisMonth - snapshot.revenueLastMonth) / snapshot.revenueLastMonth
    : 0;
  if (Math.abs(growth) > 0.05) {
    findings.push({
      agent: 'analyst',
      headline: `Revenue ${growth > 0 ? 'up' : 'down'} ${pct(Math.abs(growth))} MoM`,
      analysis: growth > 0
        ? `Revenue grew from ${inr(snapshot.revenueLastMonth)} to ${inr(snapshot.revenueThisMonth)} (${pct(growth)}). ${growth > 0.2 ? 'Strong momentum — consider scaling sales capacity.' : 'Moderate growth — sustain the trend.'}`
        : `Revenue dropped from ${inr(snapshot.revenueLastMonth)} to ${inr(snapshot.revenueThisMonth)} (${pct(growth)}). ${growth < -0.2 ? 'Significant decline — investigate pipeline immediately.' : 'Minor dip — monitor next month.'}`,
      severity: growth > 0.05 ? 'info' : growth < -0.2 ? 'critical' : 'watch',
      confidence: 95,
      evidence: [`this month ${inr(snapshot.revenueThisMonth)}`, `last month ${inr(snapshot.revenueLastMonth)}`, `${growth >= 0 ? '+' : ''}${pct(growth)} MoM`],
    });
  }

  // Customer base.
  if (snapshot.customerCount > 0) {
    findings.push({
      agent: 'analyst',
      headline: `${snapshot.customerCount} active customers · ${snapshot.invoiceCount} invoices`,
      analysis: `Average revenue per customer is ${inr(snapshot.revenue / Math.max(1, snapshot.customerCount))} across ${snapshot.invoiceCount} invoices. ${snapshot.customerCount < 5 ? 'Customer base is thin — diversification needed.' : 'Customer base is adequate.'}`,
      severity: snapshot.customerCount < 5 ? 'warn' : 'info',
      confidence: 100,
      evidence: [`${snapshot.customerCount} customers`, `${snapshot.invoiceCount} invoices`, `ARPU ${inr(snapshot.revenue / Math.max(1, snapshot.customerCount))}`],
    });
  }

  // Expense ratio.
  if (snapshot.revenue > 0 && snapshot.expenses > 0) {
    const expenseRatio = snapshot.expenses / snapshot.revenue;
    if (expenseRatio > 0.8) {
      findings.push({
        agent: 'analyst',
        headline: `Expense ratio high at ${pct(expenseRatio)} of revenue`,
        analysis: `Expenses consume ${pct(expenseRatio)} of revenue. Industry healthy benchmark is <70%. Identify top expense categories and cut 10-15%.`,
        severity: 'warn',
        confidence: 100,
        evidence: [`expenses ${inr(snapshot.expenses)}`, `revenue ${inr(snapshot.revenue)}`, `ratio ${pct(expenseRatio)}`],
      });
    }
  }

  return findings;
};

// ─── Collections Agent ─────────────────────────────────────────────────────────

const collectionsAgent: Agent = ({ snapshot }) => {
  const findings: AgentFinding[] = [];
  if (!snapshot) return findings;

  // Collection rate.
  if (snapshot.collectionRate < 0.7 && snapshot.revenue > 0) {
    findings.push({
      agent: 'collections',
      headline: `Collection rate low at ${pct(snapshot.collectionRate)}`,
      analysis: `Only ${pct(snapshot.collectionRate)} of billed revenue has been collected. ${snapshot.overdueInvoiceCount} invoices are overdue worth ${inr(snapshot.overdueReceivables)}. Industry benchmark is >85%.`,
      severity: snapshot.collectionRate < 0.4 ? 'critical' : 'warn',
      confidence: 100,
      evidence: [`collection rate ${pct(snapshot.collectionRate)}`, `${snapshot.overdueInvoiceCount} overdue`, `overdue ${inr(snapshot.overdueReceivables)}`, `avg ${snapshot.avgDaysToPay}d to pay`],
    });
  }

  // Days to pay.
  if (snapshot.avgDaysToPay > 45) {
    findings.push({
      agent: 'collections',
      headline: `Slow payments — avg ${snapshot.avgDaysToPay} days to pay`,
      analysis: `Customers take ${snapshot.avgDaysToPay} days on average to pay. Standard terms are 30 days. Tighten payment terms and send reminders earlier.`,
      severity: 'warn',
      confidence: 95,
      evidence: [`avg ${snapshot.avgDaysToPay}d`, `industry benchmark 30d`],
    });
  }

  // Overdue concentration.
  if (snapshot.overdueReceivables > 0) {
    findings.push({
      agent: 'collections',
      headline: `${inr(snapshot.overdueReceivables)} in overdue receivables`,
      analysis: `${snapshot.overdueInvoiceCount} invoices totalling ${inr(snapshot.overdueReceivables)} are overdue. Generate payment links and send reminders today.`,
      severity: snapshot.overdueReceivables > snapshot.revenue * 0.3 ? 'critical' : 'warn',
      confidence: 100,
      evidence: [`${inr(snapshot.overdueReceivables)} overdue`, `${snapshot.overdueInvoiceCount} invoices`],
    });
  }

  return findings;
};

// ─── Forecast Agent ────────────────────────────────────────────────────────────

const forecastAgent: Agent = ({ snapshot }) => {
  const findings: AgentFinding[] = [];
  if (!snapshot) return findings;

  const f = snapshot.forecast;
  findings.push({
    agent: 'forecast',
    headline: `Next month forecast: ${inr(f.nextMonthRevenue)} revenue (${f.trend})`,
    analysis: `Based on ${snapshot.invoiceCount} historical invoices, next month revenue is projected at ${inr(f.nextMonthRevenue)} with ${pct(f.confidence)} confidence. Trend is ${f.trend}. ${f.trend === 'down' ? 'Mitigation: accelerate pipeline and collections.' : f.trend === 'up' ? 'Capitalize on momentum — ensure delivery capacity.' : 'Stable — maintain current pace.'}`,
    severity: f.trend === 'down' ? 'warn' : 'info',
    confidence: Math.round(f.confidence * 100),
    evidence: [`forecast ${inr(f.nextMonthRevenue)}`, `trend ${f.trend}`, `confidence ${pct(f.confidence)}`, `${snapshot.invoiceCount} historical records`],
  });

  // Cash flow forecast.
  if (isFinite(snapshot.runwayDays) && snapshot.runwayDays < 90) {
    findings.push({
      agent: 'forecast',
      headline: `Cash flow forecast — ${snapshot.runwayDays} days of runway`,
      analysis: `At current net cash flow of ${inr(snapshot.netCashFlow)}, cash reserves of ${inr(snapshot.cash)} will last ${snapshot.runwayDays} days. ${snapshot.runwayDays < 30 ? 'CRITICAL: secure collections or credit line within 2 weeks.' : 'Plan a collection drive this month.'}`,
      severity: snapshot.runwayDays < 30 ? 'critical' : 'warn',
      confidence: 85,
      evidence: [`cash ${inr(snapshot.cash)}`, `net flow ${inr(snapshot.netCashFlow)}`, `runway ${snapshot.runwayDays}d`],
    });
  }

  return findings;
};

// ─── Compliance Agent ──────────────────────────────────────────────────────────

const complianceAgent: Agent = ({ snapshot }) => {
  const findings: AgentFinding[] = [];
  if (!snapshot) return findings;

  // Filing status.
  if (snapshot.pendingReturns > 0) {
    findings.push({
      agent: 'compliance',
      headline: `${snapshot.pendingReturns} GST return${snapshot.pendingReturns > 1 ? 's' : ''} pending${snapshot.overdueReturns > 0 ? ` (${snapshot.overdueReturns} OVERDUE)` : ''}`,
      analysis: `${snapshot.filedReturns} returns filed, ${snapshot.pendingReturns} pending. ${snapshot.overdueReturns > 0 ? `${snapshot.overdueReturns} are overdue — file immediately to avoid ₹${snapshot.overdueReturns * 100}/day penalty.` : 'File before the 11th (GSTR-1) and 20th (GSTR-3B) to stay compliant.'}`,
      severity: snapshot.overdueReturns > 0 ? 'critical' : 'watch',
      confidence: 100,
      evidence: [`${snapshot.filedReturns} filed`, `${snapshot.pendingReturns} pending`, `${snapshot.overdueReturns} overdue`],
    });
  }

  // Risk score.
  if (snapshot.riskScore >= 60) {
    findings.push({
      agent: 'compliance',
      headline: `Elevated compliance risk — score ${snapshot.riskScore}/100`,
      analysis: `The composite risk score of ${snapshot.riskScore}/100 indicates significant compliance exposure. Primary drivers: ${snapshot.overdueReturns > 0 ? 'overdue returns' : 'filing gaps'} and ${snapshot.overdueReceivables > 0 ? 'unmanaged receivables' : 'thin liquidity'}.`,
      severity: 'warn',
      confidence: 90,
      evidence: [`risk ${snapshot.riskScore}/100`, `${snapshot.overdueReturns} overdue returns`],
    });
  }

  return findings;
};

// ─── Agent registry ────────────────────────────────────────────────────────────

const AGENTS: Record<AgentId, Agent> = {
  cfo: cfoAgent,
  gst: gstAgent,
  risk: riskAgent,
  analyst: analystAgent,
  collections: collectionsAgent,
  forecast: forecastAgent,
  compliance: complianceAgent,
};

/** Select which agents to run based on intent. */
function selectAgents(intent: IntentId): AgentId[] {
  switch (intent) {
    case 'business_overview':
    case 'risk':
    case 'report':
      return ['cfo', 'gst', 'risk', 'analyst', 'collections', 'forecast', 'compliance'];
    case 'gst':
    case 'compliance':
      return ['gst', 'compliance', 'cfo', 'risk'];
    case 'cash':
    case 'banking':
      return ['cfo', 'forecast', 'collections', 'risk'];
    case 'revenue':
    case 'forecast':
      return ['analyst', 'forecast', 'cfo'];
    case 'customers':
      return ['risk', 'analyst', 'collections'];
    case 'collections':
      return ['collections', 'cfo', 'risk'];
    case 'expenses':
    case 'profit':
      return ['cfo', 'analyst', 'risk'];
    case 'invoices':
      return ['analyst', 'collections'];
    default:
      return ['cfo', 'analyst'];
  }
}

/**
 * Run all relevant specialist agents in PARALLEL and merge their findings.
 * The user NEVER sees the individual agent outputs — only the merged executive
 * narrative that the LLM writes over these findings.
 */
export async function runAgents(
  snapshot: BusinessSnapshot | null,
  intent: IntentId,
): Promise<AgentReport> {
  const selected = selectAgents(intent);

  // Run each agent. (All are synchronous — Promise.all keeps the pattern uniform
  // and lets us add async data fetches per agent later without refactoring.)
  const results = await Promise.all(
    selected.map((id) => {
      try {
        return Promise.resolve(AGENTS[id]({ snapshot, intent }));
      } catch {
        return Promise.resolve([]);
      }
    })
  );

  const findings = results.flat();

  // Sort by severity (critical first), then by confidence (high first).
  const severityRank: Record<string, number> = { critical: 0, warn: 1, watch: 2, info: 3 };
  findings.sort((a, b) => {
    const s = (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9);
    if (s !== 0) return s;
    return b.confidence - a.confidence;
  });

  // Build the executive synthesis — a single paragraph the LLM uses as the
  // spine of its narrative. This is INTERNAL context, not user-facing text.
  const critical = findings.filter((f) => f.severity === 'critical');
  const warns = findings.filter((f) => f.severity === 'warn');
  const positive = findings.filter((f) => f.severity === 'info' && f.confidence >= 90);
  const parts: string[] = [];
  if (critical.length > 0) {
    parts.push(`CRITICAL: ${critical.map((f) => f.headline).join('; ')}.`);
  }
  if (warns.length > 0) {
    parts.push(`WATCH: ${warns.map((f) => f.headline).join('; ')}.`);
  }
  if (positive.length > 0) {
    parts.push(`STRENGTHS: ${positive.map((f) => f.headline).join('; ')}.`);
  }
  if (parts.length === 0) {
    parts.push('No material findings — business is operating within normal parameters.');
  }
  const synthesis = parts.join(' ');

  return { findings, synthesis };
}
