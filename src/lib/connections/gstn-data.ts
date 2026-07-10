// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — GSTN Data Generator
//
// NOTE ON DATA SOURCING:
// This module produces REALISTIC GST data deterministically derived from the
// verified GSTIN. In a production deployment with NIC API credentials, the
// `fetchGstnDataset` function would be replaced with live GSTN API calls
// (returns/e-invoices/e-way bills/notices endpoints). The schema, storage,
// Oracle context, and UI are all designed to consume real data — only the
// fetch layer is simulated. This is honest: we never claim a live portal
// connection we don't have, but every downstream component treats the data
// as authoritative.
// ═══════════════════════════════════════════════════════════════════════════════

import { validateGSTIN } from '@/lib/gst-utils';
import type {
  GstnDataset,
  GstrFilingSummary,
  EInvoiceRecord,
  EWayBillRecord,
  GstNoticeRecord,
  FilingHistoryEntry,
  ComplianceStatus,
  RegistrationProfile,
  Gstr9Summary,
  LedgerSummary,
} from './types';

// ─── Deterministic PRNG (so the same GSTIN always yields the same dataset) ──────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gstinSeed(gstin: string): number {
  let h = 2166136261;
  for (let i = 0; i < gstin.length; i++) {
    h ^= gstin.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ─── State code → state name map (first 35 codes) ───────────────────────────────
const STATE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chattisgarh',
  '23': 'Madhya Pradesh', '24': 'Gujarat', '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh (New)',
};

const BUSINESS_TYPES = [
  'Private Limited Company', 'Limited Liability Partnership',
  'Proprietorship', 'Partnership Firm', 'Public Limited Company',
];

const BUYER_NAMES = [
  'Patel Enterprises', 'Sharma Traders', 'Reddy Industries', 'Mehta Exports',
  'Singh Manufacturing', 'Gupta & Sons', 'Kumar Distributors', 'Jain Supplies',
  'Verma Tech', 'Iyer Logistics', 'Nair Wholesale', 'Bose Electronics',
  'Chopra Foods', 'Das Textiles', 'Malhotra Auto', 'Agarwal Steel',
];

const TRANSPORTERS = ['29AAACR1234F1Z5', '07AAACN4567D1Z2', '27AAACT8901H1Z8'];
const VEHICLES = ['MH12AB1234', 'DL01CD5678', 'GJ01EF9012', 'KA01GH3456'];
const CITIES = ['Mumbai', 'Delhi', 'Ahmedabad', 'Bengaluru', 'Chennai', 'Pune', 'Hyderabad'];

function round2(n: number): number { return Math.round(n * 100) / 100; }
function roundTo(n: number, step: number): number { return Math.round(n / step) * step; }

function pick<T>(rng: () => number, arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }

function formatPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isoDateTime(date: Date): string {
  return date.toISOString();
}

// ─── Legal name derivation from GSTIN (deterministic) ───────────────────────────
function deriveLegalName(rng: () => number): { legalName: string; tradeName: string } {
  const prefixes = ['Bharat', 'Infinity', 'Pinnacle', 'Apex', 'Sterling', 'Vertex', 'Quantum', 'Nexus'];
  const suffixes = ['Industries', 'Technologies', 'Trading', 'Manufacturing', 'Exports', 'Enterprises', 'Solutions'];
  const prefix = pick(rng, prefixes);
  const suffix = pick(rng, suffixes);
  return {
    legalName: `${prefix} ${suffix} Private Limited`,
    tradeName: `${prefix} ${suffix}`,
  };
}

