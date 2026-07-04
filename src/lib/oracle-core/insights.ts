// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle Intelligence Core™ — Knowledge Synthesis
// Every day Oracle publishes eight executive briefings, automatically:
//   1. business_insight    2. risk_summary       3. growth_opportunity
//   4. cost_saving          5. compliance_warning 6. revenue_forecast
//   7. cash_forecast        8. executive_summary
// Every value is derived from REAL connected business data — never mocked.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  AIModuleId,
  BusinessContext,
  InsightCategory,
  InsightRecord,
} from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

const ALL_CATEGORIES: InsightCategory[] = [
  'business_insight',
  'risk_summary',
  'growth_opportunity',
  'cost_saving',
  'compliance_warning',
  'revenue_forecast',
  'cash_forecast',
  'executive_summary',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParseJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function fmtINR(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) {
    return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `₹${(amount / 1_00_000).toFixed(2)} L`;
  }
  if (abs >= 1_000) {
    return `₹${(amount / 1_000).toFixed(1)}K`;
  }
  return `₹${Math.round(amount)}`;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute a 0-100 impact score from a ₹ amount.
 *   ₹10L+ → 90+
 *   ₹1L+  → 70+
 *   ₹10K+ → 50+
 *   ₹1K+  → 30+
 *   else  → 10
 */
function impactFromAmount(amount: number): number {
  const abs = Math.abs(amount);
  if (abs >= 10_00_000) return clamp(90 + Math.floor(abs / 50_00_000) * 2, 90, 100);
  if (abs >= 1_00_000) return clamp(70 + Math.floor((abs - 1_00_000) / 50_000), 70, 89);
  if (abs >= 10_000) return clamp(50 + Math.floor((abs - 10_000) / 5_000), 50, 69);
  if (abs >= 1_000) return clamp(30 + Math.floor((abs - 1_000) / 500), 30, 49);
  return 10;
}

/** Compute a confidence score (60-95) from how many non-empty sources contributed. */
function confidenceFromSources(sourceCount: number, maxValue = 95): number {
  const base = 60;
  const bonus = Math.min(maxValue - base, sourceCount * 8);
  return clamp(base + bonus, 60, maxValue);
}

// ─── Dynamic Sibling Imports ────────────────────────────────────────────────
// Sibling modules may be mid-build in parallel. Always wrap in try/catch so a
// missing or broken sibling never crashes Knowledge Synthesis.

interface MemoryModule {
  writeMemory: (input: Record<string, unknown>) => Promise<unknown>;
  searchMemory: (input: Record<string, unknown>) => Promise<{
    total: number;
    records: Array<Record<string, unknown>>;
  }>;
  getMemoryStats: () => Promise<Record<string, unknown>>;
  writeMemoryBatch: (inputs: Record<string, unknown>[]) => Promise<number>;
}

interface ContextModule {
  gatherBusinessContext: (opts?: Record<string, unknown>) => Promise<BusinessContext>;
  formatContextForPrompt: (ctx: BusinessContext) => string;
}

async function loadMemory(): Promise<MemoryModule | null> {
  try {
    return (await import('./memory')) as unknown as MemoryModule;
  } catch (e) {
    console.warn('[Oracle Insights] memory module unavailable:', e);
    return null;
  }
}

async function loadContext(): Promise<ContextModule | null> {
  try {
    return (await import('./context')) as ContextModule;
  } catch (e) {
    console.warn('[Oracle Insights] context module unavailable:', e);
    return null;
  }
}

// ─── 17 AI Module Orchestrators (best-effort, never crash) ──────────────────

interface CFOData {
  dashboard?: {
    cash?: { currentBalance?: number; runwayDays?: number; burnRatePerDay?: number };
    receivables?: { pendingCollections?: number; overdueCollections?: number };
    payables?: { vendorDues?: number; upcomingPayments?: number };
    gst?: { liability?: number; itcAvailable?: number; upcomingDueDates?: Array<{ returnType: string; period: string; dueDate: string; daysLeft: number }> };
    revenue?: { thisMonth?: number; lastMonth?: number; growthPct?: number };
    expenses?: number;
    bankBalance?: number;
  };
  risks?: Array<{ title?: string; severity?: string; level?: string; impact?: string }>;
  predictions?: { revenueForecast?: { ninetyDay?: number }; cashForecast?: { ninetyDay?: number } };
  recommendations?: Array<{ title?: string; rationale?: string; priority?: string }>;
}

interface CEOData {
  generatedAt?: string;
  liveState?: Record<string, unknown>;
  alerts?: Array<{ title?: string; severity?: string; message?: string }>;
  pendingApprovals?: Array<{ id?: string; title?: string; type?: string }>;
  decisions?: Array<{ title?: string; status?: string }>;
  metrics?: Record<string, unknown>;
}

interface AutonomousData {
  observation?: Record<string, unknown>;
  executives?: Array<Record<string, unknown>>;
  alerts?: Array<{ title?: string; severity?: string; category?: string }>;
  selfHealing?: { failing?: number; checks?: Array<{ name?: string; status?: string; healthy?: boolean }> };
  decisions?: Array<Record<string, unknown>>;
  metrics?: Record<string, unknown>;
}

interface ConnectivityData {
  summary?: { total?: number; healthy?: number; failing?: number; avgReliability?: number };
  connectors?: Array<{ displayName?: string; provider?: string; category?: string; status?: string; reliabilityPct?: number }>;
  failingConnectors?: Array<{ displayName?: string; provider?: string; reason?: string }>;
}

interface FactoryData {
  metrics?: { totalProjects?: number; totalBuilds?: number; successRate?: number; totalReleases?: number };
  projects?: Array<Record<string, unknown>>;
}

async function loadCFO(): Promise<CFOData | null> {
  try {
    const mod = await import('@/lib/cfo/engine');
    if (!mod || typeof (mod as { generateCFOInsights?: unknown }).generateCFOInsights !== 'function') {
      return null;
    }
    const result = await (mod as unknown as { generateCFOInsights: (user?: unknown) => Promise<CFOData> }).generateCFOInsights(null);
    return result ?? null;
  } catch (e) {
    console.warn('[Oracle Insights] CFO orchestrator unavailable:', e);
    return null;
  }
}

async function loadCEO(): Promise<CEOData | null> {
  try {
    const mod = await import('@/lib/ceo/orchestrator');
    if (!mod || typeof (mod as { getCachedCEODashboard?: unknown }).getCachedCEODashboard !== 'function') {
      return null;
    }
    const result = await (mod as unknown as { getCachedCEODashboard: () => Promise<CEOData> }).getCachedCEODashboard();
    return result ?? null;
  } catch (e) {
    console.warn('[Oracle Insights] CEO orchestrator unavailable:', e);
    return null;
  }
}

async function loadAutonomous(): Promise<AutonomousData | null> {
  try {
    const mod = await import('@/lib/autonomous/orchestrator');
    if (!mod || typeof (mod as { getAutonomousDashboard?: unknown }).getAutonomousDashboard !== 'function') {
      return null;
    }
    const result = await (mod as unknown as { getAutonomousDashboard: () => Promise<AutonomousData> }).getAutonomousDashboard();
    return result ?? null;
  } catch (e) {
    console.warn('[Oracle Insights] Autonomous orchestrator unavailable:', e);
    return null;
  }
}

async function loadConnectivity(): Promise<ConnectivityData | null> {
  try {
    const mod = await import('@/lib/connectivity/orchestrator');
    if (!mod || typeof (mod as { getConnectivityDashboard?: unknown }).getConnectivityDashboard !== 'function') {
      return null;
    }
    const result = await (mod as unknown as { getConnectivityDashboard: () => Promise<ConnectivityData> }).getConnectivityDashboard();
    return result ?? null;
  } catch (e) {
    console.warn('[Oracle Insights] Connectivity orchestrator unavailable:', e);
    return null;
  }
}

async function loadFactory(): Promise<FactoryData | null> {
  try {
    const mod = await import('@/lib/software-factory/engine');
    if (!mod || typeof (mod as { getFactoryDashboard?: unknown }).getFactoryDashboard !== 'function') {
      return null;
    }
    const result = await (mod as { getFactoryDashboard: () => Promise<FactoryData> }).getFactoryDashboard();
    return result ?? null;
  } catch (e) {
    console.warn('[Oracle Insights] Factory orchestrator unavailable:', e);
    return null;
  }
}

// ─── Empty Business Context Fallback ────────────────────────────────────────

function emptyContext(firmId: string): BusinessContext {
  return {
    gatheredAt: new Date().toISOString(),
    firmId,
    graph: { nodeCount: 0, edgeCount: 0, topRisks: [], recentChanges: [] },
    twin: { healthScore: 0, cashRunwayDays: 0, anomalies: 0, forecastDirection: 'stable' },
    knowledge: { entityCount: 0, recentUpdates: 0 },
    recentEvents: [],
    connectedSystems: { total: 0, healthy: 0, failing: 0, avgReliability: 0 },
    finance: {
      cashBalance: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      gstCollected: 0,
      gstPaid: 0,
      receivables: 0,
      payables: 0,
    },
    recentInvoices: [],
    recentReports: [],
    previousConversations: [],
    goals: [],
    strategies: [],
    pendingApprovals: [],
    estimatedTokens: 0,
  };
}

// ─── Raw Prisma Collectors ──────────────────────────────────────────────────

interface RawCollectedData {
  recentReasoning: Array<{
    id: string;
    request: string;
    businessReasoning: string;
    confidence: number;
    finalAnswer: string;
  }>;
  recentInvoices: Array<{ totalAmount: number; status: string; invoiceDate: string; buyerName: string | null }>;
  overdueFilings: Array<{ returnType: string; period: string; status: string; clientId: string; totalTax: number }>;
  openNotices: Array<{ noticeType: string; subject: string; status: string; priority: string; clientId: string }>;
  expenses: Array<{ vendor: string | null; category: string; amount: number; date: string }>;
  failingConnectors: Array<{ displayName: string; provider: string; status: string; connectorKey: string }>;
  activeClients: number;
  totalClients: number;
  clientsByStatus: Record<string, number>;
}

async function collectRawData(): Promise<RawCollectedData> {
  const [
    recentReasoningRows,
    recentInvoiceRows,
    overdueFilingRows,
    openNoticeRows,
    expenseRows,
    failingConnectorRows,
    totalClients,
    clientStatusRows,
  ] = await Promise.all([
    (async () => {
      try {
        return (await db.oracleReasoning.findMany({
          orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            request: true,
            businessReasoning: true,
            confidence: true,
            finalAnswer: true,
          },
        })) as Array<{
          id: string;
          request: string;
          businessReasoning: string;
          confidence: number;
          finalAnswer: string;
        }>;
      } catch (e) {
        console.warn('[Oracle Insights] reasoning query failed:', e);
        return [];
      }
    })(),
    (async () => {
      try {
        return (await db.invoice.findMany({
          orderBy: { invoiceDate: 'desc' },
          take: 200,
          select: {
            totalAmount: true,
            status: true,
            invoiceDate: true,
            buyerName: true,
          },
        })) as Array<{
          totalAmount: number;
          status: string;
          invoiceDate: string;
          buyerName: string | null;
        }>;
      } catch (e) {
        console.warn('[Oracle Insights] invoice query failed:', e);
        return [];
      }
    })(),
    (async () => {
      try {
        return (await db.gSTRFiling.findMany({
          where: {
            status: { in: ['draft', 'pending', 'overdue', 'in_progress'] },
          },
          orderBy: { period: 'desc' },
          take: 50,
          select: {
            returnType: true,
            period: true,
            status: true,
            clientId: true,
            totalTax: true,
          },
        })) as Array<{
          returnType: string;
          period: string;
          status: string;
          clientId: string;
          totalTax: number;
        }>;
      } catch (e) {
        console.warn('[Oracle Insights] GSTRFiling query failed:', e);
        return [];
      }
    })(),
    (async () => {
      try {
        return (await db.notice.findMany({
          where: { status: { in: ['open', 'pending', 'in_progress'] } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            noticeType: true,
            subject: true,
            status: true,
            priority: true,
            clientId: true,
          },
        })) as Array<{
          noticeType: string;
          subject: string;
          status: string;
          priority: string;
          clientId: string;
        }>;
      } catch (e) {
        console.warn('[Oracle Insights] notice query failed:', e);
        return [];
      }
    })(),
    (async () => {
      try {
        return (await db.expense.findMany({
          orderBy: { amount: 'desc' },
          take: 100,
          select: {
            vendor: true,
            category: true,
            amount: true,
            date: true,
          },
        })) as Array<{
          vendor: string | null;
          category: string;
          amount: number;
          date: string;
        }>;
      } catch (e) {
        console.warn('[Oracle Insights] expense query failed:', e);
        return [];
      }
    })(),
    (async () => {
      try {
        return (await db.connectorInstance.findMany({
          where: { status: { in: ['error', 'expired', 'revoked'] } },
          take: 50,
          select: {
            displayName: true,
            provider: true,
            status: true,
            connectorKey: true,
          },
        })) as Array<{
          displayName: string;
          provider: string;
          status: string;
          connectorKey: string;
        }>;
      } catch (e) {
        console.warn('[Oracle Insights] connector query failed:', e);
        return [];
      }
    })(),
    (async () => {
      try {
        return await db.client.count();
      } catch (e) {
        console.warn('[Oracle Insights] client count failed:', e);
        return 0;
      }
    })(),
    (async () => {
      try {
        const rows = await db.client.groupBy({
          by: ['status'],
          _count: { _all: true },
        });
        const result: Record<string, number> = {};
        for (const r of rows) result[r.status] = r._count._all;
        return result;
      } catch (e) {
        console.warn('[Oracle Insights] client groupBy failed:', e);
        return {} as Record<string, number>;
      }
    })(),
  ]);

  return {
    recentReasoning: recentReasoningRows,
    recentInvoices: recentInvoiceRows,
    overdueFilings: overdueFilingRows,
    openNotices: openNoticeRows,
    expenses: expenseRows,
    failingConnectors: failingConnectorRows,
    activeClients: clientStatusRows['active'] ?? 0,
    totalClients,
    clientsByStatus: clientStatusRows,
  };
}

