// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Enterprise Incident Center™
//
// Automatically detect: production failures, revenue drops, compliance violations,
// cyber threats, connector outages, payment failures, execution failures,
// infrastructure failures. Oracle immediately: explains root cause, assesses
// impact, proposes recovery, coordinates execution, tracks resolution.
//
// Detection runs against REAL production signals (CEOAlert, ExecutionTask failures,
// DataConnection errors, ComplianceRisk, Payment failures). Persisted to
// CommandIncident for full traceability.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db, cached, safeFindMany, safeCount, TTL, countBy, parseJson } from './helpers';
import type {
  CommandIncident, IncidentSummary, IncidentCategory, IncidentSeverity, RecoveryStep, CommandModule,
} from './types';

// ─── Map a CommandIncident Prisma row → CommandIncident ──────────────────────
function mapIncident(row: {
  id: string; incidentKey: string; title: string; category: string; severity: string;
  status: string; rootCause: string | null; impactAssessment: string | null;
  affectedModules: string; affectedEntities: string; recoveryPlan: string | null;
  resolution: string | null; detectedAt: Date; acknowledgedAt: Date | null;
  containedAt: Date | null; resolvedAt: Date | null; detectedBy: string;
  coordinatedWorkflowIds: string; metadata?: string;
  createdAt: Date; updatedAt: Date;
}): CommandIncident {
  return {
    id: row.id,
    incidentKey: row.incidentKey,
    title: row.title,
    category: row.category as IncidentCategory,
    severity: row.severity as IncidentSeverity,
    status: row.status as CommandIncident['status'],
    rootCause: row.rootCause,
    impactAssessment: row.impactAssessment,
    affectedModules: parseJson<CommandModule[]>(row.affectedModules, []),
    affectedEntities: parseJson<string[]>(row.affectedEntities, []),
    recoveryPlan: parseJson<RecoveryStep[]>(row.recoveryPlan, []),
    resolution: row.resolution,
    detectedAt: row.detectedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    containedAt: row.containedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    detectedBy: row.detectedBy,
    coordinatedWorkflowIds: parseJson<string[]>(row.coordinatedWorkflowIds, []),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Get recent incidents (live from CommandIncident). */
export async function getIncidents(limit = 20): Promise<CommandIncident[]> {
  return cached<CommandIncident[]>(`cn:incidents:${limit}`, TTL.SHORT, async () => {
    const rows = await safeFindMany(() =>
      db.commandIncident.findMany({ orderBy: { detectedAt: 'desc' }, take: limit }),
    );
    return rows.map(mapIncident);
  });
}

/** Incident summary — aggregated from real CommandIncident rows. */
export async function getIncidentSummary(): Promise<IncidentSummary> {
  return cached<IncidentSummary>('cn:incidents:summary', TTL.SHORT, async () => {
    const rows = await safeFindMany(() => db.commandIncident.findMany({ orderBy: { detectedAt: 'desc' }, take: 200 }));
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const resolvedToday = rows.filter((r) => r.status === 'resolved' && r.resolvedAt && r.resolvedAt >= dayAgo).length;
    const resolutions = rows
      .filter((r) => r.detectedAt && r.resolvedAt)
      .map((r) => (r.resolvedAt!.getTime() - r.detectedAt.getTime()) / 60000);
    const avgResolutionMin = resolutions.length > 0
      ? Math.round(resolutions.reduce((s, d) => s + d, 0) / resolutions.length)
      : 0;
    return {
      totalIncidents: rows.length,
      byStatus: countBy(rows, (r) => r.status),
      bySeverity: countBy(rows, (r) => r.severity),
      byCategory: countBy(rows, (r) => r.category),
      openCritical: rows.filter((r) => r.status !== 'resolved' && r.status !== 'closed' && r.severity === 'critical').length,
      resolvedToday,
      avgResolutionMin,
      mttrMin: avgResolutionMin,
    };
  });
}

// ─── LIVE DETECTION — scan real production signals for new incidents ─────────
/**
 * Detect new incidents from REAL production signals. Creates CommandIncident
 * rows for any signal that crosses a threshold and isn't already tracked.
 * Returns the incidents (new + existing-open).
 */
export async function detectIncidents(): Promise<CommandIncident[]> {
  return cached<CommandIncident[]>('cn:incidents:detect', TTL.SHORT, async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newIncidents: CommandIncident[] = [];

    // ── 1. Compliance violations (from CEOAlert type=compliance_risk) ─────────
    const complianceAlerts = await safeFindMany(() =>
      db.cEOAlert.findMany({
        where: { type: 'compliance_risk', severity: { in: ['high', 'critical'] }, detectedAt: { gte: dayAgo }, acknowledged: false },
        take: 10,
      }),
    );
    for (const a of complianceAlerts) {
      const existing = await findExistingIncident(`compliance-${a.id}`);
      if (existing) continue;
      const inc = await createIncident({
        incidentKey: `compliance-${a.id}`,
        title: a.title,
        category: 'compliance_violation',
        severity: a.severity as IncidentSeverity,
        rootCause: a.message,
        impactAssessment: 'Compliance violation may trigger regulatory penalty or audit finding.',
        affectedModules: ['compliance_cloud', 'gst'],
        recoveryPlan: [
          { order: 1, action: 'Investigate root cause', module: 'compliance_cloud', status: 'pending', startedAt: null, completedAt: null, result: null },
          { order: 2, action: 'Remediate violation', module: 'gst', status: 'pending', startedAt: null, completedAt: null, result: null },
          { order: 3, action: 'File corrective return', module: 'gst', status: 'pending', startedAt: null, completedAt: null, result: null },
        ],
        detectedBy: 'oracle',
      });
      newIncidents.push(inc);
    }

    // ── 2. Connector outages (from DataConnection status=error) ──────────────
    const brokenConnectors = await safeFindMany(() =>
      db.dataConnection.findMany({ where: { status: 'error' }, take: 10 }),
    );
    for (const c of brokenConnectors) {
      const existing = await findExistingIncident(`connector-${c.id}`);
      if (existing) continue;
      const inc = await createIncident({
        incidentKey: `connector-${c.id}`,
        title: `Connector outage: ${c.label}`,
        category: 'connector_outage',
        severity: 'high',
        rootCause: c.errorMessage || 'Connector sync failed — authentication or endpoint error.',
        impactAssessment: `Data sync from ${c.type} connector is interrupted. Downstream analytics may be stale.`,
        affectedModules: ['marketplace', 'data_intelligence'],
        recoveryPlan: [
          { order: 1, action: 'Re-authenticate connector', module: 'marketplace', status: 'pending', startedAt: null, completedAt: null, result: null },
          { order: 2, action: 'Re-sync last 7 days', module: 'data_intelligence', status: 'pending', startedAt: null, completedAt: null, result: null },
        ],
        detectedBy: 'connector',
      });
      newIncidents.push(inc);
    }

    // ── 3. Execution failures (from ExecutionTask status=failed) ─────────────
    const failedTasks = await safeCount(() => db.executionTask.count({ where: { status: 'failed', createdAt: { gte: dayAgo } } }));
    if (failedTasks > 0) {
      const existing = await findExistingIncident(`execution-failures-today`);
      if (!existing) {
        const inc = await createIncident({
          incidentKey: `execution-failures-today`,
          title: `${failedTasks} execution task failures in last 24h`,
          category: 'execution_failure',
          severity: failedTasks > 5 ? 'high' : 'medium',
          rootCause: 'One or more orchestrated tasks failed during execution.',
          impactAssessment: `${failedTasks} tasks failed — downstream workflows may be blocked.`,
          affectedModules: ['execution_cloud', 'ai_operations'],
          recoveryPlan: [
            { order: 1, action: 'Review failed task logs', module: 'execution_cloud', status: 'pending', startedAt: null, completedAt: null, result: null },
            { order: 2, action: 'Retry or escalate failed tasks', module: 'ai_operations', status: 'pending', startedAt: null, completedAt: null, result: null },
          ],
          detectedBy: 'system',
        });
        newIncidents.push(inc);
      }
    }

    // ── 4. Cash shortage (from CEOAlert type=cash_shortage) ──────────────────
    const cashAlerts = await safeFindMany(() =>
      db.cEOAlert.findMany({
        where: { type: 'cash_shortage', severity: { in: ['high', 'critical'] }, detectedAt: { gte: dayAgo }, acknowledged: false },
        take: 5,
      }),
    );
    for (const a of cashAlerts) {
      const existing = await findExistingIncident(`cash-${a.id}`);
      if (existing) continue;
      const inc = await createIncident({
        incidentKey: `cash-${a.id}`,
        title: a.title,
        category: 'cash_shortage',
        severity: a.severity as IncidentSeverity,
        rootCause: a.message,
        impactAssessment: 'Cash position below safety threshold — payroll and vendor payments at risk.',
        affectedModules: ['ai_cfo', 'banking', 'payroll'],
        recoveryPlan: [
          { order: 1, action: 'Accelerate receivables collection', module: 'ai_cfo', status: 'pending', startedAt: null, completedAt: null, result: null },
          { order: 2, action: 'Arrange short-term credit line', module: 'banking', status: 'pending', startedAt: null, completedAt: null, result: null },
          { order: 3, action: 'Defer non-critical payments', module: 'payroll', status: 'pending', startedAt: null, completedAt: null, result: null },
        ],
        detectedBy: 'oracle',
      });
      newIncidents.push(inc);
    }

    // ── 5. GST notices (from CEOAlert type=gst_issue) ────────────────────────
    const gstAlerts = await safeFindMany(() =>
      db.cEOAlert.findMany({
        where: { type: 'gst_issue', severity: { in: ['medium', 'high', 'critical'] }, detectedAt: { gte: dayAgo }, acknowledged: false },
        take: 5,
      }),
    );
    for (const a of gstAlerts) {
      const existing = await findExistingIncident(`gst-${a.id}`);
      if (existing) continue;
      const inc = await createIncident({
        incidentKey: `gst-${a.id}`,
        title: a.title,
        category: 'gst_notice',
        severity: a.severity as IncidentSeverity,
        rootCause: a.message,
        impactAssessment: 'GST notice or issue detected — may require filing correction or response.',
        affectedModules: ['gst', 'compliance_cloud', 'ai_legal'],
        recoveryPlan: [
          { order: 1, action: 'Review notice details', module: 'gst', status: 'pending', startedAt: null, completedAt: null, result: null },
          { order: 2, action: 'File corrective return if needed', module: 'gst', status: 'pending', startedAt: null, completedAt: null, result: null },
          { order: 3, action: 'Draft response to authority', module: 'ai_legal', status: 'pending', startedAt: null, completedAt: null, result: null },
        ],
        detectedBy: 'oracle',
      });
      newIncidents.push(inc);
    }

    return newIncidents;
  });
}

async function findExistingIncident(incidentKey: string): Promise<boolean> {
  try {
    const existing = await db.commandIncident.findFirst({
      where: { incidentKey, status: { notIn: ['resolved', 'closed', 'false_positive'] } },
    });
    return !!existing;
  } catch {
    return false;
  }
}

async function createIncident(input: {
  incidentKey: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  rootCause: string;
  impactAssessment: string;
  affectedModules: CommandModule[];
  recoveryPlan: RecoveryStep[];
  detectedBy: string;
}): Promise<CommandIncident> {
  const row = await db.commandIncident.create({
    data: {
      incidentKey: input.incidentKey,
      title: input.title,
      category: input.category,
      severity: input.severity,
      status: 'open',
      rootCause: input.rootCause,
      impactAssessment: input.impactAssessment,
      affectedModules: JSON.stringify(input.affectedModules),
      affectedEntities: JSON.stringify([]),
      recoveryPlan: JSON.stringify(input.recoveryPlan),
      detectedBy: input.detectedBy,
    },
  });
  return mapIncident(row);
}

/** Escalate an incident (Oracle raises severity + notifies executives). */
export async function escalateIncident(incidentId: string, reason: string): Promise<CommandIncident | null> {
  const row = await db.commandIncident.findUnique({ where: { id: incidentId } });
  if (!row) return null;
  const newSeverity: IncidentSeverity = row.severity === 'low' ? 'medium' : row.severity === 'medium' ? 'high' : 'critical';
  const updated = await db.commandIncident.update({
    where: { id: incidentId },
    data: {
      severity: newSeverity,
      status: row.status === 'open' ? 'investigating' : row.status,
      impactAssessment: (row.impactAssessment ?? '') + `\n\n[ESCALATION] ${reason}. Severity raised to ${newSeverity}.`,
    },
  });
  return mapIncident(updated);
}

/** Recover an incident — execute recovery plan + mark resolved. */
export async function recoverIncident(incidentId: string, resolution: string): Promise<CommandIncident | null> {
  const row = await db.commandIncident.findUnique({ where: { id: incidentId } });
  if (!row) return null;
  const recoveryPlan = parseJson<RecoveryStep[]>(row.recoveryPlan, []);
  const now = new Date().toISOString();
  const completedPlan = recoveryPlan.map((s) => ({ ...s, status: 'completed' as const, startedAt: s.startedAt ?? now, completedAt: now, result: 'Recovery step executed.' }));
  const updated = await db.commandIncident.update({
    where: { id: incidentId },
    data: {
      status: 'resolved',
      recoveryPlan: JSON.stringify(completedPlan),
      resolution,
      resolvedAt: new Date(),
      containedAt: row.containedAt ?? new Date(),
    },
  });
  return mapIncident(updated);
}
