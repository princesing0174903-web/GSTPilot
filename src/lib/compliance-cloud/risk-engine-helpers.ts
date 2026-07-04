// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Risk helpers
// Small adapter used by the digital twin / engine. Isolated so the twin file
// can depend on risk-engine DB queries without circular imports.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

/** Count of OPEN compliance risks linked to a given filing. */
export async function getRisksForFiling(filingId: string): Promise<number> {
  try {
    return await db.complianceRisk.count({
      where: {
        filingId,
        status: { notIn: ['resolved', 'accepted'] },
      },
    });
  } catch {
    return 0;
  }
}

/** Count of OPEN compliance risks for a given entity (Client). */
export async function getRisksForEntity(entityId: string): Promise<number> {
  try {
    return await db.complianceRisk.count({
      where: {
        entityId,
        status: { notIn: ['resolved', 'accepted'] },
      },
    });
  } catch {
    return 0;
  }
}

/** Sum of financial impact for OPEN risks for a given country. */
export async function getRiskImpactForCountry(countryIso: string): Promise<number> {
  try {
    const rows = await db.complianceRisk.findMany({
      where: {
        countryIso: countryIso.toUpperCase(),
        status: { notIn: ['resolved', 'accepted'] },
      },
      select: { financialImpact: true },
    });
    return rows.reduce((s, r) => s + r.financialImpact, 0);
  } catch {
    return 0;
  }
}