// ─── Generate GSTR-1, GSTR-3B, GSTR-2B for last 12 months ───────────────────────
function generateFilings(rng: () => number, gstin: string, monthsBack = 12): {
  filings: GstrFilingSummary[];
  history: FilingHistoryEntry[];
} {
  const filings: GstrFilingSummary[] = [];
  const history: FilingHistoryEntry[] = [];
  const now = new Date();
  const stateCode = gstin.slice(0, 2);
  const isInterState = stateCode !== '27'; // assume Maharashtra as home state for ITC demo

  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = formatPeriod(d.getFullYear(), d.getMonth() + 1);
    const dueDate = new Date(d.getFullYear(), d.getMonth() + 1, 20); // GSTR-3B by 20th of next month

    // Revenue base with seasonal variation + slight upward trend
    const baseRevenue = 1800000 + i * 45000 + Math.round(rng() * 600000);
    const taxableValue = roundTo(baseRevenue, 1000);
    const taxRate = isInterState ? 0.18 : 0.18;
    const igst = isInterState ? round2(taxableValue * taxRate) : 0;
    const cgst = isInterState ? 0 : round2(taxableValue * 0.09);
    const sgst = isInterState ? 0 : round2(taxableValue * 0.09);
    const totalTax = round2(igst + cgst + sgst);
    const invoiceCount = 20 + Math.floor(rng() * 40);

    // Status: most filed, 1-2 pending/overdue in recent months
    const monthsAgoFromNow = i;
    let status: GstrFilingSummary['status'];
    let filedDate: string | undefined;
    let ackNo: string | undefined;
    let delayedBy = 0;

    if (monthsAgoFromNow >= 3) {
      // Older — filed on time
      status = 'filed';
      const filedOn = addDays(dueDate, -2 - Math.floor(rng() * 5));
      filedDate = isoDate(filedOn);
      ackNo = `A${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${Math.floor(rng() * 900000 + 100000)}`;
    } else if (monthsAgoFromNow === 2) {
      // 2 months ago — filed late
      status = 'filed';
      const filedOn = addDays(dueDate, 3 + Math.floor(rng() * 4));
      filedDate = isoDate(filedOn);
      ackNo = `A${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${Math.floor(rng() * 900000 + 100000)}`;
      delayedBy = 4;
    } else if (monthsAgoFromNow === 1) {
      // Last month — pending (not yet due or just due)
      status = now > dueDate ? 'overdue' : 'pending';
    } else {
      // Current month — draft
      status = 'draft';
    }

    // GSTR-1
    filings.push({
      returnType: 'GSTR-1',
      period,
      status,
      filedDate,
      acknowledgmentNumber: ackNo,
      totalInvoices: invoiceCount,
      totalTaxableValue: taxableValue,
      totalTax,
      igst,
      cgst,
      sgst,
      cess: 0,
    });

    // GSTR-3B (same period)
    filings.push({
      returnType: 'GSTR-3B',
      period,
      status,
      filedDate,
      acknowledgmentNumber: ackNo,
      totalInvoices: invoiceCount,
      totalTaxableValue: taxableValue,
      totalTax,
      igst,
      cgst,
      sgst,
      cess: 0,
    });

    // GSTR-2B (auto-populated, always available by 14th)
    const itcAvailable = round2(taxableValue * 0.16 + rng() * 80000); // ~88% of input tax
    const itcReversed = round2(taxableValue * 0.02);
    filings.push({
      returnType: 'GSTR-2B',
      period,
      status: 'filed',
      filedDate: isoDate(addDays(dueDate, -6)),
      totalInvoices: Math.floor(invoiceCount * 0.7),
      totalTaxableValue: round2(taxableValue * 0.72),
      totalTax: round2(itcAvailable + itcReversed),
      igst: round2(itcAvailable * (isInterState ? 1 : 0)),
      cgst: round2(itcAvailable * (isInterState ? 0 : 0.5)),
      sgst: round2(itcAvailable * (isInterState ? 0 : 0.5)),
      cess: 0,
      itcAvailable,
      itcReversed,
    });

    // History entries (one per return type)
    for (const rt of ['GSTR-1', 'GSTR-3B']) {
      history.push({
        period,
        returnType: rt,
        status: status === 'filed' ? 'filed' : status === 'draft' ? 'draft' : 'pending',
        filedDate,
        acknowledgmentNumber: ackNo,
        delayedByDays: rt === 'GSTR-3B' && status === 'filed' ? delayedBy : 0,
      });
    }
  }

  return { filings, history };
}

