// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO™ — GLOBAL ENTERPRISE OPERATING SYSTEM™
// Canonical Seeder — populates Country / TaxRule / ComplianceDeadline / PayrollStructure
// from the canonical registry. Idempotent: safe to call repeatedly; never deletes
// user-created rows.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  COUNTRY_REGISTRY,
  TAX_RULES_REGISTRY,
  COMPLIANCE_DEADLINES_REGISTRY,
  PAYROLL_STRUCTURES_REGISTRY,
} from './registry';

export interface GlobalSeedSummary {
  countries: number;
  taxRules: number;
  complianceDeadlines: number;
  payrollStructures: number;
  total: number;
}

/**
 * ensureGlobalSeedData()
 *
 * Idempotently populates the Global Enterprise OS canonical tables
 * (Country, TaxRule, ComplianceDeadline, PayrollStructure) from the
 * canonical registry. Safe to call multiple times — existing rows are
 * preserved, never deleted, and only created if missing.
 *
 * Strategy:
 *  - Country: upsert by unique `isoCode` (update non-key fields on collision).
 *  - TaxRule / ComplianceDeadline / PayrollStructure: no unique constraint on
 *    the natural keys, so we use `findFirst` + create-only-if-missing
 *    (idempotent — skips when an entry with the same natural key already
 *    exists). This preserves any user-edited rows for the same key.
 *
 * Returns a summary of how many rows are present after seeding for each table.
 */
export async function ensureGlobalSeedData(): Promise<GlobalSeedSummary> {
  // ── 1. Countries — upsert by isoCode ───────────────────────────────────────
  for (const c of COUNTRY_REGISTRY) {
    await db.country.upsert({
      where: { isoCode: c.isoCode },
      create: {
        isoCode: c.isoCode,
        name: c.name,
        officialName: c.officialName ?? null,
        region: c.region,
        taxSystem: c.taxSystem,
        currencyCode: c.currencyCode,
        currencySymbol: c.currencySymbol ?? null,
        currencyDecimals: c.currencyDecimals,
        language: c.language,
        timezone: c.timezone,
        fiscalYearStart: c.fiscalYearStart,
        govIdLabels: JSON.stringify(c.govIdLabels ?? {}),
        bankingStandard: c.bankingStandard,
        payrollStandard: c.payrollStandard,
        accountingStandard: c.accountingStandard,
        taxAuthority: c.taxAuthority ?? null,
      },
      update: {
        name: c.name,
        officialName: c.officialName ?? null,
        region: c.region,
        taxSystem: c.taxSystem,
        currencyCode: c.currencyCode,
        currencySymbol: c.currencySymbol ?? null,
        currencyDecimals: c.currencyDecimals,
        language: c.language,
        timezone: c.timezone,
        fiscalYearStart: c.fiscalYearStart,
        govIdLabels: JSON.stringify(c.govIdLabels ?? {}),
        bankingStandard: c.bankingStandard,
        payrollStandard: c.payrollStandard,
        accountingStandard: c.accountingStandard,
        taxAuthority: c.taxAuthority ?? null,
      },
    });
  }

  // ── 2. TaxRules — findFirst(countryIso + taxType + taxName) then create ────
  for (const r of TAX_RULES_REGISTRY) {
    const existing = await db.taxRule.findFirst({
      where: {
        countryIso: r.countryIso,
        taxType: r.taxType,
        taxName: r.taxName,
      },
      select: { id: true },
    });
    if (existing) continue; // idempotent skip — preserve user edits

    await db.taxRule.create({
      data: {
        countryIso: r.countryIso,
        taxType: r.taxType,
        taxName: r.taxName,
        ratePct: r.ratePct,
        reducedRatePct: r.reducedRatePct ?? 0,
        thresholdAmount: r.thresholdAmount ?? 0,
        filingFrequency: r.filingFrequency,
        effectiveFrom: r.effectiveFrom ?? null,
        effectiveTo: r.effectiveTo ?? null,
        notes: r.notes ?? null,
        isActive: r.isActive ?? true,
      },
    });
  }

  // ── 3. ComplianceDeadlines — findFirst(countryIso + title) then create ────
  for (const d of COMPLIANCE_DEADLINES_REGISTRY) {
    const existing = await db.complianceDeadline.findFirst({
      where: {
        countryIso: d.countryIso,
        title: d.title,
      },
      select: { id: true },
    });
    if (existing) continue; // idempotent skip

    await db.complianceDeadline.create({
      data: {
        countryIso: d.countryIso,
        regulationType: d.regulationType,
        title: d.title,
        description: d.description ?? null,
        frequency: d.frequency,
        dueDateRule: d.dueDateRule,
        penaltyLate: d.penaltyLate ?? null,
        authority: d.authority ?? null,
        riskLevel: d.riskLevel,
        isActive: d.isActive ?? true,
      },
    });
  }

  // ── 4. PayrollStructures — findFirst(countryIso + structureName) then create
  //    Note: incomeTaxBrackets is a TaxBracket[] in the registry but a JSON
  //    String column in SQLite — must JSON.stringify before persisting.
  for (const p of PAYROLL_STRUCTURES_REGISTRY) {
    const existing = await db.payrollStructure.findFirst({
      where: {
        countryIso: p.countryIso,
        structureName: p.structureName,
      },
      select: { id: true },
    });
    if (existing) continue; // idempotent skip

    await db.payrollStructure.create({
      data: {
        countryIso: p.countryIso,
        structureName: p.structureName,
        currencyCode: p.currencyCode,
        payCycle: p.payCycle,
        minWageMonthly: p.minWageMonthly ?? 0,
        socialSecurityEmployerPct: p.socialSecurityEmployerPct ?? 0,
        socialSecurityEmployeePct: p.socialSecurityEmployeePct ?? 0,
        medicareEmployerPct: p.medicareEmployerPct ?? 0,
        medicareEmployeePct: p.medicareEmployeePct ?? 0,
        retirementEmployerPct: p.retirementEmployerPct ?? 0,
        retirementEmployeePct: p.retirementEmployeePct ?? 0,
        annualLeaveDays: p.annualLeaveDays ?? 0,
        sickLeaveDays: p.sickLeaveDays ?? 0,
        maternityLeaveDays: p.maternityLeaveDays ?? 0,
        incomeTaxBrackets: JSON.stringify(p.incomeTaxBrackets ?? []),
        notes: p.notes ?? null,
        isActive: true,
      },
    });
  }

  // ── 5. Return summary counts (post-seed) ───────────────────────────────────
  const [countries, taxRules, complianceDeadlines, payrollStructures] =
    await Promise.all([
      db.country.count(),
      db.taxRule.count(),
      db.complianceDeadline.count(),
      db.payrollStructure.count(),
    ]);

  return {
    countries,
    taxRules,
    complianceDeadlines,
    payrollStructures,
    total: countries + taxRules + complianceDeadlines + payrollStructures,
  };
}

export default ensureGlobalSeedData;
