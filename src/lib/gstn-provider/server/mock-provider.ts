// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Real GSTN Integration™ — MockGSTProvider (SERVER-ONLY)
//
// The default provider. Produces DETERMINISTIC, realistic-looking GST data
// seeded by GSTIN — the same GSTIN always returns the same legal name, the same
// filing history, the same notices. This lets the UI feel real without ever
// touching the production GSTN APIs.
//
// This file is SERVER-ONLY (uses node:crypto for deterministic seeding). It
// should NEVER be imported by client code. API routes are the only consumers.
//
// When you're ready to go live: set `GSTN_PROVIDER=official` in env, configure
// `GSTN_CLIENT_ID` / `GSTN_CLIENT_SECRET` / `GSTN_ENCRYPTION_KEY`, and the
// registry will swap to FutureOfficialGSTProvider → real production calls.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { IGSTProvider, GSTSession } from '../provider';
import type {
  ConnectResult,
  GSTLedger,
  GSTLedgerEntry,
  GSTNotice,
  GSTProfile,
  GSTReturn,
  GSTReturnType,
  VerifyGSTINResult,
  VerifyOTPResult,
} from '../types';
import {
  AuthenticationError,
  OTPExpiredError,
  OTPInvalidError,
  ValidationError,
} from '../errors';

// ─── Deterministic PRNG (seeded by GSTIN) ────────────────────────────────────
// mulberry32 — small, fast, deterministic. Same seed → same sequence.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  return crypto.createHash('sha1').update(input).digest().readUInt32LE(0);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── GSTIN validation (real checksum) ────────────────────────────────────────
// We re-implement the GSTN checksum here so the mock provider rejects malformed
// GSTINs the same way the real API would.

const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const GST_FACTOR = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function computeGstinChecksum(gstin14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const ch = gstin14[i].toUpperCase();
    const val = GST_CHARS.indexOf(ch);
    if (val < 0) return '?';
    let prod = val * GST_FACTOR[i];
    prod = Math.floor(prod / 36) + (prod % 36);
    sum += prod;
  }
  const mod = sum % 36;
  const checksum = (36 - mod) % 36;
  return GST_CHARS[checksum];
}

function isValidGstin(gstin: string): { valid: boolean; stateCode?: string } {
  if (typeof gstin !== 'string' || gstin.length !== 15) {
    return { valid: false };
  }
  const upper = gstin.toUpperCase();
  if (!/^[0-9A-Z]{15}$/.test(upper)) return { valid: false };
  const expected = computeGstinChecksum(upper.slice(0, 14));
  if (expected !== upper[14]) return { valid: false };
  return { valid: true, stateCode: upper.slice(0, 2) };
}

// ─── Deterministic business profile generator ────────────────────────────────

const BUSINESS_PREFIXES = ['Bharat', 'Indus', 'Vedic', 'Maurya', 'Mughal', 'Dravid', 'Arya', 'Nalanda', 'Saraswati', 'Himalaya', 'Deccan', 'Malabar', 'Konkan', 'Coromandel', 'Ganga'];
const BUSINESS_CORES = ['Tech', 'Traders', 'Industries', 'Enterprises', 'Solutions', 'Manufacturing', 'Exports', 'Logistics', 'Foods', 'Pharma', 'Textiles', 'Steel', 'Polymers', 'Agro', 'Motors'];
const BUSINESS_SUFFIXES = ['Pvt Ltd', 'LLP', 'Ltd', 'Pvt Ltd', 'Pvt Ltd', 'and Sons', 'Brothers'];
const CONSTITUTIONS = ['Private Limited Company', 'Public Limited Company', 'Limited Liability Partnership', 'Proprietorship', 'Partnership Firm', 'Hindu Undivided Family'];
const TAXPAYER_TYPES = ['Regular', 'Regular', 'Regular', 'Composition', 'Regular'];
const JURISDICTIONS = ['Central', 'State', 'Centre & State'];

function deriveBusinessName(rng: () => number): { legal: string; trade: string } {
  const p = pick(rng, BUSINESS_PREFIXES);
  const c = pick(rng, BUSINESS_CORES);
  const s = pick(rng, BUSINESS_SUFFIXES);
  const legal = `${p} ${c} ${s}`;
  const trade = `${p} ${c}`;
  return { legal, trade };
}