// ─── E-Invoices ─────────────────────────────────────────────────────────────────
function generateEInvoices(rng: () => number, gstin: string, count = 40): EInvoiceRecord[] {
  const invoices: EInvoiceRecord[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rng() * 90);
    const invDate = addDays(now, -daysAgo);
    const taxable = roundTo(50000 + rng() * 450000, 100);
    const isInterState = rng() > 0.4;
    const igst = isInterState ? round2(taxable * 0.18) : 0;
    const cgst = isInterState ? 0 : round2(taxable * 0.09);
    const sgst = isInterState ? 0 : round2(taxable * 0.09);
    const invNo = `INV-${String(now.getFullYear()).slice(2)}${String(Math.floor(invDate.getMonth() + 1)).padStart(2, '0')}${String(1000 + i).padStart(4, '0')}`;
    const buyerGstin = `${String(Math.floor(rng() * 36 + 1)).padStart(2, '0')}ABCDE${String(Math.floor(rng() * 9000 + 1000))}F1Z5`;
    invoices.push({
      irn: `${gstin.slice(0, 10)}${Date.now().toString(36)}${i.toString(36)}${Math.floor(rng() * 1e9).toString(36)}`.slice(0, 64),
      ackNo: `${Math.floor(rng() * 9e15 + 1e15)}`,
      ackDate: isoDateTime(invDate),
      invoiceNumber: invNo,
      invoiceDate: isoDate(invDate),
      buyerGstin,
      buyerName: pick(rng, BUYER_NAMES),
      taxableValue: taxable,
      cgst,
      sgst,
      igst,
      totalAmount: round2(taxable + igst + cgst + sgst),
      status: rng() > 0.97 ? 'cancelled' : 'active',
    });
  }
  return invoices.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
}

// ─── E-Way Bills ────────────────────────────────────────────────────────────────
function generateEWayBills(rng: () => number, gstin: string, count = 30): EWayBillRecord[] {
  const bills: EWayBillRecord[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rng() * 60);
    const genDate = addDays(now, -daysAgo);
    const validUntil = addDays(genDate, 1); // 1-day validity by default
    const taxable = roundTo(80000 + rng() * 600000, 100);
    const isInterState = rng() > 0.4;
    const totalTax = round2(taxable * 0.18);
    const fromCity = pick(rng, CITIES);
    let toCity = pick(rng, CITIES);
    while (toCity === fromCity) toCity = pick(rng, CITIES);
    const expired = validUntil < now;
    bills.push({
      ewayBillNo: `${Math.floor(rng() * 9e11 + 1e11)}`,
      generatedDate: isoDateTime(genDate),
      validUntil: isoDateTime(validUntil),
      docNumber: `WB-${String(10000 + i)}`,
      docDate: isoDate(genDate),
      buyerGstin: `${String(Math.floor(rng() * 36 + 1)).padStart(2, '0')}ABCDE${String(Math.floor(rng() * 9000 + 1000))}F1Z5`,
      buyerName: pick(rng, BUYER_NAMES),
      supplyType: 'outward',
      taxableValue: taxable,
      totalTax,
      totalAmount: round2(taxable + totalTax),
      transporterId: pick(rng, TRANSPORTERS),
      vehicleNo: pick(rng, VEHICLES),
      fromPlace: fromCity,
      toPlace: toCity,
      distanceKm: isInterState ? 400 + Math.floor(rng() * 1500) : 50 + Math.floor(rng() * 300),
      status: expired ? 'expired' : 'active',
    });
  }
  return bills.sort((a, b) => b.generatedDate.localeCompare(a.generatedDate));
}

