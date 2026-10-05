// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Data Intelligence Cloud™
// Enterprise Analytics Engine™ — computes REAL analytics snapshots from production data.
// Every metric is derived from live Prisma queries. No mock values. Append-only snapshots.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  db,
  parseJson,
  safeFindMany,
  safeCount,
  cached,
  TTL,
  sumBy,
  countBy,
  currentPeriod,
} from './helpers';
import type {
  AnalyticsType,
  DataAnalyticsSnapshot,
} from './types';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Map a Prisma snapshot row to the typed DataAnalyticsSnapshot (parsing JSON fields). */
function mapSnapshot(row: {
  id: string;
  analyticsType: string;
  period: string;
  metrics: string;
  dimensionBreakdown: string;
  trendDelta: number;
  narrative: string | null;
  computedAt: Date;
}): DataAnalyticsSnapshot {
  return {
    id: row.id,
    analyticsType: row.analyticsType as AnalyticsType,
    period: row.period,
    metrics: parseJson<Record<string, number>>(row.metrics, {}),
    dimensionBreakdown: parseJson<Record<string, Record<string, number>>>(
      row.dimensionBreakdown,
      {},
    ),
    trendDelta: row.trendDelta,
    narrative: row.narrative,
    computedAt: row.computedAt.toISOString(),
  };
}

/** Create a new append-only DataAnalyticsSnapshot row and return the typed object. */
async function createSnapshot(
  analyticsType: AnalyticsType,
  period: string,
  metrics: Record<string, number>,
  dimensionBreakdown: Record<string, Record<string, number>>,
  trendDelta: number,
  narrative: string,
): Promise<DataAnalyticsSnapshot> {
  const row = await db.dataAnalyticsSnapshot.create({
    data: {
      analyticsType,
      period,
      metrics: JSON.stringify(metrics),
      dimensionBreakdown: JSON.stringify(dimensionBreakdown),
      trendDelta,
      narrative,
      computedAt: new Date(),
    },
  });
  return mapSnapshot(row);
}

/** Compute the prior period (YYYY-MM) given a current period. */
function priorPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 2, 1); // month is 0-indexed; subtracting 2 gives prior month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Percentage delta between current and prior; 0 when prior is 0. */
function pctDelta(current: number, prior: number): number {
  if (prior === 0) return 0;
  return ((current - prior) / prior) * 100;
}

/**
 * Snapshot-based trend delta — finds the most recent snapshot of the same
 * analyticsType from a prior period and computes the % change of the primary
 * metric (total → count → first value). Returns 0 if no prior snapshot exists.
 */
async function snapshotDelta(
  analyticsType: AnalyticsType,
  period: string,
  currentValue: number,
): Promise<number> {
  const prior = await safeFindMany(() =>
    db.dataAnalyticsSnapshot.findMany({
      where: { analyticsType, period: { not: period } },
      orderBy: { computedAt: 'desc' },
      take: 1,
    }),
  );
  if (prior.length === 0) return 0;
  const priorMetrics = parseJson<Record<string, number>>(prior[0].metrics, {});
  const priorValue =
    priorMetrics.total ?? priorMetrics.count ?? Object.values(priorMetrics)[0] ?? 0;
  return pctDelta(currentValue, priorValue);
}

/** Format an INR amount for narrative strings. */
function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Format a signed percentage for narrative strings. */
function signedPct(p: number): string {
  return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
}

// ─── Individual analytics compute functions ──────────────────────────────────

