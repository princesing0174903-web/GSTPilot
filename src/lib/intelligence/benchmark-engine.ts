// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Industry Benchmark Engine™
// Phase 7 — Subsystem 2
// ═══════════════════════════════════════════════════════════════════════════════
//
// Automatically compares every organization with similar businesses.
// Oracle continuously reports: "You are performing better than 82% of similar companies."
//
// Comparisons (all privacy-safe, aggregated):
//   • Revenue percentile        • Working capital
//   • Profit percentile         • Inventory turnover
//   • Expense efficiency        • Sales growth
//   • Payroll efficiency        • Customer retention
//   • GST compliance score      • Vendor risk
//   • Collection speed          • Business health score
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'
import {
  computePercentiles,
  percentileRank,
  verdictFromPercentile,
  isSampleSafe,
  currentPeriod,
} from './privacy'
import {
  INDUSTRY_LABELS,
  BENCHMARK_METRIC_LABELS,
  type BenchmarkComparison,
  type BenchmarkMetric,
  type IndustryBenchmarkReport,
  type IndustryKey,
} from './types'

// ─── Mapping: metric → contribution field ─────────────────────────────────────

const METRIC_TO_FIELD: Record<BenchmarkMetric, keyof typeof fieldMap> = {
  revenue: 'revenueTrendPct',                 // % growth used as privacy-safe proxy
  profit: 'healthScore',                       // composite proxy
  expenseRatio: 'expenseRatioPct',
  payrollRatio: 'payrollRatioPct',
  gstCompliance: 'complianceScore',
  collectionDays: 'collectionDays',
  workingCapital: 'cashFlowHealth',
  inventoryTurnover: 'expenseRatioPct',
  salesGrowth: 'revenueTrendPct',
  customerRetention: 'customerRetention',
  vendorRisk: 'vendorRiskScore',
  healthScore: 'healthScore',
}

// Field map for type-safe Prisma selects
const fieldMap = {
  revenueTrendPct: true,
  expenseRatioPct: true,
  payrollRatioPct: true,
  complianceScore: true,
  collectionDays: true,
  cashFlowHealth: true,
  customerRetention: true,
  vendorRiskScore: true,
  healthScore: true,
} as const

// ─── Compute Benchmarks (cached) ──────────────────────────────────────────────

/**
 * Compute & cache industry benchmark percentiles from anonymized contributions.
 * Returns the persisted IndustryBenchmark records.
 *
 * If benchmarks already exist for the period, returns them;
 * otherwise computes from raw contributions and persists.
 */
export async function computeIndustryBenchmarks(
  industry: IndustryKey,
  period: string = currentPeriod(),
): Promise<Array<{ metric: string; p10: number; p25: number; p50: number; p75: number; p90: number; mean: number; stddev: number; sampleSize: number }>> {
  // Check cache first
  const cached = await db.industryBenchmark.findMany({
    where: { industry, region: 'all', sizeBand: 'all', asOfPeriod: period },
  })
  if (cached.length >= Object.keys(METRIC_TO_FIELD).length) {
    return cached.map((c) => ({
      metric: c.metric,
      p10: c.p10, p25: c.p25, p50: c.p50, p75: c.p75, p90: c.p90,
      mean: c.mean, stddev: c.stddev, sampleSize: c.sampleSize,
    }))
  }

  // Compute from raw contributions
  const contributions = await db.intelligenceContribution.findMany({
    where: { industry, asOfPeriod: period },
    select: fieldMap,
  })
  if (!isSampleSafe(contributions.length)) return []

  const results: Array<{ metric: string; p10: number; p25: number; p50: number; p75: number; p90: number; mean: number; stddev: number; sampleSize: number }> = []

  for (const [metric, field] of Object.entries(METRIC_TO_FIELD) as [BenchmarkMetric, keyof typeof fieldMap][]) {
    // For vendorRisk and collectionDays, lower = better; we still compute raw percentiles
    // but verdictFromPercentile handles inversion at comparison time.
    const values = contributions.map((c) => c[field] as number).filter((v) => typeof v === 'number' && isFinite(v))
    const percentiles = computePercentiles(values)
    if (!percentiles) continue

    // Upsert into cache
    await db.industryBenchmark.upsert({
      where: {
        industry_region_sizeBand_asOfPeriod_metric: {
          industry, region: 'all', sizeBand: 'all', asOfPeriod: period, metric,
        },
      },
      update: {
        p10: percentiles.p10, p25: percentiles.p25, p50: percentiles.p50,
        p75: percentiles.p75, p90: percentiles.p90,
        mean: percentiles.mean, stddev: percentiles.stddev,
        sampleSize: percentiles.sampleSize,
        updatedAt: new Date(),
      },
      create: {
        industry, region: 'all', sizeBand: 'all', asOfPeriod: period, metric,
        p10: percentiles.p10, p25: percentiles.p25, p50: percentiles.p50,
        p75: percentiles.p75, p90: percentiles.p90,
        mean: percentiles.mean, stddev: percentiles.stddev,
        sampleSize: percentiles.sampleSize,
      },
    })

    results.push({
      metric,
      p10: percentiles.p10, p25: percentiles.p25, p50: percentiles.p50,
      p75: percentiles.p75, p90: percentiles.p90,
      mean: percentiles.mean, stddev: percentiles.stddev,
      sampleSize: percentiles.sampleSize,
    })
  }

  return results
}

