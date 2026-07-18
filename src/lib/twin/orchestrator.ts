// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT DIGITAL TWIN™ — ORCHESTRATOR
//
// Combines all Digital Twin engines into a single DigitalTwinBundle:
//   • Live Business State    (live-state.ts)
//   • Business Timeline™     (timeline.ts)
//   • Business Snapshots™    (snapshots.ts)
//   • Live KPI Engine™       (kpis.ts)
//   • Anomaly Detection™     (anomaly.ts)
//   • Forecast Engine        (forecast.ts)
//
// Pure server-side TypeScript. Never throws — on any engine failure, returns a
// partial bundle with empty states so the API never breaks. Every value comes
// from REAL connected business data.
//
// Tagline: "GSTPilot Digital Twin™ — Remember Everything. Understand Everything.
//           Simulate Everything. Predict Everything."
// ═══════════════════════════════════════════════════════════════════════════════

import { computeLiveBusinessState } from './live-state';
import { computeBusinessTimeline } from './timeline';
import { computeSnapshotBundle } from './snapshots';
import { computeLiveKPIs } from './kpis';
import { detectAnomalies } from './anomaly';
import { computeTwinForecast } from './forecast';
import { fetchLatestSnapshot } from './snapshots';
import { fetchRecentTimelineEvents } from './timeline';
import { computeLiveStateLite } from './live-state';
import { fetchRawCFOData } from '@/lib/cfo/phase1/data';
import { getBusinessSnapshot } from '@/lib/business/snapshot';
import { TWIN_TAGLINE } from './types';
import type { DigitalTwinBundle, TwinOracleContext } from './types';

// ─── Safe wrappers (engine failures don't break the bundle) ──────────────────

function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  return fn().catch((err) => {
    console.warn(`[Digital Twin] Engine "${label}" failed:`, err);
    return fallback;
  });
}

