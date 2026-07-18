// ═══════════════════════════════════════════════════════════════════════════════
// GSTN Live Integration Cloud™ — Client Base
// Phase 8 Step 1 — Connect. Execute. Automate. Scale.
//
// Deterministic GSTN simulation layer with REAL database persistence.
// The same GSTIN always returns the same business — so Oracle can say
// "I've downloaded your GSTR-2B" and it's actually stored in the DB.
//
// In production, replace the simulation functions with real GSTN API calls
// (https://api.gstn.co.in / sandbox.api.gstn.co.in). The function signatures
// and DB persistence layer stay identical.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GSTSearchResult {
  gstin: string;
  legalName: string;
  tradeName: string;
  status: 'Active' | 'Cancelled' | 'Suspended' | 'Provisional';
  registrationDate: string;
  taxpayerType: string;
  state: string;
  stateCode: string;
  address: string;
  businessType: string;
  pan: string;
}

export interface PANVerifyResult {
  pan: string;
  name: string;
  status: 'Valid' | 'Invalid' | 'Not Found' | 'Linked';
  entityType: string;
  aadhaarLinked: boolean;
  lastUpdated: string;
}

export interface GSTR2BInvoiceData {
  supplierGSTIN: string;
  supplierName: string;
  invoiceNo: string;
  invoiceDate: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  itcAvailable: number;
  itcEligible: boolean;
}

export interface GSTR2BDownloadResult {
  gstin: string;
  period: string;
  downloadedAt: string;
  invoiceCount: number;
  totalTaxableValue: number;
  totalITC: number;
  eligibleITC: number;
  ineligibleITC: number;
  invoices: GSTR2BInvoiceData[];
}

export interface GSTR1Draft {
  gstin: string;
  period: string;
  b2bInvoices: number;
  b2cInvoices: number;
  exportInvoices: number;
  creditNotes: number;
  debitNotes: number;
  amendments: number;
  totalTaxableValue: number;
  totalIGST: number;
  totalCGST: number;
  totalSGST: number;
  totalCess: number;
  jsonPayload: string;
  preparedAt: string;
}

export interface GSTR3BDraft {
  gstin: string;
  period: string;
  outputTax: number;
  itcClaimed: number;
  netTaxPayable: number;
  interest: number;
  lateFee: number;
  totalLiability: number;
  jsonPayload: string;
  preparedAt: string;
}

export interface FilingResult {
  gstin: string;
  returnType: string;
  period: string;
  status: 'filed' | 'failed';
  ackNo: string;
  filedAt: string;
  message: string;
}

export interface MismatchResult {
  id: string;
  supplierGSTIN: string;
  invoiceNo: string;
  reason: 'missing_invoice' | 'gstin_mismatch' | 'value_difference' | 'duplicate' | 'itc_blocked' | 'date_difference';
  amount: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'resolved' | 'ignored';
  suggestion: string;
}

export interface ReconcileResult {
  gstin: string;
  period: string;
  totalInvoices: number;
  matched: number;
  unmatched: number;
  mismatched: number;
  matchedPct: number;
  missingITC: number;
  mismatchValue: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  mismatches: MismatchResult[];
}

export interface EInvoiceResult {
  irn: string;
  qrCode: string;
  ackNo: string;
  ackDate: string;
  signedInvoice: string;
  status: 'generated' | 'cancelled';
  cancelledAt?: string;
}

export interface EWayBillResult {
  ewbNo: string;
  ewbDate: string;
  validUpto: string;
  status: 'generated' | 'extended' | 'cancelled' | 'expired';
  consignmentId: string;
}

// ─── Deterministic GSTIN → business mapping ───────────────────────────────────
// Real GSTN returns taxpayer details from its database. We simulate this with
// a deterministic hash so the same GSTIN always returns the same business —
// making the system feel real and persistent.