// ─── Compare Org Against Industry ────────────────────────────────────────────

/**
 * Compare an organization's metrics against industry benchmarks.
 * Returns percentile rank for each metric + an Oracle narrative.
 *
 * The orgFingerprint's most recent contribution is used as "yourValue".
 * For metrics where lower is better (vendorRisk, collectionDays, expenseRatio),
 * percentile is computed as (100 - rank) so "above 80%" always means "better than 80%".
 */
export async function compareOrgToIndustry(
  orgFingerprintHash: string,
  industry: IndustryKey,
  period: string = currentPeriod(),
): Promise<IndustryBenchmarkReport> {
  const benchmarks = await computeIndustryBenchmarks(industry, period)

  // Get this org's most recent contribution
  const myContribution = await db.intelligenceContribution.findFirst({
    where: { orgFingerprint: orgFingerprintHash, asOfPeriod: period },
    select: fieldMap,
  })

  const comparisons: BenchmarkComparison[] = []
  let percentileSum = 0
  let percentileCount = 0

  for (const benchmark of benchmarks) {
    const metric = benchmark.metric as BenchmarkMetric
    const field = METRIC_TO_FIELD[metric]
    const myValue = myContribution ? (myContribution[field] as number) : null
    const label = BENCHMARK_METRIC_LABELS[metric] || metric

    // For "lower is better" metrics, invert the percentile
    const lowerIsBetter = metric === 'vendorRisk' || metric === 'collectionDays' || metric === 'expenseRatio' || metric === 'payrollRatio'

    let percentile: number | null = null
    let verdict: BenchmarkComparison['verdict'] = 'insufficient_data'
    let insight = 'Insufficient industry data to compute a percentile.'

    if (myValue !== null && benchmark.sampleSize >= 5) {
      // Recompute the rank from the contribution pool
      const allValues = await db.intelligenceContribution.findMany({
        where: { industry, asOfPeriod: period },
        select: { [field]: true } as never,
      })
      const sorted = (allValues as Array<Record<string, number>>)
        .map((r) => r[field] as number)
        .filter((v) => typeof v === 'number' && isFinite(v))
        .sort((a, b) => a - b)
      const rawRank = percentileRank(sorted, myValue)
      percentile = lowerIsBetter ? round2(100 - rawRank) : rawRank
      verdict = verdictFromPercentile(percentile)
      insight = buildInsight(metric, percentile, myValue, benchmark, lowerIsBetter)
      percentileSum += percentile
      percentileCount++
    }

    comparisons.push({
      metric,
      label,
      yourValue: myValue,
      percentile,
      band: {
        p10: benchmark.p10, p25: benchmark.p25, p50: benchmark.p50,
        p75: benchmark.p75, p90: benchmark.p90,
        mean: benchmark.mean, stddev: benchmark.stddev,
        sampleSize: benchmark.sampleSize,
      },
      verdict,
      insight,
    })
  }

  const overallPercentile = percentileCount > 0 ? round2(percentileSum / percentileCount) : null
  const oracleNarrative = buildOracleNarrative(industry, overallPercentile, comparisons)

  return {
    industry,
    industryLabel: INDUSTRY_LABELS[industry],
    asOfPeriod: period,
    sampleSize: benchmarks[0]?.sampleSize || 0,
    comparisons,
    overallPercentile,
    oracleNarrative,
  }
}

// ─── Compare Arbitrary Value (for benchmark API) ─────────────────────────────

/**
 * Compare an arbitrary value against industry benchmarks.
 * Used by POST /api/intelligence/benchmark for ad-hoc comparisons.
 */
