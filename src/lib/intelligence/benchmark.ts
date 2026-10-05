// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT™ GLOBAL DATA INTELLIGENCE CLOUD™ — Industry Benchmark Engine™
// "How does my business compare to every similar business on Earth?"
//
// This module computes and serves industry benchmark distributions from the
// anonymized contributions stored in IntelligenceContribution.
//
// Pipeline:
//   1. computeBenchmarks()  — reads all contributions for an industry/region/
//                             period, computes percentile distributions
//                             (p10/p25/p50/p75/p90/mean), upserts BenchmarkSnapshot rows.
//   2. getBenchmark()       — fetches the latest snapshot for a single metric.
//   3. listBenchmarks()     — lists snapshots for a filter.
//   4. computePercentile()  — given an org's value + a snapshot, returns the
//                             0..100 percentile where the org sits (linear
//                             interpolation between known percentiles).
//   5. benchmarkOrg()       — benchmarks a full org metric record.
//   6. benchmarkOrgRequest()— end-to-end: derives REAL org metrics from Prisma
//                             (via contributor.getOrgBenchmarkMetrics), benchmarks
//                             them, returns a BenchmarkResult.
//
// Every function is guarded — failures degrade to empty/null/0, never throw.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getOrgBenchmarkMetrics, getOrgIndustry } from './contributor';
import type {
  BenchmarkMetric,
  BenchmarkPercentile,
  BenchmarkRequest,
  BenchmarkResult,
  BenchmarkSnapshot,
  IndustryId,
  MetricType,
  RegionId,
} from './types';
import { BENCHMARK_METRIC_LABELS } from './types';

// ─── Metric Mapping (MetricType → BenchmarkMetric) ────────────────────────────

const METRIC_TO_BENCHMARK: Partial<Record<MetricType, BenchmarkMetric>> = {
  revenue: 'revenue',
  profit_margin: 'profit_margin',
  expense_ratio: 'expense_ratio',
  collection_perf: 'collection_speed',
  compliance: 'gst_compliance',
  health_score: 'health_score',
};

// ─── Time Helpers ─────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Percentile Math ──────────────────────────────────────────────────────────

/**
 * Compute the p-th percentile (0..100) of a SORTED ascending numeric array
 * using linear interpolation between the two nearest ranks.
 */
function percentileOfSorted(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/**
 * Given an org's value and a benchmark snapshot, return the percentile (0..100)
 * where the org sits relative to its peers.
 *
 * Uses linear interpolation between the known percentile anchors
 * (p10/p25/p50/p75/p90). Values below p10 return 5; values above p90 return 95.
 * The result is clamped to [0, 100].
 */
export function computePercentile(value: number, snapshot: BenchmarkSnapshot): number {
  if (!snapshot || !Number.isFinite(value)) return 0;

  const anchors: Array<{ p: number; v: number }> = [
    { p: 10, v: snapshot.p10 },
    { p: 25, v: snapshot.p25 },
    { p: 50, v: snapshot.p50 },
    { p: 75, v: snapshot.p75 },
    { p: 90, v: snapshot.p90 },
  ];

  // Below the floor of the distribution
  if (value < anchors[0].v) return 5;
  // Above the ceiling
  if (value > anchors[anchors.length - 1].v) return 95;

  // Interpolate between adjacent anchors
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (value >= a.v && value <= b.v) {
      if (b.v === a.v) return a.p;
      const frac = (value - a.v) / (b.v - a.v);
      const pct = a.p + frac * (b.p - a.p);
      return Math.round(Math.max(0, Math.min(100, pct)) * 10) / 10;
    }
  }

  return 50; // defensive fallback — should be unreachable
}

// ─── Row Mapping ──────────────────────────────────────────────────────────────

function mapSnapshotRow(row: Record<string, unknown>): BenchmarkSnapshot {
  const updatedAt = row.updatedAt;
  return {
    id: String(row.id ?? ''),
    industry: row.industry as IndustryId,
    region: row.region as RegionId,
    metricType: row.metricType as BenchmarkMetric,
    period: String(row.period ?? ''),
    p10: Number(row.p10 ?? 0),
    p25: Number(row.p25 ?? 0),
    p50: Number(row.p50 ?? 0),
    p75: Number(row.p75 ?? 0),
    p90: Number(row.p90 ?? 0),
    mean: Number(row.mean ?? 0),
    sampleSize: Number(row.sampleSize ?? 0),
    updatedAt:
      updatedAt instanceof Date
        ? updatedAt.toISOString()
        : String(updatedAt ?? new Date().toISOString()),
  };
}

// ─── Compute Benchmarks (write path) ──────────────────────────────────────────

/**
 * Recompute and persist benchmark snapshots for an industry/region/period.
 *
 * For each mappable MetricType, reads all IntelligenceContribution rows for the
 * given industry+region+period, computes the percentile distribution, and
 * upserts a BenchmarkSnapshot row keyed on (industry, region, metricType, period).
 *
 * Metrics with zero contributions are skipped (no snapshot with sampleSize 0
 * is written). Returns the count of snapshots written. Never throws.
 */
