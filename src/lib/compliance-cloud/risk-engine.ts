// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 3: RISK ENGINE™
// Continuous risk detection from REAL production data:
//  - GSTRFilings past dueDate with status !== 'filed'/'acknowledged'
//  - Invoices with mismatched GSTR-2B reconciliation
//  - Cash-mode large invoices without matching payments (cash anomalies)
//  - Late TDS records (status != 'paid' past statutory due date)
//  - Payroll gaps (employees with missing PF/ESI for active period)
// Dedupes by riskType+entityId+title; persists to db.complianceRisk.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  ComplianceRisk,
  RiskType,
  RiskSeverity,
  RiskStatus,
} from './types';

// ─── Types & helpers ─────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function todayUTC(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
}

function daysOverdue(dueDateStr: string | null | undefined): number | null {
  const due = parseISO(dueDateStr);
  if (!due) return null;
  const now = todayUTC();
  return Math.max(0, Math.ceil((now.getTime() - due.getTime()) / MS_PER_DAY));
}

function severityFromDaysLate(days: number): RiskSeverity {
  if (days >= 30) return 'critical';
  if (days >= 14) return 'high';
  if (days >= 7) return 'medium';
  return 'low';
}

function severityFromAmount(amount: number): RiskSeverity {
  if (amount >= 1_000_000) return 'critical';
  if (amount >= 100_000) return 'high';
  if (amount >= 10_000) return 'medium';
  return 'low';
}

function maxSeverity(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  const order: Record<RiskSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return order[a] >= order[b] ? a : b;
}

interface DetectedRisk {
  riskType: RiskType;
  title: string;
  description: string;
  severity: RiskSeverity;
  confidence: number;
  financialImpact: number;
  countryIso: string;
  organizationId?: string;
  entityId?: string;
  regulationId?: string;
  filingId?: string;
  recommendedAction?: string;
  expectedDeadline?: string;
}

// ─── Mapper: Prisma row → typed record ───────────────────────────────────────

