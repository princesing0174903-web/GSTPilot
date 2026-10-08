// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — Global Enterprise Operating System™
// Global Organization Engine™ — Manages unlimited organizations, each with unlimited
// countries/legal entities/branches/offices/warehouses/departments/business units.
// All isolated while Oracle™ sees the entire enterprise.
// Founder & Owner: Prince Singh. Built on REAL production data.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry } from './registry';
import { currentPeriod, getConsolidationReport, createEntity, listEntities } from './consolidation';
import { listBankAccounts } from './banking';
import type { EntityRecord, EntityTree } from './types';

// Re-export entity management from consolidation (single source of truth)
export { createEntity, listEntities };

// ─── Get entity by ID ────────────────────────────────────────────────────────

export async function getEntity(entityId: string): Promise<(EntityRecord & { id: string }) | null> {
  const row = await db.globalEntity.findUnique({ where: { id: entityId } });
  if (!row) return null;
  return {
    id: row.id,
    firmId: row.firmId ?? undefined,
    parentEntityId: row.parentEntityId ?? undefined,
    legalName: row.legalName,
    tradeName: row.tradeName ?? undefined,
    entityKind: row.entityKind as EntityRecord['entityKind'],
    countryIso: row.countryIso,
    registrationNo: row.registrationNo ?? undefined,
    taxId: row.taxId ?? undefined,
    address: row.address ?? undefined,
    baseCurrency: row.baseCurrency,
    consolidated: row.consolidated,
    ownershipPct: row.ownershipPct,
    status: row.status as EntityRecord['status'],
    metadata: JSON.parse(row.metadata || '{}'),
  };
}

// ─── Update entity ───────────────────────────────────────────────────────────

export async function updateEntity(
  entityId: string,
  updates: Partial<Omit<EntityRecord, 'id' | 'firmId'>>
): Promise<EntityRecord & { id: string }> {
  const updated = await db.globalEntity.update({
    where: { id: entityId },
    data: {
      ...(updates.legalName ? { legalName: updates.legalName } : {}),
      ...(updates.tradeName !== undefined ? { tradeName: updates.tradeName ?? null } : {}),
      ...(updates.entityKind ? { entityKind: updates.entityKind } : {}),
      ...(updates.countryIso ? { countryIso: updates.countryIso.toUpperCase() } : {}),
      ...(updates.registrationNo !== undefined ? { registrationNo: updates.registrationNo ?? null } : {}),
      ...(updates.taxId !== undefined ? { taxId: updates.taxId ?? null } : {}),
      ...(updates.address !== undefined ? { address: updates.address ?? null } : {}),
      ...(updates.baseCurrency ? { baseCurrency: updates.baseCurrency.toUpperCase() } : {}),
      ...(updates.consolidated !== undefined ? { consolidated: updates.consolidated } : {}),
      ...(updates.ownershipPct !== undefined ? { ownershipPct: updates.ownershipPct } : {}),
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.parentEntityId !== undefined ? { parentEntityId: updates.parentEntityId ?? null } : {}),
      ...(updates.metadata ? { metadata: JSON.stringify(updates.metadata) } : {}),
    },
  });
  return {
    id: updated.id,
    firmId: updated.firmId ?? undefined,
    parentEntityId: updated.parentEntityId ?? undefined,
    legalName: updated.legalName,
    tradeName: updated.tradeName ?? undefined,
    entityKind: updated.entityKind as EntityRecord['entityKind'],
    countryIso: updated.countryIso,
    registrationNo: updated.registrationNo ?? undefined,
    taxId: updated.taxId ?? undefined,
    address: updated.address ?? undefined,
    baseCurrency: updated.baseCurrency,
    consolidated: updated.consolidated,
    ownershipPct: updated.ownershipPct,
    status: updated.status as EntityRecord['status'],
    metadata: JSON.parse(updated.metadata || '{}'),
  };
}

// ─── Rich entity tree (with country names, bank counts, revenue) ─────────────

export async function getRichEntityTree(firmId?: string): Promise<EntityTree[]> {
  const all = await listEntities(firmId);
  const period = currentPeriod();
  let revenueByEntity = new Map<string, number>();
  let profitByEntity = new Map<string, number>();
  try {
    const report = await getConsolidationReport(period, firmId);
    for (const e of report.byEntity) {
      revenueByEntity.set(e.entityId, e.revenue);
      profitByEntity.set(e.entityId, e.profit);
    }
  } catch { /* no consolidation data yet */ }

  // Get bank account counts per entity in one query
  const bankCounts = await db.bankAccount.groupBy({
    by: ['entityId'],
    where: { entityId: { in: all.map((e) => e.id) }, isActive: true },
    _count: { id: true },
  });
  const bankCountMap = new Map(bankCounts.map((b) => [b.entityId, b._count.id]));

  // Build tree: parent → children
  const entityMap = new Map<string, EntityTree>();
  for (const e of all) {
    const country = getCountry(e.countryIso);
    entityMap.set(e.id, {
      entity: e,
      countryName: country?.name ?? e.countryIso,
      childEntities: [],
      bankAccountCount: bankCountMap.get(e.id) ?? 0,
      revenueBase: revenueByEntity.get(e.id) ?? 0,
      profitBase: profitByEntity.get(e.id) ?? 0,
    });
  }
  // Link children to parents
  const roots: EntityTree[] = [];
  for (const e of all) {
    const node = entityMap.get(e.id)!;
    if (e.parentEntityId && entityMap.has(e.parentEntityId)) {
      entityMap.get(e.parentEntityId)!.childEntities.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ─── Entity statistics summary ───────────────────────────────────────────────

export interface EntityStats {
  totalEntities: number;
  byKind: Array<{ kind: string; count: number }>;
  byCountry: Array<{ countryIso: string; countryName: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  consolidatedCount: number;
  averageOwnershipPct: number;
  totalBankAccounts: number;
}

export async function getEntityStats(firmId?: string): Promise<EntityStats> {
  const entities = await db.globalEntity.findMany({
    where: { ...(firmId ? { firmId } : {}) },
    include: { country: true },
  });
  const totalBankAccounts = await db.bankAccount.count({ where: { isActive: true } });

  const kindMap = new Map<string, number>();
  const countryMap = new Map<string, { countryIso: string; countryName: string; count: number }>();
  const statusMap = new Map<string, number>();
  let consolidatedCount = 0;
  let ownershipSum = 0;

  for (const e of entities) {
    kindMap.set(e.entityKind, (kindMap.get(e.entityKind) ?? 0) + 1);
    const existing = countryMap.get(e.countryIso) ?? {
      countryIso: e.countryIso,
      countryName: e.country?.name ?? e.countryIso,
      count: 0,
    };
    existing.count += 1;
    countryMap.set(e.countryIso, existing);
    statusMap.set(e.status, (statusMap.get(e.status) ?? 0) + 1);
    if (e.consolidated) consolidatedCount += 1;
    ownershipSum += e.ownershipPct;
  }

  return {
    totalEntities: entities.length,
    byKind: Array.from(kindMap.entries()).map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    byCountry: Array.from(countryMap.values()).sort((a, b) => b.count - a.count),
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    consolidatedCount,
    averageOwnershipPct: entities.length > 0 ? ownershipSum / entities.length : 100,
    totalBankAccounts,
  };
}

// ─── List bank accounts for an entity (re-export) ────────────────────────────

export { listBankAccounts };
