// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — Global Enterprise Operating System™
// Global Consolidation Engine™ — Consolidates revenue/expense/profit/tax/payroll/
// cashflow/assets/liabilities across every entity × country × currency with FX conversion.
// Founder & Owner: Prince Singh. Built on REAL production business data.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry } from './registry';
import { convertToBase, todayISO, getFxRate } from './currency';
import { cacheGet, cacheSet, TTL_PRESETS, buildKey } from './cache';
import type {
  ConsolidationMetric,
  ConsolidationEntryRecord,
  ConsolidationReport,
  EntityRecord,
} from './types';

// ─── Period helpers ──────────────────────────────────────────────────────────

export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function priorPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Entity management ───────────────────────────────────────────────────────

export async function createEntity(input: EntityRecord): Promise<{ id: string; entity: EntityRecord }> {
  const created = await db.globalEntity.create({
    data: {
      firmId: input.firmId ?? null,
      parentEntityId: input.parentEntityId ?? null,
      legalName: input.legalName,
      tradeName: input.tradeName ?? null,
      entityKind: input.entityKind,
      countryIso: input.countryIso.toUpperCase(),
      registrationNo: input.registrationNo ?? null,
      taxId: input.taxId ?? null,
      address: input.address ?? null,
      baseCurrency: input.baseCurrency.toUpperCase(),
      consolidated: input.consolidated,
      ownershipPct: input.ownershipPct,
      status: input.status,
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
  return {
    id: created.id,
    entity: {
      id: created.id,
      firmId: created.firmId ?? undefined,
      parentEntityId: created.parentEntityId ?? undefined,
      legalName: created.legalName,
      tradeName: created.tradeName ?? undefined,
      entityKind: created.entityKind as EntityRecord['entityKind'],
      countryIso: created.countryIso,
      registrationNo: created.registrationNo ?? undefined,
      taxId: created.taxId ?? undefined,
      address: created.address ?? undefined,
      baseCurrency: created.baseCurrency,
      consolidated: created.consolidated,
      ownershipPct: created.ownershipPct,
      status: created.status as EntityRecord['status'],
      metadata: JSON.parse(created.metadata || '{}'),
    },
  };
}

export async function listEntities(firmId?: string, countryIso?: string): Promise<Array<EntityRecord & { id: string }>> {
  const rows = await db.globalEntity.findMany({
    where: {
      ...(firmId ? { firmId } : {}),
      ...(countryIso ? { countryIso: countryIso.toUpperCase() } : {}),
      status: { not: 'divested' },
    },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((r) => ({
    id: r.id,
    firmId: r.firmId ?? undefined,
    parentEntityId: r.parentEntityId ?? undefined,
    legalName: r.legalName,
    tradeName: r.tradeName ?? undefined,
    entityKind: r.entityKind as EntityRecord['entityKind'],
    countryIso: r.countryIso,
    registrationNo: r.registrationNo ?? undefined,
    taxId: r.taxId ?? undefined,
    address: r.address ?? undefined,
    baseCurrency: r.baseCurrency,
    consolidated: r.consolidated,
    ownershipPct: r.ownershipPct,
    status: r.status as EntityRecord['status'],
    metadata: JSON.parse(r.metadata || '{}'),
  }));
}

export async function getEntityTree(firmId?: string): Promise<Array<EntityRecord & { id: string; childCount: number }>> {
  const all = await listEntities(firmId);
  return all.map((e) => ({
    ...e,
    childCount: all.filter((c) => c.parentEntityId === e.id).length,
  }));
}

// ─── Persist consolidation entry (idempotent per entity×period×metric) ───────

export async function upsertConsolidationEntry(input: {
  entityId: string;
  period: string;
  metric: ConsolidationMetric;
  valueLocal: number;
  sourceType?: string;
  sourceRef?: string;
}): Promise<void> {
  const entity = await db.globalEntity.findUnique({ where: { id: input.entityId } });
  if (!entity) throw new Error(`Entity not found: ${input.entityId}`);
  const base = await convertToBase(input.valueLocal, entity.baseCurrency);
  // Check existing
  const existing = await db.consolidationEntry.findFirst({
    where: { entityId: input.entityId, period: input.period, metric: input.metric },
  });
  if (existing) {
    await db.consolidationEntry.update({
      where: { id: existing.id },
      data: {
        valueLocal: input.valueLocal,
        valueBase: base.baseAmount,
        sourceType: input.sourceType ?? 'api',
        sourceRef: input.sourceRef ?? null,
        fxRateUsed: base.rate,
        fxRateAsOf: base.asOfDate,
      },
    });
  } else {
    await db.consolidationEntry.create({
      data: {
        entityId: input.entityId,
        period: input.period,
        metric: input.metric,
        valueLocal: input.valueLocal,
        valueBase: base.baseAmount,
        sourceType: input.sourceType ?? 'api',
        sourceRef: input.sourceRef ?? null,
        fxRateUsed: base.rate,
        fxRateAsOf: base.asOfDate,
      },
    });
  }
}

// ─── Extract REAL metrics from Prisma for an entity ──────────────────────────
// Entities map to Clients (VEYRO treats each Client as a business entity).
// We derive entity financials from real Client + Invoice + Expense + Payroll data.

export interface EntityRealMetrics {
  revenueLocal: number;
  expenseLocal: number;
  taxLocal: number;
  payrollLocal: number;
  cashInflowLocal: number;
  cashOutflowLocal: number;
  cashBalanceLocal: number;
  assetsLocal: number;
  liabilitiesLocal: number;
}

/**
 * Extract real financial metrics for an entity from Prisma.
 * Maps the VEYRO Client (which represents a real business entity) to financials.
 * Uses the entity's taxId or registrationNo to match against Client.gstin or tradeName.
 */
export async function extractEntityMetrics(entityId: string, period: string): Promise<EntityRealMetrics> {
  const entity = await db.globalEntity.findUnique({ where: { id: entityId } });
  if (!entity) {
    return { revenueLocal: 0, expenseLocal: 0, taxLocal: 0, payrollLocal: 0, cashInflowLocal: 0, cashOutflowLocal: 0, cashBalanceLocal: 0, assetsLocal: 0, liabilitiesLocal: 0 };
  }

  // Try to match the entity to a Client via taxId (GSTIN) or tradeName
  let client: { id: string } | null = null;
  if (entity.taxId) {
    client = await db.client.findUnique({ where: { gstin: entity.taxId }, select: { id: true } });
  }
  if (!client && entity.tradeName) {
    client = await db.client.findFirst({ where: { tradeName: entity.tradeName }, select: { id: true } });
  }
  if (!client && entity.legalName) {
    client = await db.client.findFirst({ where: { legalName: entity.legalName }, select: { id: true } });
  }

  // If no Client match — return zeros (entity not yet linked to real data)
  if (!client) {
    return { revenueLocal: 0, expenseLocal: 0, taxLocal: 0, payrollLocal: 0, cashInflowLocal: 0, cashOutflowLocal: 0, cashBalanceLocal: 0, assetsLocal: 0, liabilitiesLocal: 0 };
  }

  // Extract period-matched metrics from REAL Prisma data
  const [y, m] = period.split('-').map(Number);
  const periodStart = `${y}-${String(m).padStart(2, '0')}-01`;
  const periodEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  // Revenue = sum of invoice taxableValue where invoiceDate in period
  // (Invoice has no `totalTax` field — tax is cgst+sgst+igst+cess, also denormalised as `gstAmount`)
  const invoices = await db.invoice.findMany({
    where: {
      clientId: client.id,
      invoiceDate: { gte: periodStart, lt: periodEnd },
    },
    select: { taxableValue: true, gstAmount: true, totalAmount: true },
  });
  const revenueLocal = invoices.reduce((s, i) => s + (i.taxableValue ?? 0), 0);
  const taxLocal = invoices.reduce((s, i) => s + (i.gstAmount ?? 0), 0);
  const cashInflowLocal = invoices.reduce((s, i) => s + (i.totalAmount ?? 0), 0);

  // Expenses (Expense model uses `date` field, not `expenseDate`)
  const expenses = await db.expense.findMany({
    where: {
      clientId: client.id,
      date: { gte: periodStart, lt: periodEnd },
    },
    select: { amount: true },
  });
  const expenseLocal = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  // Payroll (Payroll has no clientId — joins via Employee.clientId)
  let payrollLocal = 0;
  try {
    const employeeIds = (await db.employee.findMany({
      where: { clientId: client.id },
      select: { id: true },
    })).map((e) => e.id);
    if (employeeIds.length > 0) {
      const payrollRecords = await db.payroll.findMany({
        where: { employeeId: { in: employeeIds }, period },
        select: { grossSalary: true },
      });
      payrollLocal = payrollRecords.reduce((s, p) => s + (p.grossSalary ?? 0), 0);
    }
  } catch {
    // payroll/employee table shape may differ — skip on error
  }

  // Cash balance = sum of customer payments received - sum of vendor payments made
  // (Payment has no `type` field — uses `partyType` = 'customer' | 'vendor')
  const paymentsIn = await db.payment.findMany({
    where: { clientId: client.id, paymentDate: { gte: periodStart, lt: periodEnd }, partyType: 'customer' },
    select: { amount: true },
  }).catch(() => [] as Array<{ amount: number | null }>);
  const paymentsOut = await db.payment.findMany({
    where: { clientId: client.id, paymentDate: { gte: periodStart, lt: periodEnd }, partyType: 'vendor' },
    select: { amount: true },
  }).catch(() => [] as Array<{ amount: number | null }>);
  const cashOutflowLocal = expenseLocal + payrollLocal + paymentsOut.reduce((s, p) => s + (p.amount ?? 0), 0);
  const cashBalanceLocal = paymentsIn.reduce((s, p) => s + (p.amount ?? 0), 0) - cashOutflowLocal;

  // Assets = outstanding receivables (sum of unpaid invoice balances)
  const assetsLocal = invoices.reduce((s, i) => s + (i.totalAmount ?? 0), 0) - paymentsIn.reduce((s, p) => s + (p.amount ?? 0), 0);

  // Liabilities = outstanding payables (sum of unpaid expense + tax owed)
  const liabilitiesLocal = expenseLocal + taxLocal - paymentsOut.reduce((s, p) => s + (p.amount ?? 0), 0);

  return {
    revenueLocal,
    expenseLocal,
    taxLocal,
    payrollLocal,
    cashInflowLocal,
    cashOutflowLocal,
    cashBalanceLocal,
    assetsLocal: Math.max(0, assetsLocal),
    liabilitiesLocal: Math.max(0, liabilitiesLocal),
  };
}

// ─── Auto-extract & persist all metrics for an entity in a period ────────────

export async function persistEntityMetricsForPeriod(entityId: string, period: string): Promise<void> {
  const metrics = await extractEntityMetrics(entityId, period);
  const mapping: Array<{ metric: ConsolidationMetric; value: number }> = [
    { metric: 'revenue', value: metrics.revenueLocal },
    { metric: 'expense', value: metrics.expenseLocal },
    { metric: 'tax', value: metrics.taxLocal },
    { metric: 'payroll', value: metrics.payrollLocal },
    { metric: 'cash_inflow', value: metrics.cashInflowLocal },
    { metric: 'cash_outflow', value: metrics.cashOutflowLocal },
    { metric: 'cash_balance', value: metrics.cashBalanceLocal },
    { metric: 'assets', value: metrics.assetsLocal },
    { metric: 'liabilities', value: metrics.liabilitiesLocal },
  ];
  await Promise.all(mapping.map((m) => upsertConsolidationEntry({
    entityId, period, metric: m.metric, valueLocal: m.value, sourceType: 'prisma',
  })));
}

// ─── Consolidation report — aggregate across entities × countries ────────────

export async function getConsolidationReport(period?: string, firmId?: string): Promise<ConsolidationReport> {
  const targetPeriod = period ?? currentPeriod();
  const cacheKey = buildKey('consolidation-report', { period: targetPeriod, firm: firmId ?? 'all' });
  const cached = cacheGet<ConsolidationReport>(cacheKey);
  if (cached) return cached.value;

  // Get all consolidated entities
  const entities = await db.globalEntity.findMany({
    where: { consolidated: true, ...(firmId ? { firmId } : {}), status: { not: 'divested' } },
  });

  // For each entity, ensure metrics are persisted from Prisma, then load consolidation entries
  await Promise.all(entities.map((e) => persistEntityMetricsForPeriod(e.id, targetPeriod).catch(() => null)));

  const entries = await db.consolidationEntry.findMany({
    where: { entityId: { in: entities.map((e) => e.id) }, period: targetPeriod },
  });

  // Build byMetric totals (in base INR), applying ownership %
  const entityOwnership = new Map(entities.map((e) => [e.id, e.ownershipPct]));
  const entityCountry = new Map(entities.map((e) => [e.id, e.countryIso]));
  const entityCurrency = new Map(entities.map((e) => [e.id, e.baseCurrency]));
  const entityName = new Map(entities.map((e) => [e.id, e.legalName]));

  const byMetricBase: Record<ConsolidationMetric, number> = {
    revenue: 0, expense: 0, profit: 0, tax: 0, payroll: 0,
    cash_inflow: 0, cash_outflow: 0, cash_balance: 0,
    assets: 0, liabilities: 0, equity: 0,
  };
  for (const e of entries) {
    const ownership = (entityOwnership.get(e.entityId) ?? 100) / 100;
    const adjusted = e.valueBase * ownership;
    byMetricBase[e.metric as ConsolidationMetric] = (byMetricBase[e.metric as ConsolidationMetric] ?? 0) + adjusted;
  }
  // Profit = revenue - expense - tax - payroll
  byMetricBase.profit = byMetricBase.revenue - byMetricBase.expense - byMetricBase.tax - byMetricBase.payroll;
  // Equity = assets - liabilities
  byMetricBase.equity = byMetricBase.assets - byMetricBase.liabilities;

  // byCountry aggregation
  const byCountryMap = new Map<string, { revenue: number; expense: number; profit: number; tax: number; payroll: number; entityCount: number; currency: string }>();
  for (const e of entries) {
    const iso = entityCountry.get(e.entityId) ?? '?';
    const ownership = (entityOwnership.get(e.entityId) ?? 100) / 100;
    const adjusted = e.valueBase * ownership;
    const cur = entityCurrency.get(e.entityId) ?? 'INR';
    const entry = byCountryMap.get(iso) ?? { revenue: 0, expense: 0, profit: 0, tax: 0, payroll: 0, entityCount: 0, currency: cur };
    if (e.metric === 'revenue') entry.revenue += adjusted;
    if (e.metric === 'expense') entry.expense += adjusted;
    if (e.metric === 'tax') entry.tax += adjusted;
    if (e.metric === 'payroll') entry.payroll += adjusted;
    entry.entityCount = new Set(entries.filter(en => entityCountry.get(en.entityId) === iso).map(en => en.entityId)).size;
    byCountryMap.set(iso, entry);
  }
  // Recompute profit per country + pct of group revenue
  const totalRevenue = byMetricBase.revenue;
  const byCountry: ConsolidationReport['byCountry'] = Array.from(byCountryMap.entries())
    .map(([iso, v]) => {
      const country = getCountry(iso);
      const profit = v.revenue - v.expense - v.tax - v.payroll;
      return {
        countryIso: iso,
        countryName: country?.name ?? iso,
        currency: v.currency,
        entityCount: v.entityCount,
        revenue: v.revenue,
        expense: v.expense,
        profit,
        tax: v.tax,
        payroll: v.payroll,
        profitMarginPct: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
        pctOfGroupRevenue: totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // byEntity aggregation
  const byEntityMap = new Map<string, { revenue: number; expense: number; profit: number; ownershipPct: number; countryIso: string; currency: string }>();
  for (const e of entries) {
    const ownership = (entityOwnership.get(e.entityId) ?? 100) / 100;
    const adjusted = e.valueBase * ownership;
    const entry = byEntityMap.get(e.entityId) ?? {
      revenue: 0, expense: 0, profit: 0,
      ownershipPct: entityOwnership.get(e.entityId) ?? 100,
      countryIso: entityCountry.get(e.entityId) ?? '?',
      currency: entityCurrency.get(e.entityId) ?? 'INR',
    };
    if (e.metric === 'revenue') entry.revenue += adjusted;
    if (e.metric === 'expense') entry.expense += adjusted;
    byEntityMap.set(e.entityId, entry);
  }
  const byEntity: ConsolidationReport['byEntity'] = Array.from(byEntityMap.entries())
    .map(([eid, v]) => ({
      entityId: eid,
      legalName: entityName.get(eid) ?? eid,
      countryIso: v.countryIso,
      currency: v.currency,
      ownershipPct: v.ownershipPct,
      revenue: v.revenue,
      expense: v.expense,
      profit: v.revenue - v.expense,
      consolidatedRevenue: v.revenue,
      consolidatedProfit: v.revenue - v.expense,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // FX impact (compare to prior period using prior FX rates — best-effort)
  let fxImpactBase = 0;
  try {
    const priorP = priorPeriod(targetPeriod);
    const priorEntries = await db.consolidationEntry.findMany({
      where: { entityId: { in: entities.map((e) => e.id) }, period: priorP, metric: 'revenue' },
    });
    for (const pe of priorEntries) {
      // Re-convert prior-period local value at CURRENT FX rate
      const cur = entityCurrency.get(pe.entityId) ?? 'INR';
      const baseNow = await convertToBase(pe.valueLocal, cur);
      fxImpactBase += baseNow.baseAmount - pe.valueBase;
    }
  } catch {
    fxImpactBase = 0;
  }

  const profitMarginPct = byMetricBase.revenue > 0 ? (byMetricBase.profit / byMetricBase.revenue) * 100 : 0;
  const effectiveTaxRatePct = (byMetricBase.revenue - byMetricBase.expense) > 0
    ? (byMetricBase.tax / (byMetricBase.revenue - byMetricBase.expense)) * 100
    : 0;
  const netCashFlow = byMetricBase.cash_inflow - byMetricBase.cash_outflow;

  const oracleNarrative = buildConsolidationNarrative({
    period: targetPeriod,
    entityCount: entities.length,
    totalRevenue: byMetricBase.revenue,
    totalProfit: byMetricBase.profit,
    profitMarginPct,
    effectiveTaxRatePct,
    netCashFlow,
    topCountry: byCountry[0],
    fxImpactBase,
  });

  const report: ConsolidationReport = {
    period: targetPeriod,
    baseCurrency: 'INR',
    totalRevenue: byMetricBase.revenue,
    totalExpense: byMetricBase.expense,
    totalProfit: byMetricBase.profit,
    totalTax: byMetricBase.tax,
    totalPayroll: byMetricBase.payroll,
    totalCashInflow: byMetricBase.cash_inflow,
    totalCashOutflow: byMetricBase.cash_outflow,
    totalAssets: byMetricBase.assets,
    totalLiabilities: byMetricBase.liabilities,
    totalEquity: byMetricBase.equity,
    netCashFlow,
    profitMarginPct,
    effectiveTaxRatePct,
    byCountry,
    byEntity,
    byMetric: byMetricBase,
    fxImpactBase,
    oracleNarrative,
  };

  cacheSet(cacheKey, report, TTL_PRESETS.WARM);
  return report;
}

function buildConsolidationNarrative(params: {
  period: string;
  entityCount: number;
  totalRevenue: number;
  totalProfit: number;
  profitMarginPct: number;
  effectiveTaxRatePct: number;
  netCashFlow: number;
  topCountry?: { countryName: string; pctOfGroupRevenue: number };
  fxImpactBase: number;
}): string {
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const parts: string[] = [];
  parts.push(`Consolidated ${params.entityCount} entities for ${params.period}.`);
  parts.push(`Group revenue: ${fmt(params.totalRevenue)} INR; profit: ${fmt(params.totalProfit)} INR (margin ${params.profitMarginPct.toFixed(1)}%).`);
  if (params.topCountry) {
    parts.push(`${params.topCountry.countryName} contributes ${params.topCountry.pctOfGroupRevenue.toFixed(1)}% of group revenue.`);
  }
  if (params.fxImpactBase !== 0) {
    parts.push(`FX translation impact: ${fmt(params.fxImpactBase)} INR vs prior period.`);
  }
  parts.push(`Effective tax rate ${params.effectiveTaxRatePct.toFixed(1)}% on pre-tax profit. Net cash flow: ${fmt(params.netCashFlow)} INR.`);
  return parts.join(' ');
}

// ─── Consolidation entry listing (raw, for API) ──────────────────────────────

export async function listConsolidationEntries(
  entityId?: string,
  period?: string,
  metric?: ConsolidationMetric
): Promise<ConsolidationEntryRecord[]> {
  const rows = await db.consolidationEntry.findMany({
    where: {
      ...(entityId ? { entityId } : {}),
      ...(period ? { period } : {}),
      ...(metric ? { metric } : {}),
    },
    orderBy: [{ period: 'desc' }, { entityId: 'asc' }],
    take: 500,
  });
  const entityIds = Array.from(new Set(rows.map((r) => r.entityId)));
  const entities = entityIds.length > 0 ? await db.globalEntity.findMany({ where: { id: { in: entityIds } } }) : [];
  const entityMeta = new Map(entities.map((e) => [e.id, { name: e.legalName, countryIso: e.countryIso, currency: e.baseCurrency }]));
  return rows.map((r) => {
    const meta = entityMeta.get(r.entityId);
    return {
      entityId: r.entityId,
      entityName: meta?.name ?? r.entityId,
      countryIso: meta?.countryIso ?? '??',
      currency: meta?.currency ?? 'INR',
      period: r.period,
      metric: r.metric as ConsolidationMetric,
      valueLocal: r.valueLocal,
      valueBase: r.valueBase,
      fxRateUsed: r.fxRateUsed,
      fxRateAsOf: r.fxRateAsOf,
    };
  });
}