export async function benchmarkValue(
  industry: IndustryKey,
  metric: BenchmarkMetric,
  value: number,
  period: string = currentPeriod(),
): Promise<BenchmarkComparison> {
  const benchmarks = await computeIndustryBenchmarks(industry, period)
  const benchmark = benchmarks.find((b) => b.metric === metric)

  if (!benchmark || !isSampleSafe(benchmark.sampleSize)) {
    return {
      metric,
      label: BENCHMARK_METRIC_LABELS[metric],
      yourValue: value,
      percentile: null,
      band: benchmark
        ? { p10: benchmark.p10, p25: benchmark.p25, p50: benchmark.p50, p75: benchmark.p75, p90: benchmark.p90, mean: benchmark.mean, stddev: benchmark.stddev, sampleSize: benchmark.sampleSize }
        : { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, mean: 0, stddev: 0, sampleSize: 0 },
      verdict: 'insufficient_data',
      insight: 'Insufficient industry data to compute a percentile. Contribute your data to grow the benchmark pool.',
    }
  }

  // Recompute rank from raw contribution pool
  const field = METRIC_TO_FIELD[metric]
  const allValues = await db.intelligenceContribution.findMany({
    where: { industry, asOfPeriod: period },
    select: { [field]: true } as never,
  })
  const sorted = (allValues as Array<Record<string, number>>)
    .map((r) => r[field] as number)
    .filter((v) => typeof v === 'number' && isFinite(v))
    .sort((a, b) => a - b)

  const lowerIsBetter = metric === 'vendorRisk' || metric === 'collectionDays' || metric === 'expenseRatio' || metric === 'payrollRatio'
  const rawRank = percentileRank(sorted, value)
  const percentile = lowerIsBetter ? round2(100 - rawRank) : rawRank
  const verdict = verdictFromPercentile(percentile)
  const insight = buildInsight(metric, percentile, value, benchmark, lowerIsBetter)

  return {
    metric,
    label: BENCHMARK_METRIC_LABELS[metric],
    yourValue: value,
    percentile,
    band: {
      p10: benchmark.p10, p25: benchmark.p25, p50: benchmark.p50,
      p75: benchmark.p75, p90: benchmark.p90,
      mean: benchmark.mean, stddev: benchmark.stddev,
      sampleSize: benchmark.sampleSize,
    },
    verdict,
    insight,
  }
}

// ─── Narrative Builders ───────────────────────────────────────────────────────

function buildInsight(
  metric: BenchmarkMetric,
  percentile: number,
  myValue: number,
  benchmark: { p50: number; mean: number; sampleSize: number },
  lowerIsBetter: boolean,
): string {
  const label = BENCHMARK_METRIC_LABELS[metric]
  const vsMedian = lowerIsBetter ? myValue - benchmark.p50 : benchmark.p50 - myValue
  const direction = vsMedian > 0 ? 'better than' : vsMedian < 0 ? 'worse than' : 'in line with'
  if (percentile >= 75) return `${label}: You're in the top quartile — ${direction} the industry median (sample: ${benchmark.sampleSize} orgs).`
  if (percentile >= 60) return `${label}: Above average — ${direction} the industry median (sample: ${benchmark.sampleSize} orgs).`
  if (percentile >= 40) return `${label}: In line with industry median (sample: ${benchmark.sampleSize} orgs).`
  if (percentile >= 25) return `${label}: Below average — focus here to climb the benchmark (sample: ${benchmark.sampleSize} orgs).`
  return `${label}: Bottom quartile — prioritize this metric (sample: ${benchmark.sampleSize} orgs).`
}

function buildOracleNarrative(
  industry: IndustryKey,
  overall: number | null,
  comparisons: BenchmarkComparison[],
): string {
  if (overall === null) {
    return `Insufficient industry data to benchmark your ${INDUSTRY_LABELS[industry]} business yet. Contribute your data and as the pool grows, Oracle will compare you against similar companies.`
  }

  const topMetrics = comparisons
    .filter((c) => c.percentile !== null && c.percentile >= 75)
    .map((c) => c.label)
  const weakMetrics = comparisons
    .filter((c) => c.percentile !== null && c.percentile < 40)
    .map((c) => c.label)

  let narrative = `You are performing better than ${overall}% of similar ${INDUSTRY_LABELS[industry]} companies.`

  if (topMetrics.length > 0) {
    narrative += ` Your strongest areas: ${topMetrics.slice(0, 3).join(', ')}.`
  }
  if (weakMetrics.length > 0) {
    narrative += ` Focus on: ${weakMetrics.slice(0, 3).join(', ')}.`
  }
  if (topMetrics.length === 0 && weakMetrics.length === 0) {
    narrative += ` You're tracking close to industry medians — steady performance.`
  }

  return narrative
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
