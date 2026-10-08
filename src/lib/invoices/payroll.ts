// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — Payroll Cloud™
// Indian salary breakdown, TDS estimation, payslip generation. Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Employee, Payroll, PayrollSummary, PayrollListResult, PayrollStatsDTO } from './types';
import { db } from '@/lib/db';
import { currentMonth } from './types';

// ─── Pure utilities (re-exported from payroll-utils for client-safe imports) ──
// These functions are Prisma-free. Client components should import them from
// '@/lib/invoices/payroll-utils' to avoid pulling @prisma/client into the bundle.
export {
  calculateSalaryBreakdown,
  estimateTDS,
  generatePayslip,
  getPayrollStats,
  seedEmployees,
  seedPayroll,
  type SalaryBreakdown,
  type NewPayroll,
} from './payroll-utils';

import { round2 } from './payroll-utils';

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches employees + current-month payroll from Prisma. */
export async function getPayroll(): Promise<PayrollListResult> {
  const month = currentMonth();
  const [employees, payrolls] = await Promise.all([
    db.employee.findMany(),
    db.payroll.findMany({ where: { period: month } }),
  ]);
  const totalGross = sum(payrolls.map((p) => p.grossSalary));
  const totalNet = sum(payrolls.map((p) => p.netSalary));
  const totalPF = sum(payrolls.map((p) => p.pf));
  const totalESI = sum(payrolls.map((p) => p.esi));
  const totalTDS = sum(payrolls.map((p) => p.tds));
  const totalDeductions = round2(totalPF + totalESI + totalTDS + sum(payrolls.map((p) => p.professionalTax)));
  const employerPF = round2(totalPF); // employer match ~12% of basic
  const employerESI = round2(totalESI * (12 / 0.75)); // employer 3.25% vs employee 0.75%
  const totalCost = round2(totalGross + employerPF + employerESI);
  const processed = payrolls.filter((p) => p.status === 'generated' || p.status === 'paid').length;
  const paid = payrolls.filter((p) => p.status === 'paid').length;
  const pending = employees.length - processed;

  const currentMonthPayroll: PayrollStatsDTO = {
    month,
    totalGross: round2(totalGross),
    totalDeductions,
    totalNet: round2(totalNet),
    employerPF,
    employerESI,
    totalCost,
    processed,
    paid,
    pending,
  };

  return {
    currentMonthPayroll,
    totalEmployees: employees.length,
    activeEmployees: employees.filter((e) => e.status === 'active').length,
    hasLiveData: employees.length > 0,
  };
}

// ─── Payroll processing (DB-backed) ────────────────────────────────────────────

export interface ProcessPayrollResult {
  month: string;
  processed: number;
  totalGross: number;
  totalNet: number;
  totalCost: number;
  skipped: number;
}

/**
 * Runs the monthly payroll cycle for all active employees:
 *   1. Resolves the target period (YYYY-MM) — defaults to current month.
 *   2. For each active employee, computes the salary breakdown via
 *      calculateSalaryBreakdown and upserts the Payroll row for that period.
 *   3. Returns aggregate totals (gross, net, employer cost).
 *
 * The `workingDays` and `state` inputs are accepted for API compatibility
 * (pro-rating / professional-tax overrides are handled by the breakdown
 * calculator's standard rules).
 */
export async function processPayroll(opts?: {
  month?: string;
  workingDays?: number;
  state?: string;
}): Promise<ProcessPayrollResult> {
  const month = opts?.month ?? currentMonth();
  const employees = await db.employee.findMany({ where: { status: 'active' } });

  let processed = 0;
  let totalGross = 0;
  let totalNet = 0;
  let totalCost = 0;
  let skipped = 0;

  for (const emp of employees) {
    if (emp.salary <= 0) {
      skipped += 1;
      continue;
    }
    const breakdown = calculateSalaryBreakdown(emp.salary);
    const employerPF = breakdown.pf; // employer match ~12% of basic
    const employerESI = breakdown.esi * (12 / 0.75); // employer 3.25% vs employee 0.75%
    const cost = round2(emp.salary + employerPF + employerESI);

    // Upsert the Payroll row for this employee + period (idempotent re-runs).
    const existing = await db.payroll.findFirst({
      where: { employeeId: emp.id, period: month },
    });
    if (existing) {
      await db.payroll.update({
        where: { id: existing.id },
        data: {
          grossSalary: round2(emp.salary),
          basic: breakdown.basic,
          hra: breakdown.hra,
          allowances: breakdown.allowances,
          pf: breakdown.pf,
          esi: breakdown.esi,
          tds: breakdown.tds,
          professionalTax: breakdown.professionalTax,
          netSalary: breakdown.netSalary,
          status: 'generated',
        },
      });
    } else {
      await db.payroll.create({
        data: {
          employeeId: emp.id,
          period: month,
          grossSalary: round2(emp.salary),
          basic: breakdown.basic,
          hra: breakdown.hra,
          allowances: breakdown.allowances,
          pf: breakdown.pf,
          esi: breakdown.esi,
          tds: breakdown.tds,
          professionalTax: breakdown.professionalTax,
          netSalary: breakdown.netSalary,
          status: 'generated',
        },
      });
    }

    processed += 1;
    totalGross += emp.salary;
    totalNet += breakdown.netSalary;
    totalCost += cost;
  }

  return {
    month,
    processed,
    totalGross: round2(totalGross),
    totalNet: round2(totalNet),
    totalCost: round2(totalCost),
    skipped,
  };
}

// ─── Payroll payment (DB-backed) ──────────────────────────────────────────────

/**
 * Marks a Payroll row as paid (`status: 'paid'`, `paidAt: <ISO timestamp>`)
 * and returns a merged DTO enriched with `employeeName` (resolved via the
 * Employee relation) so callers can read `employeeName` / `netSalary` for
 * messaging without an extra round-trip.
 *
 * Throws Error('Payroll record not found') if the payroll row does not exist.
 */
export async function markPayrollPaid(
  id: string,
): Promise<{
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  grossSalary: number;
  netSalary: number;
  status: string;
  paidAt: string;
  [key: string]: unknown;
}> {
  const existing = await db.payroll.findUnique({ where: { id } });
  if (!existing) throw new Error('Payroll record not found');

  const paidAtIso = new Date().toISOString();
  const updated = await db.payroll.update({
    where: { id },
    data: {
      status: 'paid',
      paidAt: paidAtIso,
    },
  });

  const emp = await db.employee.findUnique({
    where: { id: updated.employeeId },
  });

  return {
    id: updated.id,
    employeeId: updated.employeeId,
    employeeName: emp?.name ?? 'Unknown',
    period: updated.period,
    grossSalary: round2(updated.grossSalary),
    basic: round2(updated.basic),
    hra: round2(updated.hra),
    allowances: round2(updated.allowances),
    pf: round2(updated.pf),
    esi: round2(updated.esi),
    tds: round2(updated.tds),
    professionalTax: round2(updated.professionalTax),
    netSalary: round2(updated.netSalary),
    status: updated.status,
    paidAt: paidAtIso,
  };
}
