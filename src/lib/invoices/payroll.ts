// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Payroll Cloud™
// Indian salary breakdown, TDS estimation, payslip generation. Pure TypeScript.
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

// ─── Seed data: 8 Indian employees ────────────────────────────────────────────

interface EmployeeSeedInput {
  name: string;
  designation: string;
  department: string;
  employeeId: string;
  pan: string;
  bankAccount: string;
  ifsc: string;
  salary: number;
  joinedAt: string;
}

const EMPLOYEE_SEED_INPUTS: EmployeeSeedInput[] = [
  {
    name: 'Arjun Sharma',
    designation: 'Senior Accountant',
    department: 'Finance',
    employeeId: 'GST-EMP-001',
    pan: 'ABOPS1234K',
    bankAccount: '12345678901',
    ifsc: 'HDFC0000123',
    salary: 65000,
    joinedAt: '2022-04-01',
  },
  {
    name: 'Meera Iyer',
    designation: 'GST Compliance Manager',
    department: 'Finance',
    employeeId: 'GST-EMP-002',
    pan: 'ABMPI5678L',
    bankAccount: '98765432109',
    ifsc: 'ICIC0000456',
    salary: 95000,
    joinedAt: '2021-07-15',
  },
  {
    name: 'Rahul Verma',
    designation: 'Full Stack Developer',
    department: 'Engineering',
    employeeId: 'GST-EMP-003',
    pan: 'ABPRV9012M',
    bankAccount: '45678901234',
    ifsc: 'SBIN0000789',
    salary: 120000,
    joinedAt: '2023-02-01',
  },
  {
    name: 'Priya Nair',
    designation: 'Engineering Manager',
    department: 'Engineering',
    employeeId: 'GST-EMP-004',
    pan: 'ABPPN3456N',
    bankAccount: '78901234567',
    ifsc: 'AXIS0000123',
    salary: 150000,
    joinedAt: '2020-11-10',
  },
  {
    name: 'Karthik Reddy',
    designation: 'DevOps Engineer',
    department: 'Engineering',
    employeeId: 'GST-EMP-005',
    pan: 'ABPKR7890P',
    bankAccount: '23456789012',
    ifsc: 'KOTK0000456',
    salary: 85000,
    joinedAt: '2023-08-01',
  },
  {
    name: 'Anjali Desai',
    designation: 'HR Executive',
    department: 'People Ops',
    employeeId: 'GST-EMP-006',
    pan: 'ABPAD2345Q',
    bankAccount: '67890123456',
    ifsc: 'HDFC0000789',
    salary: 42000,
    joinedAt: '2024-01-15',
  },
  {
    name: 'Vikram Singh',
    designation: 'Sales Manager',
    department: 'Sales',
    employeeId: 'GST-EMP-007',
    pan: 'ABPVS6789R',
    bankAccount: '34567890123',
    ifsc: 'ICIC0000123',
    salary: 78000,
    joinedAt: '2022-06-20',
  },
  {
    name: 'Sneha Patil',
    designation: 'Junior Accountant',
    department: 'Finance',
    employeeId: 'GST-EMP-008',
    pan: 'ABPSP1357S',
    bankAccount: '90123456789',
    ifsc: 'SBIN0000456',
    salary: 28000,
    joinedAt: '2024-09-01',
  },
];

export function seedEmployees(): Employee[] {
  const nowIso = new Date().toISOString();
  return EMPLOYEE_SEED_INPUTS.map((e, idx) => {
    const breakdown = calculateSalaryBreakdown(e.salary);
    return {
      id: `seed-emp-${idx + 1}`,
      clientId: null,
      name: e.name,
      designation: e.designation,
      department: e.department,
      employeeId: e.employeeId,
      pan: e.pan,
      aadhaar: null,
      bankAccount: e.bankAccount,
      ifsc: e.ifsc,
      salary: round2(e.salary),
      basic: breakdown.basic,
      hra: breakdown.hra,
      allowances: breakdown.allowances,
      pf: breakdown.pf,
      esi: breakdown.esi,
      tds: breakdown.tds,
      professionalTax: breakdown.professionalTax,
      netSalary: breakdown.netSalary,
      status: 'active',
      joinedAt: e.joinedAt,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });
}

// ─── Seed data: 1 month payroll for the seeded employees ──────────────────────

export function seedPayroll(employees: Employee[]): Payroll[] {
  const nowIso = new Date().toISOString();
  const period = '2026-02'; // last completed month relative to seed data spread
  return employees.map((emp, idx) => {
    const breakdown = calculateSalaryBreakdown(emp.salary);
    return {
      id: `seed-payroll-${idx + 1}`,
      employeeId: emp.id,
      period,
      grossSalary: round2(emp.salary),
      basic: breakdown.basic,
      hra: breakdown.hra,
      allowances: breakdown.allowances,
      pf: breakdown.pf,
      esi: breakdown.esi,
      tds: breakdown.tds,
      professionalTax: breakdown.professionalTax,
      netSalary: breakdown.netSalary,
      status: 'paid',
      paidAt: `${period}-28`,
      payslipUrl: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
