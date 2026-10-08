// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Intelligence Core™ — Context Engine™
//
// BEFORE every AI call, automatically gather business context from all 17
// connected systems (AI CEO, AI CFO, Autonomous Enterprise, Connectivity
// Fabric, Software Factory, Business Graph, Digital Twin, Real-Data layer)
// plus REAL Prisma business records (invoices, reports, CEO approvals,
// goals, strategies, recent Oracle conversations).
//
// Hard guarantees:
//   • Never throws — always returns a valid BusinessContext (zeros on failure)
//   • 6-second per-module timeout via Promise.race — one slow module can't block
//   • 30-second in-memory cache via getCachedContext(force?)
//   • Wraps every external module call in try/catch
//   • Reports estimatedTokens (~JSON length / 4)
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type { BusinessContext } from './types';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Per-module timeout (6s) ─────────────────────────────────────────────────
const MODULE_TIMEOUT_MS = 6_000;

function withTimeout<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`[Context Engine] module "${label}" timed out after ${MODULE_TIMEOUT_MS}ms`);
        resolve(fallback);
      }
    }, MODULE_TIMEOUT_MS);
    p.then(
      (val) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(val);
        }
      },
      (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          console.warn(`[Context Engine] module "${label}" failed:`, err);
          resolve(fallback);
        }
      },
    );
  });
}

// ─── Empty (zero) context — returned when everything is offline ─────────────

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

// ─── Module gatherers ───────────────────────────────────────────────────────
// Each returns a partial that we merge into the assembled BusinessContext.
// All wrapped in try/catch + 6s timeout — never throws.

interface GraphSlice {
  nodeCount: number;
  edgeCount: number;
  topRisks: Array<{ id: string; label: string; score: number }>;
  recentChanges: Array<{ type: string; description: string; at: string }>;
  entityCount: number;
}

async function gatherGraph(): Promise<GraphSlice | null> {
  try {
    const mod = await import('@/lib/graph/engine');
    const state = await withTimeout('graph.getGraphState', mod.getGraphState(), null as never);
    if (!state) return null;
    const kg = (state as any).knowledgeGraph;
    const rg = (state as any).riskGraph;
    const nodeCount = kg?.nodes?.length ?? 0;
    const edgeCount = kg?.edges?.length ?? 0;
    const topRisks = (rg?.topRisks ?? [])
      .slice(0, 5)
      .map((r: any) => ({
        id: r.id ?? r.nodeId ?? '',
        label: r.entityName ?? r.category ?? 'risk',
        score: typeof r.score === 'number' ? r.score : 0,
      }));
    const liveEvents = ((state as any).liveEvents ?? []).slice(0, 5).map((e: any) => ({
      type: e?.type ?? 'change',
      description: e?.description ?? e?.label ?? '',
      at: e?.at ?? e?.timestamp ?? new Date().toISOString(),
    }));
    return {
      nodeCount,
      edgeCount,
      topRisks,
      recentChanges: liveEvents,
      entityCount: nodeCount,
    };
  } catch (err) {
    console.warn('[Context Engine] graph gather failed:', err);
    return null;
  }
}

interface TwinSlice {
  healthScore: number;
  cashRunwayDays: number;
  anomalies: number;
  forecastDirection: 'up' | 'down' | 'stable';
}

async function gatherTwin(): Promise<TwinSlice | null> {
  try {
    const mod = await import('@/lib/twin/orchestrator');
    const bundle = await withTimeout('twin.getCachedDigitalTwinBundle', mod.getCachedDigitalTwinBundle(), null as never);
    if (!bundle) return null;
    const state = (bundle as any).state ?? {};
    const anomalies = (bundle as any).anomalies ?? {};
    const forecast = (bundle as any).forecast ?? {};
    const sevenDay = forecast?.revenue?.sevenDay ?? 0;
    const thirtyDay = forecast?.revenue?.thirtyDay ?? 0;
    let forecastDirection: 'up' | 'down' | 'stable' = 'stable';
    if (thirtyDay > sevenDay * 1.05) forecastDirection = 'up';
    else if (thirtyDay < sevenDay * 0.95 && thirtyDay > 0) forecastDirection = 'down';
    return {
      healthScore: typeof state.healthScore === 'number' ? state.healthScore : 0,
      cashRunwayDays: typeof state.runwayDays === 'number' ? state.runwayDays : 0,
      anomalies: typeof anomalies.totalCount === 'number' ? anomalies.totalCount : (anomalies.anomalies?.length ?? 0),
      forecastDirection,
    };
  } catch (err) {
    console.warn('[Context Engine] twin gather failed:', err);
    return null;
  }
}

