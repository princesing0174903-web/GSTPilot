// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Data Intelligence Cloud™
// Subsystem 10: AI Knowledge Synthesis™ — synthesize executive intelligence from
// REAL aggregated data. Produces narrative summaries for CEO / CFO / COO / Board
// audiences covering executive, financial, operational, risk, growth and
// relationship intelligence. Every metric is computed from production Prisma data.
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
  DataKnowledgeSynthesis,
  SynthesisType,
  SynthesisAudience,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SCAN = 10_000;

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

interface SynthesisInput {
  synthesisType: SynthesisType;
  title: string;
  summary: string;
  keyPoints: string[];
  sourceDatasetKeys: string[];
  confidenceScore: number;
  audience: SynthesisAudience;
}

interface PrismaSynthesisRow {
  id: string;
  synthesisType: string;
  title: string;
  summary: string;
  keyPoints: string;
  sourceDatasetKeys: string;
  confidenceScore: number;
  audience: string;
  generatedAt: Date;
  createdAt: Date;
}

function mapSynthesis(row: PrismaSynthesisRow): DataKnowledgeSynthesis {
  return {
    id: row.id,
    synthesisType: row.synthesisType as SynthesisType,
    title: row.title,
    summary: row.summary,
    keyPoints: parseJson<string[]>(row.keyPoints, []),
    sourceDatasetKeys: parseJson<string[]>(row.sourceDatasetKeys, []),
    confidenceScore: row.confidenceScore,
    audience: row.audience as SynthesisAudience,
    generatedAt: row.generatedAt.toISOString(),
  };
}

async function persistSynthesis(
  input: SynthesisInput,
): Promise<DataKnowledgeSynthesis | null> {
  try {
    const row = await db.dataKnowledgeSynthesis.create({
      data: {
        synthesisType: input.synthesisType,
        title: input.title,
        summary: input.summary,
        keyPoints: JSON.stringify(input.keyPoints),
        sourceDatasetKeys: JSON.stringify(input.sourceDatasetKeys),
        confidenceScore: input.confidenceScore,
        audience: input.audience,
      },
    });
    return mapSynthesis(row as unknown as PrismaSynthesisRow);
  } catch {
    return null;
  }
}

// ─── Synthesizers ────────────────────────────────────────────────────────────

/** executive_summary (audience=ceo) — top-level narrative across the enterprise. */
async function synthesizeExecutiveSummary(): Promise<SynthesisInput> {
  const totalClients = await safeCount(() => db.client.count());

  const revenueAgg = await safeAggregate(() =>
    db.invoice.aggregate({ _sum: { totalAmount: true } }),
  );
  const totalRevenue = revenueAgg?._sum?.totalAmount ?? 0;

  const gstAgg = await safeAggregate(() =>
    db.gSTRFiling.aggregate({ _sum: { totalTax: true } }),
  );
  const totalGSTLiability = gstAgg?._sum?.totalTax ?? 0;

  const openRisks = await safeCount(() =>
    db.complianceRisk.count({ where: { status: 'open' } }),
  );

  const activeExecutions = await safeCount(() =>
    db.executionJob.count({ where: { status: 'running' } }),
  );

  const asOf = new Date().toISOString().substring(0, 10);

  const summary = `As of ${asOf}, the enterprise serves ${totalClients} client(s) with cumulative invoiced revenue of ${formatINR(
    totalRevenue,
  )} and total GST liability of ${formatINR(
    totalGSTLiability,
  )}. ${openRisks} compliance risk(s) remain open and ${activeExecutions} execution job(s) are currently running. VEYRO AI continues to monitor all connected systems and is positioned to surface the next set of recommended actions as new data lands.`;

  const keyPoints = [
    `Total clients: ${totalClients}`,
    `Cumulative revenue: ${formatINR(totalRevenue)}`,
    `GST liability: ${formatINR(totalGSTLiability)}`,
    `Open compliance risks: ${openRisks}`,
    `Active execution jobs: ${activeExecutions}`,
  ];

  return {
    synthesisType: 'executive_summary',
    title: `Executive Summary — ${asOf}`,
    summary,
    keyPoints,
    sourceDatasetKeys: ['client', 'invoice', 'gstr_filing', 'compliance_risk', 'execution_job'],
    confidenceScore: 0.8,
    audience: 'ceo',
  };
}

