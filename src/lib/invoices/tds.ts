// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — TDS Cloud™
// Tax Deducted at Source section detection, calculation, quarterly roll-ups.
// Pure TypeScript.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TDSSummary, TDSRecord, TDSRecordDTO, TDSListResult, TDSBySection } from './types';
import { db } from '@/lib/db';

// ─── Pure utilities (re-exported from tds-utils for client-safe imports) ──────
// These functions are Prisma-free. Client components should import them from
// '@/lib/invoices/tds-utils' to avoid pulling @prisma/client into the bundle.
export {
  TDS_SECTIONS,
  detectSection,
  calculateTDS,
  getTDSStats,
  quarterForDate,
  seedTDSRecords,
  type TDSSectionMeta,
  type TDSCalcResult,
} from './tds-utils';

import { round2 } from './tds-utils';

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