interface CFOSlice {
  cashBalance: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  gstCollected: number;
  gstPaid: number;
  receivables: number;
  payables: number;
}

async function gatherCFO(): Promise<CFOSlice | null> {
  try {
    const mod = await import('@/lib/cfo/engine');
    const resp = await withTimeout('cfo.generateCFOInsights', mod.generateCFOInsights(), null as never);
    if (!resp) return null;
    const d = (resp as any).dashboard ?? {};
    const cash = d.cash ?? {};
    const rev = d.revenue ?? {};
    const recv = d.receivables ?? {};
    const pay = d.payables ?? {};
    const gst = d.gst ?? {};
    // ITC ~ gst paid; liability ~ gst collected (rough mapping)
    return {
      cashBalance: cash.currentBalance ?? 0,
      monthlyRevenue: rev.thisMonth ?? 0,
      monthlyExpenses: (resp as any).extendedMetrics?.expenses ?? 0,
      gstCollected: gst.liability ?? 0,
      gstPaid: gst.itcAvailable ?? 0,
      receivables: recv.pendingCollections ?? 0,
      payables: pay.vendorDues ?? 0,
    };
  } catch (err) {
    console.warn('[Context Engine] cfo gather failed:', err);
    return null;
  }
}

interface ConnectivitySlice {
  total: number;
  healthy: number;
  failing: number;
  avgReliability: number;
}

async function gatherConnectivity(): Promise<ConnectivitySlice | null> {
  try {
    const mod = await import('@/lib/connectivity/orchestrator');
    const dash = await withTimeout(
      'connectivity.getConnectivityDashboard',
      mod.getConnectivityDashboard(),
      null as never,
    );
    if (!dash) return null;
    return {
      total: (dash as any).totalInstalled ?? 0,
      healthy: (dash as any).activeConnectors ?? 0,
      failing: (dash as any).failingConnectors ?? 0,
      avgReliability: (dash as any).avgReliability ?? 0,
    };
  } catch (err) {
    console.warn('[Context Engine] connectivity gather failed:', err);
    return null;
  }
}

interface EventsSlice {
  recentEvents: Array<{ type: string; severity: string; title: string; at: string }>;
}

async function gatherEvents(): Promise<EventsSlice> {
  try {
    const rows = await withTimeout(
      'businessEvent.findMany',
      db.businessEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      [] as any[],
    );
    const recentEvents = ((rows as any[]) ?? []).map((r: any) => ({
      type: r.type ?? 'event',
      severity: r.severity ?? 'info',
      title: r.payload ? safeStringSummary(r.payload) : (r.type ?? 'Business event'),
      at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? new Date().toISOString()),
    }));
    return { recentEvents };
  } catch (err) {
    console.warn('[Context Engine] events gather failed:', err);
    return { recentEvents: [] };
  }
}

function safeStringSummary(payload: string): string {
  try {
    const obj = JSON.parse(payload);
    return obj?.title || obj?.description || obj?.message || 'Business event';
  } catch {
    return 'Business event';
  }
}

// ─── Prisma business record gatherers ───────────────────────────────────────

