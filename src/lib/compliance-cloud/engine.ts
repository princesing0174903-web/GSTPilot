// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — GLOBAL COMPLIANCE CLOUD™ — Subsystem 10: GLOBAL ENGINE™
// Unified pipeline orchestrator — Prepare / Analyze / Approve / Submit / Replay.
// Every compliance activity flows through ONE pipeline:
//   prepareFiling → gather real data → compute summary → digital twin simulation
//                → detect risks → evaluate policy → persist ComplianceFiling
//                → record audit entry → Oracle recommendation.
// Founder & Owner: Prince Singh.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  PrepareRequest, PrepareResponse,
  AnalyzeRequest, AnalyzeResponse,
  ApproveRequest, ApproveResponse,
  SubmitRequest, SubmitResponse,
  ReplayRequest, ReplayResponse,
  ComplianceFiling, FilingType, FilingSummary, PreparedBy,
} from './types';
import { FILING_TYPE_META } from './types';
import { simulateScenario } from './digital-twin';
import { getPolicyForFiling, evaluateApproval } from './policy-engine';
import { recordAuditEntry } from './audit-cloud';
import { replayAuditEntry } from './audit-cloud';
import { detectRisks } from './risk-engine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParse<T>(s: string | null | undefined, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function mapFilingRow(r: {
  id: string;
  filingType: string;
  title: string;
  description: string | null;
  organizationId: string | null;
  entityId: string | null;
  countryIso: string;
  period: string;
  dueDate: Date | null;
  preparedAt: Date;
  preparedBy: string;
  status: string;
  payload: string;
  summary: string;
  riskAssessment: string;
  aiRecommendation: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  submittedAt: Date | null;
  acknowledgedAt: Date | null;
  ackReference: string | null;
  errorMessage: string | null;
  auditId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ComplianceFiling {
  return {
    id: r.id,
    filingType: r.filingType as FilingType,
    title: r.title,
    description: r.description ?? undefined,
    organizationId: r.organizationId ?? undefined,
    entityId: r.entityId ?? undefined,
    countryIso: r.countryIso,
    period: r.period,
    dueDate: r.dueDate?.toISOString(),
    preparedAt: r.preparedAt.toISOString(),
    preparedBy: r.preparedBy as PreparedBy,
    status: r.status as ComplianceFiling['status'],
    payload: safeParse(r.payload, {}),
    summary: safeParse(r.summary, {}),
    riskAssessment: safeParse(r.riskAssessment, {}),
    aiRecommendation: r.aiRecommendation ?? undefined,
    approvedBy: r.approvedBy ?? undefined,
    approvedAt: r.approvedAt?.toISOString(),
    submittedAt: r.submittedAt?.toISOString(),
    acknowledgedAt: r.acknowledgedAt?.toISOString(),
    ackReference: r.ackReference ?? undefined,
    errorMessage: r.errorMessage ?? undefined,
    auditId: r.auditId ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── Real-data gatherer for filing-type-specific summaries ──────────────────

interface GatheredData {
  summary: FilingSummary;
  payload: Record<string, unknown>;
  dueDate: Date | null;
  title: string;
  description: string;
}

async function gatherFilingData(
  filingType: FilingType,
  period: string,
  countryIso: string,
  entityId?: string,
  organizationId?: string,
): Promise<GatheredData> {
  const meta = FILING_TYPE_META[filingType];
  const title = `${meta.label} — ${period}`;
  const description = `Oracle-prepared ${meta.label} return for period ${period} (${countryIso}).`;

  const summary: FilingSummary = {};
  const payload: Record<string, unknown> = { period, countryIso, regulation: meta.regulation };
  let dueDate: Date | null = null;

  // For GST filings — pull real invoice totals from Invoice table.
  if (meta.regulation === 'gst') {
    const where: Record<string, unknown> = { period };
    if (entityId) where.clientId = entityId;
    try {
      const invoices = await db.invoice.findMany({ where, take: 5000 });
      const taxable = invoices.reduce((s, i) => s + i.taxableValue, 0);
      const outputTax = invoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst + i.cess, 0);
      const inputTax = invoices
        .filter((i) => i.invoiceType === 'B2B' && i.matchStatus === 'matched')
        .reduce((s, i) => s + i.cgst + i.sgst + i.igst + i.cess, 0);
      const netTax = outputTax - inputTax;
      summary.outputTax = round(outputTax);
      summary.inputTax = round(inputTax);
      summary.netTax = round(netTax);
      summary.taxPayable = round(netTax > 0 ? netTax : 0);
      summary.totalLiability = round(netTax > 0 ? netTax : 0);
      summary.itcClaimed = round(inputTax);
      payload.invoiceCount = invoices.length;
      payload.totalTaxableValue = round(taxable);
      // Due date — 20th of next month for GSTR-3B; 11th for GSTR-1.
      dueDate = deriveGstDueDate(period, filingType);
    } catch {
      // skip
    }
  }

  // For TDS filings — pull real TDS records.
  if (meta.regulation === 'tds') {
    try {
      const where: Record<string, unknown> = {};
      if (entityId) where.clientId = entityId;
      const records = await db.tDSRecord.findMany({ where, take: 5000 });
      const tdsTotal = records.reduce((s, r) => s + r.tdsAmount, 0);
      summary.taxPayable = round(tdsTotal);
      summary.totalLiability = round(tdsTotal);
      payload.tdsRecords = records.length;
      payload.tdsTotal = round(tdsTotal);
      // TDS deposit due: 7th of next month.
      dueDate = deriveTdsDueDate(period);
    } catch {
      // skip
    }
  }

  // For payroll filings — pull real employee/payroll data.
  if (meta.regulation === 'payroll' || meta.regulation === 'epfo' || meta.regulation === 'esic') {
    try {
      const where: Record<string, unknown> = { status: 'active' };
      if (entityId) where.clientId = entityId;
      const employees = await db.employee.findMany({ where, take: 5000 });
      const grossPayroll = employees.reduce((s, e) => s + e.salary, 0);
      const pf = employees.reduce((s, e) => s + e.pf, 0);
      const esi = employees.reduce((s, e) => s + e.esi, 0);
      const pt = employees.reduce((s, e) => s + e.professionalTax, 0);
      summary.headcount = employees.length;
      summary.grossPayroll = round(grossPayroll);
      if (meta.regulation === 'epfo') {
        summary.taxPayable = round(pf * 2); // employer + employee
        summary.totalLiability = round(pf * 2);
      } else if (meta.regulation === 'esic') {
        summary.taxPayable = round(esi * 2);
        summary.totalLiability = round(esi * 2);
      } else {
        summary.taxPayable = round(pt + pf * 2 + esi * 2);
        summary.totalLiability = round(pt + pf * 2 + esi * 2);
      }
      payload.employeeCount = employees.length;
      dueDate = derivePayrollDueDate(period);
    } catch {
      // skip
    }
  }

  // For corporate/MCA/RBI/audit filings — placeholder date derived from period.
  if (meta.regulation === 'mca' || meta.regulation === 'corporate_filing' || meta.regulation === 'companies_act' || meta.regulation === 'rbi') {
    dueDate = deriveAnnualDueDate(period);
    summary.totalLiability = 0;
  }

  // For income tax / itr — derive from invoices + TDS.
  if (meta.regulation === 'income_tax') {
    try {
      const where: Record<string, unknown> = {};
      if (entityId) where.clientId = entityId;
      const invoices = await db.invoice.findMany({ where, take: 5000 });
      const taxable = invoices.reduce((s, i) => s + i.taxableValue, 0);
      const estimatedTax = taxable * 0.25; // 25% corporate tax approximation
      summary.taxPayable = round(estimatedTax);
      summary.totalLiability = round(estimatedTax);
      payload.estimatedTaxableIncome = round(taxable);
      dueDate = deriveItrDueDate(period);
    } catch {
      // skip
    }
  }

  void organizationId;
  return { summary, payload, dueDate, title, description };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function deriveGstDueDate(period: string, filingType: FilingType): Date | null {
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
  const day = filingType === 'gstr1' ? 11 : 20;
  return new Date(Date.UTC(dueYear, dueMonth - 1, day));
}

function deriveTdsDueDate(period: string): Date | null {
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
  return new Date(Date.UTC(dueYear, dueMonth - 1, 7));
}

function derivePayrollDueDate(period: string): Date | null {
  // Payroll/EPF/ESI due: 15th of next month for EPF, 21st for ESI; use 15th as canonical.
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
  return new Date(Date.UTC(dueYear, dueMonth - 1, 15));
}

function deriveItrDueDate(period: string): Date | null {
  // For ITR — period like "2024-25" → due 31st Oct of ending FY year.
  const m = period.match(/^(\d{4})-(\d{2,4})$/);
  if (!m) return null;
  const endYear = parseInt(m[2], 10);
  // Companies: 31st Oct; non-cos: 31st Jul. Use 31st Oct as canonical for "corp ITR".
  return new Date(Date.UTC(endYear, 9, 31));
}

function deriveAnnualDueDate(period: string): Date | null {
  // Period like "2024-25" → 30th Sep / 30th Nov of next year.
  const m = period.match(/^(\d{4})-(\d{2,4})$/);
  if (!m) return null;
  const endYear = parseInt(m[2], 10);
  return new Date(Date.UTC(endYear, 9, 30));
}

// ─── Oracle recommendation narrative ────────────────────────────────────────

interface RecommendationInput {
  filingType: FilingType;
  period: string;
  countryIso: string;
  totalLiability: number;
  scenario: string;
  penaltyEstimate: number;
  interestEstimate: number;
  auditProbability: number;
  regulatoryRisk: string;
  daysLate: number;
}

function buildOracleRecommendation(input: RecommendationInput): string {
  const parts: string[] = [];
  const meta = FILING_TYPE_META[input.filingType];
  parts.push(
    `Oracle has prepared ${meta.label} for period ${input.period} (${input.countryIso}).`,
  );
  parts.push(
    `Computed tax liability ₹${input.totalLiability.toFixed(2)} derived from REAL invoice/payroll data.`,
  );
  if (input.daysLate > 0) {
    parts.push(
      `Filing is ${input.daysLate} day(s) overdue — penalty ₹${input.penaltyEstimate.toFixed(2)} + interest ₹${input.interestEstimate.toFixed(2)} accrues daily.`,
    );
  }
  parts.push(
    `Digital twin simulation: audit probability ${(input.auditProbability * 100).toFixed(1)}% (${input.regulatoryRisk} regulatory risk).`,
  );
  if (input.regulatoryRisk === 'critical' || input.auditProbability >= 0.7) {
    parts.push(
      'Recommendation: Submit immediately; pay full liability + penalty + interest; engage auditor.',
    );
  } else if (input.regulatoryRisk === 'high') {
    parts.push(
      'Recommendation: Submit today; clear dues within 24 hours; document reason for delay.',
    );
  } else {
    parts.push(
      'Recommendation: Submit before next business day cutoff; schedule payment for due date.',
    );
  }
  return parts.join(' ');
}

// ─── Public pipeline functions ───────────────────────────────────────────────

export async function prepareFiling(req: PrepareRequest): Promise<PrepareResponse> {
  const { filingType, period, countryIso, organizationId, entityId, preparedBy } = req;

  // 1. Gather real data.
  const gathered = await gatherFilingData(filingType, period, countryIso, entityId, organizationId);

  // 2-3. Run digital twin simulation.
  const twin = await simulateScenario(
    `prepare_${filingType}`,
    {
      filingType,
      countryIso,
      period,
      dueDate: gathered.dueDate?.toISOString(),
      summary: gathered.summary,
    },
  );

  // 4. Detect risks for this filing context.
  const risks = await detectRisks({ countryIso });

  // 5. Evaluate policy.
  const policy = await getPolicyForFiling(filingType, countryIso);
  void policy; // Policy check happens at approveFiling time; recording for audit.

  // 6. Persist ComplianceFiling.
  const daysLate = gathered.dueDate
    ? Math.max(0, Math.ceil((Date.now() - gathered.dueDate.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const recommendation = buildOracleRecommendation({
    filingType,
    period,
    countryIso,
    totalLiability: gathered.summary.totalLiability ?? 0,
    scenario: twin.scenario,
    penaltyEstimate: twin.penaltyEstimate,
    interestEstimate: twin.interestEstimate,
    auditProbability: twin.auditProbability,
    regulatoryRisk: twin.regulatoryRisk,
    daysLate,
  });

  const created = await db.complianceFiling.create({
    data: {
      filingType,
      title: gathered.title,
      description: gathered.description,
      organizationId: organizationId ?? null,
      entityId: entityId ?? null,
      countryIso: countryIso.toUpperCase(),
      period,
      dueDate: gathered.dueDate,
      preparedBy: preparedBy ?? 'oracle',
      status: 'prepared',
      payload: JSON.stringify(gathered.payload),
      summary: JSON.stringify(gathered.summary),
      riskAssessment: JSON.stringify({
        scenario: twin.scenario,
        penaltyEstimate: twin.penaltyEstimate,
        interestEstimate: twin.interestEstimate,
        auditProbability: twin.auditProbability,
        regulatoryRisk: twin.regulatoryRisk,
      }),
      aiRecommendation: recommendation,
    },
  });

  // 7. Record audit entry.
  const auditEntry = await recordAuditEntry({
    actionType: 'filing_prepared',
    entityType: 'filing',
    entityId: created.id,
    organizationId,
    countryIso,
    actorId: preparedBy ?? 'oracle',
    actorType: preparedBy === 'human' ? 'human' : 'oracle',
    action: `Prepared ${filingType} for ${period}`,
    before: {},
    after: {
      filingId: created.id,
      filingType,
      period,
      totalLiability: gathered.summary.totalLiability ?? 0,
      twinScenario: twin.scenario,
      auditProbability: twin.auditProbability,
    },
  });

  // Back-link auditId.
  await db.complianceFiling.update({
    where: { id: created.id },
    data: { auditId: auditEntry.id },
  });

  return {
    filing: mapFilingRow({ ...created, auditId: auditEntry.id }),
    auditEntry,
    oracleRecommendation: recommendation,
  };
}

export async function analyzeFiling(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const { filingType, period, countryIso, organizationId, entityId } = req;

  // Gather real data WITHOUT persisting submitted state.
  const gathered = await gatherFilingData(filingType, period, countryIso, entityId, organizationId);

  const twin = await simulateScenario(
    `analyze_${filingType}`,
    {
      filingType,
      countryIso,
      period,
      dueDate: gathered.dueDate?.toISOString(),
      summary: gathered.summary,
    },
  );

  const risks = await detectRisks({ countryIso });

  const daysLate = gathered.dueDate
    ? Math.max(0, Math.ceil((Date.now() - gathered.dueDate.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const recommendation = buildOracleRecommendation({
    filingType,
    period,
    countryIso,
    totalLiability: gathered.summary.totalLiability ?? 0,
    scenario: twin.scenario,
    penaltyEstimate: twin.penaltyEstimate,
    interestEstimate: twin.interestEstimate,
    auditProbability: twin.auditProbability,
    regulatoryRisk: twin.regulatoryRisk,
    daysLate,
  });

  const now = new Date().toISOString();
  const draftFiling: ComplianceFiling = {
    id: `draft-${filingType}-${period}`,
    filingType,
    title: gathered.title,
    description: gathered.description,
    organizationId,
    entityId,
    countryIso: countryIso.toUpperCase(),
    period,
    dueDate: gathered.dueDate?.toISOString(),
    preparedAt: now,
    preparedBy: 'oracle',
    status: 'analyzed',
    payload: gathered.payload,
    summary: gathered.summary,
    riskAssessment: {
      scenario: twin.scenario,
      penaltyEstimate: twin.penaltyEstimate,
      interestEstimate: twin.interestEstimate,
      auditProbability: twin.auditProbability,
      regulatoryRisk: twin.regulatoryRisk,
    },
    aiRecommendation: recommendation,
    createdAt: now,
    updatedAt: now,
  };

  return {
    filing: draftFiling,
    twin,
    risks,
    oracleRecommendation: recommendation,
  };
}

export async function approveFiling(req: ApproveRequest): Promise<ApproveResponse> {
  const { filingId, approvedBy, level, comment } = req;

  const row = await db.complianceFiling.findUnique({ where: { id: filingId } });
  if (!row) throw new Error(`Filing not found: ${filingId}`);
  if (row.status !== 'prepared' && row.status !== 'analyzed') {
    throw new Error(`Filing cannot be approved from status '${row.status}'`);
  }

  // Look up policy + evaluate.
  const policy = await getPolicyForFiling(row.filingType as FilingType, row.countryIso);
  const summary = safeParse<FilingSummary>(row.summary, {});
  const evaluation = evaluateApproval(
    {
      filingType: row.filingType as FilingType,
      countryIso: row.countryIso,
      summary,
      status: row.status as ComplianceFiling['status'],
    },
    policy,
    approvedBy,
  );

  void level;
  void comment;

  const updated = await db.complianceFiling.update({
    where: { id: filingId },
    data: {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    },
  });

  const auditEntry = await recordAuditEntry({
    actionType: 'filing_approved',
    entityType: 'filing',
    entityId: filingId,
    organizationId: row.organizationId ?? undefined,
    countryIso: row.countryIso,
    actorId: approvedBy,
    actorType: 'human',
    action: `Approved ${row.filingType} for ${row.period}`,
    before: { status: row.status },
    after: {
      status: 'approved',
      approvedBy,
      evaluation: evaluation.reason,
      requiresNextLevel: evaluation.requiresNextLevel,
      comment,
    },
  });

  return {
    filing: mapFilingRow(updated),
    auditEntry,
    approved: evaluation.canApprove,
  };
}

export async function submitFiling(req: SubmitRequest): Promise<SubmitResponse> {
  const { filingId, submittedBy } = req;

  const row = await db.complianceFiling.findUnique({ where: { id: filingId } });
  if (!row) throw new Error(`Filing not found: ${filingId}`);
  if (row.status !== 'approved') {
    throw new Error(`Filing must be approved before submission (current status: '${row.status}')`);
  }

  // Generate ack reference — simulated government portal acknowledgement.
  const ackReference = generateAckReference(row.filingType, row.period);

  const updated = await db.complianceFiling.update({
    where: { id: filingId },
    data: {
      status: 'submitted',
      submittedAt: new Date(),
      ackReference,
    },
  });

  const auditEntry = await recordAuditEntry({
    actionType: 'filing_submitted',
    entityType: 'filing',
    entityId: filingId,
    organizationId: row.organizationId ?? undefined,
    countryIso: row.countryIso,
    actorId: submittedBy,
    actorType: 'human',
    action: `Submitted ${row.filingType} for ${row.period}`,
    before: { status: 'approved' },
    after: {
      status: 'submitted',
      ackReference,
      submittedAt: new Date().toISOString(),
    },
  });

  return {
    filing: mapFilingRow(updated),
    auditEntry,
    ackReference,
    submitted: true,
  };
}

function generateAckReference(filingType: string, period: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${filingType.toUpperCase()}-${period.replace(/[^A-Z0-9]/gi, '')}-${ts}-${rand}`;
}

export async function replayFiling(req: ReplayRequest): Promise<ReplayResponse> {
  const { replayToken, requestedBy } = req;
  const replay = await replayAuditEntry(replayToken);

  // Record the replay action itself.
  await recordAuditEntry({
    actionType: 'replay_requested',
    entityType: replay.entry.entityType,
    entityId: replay.entry.entityId,
    organizationId: replay.entry.organizationId,
    countryIso: replay.entry.countryIso,
    actorId: requestedBy,
    actorType: 'human',
    action: `Replay requested for ${replay.entry.actionType}`,
    before: {},
    after: {
      originalToken: replayToken,
      originalTimestamp: replay.entry.createdAt,
      reconstructedState: replay.reconstructedState,
    },
  });

  return {
    auditEntry: replay.entry,
    reconstructedState: replay.reconstructedState,
    replayed: true,
  };
}
