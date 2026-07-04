// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT™ GLOBAL DATA INTELLIGENCE CLOUD™ — Global Business Data Cloud™
// "Learn From Every Business. Empower Every Business."
//
// This module is the contribution layer of the intelligence cloud. It harvests
// REAL organization-level metrics from the connected Prisma data (invoices,
// expenses, payments, GSTR filings, client health scores) and contributes them
// to the anonymized global pool via the Privacy Engine.
//
// KEY INVARIANTS:
//   • Every metric is derived from REAL business data — never mocked.
//   • Every contribution is anonymized before persistence (firmId → SHA-256).
//   • Contributions are idempotent per (firm, period, metric) via contributionHash.
//   • Every function is wrapped in try/catch — a contribution failure NEVER
//     propagates to the caller or blocks sibling contributions.
//
// The harvested metrics feed the Industry Benchmark Engine™ (benchmark.ts),
// which computes percentile distributions per industry / region / metric.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { anonymizeContribution, classifyRevenueBand } from './anonymize';
import type {
  BenchmarkMetric,
  BusinessModel,
  ContributionInput,
  IndustryId,
  MetricType,
  RegionId,
  RevenueBand,
} from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Time Helpers ─────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ─── Contribute a Single Metric ───────────────────────────────────────────────

/**
 * Anonymize and persist a single metric contribution.
 *
 * Deduplicates by contributionHash (= SHA-256 of firmId + period + metricType)
 * so repeated calls for the same period/metric upsert rather than duplicate.
 *
 * @returns the persisted row id, or an empty string on failure (never throws).
 */
export async function contributeMetric(input: ContributionInput): Promise<string> {
  try {
    const { anonymizedFirmHash, contributionHash, metricValue } =
      anonymizeContribution(input, FIRM_ID);

    const payloadJson = input.payload ? JSON.stringify(input.payload) : '{}';

    const row = await (db as any).intelligenceContribution.upsert({
      where: { contributionHash },
      create: {
        firmId: anonymizedFirmHash,
        industry: input.industry,
        region: input.region,
        businessModel: input.businessModel,
        revenueBand: input.revenueBand,
        metricType: input.metricType,
        metricValue,
        metricUnit: input.metricUnit || 'count',
        period: input.period,
        payload: payloadJson,
        contributionHash,
      },
      update: {
        metricValue,
        metricUnit: input.metricUnit || 'count',
        payload: payloadJson,
      },
    });
    return row?.id ?? '';
  } catch (e) {
    console.warn('[intelligence/contributor] contributeMetric failed:', e);
    return '';
  }
}

// ─── Org Metric Collection (REAL data only) ───────────────────────────────────

interface OrgMetricsRaw {
  revenue: number; // INR this month (taxable + tax)
  expenseRatio: number; // percent — expenses / revenue * 100
  collectionPerf: number; // percent — payments / invoices * 100
  compliance: number; // percent — filed GSTRs / total GSTRs * 100
  healthScore: number; // 0..100 — avg client health
  profitMargin: number; // percent — (revenue - expenses) / revenue * 100
  period: string; // YYYY-MM
}

/**
 * Gather REAL organization-level metrics from Prisma for the current month.
 *
 * Every Prisma query is individually guarded — if one model accessor is
 * missing or a query fails, the others still execute and the failed metric
 * simply resolves to 0. This makes the harvester resilient to schema drift.
 */