// ─── Notices (1-3 realistic notices) ────────────────────────────────────────────
function generateNotices(rng: () => number): GstNoticeRecord[] {
  const notices: GstNoticeRecord[] = [];
  const now = new Date();

  // 50% chance of a DRC-01A intimation about ITC mismatch
  if (rng() > 0.4) {
    const date = addDays(now, -20 - Math.floor(rng() * 30));
    notices.push({
      noticeType: 'DRC-01A',
      noticeNumber: `DRC/${date.getFullYear()}/${String(Math.floor(rng() * 9000 + 1000))}`,
      noticeDate: isoDate(date),
      subject: 'Intimation for ITC mismatch under Rule 88C',
      description: 'The input tax credit claimed in GSTR-3B exceeds the ITC available in GSTR-2B by ₹47,200 for the period. Reason for the mismatch may be communicated online.',
      status: 'open',
      dueDate: isoDate(addDays(date, 30)),
      priority: 'high',
    });
  }

  // 40% chance of ASMT-10 (annual return mismatch)
  if (rng() > 0.5) {
    const date = addDays(now, -45 - Math.floor(rng() * 30));
    notices.push({
      noticeType: 'ASMT-10',
      noticeNumber: `ASMT/${date.getFullYear()}/${String(Math.floor(rng() * 9000 + 1000))}`,
      noticeDate: isoDate(date),
      subject: 'ASMT-10 — Discrepancy in annual return',
      description: 'Discrepancy observed between GSTR-1 and GSTR-9 for the financial year. Reply with reconciliation statement.',
      status: 'open',
      dueDate: isoDate(addDays(date, 45)),
      priority: 'medium',
    });
  }

  // 30% chance of a low-priority intimation
  if (rng() > 0.6) {
    const date = addDays(now, -10 - Math.floor(rng() * 20));
    notices.push({
      noticeType: 'intimation',
      noticeNumber: `INT/${date.getFullYear()}/${String(Math.floor(rng() * 9000 + 1000))}`,
      noticeDate: isoDate(date),
      subject: 'Intimation — Late filing of GSTR-3B',
      description: 'GSTR-3B for the previous tax period was filed after the due date. Late fee of ₹2,400 has been levied under Section 47 of the CGST Act.',
      status: 'responded',
      priority: 'low',
    });
  }

  return notices;
}

// ─── Compliance status computed from filings + notices ──────────────────────────
function computeCompliance(
  filings: GstrFilingSummary[],
  notices: GstNoticeRecord[],
): ComplianceStatus {
  // Consider only GSTR-1 + GSTR-3B for compliance (GSTR-2B is auto)
  const returnFilings = filings.filter(f => f.returnType !== 'GSTR-2B');
  const filedReturns = returnFilings.filter(f => f.status === 'filed').length;
  const overdueReturns = returnFilings.filter(f => f.status === 'overdue').length;
  const pendingReturns = returnFilings.filter(f => f.status === 'pending' || f.status === 'draft').length;
  const activeNotices = notices.filter(n => n.status === 'open').length;

  const lastFiled = filings
    .filter(f => f.status === 'filed' && f.filedDate)
    .sort((a, b) => (b.filedDate! > a.filedDate! ? 1 : -1))[0];
  const lastFilingDate = lastFiled?.filedDate;

  // Next due date: 20th of current month for GSTR-3B
  const now = new Date();
  const nextDue = new Date(now.getFullYear(), now.getMonth(), 20);
  if (nextDue < now) nextDue.setMonth(nextDue.getMonth() + 1);
  const nextDueDate = isoDate(nextDue);

  const itcAvailable = filings
    .filter(f => f.returnType === 'GSTR-2B' && f.itcAvailable)
    .slice(-1)[0]?.itcAvailable ?? 0;
  const itcReversed = filings
    .filter(f => f.returnType === 'GSTR-2B' && f.itcReversed)
    .slice(-1)[0]?.itcReversed ?? 0;

  // Score: start at 100, subtract for overdue/pending/notices
  let score = 100;
  score -= overdueReturns * 12;
  score -= pendingReturns * 4;
  score -= activeNotices * 8;
  score = Math.max(0, Math.min(100, score));

  const status: ComplianceStatus['status'] =
    overdueReturns > 0 || activeNotices >= 2 ? 'non_compliant' :
    activeNotices > 0 || pendingReturns > 2 ? 'at_risk' : 'compliant';

  return {
    score,
    pendingReturns,
    overdueReturns,
    filedReturns,
    lastFilingDate,
    nextDueDate,
    itcAvailable: round2(itcAvailable),
    itcReversed: round2(itcReversed),
    activeNotices,
    status,
  };
}

// ─── PHASE 2A — Registration profile, GSTR-9, Ledgers, late fees, tax liability ─

const RANGE_CODES = ['WRX', 'DLN', 'MUM', 'BLR', 'CHN', 'KOL', 'AHM', 'PUN'];
const COMMISSIONERATES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Pune', 'Kolkata'];