function safeSync<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[Digital Twin] Engine "${label}" failed:`, err);
    return fallback;
  }
}

// ─── Empty fallbacks ─────────────────────────────────────────────────────────

const EMPTY_STATE: DigitalTwinBundle['state'] = {
  revenue: 0, profit: 0, cash: 0, workingCapital: 0, gstPosition: 0, itc: 0,
  employees: 0, payroll: 0, collections: 0, receivables: 0, payables: 0,
  expenses: 0, inventory: 0, assets: 0, loans: 0, bankAccounts: [],
  clients: 0, vendors: 0, healthScore: 0, riskScore: 0, compliance: 0,
  forecast: { revenue30d: 0, cash30d: 0, profit30d: 0, gstLiabilityNext: 0, confidencePct: 0 },
  asOf: new Date().toISOString(), hasLiveData: false, dataSources: [],
};

const EMPTY_TIMELINE: DigitalTwinBundle['timeline'] = {
  events: [], totalCount: 0, todayCount: 0, asOf: new Date().toISOString(),
};

const EMPTY_SNAPSHOTS: DigitalTwinBundle['snapshots'] = {
  daily: [], weekly: [], monthly: [], quarterly: [], yearly: [],
  comparisons: {
    todayVsYesterday: { current: {} as never, previous: null, deltas: [], summary: 'No data' },
    thisMonthVsLastMonth: { current: {} as never, previous: null, deltas: [], summary: 'No data' },
    thisYearVsLastYear: { current: {} as never, previous: null, deltas: [], summary: 'No data' },
  },
  asOf: new Date().toISOString(),
};

const EMPTY_KPIS: DigitalTwinBundle['kpis'] = {
  revenue: 0, profit: 0, cash: 0, ebitda: 0, runwayDays: 0, burnRate: 0,
  workingCapital: 0, customerLifetimeValue: 0, averageCollectionTime: 0,
  averagePaymentTime: 0, vendorReliability: 0, clientReliability: 0,
  businessGrowthPct: 0, asOf: new Date().toISOString(),
};

const EMPTY_ANOMALIES: DigitalTwinBundle['anomalies'] = {
  anomalies: [], totalCount: 0, criticalCount: 0, highCount: 0,
  asOf: new Date().toISOString(), scannedMetrics: [],
};

const EMPTY_FORECAST: DigitalTwinBundle['forecast'] = {
  revenue: { sevenDay: 0, thirtyDay: 0, ninetyDay: 0, yearEnd: 0, confidencePct: 0 },
  cashFlow: { sevenDay: 0, thirtyDay: 0, ninetyDay: 0, yearEnd: 0, confidencePct: 0 },
  profit: { sevenDay: 0, thirtyDay: 0, ninetyDay: 0, yearEnd: 0, confidencePct: 0 },
  gstLiability: { nextFiling: 0, next30d: 0, confidencePct: 0 },
  expenses: { thirtyDay: 0, ninetyDay: 0, confidencePct: 0 },
  collections: { thirtyDay: 0, ninetyDay: 0, confidencePct: 0 },
  overallConfidencePct: 0, generatedAt: new Date().toISOString(),
};

// ─── Main: compute the full Digital Twin bundle ──────────────────────────────

export async function computeDigitalTwinBundle(): Promise<DigitalTwinBundle> {
  const [state, timeline, snapshots, kpis, anomalies, forecast] = await Promise.all([
    safe('live-state', () => computeLiveBusinessState(), EMPTY_STATE),
    safe('timeline', () => computeBusinessTimeline(200), EMPTY_TIMELINE),
    safe('snapshots', () => computeSnapshotBundle(), EMPTY_SNAPSHOTS),
    safe('kpis', () => computeLiveKPIs(), EMPTY_KPIS),
    safe('anomalies', () => detectAnomalies(), EMPTY_ANOMALIES),
    safe('forecast', () => computeTwinForecast(), EMPTY_FORECAST),
  ]);

  // Determine if we have ANY live data
  const hasLiveData = state.hasLiveData || timeline.totalCount > 0 || kpis.revenue > 0;

  // Collect all data sources
  const dataSources = Array.from(new Set([
    ...state.dataSources,
    ...(timeline.totalCount > 0 ? ['Activities'] : []),
  ])).sort();

  return {
    state,
    timeline,
    snapshots,
    kpis,
    anomalies,
    forecast,
    asOf: new Date().toISOString(),
    hasLiveData,
    dataSources,
    tagline: TWIN_TAGLINE,
  };
}

// ─── Oracle context (compact — injected into Oracle chat) ────────────────────
//
// Headline financials (healthScore, riskScore, revenue, profit, cash,
// runwayDays) are sourced from the canonical Business Snapshot — the single
// source of truth — so Oracle chat sees EXACTLY the same numbers as the Home
// Dashboard, AI CFO, and Run Business pages. Twin-specific fields (today's
// event count, recent events, latest snapshot, anomaly counts, data sources)
// remain local to the twin engine.

export async function computeTwinOracleContext(organizationId?: string): Promise<TwinOracleContext> {
  const orgId = organizationId ?? '';

  // Fetch the canonical snapshot in parallel with twin-specific data.
  // The snapshot provides healthScore, riskScore, revenue, profit, cash, runwayDays.
  const [snapshot, recentEvents, latestSnapshot, anomalies, data, lite] = await Promise.all([
    safe('business-snapshot', () => orgId ? getBusinessSnapshot(orgId) : Promise.resolve(null), null),
    safe('recent-events', () => fetchRecentTimelineEvents(8), []),
    safe('latest-snapshot', () => fetchLatestSnapshot(), undefined),
    safe('anomalies', () => detectAnomalies(organizationId), EMPTY_ANOMALIES),
    safe('raw-data', () => fetchRawCFOData(orgId), {
      invoices: [], expenses: [], payments: [], purchaseBills: [], clients: [],
      filings: [], notices: [], employees: [], syncedRecords: [], dataConnections: [],
      fetchedAt: new Date().toISOString(), hasLiveData: false, dataSources: [],
    }),
    // Lite state is now only a fallback for the case where the snapshot is unavailable.
    safe('live-state-lite', () => computeLiveStateLite(), {
      revenue: 0, profit: 0, cash: 0, healthScore: 0, riskScore: 0, runwayDays: 0, hasLiveData: false,
    }),
  ]);

  // Count today's events
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEventCount = recentEvents.filter(
    (e) => new Date(e.timestamp) >= todayStart,
  ).length;

  // ── Headline values: prefer canonical snapshot, fall back to twin lite state ──
  // This guarantees Oracle chat sees the same healthScore / riskScore / revenue
  // / profit / cash / runwayDays as every other page that reads the snapshot.
  const healthScore = snapshot?.healthScore ?? lite.healthScore;
  const riskScore = snapshot?.riskScore ?? lite.riskScore;
  // snapshot.revenueThisMonth preserves the MTD semantic the twin expects.
  const revenue = snapshot?.revenueThisMonth ?? lite.revenue;
  const profit = snapshot?.profit ?? lite.profit;
  const cash = snapshot?.cash ?? lite.cash;
  const runwayDays = snapshot?.runwayDays ?? lite.runwayDays;
  const hasLiveData = snapshot ? (snapshot.revenue > 0 || snapshot.cash > 0 || snapshot.invoiceCount > 0) : lite.hasLiveData;

  return {
    healthScore,
    riskScore,
    revenue,
    profit,
    cash,
    runwayDays,
    todayEventCount,
    recentEvents,
    latestSnapshot,
    activeAnomalies: anomalies.totalCount,
    criticalAnomalies: anomalies.criticalCount,
    dataSources: data.dataSources,
    hasLiveData,
  };
}

// ─── Cache layer (60s TTL) ───────────────────────────────────────────────────

let cachedBundle: { data: DigitalTwinBundle; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getCachedDigitalTwinBundle(): Promise<DigitalTwinBundle> {
  if (cachedBundle && Date.now() - cachedBundle.ts < CACHE_TTL_MS) {
    return cachedBundle.data;
  }
  const bundle = await computeDigitalTwinBundle();
  cachedBundle = { data: bundle, ts: Date.now() };
  return bundle;
}

export function invalidateTwinCache(): void {
  cachedBundle = null;
}

// ─── Sync helper (used by API routes to ensure safe access) ──────────────────

export function safeBundleAccess<T>(fn: () => T): T {
  return safeSync('bundle-access', fn, {} as T);
}
