// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Data Intelligence Cloud™
// Subsystem 4: Master Data Management™
// ═══════════════════════════════════════════════════════════════════════════════
//
// buildMasterData() scans REAL production tables and upserts MasterDataRecord
// golden records for six core entity types:
//   • customer   — from Client (key: GSTIN || tradeName || id)
//   • employee   — from Employee (key: employeeId || id)
//   • vendor     — from PurchaseBill (key: vendorGstin || vendorName)
//   • product    — from InvoiceItem (key: hsnCode || description)
//   • country    — from Country (key: isoCode)
//   • currency   — from CurrencyRate (key: quoteCurrency)
//
// Each golden record carries: attributes JSON (canonical fields), sourceIds[]
// (all contributing source row ids), confidenceScore=100, duplicateCount = N-1
// (records merged into this golden record beyond the first). The summary reports
// total golden records, by-entity-type counts, duplicates merged, and avg
// confidence. detectDuplicates() reports any clusters sharing the same
// (entityType, entityKey) without auto-merging.
//
// No mock data. Every value traces back to a real Prisma row.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import type { MasterDataRecord as PrismaMasterDataRecordRow } from '@prisma/client';
import {
  db, parseJson, safeFindMany, safeAggregate, cached, TTL, countBy, sumBy,
} from './helpers';
import type { MasterDataRecord, MasterEntityType } from './types';

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapMasterDataRecord(row: PrismaMasterDataRecordRow): MasterDataRecord {
  return {
    id: row.id,
    entityType: row.entityType as MasterEntityType,
    entityKey: row.entityKey,
    displayName: row.displayName,
    attributes: parseJson<Record<string, unknown>>(row.attributes, {}),
    sourceIds: parseJson<string[]>(row.sourceIds, []),
    confidenceScore: row.confidenceScore,
    duplicateCount: row.duplicateCount,
    status: row.status as 'active' | 'merged' | 'archived',
    mergedIntoId: row.mergedIntoId,
    lastVerifiedAt: row.lastVerifiedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Upsert helper (no unique constraint on entityType+entityKey) ─────────────

interface UpsertInput {
  entityType: MasterEntityType;
  entityKey: string;
  displayName: string;
  attributes: Record<string, unknown>;
  sourceIds: string[];
  duplicateCount: number;
  lastVerifiedAt: Date;
}

async function upsertMasterRecord(input: UpsertInput): Promise<MasterDataRecord> {
  const existing = await safeAggregate(() =>
    db.masterDataRecord.findFirst({
      where: { entityType: input.entityType, entityKey: input.entityKey },
    }),
  );
  const attributesJson = JSON.stringify(input.attributes);
  const sourceIdsJson = JSON.stringify(input.sourceIds);

  if (existing) {
    const updated = await db.masterDataRecord.update({
      where: { id: existing.id },
      data: {
        displayName: input.displayName,
        attributes: attributesJson,
        sourceIds: sourceIdsJson,
        confidenceScore: 100,
        duplicateCount: input.duplicateCount,
        status: 'active',
        lastVerifiedAt: input.lastVerifiedAt,
      },
    });
    return mapMasterDataRecord(updated);
  }

  const created = await db.masterDataRecord.create({
    data: {
      entityType: input.entityType,
      entityKey: input.entityKey,
      displayName: input.displayName,
      attributes: attributesJson,
      sourceIds: sourceIdsJson,
      confidenceScore: 100,
      duplicateCount: input.duplicateCount,
      status: 'active',
      lastVerifiedAt: input.lastVerifiedAt,
    },
  });
  return mapMasterDataRecord(created);
}

// ─── 1. buildMasterData ───────────────────────────────────────────────────────

/**
 * Scan REAL Prisma tables (clients, employees, purchaseBills, invoiceItems,
 * countries, currencyRates) and upsert one MasterDataRecord golden record per
 * entity. Returns the list of mapped golden records.
 */
export async function buildMasterData(): Promise<MasterDataRecord[]> {
  const [clients, employees, purchaseBills, invoiceItems, countries, currencyRates] =
    await Promise.all([
      safeFindMany(() => db.client.findMany({ take: 2000 })),
      safeFindMany(() => db.employee.findMany({ take: 2000 })),
      safeFindMany(() => db.purchaseBill.findMany({ take: 5000 })),
      safeFindMany(() => db.invoiceItem.findMany({ take: 5000 })),
      safeFindMany(() => db.country.findMany({ take: 500 })),
      safeFindMany(() => db.currencyRate.findMany({ take: 2000 })),
    ]);

  // ── Pre-aggregate vendors by key (vendorGstin || vendorName) ──
  const vendorsMap = new Map<
    string,
    {
      vendorName: string;
      vendorGstin: string | null;
      billIds: string[];
      totalAmount: number;
      latestUpdatedAt: Date | null;
    }
  >();
  for (const b of purchaseBills) {
    const name = (b.vendorName ?? '').trim() || '(unknown vendor)';
    const key = (b.vendorGstin ?? '').trim() || name;
    const existing = vendorsMap.get(key) ?? {
      vendorName: name,
      vendorGstin: b.vendorGstin ?? null,
      billIds: [],
      totalAmount: 0,
      latestUpdatedAt: null,
    };
    existing.billIds.push(b.id);
    existing.totalAmount += b.totalAmount ?? 0;
    if (b.updatedAt && (!existing.latestUpdatedAt || b.updatedAt > existing.latestUpdatedAt)) {
      existing.latestUpdatedAt = b.updatedAt;
    }
    if (!existing.vendorGstin && b.vendorGstin) existing.vendorGstin = b.vendorGstin;
    vendorsMap.set(key, existing);
  }

  // ── Pre-aggregate products by key (hsnCode || description) ──
  const productsMap = new Map<
    string,
    {
      description: string;
      hsnCode: string | null;
      unit: string | null;
      itemIds: string[];
      totalAmount: number;
    }
  >();
  for (const it of invoiceItems) {
    const description = (it.description ?? '').trim() || '(unknown product)';
    const key = (it.hsnCode ?? '').trim() || description.slice(0, 200);
    const existing = productsMap.get(key) ?? {
      description,
      hsnCode: it.hsnCode ?? null,
      unit: it.unit ?? null,
      itemIds: [],
      totalAmount: 0,
    };
    existing.itemIds.push(it.id);
    existing.totalAmount += it.totalAmount ?? 0;
    if (!existing.hsnCode && it.hsnCode) existing.hsnCode = it.hsnCode;
    if (!existing.unit && it.unit) existing.unit = it.unit;
    productsMap.set(key, existing);
  }

  // ── Pre-aggregate currencies by quoteCurrency ──
  const currenciesMap = new Map<
    string,
    {
      quoteCurrency: string;
      baseCurrency: string;
      latestRate: number;
      latestInverseRate: number;
      rateIds: string[];
    }
  >();
  for (const cr of currencyRates) {
    const key = (cr.quoteCurrency ?? '').trim() || '(unknown)';
    const existing = currenciesMap.get(key) ?? {
      quoteCurrency: key,
      baseCurrency: cr.baseCurrency,
      latestRate: cr.rate,
      latestInverseRate: cr.inverseRate,
      rateIds: [],
    };
    existing.rateIds.push(cr.id);
    // keep the most recent rate (CurrencyRate rows are appended chronologically)
    existing.latestRate = cr.rate;
    existing.latestInverseRate = cr.inverseRate;
    currenciesMap.set(key, existing);
  }

  const records: MasterDataRecord[] = [];

  // ── Customers (clients) ──
  for (const c of clients) {
    const entityKey = (c.gstin ?? '').trim() || (c.tradeName ?? '').trim() || c.id;
    const attributes: Record<string, unknown> = {
      gstin: c.gstin,
      tradeName: c.tradeName,
      legalName: c.legalName,
      state: c.state,
      stateCode: c.stateCode,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      entityType: c.entityType,
      returnPeriod: c.returnPeriod,
      lastFilingDate: c.lastFilingDate,
      status: c.status,
      healthScore: c.healthScore,
    };
    const rec = await upsertMasterRecord({
      entityType: 'customer',
      entityKey,
      displayName: c.tradeName || c.legalName || c.gstin,
      attributes,
      sourceIds: [c.id],
      duplicateCount: 0,
      lastVerifiedAt: c.updatedAt ?? c.createdAt ?? new Date(),
    });
    records.push(rec);
  }

  // ── Employees ──
  for (const e of employees) {
    const entityKey = (e.employeeId ?? '').trim() || e.id;
    const attributes: Record<string, unknown> = {
      name: e.name,
      designation: e.designation,
      department: e.department,
      employeeId: e.employeeId,
      pan: e.pan,
      salary: e.salary,
      basic: e.basic,
      hra: e.hra,
      allowances: e.allowances,
      pf: e.pf,
      esi: e.esi,
      tds: e.tds,
      netSalary: e.netSalary,
      status: e.status,
      joinedAt: e.joinedAt,
    };
    const rec = await upsertMasterRecord({
      entityType: 'employee',
      entityKey,
      displayName: e.name,
      attributes,
      sourceIds: [e.id],
      duplicateCount: 0,
      lastVerifiedAt: e.updatedAt ?? e.createdAt ?? new Date(),
    });
    records.push(rec);
  }

  // ── Vendors (aggregated from purchase bills) ──
  for (const [, v] of vendorsMap) {
    const entityKey = v.vendorGstin || v.vendorName;
    const attributes: Record<string, unknown> = {
      vendorName: v.vendorName,
      vendorGstin: v.vendorGstin,
      totalBills: v.billIds.length,
      totalAmount: v.totalAmount,
    };
    const rec = await upsertMasterRecord({
      entityType: 'vendor',
      entityKey,
      displayName: v.vendorName,
      attributes,
      sourceIds: v.billIds,
      duplicateCount: Math.max(0, v.billIds.length - 1),
      lastVerifiedAt: v.latestUpdatedAt ?? new Date(),
    });
    records.push(rec);
  }

  // ── Products / services (aggregated from invoice line items) ──
  for (const [, p] of productsMap) {
    const entityKey = p.hsnCode || p.description.slice(0, 200);
    const attributes: Record<string, unknown> = {
      description: p.description,
      hsnCode: p.hsnCode,
      unit: p.unit,
      totalLineItems: p.itemIds.length,
      totalAmount: p.totalAmount,
    };
    const rec = await upsertMasterRecord({
      entityType: 'product',
      entityKey,
      displayName: p.description,
      attributes,
      sourceIds: p.itemIds,
      duplicateCount: Math.max(0, p.itemIds.length - 1),
      lastVerifiedAt: new Date(),
    });
    records.push(rec);
  }

  // ── Countries ──
  for (const c of countries) {
    const entityKey = c.isoCode;
    const attributes: Record<string, unknown> = {
      isoCode: c.isoCode,
      name: c.name,
      officialName: c.officialName,
      region: c.region,
      taxSystem: c.taxSystem,
      currencyCode: c.currencyCode,
      language: c.language,
      timezone: c.timezone,
      fiscalYearStart: c.fiscalYearStart,
      accountingStandard: c.accountingStandard,
      payrollStandard: c.payrollStandard,
      isActive: c.isActive,
    };
    const rec = await upsertMasterRecord({
      entityType: 'country',
      entityKey,
      displayName: c.name,
      attributes,
      sourceIds: [c.id],
      duplicateCount: 0,
      lastVerifiedAt: c.updatedAt ?? c.createdAt ?? new Date(),
    });
    records.push(rec);
  }

  // ── Currencies (aggregated from CurrencyRate rows) ──
  for (const [, cur] of currenciesMap) {
    const entityKey = cur.quoteCurrency;
    const attributes: Record<string, unknown> = {
      quoteCurrency: cur.quoteCurrency,
      baseCurrency: cur.baseCurrency,
      latestRate: cur.latestRate,
      latestInverseRate: cur.latestInverseRate,
      rateCount: cur.rateIds.length,
    };
    const rec = await upsertMasterRecord({
      entityType: 'currency',
      entityKey,
      displayName: cur.quoteCurrency,
      attributes,
      sourceIds: cur.rateIds,
      duplicateCount: Math.max(0, cur.rateIds.length - 1),
      lastVerifiedAt: new Date(),
    });
    records.push(rec);
  }

  return records;
}

// ─── 2. getMasterData ─────────────────────────────────────────────────────────

/**
 * Return all golden records, optionally filtered by entityType. Parses
 * attributes + sourceIds JSON. Ordered by entityType, displayName.
 */
export async function getMasterData(
  entityType?: MasterEntityType,
): Promise<MasterDataRecord[]> {
  const cacheKey = `master-data:list:${entityType ?? 'all'}`;
  return cached(cacheKey, TTL.MEDIUM, async () => {
    const rows = await safeFindMany(() =>
      db.masterDataRecord.findMany({
        where: entityType ? { entityType } : undefined,
        orderBy: [{ entityType: 'asc' }, { displayName: 'asc' }],
        take: 5000,
      }),
    );
    return rows.map(mapMasterDataRecord);
  });
}

// ─── 3. getMasterDataSummary ──────────────────────────────────────────────────

export interface MasterDataSummary {
  totalGoldenRecords: number;
  byEntityType: Record<string, number>;
  duplicatesMerged: number;
  avgConfidence: number;
}

/**
 * Roll up all golden records: total count, by-entity-type breakdown, sum of
 * duplicateCount (duplicates merged), and mean confidenceScore.
 */
export async function getMasterDataSummary(): Promise<MasterDataSummary> {
  return cached('master-data:summary', TTL.MEDIUM, async () => {
    const rows = await safeFindMany(() => db.masterDataRecord.findMany({ take: 5000 }));
    const totalConfidence = rows.reduce((sum, r) => sum + r.confidenceScore, 0);
    return {
      totalGoldenRecords: rows.length,
      byEntityType: countBy(rows, (r) => r.entityType),
      duplicatesMerged: sumBy(rows, (r) => r.duplicateCount),
      avgConfidence:
        rows.length > 0
          ? Math.round((totalConfidence / rows.length) * 10) / 10
          : 0,
    };
  });
}

// ─── 4. detectDuplicates ──────────────────────────────────────────────────────

export interface DuplicateCluster {
  entityType: string;
  entityKey: string;
  duplicateIds: string[];
}

/**
 * Scan master records and report any clusters of records sharing the same
 * (entityType, entityKey). Does NOT auto-merge — purely a reporting function.
 */
export async function detectDuplicates(): Promise<DuplicateCluster[]> {
  return cached('master-data:duplicates', TTL.MEDIUM, async () => {
    const rows = await safeFindMany(() => db.masterDataRecord.findMany({ take: 5000 }));
    const clusters = new Map<string, string[]>();
    for (const r of rows) {
      const compositeKey = `${r.entityType}::${r.entityKey}`;
      const list = clusters.get(compositeKey) ?? [];
      list.push(r.id);
      clusters.set(compositeKey, list);
    }
    const out: DuplicateCluster[] = [];
    for (const [compositeKey, ids] of clusters) {
      if (ids.length > 1) {
        const separatorIdx = compositeKey.indexOf('::');
        const entityType = compositeKey.slice(0, separatorIdx);
        const entityKey = compositeKey.slice(separatorIdx + 2);
        out.push({ entityType, entityKey, duplicateIds: ids });
      }
    }
    return out;
  });
}
