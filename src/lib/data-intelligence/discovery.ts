// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Data Intelligence Cloud™
// Subsystem 7: AI Data Discovery™ — auto-detect patterns from REAL data.
// Scans production records and writes DataDiscoveryInsight rows for each
// detected pattern (revenue trend, cost anomaly, cashflow risk, customer
// segments, tax optimization, growth opportunities, churn, bottlenecks).
// ═══════════════════════════════════════════════════════════════════════════════

import {
  db,
  safeFindMany,
  safeCount,
  safeAggregate,
  countBy,
  parseJson,
} from './helpers';
import type {
  DataDiscoveryInsight,
  DiscoveryType,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SCAN = 10_000;

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function monthKey(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.substring(0, 7); // YYYY-MM
}

function confidenceFor(count: number): number {
  if (count >= 100) return 0.95;
  if (count >= 20) return 0.85;
  if (count >= 5) return 0.75;
  if (count >= 1) return 0.65;
  return 0.6;
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

interface InsightInput {
  discoveryType: DiscoveryType;
  title: string;
  description: string;
  datasetKeys: string[];
  confidence: number;
  impactMagnitude: number;
  impactDirection: 'positive' | 'negative' | 'neutral';
  evidence: string[];
  recommendedAction: string;
}

/** Delete prior insights of same type+title then create a fresh one. */
async function persistInsight(
  input: InsightInput,
): Promise<DataDiscoveryInsight | null> {
  try {
    await db.dataDiscoveryInsight.deleteMany({
      where: { discoveryType: input.discoveryType, title: input.title },
    });
    const row = await db.dataDiscoveryInsight.create({
      data: {
        discoveryType: input.discoveryType,
        title: input.title,
        description: input.description,
        datasetKeys: JSON.stringify(input.datasetKeys),
        confidence: input.confidence,
        impactMagnitude: input.impactMagnitude,
        impactDirection: input.impactDirection,
        evidence: JSON.stringify(input.evidence),
        recommendedAction: input.recommendedAction,
        status: 'new',
      },
    });
    return mapInsight(row);
  } catch {
    return null;
  }
}

interface PrismaInsightRow {
  id: string;
  discoveryType: string;
  title: string;
  description: string;
  datasetKeys: string;
  confidence: number;
  impactMagnitude: number;
  impactDirection: string;
  evidence: string;
  recommendedAction: string | null;
  status: string;
  detectedAt: Date;
  createdAt: Date;
}

function mapInsight(row: PrismaInsightRow): DataDiscoveryInsight {
  return {
    id: row.id,
    discoveryType: row.discoveryType as DiscoveryType,
    title: row.title,
    description: row.description,
    datasetKeys: parseJson<string[]>(row.datasetKeys, []),
    confidence: row.confidence,
    impactMagnitude: row.impactMagnitude,
    impactDirection: row.impactDirection as
      | 'positive'
      | 'negative'
      | 'neutral',
    evidence: parseJson<string[]>(row.evidence, []),
    recommendedAction: row.recommendedAction,
    status: row.status as
      | 'new'
      | 'acknowledged'
      | 'acted_on'
      | 'dismissed',
    detectedAt: row.detectedAt.toISOString(),
  };
}

// ─── Detectors ───────────────────────────────────────────────────────────────

/** revenue_trend: sum invoice amounts by month for last 6 months; if up/down >10%, flag. */
async function detectRevenueTrend(): Promise<InsightInput | null> {
  const cutoff = daysAgoISO(180);
  const invoices = await safeFindMany(() =>
    db.invoice.findMany({
      where: { invoiceDate: { gte: cutoff } },
      select: { invoiceDate: true, totalAmount: true },
      take: MAX_SCAN,
    }),
  );
  if (invoices.length === 0) return null;

  const monthlyTotals = new Map<string, number>();
  for (const inv of invoices) {
    const mk = monthKey(inv.invoiceDate);
    if (!mk) continue;
    monthlyTotals.set(mk, (monthlyTotals.get(mk) ?? 0) + inv.totalAmount);
  }
  const months = Array.from(monthlyTotals.keys()).sort();
  if (months.length < 2) return null;

  const firstHalf = months.slice(0, Math.ceil(months.length / 2));
  const secondHalf = months.slice(Math.floor(months.length / 2));
  const firstSum = firstHalf.reduce(
    (acc, m) => acc + (monthlyTotals.get(m) ?? 0),
    0,
  );
  const lastSum = secondHalf.reduce(
    (acc, m) => acc + (monthlyTotals.get(m) ?? 0),
    0,
  );
  if (firstSum <= 0) return null;

  const changePct = (lastSum - firstSum) / firstSum;
  if (Math.abs(changePct) <= 0.1) return null;

  const direction: 'positive' | 'negative' =
    changePct > 0 ? 'positive' : 'negative';
  const trendWord = changePct > 0 ? 'up' : 'down';
  const pctLabel = `${(Math.abs(changePct) * 100).toFixed(1)}%`;

  return {
    discoveryType: 'revenue_trend',
    title: `Revenue trend: ${trendWord} ${pctLabel} over last 6 months`,
    description: `Cumulative invoiced revenue moved from ${formatINR(
      firstSum,
    )} (first half) to ${formatINR(lastSum)} (second half) across ${months.length} active months.`,
    datasetKeys: ['invoice'],
    confidence: confidenceFor(invoices.length),
    impactMagnitude: lastSum,
    impactDirection: direction,
    evidence: [
      `Active months analyzed: ${months.join(', ')}`,
      `First-half total: ${formatINR(firstSum)}`,
      `Second-half total: ${formatINR(lastSum)}`,
      `Change: ${pctLabel} ${trendWord}`,
      `Invoices analyzed: ${invoices.length}`,
    ],
    recommendedAction:
      direction === 'positive'
        ? 'Sustain growth drivers — review which client segments contributed most and replicate the playbook.'
        : 'Investigate revenue decline — audit top-revenue clients for churn, delay, or pricing pressure and trigger recovery actions.',
  };
}

/** cost_anomaly: flag any single payment > 3x average payment amount. */
async function detectCostAnomaly(): Promise<InsightInput | null> {
  const payments = await safeFindMany(() =>
    db.payment.findMany({
      select: { id: true, partyName: true, amount: true, paymentDate: true, paymentMode: true },
      take: MAX_SCAN,
    }),
  );
  if (payments.length < 3) return null;

  const total = payments.reduce((acc, p) => acc + p.amount, 0);
  const avg = total / payments.length;
  if (avg <= 0) return null;

  const threshold = 3 * avg;
  const anomalies = payments.filter((p) => p.amount > threshold);
  if (anomalies.length === 0) return null;

  const anomalyMagnitude = anomalies.reduce((acc, p) => acc + p.amount, 0);

  return {
    discoveryType: 'cost_anomaly',
    title: `Cost anomaly: ${anomalies.length} payment(s) exceed 3× average`,
    description: `${anomalies.length} payment(s) exceed 3× the average payment amount of ${formatINR(
      avg,
    )}. Combined anomaly value: ${formatINR(anomalyMagnitude)}.`,
    datasetKeys: ['payment'],
    confidence: confidenceFor(payments.length),
    impactMagnitude: anomalyMagnitude,
    impactDirection: 'negative',
    evidence: anomalies.slice(0, 10).map((p) => {
      const overshoot = ((p.amount / avg - 1) * 100).toFixed(0);
      return `${p.partyName} — ${formatINR(p.amount)} on ${p.paymentDate} via ${p.paymentMode} (${overshoot}% above average)`;
    }),
    recommendedAction:
      'Audit each anomalous payment for legitimacy, vendor verification, and approval workflow compliance. Flag for CFO review.',
  };
}

/** cashflow_risk: outstanding receivables > 2x current cash. */
async function detectCashflowRisk(): Promise<InsightInput | null> {
  const unpaidInvoices = await safeFindMany(() =>
    db.invoice.findMany({
      where: { OR: [{ paymentStatus: { not: 'paid' } }, { status: { not: 'paid' } }] },
      select: { balanceAmount: true, totalAmount: true, paymentStatus: true, status: true },
      take: MAX_SCAN,
    }),
  );
  const receivables = unpaidInvoices.reduce(
    (acc, inv) => acc + (inv.balanceAmount > 0 ? inv.balanceAmount : inv.totalAmount),
    0,
  );

  const cashAgg = await safeAggregate(() =>
    db.payment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    }),
  );
  const cash = cashAgg?._sum?.amount ?? 0;

  if (cash <= 0 || receivables <= 0) return null;
  if (receivables <= 2 * cash) return null;

  return {
    discoveryType: 'cashflow_risk',
    title: `Cashflow risk: receivables ${(
      receivables / cash
    ).toFixed(1)}× current cash position`,
    description: `Outstanding receivables of ${formatINR(
      receivables,
    )} exceed 2× current cash (${formatINR(cash)}), creating liquidity risk if collections slip.`,
    datasetKeys: ['invoice', 'payment'],
    confidence: confidenceFor(unpaidInvoices.length),
    impactMagnitude: receivables,
    impactDirection: 'negative',
    evidence: [
      `Outstanding receivables: ${formatINR(receivables)} (${unpaidInvoices.length} unpaid invoices)`,
      `Current cash position: ${formatINR(cash)}`,
      `Receivables-to-cash ratio: ${(receivables / cash).toFixed(2)}×`,
    ],
    recommendedAction:
      'Accelerate collections — prioritize top unpaid invoices, offer early-payment discounts, and consider short-term working capital facility.',
  };
}