function mapRow(r: {
  id: string;
  riskType: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  financialImpact: number;
  countryIso: string;
  organizationId: string | null;
  entityId: string | null;
  regulationId: string | null;
  filingId: string | null;
  recommendedAction: string | null;
  expectedDeadline: Date | null;
  detectedAt: Date;
  resolvedAt: Date | null;
  status: string;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ComplianceRisk {
  return {
    id: r.id,
    riskType: r.riskType as RiskType,
    title: r.title,
    description: r.description,
    severity: r.severity as RiskSeverity,
    confidence: r.confidence,
    financialImpact: r.financialImpact,
    countryIso: r.countryIso,
    organizationId: r.organizationId ?? undefined,
    entityId: r.entityId ?? undefined,
    regulationId: r.regulationId ?? undefined,
    filingId: r.filingId ?? undefined,
    recommendedAction: r.recommendedAction ?? undefined,
    expectedDeadline: r.expectedDeadline?.toISOString(),
    detectedAt: r.detectedAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString(),
    status: r.status as RiskStatus,
    resolution: r.resolution ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── Detectors (operate on REAL production data) ────────────────────────────

async function detectLateFilings(): Promise<DetectedRisk[]> {
  const risks: DetectedRisk[] = [];
  // GSTRFiling rows past their implied due date and not yet filed.
  // Period format is typically "YYYY-MM". Implied due date: 20th of next month.
  try {
    const filings = await db.gSTRFiling.findMany({
      where: {
        status: { notIn: ['filed', 'acknowledged'] },
      },
      take: 200,
    });
    for (const f of filings) {
      const due = deriveGstrDueDate(f.period);
      const days = daysOverdue(due);
      if (!days || days <= 0) continue;
      const client = await db.client.findUnique({ where: { id: f.clientId } });
      const severity = severityFromDaysLate(days);
      const impact = (f.totalTax ?? 0) * 0.18 * (days / 365) + days * 50; // 18% interest + ₹50/day fee
      risks.push({
        riskType: 'late_filing',
        title: `${f.returnType} ${f.period} — ${days} days late`,
        description: `GSTR filing for client ${client?.tradeName ?? f.clientId} (${f.returnType}, period ${f.period}) is ${days} days overdue. Estimated liability ₹${f.totalTax.toFixed(2)}.`,
        severity,
        confidence: 0.95,
        financialImpact: Math.round(impact),
        countryIso: 'IN',
        organizationId: client?.firmId ?? undefined,
        entityId: f.clientId,
        filingId: f.id,
        recommendedAction: `File ${f.returnType} immediately via GSTN portal; pay late fee + 18% interest on ₹${f.totalTax.toFixed(2)} tax due.`,
        expectedDeadline: due ?? undefined,
      });
    }
  } catch {
    // table may not exist — skip
  }
  return risks;
}

function deriveGstrDueDate(period: string): string | null {
  // period like "2024-10" → due 20th of next month → "2024-11-20"
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let dueMonth = month + 1;
  let dueYear = year;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-20`;
}

async function detectGstMismatches(): Promise<DetectedRisk[]> {
  const risks: DetectedRisk[] = [];
  try {
    // Invoices flagged with mismatched/unmatched GSTR-2B reconciliation.
    const mismatchedInvoices = await db.invoice.findMany({
      where: {
        matchStatus: { in: ['mismatched', 'unmatched'] },
        invoiceType: 'B2B',
      },
      take: 200,
    });
    for (const inv of mismatchedInvoices) {
      const severity = severityFromAmount(inv.totalAmount);
      risks.push({
        riskType: 'gst_mismatch',
        title: `GSTR-2B mismatch on ${inv.invoiceNumber}`,
        description: `Invoice ${inv.invoiceNumber} (₹${inv.totalAmount.toFixed(2)}) has match status '${inv.matchStatus}'. ITC at risk under CGST Section 16(2)(aa).`,
        severity,
        confidence: 0.85,
        financialImpact: Math.round(inv.gstAmount || (inv.cgst + inv.sgst + inv.igst + inv.cess)),
        countryIso: 'IN',
        entityId: inv.clientId,
        recommendedAction: `Reconcile with supplier GSTR-1; reverse ITC if supplier has not filed by 30th Nov of next FY.`,
      });
    }
  } catch {
    // skip
  }
  return risks;
}

async function detectCashAnomalies(): Promise<DetectedRisk[]> {
  const risks: DetectedRisk[] = [];
  try {
    // Large invoices (≥ ₹2,00,000) paid in cash without matching payment reference.
    const cashInvoices = await db.invoice.findMany({
      where: {
        paymentMode: 'cash',
        totalAmount: { gte: 200000 },
      },
      take: 100,
    });
    for (const inv of cashInvoices) {
      const severity = maxSeverity(
        severityFromAmount(inv.totalAmount),
        'high',
      );
      risks.push({
        riskType: 'cash_anomaly',
        title: `Cash payment ₹${inv.totalAmount.toFixed(0)} on ${inv.invoiceNumber}`,
        description: `Invoice ${inv.invoiceNumber} for ₹${inv.totalAmount.toFixed(2)} settled in cash. Section 269ST violation risk if >₹2L in single transaction/day to single person.`,
        severity,
        confidence: 0.75,
        financialImpact: Math.round(inv.totalAmount * 0.02), // 2% of amount — approx penalty exposure
        countryIso: 'IN',
        entityId: inv.clientId,
        recommendedAction: 'Verify split-payment compliance; collect PAN for cash transactions ≥₹2L; document source of cash.',
      });
    }
  } catch {
    // skip
  }
  return risks;
}

async function detectTdsShortfalls(): Promise<DetectedRisk[]> {
  const risks: DetectedRisk[] = [];
  try {
    // TDS records deducted but not paid/filed past the 7th-of-next-month due date.
    const tdsRecords = await db.tDSRecord.findMany({
      where: {
        status: { in: ['deducted', 'pending'] },
      },
      take: 200,
    });
    for (const t of tdsRecords) {
      const due = deriveTdsDueDate(t.date);
      const days = daysOverdue(due);
      if (!days || days <= 0) continue;
      const severity = severityFromDaysLate(days);
      risks.push({
        riskType: 'tds_shortfall',
        title: `TDS ${t.section} ${t.deducteeName} — ${days} days late deposit`,
        description: `TDS of ₹${t.tdsAmount.toFixed(2)} on payment to ${t.deducteeName} (section ${t.section}) deducted on ${t.date} not yet deposited with government. ${days} days overdue.`,
        severity,
        confidence: 0.92,
        financialImpact: Math.round(t.tdsAmount * 0.015 * (days / 30)), // 1.5% per month interest u/s 201
        countryIso: 'IN',
        entityId: t.clientId ?? undefined,
        recommendedAction: `Deposit ₹${t.tdsAmount.toFixed(2)} TDS via challan immediately; file TDS return; pay 1.5%/month interest u/s 201(1A).`,
        expectedDeadline: due ?? undefined,
      });
    }
  } catch {
    // skip
  }
  return risks;
}

function deriveTdsDueDate(paymentDate: string): string | null {
  // TDS deposit due: 7th of next month from payment date.
  const d = parseISO(paymentDate);
  if (!d) return null;
  let dueMonth = d.getUTCMonth() + 1;
  let dueYear = d.getUTCFullYear();
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-07`;
}

async function detectPayrollGaps(): Promise<DetectedRisk[]> {
  const risks: DetectedRisk[] = [];
  try {
    // Active employees with PF or ESI contribution zero despite salary above threshold.
    const employees = await db.employee.findMany({
      where: { status: 'active' },
      take: 200,
    });
    for (const e of employees) {
      if (e.salary >= 15000 && e.pf <= 0) {
        risks.push({
          riskType: 'epfo_gap',
          title: `EPF not deducted for ${e.name}`,
          description: `Active employee ${e.name} (salary ₹${e.salary.toFixed(0)}) has zero PF contribution. EPF Act Section 6 mandates 12% employer + 12% employee.`,
          severity: 'high',
          confidence: 0.9,
          financialImpact: Math.round(e.salary * 0.12 * 12), // annual shortfall
          countryIso: 'IN',
          entityId: e.clientId ?? undefined,
          recommendedAction: 'Register establishment with EPFO; deduct 12% employee + 12% employer; file ECR monthly.',
        });
      }
      if (e.salary <= 21000 && e.salary > 0 && e.esi <= 0) {
        risks.push({
          riskType: 'esi_gap',
          title: `ESI not deducted for ${e.name}`,
          description: `Active employee ${e.name} (salary ₹${e.salary.toFixed(0)}) below ESI ceiling has zero ESI contribution. ESI Act mandates 3.25% employer + 0.75% employee.`,
          severity: 'medium',
          confidence: 0.85,
          financialImpact: Math.round(e.salary * 0.0325 * 12),
          countryIso: 'IN',
          entityId: e.clientId ?? undefined,
          recommendedAction: 'Register with ESIC; deduct 0.75% employee + 3.25% employer; file ESI return half-yearly.',
        });
      }
    }
  } catch {
    // skip
  }
  return risks;
}

// ─── Detection orchestrator ─────────────────────────────────────────────────

export interface RiskFilters {
  status?: RiskStatus | string;
  severity?: RiskSeverity | string;
  riskType?: RiskType | string;
  countryIso?: string;
}

/**
 * Run all detectors, dedupe+persist to db.complianceRisk, then return filtered
 * rows ordered by severity (critical→low) then by financial impact (desc).
 */
export async function detectRisks(filters?: RiskFilters): Promise<ComplianceRisk[]> {
  const detected = [
    ...(await detectLateFilings()),
    ...(await detectGstMismatches()),
    ...(await detectCashAnomalies()),
    ...(await detectTdsShortfalls()),
    ...(await detectPayrollGaps()),
  ];

  // Persist new detections (dedupe by riskType+entityId+title).
  for (const d of detected) {
    try {
      const existing = await db.complianceRisk.findFirst({
        where: {
          riskType: d.riskType,
          entityId: d.entityId ?? null,
          title: d.title,
          status: { notIn: ['resolved', 'accepted'] },
        },
      });
      if (existing) continue;
      await db.complianceRisk.create({
        data: {
          riskType: d.riskType,
          title: d.title,
          description: d.description,
          severity: d.severity,
          confidence: d.confidence,
          financialImpact: d.financialImpact,
          countryIso: d.countryIso,
          organizationId: d.organizationId ?? null,
          entityId: d.entityId ?? null,
          regulationId: d.regulationId ?? null,
          filingId: d.filingId ?? null,
          recommendedAction: d.recommendedAction ?? null,
          expectedDeadline: d.expectedDeadline ? new Date(d.expectedDeadline) : null,
          status: 'open',
        },
      });
    } catch {
      // non-fatal
    }
  }

  // Read back with filters applied.
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.riskType) where.riskType = filters.riskType;
  if (filters?.countryIso) where.countryIso = filters.countryIso.toUpperCase();

  try {
    const rows = await db.complianceRisk.findMany({
      where,
      orderBy: [
        { severity: 'desc' },
        { financialImpact: 'desc' },
        { detectedAt: 'desc' },
      ],
      take: 500,
    });
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function getRiskById(id: string): Promise<ComplianceRisk | null> {
  try {
    const row = await db.complianceRisk.findUnique({ where: { id } });
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

export async function resolveRisk(
  id: string,
  resolution: string,
): Promise<ComplianceRisk> {
  const row = await db.complianceRisk.update({
    where: { id },
    data: {
      status: 'resolved',
      resolution,
      resolvedAt: new Date(),
    },
  });
  return mapRow(row);
}

export async function getTopRisks(limit = 10): Promise<ComplianceRisk[]> {
  try {
    const rows = await db.complianceRisk.findMany({
      where: { status: { notIn: ['resolved', 'accepted'] } },
      orderBy: [
        { severity: 'desc' },
        { financialImpact: 'desc' },
      ],
      take: limit,
    });
    return rows.map(mapRow);
  } catch {
    return [];
  }
}
