// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Data Intelligence Cloud™ (UNIFIED ENTERPRISE DATA BRAIN)
// Orchestrator — single entry point that bundles all 12 subsystems into one
// DataIntelligenceDashboard for the Executive API: /api/data/dashboard
//
// Every Data Point. One Enterprise Brain. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { cached, TTL } from './helpers';
import type { DataIntelligenceDashboard } from './types';

import {
  discoverAndCatalogDatasets,
  getCatalog,
  getFabricSummary,
} from './catalog';
import { getLineage, getLineageSummary } from './lineage';
import { buildMasterData, getMasterData, getMasterDataSummary } from './master-data';
import { getPipelineRuns, getPipelineSummary } from './pipeline';
import { getQualityIssues, getQualitySummary } from './quality';
import {
  getObservabilityMetrics,
  getObservabilitySummary,
  measureObservability,
} from './observability';
import { getGovernanceSummary, seedGovernancePoliciesIfMissing } from './governance';
import { buildSearchIndex, getSearchIndexSummary } from './search';
import { getDiscoveries, getDiscoverySummary, runDiscovery } from './discovery';
import { computeAnalytics, getAnalyticsSummary, getLatestAnalytics } from './analytics';
import { generateForecasts, getActiveForecasts, getForecastSummary } from './predictions';
import { getSyntheses, getSynthesisSummary, synthesizeKnowledge } from './synthesis';
import { countBy } from './helpers';

/**
 * One-time warm-up: discover the catalog, build master data, seed governance
 * policies, and run the heavier detectors/analysers/synthesizers so the
 * dashboard has REAL rows to aggregate. Cached so it only runs once per TTL.
 */
async function warmUpDataFabric(): Promise<void> {
  await cached('di:warmup', TTL.LONG, async () => {
    // 1. Catalog discovery + Fabric
    await discoverAndCatalogDatasets().catch(() => undefined);
    // 2. Master Data golden records
    await buildMasterData().catch(() => undefined);
    // 3. Governance canonical policies
    await seedGovernancePoliciesIfMissing().catch(() => undefined);
    // 4. Build the enterprise search index
    await buildSearchIndex().catch(() => undefined);
    // 5. Compute analytics snapshots (revenue/cost/profitability/...)
    await computeAnalytics().catch(() => undefined);
    // 6. Generate predictive forecasts
    await generateForecasts().catch(() => undefined);
    // 7. Run AI data discovery detectors
    await runDiscovery().catch(() => undefined);
    // 8. Measure data observability metrics
    await measureObservability().catch(() => undefined);
    // 9. Synthesize executive knowledge summaries
    await synthesizeKnowledge().catch(() => undefined);
    return true;
  });
}

/**
 * Build the unified Data Intelligence Dashboard bundle.
 * Pulls all 12 subsystem summaries + recent records into one response.
 */
