// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 10: LIVE EXECUTION MAP™
// Real-time execution map. Shows running workflows, countries, AI executives,
// connectors, APIs, workers, organizations, queue health, system health.
// Everything updates live. Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  ExecutionJob, ExecutionWorker, LiveExecutionMap, LiveMapNode, LiveMapEdge,
  LiveMapRegion, ExecutionModule,
} from './types';
import { MODULE_META, ALL_MODULES } from './types';

export function buildLiveMap(
  jobs: ExecutionJob[],
  workers: ExecutionWorker[],
): LiveExecutionMap {
  // ── Module nodes ──
  const jobsByModule = new Map<ExecutionModule, ExecutionJob[]>();
  for (const j of jobs) {
    const arr = jobsByModule.get(j.module) ?? [];
    arr.push(j);
    jobsByModule.set(j.module, arr);
  }
  const modules: LiveMapNode[] = ALL_MODULES.map((m) => {
    const js = jobsByModule.get(m) ?? [];
    const running = js.filter((j) => j.status === 'running').length;
    const failed = js.filter((j) => j.status === 'failed').length;
    const status = running > 0 ? 'busy' : failed > 2 ? 'degraded' : js.length > 0 ? 'healthy' : 'down';
    return {
      id: `module:${m}`,
      kind: 'module',
      label: MODULE_META[m]?.label ?? m,
      status,
      activeJobs: js.length,
      detail: `${running} running · ${failed} failed`,
    };
  });

  // ── Country nodes ──
  const jobsByCountry = new Map<string, ExecutionJob[]>();
  for (const j of jobs) {
    if (!j.countryIso) continue;
    const arr = jobsByCountry.get(j.countryIso) ?? [];
    arr.push(j);
    jobsByCountry.set(j.countryIso, arr);
  }
  const countries: LiveMapNode[] = Array.from(jobsByCountry.entries()).map(([iso, js]) => ({
    id: `country:${iso}`,
    kind: 'country',
    label: iso,
    status: js.some((j) => j.status === 'failed') ? 'degraded' : js.some((j) => j.status === 'running') ? 'busy' : 'healthy',
    activeJobs: js.length,
  }));

  // ── Worker nodes ──
  const workerNodes: LiveMapNode[] = workers.map((w) => ({
    id: `worker:${w.workerId}`,
    kind: 'worker',
    label: w.workerId,
    status: w.status === 'busy' ? 'busy' : w.status === 'offline' ? 'down' : 'healthy',
    activeJobs: w.jobsCompleted + w.jobsFailed,
    detail: `${w.type} · ${w.region ?? 'global'} · ${w.utilizationPct}% util`,
  }));

  // ── Queue nodes ──
  const jobsByQueue = new Map<string, number>();
  for (const j of jobs) jobsByQueue.set(j.queueName, (jobsByQueue.get(j.queueName) ?? 0) + 1);
  const queues: LiveMapNode[] = Array.from(jobsByQueue.entries()).map(([name, count]) => ({
    id: `queue:${name}`,
    kind: 'queue',
    label: name,
    status: count > 20 ? 'degraded' : count > 0 ? 'busy' : 'healthy',
    activeJobs: count,
  }));

  // ── API nodes (one per active module that exposes endpoints) ──
  const apis: LiveMapNode[] = Array.from(jobsByModule.keys()).map((m) => ({
    id: `api:${m}`,
    kind: 'api',
    label: `/api/${m === 'oracle' ? 'oracle' : m.replace(/_/g, '-')}`,
    status: 'healthy',
    activeJobs: jobsByModule.get(m)?.length ?? 0,
  }));

  // ── Connector nodes (connectivity_fabric + crm + banking workers) ──
  const connectorWorkers = workers.filter((w) => w.type === 'connector');
  const connectors: LiveMapNode[] = connectorWorkers.map((w) => ({
    id: `connector:${w.workerId}`,
    kind: 'connector',
    label: w.workerId,
    status: w.status === 'busy' ? 'busy' : 'healthy',
    activeJobs: w.jobsCompleted,
  }));

  // ── Organization nodes (derived from organizationId on jobs) ──
  const orgSet = new Set<string>();
  for (const j of jobs) if (j.organizationId) orgSet.add(j.organizationId);
  const organizations: LiveMapNode[] = Array.from(orgSet).map((orgId) => {
    const js = jobs.filter((j) => j.organizationId === orgId);
    return {
      id: `org:${orgId}`,
      kind: 'organization',
      label: orgId,
      status: js.some((j) => j.status === 'failed') ? 'degraded' : 'healthy',
      activeJobs: js.length,
    };
  });

  // ── Edges — org→module, module→worker, module→queue, module→api, module→connector ──
  const edges: LiveMapEdge[] = [];
  // org → module
  for (const org of organizations) {
    const orgId = org.id.replace('org:', '');
    const moduleCounts = new Map<string, number>();
    for (const j of jobs) {
      if (j.organizationId === orgId) moduleCounts.set(j.module, (moduleCounts.get(j.module) ?? 0) + 1);
    }
    for (const [m, w] of moduleCounts) edges.push({ from: org.id, to: `module:${m}`, weight: w });
  }
  // module → queue
  for (const m of ALL_MODULES) {
    const js = jobsByModule.get(m) ?? [];
    if (js.length === 0) continue;
    const byQ = new Map<string, number>();
    for (const j of js) byQ.set(j.queueName, (byQ.get(j.queueName) ?? 0) + 1);
    for (const [q, w] of byQ) edges.push({ from: `module:${m}`, to: `queue:${q}`, weight: w });
  }
  // module → api (1:1)
  for (const m of jobsByModule.keys()) edges.push({ from: `module:${m}`, to: `api:${m}`, weight: 1 });
  // module → worker (by type affinity)
  const moduleToWorkerType: Partial<Record<ExecutionModule, string>> = {
    oracle: 'ai', ai_ceo: 'ai', ai_cfo: 'ai', ai_coo: 'ai', ai_cto: 'ai',
    ai_cro: 'ai', ai_legal: 'ai', ai_hr: 'ai', ai_marketing: 'ai', ai_operations: 'ai',
    ai_software_factory: 'software_factory',
    connectivity_fabric: 'connector', crm: 'connector', banking: 'connector',
  };
  for (const m of jobsByModule.keys()) {
    const wt = moduleToWorkerType[m];
    if (!wt) continue;
    const ws = workers.filter((w) => w.type === wt);
    if (ws.length > 0) edges.push({ from: `module:${m}`, to: `worker:${ws[0].workerId}`, weight: jobsByModule.get(m)!.length });
  }

  // ── Regions ──
  const regionsMap = new Map<string, { countries: Set<string>; activeJobs: number; healthy: number; total: number; utilSum: number }>();
  for (const w of workers) {
    const r = w.region ?? 'global';
    const entry = regionsMap.get(r) ?? { countries: new Set<string>(), activeJobs: 0, healthy: 0, total: 0, utilSum: 0 };
    entry.total += 1;
    if (w.status !== 'offline') entry.healthy += 1;
    entry.utilSum += w.utilizationPct;
    if (w.countryIso) entry.countries.add(w.countryIso);
    regionsMap.set(r, entry);
  }
  // Attribute jobs to regions via countryIso.
  for (const j of jobs) {
    if (!j.countryIso) continue;
    for (const [, entry] of regionsMap) {
      if (entry.countries.has(j.countryIso)) { entry.activeJobs += 1; break; }
    }
  }
  const regions: LiveMapRegion[] = Array.from(regionsMap.entries()).map(([region, e]) => ({
    region,
    countries: Array.from(e.countries),
    activeJobs: e.activeJobs,
    healthyWorkers: e.healthy,
    totalWorkers: e.total,
    utilizationPct: e.total > 0 ? Math.round((e.utilSum / e.total) * 10) / 10 : 0,
  }));

  const totalActive = jobs.length;
  const totalHealthyWorkers = workers.filter((w) => w.status !== 'offline').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;
  const systemHealth = failedCount > 10 ? 'critical' : failedCount > 3 || workers.filter((w) => w.status === 'offline').length > 2 ? 'degraded' : 'healthy';

  return {
    organizations,
    countries,
    modules,
    workers: workerNodes,
    queues,
    apis,
    connectors,
    edges,
    regions,
    systemHealth,
    totalActiveJobs: totalActive,
    totalHealthyWorkers,
    totalWorkers: workers.length,
    updatedAt: new Date().toISOString(),
  };
}