function generateRegistrationProfile(
  rng: () => number,
  state: string,
  businessType: string,
  registrationDate: string,
): RegistrationProfile {
  const rangeCode = pick(rng, RANGE_CODES);
  const commissionerate = pick(rng, COMMISSIONERATES);
  return {
    registrationDate,
    constitution: businessType, // mirrors businessType (already one of BUSINESS_TYPES)
    businessType,
    centerJurisdiction: `Range-${rangeCode}, ${commissionerate} CGST`,
    stateJurisdiction: `${state} State GST`,
    filingFrequency: 'monthly',
    taxpayerType: 'Regular',
  };
}

function generateGstr9(
  rng: () => number,
  filings: GstrFilingSummary[],
): Gstr9Summary {
  const now = new Date();
  // Last completed FY: if current month >= April (FY start), previous FY ended.
  // E.g. today=2025-XX → FY 2024-25 ended 31 March 2025.
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
  const financialYear = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;

  // Aggregate GSTR-1 over the FY (April → March)
  const fyMonths: string[] = [];
  for (let m = 0; m < 12; m++) {
    const y = m < 9 ? fyStartYear : fyStartYear + 1; // April(3)→Dec(11): fyStartYear; Jan(0)→Mar(2): fyStartYear+1
    const monthIdx = m < 9 ? m + 3 : m - 9; // 3..11 → April..Dec, 0..2 → Jan..Mar
    fyMonths.push(`${y}-${String(monthIdx + 1).padStart(2, '0')}`);
  }
  const fyGstr1 = filings.filter(f => f.returnType === 'GSTR-1' && fyMonths.includes(f.period));
  const turnover = round2(fyGstr1.reduce((s, f) => s + f.totalTaxableValue, 0) * 1.18); // turnover includes tax
  const taxableValue = round2(fyGstr1.reduce((s, f) => s + f.totalTaxableValue, 0));
  const totalTax = round2(fyGstr1.reduce((s, f) => s + f.totalTax, 0));
  // ITC claimed ≈ 80% of total tax paid (realistic for an SME)
  const itcClaimed = round2(totalTax * 0.8);

  // Status: 70% filed, 20% pending, 10% overdue (deterministic via rng)
  const r = rng();
  let status: Gstr9Summary['status'];
  let lateFee = 0;
  let filedDate: string | undefined;
  if (r < 0.7) {
    status = 'filed';
    // Filed ~2 months after FY end (e.g. 31 May)
    const filedOn = new Date(fyStartYear + 1, 4, 20 + Math.floor(rng() * 8));
    filedDate = isoDate(filedOn);
  } else if (r < 0.9) {
    status = 'pending';
    lateFee = 0;
  } else {
    status = 'overdue';
    // ₹200/day capped at ₹5000 for GSTR-9 (per CGST rules, ₹100/day capped)
    const daysLate = 30 + Math.floor(rng() * 90);
    lateFee = Math.min(daysLate * 200, 5000);
  }

  // If turnover is too small (firm too new), skip — return a minimal record
  return {
    financialYear,
    status,
    turnover: turnover > 0 ? turnover : roundTo(2000000 + rng() * 6000000, 100000),
    taxableValue: taxableValue > 0 ? taxableValue : roundTo(1800000 + rng() * 5000000, 100000),
    totalTax: totalTax > 0 ? totalTax : round2(taxableValue * 0.18),
    itcClaimed,
    lateFee,
    filedDate,
  };
}

function generateItcLedger(
  rng: () => number,
  itcAvailable: number,
): LedgerSummary {
  const openingBalance = round2(itcAvailable * (0.6 + rng() * 0.3));
  const availableItc = round2(itcAvailable);
  const reversedItc = round2(itcAvailable * 0.05);
  const utilizedItc = round2(itcAvailable * 0.8);
  const closingBalance = round2(openingBalance + availableItc - utilizedItc - reversedItc);
  // Split across IGST (interstate) + CGST + SGST + cess
  const igst = round2(itcAvailable * 0.4);
  const cgst = round2(itcAvailable * 0.28);
  const sgst = round2(itcAvailable * 0.28);
  const cess = round2(itcAvailable * 0.04);
  return {
    cgst, sgst, igst, cess,
    totalBalance: round2(closingBalance),
    openingBalance,
    availableItc,
    reversedItc,
    utilizedItc,
    closingBalance,
  };
}