/** customer_segment: group clients by state, report top 3 segments. */
async function detectCustomerSegment(): Promise<InsightInput | null> {
  const clients = await safeFindMany(() =>
    db.client.findMany({
      select: { id: true, tradeName: true, state: true },
      take: MAX_SCAN,
    }),
  );
  if (clients.length === 0) return null;

  const byState = new Map<string, number>();
  for (const c of clients) {
    const state = (c.state ?? 'Unknown').trim() || 'Unknown';
    byState.set(state, (byState.get(state) ?? 0) + 1);
  }
  const sorted = Array.from(byState.entries()).sort((a, b) => b[1] - a[1]);
  const top3 = sorted.slice(0, 3);

  return {
    discoveryType: 'customer_segment',
    title: `Top customer segments by state (${top3
      .map(([s]) => s)
      .join(', ')})`,
    description: `Customer base of ${clients.length} clients is concentrated across ${
      byState.size
    } states. Top 3 segments represent ${top3.reduce(
      (acc, [, n]) => acc + n,
      0,
    )} clients (${((top3.reduce((acc, [, n]) => acc + n, 0) / clients.length) * 100).toFixed(
      0,
    )}% of base).`,
    datasetKeys: ['client'],
    confidence: confidenceFor(clients.length),
    impactMagnitude: clients.length,
    impactDirection: 'neutral',
    evidence: top3.map(
      ([state, n]) => `${state}: ${n} clients (${((n / clients.length) * 100).toFixed(0)}%)`,
    ),
    recommendedAction:
      'Align marketing and sales playbook to top-performing segments; evaluate expansion into under-served states for diversification.',
  };
}

