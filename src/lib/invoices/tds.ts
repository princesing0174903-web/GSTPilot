// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — TDS Cloud™
// Tax Deducted at Source section detection, calculation, quarterly roll-ups.
// Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TDSSummary, TDSRecord, TDSRecordDTO, TDSListResult, TDSBySection } from './types';
import { db } from '@/lib/db';

// ─── TDS section catalog ──────────────────────────────────────────────────────

export interface TDSSectionMeta {
  description: string;
  rate: number; // %
  threshold: number; // single-payment threshold in ₹
}

export const TDS_SECTIONS: Record<string, TDSSectionMeta> = {
  '194C': { description: 'Contractor', rate: 1, threshold: 30000 },
  '194J': { description: 'Professional Fees', rate: 10, threshold: 30000 },
  '194I': { description: 'Rent', rate: 10, threshold: 240000 },
  '194H': { description: 'Commission', rate: 5, threshold: 15000 },
  '94Q': { description: 'Purchase of Goods', rate: 0.1, threshold: 500000 },
};

// ─── Section detection ────────────────────────────────────────────────────────

const SECTION_KEYWORDS: Array<{ section: string; keywords: string[] }> = [
  { section: '194I', keywords: ['rent', 'lease', 'premises', 'property'] },
  { section: '194J', keywords: ['professional', 'consulting', 'consultancy', 'legal', 'audit', 'technical service', 'royalty'] },
  { section: '194C', keywords: ['contractor', 'contract', 'service', 'works', 'civil', 'fabrication', 'labour'] },
  { section: '194H', keywords: ['commission', 'brokerage', 'agency'] },
  { section: '94Q', keywords: ['purchase', 'goods', 'procurement', 'material', 'stock'] },
];

/**
 * Keyword-based detection of the applicable TDS section for a payment nature.
 * Falls back to '194C' (the default contractor section) when no match.
 */
export function detectSection(paymentNature: string): string {
  const haystack = paymentNature.toLowerCase();
  for (const rule of SECTION_KEYWORDS) {
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.section;
  }
  return '194C';
}

// ─── TDS calculation ──────────────────────────────────────────────────────────

export interface TDSCalcResult {
  tdsAmount: number;
  rate: number;
  thresholdApplicable: boolean;
}

/**
 * Calculates TDS for a payment amount under a given section.
 *   - If amount < section.threshold → no TDS, thresholdApplicable = false.
 *   - Otherwise tdsAmount = amount × rate / 100.
 */