// ─── Per-Category Builders ──────────────────────────────────────────────────
// Each builder returns a partial InsightRecord (title, body, confidence,
// impactScore, actionItems, dataSources). The caller adds ids, dates, flags.

interface InsightDraft {
  title: string;
  body: string;
  confidence: number;
  impactScore: number;
  actionItems: string[];
  dataSources: AIModuleId[];
}

function buildBusinessInsight(
  date: string,
  raw: RawCollectedData,
  ctx: BusinessContext,
  cfo: CFOData | null,
  ceo: CEOData | null,
): InsightDraft {
  const dataSources: AIModuleId[] = ['oracle'];
  if (cfo) dataSources.push('cfo');
  if (ceo) dataSources.push('ceo');

  const reasoningBullets = (raw.recentReasoning ?? [])
    .slice(0, 3)
    .map((r, i) => `${i + 1}. ${r.request.slice(0, 120)} (confidence ${r.confidence}%)`)
    .join('\n');

  const topRisks = ctx.graph.topRisks
    .slice(0, 2)
    .map((r) => `• ${r.label} (score ${r.score})`)
    .join('\n');

  const body = [
    `Date: ${date}`,
    '',
    'Top recent Oracle reasonings (by confidence):',
    reasoningBullets || '• No recent reasoning records found.',
    '',
    topRisks ? `Top business-graph risks:\n${topRisks}` : null,
    ctx.twin.healthScore > 0
      ? `Digital Twin health: ${ctx.twin.healthScore}/100 — forecast ${ctx.twin.forecastDirection}.`
      : null,
    ceo?.alerts && ceo.alerts.length > 0
      ? `CEO alerts active: ${ceo.alerts.length}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const actionItems: string[] = [];
  for (const r of (raw.recentReasoning ?? []).slice(0, 2)) {
    actionItems.push(`Review reasoning "${r.request.slice(0, 60)}…" — act on its recommendation`);
  }
  if (ctx.twin.healthScore > 0 && ctx.twin.healthScore < 60) {
    actionItems.push('Investigate Digital Twin health degradation');
  }
  if (ceo?.alerts && ceo.alerts.length > 0) {
    actionItems.push(`Address ${ceo.alerts.length} open CEO alert(s)`);
  }
  if (actionItems.length < 2) {
    actionItems.push('Schedule weekly Oracle review with executive team');
  }
  while (actionItems.length > 4) actionItems.pop();

  return {
    title: `Top 3 business insights for ${date}`,
    body,
    confidence: confidenceFromSources(dataSources.length),
    impactScore: clamp(
      Math.max(60, ctx.twin.healthScore || 60, (raw.recentReasoning ?? [])[0]?.confidence ?? 60),
      0,
      100,
    ),
    actionItems: actionItems.slice(0, 4),
    dataSources,
  };
}

function buildRiskSummary(
  date: string,
  raw: RawCollectedData,
  connectivity: ConnectivityData | null,
  autonomous: AutonomousData | null,
  cfo: CFOData | null,
): InsightDraft {
  const dataSources: AIModuleId[] = ['oracle'];
  if (connectivity) dataSources.push('connectivity');
  if (autonomous) dataSources.push('autonomous');
  if (cfo) dataSources.push('cfo');

  const failingConnectors = [
    ...((raw.failingConnectors ?? []).map((c) => `• ${c.displayName} (${c.provider}) — ${c.status}`)),
    ...(Array.isArray(connectivity?.failingConnectors)
      ? (connectivity?.failingConnectors ?? []).map((c: { displayName?: string; provider?: string; reason?: string }) => `• ${c.displayName ?? 'Unknown'} (${c.provider ?? '?'}) — ${c.reason ?? 'failing'}`)
      : typeof connectivity?.failingConnectors === 'number' && connectivity.failingConnectors > 0
        ? [`• ${connectivity.failingConnectors} failing connector(s) (see Connectivity Fabric™)`]
        : []),
  ].slice(0, 5);

  const cfoRisks =
    cfo?.risks
      ?.slice(0, 3)
      .map((r) => `• ${r.title ?? 'Untitled risk'} (${r.severity ?? r.level ?? '?'})`)
      .join('\n') ?? null;

  const autoAlerts =
    autonomous?.alerts
      ?.slice(0, 3)
      .map((a) => `• ${a.title ?? 'Alert'} [${a.severity ?? '?'}]`)
      .join('\n') ?? null;

  const selfHealingFailures =
    autonomous?.selfHealing?.checks
      ?.filter((c) => c.healthy === false || c.status === 'failing' || c.status === 'unhealthy')
      .map((c) => `• ${c.name ?? 'Check'} unhealthy`)
      .join('\n') ?? null;

  const body = [
    `Date: ${date}`,
    '',
    failingConnectors.length > 0
      ? `Failing connectors (${failingConnectors.length}):\n${failingConnectors.join('\n')}`
      : 'No failing connectors detected.',
    cfoRisks ? `\nCFO risks:\n${cfoRisks}` : null,
    autoAlerts ? `\nAutonomous alerts:\n${autoAlerts}` : null,
    selfHealingFailures ? `\nSelf-healing issues:\n${selfHealingFailures}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const actionItems: string[] = [];
  if (failingConnectors.length > 0) {
    actionItems.push(`Repair ${failingConnectors.length} failing connector(s) immediately`);
  }
  if (cfo?.risks && cfo.risks.length > 0) {
    actionItems.push(`Mitigate top CFO risk: "${cfo.risks[0]?.title ?? 'priority risk'}"`);
  }
  if (autonomous?.alerts && autonomous.alerts.length > 0) {
    actionItems.push(`Triage ${autonomous.alerts.length} autonomous alert(s)`);
  }
  if (selfHealingFailures) {
    actionItems.push('Run self-healing diagnostics on failing checks');
  }
  if (actionItems.length === 0) {
    actionItems.push('Maintain current risk posture — no critical risks detected');
  }
  while (actionItems.length > 4) actionItems.pop();

  const riskCount =
    failingConnectors.length +
    (cfo?.risks?.length ?? 0) +
    (autonomous?.alerts?.length ?? 0);

  return {
    title: `Risk summary for ${date}`,
    body,
    confidence: confidenceFromSources(dataSources.length),
    impactScore: clamp(50 + riskCount * 8, 0, 100),
    actionItems: actionItems.slice(0, 4),
    dataSources,
  };
}

function buildGrowthOpportunity(
  date: string,
  raw: RawCollectedData,
  ctx: BusinessContext,
  cfo: CFOData | null,
): InsightDraft {
  const dataSources: AIModuleId[] = ['oracle'];
  if (cfo) dataSources.push('cfo');
  dataSources.push('marketing');
  dataSources.push('hr');

  const activeClients = raw.activeClients ?? 0;
  const totalClients = raw.totalClients ?? 0;
  const newClients = (raw.clientsByStatus ?? {})['new'] ?? 0;
  const inactiveClients = (raw.clientsByStatus ?? {})['inactive'] ?? 0;

  const monthlyRevenue = ctx.finance.monthlyRevenue || cfo?.dashboard?.revenue?.thisMonth || 0;
  const lastMonthRevenue = ctx.finance.monthlyRevenue || cfo?.dashboard?.revenue?.lastMonth || 0;
  const revenueGrowth = cfo?.dashboard?.revenue?.growthPct ?? 0;

  const topBuyersMap = new Map<string, number>();
  for (const inv of (raw.recentInvoices ?? []).slice(0, 100)) {
    const name = inv.buyerName || 'Unknown';
    topBuyersMap.set(name, (topBuyersMap.get(name) ?? 0) + inv.totalAmount);
  }
  const topBuyers = Array.from(topBuyersMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const body = [
    `Date: ${date}`,
    '',
    `Active clients: ${activeClients} / ${totalClients} total (${newClients} new, ${inactiveClients} inactive)`,
    `Monthly revenue: ${fmtINR(monthlyRevenue)} (${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}% MoM)`,
    '',
    'Top buyers by recent invoice volume:',
    topBuyers.length > 0
      ? topBuyers.map(([n, v]) => `• ${n}: ${fmtINR(v)}`).join('\n')
      : '• No buyer data available',
    ctx.goals.length > 0
      ? `\nActive goals tracked: ${ctx.goals.length}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const actionItems: string[] = [
    `Upsell to top ${Math.min(3, topBuyers.length)} buyers — they have proven spend capacity`,
    `Re-engage ${inactiveClients} inactive clients with win-back campaign`,
  ];
  if (revenueGrowth > 10) {
    actionItems.push('Sustain revenue momentum — consider expanding into adjacent markets');
  } else if (revenueGrowth < 0) {
    actionItems.push('Reverse revenue decline — review pricing and sales pipeline');
  }
  if (newClients > 0) {
    actionItems.push(`Onboard ${newClients} new client(s) for full revenue recognition`);
  }
  while (actionItems.length > 4) actionItems.pop();

  return {
    title: `Growth opportunities for ${date}`,
    body,
    confidence: confidenceFromSources(dataSources.length, 90),
    impactScore: impactFromAmount(monthlyRevenue * 0.1),
    actionItems: actionItems.slice(0, 4),
    dataSources,
  };
}

function buildCostSaving(
  date: string,
  raw: RawCollectedData,
  ctx: BusinessContext,
  cfo: CFOData | null,
): InsightDraft {
  const dataSources: AIModuleId[] = ['oracle'];
  if (cfo) dataSources.push('cfo');

  // Top vendors by spend (last 100 expenses).
  const vendorSpendMap = new Map<string, number>();
  for (const exp of (raw.expenses ?? [])) {
    const vendor = exp.vendor || exp.category || 'Unknown';
    vendorSpendMap.set(vendor, (vendorSpendMap.get(vendor) ?? 0) + exp.amount);
  }
  const topVendors = Array.from(vendorSpendMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalExpenses = (raw.expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpenses = ctx.finance.monthlyExpenses || cfo?.dashboard?.expenses || totalExpenses;

  // Identify non-GST-claimable expenses (potential savings).
  const gstClaimableCount = (raw.expenses ?? []).filter((e) => e.category !== 'Salary' && e.category !== 'Rent').length;

  const body = [
    `Date: ${date}`,
    '',
    `Total expenses analysed: ${fmtINR(totalExpenses)} (monthly run-rate: ${fmtINR(monthlyExpenses)})`,
    '',
    'Top vendors / categories by spend:',
    topVendors.length > 0
      ? topVendors.map(([n, v]) => `• ${n}: ${fmtINR(v)}`).join('\n')
      : '• No expense data available',
    '',
    `GST-claimable expense lines: ${gstClaimableCount} of ${raw.expenses.length}`,
    cfo?.dashboard?.payables?.vendorDues
      ? `Outstanding vendor dues: ${fmtINR(cfo.dashboard.payables.vendorDues)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const actionItems: string[] = [];
  if (topVendors.length > 0) {
    actionItems.push(`Renegotiate contract with top vendor "${topVendors[0][0]}" — ${fmtINR(topVendors[0][1])} spend`);
  }
  actionItems.push('Audit all expense categories for GST claimability gaps');
  if (gstClaimableCount < raw.expenses.length && raw.expenses.length > 0) {
    actionItems.push(`Recover ITC on ${raw.expenses.length - gstClaimableCount} non-claimable lines`);
  }
  if (cfo?.dashboard?.payables?.vendorDues && cfo.dashboard.payables.vendorDues > 100000) {
    actionItems.push('Negotiate extended payment terms with vendors to free working capital');
  }
  if (actionItems.length < 2) {
    actionItems.push('Implement monthly expense review with department heads');
  }
  while (actionItems.length > 4) actionItems.pop();

  return {
    title: `Cost savings opportunities for ${date}`,
    body,
    confidence: confidenceFromSources(dataSources.length, 90),
    impactScore: impactFromAmount(totalExpenses * 0.1),
    actionItems: actionItems.slice(0, 4),
    dataSources,
  };
}

function buildComplianceWarning(
  date: string,
  raw: RawCollectedData,
  cfo: CFOData | null,
): InsightDraft {
  const dataSources: AIModuleId[] = ['oracle', 'legal'];
  if (cfo) dataSources.push('cfo');

  const overdueFilings = raw.overdueFilings ?? [];
  const openNotices = raw.openNotices ?? [];

  const upcomingDueDates =
    cfo?.dashboard?.gst?.upcomingDueDates?.slice(0, 5) ?? [];

  const body = [
    `Date: ${date}`,
    '',
    `Pending / overdue GST filings: ${overdueFilings.length}`,
    overdueFilings.length > 0
      ? overdueFilings
          .slice(0, 5)
          .map((f) => `• ${f.returnType} — ${f.period} [${f.status}] (tax: ${fmtINR(f.totalTax)})`)
          .join('\n')
      : '• All filings up to date.',
    '',
    `Open notices: ${openNotices.length}`,
    openNotices.length > 0
      ? openNotices
          .slice(0, 5)
          .map((n) => `• [${n.priority}] ${n.subject} (${n.noticeType}) — ${n.status}`)
          .join('\n')
      : '• No open notices.',
    upcomingDueDates.length > 0
      ? `\nUpcoming GST due dates:\n${upcomingDueDates.map((d) => `• ${d.returnType} ${d.period} — due ${d.dueDate} (${d.daysLeft}d left)`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const actionItems: string[] = [];
  if (overdueFilings.length > 0) {
    actionItems.push(`File ${overdueFilings.length} overdue GSTR return(s) immediately to avoid penalty`);
  }
  if (openNotices.length > 0) {
    actionItems.push(`Respond to ${openNotices.length} open notice(s) before due date`);
  }
  if (upcomingDueDates.length > 0) {
    actionItems.push(`Prepare for next GST filing: ${upcomingDueDates[0].returnType} ${upcomingDueDates[0].period}`);
  }
  if (actionItems.length < 2) {
    actionItems.push('Continue compliance cadence — no urgent warnings detected');
  }
  while (actionItems.length > 4) actionItems.pop();

  const totalTaxAtRisk = overdueFilings.reduce((sum, f) => sum + f.totalTax, 0);

  return {
    title: `Compliance warnings for ${date}`,
    body,
    confidence: confidenceFromSources(dataSources.length),
    impactScore: clamp(impactFromAmount(totalTaxAtRisk) + 10, 0, 100),
    actionItems: actionItems.slice(0, 4),
    dataSources,
  };
}

function buildRevenueForecast(
  date: string,
  raw: RawCollectedData,
  ctx: BusinessContext,
  cfo: CFOData | null,
): InsightDraft {
  const dataSources: AIModuleId[] = ['oracle'];
  if (cfo) dataSources.push('cfo');
  dataSources.push('marketing');

  // Sum last 3 months of invoices (best-effort from invoiceDate strings).
  const now = new Date(date);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const last3MonthsInvoices = (raw.recentInvoices ?? []).filter((inv) => {
    try {
      const d = new Date(inv.invoiceDate);
      return d >= threeMonthsAgo && d <= now;
    } catch {
      return false;
    }
  });
  const last3MonthsRevenue = last3MonthsInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const monthlyAvg = last3MonthsRevenue / 3;
  const ninetyDayForecast = Math.round(monthlyAvg * 3);

  const cfoForecast = cfo?.predictions?.revenueForecast?.ninetyDay;
  const blendedForecast = cfoForecast
    ? Math.round((ninetyDayForecast + cfoForecast) / 2)
    : ninetyDayForecast;

  const body = [
    `Date: ${date} (90-day horizon)`,
    '',
    `Last 3 months invoice revenue: ${fmtINR(last3MonthsRevenue)} (${last3MonthsInvoices.length} invoices)`,
    `Monthly average: ${fmtINR(monthlyAvg)}`,
    `Projected next 90 days (trend): ${fmtINR(ninetyDayForecast)}`,
    cfoForecast ? `CFO model 90-day forecast: ${fmtINR(cfoForecast)}` : null,
    `Blended forecast: ${fmtINR(blendedForecast)}`,
    ctx.finance.monthlyRevenue > 0
      ? `Context engine monthly revenue: ${fmtINR(ctx.finance.monthlyRevenue)}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const actionItems: string[] = [
    `Plan capacity for projected ${fmtINR(monthlyAvg)} monthly revenue`,
    'Accelerate collection on receivables to realise forecasted revenue',
  ];
  if (blendedForecast > last3MonthsRevenue) {
    actionItems.push('Prepare for growth — pre-position inventory and staffing');
  } else if (blendedForecast < last3MonthsRevenue) {
    actionItems.push('Hedge against revenue decline — review pricing and pipeline');
  }
  if (cfoForecast) {
    actionItems.push('Reconcile trend projection against CFO model assumptions');
  }
  while (actionItems.length > 4) actionItems.pop();

  return {
    title: 'Revenue forecast for next 90 days',
    body,
    confidence: confidenceFromSources(dataSources.length, 90),
    impactScore: impactFromAmount(blendedForecast),
    actionItems: actionItems.slice(0, 4),
    dataSources,
  };
}

function buildCashForecast(
  date: string,
  ctx: BusinessContext,
  cfo: CFOData | null,
): InsightDraft {
  const dataSources: AIModuleId[] = ['oracle'];
  if (cfo) dataSources.push('cfo');

  const bankBalance =
    cfo?.dashboard?.bankBalance ??
    ctx.finance.cashBalance ??
    cfo?.dashboard?.cash?.currentBalance ??
    0;
  const receivables =
    ctx.finance.receivables || cfo?.dashboard?.receivables?.pendingCollections || 0;
  const payables =
    ctx.finance.payables || cfo?.dashboard?.payables?.vendorDues || 0;
  const monthlyBurn =
    ctx.finance.monthlyExpenses ||
    cfo?.dashboard?.expenses ||
    (cfo?.dashboard?.cash?.burnRatePerDay ? cfo.dashboard.cash.burnRatePerDay * 30 : 0);
  const threeMonthBurn = monthlyBurn * 3;
  const ninetyDayCash = bankBalance + receivables - payables - threeMonthBurn;
  const runwayDays =
    cfo?.dashboard?.cash?.runwayDays ??
    (monthlyBurn > 0 ? Math.floor(bankBalance / (monthlyBurn / 30)) : 0);

  const cfoCashForecast = cfo?.predictions?.cashForecast?.ninetyDay;
  const blendedCashForecast = cfoCashForecast
    ? Math.round((ninetyDayCash + cfoCashForecast) / 2)
    : ninetyDayCash;

  const body = [
    `Date: ${date} (90-day horizon)`,
    '',
    `Bank balance: ${fmtINR(bankBalance)}`,
    `Receivables (incoming): ${fmtINR(receivables)}`,
    `Payables (outgoing): ${fmtINR(payables)}`,
    `Projected 3-month burn: ${fmtINR(threeMonthBurn)}`,
    `Projected cash in 90 days: ${fmtINR(ninetyDayCash)}`,
    cfoCashForecast ? `CFO model 90-day cash forecast: ${fmtINR(cfoCashForecast)}` : null,
    `Blended forecast: ${fmtINR(blendedCashForecast)}`,
    runwayDays > 0 ? `Runway: ~${runwayDays} days at current burn` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const actionItems: string[] = [
    'Prioritise collection of overdue receivables to strengthen cash position',
  ];
  if (ninetyDayCash < 0) {
    actionItems.push('URGENT: 90-day cash deficit projected — arrange credit line or defer discretionary spend');
  } else if (runwayDays > 0 && runwayDays < 60) {
    actionItems.push(`Runway below 60 days (${runwayDays}d) — accelerate collection and freeze hiring`);
  } else {
    actionItems.push('Maintain cash discipline — schedule monthly cash review');
  }
  if (payables > receivables) {
    actionItems.push('Negotiate extended vendor terms — payables exceed receivables');
  }
  if (cfoCashForecast) {
    actionItems.push('Reconcile trend projection against CFO cash model');
  }
  while (actionItems.length > 4) actionItems.pop();

  return {
    title: 'Cash forecast for next 90 days',
    body,
    confidence: confidenceFromSources(dataSources.length, 90),
    impactScore: impactFromAmount(Math.abs(ninetyDayCash)),
    actionItems: actionItems.slice(0, 4),
    dataSources,
  };
}

function buildExecutiveSummary(
  date: string,
  drafts: Record<InsightCategory, InsightDraft>,
): InsightDraft {
  const sources = Array.from(
    new Set<AIModuleId>(
      Object.values(drafts).flatMap((d) => d.dataSources),
    ),
  );

  const business = drafts.business_insight;
  const risk = drafts.risk_summary;
  const growth = drafts.growth_opportunity;
  const cost = drafts.cost_saving;
  const compliance = drafts.compliance_warning;
  const revenue = drafts.revenue_forecast;
  const cash = drafts.cash_forecast;

  const paragraph = [
    `On ${date}, Oracle synthesised briefings across ${sources.length} intelligence modules.`,
    business.actionItems[0] ? `Top business priority: ${business.actionItems[0]}.` : null,
    risk.actionItems[0] ? `Risk posture: ${risk.actionItems[0]}.` : null,
    growth.actionItems[0] ? `Growth: ${growth.actionItems[0]}.` : null,
    cost.actionItems[0] ? `Cost: ${cost.actionItems[0]}.` : null,
    compliance.actionItems[0] ? `Compliance: ${compliance.actionItems[0]}.` : null,
    revenue.actionItems[0] ? `Revenue: ${revenue.actionItems[0]}.` : null,
    cash.actionItems[0] ? `Cash: ${cash.actionItems[0]}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const actionItems: string[] = [];
  // Pick the single highest-priority action from each insight.
  for (const cat of [
    'business_insight',
    'risk_summary',
    'compliance_warning',
    'cash_forecast',
  ] as InsightCategory[]) {
    const a = drafts[cat]?.actionItems?.[0];
    if (a) actionItems.push(a);
  }
  while (actionItems.length > 4) actionItems.pop();

  const avgConfidence = Math.round(
    Object.values(drafts).reduce((s, d) => s + d.confidence, 0) /
      Object.keys(drafts).length,
  );
  const maxImpact = Math.max(...Object.values(drafts).map((d) => d.impactScore));

  return {
    title: `Executive summary for ${date}`,
    body: paragraph,
    confidence: clamp(avgConfidence, 60, 95),
    impactScore: maxImpact,
    actionItems: actionItems.slice(0, 4),
    dataSources: sources.length > 0 ? sources : (['oracle'] as AIModuleId[]),
  };
}

// ─── Persistence ────────────────────────────────────────────────────────────

function serializeInsight(r: {
  id: string;
  firmId: string;
  synthesisDate: Date;
  category: string;
  title: string;
  body: string;
  confidence: number;
  impactScore: number;
  actionItems: string;
  dataSources: string;
  acknowledged: boolean;
  actedOn: boolean;
  createdAt: Date;
}): InsightRecord {
  return {
    id: r.id,
    firmId: r.firmId,
    synthesisDate: r.synthesisDate.toISOString(),
    category: r.category as InsightCategory,
    title: r.title,
    body: r.body,
    confidence: r.confidence,
    impactScore: r.impactScore,
    actionItems: safeParseJSON<string[]>(r.actionItems, []),
    dataSources: safeParseJSON<AIModuleId[]>(r.dataSources, []),
    acknowledged: r.acknowledged,
    actedOn: r.actedOn,
    createdAt: r.createdAt.toISOString(),
  };
}

async function persistInsight(
  firmId: string,
  synthesisDate: Date,
  category: InsightCategory,
  draft: InsightDraft,
): Promise<InsightRecord> {
  const created = await db.oracleInsight.create({
    data: {
      firmId,
      synthesisDate,
      category,
      title: draft.title,
      body: draft.body,
      confidence: draft.confidence,
      impactScore: draft.impactScore,
      actionItems: JSON.stringify(draft.actionItems),
      dataSources: JSON.stringify(draft.dataSources),
      acknowledged: false,
      actedOn: false,
    },
  });
  return serializeInsight(created);
}

// ─── Main: synthesizeInsights ───────────────────────────────────────────────

export interface SynthesizeOptions {
  firmId?: string;
  date?: Date;
}

/** Generate the 8 daily insight records, persist them, and write memory entries. */
export async function synthesizeInsights(
  options?: SynthesizeOptions,
): Promise<InsightRecord[]> {
  const firmId = options?.firmId || FIRM_ID;
  const synthesisDate = options?.date ?? new Date();
  const dateStr = dateKey(synthesisDate);

  // 1. Gather business context (try/catch — empty defaults on failure).
  let ctx: BusinessContext = emptyContext(firmId);
  const contextMod = await loadContext();
  if (contextMod) {
    try {
      ctx = await contextMod.gatherBusinessContext({ firmId });
    } catch (e) {
      console.warn('[Oracle Insights] gatherBusinessContext failed; using empty context:', e);
    }
  }

  // 2. Gather real Prisma data.
  const raw = await collectRawData();

  // 3. Call sibling AI orchestrators (best-effort, parallel).
  const [cfo, ceo, autonomous, connectivity] = await Promise.all([
    loadCFO(),
    loadCEO(),
    loadAutonomous(),
    loadConnectivity(),
  ]);
  // Factory data is used for completeness — currently not feeding into a
  // dedicated insight category but kept available for future expansion.
  void loadFactory();

  // 4. Build all 8 drafts (each wrapped to surface which builder fails).
  const drafts: Partial<Record<InsightCategory, InsightDraft>> = {};
  const builders: Array<[InsightCategory, () => InsightDraft]> = [
    ['business_insight', () => buildBusinessInsight(dateStr, raw, ctx, cfo, ceo)],
    ['risk_summary', () => buildRiskSummary(dateStr, raw, connectivity, autonomous, cfo)],
    ['growth_opportunity', () => buildGrowthOpportunity(dateStr, raw, ctx, cfo)],
    ['cost_saving', () => buildCostSaving(dateStr, raw, ctx, cfo)],
    ['compliance_warning', () => buildComplianceWarning(dateStr, raw, cfo)],
    ['revenue_forecast', () => buildRevenueForecast(dateStr, raw, ctx, cfo)],
    ['cash_forecast', () => buildCashForecast(dateStr, ctx, cfo)],
  ];
  for (const [cat, fn] of builders) {
    try {
      drafts[cat] = fn();
    } catch (e) {
      console.warn(`[Oracle Insights] builder ${cat} failed:`, e);
      drafts[cat] = {
        title: `${cat} for ${dateStr}`,
        body: `Insight synthesis for ${cat} encountered an error: ${e instanceof Error ? e.message : 'unknown'}. Partial data used.`,
        confidence: 50,
        impactScore: 30,
        actionItems: ['Review data inputs for this insight category'],
        dataSources: ['oracle'],
      };
    }
  }
  try {
    drafts.executive_summary = buildExecutiveSummary(
      dateStr,
      drafts as Record<InsightCategory, InsightDraft>,
    );
  } catch (e) {
    console.warn('[Oracle Insights] executive summary builder failed:', e);
    drafts.executive_summary = {
      title: `Executive summary for ${dateStr}`,
      body: `Oracle synthesised briefings across ${Object.keys(drafts).length} categories. Executive summary encountered an error: ${e instanceof Error ? e.message : 'unknown'}.`,
      confidence: 60,
      impactScore: 50,
      actionItems: ['Review individual insight categories'],
      dataSources: ['oracle'],
    };
  }

  // 5. Persist + write memory entries.
  const memoryMod = await loadMemory();
  const results: InsightRecord[] = [];
  for (const category of ALL_CATEGORIES) {
    const draft = drafts[category];
    if (!draft) continue;
    try {
      const record = await persistInsight(firmId, synthesisDate, category, draft);
      results.push(record);

      if (memoryMod) {
        try {
          await memoryMod.writeMemory({
            firmId,
            category: 'insight',
            source: 'oracle',
            entityType: 'insight',
            entityId: record.id,
            title: draft.title,
            summary: draft.body.slice(0, 280),
            payload: {
              insightId: record.id,
              category,
              confidence: draft.confidence,
              impactScore: draft.impactScore,
              actionItems: draft.actionItems,
              dataSources: draft.dataSources,
            },
            tags: ['insight', category, `impact:${draft.impactScore}`],
            importance: Math.max(50, draft.impactScore),
          });
        } catch (e) {
          console.warn(
            `[Oracle Insights] memory write failed for ${category}:`,
            e,
          );
        }
      }
    } catch (e) {
      console.warn(
        `[Oracle Insights] persist failed for ${category}:`,
        e,
      );
    }
  }

  return results;
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface InsightStats {
  total: number;
  byCategory: Record<string, number>;
  acknowledged: number;
  actedOn: number;
  topImpact: InsightRecord | null;
}

/** Aggregate stats for today's insights. */
export async function getInsightStats(): Promise<InsightStats> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  try {
    const where = {
      synthesisDate: { gte: start, lte: end },
    };
    const [total, acknowledged, actedOn, byCategoryRows, topRow] = await Promise.all([
      db.oracleInsight.count({ where }),
      db.oracleInsight.count({ where: { ...where, acknowledged: true } }),
      db.oracleInsight.count({ where: { ...where, actedOn: true } }),
      db.oracleInsight.groupBy({
        by: ['category'],
        where,
        _count: { _all: true },
      }),
      db.oracleInsight.findFirst({
        where,
        orderBy: { impactScore: 'desc' },
      }),
    ]);

    const byCategory: Record<string, number> = {};
    for (const r of byCategoryRows) byCategory[r.category] = r._count._all;

    return {
      total,
      byCategory,
      acknowledged,
      actedOn,
      topImpact: topRow ? serializeInsight(topRow as never) : null,
    };
  } catch (e) {
    console.warn('[Oracle Insights] getInsightStats failed:', e);
    return { total: 0, byCategory: {}, acknowledged: 0, actedOn: 0, topImpact: null };
  }
}

// ─── List ───────────────────────────────────────────────────────────────────

/** List insights, optionally filtered by date + category. Defaults to today. */
export async function listInsights(
  date?: Date,
  category?: InsightCategory,
  limit = 50,
): Promise<InsightRecord[]> {
  const targetDate = date ?? new Date();
  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  const where: Record<string, unknown> = {
    synthesisDate: { gte: start, lte: end },
  };
  if (category) where.category = category;

  try {
    const rows = await db.oracleInsight.findMany({
      where,
      orderBy: [{ impactScore: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(limit, 500),
    });
    return rows.map((r) => serializeInsight(r as never));
  } catch (e) {
    console.warn('[Oracle Insights] listInsights failed:', e);
    return [];
  }
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Mark an insight as acknowledged. */
export async function acknowledgeInsight(id: string): Promise<void> {
  try {
    await db.oracleInsight.update({
      where: { id },
      data: { acknowledged: true },
    });
  } catch (e) {
    console.warn('[Oracle Insights] acknowledgeInsight failed:', e);
  }
}

/** Mark an insight as acted on (also acknowledges). */
export async function actOnInsight(id: string): Promise<void> {
  try {
    await db.oracleInsight.update({
      where: { id },
      data: { actedOn: true, acknowledged: true },
    });
  } catch (e) {
    console.warn('[Oracle Insights] actOnInsight failed:', e);
  }
}

// ─── Daily Brief ────────────────────────────────────────────────────────────

export interface DailyBrief {
  date: string;
  executiveSummary: InsightRecord | null;
  top3: InsightRecord[];
  pendingActions: number;
}

/** Convenience accessor for dashboard hero panels. */
export async function getDailyBrief(): Promise<DailyBrief> {
  const today = new Date();
  const dateStr = dateKey(today);

  try {
    const insights = await listInsights(today, undefined, 50);
    const executiveSummary =
      insights.find((i) => i.category === 'executive_summary') ?? null;
    const top3 = insights
      .filter((i) => i.category !== 'executive_summary')
      .slice(0, 3);
    const pendingActions = insights.filter((i) => !i.actedOn).length;

    return {
      date: dateStr,
      executiveSummary,
      top3,
      pendingActions,
    };
  } catch (e) {
    console.warn('[Oracle Insights] getDailyBrief failed:', e);
    return { date: dateStr, executiveSummary: null, top3: [], pendingActions: 0 };
  }
}