/** financial_intelligence (audience=cfo) — full financial posture. */
async function synthesizeFinancialIntelligence(): Promise<SynthesisInput> {
  const revenueAgg = await safeAggregate(() =>
    db.invoice.aggregate({ _sum: { totalAmount: true } }),
  );
  const revenue = revenueAgg?._sum?.totalAmount ?? 0;

  const expAgg = await safeAggregate(() =>
    db.payment.aggregate({ _sum: { amount: true } }),
  );
  const expenses = expAgg?._sum?.amount ?? 0;

  const recAgg = await safeAggregate(() =>
    db.invoice.aggregate({
      where: { OR: [{ paymentStatus: { not: 'paid' } }, { status: { not: 'paid' } }] },
      _sum: { balanceAmount: true, totalAmount: true },
    }),
  );
  const receivables =
    (recAgg?._sum?.balanceAmount ?? 0) > 0
      ? (recAgg?._sum?.balanceAmount ?? 0)
      : (recAgg?._sum?.totalAmount ?? 0);

  const cashAgg = await safeAggregate(() =>
    db.payment.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    }),
  );
  const cash = cashAgg?._sum?.amount ?? 0;

  const gstAgg = await safeAggregate(() =>
    db.gSTRFiling.aggregate({ _sum: { totalTax: true } }),
  );
  const gstLiability = gstAgg?._sum?.totalTax ?? 0;

  const payAgg = await safeAggregate(() =>
    db.employee.aggregate({ _sum: { salary: true } }),
  );
  const payroll = payAgg?._sum?.salary ?? 0;

  const net = revenue - expenses - gstLiability - payroll;

  const summary = `Financial position: revenue ${formatINR(revenue)}, operating expenses ${formatINR(
    expenses,
  )}, outstanding receivables ${formatINR(receivables)}, cash position ${formatINR(
    cash,
  )}, GST liability ${formatINR(gstLiability)}, monthly payroll cost ${formatINR(
    payroll,
  )}. Net operating margin after tax & payroll: ${formatINR(net)}.`;

  const keyPoints = [
    `Cumulative revenue: ${formatINR(revenue)}`,
    `Cumulative expenses (payments): ${formatINR(expenses)}`,
    `Outstanding receivables: ${formatINR(receivables)}`,
    `Cash position (completed payments): ${formatINR(cash)}`,
    `GST liability: ${formatINR(gstLiability)}`,
    `Monthly payroll (employee salary sum): ${formatINR(payroll)}`,
  ];

  return {
    synthesisType: 'financial_intelligence',
    title: 'Financial Intelligence — Revenue, Expense, Cash & Liability',
    summary,
    keyPoints,
    sourceDatasetKeys: ['invoice', 'payment', 'gstr_filing', 'employee'],
    confidenceScore: 0.8,
    audience: 'cfo',
  };
}

