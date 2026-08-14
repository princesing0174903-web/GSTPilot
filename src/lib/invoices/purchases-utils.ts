// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real Invoice Engine™ — Purchase Bill Cloud™ (Prisma-free utils)
// ═══════════════════════════════════════════════════════════════════════════════
// Pure utility functions extracted out of `./purchases` so client components
// (InvoiceCloudPage) can render UI without dragging Prisma into their bundle.
// The Prisma-backed queries (getPurchaseBills, createPurchaseBill,
// payPurchaseBill) live in `./purchases` (server-only) and re-export the pure
// functions from here.
//
// ZERO imports from `@/lib/db` or `@prisma/client`. Pure TypeScript only.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PurchaseBill } from './types';

// ─── Numbering ─────────────────────────────────────────────────────────────────

/**
 * Generates the next purchase bill number in the "PB-YYYY-NNN" sequence by
 * parsing the highest existing numeric suffix and incrementing it.
 */
export function generatePurchaseBillNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const fyPrefix = `PB-${year}-`;
  let maxSeq = 0;
  for (const num of existing) {
    if (!num || !num.startsWith(fyPrefix)) continue;
    const tail = num.slice(fyPrefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  const next = maxSeq + 1;
  return `${fyPrefix}${String(next).padStart(3, '0')}`;
}

// ─── Totals ────────────────────────────────────────────────────────────────────

export interface PurchaseTotals {
  cgst: number;
  sgst: number;
  igst: number;
  gstAmount: number;
  totalAmount: number;
}

export function calculatePurchaseTotals(
  taxableValue: number,
  cgstRate: number,
  sgstRate: number,
  igstRate: number,
): PurchaseTotals {
  const cgst = round2((taxableValue * cgstRate) / 100);
  const sgst = round2((taxableValue * sgstRate) / 100);
  const igst = round2((taxableValue * igstRate) / 100);
  const gstAmount = round2(cgst + sgst + igst);
  return {
    cgst,
    sgst,
    igst,
    gstAmount,
    totalAmount: round2(taxableValue + gstAmount),
  };
}

// ─── GSTR-2B matching ─────────────────────────────────────────────────────────

export interface Gstr2bEntry {
  gstin: string;
  invoiceNo: string;
  amount: number;
}

export interface Gstr2bMatchResult {
  matched: boolean;
  matchScore: number;
  mismatch?: string;
}

/**
 * Matches a purchase bill against GSTR-2B entries fetched from the GST portal.
 * Scoring: gstin match (+40), invoice number match (+30, case-insensitive),
 * amount match within ₹1 (+30). A score ≥ 90 is considered matched.
 */
export function matchWithGstr2b(bill: PurchaseBill, gstr2bEntries: Gstr2bEntry[]): Gstr2bMatchResult {
  let best: Gstr2bMatchResult = { matched: false, matchScore: 0 };
  for (const entry of gstr2bEntries) {
    let score = 0;
    const mismatches: string[] = [];
    if (bill.vendorGstin && entry.gstin && bill.vendorGstin.toUpperCase() === entry.gstin.toUpperCase()) {
      score += 40;
    } else {
      mismatches.push('gstin mismatch');
    }
    if (bill.invoiceNo && entry.invoiceNo && bill.invoiceNo.toUpperCase() === entry.invoiceNo.toUpperCase()) {
      score += 30;
    } else {
      mismatches.push('invoice number mismatch');
    }
    if (Math.abs(bill.totalAmount - entry.amount) <= 1) {
      score += 30;
    } else {
      mismatches.push(`amount differs by ₹${Math.abs(bill.totalAmount - entry.amount).toFixed(2)}`);
    }
    if (score > best.matchScore) {
      best = {
        matched: score >= 90,
        matchScore: score,
        mismatch: score >= 90 ? undefined : mismatches.join('; '),
      };
    }
  }
  return best;
}

// ─── Stats & categorization ───────────────────────────────────────────────────

export interface PurchaseStatsResult {
  total: number;
  paid: number;
  outstanding: number;
  overdue: number;
  matchedCount: number;
}

export function getPurchaseStats(bills: PurchaseBill[]): PurchaseStatsResult {
  let total = 0;
  let paid = 0;
  let outstanding = 0;
  let overdue = 0;
  let matchedCount = 0;
  for (const b of bills) {
    total += b.totalAmount;
    paid += b.paidAmount;
    if (b.status === 'matched') matchedCount += 1;
    if (b.paymentStatus !== 'paid' && b.balanceAmount > 0) {
      outstanding += b.balanceAmount;
      if (b.dueDate && new Date(b.dueDate).getTime() < Date.now()) {
        overdue += b.balanceAmount;
      }
    }
  }
  return {
    total: round2(total),
    paid: round2(paid),
    outstanding: round2(outstanding),
    overdue: round2(overdue),
    matchedCount,
  };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  IT_Software: ['software', 'saas', 'cloud', 'aws', 'azure', 'subscription', 'license'],
  Office: ['stationery', 'office', 'furniture', 'printer', 'consumables'],
  Raw_Materials: ['raw', 'material', 'steel', 'plastic', 'component'],
  Utilities: ['electricity', 'internet', 'telecom', 'water', 'broadband'],
  Logistics: ['logistics', 'courier', 'freight', 'transport', 'shipping'],
  Professional: ['consulting', 'legal', 'audit', 'advisory', 'professional'],
  Marketing: ['adwords', 'facebook', 'advertising', 'marketing', 'agency'],
};

/**
 * Infers a procurement category from vendor name + HSN. Falls back to 'General'.
 */
export function categorizePurchase(bill: PurchaseBill): string {
  const haystack = `${bill.vendorName} ${bill.hsnCode ?? ''} ${bill.notes ?? ''}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => haystack.includes(k))) return cat;
  }
  return 'General';
}

// ─── Seed data: 10 realistic Indian vendor bills ──────────────────────────────

const PURCHASE_SEED: Array<Omit<PurchaseBill, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    clientId: 'seed-client-1',
    vendorName: 'Tata Communications Ltd',
    vendorGstin: '27AAACT1234M1Z5',
    invoiceNo: 'TC-2025-8841',
    invoiceDate: '2025-04-10',
    dueDate: '2025-05-10',
    taxableValue: 145000,
    cgst: 13050,
    sgst: 13050,
    igst: 0,
    cess: 0,
    gstAmount: 26100,
    totalAmount: 171100,
    paidAmount: 171100,
    balanceAmount: 0,
    status: 'paid',
    paymentStatus: 'paid',
    category: 'IT_Software',
    hsnCode: '998314',
    notes: 'Annual MPLS lease',
    ocrExtracted: true,
  },
  {
    clientId: 'seed-client-1',
    vendorName: 'Reliance Jio Infocomm',
    vendorGstin: '27AAACR5055K1Z5',
    invoiceNo: 'RJ-2025-22087',
    invoiceDate: '2025-05-05',
    dueDate: '2025-06-04',
    taxableValue: 38500,
    cgst: 3465,
    sgst: 3465,
    igst: 0,
    cess: 0,
    gstAmount: 6930,
    totalAmount: 45430,
    paidAmount: 45430,
    balanceAmount: 0,
    status: 'paid',
    paymentStatus: 'paid',
    category: 'Utilities',
    hsnCode: '998314',
    notes: 'Office internet leased line',
    ocrExtracted: true,
  },
  {
    clientId: 'seed-client-2',
    vendorName: 'Blue Dart Express Ltd',
    vendorGstin: '33AABCB1111K1Z2',
    invoiceNo: 'BD-2025-99213',
    invoiceDate: '2025-06-18',
    dueDate: '2025-07-18',
    taxableValue: 18750,
    cgst: 0,
    sgst: 0,
    igst: 3375,
    cess: 0,
    gstAmount: 3375,
    totalAmount: 22125,
    paidAmount: 0,
    balanceAmount: 22125,
    status: 'recorded',
    paymentStatus: 'unpaid',
    category: 'Logistics',
    hsnCode: '996511',
    notes: 'Quarterly courier services',
    ocrExtracted: false,
  },
  {
    clientId: 'seed-client-1',
    vendorName: 'Amazon Web Services India',
    vendorGstin: '29AABCA4567P1Z8',
    invoiceNo: 'AWS-2025-554412',
    invoiceDate: '2025-07-01',
    dueDate: '2025-07-31',
    taxableValue: 92000,
    cgst: 0,
    sgst: 0,
    igst: 16560,
    cess: 0,
    gstAmount: 16560,
    totalAmount: 108560,
    paidAmount: 108560,
    balanceAmount: 0,
    status: 'paid',
    paymentStatus: 'paid',
    category: 'IT_Software',
    hsnCode: '998314',
    notes: 'EC2 + S3 monthly consumption',
    ocrExtracted: true,
  },
  {
    clientId: 'seed-client-3',
    vendorName: 'Aditya Birla Fashion Retail',
    vendorGstin: '27AABCA9876N1Z4',
    invoiceNo: 'ABF-2025-33098',
    invoiceDate: '2025-08-12',
    dueDate: '2025-09-11',
    taxableValue: 268000,
    cgst: 24120,
    sgst: 24120,
    igst: 0,
    cess: 0,
    gstAmount: 48240,
    totalAmount: 316240,
    paidAmount: 150000,
    balanceAmount: 166240,
    status: 'partial',
    paymentStatus: 'partial',
    category: 'Raw_Materials',
    hsnCode: '6109',
    notes: 'Branded merchandise stock',
    ocrExtracted: false,
  },
  {
    clientId: 'seed-client-2',
    vendorName: 'Tata Steel Ltd',
    vendorGstin: '27AAACT2727Q1Z6',
    invoiceNo: 'TSL-2025-110234',
    invoiceDate: '2025-09-09',
    dueDate: '2025-10-09',
    taxableValue: 1850000,
    cgst: 0,
    sgst: 0,
    igst: 333000,
    cess: 0,
    gstAmount: 333000,
    totalAmount: 2183000,
    paidAmount: 2183000,
    balanceAmount: 0,
    status: 'paid',
    paymentStatus: 'paid',
    category: 'Raw_Materials',
    hsnCode: '7208',
    notes: 'Steel coils for fabrication',
    ocrExtracted: true,
  },
  {
    clientId: 'seed-client-1',
    vendorName: 'Jyothi Stationers',
    vendorGstin: '29AGMPA1234C1Z3',
    invoiceNo: 'JS-2025-7711',
    invoiceDate: '2025-10-22',
    dueDate: '2025-11-21',
    taxableValue: 12500,
    cgst: 0,
    sgst: 0,
    igst: 2250,
    cess: 0,
    gstAmount: 2250,
    totalAmount: 14750,
    paidAmount: 14750,
    balanceAmount: 0,
    status: 'paid',
    paymentStatus: 'paid',
    category: 'Office',
    hsnCode: '4820',
    notes: 'Quarterly stationery refill',
    ocrExtracted: false,
  },
  {
    clientId: 'seed-client-3',
    vendorName: 'Delhivery Pvt Ltd',
    vendorGstin: '06AABCD5555L1Z9',
    invoiceNo: 'DL-2025-44120',
    invoiceDate: '2025-11-15',
    dueDate: '2025-12-15',
    taxableValue: 56000,
    cgst: 0,
    sgst: 0,
    igst: 10080,
    cess: 0,
    gstAmount: 10080,
    totalAmount: 66080,
    paidAmount: 0,
    balanceAmount: 66080,
    status: 'recorded',
    paymentStatus: 'unpaid',
    category: 'Logistics',
    hsnCode: '996511',
    notes: 'Festive season courier volumes',
    ocrExtracted: true,
  },
  {
    clientId: 'seed-client-2',
    vendorName: 'Tata Power Ltd',
    vendorGstin: '27AAACT0001P1Z1',
    invoiceNo: 'TP-2025-876521',
    invoiceDate: '2025-12-08',
    dueDate: '2025-12-28',
    taxableValue: 78400,
    cgst: 7056,
    sgst: 7056,
    igst: 0,
    cess: 0,
    gstAmount: 14112,
    totalAmount: 92512,
    paidAmount: 92512,
    balanceAmount: 0,
    status: 'paid',
    paymentStatus: 'paid',
    category: 'Utilities',
    hsnCode: '998314',
    notes: 'December electricity bill',
    ocrExtracted: true,
  },
  {
    clientId: 'seed-client-1',
    vendorName: 'Sundaram Legal Associates',
    vendorGstin: '27AALCS5599K1Z7',
    invoiceNo: 'SLA-2026-0042',
    invoiceDate: '2026-01-20',
    dueDate: '2026-02-19',
    taxableValue: 85000,
    cgst: 7650,
    sgst: 7650,
    igst: 0,
    cess: 0,
    gstAmount: 15300,
    totalAmount: 100300,
    paidAmount: 0,
    balanceAmount: 100300,
    status: 'recorded',
    paymentStatus: 'unpaid',
    category: 'Professional',
    hsnCode: '9983',
    notes: 'Annual statutory audit fees',
    ocrExtracted: false,
  },
];

export function seedPurchaseBills(): PurchaseBill[] {
  const nowIso = new Date().toISOString();
  return PURCHASE_SEED.map((row, idx) => ({
    ...row,
    id: `seed-pb-${idx + 1}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