async function gatherInvoices(): Promise<BusinessContext['recentInvoices']> {
  try {
    const rows = await withTimeout(
      'invoice.findMany',
      db.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          status: true,
          invoiceDate: true,
          createdAt: true,
        },
      }),
      [] as any[],
    );
    return ((rows as any[]) ?? []).map((r: any) => ({
      invoiceNumber: r.invoiceNumber ?? '',
      total: r.totalAmount ?? 0,
      status: r.status ?? 'draft',
      date: r.invoiceDate || (r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? '')),
    }));
  } catch (err) {
    console.warn('[Context Engine] invoice gather failed:', err);
    return [];
  }
}

async function gatherReports(): Promise<BusinessContext['recentReports']> {
  try {
    const rows = await withTimeout(
      'document.findMany',
      db.document.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        where: { isLatest: true },
        select: { id: true, name: true, fileType: true, folder: true, createdAt: true },
      }),
      [] as any[],
    );
    return ((rows as any[]) ?? []).map((r: any) => ({
      title: r.name ?? '',
      type: r.fileType ?? r.folder ?? 'document',
      at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ''),
    }));
  } catch (err) {
    console.warn('[Context Engine] reports gather failed:', err);
    return [];
  }
}

async function gatherPendingApprovals(): Promise<BusinessContext['pendingApprovals']> {
  try {
    const rows = await withTimeout(
      'cEODecision.findMany.pending',
      (db as any).cEODecision.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          type: true,
          approvalRequired: true,
          requiresRole: true,
          createdAt: true,
        },
      }),
      [] as any[],
    );
    return ((rows as any[]) ?? []).map((r: any) => ({
      id: r.id ?? '',
      title: r.title ?? '',
      type: r.type ?? 'decision',
      requestedBy: r.requiresRole ?? r.approvalRequired ?? 'manager',
      at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ''),
    }));
  } catch (err) {
    console.warn('[Context Engine] pending approvals gather failed:', err);
    return [];
  }
}

async function gatherGoals(): Promise<BusinessContext['goals']> {
  try {
    const rows = await withTimeout(
      'cEOGoal.findMany.active',
      (db as any).cEOGoal.findMany({
        where: { status: { in: ['on_track', 'at_risk', 'behind'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, progressPct: true, deadline: true, status: true },
      }),
      [] as any[],
    );
    return ((rows as any[]) ?? []).map((r: any) => ({
      title: r.title ?? '',
      progress: typeof r.progressPct === 'number' ? r.progressPct : 0,
      deadline: r.deadline instanceof Date ? r.deadline.toISOString() : (r.deadline ? String(r.deadline) : null),
    }));
  } catch (err) {
    console.warn('[Context Engine] goals gather failed:', err);
    return [];
  }
}

async function gatherStrategies(): Promise<BusinessContext['strategies']> {
  try {
    const rows = await withTimeout(
      'cEOStrategy.findMany.active',
      (db as any).cEOStrategy.findMany({
        where: { status: { in: ['active', 'on_track', 'proposed'] } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, status: true },
      }),
      [] as any[],
    );
    return ((rows as any[]) ?? []).map((r: any) => ({
      title: r.title ?? '',
      status: r.status ?? 'proposed',
    }));
  } catch (err) {
    console.warn('[Context Engine] strategies gather failed:', err);
    return [];
  }
}

async function gatherConversations(): Promise<BusinessContext['previousConversations']> {
  try {
    const rows = await withTimeout(
      'oracleConversation.findMany',
      (db as any).oracleConversation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, topic: true, consensus: true, createdAt: true },
      }),
      [] as any[],
    );
    return ((rows as any[]) ?? []).map((r: any) => ({
      topic: r.topic ?? '',
      at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ''),
      consensus: r.consensus ?? null,
    }));
  } catch (err) {
    console.warn('[Context Engine] conversations gather failed:', err);
    return [];
  }
}