async function collectOrgMetrics(): Promise<OrgMetricsRaw> {
  const period = currentPeriod();
  const since = monthStart();

  // Revenue: sum of (taxableValue + cgst + sgst + igst + cess) for non-cancelled
  // invoices created this month. Invoice.totalTax isn't a single column, so we
  // sum the four tax components alongside the taxable value.
  let revenue = 0;
  try {
    const invoices = await (db as any).invoice.findMany({
      where: {
        client: { firmId: FIRM_ID },
        status: { not: 'cancelled' },
        createdAt: { gte: since },
      },
      select: { taxableValue: true, cgst: true, sgst: true, igst: true, cess: true },
    });
    revenue = (invoices ?? []).reduce(
      (sum: number, inv: Record<string, number>) =>
        sum +
        (inv.taxableValue || 0) +
        (inv.cgst || 0) +
        (inv.sgst || 0) +
        (inv.igst || 0) +
        (inv.cess || 0),
      0,
    );
  } catch (e) {
    console.warn('[intelligence/contributor] invoice revenue query failed:', e);
  }

  // Expenses this month
  let expenses = 0;
  try {
    const expenseRows = await (db as any).expense.findMany({
      where: {
        client: { firmId: FIRM_ID },
        createdAt: { gte: since },
      },
      select: { amount: true },
    });
    expenses = (expenseRows ?? []).reduce(
      (sum: number, ex: Record<string, number>) => sum + (ex.amount || 0),
      0,
    );
  } catch (e) {
    console.warn('[intelligence/contributor] expense query failed:', e);
  }

  // Collection performance: completed payments / total invoices this month
  let collectionPerf = 0;
  try {
    const [paymentCount, invoiceCount] = await Promise.all([
      (db as any).payment.count({
        where: {
          client: { firmId: FIRM_ID },
          createdAt: { gte: since },
          status: 'completed',
        },
      }),
      (db as any).invoice.count({
        where: {
          client: { firmId: FIRM_ID },
          status: { not: 'cancelled' },
          createdAt: { gte: since },
        },
      }),
    ]);
    collectionPerf = invoiceCount > 0 ? (paymentCount / invoiceCount) * 100 : 0;
  } catch (e) {
    console.warn('[intelligence/contributor] collection perf query failed:', e);
  }

  // GST compliance: filed GSTRs / total GSTRs (all time for the firm)
  let compliance = 0;
  try {
    const [filedCount, totalCount] = await Promise.all([
      (db as any).gSTRFiling.count({
        where: { client: { firmId: FIRM_ID }, status: 'filed' },
      }),
      (db as any).gSTRFiling.count({
        where: { client: { firmId: FIRM_ID } },
      }),
    ]);
    compliance = totalCount > 0 ? (filedCount / totalCount) * 100 : 0;
  } catch (e) {
    console.warn('[intelligence/contributor] gstrFiling compliance query failed:', e);
  }

  // Average client health score
  let healthScore = 0;
  try {
    const clients = await (db as any).client.findMany({
      where: { firmId: FIRM_ID },
      select: { healthScore: true },
    });
    if (clients && clients.length > 0) {
      const total = clients.reduce(
        (sum: number, c: Record<string, number>) => sum + (c.healthScore || 0),
        0,
      );
      healthScore = total / clients.length;
    }
  } catch (e) {
    console.warn('[intelligence/contributor] client health query failed:', e);
  }

  const profitMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const expenseRatio = revenue > 0 ? (expenses / revenue) * 100 : 0;

  return {
    revenue,
    expenseRatio,
    collectionPerf,
    compliance,
    healthScore,
    profitMargin,
    period,
  };
}

// ─── Org Industry Derivation ──────────────────────────────────────────────────

const INDUSTRY_KEYWORDS: Array<{ keywords: string[]; industry: IndustryId }> = [
  { keywords: ['manufactur', 'factory'], industry: 'manufacturing' },
  { keywords: ['retail', 'store', 'shop'], industry: 'retail' },
  { keywords: ['health', 'med', 'clinic', 'pharma'], industry: 'healthcare' },
  { keywords: ['construct', 'builder', 'infra'], industry: 'construction' },
  { keywords: ['edu', 'school', 'academy', 'learn'], industry: 'education' },
  { keywords: ['hotel', 'restaurant', 'hospitality'], industry: 'hospitality' },
  { keywords: ['logistic', 'transport', 'cargo', 'freight'], industry: 'logistics' },
  { keywords: ['tech', 'software', ' it ', 'systems'], industry: 'it' },
  { keywords: ['ecom', 'commerce', 'online store'], industry: 'ecommerce' },
  { keywords: ['wholesale', 'distribut'], industry: 'wholesale' },
  { keywords: ['finance', 'bank', 'capita', 'invest'], industry: 'finance' },
];

/**
 * Derive the organization's industry from the Firm record. Falls back to
 * 'professional_services' when no Firm row exists or no keyword matches.
 */
export async function getOrgIndustry(): Promise<IndustryId> {
  try {
    const firm = await (db as any).firm.findUnique({ where: { id: FIRM_ID } });
    if (firm) {
      const haystack = ` ${String(firm.name || '').toLowerCase()} ${String(
        firm.website || '',
      ).toLowerCase()} `;
      for (const { keywords, industry } of INDUSTRY_KEYWORDS) {
        if (keywords.some((kw) => haystack.includes(kw))) {
          return industry;
        }
      }
    }
    return 'professional_services';
  } catch (e) {
    console.warn('[intelligence/contributor] getOrgIndustry failed:', e);
    return 'professional_services';
  }
}