const STATE_MAP: Record<string, { state: string; code: string }> = {
  '01': { state: 'Jammu and Kashmir', code: '01' },
  '02': { state: 'Himachal Pradesh', code: '02' },
  '03': { state: 'Punjab', code: '03' },
  '05': { state: 'Uttarakhand', code: '05' },
  '06': { state: 'Haryana', code: '06' },
  '07': { state: 'Delhi', code: '07' },
  '08': { state: 'Rajasthan', code: '08' },
  '09': { state: 'Uttar Pradesh', code: '09' },
  '10': { state: 'Bihar', code: '10' },
  '11': { state: 'Sikkim', code: '11' },
  '12': { state: 'Arunachal Pradesh', code: '12' },
  '13': { state: 'Nagaland', code: '13' },
  '14': { state: 'Manipur', code: '14' },
  '15': { state: 'Mizoram', code: '15' },
  '16': { state: 'Tripura', code: '16' },
  '17': { state: 'Meghalaya', code: '17' },
  '18': { state: 'Assam', code: '18' },
  '19': { state: 'West Bengal', code: '19' },
  '20': { state: 'Jharkhand', code: '20' },
  '21': { state: 'Odisha', code: '21' },
  '22': { state: 'Chhattisgarh', code: '22' },
  '23': { state: 'Madhya Pradesh', code: '23' },
  '24': { state: 'Gujarat', code: '24' },
  '26': { state: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  '27': { state: 'Maharashtra', code: '27' },
  '29': { state: 'Karnataka', code: '29' },
  '30': { state: 'Goa', code: '30' },
  '31': { state: 'Lakshadweep', code: '31' },
  '32': { state: 'Kerala', code: '32' },
  '33': { state: 'Tamil Nadu', code: '33' },
  '34': { state: 'Puducherry', code: '34' },
  '35': { state: 'Andaman and Nicobar Islands', code: '35' },
  '36': { state: 'Telangana', code: '36' },
  '37': { state: 'Andhra Pradesh', code: '37' },
  '38': { state: 'Ladakh', code: '38' },
};

const BUSINESS_NAMES = [
  { legal: 'Reliance Retail Limited', trade: 'Reliance Retail', type: 'Private Limited' },
  { legal: 'Tata Consultancy Services Limited', trade: 'TCS', type: 'Public Limited' },
  { legal: 'Infosys Limited', trade: 'Infosys', type: 'Public Limited' },
  { legal: 'Asian Paints Limited', trade: 'Asian Paints', type: 'Public Limited' },
  { legal: 'Britannia Industries Limited', trade: 'Britannia', type: 'Public Limited' },
  { legal: 'Maruti Suzuki India Limited', trade: 'Maruti Suzuki', type: 'Public Limited' },
  { legal: 'Hindustan Unilever Limited', trade: 'HUL', type: 'Public Limited' },
  { legal: 'Adani Power Limited', trade: 'Adani Power', type: 'Public Limited' },
  { legal: 'Bharti Airtel Limited', trade: 'Airtel', type: 'Public Limited' },
  { legal: 'Mahindra and Mahindra Limited', trade: 'Mahindra', type: 'Public Limited' },
  { legal: 'Wipro Technologies Limited', trade: 'Wipro', type: 'Public Limited' },
  { legal: 'HCL Technologies Limited', trade: 'HCL Tech', type: 'Public Limited' },
  { legal: 'Larsen and Toubro Limited', trade: 'L&T', type: 'Public Limited' },
  { legal: 'Bajaj Auto Limited', trade: 'Bajaj Auto', type: 'Public Limited' },
  { legal: 'Hero MotoCorp Limited', trade: 'Hero MotoCorp', type: 'Public Limited' },
  { legal: 'Nestle India Limited', trade: 'Nestle', type: 'Public Limited' },
  { legal: 'ITC Limited', trade: 'ITC', type: 'Public Limited' },
  { legal: 'State Bank of India', trade: 'SBI', type: 'Public Sector' },
  { legal: 'HDFC Bank Limited', trade: 'HDFC Bank', type: 'Public Limited' },
  { legal: 'ICICI Bank Limited', trade: 'ICICI Bank', type: 'Public Limited' },
];

const SUPPLIER_NAMES = [
  { legal: 'Reliance Industries Limited', trade: 'Reliance Industries', gstin: '27AAACR5055K1Z5' },
  { legal: 'Tata Steel Limited', trade: 'Tata Steel', gstin: '27AAACT2727Q1ZW' },
  { legal: 'Infosys Limited', trade: 'Infosys', gstin: '29AAACI4799L1ZB' },
  { legal: 'Asian Paints Limited', trade: 'Asian Paints', gstin: '27AAACA9514P1Z4' },
  { legal: 'Britannia Industries Limited', trade: 'Britannia', gstin: '33AAACB4352K1Z6' },
  { legal: 'Maruti Suzuki India Limited', trade: 'Maruti Suzuki', gstin: '06AAACM4699Q1Z6' },
  { legal: 'Hindustan Unilever Limited', trade: 'HUL', gstin: '27AAACH1809E1Z5' },
  { legal: 'Adani Power Limited', trade: 'Adani Power', gstin: '24AADCA7832D1Z5' },
  { legal: 'Bharti Airtel Limited', trade: 'Airtel', gstin: '29AABCB3518E1Z2' },
  { legal: 'Mahindra and Mahindra Limited', trade: 'Mahindra', gstin: '27AAACM8711G1Z5' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const nowISO = () => new Date().toISOString();

export function isValidGstinFormat(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin);
}

export function isValidPanFormat(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
}

export function extractStateCode(gstin: string): string {
  return gstin.slice(0, 2);
}

export function extractPan(gstin: string): string {
  return gstin.slice(2, 12);
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededPick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ─── Government identifier generators ─────────────────────────────────────────
// IRN / ACK / EWB numbers are official government identifiers issued ONLY by the
// GSTN portal / IRP. Generating them locally with Math.random() would fabricate
// legal documents. These functions throw until a real GSTN API integration is
// configured (GSTN_API_KEY + connected GST portal).

// TODO: Replace with real IRP/NIC API integration when available.
export function genAckNo(): string {
  throw new Error('GSTN API not configured. Set GSTN_API_KEY and connect GST portal.');
}

// TODO: Replace with real IRP/NIC API integration when available.
export function genIRN(): string {
  throw new Error('GSTN API not configured. Set GSTN_API_KEY and connect GST portal.');
}

// TODO: Replace with real IRP/NIC API integration when available.
export function genEWBNo(): string {
  throw new Error('GSTN API not configured. Set GSTN_API_KEY and connect GST portal.');
}

// ─── GSTIN → Business (deterministic) ─────────────────────────────────────────

export function resolveGstinToBusiness(gstin: string): GSTSearchResult {
  if (!isValidGstinFormat(gstin)) {
    throw new Error('Invalid GSTIN format. Expected 15 chars: 2 state + 10 PAN + 1 entity + Z + 1 checksum.');
  }
  const stateCode = extractStateCode(gstin);
  const pan = extractPan(gstin);
  const stateInfo = STATE_MAP[stateCode] ?? { state: 'Unknown State', code: stateCode };
  const seed = hashStr(gstin);
  const biz = seededPick(BUSINESS_NAMES, seed);
  const taxpayerTypes = ['Regular', 'Composition', 'Input Service Distributor', 'TDS', 'Non-Resident Taxable'];
  const statuses: GSTSearchResult['status'][] = ['Active', 'Active', 'Active', 'Active', 'Cancelled', 'Suspended'];
  const regYear = 2017 + (seed % 7);
  const regMonth = 1 + (seed % 12);
  const regDay = 1 + (seed % 28);

  return {
    gstin,
    legalName: biz.legal,
    tradeName: biz.trade,
    status: seededPick(statuses, seed),
    registrationDate: `${regYear}-${String(regMonth).padStart(2, '0')}-${String(regDay).padStart(2, '0')}`,
    taxpayerType: seededPick(taxpayerTypes, seed),
    state: stateInfo.state,
    stateCode: stateInfo.code,
    address: `${biz.trade} Pvt Ltd, ${stateInfo.state} ${stateCode}0001, India`,
    businessType: biz.type,
    pan,
  };
}

// ─── PAN → Entity (deterministic) ─────────────────────────────────────────────

export function resolvePanToEntity(pan: string): PANVerifyResult {
  if (!isValidPanFormat(pan)) {
    throw new Error('Invalid PAN format. Expected 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).');
  }
  const seed = hashStr(pan);
  const fourthChar = pan[3];
  const entityMap: Record<string, string> = {
    A: 'Association of Persons', B: 'Body of Individuals', C: 'Company', F: 'Firm',
    G: 'Government Agency', H: 'Hindu Undivided Family', L: 'Local Authority', J: 'Artificial Juridical Person',
    P: 'Individual', T: 'Trust', K: 'Krishik (Individual)',
  };
  const entityType = entityMap[fourthChar] ?? 'Individual';
  const statuses: PANVerifyResult['status'][] = ['Valid', 'Valid', 'Valid', 'Linked', 'Invalid', 'Not Found'];
  const names = ['Prince Singh', 'Priya Sharma', 'Amit Patel', 'Sneha Reddy', 'Rohit Gupta', 'Anjali Verma', 'Vikram Nair', 'Kavya Iyer'];
  return {
    pan,
    name: seededPick(names, seed),
    status: seededPick(statuses, seed),
    entityType,
    aadhaarLinked: seed % 3 !== 0,
    lastUpdated: nowISO(),
  };
}

// ─── GSTIN → Supplier invoices (deterministic GSTR-2B generation) ─────────────

export function generateGstr2bInvoices(gstin: string, period: string): GSTR2BInvoiceData[] {
  const seed = hashStr(gstin + period);
  const count = 8 + (seed % 12); // 8–19 invoices
  const invoices: GSTR2BInvoiceData[] = [];
  for (let i = 0; i < count; i++) {
    const supSeed = hashStr(gstin + period + i);
    const supplier = seededPick(SUPPLIER_NAMES, supSeed);
    const taxableValue = (5 + (supSeed % 95)) * 10000; // ₹50K – ₹10L
    const isInterState = extractStateCode(gstin) !== extractStateCode(supplier.gstin);
    const igst = isInterState ? Math.round(taxableValue * 0.18) : 0;
    const cgst = isInterState ? 0 : Math.round(taxableValue * 0.09);
    const sgst = isInterState ? 0 : Math.round(taxableValue * 0.09);
    const cess = supSeed % 5 === 0 ? Math.round(taxableValue * 0.01) : 0;
    const itcAvail = igst + cgst + sgst + cess;
    const eligible = supSeed % 7 !== 0; // ~14% ineligible
    const invDay = 1 + (supSeed % 28);
    invoices.push({
      supplierGSTIN: supplier.gstin,
      supplierName: supplier.trade,
      invoiceNo: `INV-${period.replace('-', '')}-${String(1000 + i).padStart(4, '0')}`,
      invoiceDate: `${period}-${String(invDay).padStart(2, '0')}`,
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      itcAvailable: itcAvail,
      itcEligible: eligible,
    });
  }
  return invoices;
}

// ─── GSTIN → Sales invoices (deterministic GSTR-1 generation) ─────────────────

export function generateGstr1Data(gstin: string, period: string) {
  const seed = hashStr(gstin + period);
  const b2b = 12 + (seed % 18);
  const b2c = 20 + (seed % 40);
  const exports = seed % 5;
  const creditNotes = seed % 6;
  const debitNotes = seed % 4;
  const amendments = seed % 3;
  const avgB2b = 85000, avgB2c = 12000, avgExport = 250000;
  const totalTaxableValue = b2b * avgB2b + b2c * avgB2c + exports * avgExport;
  return {
    b2bInvoices: b2b,
    b2cInvoices: b2c,
    exportInvoices: exports,
    creditNotes,
    debitNotes,
    amendments,
    totalTaxableValue,
    totalIGST: Math.round(totalTaxableValue * 0.18 * 0.3),
    totalCGST: Math.round(totalTaxableValue * 0.09 * 0.7),
    totalSGST: Math.round(totalTaxableValue * 0.09 * 0.7),
    totalCess: Math.round(totalTaxableValue * 0.005),
  };
}

// ─── Ack generators ───────────────────────────────────────────────────────────
// genAckNo / genIRN / genEWBNo are exported above (they throw until real GSTN
// API integration is wired up).

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getOrCreateGstProfile(gstin: string): Promise<{ id: string; gstin: string; legalName: string }> {
  const business = resolveGstinToBusiness(gstin);
  const existing = await db.gSTProfile.findUnique({ where: { gstin } });
  if (existing) return existing;
  return db.gSTProfile.create({
    data: {
      gstin,
      pan: business.pan,
      legalName: business.legalName,
      tradeName: business.tradeName,
      state: business.state,
      stateCode: business.stateCode,
      address: business.address,
      registrationDate: business.registrationDate,
      taxpayerType: business.taxpayerType,
      status: business.status,
      businessType: business.businessType,
      lastSyncedAt: new Date(),
    },
  });
}
