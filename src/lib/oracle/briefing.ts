// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Intelligence Engine — Briefing Assembler
//
// Turns a collected dataset + ranked signals into the final OracleBriefing
// JSON: headline, executive summary, health score, metrics panel, top actions,
// and per-source coverage.
//
// No LLM call — this is a deterministic, fully-auditable transformation. An
// LLM layer can later wrap this for prose polish, but the structure is fixed
// here so the engine always returns a usable briefing even if the LLM is down.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BriefingAction,
  BriefingMetric,
  BriefingSourceStatus,
  CollectedDataset,
  OracleBriefing,
  RankedSignal,
  Signal,
} from './types';

const ENGINE_VERSION = '1.0.0';

// ─── Health score ─────────────────────────────────────────────────────────────

/**
 * Compute an overall business health score (0–100) from the ranked signals.
 *
 * FALLBACK ONLY — used when no canonical Business Snapshot is available.
 *
 * The CANONICAL Health Score lives in `src/lib/business/snapshot.ts` →
 * `computeHealthScore()` and is exposed via `getBusinessSnapshot(orgId).healthScore`.
 * `assembleBriefing` accepts an optional `canonicalHealthScore` input that, when
 * provided, OVERRIDES this signal-based fallback so the Oracle briefing always
 * shows the same Health Score as the Home Dashboard / AI CFO / Run Business.
 *
 * Starts at 100 and subtracts based on problem severity; adds a small bonus
 * for opportunities (capped). The score is bounded to [0, 100].
 */