// ─── Harvest & Contribute All Org Metrics ─────────────────────────────────────

/**
 * Harvest REAL org metrics from Prisma and contribute each to the global pool.
 *
 * Each contribution is individually wrapped in try/catch so a single failure
 * (e.g. a unique constraint conflict) does not block the others.
 *
 * @returns the count of metrics successfully contributed.
 */
export async function harvestOrgMetrics(): Promise<number> {
  const industry = await getOrgIndustry();
  const metrics = await collectOrgMetrics();
  const revenueBand: RevenueBand = classifyRevenueBand(metrics.revenue);

  const base = {
    industry,
    region: 'IN' as RegionId,
    businessModel: 'b2b' as BusinessModel,
    revenueBand,
    period: metrics.period,
  };

  let count = 0;

  const contributions: Array<Omit<ContributionInput, 'industry' | 'region' | 'businessModel' | 'revenueBand' | 'period'>> = [
    { metricType: 'revenue' as MetricType, metricValue: metrics.revenue, metricUnit: 'inr' },
    { metricType: 'expense_ratio' as MetricType, metricValue: metrics.expenseRatio, metricUnit: 'percent' },
    { metricType: 'collection_perf' as MetricType, metricValue: metrics.collectionPerf, metricUnit: 'percent' },
    { metricType: 'compliance' as MetricType, metricValue: metrics.compliance, metricUnit: 'percent' },
    { metricType: 'health_score' as MetricType, metricValue: metrics.healthScore, metricUnit: 'count' },
    { metricType: 'profit_margin' as MetricType, metricValue: metrics.profitMargin, metricUnit: 'percent' },
  ];

  for (const c of contributions) {
    try {
      const id = await contributeMetric({ ...base, ...c } as ContributionInput);
      if (id) count++;
    } catch (e) {
      console.warn(`[intelligence/contributor] harvest ${c.metricType} failed:`, e);
    }
  }

  return count;
}

/**
 * Collect REAL org metrics and shape them as a BenchmarkMetric record for the
 * Industry Benchmark Engine™. Metrics that aren't derivable from Prisma
 * (payroll, working capital, inventory, etc.) are returned as 0 — the caller
 * (benchmarkOrg) skips any metric whose benchmark snapshot is absent, so a 0
 * value with no snapshot is harmless.
 */
export async function getOrgBenchmarkMetrics(): Promise<Record<BenchmarkMetric, number>> {
  const m = await collectOrgMetrics();
  return {
    revenue: m.revenue,
    profit_margin: m.profitMargin,
    expense_ratio: m.expenseRatio,
    collection_speed: m.collectionPerf,
    gst_compliance: m.compliance,
    health_score: m.healthScore,
    // Not derivable from current Prisma schema — left at 0.
    payroll_efficiency: 0,
    working_capital: 0,
    inventory_turnover: 0,
    sales_growth: 0,
    customer_retention: 0,
    vendor_risk: 0,
  };
}

// ─── Aggregate Contribution Stats (anonymized) ────────────────────────────────

export interface ContributionStats {
  totalContributions: number;
  byMetric: Record<string, number>;
  byIndustry: Record<string, number>;
  lastContributionAt: string | null;
}

/**
 * Aggregate the IntelligenceContribution table. The result contains NO firm
 * identifiers — only counts grouped by metricType and industry.
 */
export async function getContributionStats(): Promise<ContributionStats> {
  try {
    const rows = await (db as any).intelligenceContribution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: { metricType: true, industry: true, createdAt: true },
    });

    const byMetric: Record<string, number> = {};
    const byIndustry: Record<string, number> = {};
    let lastAt: string | null = null;

    for (const r of rows ?? []) {
      byMetric[r.metricType] = (byMetric[r.metricType] || 0) + 1;
      byIndustry[r.industry] = (byIndustry[r.industry] || 0) + 1;
      const ts =
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? '');
      if (!lastAt || ts > lastAt) lastAt = ts;
    }

    return {
      totalContributions: rows?.length ?? 0,
      byMetric,
      byIndustry,
      lastContributionAt: lastAt,
    };
  } catch (e) {
    console.warn('[intelligence/contributor] getContributionStats failed:', e);
    return { totalContributions: 0, byMetric: {}, byIndustry: {}, lastContributionAt: null };
  }
}
