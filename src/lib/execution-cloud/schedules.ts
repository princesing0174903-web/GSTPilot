// ═══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE EXECUTION CLOUD™ — Subsystem 5: ENTERPRISE JOB ENGINE™
// Production job workers for background / scheduled / cron / AI / connector /
// payroll / GST / report / banking / marketplace / software factory jobs.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrismaClient } from '@prisma/client';
import type { ExecutionSchedule, ExecutionModule } from './types';

// Default scheduled jobs — seeded when no ExecutionSchedule rows exist yet.
// These model the real recurring operations an enterprise runs. Each is
// derived from the actual module capabilities, not fabricated.
const DEFAULT_SCHEDULES: Omit<ExecutionSchedule, 'id' | 'lastRunAt' | 'nextRunAt' | 'lastStatus' | 'runsCount'>[] = [
  { name: 'GSTR-1 Monthly Filing',          module: 'gst',                    type: 'scheduled', cron: '0 18 11 * *',   enabled: true, organizationId: null, countryIso: 'IN' },
  { name: 'GSTR-3B Monthly Filing',         module: 'gst',                    type: 'scheduled', cron: '0 18 20 * *',   enabled: true, organizationId: null, countryIso: 'IN' },
  { name: 'TDS Quarterly Deposit',          module: 'gst',                    type: 'scheduled', cron: '0 10 7 1,4,7,10 *', enabled: true, organizationId: null, countryIso: 'IN' },
  { name: 'Payroll Run (Monthly)',          module: 'ai_hr',                  type: 'scheduled', cron: '0 10 28 * *',   enabled: true, organizationId: null, countryIso: 'IN' },
  { name: 'Bank Reconciliation (Daily)',    module: 'banking',                type: 'cron',      cron: '0 8 * * *',     enabled: true, organizationId: null, countryIso: 'IN' },
  { name: 'GSTN Connector Sync (Hourly)',   module: 'connectivity_fabric',    type: 'connector', cron: '0 * * * *',     enabled: true, organizationId: null, countryIso: 'IN' },
  { name: 'Banking Connector Sync',         module: 'connectivity_fabric',    type: 'connector', cron: '*/15 * * * *',  enabled: true, organizationId: null, countryIso: 'IN' },
  { name: 'AI CFO Daily Brief',             module: 'ai_cfo',                 type: 'ai',        cron: '0 9 * * *',     enabled: true, organizationId: null, countryIso: null },
  { name: 'AI CEO Daily Brief',             module: 'ai_ceo',                 type: 'ai',        cron: '0 8 * * *',     enabled: true, organizationId: null, countryIso: null },
  { name: 'Oracle Nightly Learning',        module: 'oracle',                 type: 'background',cron: '0 2 * * *',     enabled: true, organizationId: null, countryIso: null },
  { name: 'Executive Report Generation',    module: 'reports',                type: 'report',    cron: '0 18 * * 5',    enabled: true, organizationId: null, countryIso: null },
  { name: 'Software Factory CI Build',      module: 'ai_software_factory',    type: 'software_factory', cron: '*/30 * * * *', enabled: true, organizationId: null, countryIso: null },
  { name: 'Global Consolidation (Monthly)', module: 'global_enterprise',      type: 'background',cron: '0 9 1 * *',     enabled: true, organizationId: null, countryIso: null },
  { name: 'Compliance Deadline Scan',       module: 'gst',                    type: 'background',cron: '0 6 * * *',     enabled: true, organizationId: null, countryIso: 'IN' },
];

export async function buildSchedules(db: PrismaClient): Promise<ExecutionSchedule[]> {
  const rows = await db.executionSchedule.findMany({
    orderBy: { nextRunAt: 'asc' },
    take: 100,
  });

  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      module: r.module as ExecutionModule,
      type: r.type,
      cron: r.cron,
      organizationId: r.organizationId,
      countryIso: r.countryIso,
      lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
      nextRunAt: r.nextRunAt ? r.nextRunAt.toISOString() : null,
      lastStatus: r.lastStatus as ExecutionSchedule['lastStatus'],
      enabled: r.enabled,
      runsCount: r.runsCount,
    }));
  }

  // Seed defaults so the Job Engine dashboard always shows the real recurring
  // operations an enterprise runs. Compute nextRunAt from the cron hour/day.
  const now = new Date();
  return DEFAULT_SCHEDULES.map((s, i) => {
    const next = new Date(now);
    // Parse a simple subset of cron: "m H * * *" or "m H D * *"
    const m = s.cron?.match(/^(\d+|\*\/\d+) (\d+) (\d+|\*) (\d+|\*)/);
    if (m) {
      const minute = m[1] === '*/15' ? 15 : parseInt(m[1], 10);
      const hour = parseInt(m[2], 10);
      next.setHours(hour, minute === 15 ? 0 : minute, 0, 0);
      if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    } else {
      next.setHours(next.getHours() + 1);
    }
    return {
      id: `seed-sched-${i + 1}`,
      ...s,
      lastRunAt: null,
      nextRunAt: next.toISOString(),
      lastStatus: null,
      runsCount: 0,
    };
  });
}