/** tax_optimization: if ITC (purchaseBills.gstAmount) > output tax (gstrFilings.totalTax). */
async function detectTaxOptimization(): Promise<InsightInput | null> {
  const itcAgg = await safeAggregate(() =>
    db.purchaseBill.aggregate({ _sum: { gstAmount: true } }),
  );
  const outAgg = await safeAggregate(() =>
    db.gSTRFiling.aggregate({ _sum: { totalTax: true } }),
  );
  const itc = itcAgg?._sum?.gstAmount ?? 0;
  const outputTax = outAgg?._sum?.totalTax ?? 0;

  if (outputTax <= 0 || itc <= outputTax) return null;

  const refundPotential = itc - outputTax;

  return {
    discoveryType: 'tax_optimization',
    title: `Tax optimization: ITC exceeds output tax by ${formatINR(
      refundPotential,
    )}`,
    description: `Input Tax Credit (${formatINR(
      itc,
    )}) consistently exceeds output tax liability (${formatINR(
      outputTax,
    )}), indicating recurring net credit that may be refundable.`,
    datasetKeys: ['purchase_bill', 'gstr_filing'],
    confidence: 0.85,
    impactMagnitude: refundPotential,
    impactDirection: 'positive',
    evidence: [
      `Total ITC available (purchase bills GST): ${formatINR(itc)}`,
      `Total output tax liability (GSTR filings): ${formatINR(outputTax)}`,
      `Net credit / refund potential: ${formatINR(refundPotential)}`,
    ],
    recommendedAction:
      'File for ITC refund under applicable GST rules (exports / inverted duty structure). Reconcile purchase registers with GSTR-2B to lock in claim.',
  };
}

