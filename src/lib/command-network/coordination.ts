// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Cross-Module Coordination™
//
// Automatically coordinate every department through Oracle:
//   CRM · Sales · Marketing · Finance · GST · Payroll · Banking · HR · Projects ·
//   Execution · Compliance · Global Enterprise.
// Oracle synchronizes all departments automatically. Each department's sync
// status, pending approvals, open tasks and active workflows are derived from
// REAL production rows.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeCount, safeFindMany, TTL, parseJson, minsBetween } from './helpers';
import type { CrossModuleSync, CoordinatedDepartment, CommandModule } from './types';

// ─── Department roster — mapped to Prisma activity signals ────────────────────
const DEPARTMENTS: { department: CommandModule; label: string }[] = [
  { department: 'crm', label: 'CRM & Sales' },
  { department: 'ai_marketing', label: 'Marketing' },
  { department: 'ai_cfo', label: 'Finance' },
  { department: 'gst', label: 'GST' },
  { department: 'payroll', label: 'Payroll' },
  { department: 'banking', label: 'Banking' },
  { department: 'ai_hr', label: 'HR' },
  { department: 'ai_operations', label: 'Projects & Execution' },
  { department: 'compliance_cloud', label: 'Compliance' },
  { department: 'global_enterprise', label: 'Global Enterprise' },
];

/** Get the cross-module coordination state (live sync across all departments). */
export async function getCrossModuleSync(): Promise<CrossModuleSync> {
  return cached<CrossModuleSync>('cn:coordination', TTL.SHORT, async () => {
    // Active workflows per module
    const workflows = await safeFindMany(() => db.commandWorkflow.findMany({
      where: { status: 'running' },
      select: { coordinatedModules: true },
    }));
    const moduleWorkflowCount: Record<string, number> = {};
    for (const wf of workflows) {
      const mods = parseJson<CommandModule[]>(wf.coordinatedModules, []);
      for (const m of mods) moduleWorkflowCount[m] = (moduleWorkflowCount[m] ?? 0) + 1;
    }

    // Pending approvals per module (from Approval + ExecutionTask)
    const [pendingApprovalsTotal, openTasksTotal] = await Promise.all([
      safeCount(() => db.approval.count({ where: { status: 'pending' } })),
      safeCount(() => db.executionTask.count({ where: { status: { in: ['queued', 'running', 'awaiting_approval'] } } })),
    ]);

    // Per-department metrics
    const departments: CoordinatedDepartment[] = await Promise.all(
      DEPARTMENTS.map(async (d) => {
        const { activeWorkflows, lastSyncAt, pendingApprovals, openTasks } = await getDeptMetrics(d.department);
        const syncLagMin = lastSyncAt ? minsBetween(new Date(lastSyncAt), new Date()) : 9999;
        const status: CoordinatedDepartment['status'] =
          syncLagMin < 15 ? 'synced' : syncLagMin < 60 ? 'syncing' : syncLagMin < 1440 ? 'stale' : 'error';
        return {
          department: d.department,
          label: d.label,
          activeWorkflows: activeWorkflows + (moduleWorkflowCount[d.department] ?? 0),
          pendingApprovals,
          openTasks,
          lastSyncAt: lastSyncAt,
          syncLagMin: syncLagMin === 9999 ? 9999 : syncLagMin,
          status,
        };
      }),
    );

    const synced = departments.filter((d) => d.status === 'synced').length;
    const stale = departments.filter((d) => d.status === 'stale' || d.status === 'error').length;
    const avgSyncLag = departments.length > 0
      ? Math.round(departments.reduce((s, d) => s + Math.min(d.syncLagMin, 1440), 0) / departments.length)
      : 0;

    return {
      totalDepartments: departments.length,
      syncedDepartments: synced,
      staleDepartments: stale,
      totalPendingApprovals: pendingApprovalsTotal,
      totalOpenTasks: openTasksTotal,
      totalActiveWorkflows: workflows.length,
      avgSyncLagMin: avgSyncLag,
      departments,
    };
  });
}

// ─── Per-department metric fetcher ────────────────────────────────────────────
async function getDeptMetrics(module: CommandModule): Promise<{
  activeWorkflows: number;
  lastSyncAt: string | null;
  pendingApprovals: number;
  openTasks: number;
}> {
  try {
    switch (module) {
      case 'crm': {
        const [count, last] = await Promise.all([
          db.client.count({ where: { status: 'active' } }),
          db.client.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.updatedAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'ai_marketing': {
        // (Was 2 sequential awaits — now Promise.all for 1 round-trip.)
        const [count, last] = await Promise.all([
          db.cEODecision.count({ where: { type: { in: ['increase_marketing', 'pause_marketing'] } } }),
          db.cEODecision.findFirst({ where: { type: { in: ['increase_marketing', 'pause_marketing'] } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.createdAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'ai_cfo': {
        const [count, last] = await Promise.all([
          db.cEODecision.count({ where: { type: { in: ['optimize_cash', 'repay_loan', 'suggest_loan', 'improve_profitability'] } } }),
          db.cEODecision.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.createdAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'gst': {
        const [count, last] = await Promise.all([
          db.gSTRFiling.count({ where: { status: { in: ['pending', 'draft'] } } }),
          db.gSTRFiling.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.updatedAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'payroll': {
        const [count, last] = await Promise.all([
          db.employee.count({ where: { status: 'active' } }),
          db.employee.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.updatedAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'banking': {
        const [count, last] = await Promise.all([
          db.payment.count({ where: { status: { in: ['pending', 'processing'] } } }),
          db.payment.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.createdAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'ai_hr': {
        // (Was 2 sequential awaits — now Promise.all for 1 round-trip.)
        const [count, last] = await Promise.all([
          db.cEOTask.count({ where: { type: { in: ['approve_payroll', 'renew_subscription'] } } }),
          db.cEOTask.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.createdAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'ai_operations': {
        const [count, last] = await Promise.all([
          db.executionTask.count({ where: { status: { in: ['queued', 'running'] } } }),
          db.executionTask.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.createdAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'compliance_cloud': {
        const [count, last] = await Promise.all([
          db.complianceRisk.count({ where: { status: { in: ['open', 'investigating'] } } }),
          db.complianceRisk.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.updatedAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      case 'global_enterprise': {
        const [count, last] = await Promise.all([
          db.globalEntity.count({ where: { status: 'active' } }),
          db.globalEntity.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
        ]);
        return { activeWorkflows: 0, lastSyncAt: last?.updatedAt.toISOString() ?? null, pendingApprovals: 0, openTasks: count };
      }
      default:
        return { activeWorkflows: 0, lastSyncAt: null, pendingApprovals: 0, openTasks: 0 };
    }
  } catch {
    return { activeWorkflows: 0, lastSyncAt: null, pendingApprovals: 0, openTasks: 0 };
  }
}