export async function getDataIntelligenceDashboard(): Promise<DataIntelligenceDashboard> {
  // Ensure catalog + master data + governance exist before aggregating.
  await warmUpDataFabric();

  return cached<DataIntelligenceDashboard>(
    'di:dashboard',
    TTL.MEDIUM,
    async () => {
      // ── Run all summaries + recent-record fetches in parallel ──
      const [
        fabric,
        catalogRows,
        lineageSummary,
        lineageRecent,
        pipelineSummary,
        pipelineRecent,
        masterSummary,
        masterRecent,
        qualitySummary,
        qualityRecent,
        searchSummary,
        discoverySummary,
        discoveryRecent,
        analyticsSummary,
        analyticsLatest,
        forecastSummary,
        forecastsActive,
        governanceSummary,
        observabilitySummary,
        observabilityRecent,
        synthesisSummary,
        synthesisRecent,
      ] = await Promise.all([
        getFabricSummary(),
        getCatalog(),
        getLineageSummary(),
        getLineage(undefined, 20),
        getPipelineSummary(),
        getPipelineRuns(20),
        getMasterDataSummary(),
        getMasterData(undefined),
        getQualitySummary(),
        getQualityIssues(),
        getSearchIndexSummary(),
        getDiscoverySummary(),
        getDiscoveries(),
        getAnalyticsSummary(),
        getLatestAnalytics(),
        getForecastSummary(),
        getActiveForecasts(),
        getGovernanceSummary(),
        getObservabilitySummary(),
        getObservabilityMetrics(),
        getSynthesisSummary(),
        getSyntheses(undefined),
      ]);

      // ── Catalog breakdowns (computed from real rows) ──
      const byDomain = countBy(catalogRows, (r) => r.domain);
      const bySourceSystem = countBy(catalogRows, (r) => r.sourceSystem);
      const bySensitivity = countBy(catalogRows, (r) => r.sensitivity);
      const staleDatasets = catalogRows.filter(
        (r) => r.freshnessLagMin > 1440,
      ).length;
      const avgQualityScore =
        catalogRows.length > 0
          ? Math.round(
              catalogRows.reduce((s, r) => s + r.qualityScore, 0) /
                catalogRows.length,
            )
          : 100;

      // ── Master data recent records (slice) ──
      const masterRecentSliced = masterRecent.slice(0, 12);

      // ── Quality recent issues (slice) ──
      const qualityRecentSliced = qualityRecent.slice(0, 20);

      // ── Discovery recent insights (slice) ──
      const discoveryRecentSliced = discoveryRecent.slice(0, 16);

      // ── Analytics latest snapshots ──
      const analyticsLatestSliced = analyticsLatest.slice(0, 12);

      // ── Forecasts active (slice) ──
      const forecastsActiveSliced = forecastsActive.slice(0, 16);

      // ── Governance: compliance frameworks from summary ──
      const complianceFrameworks = governanceSummary.complianceFrameworks;
      const observabilityRecentSliced = observabilityRecent.slice(0, 20);

      // ── Synthesis recent (slice) ──
      const synthesisRecentSliced = synthesisRecent.slice(0, 12);

      return {
        generatedAt: new Date().toISOString(),

        fabric: {
          connectedModules: fabric.connectedModules,
          totalDatasets: fabric.totalDatasets,
          totalRecords: fabric.totalRecords,
          totalSizeBytes: fabric.totalSizeBytes,
          connectionGraph: fabric.perModule.map((m) => ({
            module: m.module,
            datasets: m.datasets,
            records: m.records,
          })),
        },

        catalog: {
          totalDatasets: catalogRows.length,
          byDomain,
          bySourceSystem,
          bySensitivity,
          staleDatasets,
          avgQualityScore,
          recentEntries: catalogRows.slice(0, 12),
        },

        lineage: {
          totalEvents: lineageSummary.totalEvents,
          byEventType: lineageSummary.byEventType,
          byActorType: lineageSummary.byActorType,
          recentEvents: lineageRecent,
          replayableCount: lineageSummary.replayableCount,
        },

        pipelines: {
          totalRuns: pipelineSummary.totalRuns,
          activeRuns: pipelineSummary.activeRuns,
          completedToday: pipelineSummary.completedToday,
          failedToday: pipelineSummary.failedToday,
          totalRecordsIngested: pipelineSummary.totalRecordsIngested,
          avgLatencyMs: pipelineSummary.avgLatencyMs,
          recentRuns: pipelineRecent,
        },

        masterData: {
          totalGoldenRecords: masterSummary.totalGoldenRecords,
          byEntityType: masterSummary.byEntityType,
          duplicatesMerged: masterSummary.duplicatesMerged,
          avgConfidence: masterSummary.avgConfidence,
          recentRecords: masterRecentSliced,
        },

        quality: {
          totalIssues: qualitySummary.totalIssues,
          bySeverity: qualitySummary.bySeverity,
          byCategory: qualitySummary.byCategory,
          openIssues: qualitySummary.openIssues,
          avgQualityScore: qualitySummary.avgQualityScore,
          recentIssues: qualityRecentSliced,
        },

        search: {
          indexedRecords: searchSummary.indexedRecords,
          byRecordType: searchSummary.byRecordType,
          bySourceSystem: searchSummary.bySourceSystem,
          lastIndexedAt: searchSummary.lastIndexedAt,
        },

        discovery: {
          totalInsights: discoverySummary.totalInsights,
          byType: discoverySummary.byType,
          newInsights: discoverySummary.newInsights,
          totalImpactINR: discoverySummary.totalImpactINR,
          recentInsights: discoveryRecentSliced,
        },

        analytics: {
          totalSnapshots: analyticsSummary.totalSnapshots,
          byType: analyticsSummary.byType,
          latestSnapshots: analyticsLatestSliced,
        },

        predictions: {
          totalForecasts: forecastSummary.totalForecasts,
          byType: forecastSummary.byType,
          byHorizon: forecastSummary.byHorizon,
          avgConfidence: forecastSummary.avgConfidence,
          activeForecasts: forecastsActiveSliced,
        },

        governance: {
          totalPolicies: governanceSummary.totalPolicies,
          byType: governanceSummary.byType,
          bySensitivity: governanceSummary.bySensitivity,
          complianceFrameworks,
          coveragePct: governanceSummary.coveragePct,
        },

        observability: {
          totalMetrics: observabilitySummary.totalMetrics,
          byStatus: observabilitySummary.byStatus,
          byMetricType: observabilitySummary.byMetricType,
          healthScore: observabilitySummary.healthScore,
          criticalDatasets: observabilitySummary.criticalDatasets,
          recentMetrics: observabilityRecentSliced,
        },

        synthesis: {
          totalSummaries: synthesisSummary.totalSummaries,
          byType: synthesisSummary.byType,
          byAudience: synthesisSummary.byAudience,
          recentSummaries: synthesisRecentSliced,
        },
      };
    },
  );
}