/** operational_intelligence (audience=coo) — execution health. */
async function synthesizeOperationalIntelligence(): Promise<SynthesisInput> {
  const jobs = await safeFindMany(() =>
    db.executionJob.findMany({
      select: { status: true, durationMs: true, module: true },
      take: MAX_SCAN,
    }),
  );
  const byStatus = countBy(jobs, (j) => j.status);
  const failed = jobs.filter((j) => j.status === 'failed').length;
  const completed = jobs.filter(
    (j) => j.status === 'completed' && j.durationMs > 0,
  );
  const avgCompletionMs =
    completed.length > 0
      ? completed.reduce((acc, j) => acc + j.durationMs, 0) / completed.length
      : 0;

  const openAlerts = await safeCount(() =>
    db.cEOAlert.count({ where: { acknowledged: false } }),
  );

  const topModules = Object.entries(countBy(jobs, (j) => j.module))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, n]) => `${m}: ${n}`);

  const summary = `Operational posture across ${jobs.length} execution job(s): ${JSON.stringify(
    byStatus,
  )}. Average completion time: ${avgCompletionMs.toFixed(0)} ms across ${
    completed.length
  } completed job(s). ${failed} failed job(s) flagged for review. ${openAlerts} executive alert(s) await acknowledgement. Most active modules: ${topModules.join(
    ', ',
  ) || 'none'}.`;

  const keyPoints = [
    `Total execution jobs: ${jobs.length}`,
    `Status breakdown: ${JSON.stringify(byStatus)}`,
    `Average completion time: ${avgCompletionMs.toFixed(0)} ms`,
    `Failed jobs: ${failed}`,
    `Open CEO alerts: ${openAlerts}`,
  ];

  return {
    synthesisType: 'operational_intelligence',
    title: 'Operational Intelligence — Execution Health',
    summary,
    keyPoints,
    sourceDatasetKeys: ['execution_job', 'ceo_alert'],
    confidenceScore: 0.8,
    audience: 'coo',
  };
}

/** risk_map (audience=board) — aggregated risk across compliance, quality, alerts. */
async function synthesizeRiskMap(): Promise<SynthesisInput> {
  const complianceRisks = await safeFindMany(() =>
    db.complianceRisk.findMany({
      where: { status: 'open' },
      select: { riskType: true, severity: true, financialImpact: true, title: true },
      take: MAX_SCAN,
    }),
  );
  const qualityAlerts = await safeFindMany(() =>
    db.dataQualityAlert.findMany({
      where: { resolved: false },
      select: { category: true, severity: true, title: true, amount: true },
      take: MAX_SCAN,
    }),
  );
  const ceoAlerts = await safeFindMany(() =>
    db.cEOAlert.findMany({
      where: { acknowledged: false },
      select: { type: true, severity: true, title: true },
      take: MAX_SCAN,
    }),
  );

  const bySource: Record<string, number> = {
    compliance_risk: complianceRisks.length,
    data_quality_alert: qualityAlerts.length,
    ceo_alert: ceoAlerts.length,
  };
  const totalRisks = complianceRisks.length + qualityAlerts.length + ceoAlerts.length;

  const allSeverities = [
    ...complianceRisks.map((r) => r.severity),
    ...qualityAlerts.map((r) => r.severity),
    ...ceoAlerts.map((r) => r.severity),
  ];
  const bySeverity = countBy(allSeverities, (s) => s || 'unknown');

  const topRisks = [
    ...complianceRisks.slice(0, 3).map((r) => `[Compliance/${r.severity}] ${r.title}`),
    ...qualityAlerts.slice(0, 3).map((r) => `[Quality/${r.severity}] ${r.title}`),
    ...ceoAlerts.slice(0, 3).map((r) => `[Alert/${r.severity}] ${r.title}`),
  ];

  const totalFinancialImpact = complianceRisks.reduce(
    (acc, r) => acc + (r.financialImpact ?? 0),
    0,
  );

  const summary = `Risk landscape: ${totalRisks} open risk(s) across ${complianceRisks.length} compliance, ${qualityAlerts.length} data-quality, and ${ceoAlerts.length} executive alert channels. Severity mix: ${JSON.stringify(
    bySeverity,
  )}. Estimated financial exposure from compliance risks: ${formatINR(
    totalFinancialImpact,
  )}.`;

  const keyPoints = [
    `Total open risks: ${totalRisks}`,
    `By source: ${JSON.stringify(bySource)}`,
    `By severity: ${JSON.stringify(bySeverity)}`,
    `Compliance financial exposure: ${formatINR(totalFinancialImpact)}`,
    `Top risks: ${topRisks.slice(0, 5).join('; ') || 'none'}`,
  ];

  return {
    synthesisType: 'risk_map',
    title: 'Risk Map — Aggregated Enterprise Risk View',
    summary,
    keyPoints,
    sourceDatasetKeys: ['compliance_risk', 'data_quality_alert', 'ceo_alert'],
    confidenceScore: 0.8,
    audience: 'board',
  };
}

