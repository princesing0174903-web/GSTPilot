// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 2: EXECUTION TIMELINE™
// Live enterprise timeline. Every event (AI decisions, human approvals, API
// calls, connector events, workflow executions, deployments, payments, GST
// filings, reports, meetings, simulations, expansion events, executive
// discussions) becomes a TimelineEntry with timestamp + module + status +
// duration + actor + auditId.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ExecutionJob, TimelineEntry, TimelineSummary, ExecutionModule } from './types';

// Project a unified ExecutionJob stream into the live timeline view.
export function buildTimeline(jobs: ExecutionJob[]): TimelineSummary {
  const entries: TimelineEntry[] = jobs.map((j) => ({
    id: j.id,
    jobId: j.id,
    module: j.module,
    type: j.type,
    description: j.description,
    status: j.status,
    timestamp: j.createdAt,
    durationMs: j.durationMs,
    actor: j.aiModule ?? j.userId ?? j.module,
    organizationId: j.organizationId,
    countryIso: j.countryIso,
    auditId: j.auditId,
  }));

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayCount = entries.filter((e) => new Date(e.timestamp).getTime() >= startOfToday.getTime()).length;
  const last24hCount = entries.filter((e) => now - new Date(e.timestamp).getTime() < 24 * 3600 * 1000).length;

  const byModule: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const e of entries) {
    byModule[e.module] = (byModule[e.module] ?? 0) + 1;
    byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
  }

  return {
    total: entries.length,
    todayCount,
    last24hCount,
    byModule,
    byStatus,
    entries: entries.slice(0, 100),
  };
}

// Categorise an entry into a human-readable event type for the timeline UI.
export function categoriseEvent(module: ExecutionModule, type: string): string {
  if (module === 'ai_ceo' || module === 'ai_cfo' || module === 'ai_coo' ||
      module === 'ai_cto' || module === 'ai_cro' || module === 'ai_legal' ||
      module === 'ai_hr' || module === 'ai_marketing' || module === 'ai_operations' ||
      module === 'oracle') {
    return 'AI Decision';
  }
  if (module === 'gst') return 'GST Filing';
  if (module === 'banking') return type.includes('payment') ? 'Payment' : 'Banking';
  if (module === 'automation') return 'Workflow Execution';
  if (module === 'ai_software_factory') return type === 'deploy' ? 'Deployment' : 'Build';
  if (module === 'autonomous_enterprise' || module === 'global_enterprise') {
    return type.includes('simulat') ? 'Simulation' : 'Expansion Event';
  }
  if (module === 'crm') return 'Connector Event';
  if (module === 'connectivity_fabric') return 'Connector Event';
  if (module === 'reports') return 'Report';
  if (module === 'digital_twin') return 'Simulation';
  if (module === 'business_graph' || module === 'knowledge_graph') return 'Graph Mutation';
  return 'Execution';
}