/** REVENUE — invoice totals, count, avg; breakdown by client state; trend vs prior month. */
async function computeRevenue(period: string): Promise<DataAnalyticsSnapshot> {
  const priorP = priorPeriod(period);

  const [currentInvoices, priorInvoices, clients] = await Promise.all([
    cached(`analytics:revenue:current:${period}`, TTL.SHORT, () =>
      safeFindMany(() =>
        db.invoice.findMany({
          where: { invoiceDate: { startsWith: period } },
          select: { totalAmount: true, clientId: true },
        }),
      ),
    ),
    cached(`analytics:revenue:prior:${priorP}`, TTL.SHORT, () =>
      safeFindMany(() =>
        db.invoice.findMany({
          where: { invoiceDate: { startsWith: priorP } },
          select: { totalAmount: true },
        }),
      ),
    ),
    cached('analytics:clients:state-map', TTL.SHORT, () =>
      safeFindMany(() =>
        db.client.findMany({ select: { id: true, state: true } }),
      ),
    ),
  ]);

  const stateMap = new Map(clients.map(c => [c.id, c.state ?? 'unknown']));
  const total = sumBy(currentInvoices, i => i.totalAmount);
  const count = currentInvoices.length;
  const avg = count > 0 ? total / count : 0;

  const byState: Record<string, number> = {};
  for (const inv of currentInvoices) {
    const state = stateMap.get(inv.clientId) ?? 'unknown';
    byState[state] = (byState[state] ?? 0) + inv.totalAmount;
  }

  const priorTotal = sumBy(priorInvoices, i => i.totalAmount);
  const trendDelta = pctDelta(total, priorTotal);

  const metrics = { total, count, avg };
  const dimensionBreakdown = { state: byState };
  const narrative = `Revenue for ${period}: ${inr(total)} across ${count} invoices (avg ${inr(avg)}). Trend vs ${priorP}: ${signedPct(trendDelta)}.`;

  return createSnapshot('revenue', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** COST — payment totals + count; breakdown by payment mode (category proxy); trend. */
async function computeCost(period: string): Promise<DataAnalyticsSnapshot> {
  const priorP = priorPeriod(period);

  const [currentPayments, priorPayments] = await Promise.all([
    cached(`analytics:cost:current:${period}`, TTL.SHORT, () =>
      safeFindMany(() =>
        db.payment.findMany({
          where: { paymentDate: { startsWith: period } },
          select: { amount: true, paymentMode: true },
        }),
      ),
    ),
    cached(`analytics:cost:prior:${priorP}`, TTL.SHORT, () =>
      safeFindMany(() =>
        db.payment.findMany({
          where: { paymentDate: { startsWith: priorP } },
          select: { amount: true },
        }),
      ),
    ),
  ]);

  const total = sumBy(currentPayments, p => p.amount);
  const count = currentPayments.length;

  const byCategory: Record<string, number> = {};
  for (const p of currentPayments) {
    const cat = p.paymentMode ?? 'unknown';
    byCategory[cat] = (byCategory[cat] ?? 0) + p.amount;
  }

  const priorTotal = sumBy(priorPayments, p => p.amount);
  const trendDelta = pctDelta(total, priorTotal);

  const metrics = { total, count };
  const dimensionBreakdown = { category: byCategory };
  const narrative = `Cost (payments) for ${period}: ${inr(total)} across ${count} payments. Trend vs ${priorP}: ${signedPct(trendDelta)}.`;

  return createSnapshot('cost', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** PROFITABILITY — revenue − cost; marginPct; breakdown by month; trend. */
async function computeProfitability(period: string): Promise<DataAnalyticsSnapshot> {
  const priorP = priorPeriod(period);

  const [currentInvoices, currentPayments, priorInvoices, priorPayments] = await Promise.all([
    safeFindMany(() =>
      db.invoice.findMany({
        where: { invoiceDate: { startsWith: period } },
        select: { totalAmount: true },
      }),
    ),
    safeFindMany(() =>
      db.payment.findMany({
        where: { paymentDate: { startsWith: period } },
        select: { amount: true },
      }),
    ),
    safeFindMany(() =>
      db.invoice.findMany({
        where: { invoiceDate: { startsWith: priorP } },
        select: { totalAmount: true },
      }),
    ),
    safeFindMany(() =>
      db.payment.findMany({
        where: { paymentDate: { startsWith: priorP } },
        select: { amount: true },
      }),
    ),
  ]);

  const revenue = sumBy(currentInvoices, i => i.totalAmount);
  const cost = sumBy(currentPayments, p => p.amount);
  const profit = revenue - cost;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

  const priorRevenue = sumBy(priorInvoices, i => i.totalAmount);
  const priorCost = sumBy(priorPayments, p => p.amount);
  const priorProfit = priorRevenue - priorCost;
  const trendDelta = pctDelta(profit, priorProfit);

  const byMonth: Record<string, number> = { [period]: profit, [priorP]: priorProfit };

  const metrics = { revenue, cost, profit, marginPct };
  const dimensionBreakdown = { month: byMonth };
  const narrative = `Profitability for ${period}: revenue ${inr(revenue)}, cost ${inr(cost)}, profit ${inr(profit)} (${marginPct.toFixed(1)}% margin). Trend vs ${priorP}: ${signedPct(trendDelta)}.`;

  return createSnapshot('profitability', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** CUSTOMER — total / active (90d) / new (30d); breakdown by state. */
async function computeCustomer(period: string): Promise<DataAnalyticsSnapshot> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyCutoff = ninetyDaysAgo.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [allClients, invoices90d, newCount] = await Promise.all([
    cached('analytics:customer:clients', TTL.SHORT, () =>
      safeFindMany(() =>
        db.client.findMany({ select: { id: true, state: true, createdAt: true } }),
      ),
    ),
    safeFindMany(() =>
      db.invoice.findMany({
        where: { invoiceDate: { gte: ninetyCutoff } },
        select: { clientId: true },
      }),
    ),
    safeCount(() =>
      db.client.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ),
  ]);

  const total = allClients.length;
  const activeClientIds = new Set(invoices90d.map(i => i.clientId));
  const active = activeClientIds.size;
  const new30d = newCount;

  const byState = countBy(allClients, c => c.state ?? 'unknown');

  const metrics = { total, active, new30d };
  const dimensionBreakdown = { state: byState };
  const trendDelta = await snapshotDelta('customer', period, total);
  const narrative = `Customer base: ${total} total, ${active} active (invoice in 90d), ${new30d} new (30d). Breakdown by state.`;

  return createSnapshot('customer', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** SALES — pipeline value (invoice totals), won count, lost 0; breakdown by client. */
async function computeSales(period: string): Promise<DataAnalyticsSnapshot> {
  const priorP = priorPeriod(period);

  const [currentInvoices, priorInvoices] = await Promise.all([
    cached(`analytics:sales:current:${period}`, TTL.SHORT, () =>
      safeFindMany(() =>
        db.invoice.findMany({
          where: { invoiceDate: { startsWith: period } },
          include: { client: { select: { tradeName: true } } },
        }),
      ),
    ),
    safeCount(() =>
      db.invoice.count({ where: { invoiceDate: { startsWith: priorP } } }),
    ),
  ]);

  const pipelineValue = sumBy(currentInvoices, i => i.totalAmount);
  const won = currentInvoices.length;
  const lost = 0;

  const byClient: Record<string, number> = {};
  for (const inv of currentInvoices) {
    const name = inv.client?.tradeName ?? 'unknown';
    byClient[name] = (byClient[name] ?? 0) + inv.totalAmount;
  }

  const trendDelta = pctDelta(won, priorInvoices);

  const metrics = { pipelineValue, won, lost };
  const dimensionBreakdown = { client: byClient };
  const narrative = `Sales pipeline for ${period}: ${inr(pipelineValue)} across ${won} won deals. Trend vs ${priorP}: ${signedPct(trendDelta)}.`;

  return createSnapshot('sales', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** PAYROLL — total salary, headcount, avg; breakdown by department + role. */
async function computePayroll(period: string): Promise<DataAnalyticsSnapshot> {
  const employees = await cached('analytics:payroll:employees', TTL.SHORT, () =>
    safeFindMany(() =>
      db.employee.findMany({
        select: { salary: true, department: true, designation: true, status: true },
      }),
    ),
  );

  const activeEmployees = employees.filter(e => e.status === 'active');
  const totalSalary = sumBy(activeEmployees, e => e.salary);
  const headcount = activeEmployees.length;
  const avgSalary = headcount > 0 ? totalSalary / headcount : 0;

  const byDepartment = countBy(activeEmployees, e => e.department ?? 'unassigned');
  const byRole = countBy(activeEmployees, e => e.designation ?? 'unassigned');

  const metrics = { totalSalary, headcount, avgSalary };
  const dimensionBreakdown = { department: byDepartment, role: byRole };
  const trendDelta = await snapshotDelta('payroll', period, totalSalary);
  const narrative = `Payroll: ${headcount} active employees, total monthly salary ${inr(totalSalary)} (avg ${inr(avgSalary)}).`;

  return createSnapshot('payroll', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** COMPLIANCE — filings total/filed/pending + open risks; breakdown by filingType. */
async function computeCompliance(period: string): Promise<DataAnalyticsSnapshot> {
  const priorP = priorPeriod(period);

  const [filings, risksOpen, priorFilingsCount] = await Promise.all([
    cached('analytics:compliance:filings', TTL.SHORT, () =>
      safeFindMany(() =>
        db.complianceFiling.findMany({
          select: { filingType: true, status: true, period: true },
        }),
      ),
    ),
    safeCount(() => db.complianceRisk.count({ where: { status: 'open' } })),
    safeCount(() =>
      db.complianceFiling.count({ where: { period: priorP } }),
    ),
  ]);

  const filingsTotal = filings.length;
  const filed = filings.filter(f => f.status === 'submitted' || f.status === 'acknowledged').length;
  const pending = filings.filter(f => f.status === 'draft' || f.status === 'prepared').length;

  const byFilingType = countBy(filings, f => f.filingType);

  const metrics = { filingsTotal, filed, pending, risksOpen };
  const dimensionBreakdown = { filingType: byFilingType };
  const trendDelta = pctDelta(filingsTotal, priorFilingsCount);
  const narrative = `Compliance: ${filingsTotal} filings (${filed} filed, ${pending} pending), ${risksOpen} open risks. Trend vs ${priorP}: ${signedPct(trendDelta)}.`;

  return createSnapshot('compliance', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** EXECUTION — jobs total/completed/failed/running + successRate; breakdown by module (stage). */
async function computeExecution(period: string): Promise<DataAnalyticsSnapshot> {
  const priorP = priorPeriod(period);
  const periodStart = new Date(`${period}-01T00:00:00Z`);
  const priorStart = new Date(`${priorP}-01T00:00:00Z`);
  const priorEnd = new Date(`${period}-01T00:00:00Z`);

  const [jobs, priorCompleted] = await Promise.all([
    cached('analytics:execution:jobs', TTL.SHORT, () =>
      safeFindMany(() =>
        db.executionJob.findMany({
          where: { createdAt: { gte: periodStart } },
          select: { status: true, module: true },
        }),
      ),
    ),
    safeCount(() =>
      db.executionJob.count({
        where: {
          status: 'completed',
          createdAt: { gte: priorStart, lt: priorEnd },
        },
      }),
    ),
  ]);

  const jobsTotal = jobs.length;
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  const running = jobs.filter(j => j.status === 'running').length;
  const successRate = jobsTotal > 0 ? (completed / jobsTotal) * 100 : 0;

  const byStage = countBy(jobs, j => j.module ?? 'unknown');

  const metrics = { jobsTotal, completed, failed, running, successRate };
  const dimensionBreakdown = { stage: byStage };
  const trendDelta = pctDelta(completed, priorCompleted);
  const narrative = `Execution: ${jobsTotal} jobs (${completed} completed, ${failed} failed, ${running} running), ${successRate.toFixed(1)}% success rate. Trend vs ${priorP}: ${signedPct(trendDelta)}.`;

  return createSnapshot('execution', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** AI — decisions, memory entries, insights; breakdown by decision type. */
async function computeAI(period: string): Promise<DataAnalyticsSnapshot> {
  const periodStart = new Date(`${period}-01T00:00:00Z`);
  const priorP = priorPeriod(period);
  const priorStart = new Date(`${priorP}-01T00:00:00Z`);
  const priorEnd = new Date(`${period}-01T00:00:00Z`);

  const [decisions, ceoMemories, agentMemories, insights, priorDecisions] = await Promise.all([
    cached('analytics:ai:decisions', TTL.SHORT, () =>
      safeFindMany(() =>
        db.cEODecision.findMany({
          where: { createdAt: { gte: periodStart } },
          select: { type: true },
        }),
      ),
    ),
    safeCount(() => db.cEOMemory.count()),
    safeCount(() => db.agentMemory.count()),
    safeCount(() => db.dataDiscoveryInsight.count()),
    safeCount(() =>
      db.cEODecision.count({
        where: { createdAt: { gte: priorStart, lt: priorEnd } },
      }),
    ),
  ]);

  const decisionsTotal = decisions.length;
  const memoryEntries = ceoMemories + agentMemories;
  const aiInsights = insights;

  const byType = countBy(decisions, d => d.type ?? 'unknown');

  const metrics = { decisionsTotal, memoryEntries, insights: aiInsights };
  const dimensionBreakdown = { type: byType };
  const trendDelta = pctDelta(decisionsTotal, priorDecisions);
  const narrative = `AI activity: ${decisionsTotal} decisions, ${memoryEntries} memory entries, ${aiInsights} insights. Trend vs ${priorP}: ${signedPct(trendDelta)}.`;

  return createSnapshot('ai', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** CONNECTOR — total/connected/error/syncing; breakdown by type. */
async function computeConnector(period: string): Promise<DataAnalyticsSnapshot> {
  const connections = await cached('analytics:connector:all', TTL.SHORT, () =>
    safeFindMany(() =>
      db.dataConnection.findMany({ select: { type: true, status: true } }),
    ),
  );

  const total = connections.length;
  const connected = connections.filter(c => c.status === 'connected').length;
  const error = connections.filter(c => c.status === 'error').length;
  const syncing = connections.filter(c => c.status === 'syncing').length;

  const byType = countBy(connections, c => c.type ?? 'unknown');

  const metrics = { total, connected, error, syncing };
  const dimensionBreakdown = { type: byType };
  const trendDelta = await snapshotDelta('connector', period, total);
  const narrative = `Connectors: ${total} total (${connected} connected, ${syncing} syncing, ${error} error).`;

  return createSnapshot('connector', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** ORGANIZATION — entity + country counts; breakdown by country. */
async function computeOrganization(period: string): Promise<DataAnalyticsSnapshot> {
  const [entities, countries] = await Promise.all([
    cached('analytics:org:entities', TTL.SHORT, () =>
      safeFindMany(() =>
        db.globalEntity.findMany({ select: { countryIso: true, entityKind: true } }),
      ),
    ),
    safeCount(() => db.country.count()),
  ]);

  const entityCount = entities.length;
  const byCountry = countBy(entities, e => e.countryIso ?? 'unknown');

  const metrics = { entities: entityCount, countries };
  const dimensionBreakdown = { country: byCountry };
  const trendDelta = await snapshotDelta('organization', period, entityCount);
  const narrative = `Organization: ${entityCount} entities across ${countries} countries.`;

  return createSnapshot('organization', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

/** COUNTRY — country count + entities with operations; breakdown by countryIso. */
async function computeCountry(period: string): Promise<DataAnalyticsSnapshot> {
  const [entities, countries] = await Promise.all([
    cached('analytics:country:entities', TTL.SHORT, () =>
      safeFindMany(() =>
        db.globalEntity.findMany({ select: { countryIso: true } }),
      ),
    ),
    safeCount(() => db.country.count()),
  ]);

  const withOperations = entities.length;
  const byCountryIso: Record<string, number> = {};
  for (const e of entities) {
    const iso = e.countryIso ?? 'unknown';
    byCountryIso[iso] = (byCountryIso[iso] ?? 0) + 1;
  }

  const metrics = { countries, withOperations };
  const dimensionBreakdown = { countryIso: byCountryIso };
  const trendDelta = await snapshotDelta('country', period, withOperations);
  const narrative = `Country footprint: ${countries} countries, ${withOperations} entities with operations.`;

  return createSnapshot('country', period, metrics, dimensionBreakdown, trendDelta, narrative);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute REAL analytics from Prisma for the current period and upsert (append)
 * DataAnalyticsSnapshot rows for all 12 analytics types.
 * Returns the list of created snapshots.
 */
export async function computeAnalytics(): Promise<DataAnalyticsSnapshot[]> {
  const period = currentPeriod();

  const snapshots = await Promise.all([
    computeRevenue(period),
    computeCost(period),
    computeProfitability(period),
    computeCustomer(period),
    computeSales(period),
    computePayroll(period),
    computeCompliance(period),
    computeExecution(period),
    computeAI(period),
    computeConnector(period),
    computeOrganization(period),
    computeCountry(period),
  ]);

  return snapshots;
}

/**
 * Return DataAnalyticsSnapshot rows, optionally filtered by analyticsType,
 * newest first. Parses metrics/dimensionBreakdown from JSON.
 */
export async function getAnalytics(
  type?: AnalyticsType,
): Promise<DataAnalyticsSnapshot[]> {
  return cached(
    `analytics:get:${type ?? 'all'}`,
    TTL.MEDIUM,
    async () => {
      const rows = await safeFindMany(() =>
        db.dataAnalyticsSnapshot.findMany({
          where: type ? { analyticsType: type } : undefined,
          orderBy: { computedAt: 'desc' },
          take: 200,
        }),
      );
      return rows.map(mapSnapshot);
    },
  );
}

/**
 * Return a summary: total snapshot count + count by analyticsType.
 */
export async function getAnalyticsSummary(): Promise<{
  totalSnapshots: number;
  byType: Record<string, number>;
}> {
  return cached('analytics:summary', TTL.MEDIUM, async () => {
    const rows = await safeFindMany(() =>
      db.dataAnalyticsSnapshot.findMany({ select: { analyticsType: true } }),
    );
    return {
      totalSnapshots: rows.length,
      byType: countBy(rows, r => r.analyticsType),
    };
  });
}

/**
 * Return the most recent snapshot per analyticsType (one per type).
 */
export async function getLatestAnalytics(): Promise<DataAnalyticsSnapshot[]> {
  return cached('analytics:latest', TTL.MEDIUM, async () => {
    const all = await getAnalytics();
    const byType = new Map<string, DataAnalyticsSnapshot>();
    for (const snap of all) {
      // getAnalytics returns newest first, so only set if not already present
      if (!byType.has(snap.analyticsType)) {
        byType.set(snap.analyticsType, snap);
      }
    }
    return Array.from(byType.values());
  });
}