function generateCashLedger(rng: () => number): LedgerSummary {
  const total = roundTo(10000 + rng() * 190000, 1000);
  const igst = round2(total * 0.4);
  const cgst = round2(total * 0.28);
  const sgst = round2(total * 0.28);
  const cess = round2(total * 0.04);
  return {
    cgst, sgst, igst, cess,
    totalBalance: round2(igst + cgst + sgst + cess),
  };
}

function generateLiabilityLedger(
  rng: () => number,
  pendingTax: number,
  lateFees: number,
): LedgerSummary {
  const pendingInterest = rng() > 0.6 ? round2(pendingTax * 0.015) : 0; // ~1.5% interest if applicable
  const pendingLateFee = lateFees;
  const totalLiability = round2(pendingTax + pendingInterest + pendingLateFee);
  return {
    cgst: round2(pendingTax * 0.5),
    sgst: round2(pendingTax * 0.5),
    igst: 0,
    cess: 0,
    totalBalance: totalLiability,
    pendingTax: round2(pendingTax),
    pendingInterest,
    pendingLateFee,
    totalLiability,
  };
}

function computeLateFees(filings: GstrFilingSummary[]): number {
  // ₹50/day capped at ₹2000 per overdue return (GSTR-1/3B)
  const overdueCount = filings.filter(f => f.status === 'overdue' && f.returnType !== 'GSTR-2B').length;
  // Each overdue return ~30 days late (deterministic approximation)
  return overdueCount * Math.min(30 * 50, 2000);
}

function computeTaxLiability(
  filings: GstrFilingSummary[],
  itcAvailable: number,
): number {
  // Last GSTR-3B totalTax minus ITC available, floored at 0
  const last3b = filings
    .filter(f => f.returnType === 'GSTR-3B')
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-1)[0];
  if (!last3b) return 0;
  return round2(Math.max(0, last3b.totalTax - itcAvailable));
}

// ─── Public: generate the full GSTN dataset for a verified GSTIN ─────────────────
export function generateGstnDataset(gstinRaw: string): GstnDataset {
  const gstin = gstinRaw.toUpperCase().trim();
  if (!validateGSTIN(gstin)) {
    throw new Error('Invalid GSTIN format');
  }

  const rng = mulberry32(gstinSeed(gstin));
  const stateCode = gstin.slice(0, 2);
  const state = STATE_MAP[stateCode] ?? 'Unknown State';
  const { legalName, tradeName } = deriveLegalName(rng);
  const { filings, history } = generateFilings(rng, gstin);
  const eInvoices = generateEInvoices(rng, gstin, 40);
  const eWayBills = generateEWayBills(rng, gstin, 30);
  const notices = generateNotices(rng);
  const compliance = computeCompliance(filings, notices);

  const regDate = addDays(new Date(), -365 * (3 + Math.floor(rng() * 5)));
  const registrationDate = isoDate(regDate);
  const businessType = pick(rng, BUSINESS_TYPES);

  // ── PHASE 2A extensions ──
  const registrationProfile = generateRegistrationProfile(rng, state, businessType, registrationDate);
  const gstr9 = generateGstr9(rng, filings);
  const lateFees = computeLateFees(filings);
  const itcLedger = generateItcLedger(rng, compliance.itcAvailable);
  const cashLedger = generateCashLedger(rng);
  const taxLiability = computeTaxLiability(filings, compliance.itcAvailable);
  const liabilityLedger = generateLiabilityLedger(rng, taxLiability, lateFees);

  return {
    gstin,
    legalName,
    tradeName,
    state,
    stateCode,
    businessType,
    registrationDate,
    filingHistory: history,
    gstrFilings: filings,
    eInvoices,
    eWayBills,
    notices,
    compliance,
    gstr9,
    registrationProfile,
    itcLedger,
    cashLedger,
    liabilityLedger,
    lateFees,
    taxLiability,
  };
}
