// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle Intelligence Core™ — Global AI Orchestrator™
// ONE central orchestrator. Every AI module communicates through it. No isolated
// engines. The Oracle dashboard is the single source of truth for brain health,
// memory, model routing, reasoning, conversations, insights, learning, and
// security across all 17 AI modules.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  AIModuleId,
  AIModuleInfo,
  OracleDashboard,
} from './types';
import { getMemoryStats } from './memory';
import { getRouterStats } from './router';
import { getConversationStats } from './conversation';
import { getLearningStats } from './learning';

const FIRM_ID = process.env.NEXT_PUBLIC_FIRM_ID || 'gstpilot-default-firm';

// ─── Module Registry ─────────────────────────────────────────────────────────
// Maps each of the 17 conceptual AI modules to its real entry point path. Some
// entry points are shared across multiple modules (e.g. CFO data backs both
// 'cfo' and 'legal'; RMB backs both 'marketing' and 'operations').

interface ModuleRegistryEntry {
  id: AIModuleId;
  label: string;
  entryPoint: string;
  /** Group key — modules sharing the same group share one underlying call. */
  group: string;
}

const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  { id: 'oracle', label: 'Oracle Intelligence Core™', entryPoint: './orchestrator:getOracleDashboard', group: 'oracle' },
  { id: 'ceo', label: 'AI CEO™', entryPoint: '@/lib/ceo/orchestrator:getCachedCEODashboard', group: 'ceo' },
  { id: 'cfo', label: 'AI CFO™', entryPoint: '@/lib/cfo/engine:generateCFOInsights', group: 'cfo' },
  { id: 'coo', label: 'AI COO™', entryPoint: '@/lib/autonomous/orchestrator:getAutonomousDashboard', group: 'autonomous' },
  { id: 'cto', label: 'AI CTO™', entryPoint: '@/lib/software-factory/engine:getFactoryDashboard', group: 'factory' },
  { id: 'cro', label: 'AI CRO™', entryPoint: '@/lib/graph/engine:getGraphState', group: 'graph' },
  { id: 'legal', label: 'AI Legal™', entryPoint: '@/lib/cfo/engine:generateCFOInsights (compliance scan)', group: 'cfo' },
  { id: 'hr', label: 'AI HR™', entryPoint: '@/lib/autonomous/orchestrator:getAutonomousDashboard (roster scan)', group: 'autonomous' },
  { id: 'marketing', label: 'AI Marketing™', entryPoint: '@/lib/rmb/engine:getRmbState (agents + autopilots)', group: 'rmb' },
  { id: 'operations', label: 'AI Operations™', entryPoint: '@/lib/rmb/engine:getRmbState (task queue)', group: 'rmb' },
  { id: 'graph', label: 'Business Graph™', entryPoint: '@/lib/graph/engine:getGraphState', group: 'graph' },
  { id: 'knowledge', label: 'Knowledge Graph™', entryPoint: '@/lib/graph/engine:getGraphState (memory graph)', group: 'graph' },
  { id: 'twin', label: 'Digital Twin™', entryPoint: '@/lib/twin/orchestrator:getCachedDigitalTwinBundle', group: 'twin' },
  { id: 'autonomous', label: 'Autonomous Enterprise™', entryPoint: '@/lib/autonomous/orchestrator:getAutonomousDashboard', group: 'autonomous' },
  { id: 'connectivity', label: 'Connectivity Fabric™', entryPoint: '@/lib/connectivity/orchestrator:getConnectivityDashboard', group: 'connectivity' },
  { id: 'factory', label: 'AI Software Factory™', entryPoint: '@/lib/software-factory/engine:getFactoryDashboard', group: 'factory' },
  { id: 'event', label: 'Event Stream Engine™', entryPoint: '@/lib/connectivity/orchestrator:getConnectivityDashboard (events)', group: 'connectivity' },
];

// ─── In-memory cache (45s) ──────────────────────────────────────────────────

let cache: { at: number; data: OracleDashboard } | null = null;
let moduleListCache: { at: number; data: AIModuleInfo[] } | null = null;
const CACHE_TTL_MS = 45 * 1000;

/** Invalidate the dashboard + module list caches. Call after any state-changing
 *  operation (writeMemory, recordLearning, etc.) to force a fresh gather. */