/** growth_opportunity: if client count grew > 20% in last 90 days. */
async function detectGrowthOpportunity(): Promise<InsightInput | null> {
  const cutoff = new Date(Date.now() - 90 * DAY_MS);
  const totalClients = await safeCount(() => db.client.count());
  if (totalClients === 0) return null;

  const newClients = await safeCount(() =>
    db.client.count({ where: { createdAt: { gte: cutoff } } }),
  );
  const priorClients = totalClients - newClients;
  if (newClients === 0) return null;

  const growthPct = priorClients > 0 ? newClients / priorClients : 1;
  if (growthPct <= 0.2) return null;

  return {
    discoveryType: 'growth_opportunity',
    title: `Growth opportunity: ${newClients} new clients in last 90 days (${
      priorClients > 0 ? `${(growthPct * 100).toFixed(0)}% growth` : 'new business'
    })`,
    description: `Client roster grew by ${newClients} in the last 90 days${
      priorClients > 0
        ? ` (${(growthPct * 100).toFixed(0)}% over the prior base of ${priorClients})`
        : ' from zero base'
    }. Total active clients now: ${totalClients}.`,
    datasetKeys: ['client'],
    confidence: confidenceFor(totalClients),
    impactMagnitude: newClients,
    impactDirection: 'positive',
    evidence: [
      `New clients (last 90 days): ${newClients}`,
      `Prior client base: ${priorClients}`,
      `Growth rate: ${priorClients > 0 ? `${(growthPct * 100).toFixed(0)}%` : 'N/A (zero base)'}`,
      `Total clients now: ${totalClients}`,
    ],
    recommendedAction:
      'Capitalize on momentum — codify onboarding playbook, allocate capacity for new accounts, and cross-sell into existing base.',
  };
}

/** churn_signal: clients with no invoice in last 90 days. */
async function detectChurnSignal(): Promise<InsightInput | null> {
  const clients = await safeFindMany(() =>
    db.client.findMany({
      select: { id: true, tradeName: true, state: true, createdAt: true },
      take: MAX_SCAN,
    }),
  );
  if (clients.length === 0) return null;

  const cutoff = daysAgoISO(90);
  const recentInvoices = await safeFindMany(() =>
    db.invoice.findMany({
      where: { invoiceDate: { gte: cutoff } },
      select: { clientId: true },
      take: MAX_SCAN,
    }),
  );
  const activeClientIds = new Set(recentInvoices.map((i) => i.clientId));
  const churned = clients.filter((c) => !activeClientIds.has(c.id));
  if (churned.length === 0) return null;

  return {
    discoveryType: 'churn_signal',
    title: `Churn signal: ${churned.length} client(s) with no invoice in 90 days`,
    description: `${churned.length} of ${clients.length} clients (${(
      (churned.length / clients.length) *
      100
    ).toFixed(0)}%) have no invoice in the last 90 days, indicating potential churn risk.`,
    datasetKeys: ['client', 'invoice'],
    confidence: confidenceFor(clients.length),
    impactMagnitude: churned.length,
    impactDirection: 'negative',
    evidence: churned.slice(0, 10).map(
      (c) => `${c.tradeName} (${c.state ?? 'Unknown'}) — last activity before ${cutoff.substring(0, 10)}`,
    ),
    recommendedAction:
      'Initiate win-back outreach — contact churned clients, understand reasons, offer re-engagement incentives, and route high-value accounts to account managers.',
  };
}

