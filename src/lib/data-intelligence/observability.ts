// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Data Intelligence Cloud™ (UNIFIED ENTERPRISE DATA BRAIN)
// Data Observability™ — freshness / completeness / volume / schema drift / pipeline
// health for every catalog dataset. Real measurements, no mocks.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DataObservabilityMetric as PrismaObservabilityRow } from '@prisma/client';

import {
  db,
  safeFindMany,
  safeCount,
  countBy,
  cached,
  TTL,
} from './helpers';
import type {
  DataObservabilityMetric,
  ObservabilityMetricType,
  ObservabilityStatus,
} from './types';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface ObservabilitySummary {
  totalMetrics: number;
  byStatus: Record<string, number>;
  byMetricType: Record<string, number>;
  healthScore: number;
  criticalDatasets: number;
}

export interface ConnectorHealth {
  id: string;
  label: string;
  type: string;
  status: string;
  lastSyncAt: string | null;
  syncInterval: string;
  stale: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FRESHNESS_WARN_MIN = 360;
const FRESHNESS_CRITICAL_MIN = 1440;
const PIPELINE_WARN_PCT = 95;
const PIPELINE_CRITICAL_PCT = 80;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSyncIntervalMinutes(interval: string | null | undefined): number {
  if (!interval) return 60;
  const lower = interval.toLowerCase().trim();
  if (lower === 'daily') return 1440;
  const m = lower.match(/^(\d+)\s*(m|h|d)$/);
  if (!m) return 60;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n) || n <= 0) return 60;
  if (m[2] === 'm') return n;
  if (m[2] === 'h') return n * 60;
  return n * 1440;
}

function mapMetric(row: PrismaObservabilityRow): DataObservabilityMetric {
  return {
    id: row.id,
    datasetKey: row.datasetKey,
    metricType: row.metricType as ObservabilityMetricType,
    metricValue: row.metricValue,
    metricUnit: row.metricUnit,
    status: row.status as ObservabilityStatus,
    threshold: row.threshold,
    message: row.message,
    measuredAt: row.measuredAt.toISOString(),
  };
}

// ─── Measure ──────────────────────────────────────────────────────────────────

/**
 * For each active DataCatalogEntry, compute 5 metrics (freshness, completeness,
 * volume, schema_drift, pipeline_health) and persist them as
 * DataObservabilityMetric rows. Returns the freshly measured metrics.
 */
export async function measureObservability(): Promise<
  DataObservabilityMetric[]
> {
  const catalog = await safeFindMany(() =>
    db.dataCatalogEntry.findMany({
      where: { isActive: true },
      select: {
        id: true,
        datasetKey: true,
        recordCount: true,
        schemaFields: true,
        lastUpdated: true,
        sourceSystem: true,
      },
    }),
  );

  if (catalog.length === 0) return [];

  // Pipeline success rate (global, last 24h) — used as pipeline_health proxy
  // for every dataset. Computed once per measurement run.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentRuns = await safeFindMany(() =>
    db.dataPipelineRun.findMany({
      where: { startedAt: { gte: since24h } },
      select: { status: true },
    }),
  );
  const totalRuns = recentRuns.length;
  const completedRuns = recentRuns.filter((r) => r.status === 'completed').length;
  const pipelineSuccessPct =
    totalRuns > 0 ? (completedRuns / totalRuns) * 100 : 100;

  const now = new Date();
  const created: PrismaObservabilityRow[] = [];

  for (const entry of catalog) {
    // (1) freshness — minutes since lastUpdated.
    const freshnessMin = entry.lastUpdated
      ? Math.max(0, Math.round((now.getTime() - entry.lastUpdated.getTime()) / 60_000))
      : FRESHNESS_CRITICAL_MIN * 2; // never updated → very stale
    let freshnessStatus: ObservabilityStatus = 'healthy';
    if (freshnessMin > FRESHNESS_CRITICAL_MIN) freshnessStatus = 'critical';
    else if (freshnessMin > FRESHNESS_WARN_MIN) freshnessStatus = 'warning';
    const freshnessRow = await persistMetric({
      datasetKey: entry.datasetKey,
      metricType: 'freshness',
      metricValue: freshnessMin,
      metricUnit: 'minutes',
      threshold: FRESHNESS_CRITICAL_MIN,
      status: freshnessStatus,
      message:
        freshnessStatus === 'critical'
          ? `Dataset last updated ${freshnessMin} min ago — exceeds ${FRESHNESS_CRITICAL_MIN} min SLA`
          : freshnessStatus === 'warning'
            ? `Dataset last updated ${freshnessMin} min ago — exceeds ${FRESHNESS_WARN_MIN} min warning`
            : `Dataset fresh (last updated ${freshnessMin} min ago)`,
    });
    if (freshnessRow) created.push(freshnessRow);

    // (2) completeness — 100 if recordCount > 0 else 0.
    const completeness = entry.recordCount > 0 ? 100 : 0;
    const completenessStatus: ObservabilityStatus =
      completeness < 100 ? 'warning' : 'healthy';
    const completenessRow = await persistMetric({
      datasetKey: entry.datasetKey,
      metricType: 'completeness',
      metricValue: completeness,
      metricUnit: 'percent',
      threshold: 100,
      status: completenessStatus,
      message:
        completeness < 100
          ? `Dataset has ${entry.recordCount} records — empty or incomplete`
          : 'Dataset has records',
    });
    if (completenessRow) created.push(completenessRow);

    // (3) volume — raw recordCount.
    const volumeRow = await persistMetric({
      datasetKey: entry.datasetKey,
      metricType: 'volume',
      metricValue: entry.recordCount,
      metricUnit: 'count',
      threshold: 0,
      status: 'healthy',
      message: `${entry.recordCount} records`,
    });
    if (volumeRow) created.push(volumeRow);

    // (4) schema_drift — 1 if schemaFields is empty, 0 otherwise.
    let schemaFieldsCount = 0;
    try {
      const parsed = entry.schemaFields ? JSON.parse(entry.schemaFields) : [];
      if (Array.isArray(parsed)) schemaFieldsCount = parsed.length;
    } catch {
      schemaFieldsCount = 0;
    }
    const schemaDrift = schemaFieldsCount > 0 ? 0 : 1;
    const schemaStatus: ObservabilityStatus =
      schemaDrift === 1 ? 'critical' : 'healthy';
    const schemaRow = await persistMetric({
      datasetKey: entry.datasetKey,
      metricType: 'schema_drift',
      metricValue: schemaDrift,
      metricUnit: 'count',
      threshold: 1,
      status: schemaStatus,
      message:
        schemaDrift === 1
          ? 'No schema fields registered — schema drift suspected'
          : `Schema stable (${schemaFieldsCount} fields)`,
    });
    if (schemaRow) created.push(schemaRow);

    // (5) pipeline_health — derived from recent DataPipelineRun success rate.
    let pipelineStatus: ObservabilityStatus = 'healthy';
    if (totalRuns > 0) {
      if (pipelineSuccessPct < PIPELINE_CRITICAL_PCT) pipelineStatus = 'critical';
      else if (pipelineSuccessPct < PIPELINE_WARN_PCT) pipelineStatus = 'warning';
    }
    const pipelineRow = await persistMetric({
      datasetKey: entry.datasetKey,
      metricType: 'pipeline_health',
      metricValue: Math.round(pipelineSuccessPct),
      metricUnit: 'percent',
      threshold: PIPELINE_CRITICAL_PCT,
      status: pipelineStatus,
      message:
        totalRuns === 0
          ? 'No pipeline runs in last 24h'
          : `${completedRuns}/${totalRuns} runs succeeded in last 24h`,
    });
    if (pipelineRow) created.push(pipelineRow);
  }

  return created.map(mapMetric);
}