export function invalidateOracleCache(): void {
  cache = null;
  moduleListCache = null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface TimedCallResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

async function timeCall<T>(fn: () => Promise<T>): Promise<TimedCallResult & { data?: T }> {
  const start = Date.now();
  try {
    const data = await fn();
    return { ok: true, latencyMs: Date.now() - start, data };
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ─── Module calls ───────────────────────────────────────────────────────────
// Call all entry-point groups in parallel. Each group result populates the
// status of every module sharing that group. The 'oracle' group is self and
// always treated as online.

interface GroupCallSpec {
  group: string;
  fn: () => Promise<unknown>;
}

function buildGroupCalls(): GroupCallSpec[] {
  return [
    {
      group: 'ceo',
      fn: async () => {
        const m = await import('@/lib/ceo/orchestrator');
        return m.getCachedCEODashboard();
      },
    },
    {
      group: 'cfo',
      fn: async () => {
        const m = await import('@/lib/cfo/engine');
        return m.generateCFOInsights();
      },
    },
    {
      group: 'autonomous',
      fn: async () => {
        const m = await import('@/lib/autonomous/orchestrator');
        return m.getAutonomousDashboard();
      },
    },
    {
      group: 'connectivity',
      fn: async () => {
        const m = await import('@/lib/connectivity/orchestrator');
        return m.getConnectivityDashboard();
      },
    },
    {
      group: 'factory',
      fn: async () => {
        const m = await import('@/lib/software-factory/engine');
        return m.getFactoryDashboard();
      },
    },
    {
      group: 'graph',
      fn: async () => {
        const m = await import('@/lib/graph/engine');
        return m.getGraphState();
      },
    },
    {
      group: 'twin',
      fn: async () => {
        const m = await import('@/lib/twin/orchestrator');
        return m.getCachedDigitalTwinBundle();
      },
    },
    {
      group: 'rmb',
      fn: async () => {
        const m = await import('@/lib/rmb/engine');
        return m.getRmbState();
      },
    },
  ];
}

// ─── Sibling module loaders (dynamic, try/catch) ────────────────────────────
// The reasoning, context, insights, and security modules are built in parallel.
// They may not exist yet — never crash if they're missing.

async function loadReasoningStats(): Promise<{
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  byType: Record<string, number>;
  avgConfidence: number;
}> {
  const fallback = { total: 0, approved: 0, rejected: 0, pending: 0, byType: {} as Record<string, number>, avgConfidence: 0 };
  try {
    const m: any = await import('./reasoning');
    if (typeof m.getReasoningStats === 'function') {
      return await m.getReasoningStats();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function loadInsightStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  acknowledged: number;
  actedOn: number;
  topImpact: any | null;
}> {
  const fallback = { total: 0, byCategory: {} as Record<string, number>, acknowledged: 0, actedOn: 0, topImpact: null };
  try {
    const m: any = await import('./insights');
    if (typeof m.getInsightStats === 'function') {
      return await m.getInsightStats();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function loadSecurityStats(): Promise<{
  totalCalls: number;
  rateLimited: number;
  rbacEnforced: number;
  auditLogged: number;
  errors: number;
}> {
  const fallback = { totalCalls: 0, rateLimited: 0, rbacEnforced: 0, auditLogged: 0, errors: 0 };
  try {
    const m: any = await import('./security');
    if (typeof m.getSecurityStats === 'function') {
      return await m.getSecurityStats();
    }
    return fallback;
  } catch {
    return fallback;
  }
}

// ─── Recent activity ─────────────────────────────────────────────────────────

interface ActivityRow {
  type: string;
  title: string;
  at: string;
  module: AIModuleId;
}

async function gatherRecentActivity(): Promise<ActivityRow[]> {
  const firmId = FIRM_ID;
  try {
    const [memories, reasonings, conversations, insights] = await Promise.all([
      db.oracleMemory.findMany({
        where: { firmId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, source: true, category: true, createdAt: true },
      }),
      db.oracleReasoning.findMany({
        where: { firmId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, request: true, requestType: true, createdAt: true },
      }),
      db.oracleConversation.findMany({
        where: { firmId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, topic: true, status: true, createdAt: true },
      }),
      db.oracleInsight.findMany({
        where: { firmId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, category: true, createdAt: true },
      }),
    ]);

    const activity: ActivityRow[] = [];

    for (const m of memories) {
      activity.push({
        type: `memory:${m.category}`,
        title: m.title,
        at: m.createdAt.toISOString(),
        module: (m.source as AIModuleId) ?? 'oracle',
      });
    }
    for (const r of reasonings) {
      activity.push({
        type: `reasoning:${r.requestType}`,
        title: r.request.slice(0, 120),
        at: r.createdAt.toISOString(),
        module: 'oracle',
      });
    }
    for (const c of conversations) {
      activity.push({
        type: `conversation:${c.status}`,
        title: c.topic,
        at: c.createdAt.toISOString(),
        module: 'oracle',
      });
    }
    for (const i of insights) {
      activity.push({
        type: `insight:${i.category}`,
        title: i.title,
        at: i.createdAt.toISOString(),
        module: 'oracle',
      });
    }

    activity.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return activity.slice(0, 10);
  } catch (e) {
    console.warn('[Oracle Orchestrator] failed to gather recent activity:', e);
    return [];
  }
}

// ─── Main dashboard builder ─────────────────────────────────────────────────

export async function getOracleDashboard(): Promise<OracleDashboard> {
  // Cache hit?
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const firmId = FIRM_ID;

  // 1. Call all module entry points in parallel
  const groupCalls = buildGroupCalls();
  const callResults = await Promise.allSettled(groupCalls.map((c) => timeCall(c.fn)));

  // Build group → result map
  const groupResults = new Map<string, TimedCallResult>();
  groupCalls.forEach((spec, idx) => {
    const result = callResults[idx];
    if (result.status === 'fulfilled') {
      groupResults.set(spec.group, result.value);
    } else {
      groupResults.set(spec.group, { ok: false, latencyMs: 0, error: String(result.reason) });
    }
  });

  // 2. Build module status list
  const nowIso = new Date().toISOString();
  const moduleStatuses: AIModuleInfo[] = MODULE_REGISTRY.map((entry) => {
    if (entry.group === 'oracle') {
      // Self — always online.
      return {
        id: entry.id,
        label: entry.label,
        entryPoint: entry.entryPoint,
        status: 'online',
        lastCheckedAt: nowIso,
      };
    }
    const result = groupResults.get(entry.group);
    const status: AIModuleInfo['status'] = result?.ok ? 'online' : 'offline';
    return {
      id: entry.id,
      label: entry.label,
      entryPoint: entry.entryPoint,
      status,
      lastCheckedAt: nowIso,
    };
  });

  // 3. Brain health metrics
  const nonOracleModules = moduleStatuses.filter((m) => m.id !== 'oracle');
  const modulesOnline = nonOracleModules.filter((m) => m.status === 'online').length;
  const modulesTotal = nonOracleModules.length;
  const overall = modulesTotal > 0 ? Math.round((modulesOnline / modulesTotal) * 100) : 100;

  // Average response time across all called groups (each group weighted by its module count)
  const latencies: number[] = [];
  for (const entry of MODULE_REGISTRY) {
    if (entry.group === 'oracle') continue;
    const result = groupResults.get(entry.group);
    if (result && result.ok) latencies.push(result.latencyMs);
  }
  const avgResponseMs = latencies.length > 0
    ? Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length)
    : 0;

  // 4. Parallel: sibling stats + memory/router/conversation/learning
  const [
    memoryStats,
    routerStats,
    conversationStats,
    learningStats,
    reasoningStats,
    insightStats,
    securityStats,
    recentActivity,
  ] = await Promise.all([
    getMemoryStats().catch(() => ({ totalRecords: 0, byCategory: {}, bySource: {}, last24h: 0 })),
    getRouterStats().catch(() => ({
      totalCalls: 0, byProvider: {}, byTier: {}, successRate: 100,
      avgLatencyMs: 0, totalCostUsd: 0, fallbacksTriggered: 0,
    })),
    getConversationStats().catch(() => ({ total: 0, active: 0, consensusReached: 0 })),
    getLearningStats().catch(() => ({ totalLessons: 0, appliedRecently: 0, topLessons: [] })),
    loadReasoningStats(),
    loadInsightStats(),
    loadSecurityStats(),
    gatherRecentActivity(),
  ]);

  const dashboard: OracleDashboard = {
    gatheredAt: nowIso,
    firmId,
    brainHealth: {
      overall,
      modulesOnline,
      modulesTotal,
      modules: moduleStatuses,
      cacheHitRate: 0, // populated below
      avgResponseMs,
    },
    memory: memoryStats,
    router: routerStats,
    reasoning: reasoningStats,
    conversations: conversationStats,
    insights: insightStats,
    learning: learningStats,
    security: securityStats,
    recentActivity,
  };

  // Estimate cache hit rate from router calls vs memory writes (rough proxy).
  // If we have no router calls yet, default to 100% (cold start).
  try {
    const routerTotal = (routerStats as any).totalCalls ?? 0;
    const memoryTotal = memoryStats.totalRecords ?? 0;
    if (routerTotal === 0) {
      dashboard.brainHealth.cacheHitRate = 100;
    } else {
      // Memory lookups served from cache vs LLM calls — a rough proxy for
      // "how often did we serve answers without calling a model".
      const hitRatio = memoryTotal > 0
        ? Math.min(100, Math.round((memoryTotal / (memoryTotal + routerTotal)) * 100))
        : 0;
      dashboard.brainHealth.cacheHitRate = hitRatio;
    }
  } catch {
    dashboard.brainHealth.cacheHitRate = 0;
  }

  // Persist to cache
  cache = { at: Date.now(), data: dashboard };

  // Also invalidate the module list cache so the next listAIModules() call
  // picks up the fresh statuses.
  moduleListCache = null;

  return dashboard;
}

// ─── Static module list with cached live statuses ───────────────────────────

/** Return the static registry of 17 modules with live statuses. Cached 45s. */
export async function listAIModules(): Promise<AIModuleInfo[]> {
  if (moduleListCache && Date.now() - moduleListCache.at < CACHE_TTL_MS) {
    return moduleListCache.data;
  }

  const dashboard = await getOracleDashboard();
  const statuses = new Map<AIModuleId, AIModuleInfo>();
  for (const m of dashboard.brainHealth.modules) {
    statuses.set(m.id, m);
  }

  const list: AIModuleInfo[] = MODULE_REGISTRY.map((entry) => {
    const live = statuses.get(entry.id);
    return {
      id: entry.id,
      label: entry.label,
      entryPoint: entry.entryPoint,
      status: live?.status ?? 'offline',
      lastCheckedAt: live?.lastCheckedAt ?? null,
    };
  });

  moduleListCache = { at: Date.now(), data: list };
  return list;
}

// ─── Generic action router ──────────────────────────────────────────────────

export interface RouteResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

/** Route an action to the appropriate existing module entry point.
 *  Unknown (moduleId, action) combinations return `{ ok: false, error }`. */
export async function routeToModule(
  moduleId: AIModuleId,
  action: string,
  payload?: Record<string, unknown>,
): Promise<RouteResult> {
  const key = `${moduleId}:${action}`;
  try {
    switch (key) {
      // ─── Oracle self ────────────────────────────────────────────────────
      case 'oracle:dashboard':
        return { ok: true, data: await getOracleDashboard() };
      case 'oracle:modules':
        return { ok: true, data: await listAIModules() };

      // ─── CEO ────────────────────────────────────────────────────────────
      case 'ceo:dashboard':
      case 'ceo:get': {
        const m = await import('@/lib/ceo/orchestrator');
        const role = (payload?.role as any) ?? 'ceo';
        const userName = payload?.userName as string | undefined;
        return { ok: true, data: await m.getCachedCEODashboard(role, userName) };
      }
      case 'ceo:compute': {
        const m = await import('@/lib/ceo/orchestrator');
        const role = (payload?.role as any) ?? 'ceo';
        const userName = payload?.userName as string | undefined;
        return { ok: true, data: await m.computeCEODashboard(role, userName) };
      }
      case 'ceo:oracle-context': {
        const m = await import('@/lib/ceo/orchestrator');
        return { ok: true, data: await m.computeCEOOracleContext() };
      }
      case 'ceo:decisions': {
        const m = await import('@/lib/ceo/orchestrator');
        return { ok: true, data: m.listDecisions() };
      }

      // ─── CFO ────────────────────────────────────────────────────────────
      case 'cfo:insights':
      case 'cfo:get':
      case 'cfo:dashboard': {
        const m = await import('@/lib/cfo/engine');
        const user = payload?.user as { name?: string } | null | undefined;
        return { ok: true, data: await m.generateCFOInsights(user ?? null) };
      }

      // ─── COO / Autonomous ──────────────────────────────────────────────
      case 'coo:dashboard':
      case 'autonomous:dashboard':
      case 'autonomous:get': {
        const m = await import('@/lib/autonomous/orchestrator');
        return { ok: true, data: await m.getAutonomousDashboard() };
      }

      // ─── CTO / Factory ─────────────────────────────────────────────────
      case 'cto:dashboard':
      case 'factory:dashboard':
      case 'factory:get': {
        const m = await import('@/lib/software-factory/engine');
        return { ok: true, data: await m.getFactoryDashboard() };
      }
      case 'factory:projects': {
        const m = await import('@/lib/software-factory/engine');
        return { ok: true, data: await m.getProjects() };
      }
      case 'factory:components': {
        const m = await import('@/lib/software-factory/engine');
        return { ok: true, data: await m.getComponents() };
      }

      // ─── CRO / Graph ───────────────────────────────────────────────────
      case 'cro:state':
      case 'graph:state':
      case 'graph:get': {
        const m = await import('@/lib/graph/engine');
        return { ok: true, data: await m.getGraphState() };
      }

      // ─── Twin ──────────────────────────────────────────────────────────
      case 'twin:bundle':
      case 'twin:get': {
        const m = await import('@/lib/twin/orchestrator');
        return { ok: true, data: await m.getCachedDigitalTwinBundle() };
      }
      case 'twin:oracle-context': {
        const m = await import('@/lib/twin/orchestrator');
        return { ok: true, data: await m.computeTwinOracleContext() };
      }

      // ─── Connectivity / Event ──────────────────────────────────────────
      case 'connectivity:dashboard':
      case 'connectivity:get':
      case 'event:dashboard': {
        const m = await import('@/lib/connectivity/orchestrator');
        return { ok: true, data: await m.getConnectivityDashboard() };
      }

      // ─── Marketing / Operations / RMB ─────────────────────────────────
      case 'marketing:state':
      case 'operations:state':
      case 'operations:rmb': {
        const m = await import('@/lib/rmb/engine');
        const user = payload?.user as { name?: string } | null | undefined;
        return { ok: true, data: await m.getRmbState(user ?? null) };
      }

      // ─── HR (uses autonomous dashboard for roster) ────────────────────
      case 'hr:roster': {
        const m = await import('@/lib/autonomous/orchestrator');
        const d: any = await m.getAutonomousDashboard();
        return { ok: true, data: d?.executives ?? [] };
      }

      // ─── Knowledge (uses graph state) ─────────────────────────────────
      case 'knowledge:state': {
        const m = await import('@/lib/graph/engine');
        const s: any = await m.getGraphState();
        return { ok: true, data: s?.memoryGraph ?? s?.memory ?? null };
      }

      // ─── Legal (uses CFO compliance scan) ─────────────────────────────
      case 'legal:compliance-scan': {
        const m = await import('@/lib/cfo/engine');
        const cfo: any = await m.generateCFOInsights();
        return {
          ok: true,
          data: {
            gst: cfo?.dashboard?.gst ?? null,
            risks: (cfo?.risks ?? []).filter((r: any) => r.category === 'compliance' || r.category === 'notice'),
            upcomingFilings: cfo?.dashboard?.gst?.upcomingDueDates ?? [],
          },
        };
      }

      // ─── Oracle memory/reasoning/learning/conversation shortcuts ─────
      case 'oracle:memory-search': {
        const m = await import('./memory');
        return { ok: true, data: await m.searchMemory(payload as any) };
      }
      case 'oracle:memory-write': {
        const m = await import('./memory');
        return { ok: true, data: await m.writeMemory(payload as any) };
      }
      case 'oracle:reason': {
        try {
          const m: any = await import('./reasoning');
          if (typeof m.reason === 'function') {
            return { ok: true, data: await m.reason(payload as any) };
          }
          return { ok: false, error: 'Reasoning module not yet available' };
        } catch (e) {
          return { ok: false, error: 'Reasoning module not yet available' };
        }
      }
      case 'oracle:conversation-run': {
        const m = await import('./conversation');
        const topic = (payload?.topic as string) ?? 'Untitled topic';
        return { ok: true, data: await m.runExecutiveConversation(topic, payload as any) };
      }
      case 'oracle:learning-record': {
        const m = await import('./learning');
        return { ok: true, data: await m.recordLearning(payload as any) };
      }
      case 'oracle:learning-apply': {
        const m = await import('./learning');
        const id = payload?.id as string;
        const success = Boolean(payload?.success);
        await m.applyLesson(id, success);
        return { ok: true, data: { applied: true } };
      }

      default:
        return { ok: false, error: `Unknown module/action: ${key}` };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
