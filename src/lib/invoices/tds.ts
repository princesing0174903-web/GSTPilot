// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — TDS Cloud™
// Tax Deducted at Source section detection, calculation, quarterly roll-ups.
// Pure TypeScript.
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

// ─── Seed data: 8 mock TDS records ────────────────────────────────────────────

const TDS_SEED: Array<Omit<TDSRecord, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    clientId: 'seed-client-1',
    section: '194J',
    deducteeName: 'Sundaram Legal Associates',
    deducteePan: 'AALCS5599K',
    paymentAmount: 85000,
    tdsRate: 10,
    tdsAmount: 8500,
    date: '2026-01-20',
    status: 'deducted',
    quarter: 'Q3',
    notes: 'Statutory audit fees — TDS deducted at source',
  },
  {
    clientId: 'seed-client-2',
    section: '194C',
    deducteeName: 'Sharma Civil Contractors',
    deducteePan: 'AABCS1234D',
    paymentAmount: 145000,
    tdsRate: 1,
    tdsAmount: 1450,
    date: '2025-09-12',
    status: 'paid',
    quarter: 'Q2',
    notes: 'Office renovation contract — 2nd installment',
  },
  {
    clientId: 'seed-client-1',
    section: '194I',
    deducteeName: 'Powai Realty LLP',
    deducteePan: 'AABCP9876L',
    paymentAmount: 1500000,
    tdsRate: 10,
    tdsAmount: 150000,
    date: '2025-04-01',
    status: 'filed',
    quarter: 'Q1',
    notes: 'Annual office rent — TDS deposited quarterly',
  },
  {
    clientId: 'seed-client-3',
    section: '194J',
    deducteeName: 'Mehta Consulting Group',
    deducteePan: 'AABCM4567N',
    paymentAmount: 75000,
    tdsRate: 10,
    tdsAmount: 7500,
    date: '2025-08-15',
    status: 'paid',
    quarter: 'Q2',
    notes: 'Management consulting engagement',
  },
  {
    clientId: 'seed-client-2',
    section: '94Q',
    deducteeName: 'Tata Steel Ltd',
    deducteePan: 'AAACT2727Q',
    paymentAmount: 1850000,
    tdsRate: 0.1,
    tdsAmount: 1850,
    date: '2025-09-30',
    status: 'deducted',
    quarter: 'Q2',
    notes: 'Steel coil procurement — 94Q applicable',
  },
  {
    clientId: 'seed-client-1',
    section: '194H',
    deducteeName: 'Verma Sales Agency',
    deducteePan: 'AABCv7788M',
    paymentAmount: 38000,
    tdsRate: 5,
    tdsAmount: 1900,
    date: '2025-11-08',
    status: 'deducted',
    quarter: 'Q3',
    notes: 'Sales commission for Q3 push',
  },
  {
    clientId: 'seed-client-3',
    section: '194C',
    deducteeName: 'Patel Logistics Services',
    deducteePan: 'AABCP3344R',
    paymentAmount: 62000,
    tdsRate: 1,
    tdsAmount: 620,
    date: '2025-12-05',
    status: 'paid',
    quarter: 'Q3',
    notes: 'Transportation contract',
  },
  {
    clientId: 'seed-client-1',
    section: '194J',
    deducteeName: 'Kapoor IT Advisory',
    deducteePan: 'AABCK9988P',
    paymentAmount: 120000,
    tdsRate: 10,
    tdsAmount: 12000,
    date: '2026-02-14',
    status: 'deducted',
    quarter: 'Q4',
    notes: 'Cybersecurity assessment',
  },
];

export function seedTDSRecords(): TDSRecord[] {
  const nowIso = new Date().toISOString();
  return TDS_SEED.map((row, idx) => ({
    ...row,
    id: `seed-tds-${idx + 1}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