async function gatherKnowledgeCount(): Promise<{ entityCount: number; recentUpdates: number }> {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [memCount, recent] = await Promise.all([
      withTimeout(
        'oracleMemory.count',
        (db as any).oracleMemory.count(),
        0 as never,
      ),
      withTimeout(
        'oracleMemory.count.24h',
        (db as any).oracleMemory.count({ where: { createdAt: { gte: since24h } } }),
        0 as never,
      ),
    ]);
    return { entityCount: memCount ?? 0, recentUpdates: recent ?? 0 };
  } catch (err) {
    console.warn('[Context Engine] knowledge count failed:', err);
    return { entityCount: 0, recentUpdates: 0 };
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Gather business context from all connected systems before an AI call.
 * Never throws. Returns a valid BusinessContext (zeros on full failure).
 */
export async function gatherBusinessContext(firmId?: string): Promise<BusinessContext> {
  const fid = firmId || FIRM_ID;
  const base = emptyContext(fid);

  // Run every module gather in parallel — each is independently fault-tolerant.
  const [
    graphSlice,
    twinSlice,
    cfoSlice,
    connSlice,
    eventsSlice,
    invoices,
    reports,
    approvals,
    goals,
    strategies,
    conversations,
    knowledge,
  ] = await Promise.all([
    gatherGraph(),
    gatherTwin(),
    gatherCFO(),
    gatherConnectivity(),
    gatherEvents(),
    gatherInvoices(),
    gatherReports(),
    gatherPendingApprovals(),
    gatherGoals(),
    gatherStrategies(),
    gatherConversations(),
    gatherKnowledgeCount(),
  ]);

  if (graphSlice) {
    base.graph = {
      nodeCount: graphSlice.nodeCount,
      edgeCount: graphSlice.edgeCount,
      topRisks: graphSlice.topRisks,
      recentChanges: graphSlice.recentChanges,
    };
    base.knowledge.entityCount = Math.max(base.knowledge.entityCount, graphSlice.entityCount);
  }
  if (twinSlice) {
    base.twin = { ...twinSlice };
  }
  if (cfoSlice) {
    base.finance = { ...cfoSlice };
  }
  if (connSlice) {
    base.connectedSystems = { ...connSlice };
  }
  base.recentEvents = eventsSlice.recentEvents;
  base.recentInvoices = invoices;
  base.recentReports = reports;
  base.pendingApprovals = approvals;
  base.goals = goals;
  base.strategies = strategies;
  base.previousConversations = conversations;
  base.knowledge.recentUpdates = knowledge.recentUpdates;
  if (base.knowledge.entityCount === 0) {
    base.knowledge.entityCount = knowledge.entityCount;
  }

  // Token estimate (~JSON length / 4 — industry-standard rough heuristic).
  const json = JSON.stringify(base);
  base.estimatedTokens = Math.ceil(json.length / 4);

  return base;
}

// ─── Compact prompt formatter ───────────────────────────────────────────────

/**
 * Format a BusinessContext into a compact (~2-4KB) text block for LLM prompts.
 * Grouped by section with markdown headers. Truncates long lists.
 */
export function formatContextForPrompt(ctx: BusinessContext): string {
  const lines: string[] = [];
  const num = (n: number) => (Number.isFinite(n) ? n.toString() : '0');
  const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

  lines.push(`# Business Context (gathered ${ctx.gatheredAt})`);
  lines.push(`Firm: ${ctx.firmId}`);

  lines.push('');
  lines.push('## Finance');
  lines.push(`- Cash balance: ${inr(ctx.finance.cashBalance)}`);
  lines.push(`- Revenue (MTD): ${inr(ctx.finance.monthlyRevenue)}`);
  lines.push(`- Expenses (MTD): ${inr(ctx.finance.monthlyExpenses)}`);
  lines.push(`- GST collected: ${inr(ctx.finance.gstCollected)}`);
  lines.push(`- GST paid (ITC): ${inr(ctx.finance.gstPaid)}`);
  lines.push(`- Receivables: ${inr(ctx.finance.receivables)}`);
  lines.push(`- Payables: ${inr(ctx.finance.payables)}`);

  lines.push('');
  lines.push('## Digital Twin');
  lines.push(`- Health score: ${num(ctx.twin.healthScore)}/100`);
  lines.push(`- Cash runway: ${num(ctx.twin.cashRunwayDays)} days`);
  lines.push(`- Anomalies: ${num(ctx.twin.anomalies)}`);
  lines.push(`- Forecast direction: ${ctx.twin.forecastDirection}`);

  lines.push('');
  lines.push('## Business Graph');
  lines.push(`- Nodes: ${num(ctx.graph.nodeCount)} | Edges: ${num(ctx.graph.edgeCount)}`);
  if (ctx.graph.topRisks.length > 0) {
    lines.push('- Top risks:');
    for (const r of ctx.graph.topRisks.slice(0, 5)) {
      lines.push(`  • ${r.label} (score ${num(r.score)})`);
    }
  }

  lines.push('');
  lines.push('## Connected Systems');
  lines.push(
    `- Total: ${num(ctx.connectedSystems.total)} | Healthy: ${num(ctx.connectedSystems.healthy)} | Failing: ${num(ctx.connectedSystems.failing)}`,
  );
  lines.push(`- Avg reliability: ${num(ctx.connectedSystems.avgReliability)}%`);

  lines.push('');
  lines.push('## Knowledge & Memory');
  lines.push(`- Entities: ${num(ctx.knowledge.entityCount)} | Updates 24h: ${num(ctx.knowledge.recentUpdates)}`);

  if (ctx.recentEvents.length > 0) {
    lines.push('');
    lines.push('## Recent Events');
    for (const e of ctx.recentEvents.slice(0, 5)) {
      lines.push(`- [${e.severity}] ${e.type}: ${e.title}`);
    }
  }

  if (ctx.recentInvoices.length > 0) {
    lines.push('');
    lines.push('## Recent Invoices');
    for (const i of ctx.recentInvoices.slice(0, 5)) {
      lines.push(`- ${i.invoiceNumber}: ${inr(i.total)} (${i.status})`);
    }
  }

  if (ctx.recentReports.length > 0) {
    lines.push('');
    lines.push('## Recent Reports / Documents');
    for (const r of ctx.recentReports.slice(0, 5)) {
      lines.push(`- ${r.title} [${r.type}]`);
    }
  }

  if (ctx.pendingApprovals.length > 0) {
    lines.push('');
    lines.push('## Pending Approvals');
    for (const a of ctx.pendingApprovals.slice(0, 5)) {
      lines.push(`- ${a.title} (${a.type}) — requested by ${a.requestedBy}`);
    }
  }

  if (ctx.goals.length > 0) {
    lines.push('');
    lines.push('## Active Goals');
    for (const g of ctx.goals.slice(0, 5)) {
      lines.push(`- ${g.title} — ${num(g.progress)}% progress`);
    }
  }

  if (ctx.strategies.length > 0) {
    lines.push('');
    lines.push('## Active Strategies');
    for (const s of ctx.strategies.slice(0, 5)) {
      lines.push(`- ${s.title} (${s.status})`);
    }
  }

  if (ctx.previousConversations.length > 0) {
    lines.push('');
    lines.push('## Previous Oracle Conversations');
    for (const c of ctx.previousConversations.slice(0, 3)) {
      lines.push(`- ${c.topic}${c.consensus ? ` → ${c.consensus.slice(0, 120)}` : ''}`);
    }
  }

  lines.push('');
  lines.push(`_Estimated context tokens: ${ctx.estimatedTokens}_`);

  return lines.join('\n');
}

// ─── 30-second in-memory cache ──────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 1000;
let cache: { at: number; ctx: BusinessContext } | null = null;

/**
 * Return the cached BusinessContext if fresh (<30s), otherwise refresh.
 * Pass force=true to bypass the cache and force a fresh gather.
 */
export async function getCachedContext(force?: boolean): Promise<BusinessContext> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.ctx;
  }
  const ctx = await gatherBusinessContext();
  cache = { at: Date.now(), ctx };
  return ctx;
}

/** Invalidate the in-memory cache (used by tests / explicit refresh). */
export function invalidateContextCache(): void {
  cache = null;
}