/** Insert one DataObservabilityMetric row. Defensive — never throws. */
async function persistMetric(input: {
  datasetKey: string;
  metricType: ObservabilityMetricType;
  metricValue: number;
  metricUnit: string;
  threshold: number;
  status: ObservabilityStatus;
  message: string;
}): Promise<PrismaObservabilityRow | null> {
  try {
    return await db.dataObservabilityMetric.create({
      data: {
        datasetKey: input.datasetKey,
        metricType: input.metricType,
        metricValue: input.metricValue,
        metricUnit: input.metricUnit,
        threshold: input.threshold,
        status: input.status,
        message: input.message,
        measuredAt: new Date(),
      },
    });
  } catch {
    return null;
  }
}

// ─── Read API ─────────────────────────────────────────────────────────────────

/** Latest metric per (datasetKey, metricType) in the last 24h, newest first. */
export async function getObservabilityMetrics(): Promise<
  DataObservabilityMetric[]
> {
  return cached('di:observability:metrics', TTL.SHORT, async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await safeFindMany(() =>
      db.dataObservabilityMetric.findMany({
        where: { measuredAt: { gte: since } },
        orderBy: [{ measuredAt: 'desc' }],
        distinct: ['datasetKey', 'metricType'],
        take: 500,
      }),
    );
    return rows.map(mapMetric);
  });
}

/** Aggregate summary — byStatus, byMetricType, healthScore (weighted), criticalDatasets. */
export async function getObservabilitySummary(): Promise<ObservabilitySummary> {
  return cached('di:observability:summary', TTL.SHORT, async () => {
    const metrics = await getObservabilityMetrics();
    const totalMetrics = metrics.length;

    const byStatus = countBy(metrics, (m) => m.status);
    const byMetricType = countBy(metrics, (m) => m.metricType);

    // Weighted health score: healthy=1.0, warning=0.5, critical=0, down=0.
    const weight: Record<ObservabilityStatus, number> = {
      healthy: 1.0,
      warning: 0.5,
      critical: 0.0,
      down: 0.0,
    };
    const healthScore =
      totalMetrics > 0
        ? Math.round(
            (metrics.reduce(
              (sum, m) => sum + (weight[m.status] ?? 0),
              0,
            ) /
              totalMetrics) *
              100,
          )
        : 100;

    const criticalDatasets = new Set(
      metrics.filter((m) => m.status === 'critical').map((m) => m.datasetKey),
    ).size;

    return {
      totalMetrics,
      byStatus,
      byMetricType,
      healthScore,
      criticalDatasets,
    };
  });
}

/** Per-connector health snapshot — stale flag derived from syncInterval. */
export async function getConnectorHealth(): Promise<ConnectorHealth[]> {
  return cached('di:observability:connectors', TTL.SHORT, async () => {
    const connections = await safeFindMany(() =>
      db.dataConnection.findMany({
        select: {
          id: true,
          label: true,
          type: true,
          status: true,
          lastSyncAt: true,
          syncInterval: true,
        },
      }),
    );
    const nowMs = Date.now();
    return connections.map((c) => {
      const intervalMin = parseSyncIntervalMinutes(c.syncInterval);
      const lastMs = c.lastSyncAt ? c.lastSyncAt.getTime() : 0;
      const elapsedMin = lastMs > 0 ? (nowMs - lastMs) / 60_000 : Number.POSITIVE_INFINITY;
      const stale = elapsedMin > intervalMin;
      return {
        id: c.id,
        label: c.label,
        type: c.type,
        status: c.status,
        lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
        syncInterval: c.syncInterval,
        stale,
      };
    });
  });
}

// safeCount re-exported for callers that want to count without crashing.
export { safeCount };