/** growth_map (audience=ceo) — client + revenue + market signals. */
async function synthesizeGrowthMap(): Promise<SynthesisInput> {
  const totalClients = await safeCount(() => db.client.count());
  const newClientsCutoff = new Date(Date.now() - 90 * DAY_MS);
  const newClients = await safeCount(() =>
    db.client.count({ where: { createdAt: { gte: newClientsCutoff } } }),
  );

  const recentCutoff = daysAgoISO(90);
  const priorCutoff = daysAgoISO(180);
  const recentInvAgg = await safeAggregate(() =>
    db.invoice.aggregate({
      where: { invoiceDate: { gte: recentCutoff } },
      _sum: { totalAmount: true },
    }),
  );
  const priorInvAgg = await safeAggregate(() =>
    db.invoice.aggregate({
      where: { invoiceDate: { gte: priorCutoff, lt: recentCutoff } },
      _sum: { totalAmount: true },
    }),
  );
  const recentRevenue = recentInvAgg?._sum?.totalAmount ?? 0;
  const priorRevenue = priorInvAgg?._sum?.totalAmount ?? 0;
  const revenueGrowthPct =
    priorRevenue > 0 ? ((recentRevenue - priorRevenue) / priorRevenue) * 100 : 0;

  const signals = await safeFindMany(() =>
    db.marketSignal.findMany({
      select: { category: true, impact: true, impactScore: true, headline: true },
      take: MAX_SCAN,
    }),
  );
  const signalsByCategory = countBy(signals, (s) => s.category);
  const topCategories = Object.entries(signalsByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c, n]) => `${c}: ${n}`);

  const summary = `Growth posture: ${newClients} new client(s) in last 90 days (total ${totalClients}). Revenue in last 90 days: ${formatINR(
    recentRevenue,
  )} vs prior 90 days ${formatINR(
    priorRevenue,
  )} (${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct.toFixed(
    1,
  )}%). Market signals tracked: ${signals.length} across ${Object.keys(signalsByCategory).length} categories — top: ${
    topCategories.join(', ') || 'none'
  }.`;

  const keyPoints = [
    `Total clients: ${totalClients}`,
    `New clients (90d): ${newClients}`,
    `Revenue (last 90d): ${formatINR(recentRevenue)}`,
    `Revenue (prior 90d): ${formatINR(priorRevenue)} (${revenueGrowthPct >= 0 ? '+' : ''}${revenueGrowthPct.toFixed(1)}%)`,
    `Market signals: ${signals.length} across top categories: ${topCategories.join(', ') || 'none'}`,
  ];

  return {
    synthesisType: 'growth_map',
    title: 'Growth Map — Clients, Revenue & Market Signals',
    summary,
    keyPoints,
    sourceDatasetKeys: ['client', 'invoice', 'market_signal'],
    confidenceScore: 0.8,
    audience: 'ceo',
  };
}

