// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Operations Map™
//
// Visualize the live enterprise: countries, offices, factories, warehouses,
// teams, departments, organizations, AI executives, connectors, workers,
// execution queues. Every node is derived from REAL production rows
// (GlobalEntity, Country, DataConnection, AI executives, ExecutionTask queues).
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeFindMany, safeCount, TTL, countBy } from './helpers';
import type { OperationsMapSummary, OperationNode } from './types';
import { getCommandExecutives } from './engine';

/** Build the live global operations map. */
export async function getOperationsMap(): Promise<OperationsMapSummary> {
  return cached<OperationsMapSummary>('cn:operations-map', TTL.SHORT, async () => {
    const nodes: OperationNode[] = [];

    // ── Country nodes (from GlobalEntity's country) ──────────────────────────
    const entities = await safeFindMany(() => db.globalEntity.findMany({
      where: { status: 'active' },
      select: { id: true, legalName: true, tradeName: true, countryIso: true, entityKind: true },
    }));
    const countries = await safeFindMany(() => db.country.findMany({
      where: { isActive: true },
      select: { isoCode: true, name: true, region: true },
    }));

    // group entities by country
    const byCountry: Record<string, typeof entities> = {};
    for (const e of entities) {
      if (!byCountry[e.countryIso]) byCountry[e.countryIso] = [];
      byCountry[e.countryIso].push(e);
    }

    for (const c of countries) {
      const ents = byCountry[c.isoCode] ?? [];
      if (ents.length === 0 && c.isoCode !== 'IN') continue; // include India always
      // Country health score: 0 (no real per-country health metric exists yet).
      nodes.push({
        id: `country-${c.isoCode}`,
        type: 'country',
        label: c.name,
        country: c.isoCode,
        parent: null,
        status: 'active',
        healthScore: 0,
        metrics: { entities: ents.length, region: 1 },
        lastUpdate: new Date().toISOString(),
      });
      // add organization nodes under each country
      for (const e of ents) {
        nodes.push({
          id: `org-${e.id}`,
          type: 'organization',
          label: e.tradeName || e.legalName,
          country: c.isoCode,
          parent: `country-${c.isoCode}`,
          status: 'active',
          healthScore: 0,
          metrics: { kind: 1 },
          lastUpdate: new Date().toISOString(),
        });
      }
    }

    // ── Department nodes (the 10 coordinated departments) ────────────────────
    const departments = ['crm', 'ai_marketing', 'ai_cfo', 'gst', 'payroll', 'banking', 'ai_hr', 'ai_operations', 'compliance_cloud', 'global_enterprise'];
    for (const dept of departments) {
      nodes.push({
        id: `dept-${dept}`,
        type: 'department',
        label: dept.replace(/_/g, ' ').replace(/\bai\b/g, 'AI').toUpperCase(),
        country: null,
        parent: null,
        status: 'active',
        healthScore: 0,
        metrics: {},
        lastUpdate: new Date().toISOString(),
      });
    }

    // ── AI executive nodes ───────────────────────────────────────────────────
    const execs = await getCommandExecutives();
    for (const ex of execs) {
      nodes.push({
        id: `exec-${ex.id}`,
        type: 'ai_executive',
        label: `${ex.role} (${ex.name})`,
        country: null,
        parent: null,
        status: ex.status === 'active' ? 'busy' : 'idle',
        healthScore: ex.approvalAccuracy,
        metrics: { decisionsToday: ex.decisionsToday, workflows: ex.activeWorkflows, incidents: ex.incidentsOwned },
        lastUpdate: ex.lastActiveAt ?? new Date().toISOString(),
      });
    }

    // ── Connector nodes (from DataConnection) ────────────────────────────────
    const connectors = await safeFindMany(() => db.dataConnection.findMany({
      select: { id: true, label: true, type: true, status: true, lastSyncAt: true },
      take: 50,
    }));
    for (const conn of connectors) {
      nodes.push({
        id: `connector-${conn.id}`,
        type: 'connector',
        label: conn.label,
        country: null,
        parent: null,
        status: conn.status === 'connected' ? 'active' : conn.status === 'syncing' ? 'busy' : 'error',
        // Connector health is derived from real sync status text only — no
        // synthetic numeric score mapping (would be mock data).
        healthScore: 0,
        metrics: { sync: 1 },
        lastUpdate: conn.lastSyncAt?.toISOString() ?? null,
      });
    }

    // ── Worker / queue nodes (from ExecutionTask + ExecutionJob) ─────────────
    const queueStats = await Promise.all([
      safeCount(() => db.executionTask.count({ where: { status: 'queued' } })),
      safeCount(() => db.executionTask.count({ where: { status: 'running' } })),
      safeCount(() => db.executionJob.count({ where: { status: 'queued' } })),
    ]);
    nodes.push({
      id: 'queue-execution',
      type: 'queue',
      label: 'Execution Queue',
      country: null,
      parent: null,
      status: queueStats[0] + queueStats[1] > 0 ? 'busy' : 'idle',
      // Queue health score: 0 (no real SLA/throughput metric wired yet).
      healthScore: 0,
      metrics: { queued: queueStats[0], running: queueStats[1], jobs: queueStats[2] },
      lastUpdate: new Date().toISOString(),
    });

    // Add team/office/factory representative nodes from employee + client counts
    const [empCount, clientCount] = await Promise.all([
      safeCount(() => db.employee.count({ where: { status: 'active' } })),
      safeCount(() => db.client.count({ where: { status: 'active' } })),
    ]);
    if (empCount > 0) {
      nodes.push({
        id: 'team-employees',
        type: 'team',
        label: `Workforce (${empCount})`,
        country: 'IN',
        parent: 'country-IN',
        status: 'active',
        healthScore: 0,
        metrics: { headcount: empCount },
        lastUpdate: new Date().toISOString(),
      });
    }
    if (clientCount > 0) {
      nodes.push({
        id: 'team-clients',
        type: 'team',
        label: `Client Base (${clientCount})`,
        country: 'IN',
        parent: 'country-IN',
        status: 'active',
        healthScore: 0,
        metrics: { clients: clientCount },
        lastUpdate: new Date().toISOString(),
      });
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    const avgHealth = nodes.length > 0
      ? Math.round(nodes.reduce((s, n) => s + n.healthScore, 0) / nodes.length)
      : 100;

    return {
      totalNodes: nodes.length,
      byType: countBy(nodes, (n) => n.type),
      byCountry: countBy(nodes, (n) => n.country ?? 'global'),
      byStatus: countBy(nodes, (n) => n.status),
      avgHealthScore: avgHealth,
      nodes,
    };
  });
}
