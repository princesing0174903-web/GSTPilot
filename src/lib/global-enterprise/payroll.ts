// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Global Enterprise Operating System™
// Global Payroll Engine™ — Country-specific salary/benefits/taxes/leave/
// social-security/retirement/local-labor-law. Oracle applies correct structure.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { getCountry, getPayrollStructure, PAYROLL_STRUCTURES_REGISTRY } from './registry';
import { convertToBase } from './currency';
import { cacheGet, cacheSet, TTL_PRESETS, buildKey } from './cache';
import type {
  PayrollStructureRecord,
  PayrollCalculationResult,
  TaxBracket,
} from './types';

// ─── Load payroll structure (DB first, registry fallback) ────────────────────

export async function getPayrollStructureForCountry(countryIso: string): Promise<PayrollStructureRecord | null> {
  const iso = countryIso.toUpperCase();
  const cacheKey = `payroll-structure:${iso}`;
  const cached = cacheGet<PayrollStructureRecord | null>(cacheKey);
  if (cached) return cached.value;

  let structure: PayrollStructureRecord | null = null;
  try {
    const dbRow = await db.payrollStructure.findFirst({
      where: { countryIso: iso, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (dbRow) {
      let brackets: TaxBracket[] = [];
      try { brackets = (JSON.parse(dbRow.incomeTaxBrackets || '[]') as TaxBracket[]); } catch { brackets = []; }
      structure = {
        id: dbRow.id,
        countryIso: dbRow.countryIso,
        structureName: dbRow.structureName,
        currencyCode: dbRow.currencyCode,
        payCycle: dbRow.payCycle as PayrollStructureRecord['payCycle'],
        minWageMonthly: dbRow.minWageMonthly,
        socialSecurityEmployerPct: dbRow.socialSecurityEmployerPct,
        socialSecurityEmployeePct: dbRow.socialSecurityEmployeePct,
        medicareEmployerPct: dbRow.medicareEmployerPct,
        medicareEmployeePct: dbRow.medicareEmployeePct,
        retirementEmployerPct: dbRow.retirementEmployerPct,
        retirementEmployeePct: dbRow.retirementEmployeePct,
        annualLeaveDays: dbRow.annualLeaveDays,
        sickLeaveDays: dbRow.sickLeaveDays,
        maternityLeaveDays: dbRow.maternityLeaveDays,
        incomeTaxBrackets: brackets,
        notes: dbRow.notes ?? undefined,
      };
    }
  } catch {
    // ignore DB errors
  }
  if (!structure) {
    structure = getPayrollStructure(iso) ?? null;
  }
  cacheSet(cacheKey, structure, TTL_PRESETS.COLD);
  return structure;
}

export async function listAllPayrollStructures(): Promise<PayrollStructureRecord[]> {
  const cacheKey = 'payroll-structures:all';
  const cached = cacheGet<PayrollStructureRecord[]>(cacheKey);
  if (cached) return cached.value;
  let structures: PayrollStructureRecord[] = [];
  try {
    const dbRows = await db.payrollStructure.findMany({ where: { isActive: true } });
    structures = dbRows.map((dbRow) => {
      let brackets: TaxBracket[] = [];
      try { brackets = JSON.parse(dbRow.incomeTaxBrackets || '[]') as TaxBracket[]; } catch { brackets = []; }
      return {
        id: dbRow.id,
        countryIso: dbRow.countryIso,
        structureName: dbRow.structureName,
        currencyCode: dbRow.currencyCode,
        payCycle: dbRow.payCycle as PayrollStructureRecord['payCycle'],
        minWageMonthly: dbRow.minWageMonthly,
        socialSecurityEmployerPct: dbRow.socialSecurityEmployerPct,
        socialSecurityEmployeePct: dbRow.socialSecurityEmployeePct,
        medicareEmployerPct: dbRow.medicareEmployerPct,
        medicareEmployeePct: dbRow.medicareEmployeePct,
        retirementEmployerPct: dbRow.retirementEmployerPct,
        retirementEmployeePct: dbRow.retirementEmployeePct,
        annualLeaveDays: dbRow.annualLeaveDays,
        sickLeaveDays: dbRow.sickLeaveDays,
        maternityLeaveDays: dbRow.maternityLeaveDays,
        incomeTaxBrackets: brackets,
        notes: dbRow.notes ?? undefined,
      } as PayrollStructureRecord;
    });
  } catch {
    // ignore DB errors
  }
  if (structures.length === 0) {
    structures = [...PAYROLL_STRUCTURES_REGISTRY];
  }
  cacheSet(cacheKey, structures, TTL_PRESETS.COLD);
  return structures;
}

// ─── Progressive income tax calculation ──────────────────────────────────────

export function calculateProgressiveTax(annualIncome: number, brackets: TaxBracket[]): number {
  if (brackets.length === 0 || annualIncome <= 0) return 0;
  // Sort brackets by `from` ascending
  const sorted = [...brackets].sort((a, b) => a.from - b.from);
  let tax = 0;
  let prevTo = 0;
  for (const b of sorted) {
    const lower = Math.max(b.from, prevTo);
    const upper = b.to ?? Infinity;
    if (annualIncome <= lower) break;
    const taxableInBand = Math.min(annualIncome, upper) - lower;
    if (taxableInBand > 0) {
      tax += (taxableInBand * b.rate) / 100;
    }
    prevTo = upper;
    if (annualIncome <= upper) break;
  }
  return Math.max(0, tax);
}

// ─── Per-employee monthly payroll calculation ────────────────────────────────

export interface PayrollCalcInput {
  countryIso: string;
  grossMonthlyLocal: number;        // gross monthly salary in local currency
  annualizeForTax?: boolean;        // compute income tax on annualized basis (default true)
}

export async function calculatePayroll(input: PayrollCalcInput): Promise<PayrollCalculationResult> {
  const country = getCountry(input.countryIso);
  const structure = await getPayrollStructureForCountry(input.countryIso);
  const currency = country?.currencyCode ?? 'INR';
  const gross = Math.max(0, input.grossMonthlyLocal);

  if (!structure) {
    const base = await convertToBase(gross, currency);
    return {
      countryIso: input.countryIso.toUpperCase(),
      grossMonthly: gross,
      currency,
      socialSecurityEmployer: 0,
      medicareEmployer: 0,
      retirementEmployer: 0,
      totalEmployerCost: gross,
      socialSecurityEmployee: 0,
      medicareEmployee: 0,
      retirementEmployee: 0,
      incomeTax: 0,
      netPay: gross,
      totalDeductions: 0,
      effectiveTaxRate: 0,
      totalCostBase: base.baseAmount,
    };
  }

  const grossAnnual = gross * 12;
  const annualTax = input.annualizeForTax !== false
    ? calculateProgressiveTax(grossAnnual, structure.incomeTaxBrackets)
    : calculateProgressiveTax(gross, structure.incomeTaxBrackets);
  const monthlyIncomeTax = annualTax / 12;

  // Employer contributions (% of gross)
  const socialSecurityEmployer = (gross * structure.socialSecurityEmployerPct) / 100;
  const medicareEmployer = (gross * structure.medicareEmployerPct) / 100;
  const retirementEmployer = (gross * structure.retirementEmployerPct) / 100;
  const totalEmployerCost = gross + socialSecurityEmployer + medicareEmployer + retirementEmployer;

  // Employee deductions (% of gross)
  const socialSecurityEmployee = (gross * structure.socialSecurityEmployeePct) / 100;
  const medicareEmployee = (gross * structure.medicareEmployeePct) / 100;
  const retirementEmployee = (gross * structure.retirementEmployeePct) / 100;
  const totalDeductions = socialSecurityEmployee + medicareEmployee + retirementEmployee + monthlyIncomeTax;
  const netPay = Math.max(0, gross - totalDeductions);
  const effectiveTaxRate = gross > 0 ? (monthlyIncomeTax / gross) * 100 : 0;

  const base = await convertToBase(totalEmployerCost, currency);

  return {
    countryIso: input.countryIso.toUpperCase(),
    grossMonthly: gross,
    currency,
    socialSecurityEmployer,
    medicareEmployer,
    retirementEmployer,
    totalEmployerCost,
    socialSecurityEmployee,
    medicareEmployee,
    retirementEmployee,
    incomeTax: monthlyIncomeTax,
    netPay,
    totalDeductions,
    effectiveTaxRate,
    totalCostBase: base.baseAmount,
  };
}

// ─── Multi-employee global payroll summary ───────────────────────────────────

export interface GlobalPayrollSummary {
  totalMonthlyCostBase: number;     // INR equivalent
  totalAnnualCostBase: number;
  byCountry: Array<{
    countryIso: string;
    countryName: string;
    currency: string;
    employeeCount: number;
    totalGrossLocal: number;
    totalEmployerCostLocal: number;
    totalEmployerCostBase: number;
    avgGrossLocal: number;
    pctOfGlobalPayroll: number;
  }>;
  byRoleBand: Array<{
    roleBand: 'junior' | 'mid' | 'senior' | 'executive';
    employeeCount: number;
    totalCostBase: number;
    pctOfTotal: number;
  }>;
  baseCurrency: string;
  asOfDate: string;
  oracleNarrative: string;
}

/**
 * Compute global payroll summary from REAL employee records in Prisma.
 * Each Employee has: clientId (use as entity proxy), salary, role, etc.
 * For countries without a detected payroll structure, falls back to India structure.
 */
export async function getGlobalPayrollSummary(
  employeePositions?: Array<{ countryIso: string; grossMonthlyLocal: number; roleBand?: 'junior' | 'mid' | 'senior' | 'executive' }>
): Promise<GlobalPayrollSummary> {
  // If positions not provided, build from Prisma Employee table
  let positions: Array<{ countryIso: string; grossMonthlyLocal: number; roleBand?: 'junior' | 'mid' | 'senior' | 'executive' }> = [];
  if (employeePositions && employeePositions.length > 0) {
    positions = employeePositions;
  } else {
    try {
      const employees = await db.employee.findMany({ where: { status: 'active' } });
      // Employee has clientId — derive country from client's state if no country code
      // We treat India as default country (GSTPilot root) for employees without explicit country
      positions = employees.map((e) => {
        const salary = (e as { salary?: number }).salary ?? 0;
        const roleTitle = ((e as { role?: string }).role ?? '').toLowerCase();
        let roleBand: 'junior' | 'mid' | 'senior' | 'executive' = 'mid';
        if (roleTitle.includes('ceo') || roleTitle.includes('cto') || roleTitle.includes('cfo') || roleTitle.includes('chief') || roleTitle.includes('vp') || roleTitle.includes('director')) roleBand = 'executive';
        else if (roleTitle.includes('senior') || roleTitle.includes('lead') || roleTitle.includes('principal')) roleBand = 'senior';
        else if (roleTitle.includes('junior') || roleTitle.includes('intern') || roleTitle.includes('trainee')) roleBand = 'junior';
        return { countryIso: 'IN', grossMonthlyLocal: salary, roleBand };
      });
    } catch {
      positions = [];
    }
  }

  if (positions.length === 0) {
    return {
      totalMonthlyCostBase: 0,
      totalAnnualCostBase: 0,
      byCountry: [],
      byRoleBand: [],
      baseCurrency: 'INR',
      asOfDate: new Date().toISOString().slice(0, 10),
      oracleNarrative: 'No active employee records found. Connect payroll data to enable global payroll analytics.',
    };
  }

  // Group by country
  const byCountryMap = new Map<string, { count: number; grossLocal: number; costLocal: number; costBase: number }>();
  const byRoleBandMap = new Map<string, { count: number; costBase: number }>();
  let totalCostBase = 0;

  await Promise.all(positions.map(async (p) => {
    const calc = await calculatePayroll({ countryIso: p.countryIso, grossMonthlyLocal: p.grossMonthlyLocal });
    const iso = p.countryIso.toUpperCase();
    const cur = byCountryMap.get(iso) ?? { count: 0, grossLocal: 0, costLocal: 0, costBase: 0 };
    cur.count += 1;
    cur.grossLocal += calc.grossMonthly;
    cur.costLocal += calc.totalEmployerCost;
    cur.costBase += calc.totalCostBase;
    byCountryMap.set(iso, cur);
    totalCostBase += calc.totalCostBase;

    const rb = p.roleBand ?? 'mid';
    const rbEntry = byRoleBandMap.get(rb) ?? { count: 0, costBase: 0 };
    rbEntry.count += 1;
    rbEntry.costBase += calc.totalCostBase;
    byRoleBandMap.set(rb, rbEntry);
  }));

  const byCountry: GlobalPayrollSummary['byCountry'] = [];
  for (const [iso, v] of byCountryMap.entries()) {
    const country = getCountry(iso);
    byCountry.push({
      countryIso: iso,
      countryName: country?.name ?? iso,
      currency: country?.currencyCode ?? 'INR',
      employeeCount: v.count,
      totalGrossLocal: v.grossLocal,
      totalEmployerCostLocal: v.costLocal,
      totalEmployerCostBase: v.costBase,
      avgGrossLocal: v.count > 0 ? v.grossLocal / v.count : 0,
      pctOfGlobalPayroll: 0,
    });
  }
  byCountry.sort((a, b) => b.totalEmployerCostBase - a.totalEmployerCostBase);
  for (const c of byCountry) c.pctOfGlobalPayroll = totalCostBase > 0 ? (c.totalEmployerCostBase / totalCostBase) * 100 : 0;

  const roleBandOrder: Array<'junior' | 'mid' | 'senior' | 'executive'> = ['junior', 'mid', 'senior', 'executive'];
  const byRoleBand: GlobalPayrollSummary['byRoleBand'] = roleBandOrder
    .map((rb) => {
      const e = byRoleBandMap.get(rb);
      return {
        roleBand: rb,
        employeeCount: e?.count ?? 0,
        totalCostBase: e?.costBase ?? 0,
        pctOfTotal: totalCostBase > 0 ? ((e?.costBase ?? 0) / totalCostBase) * 100 : 0,
      };
    })
    .filter((r) => r.employeeCount > 0);

  const topCountry = byCountry[0];
  const oracleNarrative = `Global monthly payroll: ${totalCostBase.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR across ${byCountry.length} countries. ${topCountry ? `${topCountry.countryName} is the largest payroll center (${topCountry.pctOfGlobalPayroll.toFixed(1)}%).` : ''} ${byRoleBand.find(r => r.roleBand === 'executive')?.employeeCount ?? 0} executives, ${byRoleBand.find(r => r.roleBand === 'senior')?.employeeCount ?? 0} senior staff. Oracle recommends benchmarking payroll-to-revenue ratio against industry peers (target ≤25% for knowledge-services, ≤15% for manufacturing).`;

  return {
    totalMonthlyCostBase: totalCostBase,
    totalAnnualCostBase: totalCostBase * 12,
    byCountry,
    byRoleBand,
    baseCurrency: 'INR',
    asOfDate: new Date().toISOString().slice(0, 10),
    oracleNarrative,
  };
}