/** relationship_map (audience=all) — knowledge graph topology. */
async function synthesizeRelationshipMap(): Promise<SynthesisInput> {
  const nodeCount = await safeCount(() => db.knowledgeNode.count());
  const edgeCount = await safeCount(() => db.knowledgeEdge.count());

  const edges = await safeFindMany(() =>
    db.knowledgeEdge.findMany({
      select: { sourceId: true, targetId: true, relation: true, strength: true },
      take: MAX_SCAN,
    }),
  );
  const relationCounts = countBy(edges, (e) => e.relation);

  // Top connected nodes (most edge endpoints)
  const nodeEdgeCount = new Map<string, number>();
  for (const e of edges) {
    nodeEdgeCount.set(e.sourceId, (nodeEdgeCount.get(e.sourceId) ?? 0) + 1);
    nodeEdgeCount.set(e.targetId, (nodeEdgeCount.get(e.targetId) ?? 0) + 1);
  }
  const topNodeIds = Array.from(nodeEdgeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);
  const topNodes = await safeFindMany(() =>
    db.knowledgeNode.findMany({
      where: { id: { in: topNodeIds } },
      select: { id: true, label: true, kind: true },
    }),
  );
  const topConnected = topNodes
    .map((n) => `${n.label} (${n.kind}, ${nodeEdgeCount.get(n.id) ?? 0} edges)`)
    .filter(Boolean);

  const entityCount = await safeCount(() => db.globalEntity.count());

  const summary = `Knowledge graph: ${nodeCount} node(s) connected by ${edgeCount} edge(s) across ${
    Object.keys(relationCounts).length
  } relation type(s). Top relation types: ${Object.entries(relationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([r, n]) => `${r}: ${n}`)
    .join(', ') || 'none'}. ${entityCount} global enterprise entit(y/ies) tracked. Most connected nodes: ${
    topConnected.join('; ') || 'none'
  }.`;

  const keyPoints = [
    `Knowledge nodes: ${nodeCount}`,
    `Knowledge edges: ${edgeCount}`,
    `Relation types: ${JSON.stringify(relationCounts)}`,
    `Global entities: ${entityCount}`,
    `Top connected: ${topConnected.join('; ') || 'none'}`,
  ];

  return {
    synthesisType: 'relationship_map',
    title: 'Relationship Map — Knowledge Graph & Entity Topology',
    summary,
    keyPoints,
    sourceDatasetKeys: ['knowledge_node', 'knowledge_edge', 'global_entity'],
    confidenceScore: 0.8,
    audience: 'all',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Synthesize executive intelligence from REAL aggregated data and persist
 * DataKnowledgeSynthesis rows for all six synthesis types. Returns the list
 * of newly-created syntheses.
 */
export async function synthesizeKnowledge(): Promise<
  DataKnowledgeSynthesis[]
> {
  const synthesizers: Array<() => Promise<SynthesisInput>> = [
    synthesizeExecutiveSummary,
    synthesizeFinancialIntelligence,
    synthesizeOperationalIntelligence,
    synthesizeRiskMap,
    synthesizeGrowthMap,
    synthesizeRelationshipMap,
  ];

  const inputs = await Promise.all(synthesizers.map((fn) => fn()));
  const results = await Promise.all(inputs.map(persistSynthesis));
  return results.filter(
    (r): r is DataKnowledgeSynthesis => r !== null,
  );
}

/**
 * Return DataKnowledgeSynthesis rows newest-first, optionally filtered by audience.
 */
export async function getSyntheses(
  audience?: SynthesisAudience,
): Promise<DataKnowledgeSynthesis[]> {
  const where = audience ? { audience } : undefined;
  const rows = await safeFindMany(() =>
    db.dataKnowledgeSynthesis.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: 100,
    }),
  );
  return rows.map((r) => mapSynthesis(r as unknown as PrismaSynthesisRow));
}

export interface SynthesisSummary {
  totalSummaries: number;
  byType: Record<string, number>;
  byAudience: Record<string, number>;
}

/**
 * Aggregate stats about all stored DataKnowledgeSynthesis rows.
 */
export async function getSynthesisSummary(): Promise<SynthesisSummary> {
  const rows = await safeFindMany(() =>
    db.dataKnowledgeSynthesis.findMany({ take: MAX_SCAN }),
  );
  return {
    totalSummaries: rows.length,
    byType: countBy(rows, (r) => r.synthesisType),
    byAudience: countBy(rows, (r) => r.audience),
  };
}
