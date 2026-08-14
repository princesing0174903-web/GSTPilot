// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Payroll Utilities (Prisma-free, client-safe)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure utility functions extracted from payroll.ts so client components can
// import them WITHOUT pulling @prisma/client into the browser bundle.
// The original payroll.ts re-exports these for backward compatibility.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Employee, Payroll, PayrollSummary } from './types';

// ─── Salary breakdown ─────────────────────────────────────────────────────────

export interface SalaryBreakdown {
  basic: number;
  hra: number;
  allowances: number;
  pf: number;
  esi: number;
  tds: number;
  professionalTax: number;
  netSalary: number;
}

/**
 * Standard Indian payroll breakdown for a gross monthly salary:
 *   - basic        = 50% of gross
 *   - hra          = 40% of basic (non-metro default)
 *   - allowances   = gross - basic - hra
 *   - PF           = 12% of basic, only if basic ≤ ₹15,000
 *   - ESI          = 0.75% of gross, only if gross ≤ ₹21,000
 *   - PT           = ₹200 flat if gross ≥ ₹15,000, else 0
 *   - TDS          = monthly estimate via new-regime slab (annual gross / 12)
 */
export function calculateSalaryBreakdown(gross: number): SalaryBreakdown {
  const basic = round2(gross * 0.5);
  const hra = round2(basic * 0.4);
  const allowances = round2(gross - basic - hra);
  const pf = basic <= 15000 ? round2(basic * 0.12) : round2(15000 * 0.12);
  const esi = gross <= 21000 ? round2(gross * 0.0075) : 0;
  const professionalTax = gross >= 15000 ? 200 : 0;
  const annualGross = gross * 12;
  const annualTds = estimateTDS(annualGross);
  const tds = round2(annualTds / 12);
  const netSalary = round2(gross - pf - esi - tds - professionalTax);
  return { basic, hra, allowances, pf, esi, tds, professionalTax, netSalary };
}

// ─── TDS estimation (new regime slabs) ────────────────────────────────────────

/**
 * Computes annual TDS under the FY2025-26 new regime slabs:
 *   0 - 3L    : 0%
 *   3L - 7L   : 5%
 *   7L - 10L  : 10%
 *   10L - 12L : 15%
 *   12L - 15L : 20%
 *   15L+      : 30%
 * Standard deduction of ₹75,000 is applied before slab computation.
 */
export function estimateTDS(annualGross: number): number {
  const STANDARD_DEDUCTION = 75000;
  const taxable = Math.max(0, annualGross - STANDARD_DEDUCTION);
  const slabs: Array<{ upTo: number; rate: number }> = [
    { upTo: 300000, rate: 0 },
    { upTo: 700000, rate: 0.05 },
    { upTo: 1000000, rate: 0.1 },
    { upTo: 1200000, rate: 0.15 },
    { upTo: 1500000, rate: 0.2 },
    { upTo: Infinity, rate: 0.3 },
  ];
  let tax = 0;
  let prev = 0;
  for (const slab of slabs) {
    if (taxable > prev) {
      const slice = Math.min(taxable, slab.upTo) - prev;
      tax += slice * slab.rate;
      prev = slab.upTo;
    } else break;
  }
  return round2(tax);
}

// ─── Payslip generation ───────────────────────────────────────────────────────

export type NewPayroll = Omit<Payroll, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Generates a Payroll record (one month) for an employee by recomputing
 * the salary breakdown for the given period (YYYY-MM).
 */
export function generatePayslip(employee: Employee, period: string): NewPayroll {
  const breakdown = calculateSalaryBreakdown(employee.salary);
  return {
    employeeId: employee.id,
    period,
    grossSalary: round2(employee.salary),
    basic: breakdown.basic,
    hra: breakdown.hra,
    allowances: breakdown.allowances,
    pf: breakdown.pf,
    esi: breakdown.esi,
    tds: breakdown.tds,
    professionalTax: breakdown.professionalTax,
    netSalary: breakdown.netSalary,
    status: 'generated',
    paidAt: null,
    payslipUrl: null,
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getPayrollStats(employees: Employee[], payrolls: Payroll[]): PayrollSummary {
  let totalGross = 0;
  let totalNet = 0;
  let totalPF = 0;
  let totalESI = 0;
  let totalTDS = 0;
  let totalPT = 0;
  for (const p of payrolls) {
    totalGross += p.grossSalary;
    totalNet += p.netSalary;
    totalPF += p.pf;
    totalESI += p.esi;
    totalTDS += p.tds;
    totalPT += p.professionalTax;
  }
  return {
    totalEmployees: employees.length,
    totalGross: round2(totalGross),
    totalNet: round2(totalNet),
    totalPF: round2(totalPF),
    totalESI: round2(totalESI),
    totalTDS: round2(totalTDS),
    totalPT: round2(totalPT),
  };
}

// ─── Seed placeholders (no-op) ───────────────────────────────────────────────
// Previously these functions emitted 8 fake Indian employees + 1 month of
// payslips. They now return empty arrays so callers fall through to a clean
// empty state. Real employees/payrolls are read from `db.employee.findMany()`
// and `db.payroll.findMany()` by the API routes.

export function seedEmployees(): Employee[] {
  return [];
}

export function seedPayroll(_employees: Employee[]): Payroll[] {
  return [];
}

// ─── helpers ───────────────────────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