export async function computeBenchmarks(
  industry: IndustryId,
  region: RegionId,
  period?: string,
): Promise<number> {
  const periodStr = period || currentPeriod();
  let written = 0;

  for (const [metricType, benchmarkMetric] of Object.entries(METRIC_TO_BENCHMARK) as Array<
    [MetricType, BenchmarkMetric]
  >) {
    try {
      const rows = await (db as any).intelligenceContribution.findMany({
        where: { industry, region, metricType, period: periodStr },
        select: { metricValue: true },
      });

      const values = (rows ?? [])
        .map((r: Record<string, unknown>) => Number(r.metricValue))
        .filter((v: number) => Number.isFinite(v));

      if (values.length === 0) continue; // skip — no snapshot with sampleSize 0

      values.sort((a: number, b: number) => a - b);

      const p10 = percentileOfSorted(values, 10);
      const p25 = percentileOfSorted(values, 25);
      const p50 = percentileOfSorted(values, 50);
      const p75 = percentileOfSorted(values, 75);
      const p90 = percentileOfSorted(values, 90);
      const mean = values.reduce((s: number, v: number) => s + v, 0) / values.length;

      await (db as any).benchmarkSnapshot.upsert({
        where: {
          industry_region_metricType_period: {
            industry,
            region,
            metricType: benchmarkMetric,
            period: periodStr,
          },
        },
        create: {
          industry,
          region,
          metricType: benchmarkMetric,
          period: periodStr,
          p10,
          p25,
          p50,
          p75,
          p90,
          mean,
          sampleSize: values.length,
        },
        update: {
          p10,
          p25,
          p50,
          p75,
          p90,
          mean,
          sampleSize: values.length,
          updatedAt: new Date(),
        },
      });

      written++;
    } catch (e) {
      console.warn(
        `[intelligence/benchmark] computeBenchmarks metric ${metricType} failed:`,
        e,
      );
    }
  }

  return written;
}

// ─── Read Path ────────────────────────────────────────────────────────────────

/**
 * Fetch the latest BenchmarkSnapshot for a single industry/metric/region.
 * Region defaults to 'global'. Returns null if none exists.
 */
export async function getBenchmark(
  industry: IndustryId,
  metric: BenchmarkMetric,
  region: RegionId = 'global',
): Promise<BenchmarkSnapshot | null> {
  try {
    const row = await (db as any).benchmarkSnapshot.findFirst({
      where: { industry, region, metricType: metric },
      orderBy: { updatedAt: 'desc' },
    });
    return row ? mapSnapshotRow(row) : null;
  } catch (e) {
    console.warn('[intelligence/benchmark] getBenchmark failed:', e);
    return null;
  }
}

/**
 * List benchmark snapshots for a filter (or all if no filter). Max 100 rows,
 * newest first.
 */
export async function listBenchmarks(
  industry?: IndustryId,
  region?: RegionId,
): Promise<BenchmarkSnapshot[]> {
  try {
    const where: Record<string, unknown> = {};
    if (industry) where.industry = industry;
    if (region) where.region = region;

    const rows = await (db as any).benchmarkSnapshot.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return (rows ?? []).map(mapSnapshotRow);
  } catch (e) {
    console.warn('[intelligence/benchmark] listBenchmarks failed:', e);
    return [];
  }
}

// ─── Org Benchmarking ─────────────────────────────────────────────────────────

/**
 * Benchmark an organization's metrics against stored industry snapshots.
 *
 * For each metric in orgMetrics, fetches the benchmark snapshot, computes the
 * percentile, and builds a BenchmarkPercentile with a human-readable verdict.
 * Metrics with no snapshot (or sampleSize 0) are skipped.
 */
export async function benchmarkOrg(
  orgMetrics: Record<BenchmarkMetric, number>,
  industry: IndustryId,
  region: RegionId = 'global',
): Promise<BenchmarkPercentile[]> {
  const results: BenchmarkPercentile[] = [];

  for (const [metricStr, orgValue] of Object.entries(orgMetrics)) {
    const metric = metricStr as BenchmarkMetric;
    if (!Number.isFinite(orgValue)) continue;

    try {
      const snapshot = await getBenchmark(industry, metric, region);
      if (!snapshot || snapshot.sampleSize === 0) continue;

      const percentile = computePercentile(orgValue, snapshot);
      const label = BENCHMARK_METRIC_LABELS[metric] || metric;
      const rounded = Math.round(percentile);

      results.push({
        metric,
        label,
        orgValue,
        percentile,
        p50: snapshot.p50,
        p75: snapshot.p75,
        p90: snapshot.p90,
        sampleSize: snapshot.sampleSize,
        verdict: `You are performing better than ${rounded}% of similar companies.`,
        betterThanPeers: percentile >= 50,
      });
    } catch (e) {
      console.warn(`[intelligence/benchmark] benchmarkOrg metric ${metricStr} failed:`, e);
    }
  }

  return results;
}

/**
 * End-to-end benchmark request handler.
 *
 * If orgMetrics are not derivable from the request type (BenchmarkRequest has
 * no orgMetrics field), they are derived from REAL Prisma data via
 * contributor.getOrgBenchmarkMetrics(). Industry defaults to the org's own
 * industry; region defaults to 'global'.
 *
 * If req.metrics is provided, the returned percentiles are filtered to only
 * those metrics.
 */
export async function benchmarkOrgRequest(req: BenchmarkRequest): Promise<BenchmarkResult> {
  try {
    const industry = req.industry || (await getOrgIndustry());
    const region = req.region || ('global' as RegionId);

    const orgMetrics = await getOrgBenchmarkMetrics();
    const percentiles = await benchmarkOrg(orgMetrics, industry, region);

    const filtered =
      req.metrics && req.metrics.length > 0
        ? percentiles.filter((p) => req.metrics!.includes(p.metric))
        : percentiles;

    const sampleSize =
      filtered.length > 0 ? Math.max(...filtered.map((p) => p.sampleSize)) : 0;

    return {
      industry,
      region,
      percentiles: filtered,
      sampleSize,
      computedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[intelligence/benchmark] benchmarkOrgRequest failed:', e);
    return {
      industry: req.industry || 'professional_services',
      region: req.region || 'global',
      percentiles: [],
      sampleSize: 0,
      computedAt: new Date().toISOString(),
    };
  }
}
