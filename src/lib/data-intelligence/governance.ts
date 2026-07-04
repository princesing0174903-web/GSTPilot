// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Data Intelligence Cloud™ (UNIFIED ENTERPRISE DATA BRAIN)
// Data Governance™ — classification / retention / access / masking / residency /
// compliance frameworks (GDPR / SOC2 / ISO 27001). Real policies, real coverage.
// ═══════════════════════════════════════════════════════════════════════════════

import type { DataGovernancePolicy as PrismaGovernanceRow } from '@prisma/client';

import {
  db,
  safeFindMany,
  safeCount,
  countBy,
  parseJson,
  cached,
  TTL,
} from './helpers';
import type {
  DataGovernancePolicy,
  GovernancePolicyType,
  SensitivityLevel,
} from './types';

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface GovernanceSummary {
  totalPolicies: number;
  byType: Record<string, number>;
  bySensitivity: Record<string, number>;
  complianceFrameworks: string[];
  coveragePct: number;
}

export interface AccessHistoryEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  clientId: string | null;
  details: string | null;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPLIANCE_FRAMEWORKS: ReadonlySet<string> = new Set([
  'gdpr',
  'soc2',
  'iso27001',
]);

const DEFAULT_RETENTION_DAYS = 2555; // 7 years

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapPolicy(row: PrismaGovernanceRow): DataGovernancePolicy {
  return {
    id: row.id,
    policyName: row.policyName,
    policyType: row.policyType as GovernancePolicyType,
    datasetKey: row.datasetKey,
    domain: row.domain,
    sensitivity: row.sensitivity as SensitivityLevel,
    retentionDays: row.retentionDays,
    accessRoles: parseJson<string[]>(row.accessRoles, []),
    maskingRules: parseJson<Record<string, string>>(row.maskingRules, {}),
    residencyRegion: row.residencyRegion,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

/**
 * If the DataGovernancePolicy table is empty, insert the canonical 5 policies:
 *  (a) PII classification for employee/customer datasets
 *  (b) Financial confidentiality for invoice/payment/tax datasets
 *  (c) GDPR residency (region=in, retention=7y)
 *  (d) SOC2 access logging (roles=ceo,cfo,admin)
 *  (e) ISO 27001 encryption
 * Returns the policies (existing or freshly seeded).
 */
export async function seedGovernancePoliciesIfMissing(): Promise<
  DataGovernancePolicy[]
> {
  const existingCount = await safeCount(() => db.dataGovernancePolicy.count());
  if (existingCount > 0) {
    return getGovernancePolicies();
  }

  const canonical: Array<{
    policyName: string;
    policyType: GovernancePolicyType;
    datasetKey: string | null;
    domain: string | null;
    sensitivity: SensitivityLevel;
    retentionDays: number;
    accessRoles: string[];
    maskingRules: Record<string, string>;
    residencyRegion: string | null;
  }> = [
    {
      policyName: 'PII Classification — Employee & Customer Data',
      policyType: 'classification',
      datasetKey: null,
      domain: 'hr',
      sensitivity: 'pii',
      retentionDays: DEFAULT_RETENTION_DAYS,
      accessRoles: [],
      maskingRules: { pan: 'mask', aadhaar: 'mask', email: 'partial' },
      residencyRegion: 'in',
    },
    {
      policyName: 'Financial Confidentiality — Invoices / Payments / Tax',
      policyType: 'classification',
      datasetKey: null,
      domain: 'finance',
      sensitivity: 'financial',
      retentionDays: DEFAULT_RETENTION_DAYS,
      accessRoles: ['cfo', 'ceo', 'admin'],
      maskingRules: {},
      residencyRegion: 'in',
    },
    {
      policyName: 'GDPR Data Residency — India',
      policyType: 'gdpr',
      datasetKey: null,
      domain: null,
      sensitivity: 'restricted',
      retentionDays: DEFAULT_RETENTION_DAYS,
      accessRoles: ['admin'],
      maskingRules: {},
      residencyRegion: 'in',
    },
    {
      policyName: 'SOC2 Access Control & Logging',
      policyType: 'soc2',
      datasetKey: null,
      domain: null,
      sensitivity: 'confidential',
      retentionDays: DEFAULT_RETENTION_DAYS,
      accessRoles: ['ceo', 'cfo', 'admin'],
      maskingRules: {},
      residencyRegion: null,
    },
    {
      policyName: 'ISO 27001 Encryption at Rest & in Transit',
      policyType: 'iso27001',
      datasetKey: null,
      domain: null,
      sensitivity: 'restricted',
      retentionDays: DEFAULT_RETENTION_DAYS,
      accessRoles: ['admin'],
      maskingRules: {},
      residencyRegion: null,
    },
  ];

  for (const p of canonical) {
    try {
      await db.dataGovernancePolicy.create({
        data: {
          policyName: p.policyName,
          policyType: p.policyType,
          datasetKey: p.datasetKey,
          domain: p.domain,
          sensitivity: p.sensitivity,
          retentionDays: p.retentionDays,
          accessRoles: JSON.stringify(p.accessRoles),
          maskingRules: JSON.stringify(p.maskingRules),
          residencyRegion: p.residencyRegion,
          isActive: true,
        },
      });
    } catch {
      // Defensive — keep going even if one insert fails.
    }
  }

  return getGovernancePolicies();
}

// ─── Read API ─────────────────────────────────────────────────────────────────

/** Return all DataGovernancePolicy rows, with JSON fields parsed. */
export async function getGovernancePolicies(): Promise<DataGovernancePolicy[]> {
  return cached('di:governance:policies', TTL.MEDIUM, async () => {
    const rows = await safeFindMany(() =>
      db.dataGovernancePolicy.findMany({
        orderBy: { createdAt: 'asc' },
      }),
    );
    return rows.map(mapPolicy);
  });
}

/** Aggregate summary — byType, bySensitivity, complianceFrameworks, coveragePct. */
export async function getGovernanceSummary(): Promise<GovernanceSummary> {
  return cached('di:governance:summary', TTL.MEDIUM, async () => {
    const policies = await getGovernancePolicies();
    const byType = countBy(policies, (p) => p.policyType);
    const bySensitivity = countBy(policies, (p) => p.sensitivity);

    const complianceFrameworks = Array.from(
      new Set(
        policies
          .map((p) => p.policyType)
          .filter((t) => COMPLIANCE_FRAMEWORKS.has(t)),
      ),
    ).sort();

    // Coverage = % of catalog datasets that have at least one policy.
    const catalog = await safeFindMany(() =>
      db.dataCatalogEntry.findMany({
        where: { isActive: true },
        select: { datasetKey: true },
      }),
    );
    const totalCatalog = catalog.length;
    const policyDatasetKeys = new Set(
      policies.map((p) => p.datasetKey).filter((k): k is string => Boolean(k)),
    );
    const covered = catalog.filter((c) => policyDatasetKeys.has(c.datasetKey)).length;
    const coveragePct =
      totalCatalog > 0 ? Math.round((covered / totalCatalog) * 100) : 0;

    return {
      totalPolicies: policies.length,
      byType,
      bySensitivity,
      complianceFrameworks,
      coveragePct,
    };
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Upsert a classification policy on a specific dataset. If a classification
 * policy already exists for this datasetKey, update its sensitivity; otherwise
 * create one. Returns the resulting policy.
 */
export async function classifyDataset(
  datasetKey: string,
  sensitivity: SensitivityLevel,
): Promise<DataGovernancePolicy | null> {
  let existing: PrismaGovernanceRow | null = null;
  try {
    existing = await db.dataGovernancePolicy.findFirst({
      where: { policyType: 'classification', datasetKey },
    });
  } catch {
    existing = null;
  }

  try {
    let row: PrismaGovernanceRow;
    if (existing) {
      row = await db.dataGovernancePolicy.update({
        where: { id: existing.id },
        data: { sensitivity, isActive: true },
      });
    } else {
      row = await db.dataGovernancePolicy.create({
        data: {
          policyName: `Classification — ${datasetKey}`,
          policyType: 'classification',
          datasetKey,
          domain: null,
          sensitivity,
          retentionDays: DEFAULT_RETENTION_DAYS,
          accessRoles: JSON.stringify([]),
          maskingRules: JSON.stringify({}),
          residencyRegion: null,
          isActive: true,
        },
      });
    }
    return mapPolicy(row);
  } catch {
    return null;
  }
}

// ─── Access History (from AuditLog) ───────────────────────────────────────────

/**
 * Read AuditLog rows for dataset access events.
 *  - If `datasetKey` is provided, filter to rows where `entity` contains the
 *    datasetKey (case-insensitive) OR `details` contains it.
 *  - Otherwise return catalog-related access (entity contains 'catalog' or
 *    'data_catalog').
 * Uses safeFindMany so an empty/missing table returns [].
 */
export async function getAccessHistory(
  datasetKey?: string,
): Promise<AccessHistoryEntry[]> {
  const rows = await safeFindMany(() =>
    db.auditLog.findMany({
      where: datasetKey
        ? {
            OR: [
              { entity: { contains: datasetKey } },
              { details: { contains: datasetKey } },
              { entityId: { contains: datasetKey } },
            ],
          }
        : {
            OR: [
              { entity: { contains: 'catalog' } },
              { entity: { contains: 'data_catalog' } },
              { action: { contains: 'catalog' } },
            ],
          },
      orderBy: { timestamp: 'desc' },
      take: 500,
    }),
  );

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    userId: r.userId,
    clientId: r.clientId,
    details: r.details,
    timestamp: r.timestamp.toISOString(),
  }));
}