/** operational_bottleneck: >3 failed executionJobs in last 30 days. */
async function detectOperationalBottleneck(): Promise<InsightInput | null> {
  const cutoff = new Date(Date.now() - 30 * DAY_MS);
  const failedJobs = await safeFindMany(() =>
    db.executionJob.findMany({
      where: { status: 'failed', createdAt: { gte: cutoff } },
      select: { id: true, module: true, type: true, description: true, createdAt: true },
      take: MAX_SCAN,
    }),
  );
  if (failedJobs.length <= 3) return null;

  const moduleCounts = countBy(failedJobs, (j) => j.module);
  const topModule = Object.entries(moduleCounts).sort(
    (a, b) => b[1] - a[1],
  )[0];

  return {
    discoveryType: 'operational_bottleneck',
    title: `Operational bottleneck: ${failedJobs.length} failed jobs in last 30 days`,
    description: `${failedJobs.length} execution jobs failed in the last 30 days${
      topModule ? `, concentrated in module "${topModule[0]}" (${topModule[1]} failures)` : ''
    }.`,
    datasetKeys: ['execution_job'],
    confidence: confidenceFor(failedJobs.length),
    impactMagnitude: failedJobs.length,
    impactDirection: 'negative',
    evidence: Object.entries(moduleCounts).map(
      ([mod, n]) => `${mod}: ${n} failed job(s)`,
    ),
    recommendedAction:
      'Prioritize root-cause analysis on the most failure-heavy module. Check worker health, retry policies, and recent payload/schema changes.',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Run all AI Data Discovery detectors against REAL production data and persist
 * DataDiscoveryInsight rows. Returns the list of newly-created insights.
 */
export async function runDiscovery(): Promise<DataDiscoveryInsight[]> {
  const detectors: Array<() => Promise<InsightInput | null>> = [
    detectRevenueTrend,
    detectCostAnomaly,
    detectCashflowRisk,
    detectCustomerSegment,
    detectTaxOptimization,
    detectGrowthOpportunity,
    detectChurnSignal,
    detectOperationalBottleneck,
  ];

  const inputs = await Promise.all(detectors.map((fn) => fn()));
  const valid = inputs.filter((x): x is InsightInput => x !== null);
  const results = await Promise.all(valid.map(persistInsight));
  return results.filter((r): r is DataDiscoveryInsight => r !== null);
}

/**
 * Return DataDiscoveryInsight rows newest-first, limit 100.
 */
export async function getDiscoveries(): Promise<DataDiscoveryInsight[]> {
  const rows = await safeFindMany(() =>
    db.dataDiscoveryInsight.findMany({
      orderBy: { detectedAt: 'desc' },
      take: 100,
    }),
  );
  return rows.map((r) => mapInsight(r as unknown as PrismaInsightRow));
}

export interface DiscoverySummary {
  totalInsights: number;
  byType: Record<string, number>;
  newInsights: number;
  totalImpactINR: number;
}

/**
 * Aggregate stats about all stored DataDiscoveryInsight rows.
 */
export async function getDiscoverySummary(): Promise<DiscoverySummary> {
  const rows = await safeFindMany(() =>
    db.dataDiscoveryInsight.findMany({ take: MAX_SCAN }),
  );
  const totalInsights = rows.length;
  const byType = countBy(rows, (r) => r.discoveryType);
  const newInsights = rows.filter((r) => r.status === 'new').length;
  let totalImpactINR = 0;
  for (const r of rows) {
    if (r.impactDirection !== 'neutral') {
      totalImpactINR += r.impactMagnitude;
    }
  }
  return { totalInsights, byType, newInsights, totalImpactINR };
}

/**
 * Mark a discovery insight as acknowledged.
 */
export async function acknowledgeDiscovery(
  id: string,
): Promise<DataDiscoveryInsight | null> {
  try {
    const row = await db.dataDiscoveryInsight.update({
      where: { id },
      data: { status: 'acknowledged' },
    });
    return mapInsight(row as unknown as PrismaInsightRow);
  } catch {
    return null;
  }
}