export function calculateTDS(amount: number, section: string): TDSCalcResult {
  const meta = TDS_SECTIONS[section];
  if (!meta) {
    return { tdsAmount: 0, rate: 0, thresholdApplicable: false };
  }
  if (amount < meta.threshold) {
    return { tdsAmount: 0, rate: meta.rate, thresholdApplicable: false };
  }
  return {
    tdsAmount: round2((amount * meta.rate) / 100),
    rate: meta.rate,
    thresholdApplicable: true,
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getTDSStats(records: TDSRecord[]): TDSSummary {
  let totalLiability = 0;
  let totalPaid = 0;
  let totalPending = 0;
  const bySection: Record<string, number> = {};
  for (const r of records) {
    totalLiability += r.tdsAmount;
    bySection[r.section] = round2((bySection[r.section] ?? 0) + r.tdsAmount);
    if (r.status === 'paid' || r.status === 'filed') {
      totalPaid += r.tdsAmount;
    } else {
      totalPending += r.tdsAmount;
    }
  }
  return {
    totalLiability: round2(totalLiability),
    totalPaid: round2(totalPaid),
    totalPending: round2(totalPending),
    bySection,
  };
}

// ─── Quarter derivation ───────────────────────────────────────────────────────

/**
 * Returns the Indian financial-year quarter (Q1=Apr-Jun, Q2=Jul-Sep,
 * Q3=Oct-Dec, Q4=Jan-Mar) for an ISO date string.
 */
export function quarterForDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 'Q1';
  const m = d.getMonth() + 1; // 1-12
  if (m >= 4 && m <= 6) return 'Q1';
  if (m >= 7 && m <= 9) return 'Q2';
  if (m >= 10 && m <= 12) return 'Q3';
  return 'Q4';
}

// ─── Seed placeholder (no-op) ─────────────────────────────────────────────────
// Previously this module shipped 8 hardcoded TDS records attributed to fake
// Indian deductees. The export name is preserved so existing callers continue
// to compile, but it now returns `[]` so the UI renders a proper empty state.
// Real TDS records come from `db.tDSRecord.findMany()` via the API routes.

export function seedTDSRecords(): TDSRecord[] {
  return [];
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

// ─── DB-backed list query ──────────────────────────────────────────────────────

/** Fetches TDS records from Prisma and builds the list result. */
export async function getTDSRecords(opts?: { limit?: number }): Promise<TDSListResult> {
  const rows = await db.tDSRecord.findMany({
    take: opts?.limit ?? 500,
    orderBy: { createdAt: 'desc' },
  });
  const records: TDSRecordDTO[] = rows.map((r) => ({
    id: r.id,
    section: r.section,
    natureOfPayment: r.section, // best-effort; TDS_SECTIONS has descriptions
    deducteeName: r.deducteeName,
    deducteePan: r.deducteePan ?? null,
    paymentAmount: r.paymentAmount,
    tdsRate: r.tdsRate,
    tdsAmount: r.tdsAmount,
    date: r.date,
    status: r.status,
    quarter: r.quarter ?? null,
  }));

  const totalPaymentAmount = sum(records.map((r) => r.paymentAmount));
  const totalTDS = sum(records.map((r) => r.tdsAmount));
  const pendingChallanCount = records.filter((r) => r.status === 'deducted').length;
  const pendingReturnCount = records.filter((r) => r.status === 'challan_paid').length;

  const byStatus = {
    deducted: records.filter((r) => r.status === 'deducted').length,
    challan_ready: records.filter((r) => r.status === 'challan_ready').length,
    challan_paid: records.filter((r) => r.status === 'challan_paid').length,
    return_filed: records.filter((r) => r.status === 'return_filed').length,
  };

  // Group by section
  const sectionMap = new Map<string, { natureOfPayment: string; count: number; paymentAmount: number; tdsAmount: number }>();
  for (const r of records) {
    const cur = sectionMap.get(r.section) ?? { natureOfPayment: r.natureOfPayment, count: 0, paymentAmount: 0, tdsAmount: 0 };
    cur.count += 1;
    cur.paymentAmount += r.paymentAmount;
    cur.tdsAmount += r.tdsAmount;
    sectionMap.set(r.section, cur);
  }
  const bySection: TDSBySection[] = Array.from(sectionMap.entries()).map(([section, v]) => ({
    section,
    natureOfPayment: v.natureOfPayment,
    count: v.count,
    paymentAmount: round2(v.paymentAmount),
    tdsAmount: round2(v.tdsAmount),
  }));

  return {
    records,
    total: records.length,
    totalPaymentAmount: round2(totalPaymentAmount),
    totalTDS: round2(totalTDS),
    pendingChallanCount,
    pendingReturnCount,
    byStatus,
    bySection,
    hasLiveData: records.length > 0,
  };
}

// ─── Challan + return preparation (DB-backed) ─────────────────────────────────

export interface PrepareChallanResult {
  challanNo: string;
  count: number;
  totalAmount: number;
  section: string | null;
  challanDate: string;
}

/**
 * Groups all TDS records in the "deducted" state (optionally filtered by
 * section) into a single challan, marks them "challan_ready", and stamps the
 * challan number + date into the `notes` field. Returns the challan summary.
 */
export async function prepareChallan(opts: {
  section?: string;
  challanDate?: string;
}): Promise<PrepareChallanResult> {
  const challanDate = opts.challanDate ?? new Date().toISOString().split('T')[0];
  const challanNo = `CHN-${challanDate.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const where = {
    status: 'deducted',
    ...(opts.section ? { section: opts.section } : {}),
  };
  const rows = await db.tDSRecord.findMany({ where });

  let totalAmount = 0;
  for (const r of rows) {
    totalAmount += r.tdsAmount;
    const marker = `[CHALLAN:${challanNo}:${challanDate}]`;
    const cleaned = (r.notes ?? '').replace(/\[CHALLAN:[^\]]*\]/g, '').trim();
    await db.tDSRecord.update({
      where: { id: r.id },
      data: { status: 'challan_ready', notes: `${marker} ${cleaned}`.trim() },
    });
  }

  return {
    challanNo,
    count: rows.length,
    totalAmount: round2(totalAmount),
    section: opts.section ?? null,
    challanDate,
  };
}

export interface MarkChallanPaidResult {
  challanNo: string;
  updated: number;
  totalAmount: number;
}

/**
 * Marks every TDS record tagged with the given challanNo (via the notes
 * marker written by prepareChallan) as "challan_paid".
 */
export async function markChallanPaid(challanNo: string): Promise<MarkChallanPaidResult> {
  const rows = await db.tDSRecord.findMany({
    where: { status: 'challan_ready', notes: { contains: `[CHALLAN:${challanNo}:` } },
  });

  let totalAmount = 0;
  for (const r of rows) {
    totalAmount += r.tdsAmount;
    await db.tDSRecord.update({
      where: { id: r.id },
      data: { status: 'challan_paid' },
    });
  }

  return { challanNo, updated: rows.length, totalAmount: round2(totalAmount) };
}

export interface PrepareTDSReturnResult {
  returnPeriod: string;
  filed: number;
  totalTDS: number;
  challanNo: string | null;
}

/**
 * Files the TDS return for a period: marks every "challan_paid" record as
 * "return_filed". If challanNo is supplied, only records tagged with that
 * challan are filed.
 */
export async function prepareTDSReturn(opts: {
  returnPeriod: string;
  challanNo?: string;
}): Promise<PrepareTDSReturnResult> {
  const where = challanNo
    ? { status: 'challan_paid', notes: { contains: `[CHALLAN:${opts.challanNo}:` } }
    : { status: 'challan_paid' };
  const rows = await db.tDSRecord.findMany({ where });

  let totalTDS = 0;
  for (const r of rows) {
    totalTDS += r.tdsAmount;
    await db.tDSRecord.update({
      where: { id: r.id },
      data: { status: 'return_filed', quarter: opts.returnPeriod },
    });
  }

  return {
    returnPeriod: opts.returnPeriod,
    filed: rows.length,
    totalTDS: round2(totalTDS),
    challanNo: opts.challanNo ?? null,
  };
}
