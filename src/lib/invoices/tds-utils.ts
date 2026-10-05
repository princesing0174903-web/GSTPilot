// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — TDS Utilities (Prisma-free, client-safe)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure utility functions extracted from tds.ts so client components can
// import them WITHOUT pulling @prisma/client into the browser bundle.
// The original tds.ts re-exports these for backward compatibility.
// ═══════════════════════════════════════════════════════════════════════════════

import type { TDSSummary, TDSRecord } from './types';

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

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