// ─── In-memory OTP store (mock) ──────────────────────────────────────────────
// In production, the GSTN API itself tracks OTP state. The mock has to do it
// locally. Entries expire after 10 minutes. We always accept "123456" as a
// universal dev OTP so the user can complete the flow without a real OTP.

interface MockOTPEntry {
  gstin: string;
  username: string;
  txnId: string;
  expectedOtp: string;
  expiresAt: number;
}

const otpStore = new Map<string, MockOTPEntry>();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupOtps(): void {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(key);
  }
}

// ─── Period helpers ───────────────────────────────────────────────────────────

function currentPeriod(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${mm}${yyyy}`;
}

function previousPeriod(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${mm}${yyyy}`;
}

function financialYearFromPeriod(period: string): string {
  const mm = parseInt(period.slice(0, 2), 10);
  const yyyy = parseInt(period.slice(2), 10);
  // Indian FY runs April–March. If month >= 4 (April), FY = yyyy-(yyyy+1).
  // Otherwise FY = (yyyy-1)-yyyy.
  if (mm >= 4) return `${yyyy}-${String(yyyy + 1).slice(2)}`;
  return `${yyyy - 1}-${String(yyyy).slice(2)}`;
}

function dueDateForReturn(returnType: GSTReturnType, period: string): string | null {
  if (returnType === 'GSTR-9' || returnType === 'GSTR-9C') {
    // Annual returns due 31 December after FY end.
    const fy = financialYearFromPeriod(period);
    const endYear = parseInt(fy.slice(5), 10);
    return `20${endYear + 1}-12-31`;
  }
  // Monthly returns due the 20th of the following month.
  const mm = parseInt(period.slice(0, 2), 10);
  const yyyy = parseInt(period.slice(2), 10);
  const dueMonth = mm % 12 + 1;
  const dueYear = mm === 12 ? yyyy + 1 : yyyy;
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-20`;
}

// ─── Mock return generator ────────────────────────────────────────────────────

function generateReturn(
  rng: () => number,
  gstin: string,
  returnType: GSTReturnType,
  period: string,
  connectionId: string,
  organizationId: string,
): GSTReturn {
  const fy = financialYearFromPeriod(period);
  const dueDate = dueDateForReturn(returnType, period);
  const nowIso = new Date().toISOString();
  const dueDateObj = dueDate ? new Date(dueDate) : null;
  const isOverdue = dueDateObj ? dueDateObj.getTime() < Date.now() : false;

  // 70% filed/acknowledged, 20% not_filed, 10% overdue (if applicable)
  let status: GSTReturn['status'];
  const r = rng();
  if (isOverdue && r < 0.1) {
    status = 'overdue';
  } else if (r < 0.2) {
    status = 'not_filed';
  } else if (r < 0.3) {
    status = 'filed';
  } else {
    status = 'acknowledged';
  }

  const taxable = randInt(rng, 500_000, 5_000_000);
  const taxRate = pick(rng, [0.05, 0.12, 0.18, 0.28]);
  const totalTax = round2(taxable * taxRate);
  const isInterState = pick(rng, [true, false]);
  const igst = isInterState ? totalTax : 0;
  const cgst = isInterState ? 0 : round2(totalTax / 2);
  const sgst = isInterState ? 0 : round2(totalTax / 2);
  const cess = round2(taxable * 0.01);
  const itc = returnType === 'GSTR-2B' || returnType === 'GSTR-3B' ? round2(totalTax * 0.8) : 0;
  const netPayable = Math.max(0, round2(totalTax + cess - itc));

  const filingDate = status === 'filed' || status === 'acknowledged'
    ? new Date(Date.now() - randInt(rng, 1, 30) * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const ackNo = status === 'acknowledged' ? String(randInt(rng, 10_000_000_000, 99_999_999_999)) : null;
  const ackDate = ackNo ? filingDate : null;

  return {
    id: `${gstin}-${returnType}-${period}`,
    organizationId,
    connectionId,
    returnType,
    financialYear: fy,
    period,
    status,
    filingDate,
    dueDate,
    ackNo,
    ackDate,
    totalTaxableValue: taxable,
    totalTax,
    totalItc: itc,
    netPayable,
    igstPayable: igst,
    cgstPayable: cgst,
    sgstPayable: sgst,
    cessPayable: cess,
    jsonPayload: {
      mock: true,
      returnType,
      period,
      summary: {
        taxableValue: taxable,
        totalTax,
        igst,
        cgst,
        sgst,
        cess,
        itc,
        netPayable,
      },
    },
    lastSyncedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

// ─── Mock notice generator ────────────────────────────────────────────────────

const NOTICE_SUBJECTS = [
  'Show Cause Notice for Input Tax Credit mismatch',
  'Notice for delayed filing of GSTR-3B',
  'Order for confirmation of tax demand',
  'Scrutiny notice under Section 61',
  'Communication regarding refund claim',
  'Notice for cancellation of GST registration',
  'Order for waiver of late fee',
  'Notice for reconciliation of GSTR-2B vs purchase register',
];
const NOTICE_AUTHORITIES = [
  'Central Tax, Ward 5, Bengaluru',
  'State Tax, Circle 12, Mumbai',
  'Central Tax, Range 8, Delhi',
  'State Tax, Division 3, Chennai',
  'Central Tax, Ward 2, Hyderabad',
];

function generateNotice(
  rng: () => number,
  gstin: string,
  connectionId: string,
  organizationId: string,
): GSTNotice {
  const nowIso = new Date().toISOString();
  const issueDate = new Date(Date.now() - randInt(rng, 1, 90) * 24 * 60 * 60 * 1000).toISOString();
  const hasDue = rng() < 0.7;
  const dueDate = hasDue
    ? new Date(Date.now() + randInt(rng, 7, 45) * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const noticeType = pick(rng, ['notice', 'order', 'communication'] as const);
  const priority = pick(rng, ['low', 'medium', 'high', 'urgent'] as const);
  const status = pick(rng, ['open', 'acknowledged', 'responded', 'resolved'] as const);
  const subject = pick(rng, NOTICE_SUBJECTS);
  const authority = pick(rng, NOTICE_AUTHORITIES);
  const refNo = `${gstin.slice(0, 5)}/${randInt(rng, 2023, 2025)}/${randInt(rng, 100, 999)}`;

  return {
    id: `${refNo}`,
    organizationId,
    connectionId,
    noticeType,
    referenceNumber: refNo,
    subject,
    issueDate,
    dueDate,
    priority,
    status,
    issuingAuthority: authority,
    description: `${subject} issued by ${authority}. Reference: ${refNo}.`,
    content: {
      mock: true,
      subject,
      body: `This is a mock ${noticeType} generated for ${gstin}. In production this would contain the full notice text from GSTN.`,
      sections: [
        { heading: 'Background', text: 'Background of the notice...' },
        { heading: 'Findings', text: 'Findings from the assessment...' },
        { heading: 'Required Action', text: 'Action required by the taxpayer...' },
      ],
    },
    attachmentUrl: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

// ─── Mock ledger generator ────────────────────────────────────────────────────

function generateLedger(
  rng: () => number,
  gstin: string,
  ledgerType: GSTLedger['ledgerType'],
  connectionId: string,
  organizationId: string,
): GSTLedger {
  const nowIso = new Date().toISOString();
  const igst = round2(randInt(rng, 1_000, 200_000));
  const cgst = round2(randInt(rng, 1_000, 200_000));
  const sgst = round2(randInt(rng, 1_000, 200_000));
  const cess = round2(randInt(rng, 100, 20_000));
  const total = round2(igst + cgst + sgst + cess);

  // Generate 5-15 transaction entries
  const entryCount = randInt(rng, 5, 15);
  const entries: GSTLedgerEntry[] = [];
  let runningBalance = 0;
  for (let i = 0; i < entryCount; i++) {
    const entryDate = new Date(Date.now() - (entryCount - i) * randInt(rng, 1, 5) * 24 * 60 * 60 * 1000).toISOString();
    const type = pick(rng, ['debit', 'credit'] as const);
    const eIgst = round2(randInt(rng, 100, 30_000));
    const eCgst = round2(randInt(rng, 100, 30_000));
    const eSgst = round2(randInt(rng, 100, 30_000));
    const eCess = round2(randInt(rng, 10, 3_000));
    const eTotal = round2(eIgst + eCgst + eSgst + eCess);
    runningBalance = type === 'credit' ? runningBalance + eTotal : Math.max(0, runningBalance - eTotal);
    entries.push({
      date: entryDate,
      description: type === 'credit'
        ? pick(rng, ['Payment received', 'ITC claimed', 'Refund credited', 'Reverse charge credit'])
        : pick(rng, ['Tax paid', 'ITC reversed', 'Refund debited', 'Late fee paid']),
      referenceNumber: `TXN${randInt(rng, 10_000_000, 99_999_999)}`,
      igst: eIgst,
      cgst: eCgst,
      sgst: eSgst,
      cess: eCess,
      total: eTotal,
      type,
      balance: runningBalance,
    });
  }
  entries.reverse(); // most recent first

  return {
    id: `${gstin}-${ledgerType}`,
    organizationId,
    connectionId,
    ledgerType,
    asOfDate: nowIso,
    igstBalance: igst,
    cgstBalance: cgst,
    sgstBalance: sgst,
    cessBalance: cess,
    totalBalance: total,
    entries,
    lastSyncedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

// ─── MockGSTProvider ──────────────────────────────────────────────────────────

export class MockGSTProvider implements IGSTProvider {
  readonly name = 'Mock GSTN Provider';
  readonly isLive = false;

  async requestOTP(gstin: string, username: string): Promise<ConnectResult> {
    const validation = isValidGstin(gstin);
    if (!validation.valid) {
      throw new ValidationError('Invalid GSTIN format. Please check the 15-character GSTIN.');
    }
    if (!username || username.trim().length < 3) {
      throw new ValidationError('Username must be at least 3 characters.');
    }

    cleanupOtps();
    const txnId = `MOCK-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const expectedOtp = String(randInt(mulberry32(hashSeed(gstin + Date.now())), 100_000, 999_999));

    otpStore.set(txnId, {
      gstin: gstin.toUpperCase(),
      username: username.trim(),
      txnId,
      expectedOtp,
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    return {
      txnId,
      otpSentTo: '***@**.in (mock — use 123456 to verify)',
      message: 'Mock OTP sent. In production, an OTP would be sent to the registered mobile/email. Use 123456 to verify in this mock mode.',
    };
  }

  async verifyOTP(
    gstin: string,
    username: string,
    otp: string,
  ): Promise<{ session: GSTSession; profile: Partial<GSTProfile> }> {
    cleanupOtps();
    const validation = isValidGstin(gstin);
    if (!validation.valid) {
      throw new ValidationError('Invalid GSTIN format.');
    }

    // Find any matching OTP entry for this GSTIN+username.
    let entry: MockOTPEntry | undefined;
    for (const e of otpStore.values()) {
      if (e.gstin === gstin.toUpperCase() && e.username === username.trim()) {
        entry = e;
        break;
      }
    }

    if (!entry || entry.expiresAt < Date.now()) {
      throw new OTPExpiredError();
    }

    // Accept the universal dev OTP "123456" OR the exact expected OTP.
    if (otp !== '123456' && otp !== entry.expectedOtp) {
      throw new OTPInvalidError();
    }

    // OTP consumed.
    otpStore.delete(entry.txnId);

    // Build the session.
    const now = Date.now();
    const expiresAt = new Date(now + 6 * 60 * 60 * 1000).toISOString(); // 6-hour session
    const authToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');

    const session: GSTSession = {
      authToken,
      refreshToken,
      gstin: gstin.toUpperCase(),
      username: username.trim(),
      expiresAt,
      metadata: { provider: 'mock', txnId: entry.txnId },
    };

    // Build the initial profile.
    const rng = mulberry32(hashSeed(gstin));
    const stateCode = validation.stateCode!;
    const state = GST_STATE_CODES[stateCode] ?? 'Unknown';
    const { legal, trade } = deriveBusinessName(rng);

    const profile: Partial<GSTProfile> = {
      gstin: gstin.toUpperCase(),
      legalName: legal,
      tradeName: trade,
      businessConstitution: pick(rng, CONSTITUTIONS),
      taxpayerType: pick(rng, TAXPAYER_TYPES),
      state,
      stateCode,
      jurisdiction: pick(rng, JURISDICTIONS),
      status: 'Active',
      filingFrequency: pick(rng, ['monthly', 'quarterly']),
      registrationDate: new Date(now - randInt(rng, 365, 3650) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };

    return { session, profile };
  }

  async refreshSession(session: GSTSession): Promise<{ session: GSTSession }> {
    if (!session.refreshToken) {
      throw new AuthenticationError('No refresh token available. Please reconnect.');
    }
    const now = Date.now();
    return {
      session: {
        ...session,
        authToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  async disconnect(session: GSTSession): Promise<void> {
    // Mock — nothing to clean up server-side. The Firestore doc is removed by the service.
    void session;
  }

  async verifyGSTIN(gstin: string): Promise<VerifyGSTINResult> {
    const validation = isValidGstin(gstin);
    if (!validation.valid) {
      throw new ValidationError('Invalid GSTIN format. Please check the 15-character GSTIN.');
    }
    const rng = mulberry32(hashSeed(gstin));
    const stateCode = validation.stateCode!;
    const state = GST_STATE_CODES[stateCode] ?? 'Unknown';
    const { legal, trade } = deriveBusinessName(rng);

    return {
      gstin: gstin.toUpperCase(),
      legalName: legal,
      tradeName: trade,
      stateCode,
      status: 'Active',
      businessConstitution: pick(rng, CONSTITUTIONS),
      taxpayerType: pick(rng, TAXPAYER_TYPES),
      registrationDate: new Date(Date.now() - randInt(rng, 365, 3650) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    };
  }

  async getProfile(session: GSTSession): Promise<GSTProfile> {
    const validation = isValidGstin(session.gstin);
    if (!validation.valid) {
      throw new ValidationError('Invalid GSTIN in session.');
    }
    const rng = mulberry32(hashSeed(session.gstin));
    const stateCode = validation.stateCode!;
    const state = GST_STATE_CODES[stateCode] ?? 'Unknown';
    const { legal, trade } = deriveBusinessName(rng);
    const nowIso = new Date().toISOString();

    return {
      id: `${session.gstin}-profile`,
      organizationId: '', // filled in by the service layer
      connectionId: '',   // filled in by the service layer
      gstin: session.gstin,
      legalName: legal,
      tradeName: trade,
      businessConstitution: pick(rng, CONSTITUTIONS),
      registrationDate: new Date(Date.now() - randInt(rng, 365, 3650) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      taxpayerType: pick(rng, TAXPAYER_TYPES),
      principalAddress: `${randInt(rng, 1, 200)}, ${pick(rng, ['MG Road', 'Brigade Road', 'Park Street', 'Linking Road', 'Anna Salai'])}, ${state} ${randInt(rng, 560001, 700099)}`,
      additionalPlaceOfBusiness: rng() < 0.3 ? [`${randInt(rng, 1, 100)}, Industrial Area, ${state}`] : [],
      state,
      stateCode,
      jurisdiction: pick(rng, JURISDICTIONS),
      status: 'Active',
      filingFrequency: pick(rng, ['monthly', 'quarterly']),
      lastUpdated: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  async syncReturns(
    session: GSTSession,
    options?: { period?: string; returnTypes?: GSTReturnType[] },
  ): Promise<{ returns: GSTReturn[] }> {
    const rng = mulberry32(hashSeed(session.gstin + (options?.period ?? 'current')));
    const periods = options?.period
      ? [options.period]
      : [currentPeriod(), previousPeriod()];
    const types: GSTReturnType[] = options?.returnTypes ?? ['GSTR-1', 'GSTR-3B', 'GSTR-2B', 'GSTR-9', 'GSTR-9C'];

    const returns: GSTReturn[] = [];
    for (const period of periods) {
      for (const type of types) {
        // GSTR-9/9C are annual — only generate once per FY (use the period as the FY-end marker).
        if ((type === 'GSTR-9' || type === 'GSTR-9C') && period !== periods[0]) continue;
        returns.push(
          generateReturn(rng, session.gstin, type, period, '', ''),
        );
      }
    }
    return { returns };
  }

  async syncNotices(session: GSTSession): Promise<{ notices: GSTNotice[] }> {
    const rng = mulberry32(hashSeed(session.gstin + '-notices'));
    const count = randInt(rng, 0, 4);
    const notices: GSTNotice[] = [];
    for (let i = 0; i < count; i++) {
      notices.push(generateNotice(rng, session.gstin, '', ''));
    }
    return { notices };
  }

  async syncLedgers(session: GSTSession): Promise<{
    cash: GSTLedger;
    credit: GSTLedger;
    liability: GSTLedger;
  }> {
    const rng = mulberry32(hashSeed(session.gstin + '-ledgers'));
    return {
      cash: generateLedger(rng, session.gstin, 'cash', '', ''),
      credit: generateLedger(rng, session.gstin, 'credit', '', ''),
      liability: generateLedger(rng, session.gstin, 'liability', '', ''),
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