function computeHealthScore(signals: RankedSignal[]): number {
  let score = 100;
  const penalties: Record<string, number> = {
    critical: 18,
    high: 9,
    medium: 4,
    low: 1,
  };
  for (const s of signals) {
    if (s.kind === 'problem') {
      score -= penalties[s.severity] ?? 0;
    } else if (s.kind === 'opportunity') {
      score += s.severity === 'high' ? 1.5 : s.severity === 'medium' ? 1 : 0.5;
    }
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Headline + summary ────────────────────────────────────────────────────────

function buildHeadline(signals: RankedSignal[]): string {
  if (signals.length === 0) {
    return 'No active signals — your business is running clean.';
  }
  const top = signals[0];
  if (top.severity === 'critical' || top.severity === 'high') {
    return top.title;
  }
  // If the top signal is low/info, frame it positively.
  if (top.kind === 'opportunity') {
    return `Opportunity: ${top.title}`;
  }
  return top.title;
}

function buildSummary(signals: RankedSignal[], coverage: { connected: number; total: number }): string {
  const problems = signals.filter((s) => s.kind === 'problem');
  const opportunities = signals.filter((s) => s.kind === 'opportunity');
  const criticals = problems.filter((s) => s.severity === 'critical');
  const highs = problems.filter((s) => s.severity === 'high');

  if (signals.length === 0) {
    return coverage.connected === 0
      ? 'No data sources are connected yet. Connect Google Workspace, bank accounts, or import invoices to begin receiving intelligence.'
      : 'All connected data sources are healthy — no problems or opportunities detected in this scan.';
  }

  const parts: string[] = [];
  if (criticals.length > 0) {
    parts.push(`${criticals.length} critical issue${criticals.length === 1 ? '' : 's'} need${criticals.length === 1 ? 's' : ''} immediate attention`);
  }
  if (highs.length > 0) {
    parts.push(`${highs.length} high-priority item${highs.length === 1 ? '' : 's'} pending`);
  }
  if (opportunities.length > 0) {
    parts.push(`${opportunities.length} opportunit${opportunities.length === 1 ? 'y' : 'ies'} available`);
  }
  if (parts.length === 0) {
    parts.push(`${signals.length} signal${signals.length === 1 ? '' : 's'} reviewed`);
  }
  const lead = parts.join(', ') + '.';
  const followup =
    criticals.length > 0
      ? ` Top priority: ${criticals[0].title}.`
      : highs.length > 0
        ? ` Next up: ${highs[0].title}.`
        : '';
  return lead + followup;
}

// ─── Metrics panel ─────────────────────────────────────────────────────────────

const METRIC_DEFS: Array<{
  key: string;
  label: string;
  unit: 'inr' | 'count' | 'percent' | 'days';
}> = [
  { key: 'totalCash', label: 'Total Cash', unit: 'inr' },
  { key: 'netFlow30d', label: 'Net Flow (30d)', unit: 'inr' },
  { key: 'runwayDays', label: 'Cash Runway', unit: 'days' },
  { key: 'salesOutstanding', label: 'Sales Outstanding', unit: 'inr' },
  { key: 'overdueAmount', label: 'Overdue Receivables', unit: 'inr' },
  { key: 'pendingReturns', label: 'Pending GST Returns', unit: 'count' },
  { key: 'openNotices', label: 'Open GST Notices', unit: 'count' },
  { key: 'itcMismatched', label: 'ITC Mismatched', unit: 'inr' },
  { key: 'itcAvailable', label: 'ITC Available', unit: 'inr' },
  { key: 'outputTaxLiability', label: 'Output Tax Liability', unit: 'inr' },
  { key: 'upcomingDeadlines7d', label: 'Deadlines (7d)', unit: 'count' },
  { key: 'weekEventLoad', label: 'Meetings (7d)', unit: 'count' },
];

function buildMetrics(analyzerMetrics: Record<string, Record<string, number>>): BriefingMetric[] {
  // Merge all analyzer metrics into one flat map.
  const merged: Record<string, number> = {};
  for (const am of Object.values(analyzerMetrics)) {
    for (const [k, v] of Object.entries(am)) {
      // Skip Infinity/NaN — JSON-serialize to 999 for display.
      merged[k] = Number.isFinite(v) ? v : 999;
    }
  }

  const out: BriefingMetric[] = [];
  for (const def of METRIC_DEFS) {
    if (def.key in merged) {
      out.push({ key: def.key, label: def.label, value: merged[def.key], unit: def.unit });
    }
  }
  return out;
}

// ─── Top actions ───────────────────────────────────────────────────────────────

function actionForSignal(signal: Signal): BriefingAction {
  return {
    signalId: signal.id,
    title: signal.title,
    why: signal.description,
    step: signal.recommendation,
    link: signal.evidence[0]?.link,
    impact: signal.monetaryValue,
  };
}

function buildTopActions(signals: RankedSignal[]): BriefingAction[] {
  // Prefer problems first, then opportunities. Take top 5.
  const problems = signals.filter((s) => s.kind === 'problem');
  const opportunities = signals.filter((s) => s.kind === 'opportunity');
  const ordered = [...problems, ...opportunities];
  return ordered.slice(0, 5).map(actionForSignal);
}

// ─── Source status panel ──────────────────────────────────────────────────────

function buildSources(dataset: CollectedDataset, labels: Record<string, string>): BriefingSourceStatus[] {
  return Object.values(dataset).map((r) => ({
    source: r.source,
    label: labels[r.source] ?? r.source,
    connected: r.connected,
    recordCount: r.recordCount,
    error: r.error,
  }));
}

// ─── Assembler ────────────────────────────────────────────────────────────────

export interface AssembleInput {
  userId: string;
  dataset: CollectedDataset;
  signals: RankedSignal[];
  analyzerMetrics: Record<string, Record<string, number>>;
  collectorLabels: Record<string, string>;
  /**
   * Optional canonical Health Score from the centralized Business Snapshot
   * (`getBusinessSnapshot(orgId).healthScore`). When provided, this OVERRIDES
   * the signal-based fallback so every surface shows the same score.
   */
  canonicalHealthScore?: number;
}

export function assembleBriefing(input: AssembleInput): OracleBriefing {
  const { userId, dataset, signals, analyzerMetrics, collectorLabels, canonicalHealthScore } = input;

  const sourceStatuses = buildSources(dataset, collectorLabels);
  const connected = sourceStatuses.filter((s) => s.connected).length;
  const total = sourceStatuses.length;
  const coverage = { connected, disconnected: total - connected, total };

  const fallbackScore = computeHealthScore(signals);
  const healthScore =
    typeof canonicalHealthScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(canonicalHealthScore)))
      : fallbackScore;
  const headline = buildHeadline(signals);
  const summary = buildSummary(signals, coverage);
  const metrics = buildMetrics(analyzerMetrics);
  const topActions = buildTopActions(signals);

  return {
    generatedAt: new Date().toISOString(),
    userId,
    headline,
    summary,
    healthScore,
    metrics,
    signals,
    topActions,
    sources: sourceStatuses,
    coverage,
    version: ENGINE_VERSION,
  };
}
