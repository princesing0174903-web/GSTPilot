// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle AI — Production Data Layer + Business Context Service
// ═══════════════════════════════════════════════════════════════════════════════
//
// Upgrade Phase 1 — STEP 1 (Production Data Layer) + STEP 3 (Business Context)
//
// ROLE
//   This module is the single source of truth that Oracle consults BEFORE
//   answering any business question. Oracle must NEVER answer from assumptions.
//   Every response must be grounded in real data retrieved live from:
//
//     • Firestore  — operational collections (invoices, returns, reconciliations,
//                    clients, bank_accounts, bank_transactions, gst_profiles,
//                    gst_returns, expenses, payments, notices, reports, tasks,
//                    activities, organizations) via the Firebase Admin SDK
//                    singleton `adminDb()` from `@/lib/firebase-admin`. The
//                    admin SDK bypasses security rules and is server-only —
//                    perfect for API routes / server-side lib code.
//
//     • Prisma     — relational models (Invoice, PurchaseBill, Expense, Payment,
//                    GSTRFiling, Client, BankAccount, BankTransaction) via
//                    `db` from `@/lib/db` (db IS the PrismaClient singleton).
//
// GUARANTEES
//   1. Never throws — every fetch is wrapped in try/catch. A failing source
//      downgrades that source's `dataAvailability` to 'error' but never breaks
//      the whole snapshot.
//   2. Tracks `dataAvailability` per source as 'connected' | 'empty' | 'error'
//      so Oracle can honestly tell the user "I don't have bank data — please
//      connect your bank" instead of inventing a cash balance.
//   3. Parallel fetches via `Promise.all` — targets <500ms total.
//   4. 15-second in-memory cache keyed by organizationId so a chat burst
//      does not hammer Firestore/Prisma.
//   5. Auto-assembles `BusinessContext` (financial year, GST period, cash
//      position, compliance status, data gaps) without manual selection.
//   6. `formatContextForLLM()` produces a concise (<2000 token) text block
//      that makes BOTH the available data AND the missing data explicit —
//      so the LLM knows what it can answer and what it must refuse to guess.
//
// TECHNICAL NOTES
//   • `'use server'` is intentionally NOT set — this is a pure lib module
//     imported by API routes (`/api/oracle/*`) and other server-side lib code.
//   • All timestamps are normalized to ISO strings.
//   • All money amounts are raw numbers (INR). Use `formatINR()` for display.
//   • Indian FY runs Apr–Mar. e.g. 14 May 2024 → "FY 2024-25".
//   • GST period is the current month as "MM-YYYY".
//   • Note on `@/lib/db`: despite the name, this exports the PrismaClient
//     singleton (`db`), NOT Firestore. Firestore is reached via `adminDb()`
//     from `@/lib/firebase-admin` (server-only Admin SDK singleton).
// ═══════════════════════════════════════════════════════════════════════════════

import { db as prisma } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/firestore-schema';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/** Per-source availability — Oracle must know what's missing. */
export type DataSourceName =
  | 'invoices' | 'clients' | 'gstReturns' | 'gstProfiles'
  | 'bankAccounts' | 'bankTransactions' | 'payments' | 'expenses'
  | 'notices' | 'reports' | 'tasks' | 'recentActivities'
  | 'documents' | 'organizations'
  | 'purchaseBills'  // Prisma-only
  | 'prismaInvoices' // Prisma cross-check
  | 'prismaClients'; // Prisma cross-check

export type DataAvailabilityStatus = 'connected' | 'empty' | 'error';

export interface DataAvailability {
  /** Per-source status: 'connected' (≥1 record), 'empty' (0 records), 'error' (fetch failed). */
  status: Partial<Record<DataSourceName, DataAvailabilityStatus>>;
  /** Human-readable error messages for sources that failed. */
  errors: Array<{ source: DataSourceName; message: string; at: string }>;
  /** ISO timestamp when the snapshot was assembled. */
  gatheredAt: string;
  /** Total elapsed milliseconds for the gather. */
  elapsedMs: number;
}

// ─── Lightweight record shapes (only fields Oracle needs) ──────────────────
// We intentionally keep these lean — passing 50 full invoice docs into an LLM
// prompt would blow the token budget. Only the fields Oracle needs to reason
// about receivables, overdue, GST liability, etc. are included.

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  clientId: string | null;
  buyerName: string | null;
  totalAmount: number;
  taxableValue: number;
  cgst: number; sgst: number; igst: number; cess: number;
  status: string;
  paymentStatus: string;
  balanceAmount: number;
  paidAmount: number;
  source: 'firestore' | 'prisma';
}

export interface ClientSummary {
  id: string;
  tradeName: string;
  legalName: string | null;
  gstin: string | null;
  status: string;
  healthScore: number;
  receivable: number;
  invoiceCount: number;
  lastFilingDate: string | null;
  source: 'firestore' | 'prisma';
}

export interface GstReturnSummary {
  id: string;
  returnType: string;
  period: string;
  financialYear: string | null;
  status: string;
  totalTaxableValue: number;
  totalTax: number;
  totalItc: number;
  netPayable: number;
  dueDate: string | null;
  filingDate: string | null;
  acknowledgmentNumber: string | null;
  source: 'firestore' | 'prisma';
}

export interface GstProfileSummary {
  id: string;
  gstin: string;
  legalName: string;
  tradeName: string | null;
  status: string;
  taxpayerType: string;
  filingFrequency: string;
  lastReturnPeriod: string | null;
  complianceRating: number;
  state: string | null;
}

export interface BankAccountSummary {
  id: string;
  bankName: string;
  accountNumberMasked: string;
  accountType: string;
  ifsc: string | null;
  currentBalance: number;
  availableBalance: number;
  currency: string;
  status: string;
  lastSyncAt: string | null;
  source: 'firestore' | 'prisma';
}

export interface BankTransactionSummary {
  id: string;
  bankAccountId: string | null;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string | null;
  reconciled: boolean;
  referenceNo: string | null;
}

export interface PaymentSummary {
  id: string;
  clientId: string | null;
  invoiceId: string | null;
  partyName: string;
  partyType: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNo: string | null;
  status: string;
  reconciled: boolean;
  source: 'firestore' | 'prisma';
}

export interface ExpenseSummary {
  id: string;
  clientId: string | null;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  gst: number;
  gstClaimable: boolean;
  date: string;
  paymentMode: string | null;
  status: string;
  source: 'firestore' | 'prisma';
}

export interface PurchaseBillSummary {
  id: string;
  clientId: string | null;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  taxableValue: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentStatus: string;
  category: string | null;
}

export interface NoticeSummary {
  id: string;
  clientId: string | null;
  clientTradeName: string | null;
  noticeType: string;
  noticeNumber: string | null;
  noticeDate: string | null;
  subject: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
}

export interface ReportSummary {
  id: string;
  clientId: string | null;
  reportType: string;
  format: string;
  title: string;
  period: string | null;
  status: string;
  fileSize: number;
  storageUrl: string | null;
  generatedBy: string;
  generatedAt: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  clientId: string | null;
  dueDate: string | null;
  tags: string[];
}

export interface ActivitySummary {
  id: string;
  type: string;
  title: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  userId: string | null;
  createdAt: string;
}

export interface DocumentSummary {
  id: string;
  fileName: string;
  documentType: string;
  status: string;
  extractionStatus: string;
  extractedInvoiceCount: number;
  extractionAccuracy: number;
  period: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  plan: string;
  ownerId: string;
  firmIds: string[];
}

// ─── Derived metrics (computed in-memory from the raw records) ─────────────

export interface DerivedMetrics {
  totalReceivables: number;
  totalPayables: number;
  cashBalance: number;
  gstLiability: number;
  overdueInvoices: number;
  overdueInvoiceAmount: number;
  complianceScore: number;          // 0–100
  monthlyRevenue: number;
  monthlyExpenses: number;
  totalInvoices: number;
  totalClients: number;
  totalGstReturns: number;
  pendingGstReturns: number;
  overdueGstReturns: number;
  activeNotices: number;
  openTasks: number;
  bankConnected: boolean;
  inflow30d: number;
  outflow30d: number;
  runwayDays: number;
}

// ─── Production data snapshot (top-level return type) ───────────────────────

export interface ProductionDataSnapshot {
  organizationId: string;
  firmId: string | null;
  userId: string | null;
  gatheredAt: string;
  elapsedMs: number;
  organization: OrganizationSummary | null;
  invoices: InvoiceSummary[];
  clients: ClientSummary[];
  gstReturns: GstReturnSummary[];
  gstProfiles: GstProfileSummary[];
  bankAccounts: BankAccountSummary[];
  bankTransactions: BankTransactionSummary[];
  payments: PaymentSummary[];
  expenses: ExpenseSummary[];
  purchaseBills: PurchaseBillSummary[];
  notices: NoticeSummary[];
  reports: ReportSummary[];
  tasks: TaskSummary[];
  recentActivities: ActivitySummary[];
  documents: DocumentSummary[];
  derived: DerivedMetrics;
  dataAvailability: DataAvailability;
}

// ─── Business Context (auto-assembled for the LLM system prompt) ────────────

export interface BusinessContext {
  gatheredAt: string;
  organization: { id: string; name: string; plan: string };
  userId: string | null;
  userEmail: string | null;
  financialYear: string;          // e.g. "FY 2024-25"
  gstPeriod: string;              // e.g. "05-2024"
  today: string;                  // ISO date
  connectedBankAccounts: { count: number; accounts: BankAccountSummary[] };
  connectedAIProviders: string[]; // env-driven, defaults to ['zai']
  invoiceSummary: {
    total: number; draft: number; sent: number; paid: number; overdue: number;
    totalAmount: number; overdueAmount: number;
  };
  clientCount: number;
  topClients: Array<{ tradeName: string; gstin: string | null; receivable: number; invoiceCount: number }>;
  pendingPayments: { count: number; totalAmount: number };
  complianceStatus: {
    score: number;
    pendingReturns: number;
    overdueReturns: number;
    nextDeadline: string | null;
    activeNotices: number;
  };
  /** Placeholder — populated by chat history layer when available. */
  recentConversations: Array<{ role: string; preview: string; at: string }>;
  cashPosition: {
    balance: number; inflow30d: number; outflow30d: number; runwayDays: number;
  };
  /** Plain-text descriptions of missing data — fed to the LLM so it knows what NOT to invent. */
  dataGaps: string[];
  /** Token estimate of the formatted context block (chars / 4). */
  estimatedTokens: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Minimal structural shape we consume from a Firestore QuerySnapshot.
 * Using a local type avoids importing the `FirebaseFirestore` namespace
 * (which lives inside `firebase-admin/firestore`'s UMD types and isn't
 * always picked up by tsc's bundler resolution). Pattern copied from
 * `src/lib/analytics/production-analytics.ts`.
 */
interface SnapshotLike {
  docs: Array<{ id: string; data(): Record<string, unknown> }>;
  size: number;
  exists?: boolean;
}

const EMPTY_SNAP: SnapshotLike = { docs: [], size: 0, exists: false };

/** 1 lakh = 100,000. 1 crore = 10,000,000. Format INR with Indian shorthand. */
export function formatINR(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/** Indian financial year (Apr–Mar) from a date. e.g. 14 May 2024 → "FY 2024-25". */
export function indianFinancialYear(date: Date = new Date()): string {
  const y = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? y : y - 1; // Apr (3) onwards → FY starts this year
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** GST return period as "MM-YYYY" for the current month. */
export function currentGstPeriod(date: Date = new Date()): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

/** Safely coerce any Firestore/Prisma timestamp-ish value to an ISO string. */
function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try { return (v as { toDate: () => Date }).toDate().toISOString(); } catch { return null; }
  }
  if (typeof v === 'number') {
    try { return new Date(v > 1e12 ? v : v * 1000).toISOString(); } catch { return null; }
  }
  return null;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function safeStr(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function optStr(v: unknown): string | null {
  const s = safeStr(v, '');
  return s || null;
}

/** Build a where-clause for Prisma queries scoped by firmId via the client relation. */
function prismaFirmFilter(firmId: string | null) {
  return firmId ? { client: { firmId } } : {};
}

// ─── Per-source gather result ──────────────────────────────────────────────

interface GatherResult<T> {
  data: T[];
  status: DataAvailabilityStatus;
  error?: string;
}

function ok<T>(data: T[]): GatherResult<T> {
  return { data, status: data.length > 0 ? 'connected' : 'empty' };
}
function fail<T>(msg: string): GatherResult<T> {
  return { data: [], status: 'error', error: msg };
}

/** Run a Firestore collection .get() with graceful catch → EMPTY_SNAP. */
async function safeGet(label: string, query: Promise<unknown>): Promise<SnapshotLike> {
  try {
    const snap = await query;
    // The actual type is FirebaseFirestore.QuerySnapshot; structurally matches SnapshotLike.
    return snap as SnapshotLike;
  } catch (err) {
    console.warn(`[Oracle Production Data] "${label}" failed:`, err);
    return EMPTY_SNAP;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE GATHERERS — one per collection (server-side via Admin SDK).
// Each returns a GatherResult; never throws.
// ═══════════════════════════════════════════════════════════════════════════

async function gatherFirestoreInvoices(organizationId: string): Promise<GatherResult<InvoiceSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.invoices',
      firestore.collection(COLLECTIONS.INVOICES).where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').limit(50).get());
    if (snap === EMPTY_SNAP) return fail<InvoiceSummary>('query failed');
    const out: InvoiceSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        invoiceNumber: safeStr(d.invoiceNumber),
        invoiceDate: safeStr(d.invoiceDate),
        dueDate: optStr(d.dueDate),
        clientId: optStr(d.clientId),
        buyerName: optStr(d.buyerName),
        totalAmount: safeNum(d.totalAmount),
        taxableValue: safeNum(d.taxableValue),
        cgst: safeNum(d.cgst), sgst: safeNum(d.sgst), igst: safeNum(d.igst), cess: safeNum(d.cess),
        status: safeStr(d.status, 'draft'),
        paymentStatus: safeStr(d.paymentStatus, 'unpaid'),
        balanceAmount: safeNum(d.balanceAmount),
        paidAmount: safeNum(d.paidAmount),
        source: 'firestore',
      };
    });
    return ok(out);
  } catch (err) {
    return fail<InvoiceSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreClients(organizationId: string): Promise<GatherResult<ClientSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.clients',
      firestore.collection(COLLECTIONS.CLIENTS).where('organizationId', '==', organizationId).limit(200).get());
    if (snap === EMPTY_SNAP) return fail<ClientSummary>('query failed');
    const out: ClientSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        tradeName: safeStr(d.tradeName),
        legalName: optStr(d.legalName),
        gstin: optStr(d.gstin),
        status: safeStr(d.status, 'active'),
        healthScore: safeNum(d.healthScore),
        receivable: 0,
        invoiceCount: safeNum(d.invoiceCount),
        lastFilingDate: optStr(d.lastFilingDate),
        source: 'firestore',
      };
    });
    return ok(out);
  } catch (err) {
    return fail<ClientSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreGstReturns(organizationId: string): Promise<GatherResult<GstReturnSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.gst_returns',
      firestore.collection(COLLECTIONS.GST_RETURNS).where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').limit(50).get());
    if (snap === EMPTY_SNAP) return fail<GstReturnSummary>('query failed');
    const out: GstReturnSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        returnType: safeStr(d.returnType, 'GSTR-1'),
        period: safeStr(d.period),
        financialYear: optStr(d.financialYear),
        status: safeStr(d.status, 'draft'),
        totalTaxableValue: safeNum(d.totalTaxableValue),
        totalTax: safeNum(d.totalTax),
        totalItc: safeNum(d.totalItc),
        netPayable: safeNum(d.netPayable),
        dueDate: optStr(d.dueDate),
        filingDate: optStr(d.filingDate),
        acknowledgmentNumber: optStr(d.acknowledgmentNumber),
        source: 'firestore',
      };
    });
    return ok(out);
  } catch (err) {
    return fail<GstReturnSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreGstProfiles(organizationId: string): Promise<GatherResult<GstProfileSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.gst_profiles',
      firestore.collection(COLLECTIONS.GST_PROFILES).where('organizationId', '==', organizationId).get());
    if (snap === EMPTY_SNAP) return fail<GstProfileSummary>('query failed');
    const out: GstProfileSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      const jurisdiction = (d.jurisdiction ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        gstin: safeStr(d.gstin),
        legalName: safeStr(d.legalName),
        tradeName: optStr(d.tradeName),
        status: safeStr(d.status, 'active'),
        taxpayerType: safeStr(d.taxpayerType, 'regular'),
        filingFrequency: safeStr(d.filingFrequency, 'monthly'),
        lastReturnPeriod: optStr(d.lastReturnPeriod),
        complianceRating: safeNum(d.complianceRating),
        state: optStr(jurisdiction.state),
      };
    });
    return ok(out);
  } catch (err) {
    return fail<GstProfileSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreBankAccounts(organizationId: string): Promise<GatherResult<BankAccountSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.bank_accounts',
      firestore.collection(COLLECTIONS.BANK_ACCOUNTS).where('organizationId', '==', organizationId).get());
    if (snap === EMPTY_SNAP) return fail<BankAccountSummary>('query failed');
    const out: BankAccountSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        bankName: safeStr(d.bankName),
        accountNumberMasked: safeStr(d.accountNumberMasked),
        accountType: safeStr(d.accountType, 'savings'),
        ifsc: optStr(d.ifsc),
        currentBalance: safeNum(d.currentBalance),
        availableBalance: safeNum(d.availableBalance),
        currency: safeStr(d.currency, 'INR'),
        status: safeStr(d.status, 'disconnected'),
        lastSyncAt: toIso(d.lastSyncAt),
        source: 'firestore',
      };
    });
    return ok(out);
  } catch (err) {
    return fail<BankAccountSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreBankTransactions(organizationId: string): Promise<GatherResult<BankTransactionSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.bank_transactions',
      firestore.collection(COLLECTIONS.BANK_TRANSACTIONS).where('organizationId', '==', organizationId).orderBy('date', 'desc').limit(100).get());
    if (snap === EMPTY_SNAP) return fail<BankTransactionSummary>('query failed');
    const out: BankTransactionSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      const amount = safeNum(d.amount);
      return {
        id: doc.id,
        bankAccountId: optStr(d.bankAccountId),
        date: safeStr(d.date),
        description: safeStr(d.description),
        amount,
        type: safeStr(d.type, amount >= 0 ? 'credit' : 'debit'),
        category: optStr(d.category),
        reconciled: !!d.reconciled,
        referenceNo: optStr(d.referenceNo),
      };
    });
    return ok(out);
  } catch (err) {
    return fail<BankTransactionSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestorePayments(organizationId: string): Promise<GatherResult<PaymentSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.payments',
      firestore.collection(COLLECTIONS.PAYMENTS).where('organizationId', '==', organizationId).orderBy('paymentDate', 'desc').limit(50).get());
    if (snap === EMPTY_SNAP) return fail<PaymentSummary>('query failed');
    const out: PaymentSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        clientId: optStr(d.clientId),
        invoiceId: optStr(d.invoiceId),
        partyName: safeStr(d.partyName),
        partyType: safeStr(d.partyType, 'customer'),
        amount: safeNum(d.amount),
        paymentDate: safeStr(d.paymentDate),
        paymentMode: safeStr(d.paymentMode, 'upi'),
        referenceNo: optStr(d.referenceNo),
        status: safeStr(d.status, 'pending'),
        reconciled: !!d.reconciled,
        source: 'firestore',
      };
    });
    return ok(out);
  } catch (err) {
    return fail<PaymentSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreExpenses(organizationId: string): Promise<GatherResult<ExpenseSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.expenses',
      firestore.collection(COLLECTIONS.EXPENSES).where('organizationId', '==', organizationId).orderBy('date', 'desc').limit(50).get());
    if (snap === EMPTY_SNAP) return fail<ExpenseSummary>('query failed');
    const out: ExpenseSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        clientId: optStr(d.clientId),
        category: safeStr(d.category, 'Miscellaneous'),
        description: optStr(d.description),
        vendor: optStr(d.vendor),
        amount: safeNum(d.amount),
        gst: safeNum(d.gst),
        gstClaimable: !!d.gstClaimable,
        date: safeStr(d.date),
        paymentMode: optStr(d.paymentMode),
        status: safeStr(d.status, 'recorded'),
        source: 'firestore',
      };
    });
    return ok(out);
  } catch (err) {
    return fail<ExpenseSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreNotices(organizationId: string): Promise<GatherResult<NoticeSummary>> {
  try {
    const firestore = adminDb();
    // Firestore can't efficiently do "not-in" — fetch all and filter in-memory.
    const snap = await safeGet('firestore.notices',
      firestore.collection(COLLECTIONS.NOTICES).where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').limit(100).get());
    if (snap === EMPTY_SNAP) return fail<NoticeSummary>('query failed');
    const out: NoticeSummary[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const status = safeStr(d.status, 'open');
      if (status === 'closed' || status === 'resolved') continue;
      out.push({
        id: doc.id,
        clientId: optStr(d.clientId),
        clientTradeName: optStr(d.clientTradeName),
        noticeType: safeStr(d.noticeType, 'other'),
        noticeNumber: optStr(d.noticeNumber),
        noticeDate: optStr(d.noticeDate),
        subject: safeStr(d.subject),
        status,
        priority: safeStr(d.priority, 'medium'),
        dueDate: optStr(d.dueDate),
        assignedTo: optStr(d.assignedTo),
        assigneeName: optStr(d.assigneeName),
      });
    }
    return ok(out);
  } catch (err) {
    return fail<NoticeSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreReports(organizationId: string): Promise<GatherResult<ReportSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.reports',
      firestore.collection(COLLECTIONS.REPORTS).where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').limit(30).get());
    if (snap === EMPTY_SNAP) return fail<ReportSummary>('query failed');
    const out: ReportSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        clientId: optStr(d.clientId),
        reportType: safeStr(d.reportType, 'custom'),
        format: safeStr(d.format, 'json'),
        title: safeStr(d.title),
        period: optStr(d.period),
        status: safeStr(d.status, 'ready'),
        fileSize: safeNum(d.fileSize),
        storageUrl: optStr(d.storageUrl),
        generatedBy: safeStr(d.generatedBy),
        generatedAt: toIso(d.generatedAt) ?? safeStr(d.generatedAt),
      };
    });
    return ok(out);
  } catch (err) {
    return fail<ReportSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreTasks(organizationId: string): Promise<GatherResult<TaskSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.tasks',
      firestore.collection(COLLECTIONS.TASKS).where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').limit(100).get());
    if (snap === EMPTY_SNAP) return fail<TaskSummary>('query failed');
    const out: TaskSummary[] = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      const status = safeStr(d.status, 'todo');
      if (status === 'completed' || status === 'cancelled') continue; // only open tasks
      out.push({
        id: doc.id,
        title: safeStr(d.title),
        description: safeStr(d.description),
        status,
        priority: safeStr(d.priority, 'medium'),
        assignedTo: optStr(d.assignedTo),
        clientId: optStr(d.clientId),
        dueDate: optStr(d.dueDate),
        tags: Array.isArray(d.tags) ? d.tags.map((t) => safeStr(t)) : [],
      });
    }
    return ok(out);
  } catch (err) {
    return fail<TaskSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreActivities(organizationId: string): Promise<GatherResult<ActivitySummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.activities',
      firestore.collection(COLLECTIONS.ACTIVITIES).where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').limit(20).get());
    if (snap === EMPTY_SNAP) return fail<ActivitySummary>('query failed');
    const out: ActivitySummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: safeStr(d.type, 'system'),
        title: safeStr(d.title),
        description: safeStr(d.description),
        entityType: optStr(d.entityType),
        entityId: optStr(d.entityId),
        userId: optStr(d.userId),
        createdAt: toIso(d.createdAt) ?? new Date().toISOString(),
      };
    });
    return ok(out);
  } catch (err) {
    return fail<ActivitySummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreDocuments(organizationId: string): Promise<GatherResult<DocumentSummary>> {
  try {
    const firestore = adminDb();
    const snap = await safeGet('firestore.documents',
      firestore.collection(COLLECTIONS.DOCUMENTS).where('organizationId', '==', organizationId).orderBy('createdAt', 'desc').limit(30).get());
    if (snap === EMPTY_SNAP) return fail<DocumentSummary>('query failed');
    const out: DocumentSummary[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        fileName: safeStr(d.fileName),
        documentType: safeStr(d.documentType, 'other'),
        status: safeStr(d.status, 'uploading'),
        extractionStatus: safeStr(d.extractionStatus, 'pending'),
        extractedInvoiceCount: safeNum(d.extractedInvoiceCount),
        extractionAccuracy: safeNum(d.extractionAccuracy),
        period: optStr(d.period),
        uploadedBy: safeStr(d.uploadedBy),
        createdAt: toIso(d.createdAt) ?? new Date().toISOString(),
      };
    });
    return ok(out);
  } catch (err) {
    return fail<DocumentSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherFirestoreOrganization(organizationId: string): Promise<OrganizationSummary | null> {
  try {
    const firestore = adminDb();
    const docSnap = await safeGet('firestore.organizations',
      firestore.collection(COLLECTIONS.ORGANIZATIONS).doc(organizationId).get());
    if (docSnap === EMPTY_SNAP || !docSnap.exists) return null;
    const d = docSnap.docs[0]?.data();
    if (!d) return null;
    return {
      id: organizationId,
      name: safeStr(d.name, 'Unknown Organization'),
      plan: safeStr(d.plan, 'free'),
      ownerId: safeStr(d.ownerId),
      firmIds: Array.isArray(d.firmIds) ? d.firmIds.map((f) => safeStr(f)) : [],
    };
  } catch (err) {
    console.warn('[Oracle Production Data] organization fetch failed:', err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PRISMA GATHERERS — cross-check / supplement to Firestore.
// Prisma is the relational source-of-truth for: Invoice, PurchaseBill,
// Expense, Payment, GSTRFiling, Client, BankAccount, BankTransaction.
// ═══════════════════════════════════════════════════════════════════════════

async function gatherPrismaInvoices(firmId: string | null): Promise<GatherResult<InvoiceSummary>> {
  try {
    const rows = await prisma.invoice.findMany({
      where: prismaFirmFilter(firmId),
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, invoiceNumber: true, invoiceDate: true, dueDate: true,
        clientId: true, buyerName: true, totalAmount: true, taxableValue: true,
        cgst: true, sgst: true, igst: true, cess: true, status: true,
        paymentStatus: true, balanceAmount: true, paidAmount: true,
      },
    }).catch((err: unknown) => {
      console.warn('[Oracle Production Data] prisma.invoice.findMany failed:', err);
      return [];
    });
    const out: InvoiceSummary[] = rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      invoiceDate: r.invoiceDate,
      dueDate: r.dueDate ?? null,
      clientId: r.clientId ?? null,
      buyerName: r.buyerName ?? null,
      totalAmount: r.totalAmount,
      taxableValue: r.taxableValue,
      cgst: r.cgst, sgst: r.sgst, igst: r.igst, cess: r.cess,
      status: r.status,
      paymentStatus: r.paymentStatus,
      balanceAmount: r.balanceAmount,
      paidAmount: r.paidAmount,
      source: 'prisma',
    }));
    return ok(out);
  } catch (err) {
    return fail<InvoiceSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherPrismaClients(firmId: string | null): Promise<GatherResult<ClientSummary>> {
  try {
    const rows = await prisma.client.findMany({
      where: firmId ? { firmId } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true, tradeName: true, legalName: true, gstin: true,
        status: true, healthScore: true, lastFilingDate: true, firmId: true,
      },
    }).catch((err: unknown) => {
      console.warn('[Oracle Production Data] prisma.client.findMany failed:', err);
      return [];
    });
    const out: ClientSummary[] = rows.map((r) => ({
      id: r.id,
      tradeName: r.tradeName,
      legalName: r.legalName ?? null,
      gstin: r.gstin ?? null,
      status: r.status,
      healthScore: r.healthScore,
      receivable: 0,
      invoiceCount: 0,
      lastFilingDate: r.lastFilingDate ?? null,
      source: 'prisma',
    }));
    return ok(out);
  } catch (err) {
    return fail<ClientSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherPrismaPurchaseBills(firmId: string | null): Promise<GatherResult<PurchaseBillSummary>> {
  try {
    const rows = await prisma.purchaseBill.findMany({
      where: prismaFirmFilter(firmId),
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, clientId: true, vendorName: true, vendorGstin: true, invoiceNo: true,
        invoiceDate: true, dueDate: true, taxableValue: true, gstAmount: true,
        totalAmount: true, paidAmount: true, balanceAmount: true, status: true,
        paymentStatus: true, category: true,
      },
    }).catch((err: unknown) => {
      console.warn('[Oracle Production Data] prisma.purchaseBill.findMany failed:', err);
      return [];
    });
    const out: PurchaseBillSummary[] = rows.map((r) => ({
      id: r.id,
      clientId: r.clientId ?? null,
      vendorName: r.vendorName,
      vendorGstin: r.vendorGstin ?? null,
      invoiceNo: r.invoiceNo,
      invoiceDate: r.invoiceDate,
      dueDate: r.dueDate ?? null,
      taxableValue: r.taxableValue,
      gstAmount: r.gstAmount,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      balanceAmount: r.balanceAmount,
      status: r.status,
      paymentStatus: r.paymentStatus,
      category: r.category ?? null,
    }));
    return ok(out);
  } catch (err) {
    return fail<PurchaseBillSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherPrismaBankAccounts(): Promise<GatherResult<BankAccountSummary>> {
  try {
    const rows = await prisma.bankAccount.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, bankName: true, accountMasked: true, accountType: true,
        ifsc: true, balance: true, availableBalance: true, status: true, lastSyncAt: true,
      },
    }).catch((err: unknown) => {
      console.warn('[Oracle Production Data] prisma.bankAccount.findMany failed:', err);
      return [];
    });
    const out: BankAccountSummary[] = rows.map((r) => ({
      id: r.id,
      bankName: r.bankName,
      accountNumberMasked: r.accountMasked,
      accountType: r.accountType,
      ifsc: r.ifsc ?? null,
      currentBalance: r.balance,
      availableBalance: r.availableBalance,
      currency: 'INR',
      status: r.status,
      lastSyncAt: r.lastSyncAt instanceof Date ? r.lastSyncAt.toISOString() : null,
      source: 'prisma',
    }));
    return ok(out);
  } catch (err) {
    return fail<BankAccountSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

async function gatherPrismaBankTransactions(): Promise<GatherResult<BankTransactionSummary>> {
  try {
    const rows = await prisma.bankTransaction.findMany({
      orderBy: { date: 'desc' },
      take: 100,
      select: {
        id: true, accountId: true, date: true, description: true,
        amount: true, type: true, category: true, referenceNo: true, matched: true,
      },
    }).catch((err: unknown) => {
      console.warn('[Oracle Production Data] prisma.bankTransaction.findMany failed:', err);
      return [];
    });
    const out: BankTransactionSummary[] = rows.map((r) => ({
      id: r.id,
      bankAccountId: r.accountId ?? null,
      date: r.date instanceof Date ? r.date.toISOString() : String(r.date),
      description: r.description,
      amount: r.amount,
      type: r.type,
      category: r.category ?? null,
      reconciled: !!r.matched,
      referenceNo: r.referenceNo ?? null,
    }));
    return ok(out);
  } catch (err) {
    return fail<BankTransactionSummary>(err instanceof Error ? err.message : 'unknown error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DERIVED METRICS — computed in-memory from the snapshot. No extra DB calls.
// ═══════════════════════════════════════════════════════════════════════════

function isOverdueInvoice(inv: InvoiceSummary): boolean {
  if (inv.paymentStatus === 'overdue') return true;
  if (inv.paymentStatus === 'paid') return false;
  if (!inv.dueDate) return false;
  try { return new Date(inv.dueDate).getTime() < Date.now() && inv.balanceAmount > 0; } catch { return false; }
}

function isCurrentMonth(dateStr: string | null): boolean {
  if (!dateStr) return false;
  try {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } catch { return false; }
}

function isWithin30d(dateStr: string | null): boolean {
  if (!dateStr) return false;
  try { return Date.now() - new Date(dateStr).getTime() <= 30 * 24 * 60 * 60 * 1000; } catch { return false; }
}

/** Weighted compliance score (0–100). */
function computeComplianceScore(gstReturns: GstReturnSummary[], activeNotices: number, overdueInvoices: number): number {
  let score = 100;
  const pending = gstReturns.filter((r) => r.status === 'draft' || r.status === 'prepared').length;
  score -= Math.min(pending * 5, 30);
  const overdue = gstReturns.filter((r) => r.status === 'overdue').length;
  score -= Math.min(overdue * 10, 40);
  score -= Math.min(activeNotices * 5, 20);
  score -= Math.min(overdueInvoices * 1, 10);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function computeDerivedMetrics(snap: Omit<ProductionDataSnapshot, 'derived' | 'dataAvailability'>): DerivedMetrics {
  const { invoices, clients, gstReturns, bankAccounts, bankTransactions, purchaseBills, notices, tasks, expenses } = snap;

  const activeInvoices = invoices.filter((i) => i.status !== 'cancelled' && i.paymentStatus !== 'paid');
  const totalReceivables = activeInvoices.reduce((s, i) => s + (i.balanceAmount > 0 ? i.balanceAmount : i.totalAmount - i.paidAmount), 0);

  const activeBills = purchaseBills.filter((p) => p.paymentStatus !== 'paid');
  const totalPayables = activeBills.reduce((s, p) => s + (p.balanceAmount > 0 ? p.balanceAmount : p.totalAmount - p.paidAmount), 0);

  const cashBalance = bankAccounts.filter((a) => a.status === 'connected').reduce((s, a) => s + a.currentBalance, 0);

  const unfiledReturns = gstReturns.filter((r) => r.status !== 'filed' && r.status !== 'acknowledged');
  const gstLiability = unfiledReturns.reduce((s, r) => s + (r.netPayable > 0 ? r.netPayable : 0), 0);

  const overdueInvList = invoices.filter(isOverdueInvoice);
  const overdueInvoices = overdueInvList.length;
  const overdueInvoiceAmount = overdueInvList.reduce((s, i) => s + (i.balanceAmount > 0 ? i.balanceAmount : i.totalAmount - i.paidAmount), 0);

  const monthlyRevenue = invoices
    .filter((i) => i.status !== 'draft' && i.status !== 'cancelled' && isCurrentMonth(i.invoiceDate))
    .reduce((s, i) => s + i.totalAmount, 0);
  const monthlyExpenses =
    expenses.filter((e) => isCurrentMonth(e.date)).reduce((s, e) => s + e.amount, 0) +
    purchaseBills.filter((p) => isCurrentMonth(p.invoiceDate)).reduce((s, p) => s + p.totalAmount, 0);

  const recentTxns = bankTransactions.filter((t) => isWithin30d(t.date));
  const inflow30d = recentTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow30d = Math.abs(recentTxns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0));
  const dailyBurn = Math.max(outflow30d / 30, 1);
  const runwayDays = cashBalance > 0 ? Math.floor(cashBalance / dailyBurn) : 0;

  const now = Date.now();
  const pendingGstReturns = gstReturns.filter(
    (r) => (r.status === 'draft' || r.status === 'prepared') && (!r.dueDate || new Date(r.dueDate).getTime() >= now - 7 * 86_400_000),
  ).length;
  const overdueGstReturns = gstReturns.filter(
    (r) => r.status === 'overdue' || (r.dueDate && new Date(r.dueDate).getTime() < now && r.status !== 'filed' && r.status !== 'acknowledged'),
  ).length;

  const activeNotices = notices.filter((n) => n.status !== 'closed' && n.status !== 'resolved').length;
  const openTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress' || t.status === 'review').length;
  const bankConnected = bankAccounts.some((a) => a.status === 'connected');

  return {
    totalReceivables, totalPayables, cashBalance, gstLiability,
    overdueInvoices, overdueInvoiceAmount,
    complianceScore: computeComplianceScore(gstReturns, activeNotices, overdueInvoices),
    monthlyRevenue, monthlyExpenses,
    totalInvoices: invoices.length, totalClients: clients.length,
    totalGstReturns: gstReturns.length,
    pendingGstReturns, overdueGstReturns,
    activeNotices, openTasks, bankConnected,
    inflow30d, outflow30d, runwayDays,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY — getProductionDataSnapshot()
// Runs all gatherers in parallel and merges results. Never throws.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retrieve a complete ProductionDataSnapshot for the given organization.
 *
 * @param organizationId Firestore organizationId scope (required)
 * @param firmId         Optional Prisma firmId scope (Client.firmId). If null,
 *                       Prisma queries are unscoped (dev/preview mode).
 * @param userId         Optional user id (reserved for future per-user filters).
 * @returns ProductionDataSnapshot — never throws.
 */
export async function getProductionDataSnapshot(
  organizationId: string,
  firmId: string | null = null,
  userId: string | null = null,
): Promise<ProductionDataSnapshot> {
  const cacheKey = `${organizationId}::${firmId ?? ''}::${userId ?? ''}`;
  const cached = SNAPSHOT_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < SNAPSHOT_CACHE_TTL_MS) {
    return cached.snapshot;
  }

  const t0 = Date.now();
  const gatheredAt = new Date().toISOString();

  // ── Parallel gather — every source independent, every fetch fault-tolerant ──
  const [
    orgResult, fsInvoices, fsClients, fsGstReturns, fsGstProfiles,
    fsBankAccounts, fsBankTxns, fsPayments, fsExpenses, fsNotices,
    fsReports, fsTasks, fsActivities, fsDocuments,
    prismaInvoices, prismaClients, prismaPurchaseBills,
    prismaBankAccounts, prismaBankTxns,
  ] = await Promise.all([
    gatherFirestoreOrganization(organizationId),
    gatherFirestoreInvoices(organizationId),
    gatherFirestoreClients(organizationId),
    gatherFirestoreGstReturns(organizationId),
    gatherFirestoreGstProfiles(organizationId),
    gatherFirestoreBankAccounts(organizationId),
    gatherFirestoreBankTransactions(organizationId),
    gatherFirestorePayments(organizationId),
    gatherFirestoreExpenses(organizationId),
    gatherFirestoreNotices(organizationId),
    gatherFirestoreReports(organizationId),
    gatherFirestoreTasks(organizationId),
    gatherFirestoreActivities(organizationId),
    gatherFirestoreDocuments(organizationId),
    gatherPrismaInvoices(firmId),
    gatherPrismaClients(firmId),
    gatherPrismaPurchaseBills(firmId),
    gatherPrismaBankAccounts(),
    gatherPrismaBankTransactions(),
  ]);

  // ── Merge: prefer Firestore; fall back to Prisma when Firestore is empty/error ──
  const invoices = fsInvoices.data.length > 0 ? fsInvoices.data : prismaInvoices.data;
  const clients = fsClients.data.length > 0 ? fsClients.data : prismaClients.data;
  const bankAccounts = fsBankAccounts.data.length > 0 ? fsBankAccounts.data : prismaBankAccounts.data;
  const bankTransactions = fsBankTxns.data.length > 0 ? fsBankTxns.data : prismaBankTxns.data;
  const purchaseBills = prismaPurchaseBills.data;
  const payments = fsPayments.data;
  const expenses = fsExpenses.data;
  const gstReturns = fsGstReturns.data;
  const gstProfiles = fsGstProfiles.data;
  const notices = fsNotices.data;
  const reports = fsReports.data;
  const tasks = fsTasks.data;
  const recentActivities = fsActivities.data;
  const documents = fsDocuments.data;

  // ── Enrich clients with per-client receivables ──────────────────────────
  for (const c of clients) {
    const clientInvoices = invoices.filter((i) => i.clientId === c.id);
    c.invoiceCount = clientInvoices.length;
    c.receivable = clientInvoices
      .filter((i) => i.status !== 'cancelled' && i.paymentStatus !== 'paid')
      .reduce((s, i) => s + (i.balanceAmount > 0 ? i.balanceAmount : i.totalAmount - i.paidAmount), 0);
  }

  // ── Assemble dataAvailability ───────────────────────────────────────────
  const status: DataAvailability['status'] = {};
  const errors: DataAvailability['errors'] = [];
  const recordErr = (source: DataSourceName, r: GatherResult<unknown>) => {
    if (r.error) errors.push({ source, message: r.error, at: gatheredAt });
  };
  const merge = (fs: GatherResult<unknown>, prisma: GatherResult<unknown> | null, key: DataSourceName): DataAvailabilityStatus => {
    if (fs.data.length > 0) return 'connected';
    if (fs.status === 'error') {
      recordErr(key, fs);
      if (prisma && prisma.data.length > 0) return 'connected';
      return 'error';
    }
    // fs is empty
    if (prisma && prisma.data.length > 0) return 'connected';
    if (prisma && prisma.status === 'error') return 'error';
    return 'empty';
  };
  status.invoices = merge(fsInvoices, prismaInvoices, 'invoices');
  status.clients = merge(fsClients, prismaClients, 'clients');
  status.gstReturns = fsGstReturns.status; if (fsGstReturns.status === 'error') recordErr('gstReturns', fsGstReturns);
  status.gstProfiles = fsGstProfiles.status; if (fsGstProfiles.status === 'error') recordErr('gstProfiles', fsGstProfiles);
  status.bankAccounts = merge(fsBankAccounts, prismaBankAccounts, 'bankAccounts');
  status.bankTransactions = merge(fsBankTxns, prismaBankTxns, 'bankTransactions');
  status.payments = fsPayments.status; if (fsPayments.status === 'error') recordErr('payments', fsPayments);
  status.expenses = fsExpenses.status; if (fsExpenses.status === 'error') recordErr('expenses', fsExpenses);
  status.notices = fsNotices.status; if (fsNotices.status === 'error') recordErr('notices', fsNotices);
  status.reports = fsReports.status; if (fsReports.status === 'error') recordErr('reports', fsReports);
  status.tasks = fsTasks.status; if (fsTasks.status === 'error') recordErr('tasks', fsTasks);
  status.recentActivities = fsActivities.status; if (fsActivities.status === 'error') recordErr('recentActivities', fsActivities);
  status.documents = fsDocuments.status; if (fsDocuments.status === 'error') recordErr('documents', fsDocuments);
  status.organizations = orgResult ? 'connected' : 'empty';
  status.purchaseBills = prismaPurchaseBills.status; if (prismaPurchaseBills.status === 'error') recordErr('purchaseBills', prismaPurchaseBills);
  status.prismaInvoices = prismaInvoices.status;
  status.prismaClients = prismaClients.status;

  // ── Build the snapshot ──────────────────────────────────────────────────
  const skeleton = {
    organizationId, firmId, userId, gatheredAt, elapsedMs: 0,
    organization: orgResult,
    invoices, clients, gstReturns, gstProfiles,
    bankAccounts, bankTransactions, payments, expenses, purchaseBills,
    notices, reports, tasks, recentActivities, documents,
  };

  const derived = computeDerivedMetrics(skeleton);
  const elapsedMs = Date.now() - t0;
  const snapshot: ProductionDataSnapshot = {
    ...skeleton,
    derived,
    dataAvailability: { status, errors, gatheredAt, elapsedMs },
    elapsedMs,
  };

  SNAPSHOT_CACHE.set(cacheKey, { at: Date.now(), snapshot });
  return snapshot;
}

// ─── 15-second in-memory cache, keyed by organizationId (+ firmId + userId) ──
const SNAPSHOT_CACHE_TTL_MS = 15 * 1000;
const SNAPSHOT_CACHE = new Map<string, { at: number; snapshot: ProductionDataSnapshot }>();

/** Force-invalidate the snapshot cache (e.g. after a manual refresh click). */
export function invalidateProductionDataCache(organizationId?: string): void {
  if (!organizationId) {
    SNAPSHOT_CACHE.clear();
    return;
  }
  const prefix = `${organizationId}::`;
  const keys = Array.from(SNAPSHOT_CACHE.keys()).filter((k) => k.startsWith(prefix));
  for (const k of keys) SNAPSHOT_CACHE.delete(k);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS CONTEXT SERVICE (Upgrade Phase 1 — STEP 3)
// ═══════════════════════════════════════════════════════════════════════════

/** AI providers enabled in this environment (env-driven; defaults to ['zai']). */
function detectConnectedAIProviders(): string[] {
  const providers: string[] = [];
  if (process.env.ZAI_API_KEY || process.env.ZAI_MODEL) providers.push('zai');
  if (process.env.OPENAI_API_KEY) providers.push('openai');
  if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
  if (process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY) providers.push('gemini');
  if (providers.length === 0) providers.push('zai'); // ZAI SDK is the in-house default
  return providers;
}

/**
 * Assemble a BusinessContext from a ProductionDataSnapshot. Pure / synchronous
 * (does no I/O) — all the data it needs is already in the snapshot.
 *
 * @param snapshot The ProductionDataSnapshot returned by getProductionDataSnapshot()
 * @param opts     { organizationId, userId, userEmail } — identifying info
 */
export function buildBusinessContext(
  snapshot: ProductionDataSnapshot,
  opts: { organizationId: string; userId?: string | null; userEmail?: string | null },
): BusinessContext {
  const { organizationId, userId = null, userEmail = null } = opts;
  const today = new Date();
  const todayIso = today.toISOString();
  const fy = indianFinancialYear(today);
  const gstPeriod = currentGstPeriod(today);

  // Invoice summary buckets
  const invByStatus = { draft: 0, sent: 0, paid: 0, overdue: 0 };
  let totalAmount = 0;
  let overdueAmount = 0;
  for (const inv of snapshot.invoices) {
    totalAmount += inv.totalAmount;
    if (inv.status === 'draft') invByStatus.draft++;
    else if (inv.paymentStatus === 'paid' || inv.status === 'paid') invByStatus.paid++;
    else if (isOverdueInvoice(inv)) {
      invByStatus.overdue++;
      overdueAmount += inv.balanceAmount > 0 ? inv.balanceAmount : inv.totalAmount - inv.paidAmount;
    } else invByStatus.sent++;
  }

  // Top clients by receivable
  const topClients = [...snapshot.clients]
    .sort((a, b) => b.receivable - a.receivable)
    .slice(0, 5)
    .map((c) => ({ tradeName: c.tradeName, gstin: c.gstin, receivable: c.receivable, invoiceCount: c.invoiceCount }));

  // Pending payments
  const pendingPaymentsList = snapshot.payments.filter((p) => p.status === 'pending');
  const pendingPayments = {
    count: pendingPaymentsList.length,
    totalAmount: pendingPaymentsList.reduce((s, p) => s + p.amount, 0),
  };

  // Compliance — next deadline
  const nowMs = Date.now();
  const upcoming = snapshot.gstReturns
    .filter((r) => r.dueDate && new Date(r.dueDate).getTime() >= nowMs && r.status !== 'filed' && r.status !== 'acknowledged')
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  const nextDeadline = upcoming.length > 0 ? upcoming[0].dueDate : null;

  // ── Data gaps — explicit list of what's missing ─────────────────────────
  const gaps: string[] = [];
  const da = snapshot.dataAvailability.status;
  if (da.invoices === 'empty') gaps.push('No invoices found — revenue metrics may be unavailable.');
  if (da.invoices === 'error') gaps.push('Invoice data could not be retrieved (Firestore + Prisma both failed).');
  if (da.clients === 'empty') gaps.push('No clients registered — client-level analysis unavailable.');
  if (da.bankAccounts === 'empty') gaps.push('No bank accounts connected — cash position unknown. Ask the user to connect a bank account.');
  if (da.bankAccounts === 'error') gaps.push('Bank account data could not be retrieved.');
  if (da.bankTransactions === 'empty') gaps.push('No bank transactions synced — cash flow analysis unavailable.');
  if (da.gstReturns === 'empty') gaps.push('No GST returns recorded — GST liability figures are estimates only.');
  if (da.gstProfiles === 'empty') gaps.push('No GSTIN profiles connected — filing-status checks unavailable.');
  if (da.notices === 'empty') gaps.push('No regulatory notices tracked.');
  if (da.tasks === 'empty') gaps.push('No open tasks — task prioritization unavailable.');
  if (da.recentActivities === 'empty') gaps.push('No recent activities — audit trail unavailable.');
  if (snapshot.derived.bankConnected === false) gaps.push('Banking is not connected — Oracle cannot answer cash-related questions with real numbers.');
  if (snapshot.invoices.length === 0 && snapshot.clients.length === 0) gaps.push('No business records at all — ask the user to connect an accounting source or upload documents.');
  if (snapshot.derived.complianceScore < 60) gaps.push(`Compliance score is low (${snapshot.derived.complianceScore}/100) — flag overdue returns and notices.`);

  const ctx: BusinessContext = {
    gatheredAt: snapshot.gatheredAt,
    organization: {
      id: organizationId,
      name: snapshot.organization?.name ?? 'Unknown Organization',
      plan: snapshot.organization?.plan ?? 'free',
    },
    userId, userEmail,
    financialYear: fy,
    gstPeriod,
    today: todayIso,
    connectedBankAccounts: {
      count: snapshot.bankAccounts.filter((a) => a.status === 'connected').length,
      accounts: snapshot.bankAccounts.filter((a) => a.status === 'connected'),
    },
    connectedAIProviders: detectConnectedAIProviders(),
    invoiceSummary: {
      total: snapshot.invoices.length,
      draft: invByStatus.draft, sent: invByStatus.sent,
      paid: invByStatus.paid, overdue: invByStatus.overdue,
      totalAmount, overdueAmount,
    },
    clientCount: snapshot.clients.length,
    topClients,
    pendingPayments,
    complianceStatus: {
      score: snapshot.derived.complianceScore,
      pendingReturns: snapshot.derived.pendingGstReturns,
      overdueReturns: snapshot.derived.overdueGstReturns,
      nextDeadline,
      activeNotices: snapshot.derived.activeNotices,
    },
    recentConversations: [], // Placeholder — populated by chat history layer when available.
    cashPosition: {
      balance: snapshot.derived.cashBalance,
      inflow30d: snapshot.derived.inflow30d,
      outflow30d: snapshot.derived.outflow30d,
      runwayDays: snapshot.derived.runwayDays,
    },
    dataGaps: gaps,
    estimatedTokens: 0,
  };

  ctx.estimatedTokens = Math.ceil(JSON.stringify(ctx).length / 4);
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM PROMPT FORMATTER
// Produces a concise (<2000 token) text block for injection into the Oracle
// system prompt. Clearly states what data IS available (with real numbers) and
// what is MISSING (so the LLM knows not to invent answers).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format a BusinessContext into a compact text block for an LLM system prompt.
 * Target: < 2000 tokens (~8KB of text). Markdown-style with clear sections.
 */
export function formatContextForLLM(ctx: BusinessContext): string {
  const lines: string[] = [];
  const inr = (n: number) => formatINR(n);
  const num = (n: number) => (Number.isFinite(n) ? String(n) : '0');

  lines.push('# Oracle Business Context (live data)');
  lines.push(`_Assembled ${ctx.gatheredAt} — today: ${ctx.today.slice(0, 10)} — FY: ${ctx.financialYear} — GST period: ${ctx.gstPeriod}_`);
  lines.push('');
  lines.push('## Organization');
  lines.push(`- ${ctx.organization.name} (plan: ${ctx.organization.plan}, id: ${ctx.organization.id})`);
  if (ctx.userEmail) lines.push(`- Acting user: ${ctx.userEmail}`);
  lines.push(`- AI providers connected: ${ctx.connectedAIProviders.join(', ')}`);

  lines.push('');
  lines.push('## Financial Position (real data)');
  lines.push(`- Cash balance: ${inr(ctx.cashPosition.balance)}`);
  lines.push(`- Cash inflow (30d): ${inr(ctx.cashPosition.inflow30d)}`);
  lines.push(`- Cash outflow (30d): ${inr(ctx.cashPosition.outflow30d)}`);
  lines.push(`- Cash runway: ${num(ctx.cashPosition.runwayDays)} days`);
  lines.push(`- Bank accounts connected: ${num(ctx.connectedBankAccounts.count)}`);
  for (const a of ctx.connectedBankAccounts.accounts.slice(0, 3)) {
    lines.push(`  • ${a.bankName} ${a.accountNumberMasked} — ${inr(a.currentBalance)} (${a.status})`);
  }

  lines.push('');
  lines.push('## Invoices');
  lines.push(`- Total: ${num(ctx.invoiceSummary.total)} (worth ${inr(ctx.invoiceSummary.totalAmount)})`);
  lines.push(`- Draft: ${num(ctx.invoiceSummary.draft)} | Sent: ${num(ctx.invoiceSummary.sent)} | Paid: ${num(ctx.invoiceSummary.paid)} | Overdue: ${num(ctx.invoiceSummary.overdue)}`);
  if (ctx.invoiceSummary.overdue > 0) lines.push(`- Overdue amount: ${inr(ctx.invoiceSummary.overdueAmount)}`);

  lines.push('');
  lines.push('## Clients');
  lines.push(`- Total clients: ${num(ctx.clientCount)}`);
  if (ctx.topClients.length > 0) {
    lines.push('- Top clients by receivable:');
    for (const c of ctx.topClients.slice(0, 5)) {
      lines.push(`  • ${c.tradeName}${c.gstin ? ` (${c.gstin})` : ''} — receivable ${inr(c.receivable)}, ${num(c.invoiceCount)} invoices`);
    }
  }

  if (ctx.pendingPayments.count > 0) {
    lines.push('');
    lines.push('## Pending Payments');
    lines.push(`- ${num(ctx.pendingPayments.count)} pending, total ${inr(ctx.pendingPayments.totalAmount)}`);
  }

  lines.push('');
  lines.push('## Compliance');
  lines.push(`- Compliance score: ${num(ctx.complianceStatus.score)}/100`);
  lines.push(`- Pending GST returns: ${num(ctx.complianceStatus.pendingReturns)}`);
  lines.push(`- Overdue GST returns: ${num(ctx.complianceStatus.overdueReturns)}`);
  lines.push(`- Active regulatory notices: ${num(ctx.complianceStatus.activeNotices)}`);
  if (ctx.complianceStatus.nextDeadline) lines.push(`- Next GST deadline: ${ctx.complianceStatus.nextDeadline.slice(0, 10)}`);

  if (ctx.dataGaps.length > 0) {
    lines.push('');
    lines.push('## ⚠️ Data Gaps (DO NOT INVENT NUMBERS FOR THESE)');
    for (const g of ctx.dataGaps) lines.push(`- ${g}`);
  }

  lines.push('');
  lines.push('## Oracle Operating Rules');
  lines.push('- Answer ONLY using the real numbers above. If a number is not listed or is in the Data Gaps section, tell the user you do not have that data and suggest how to connect it.');
  lines.push('- When the user asks about cash, GST, invoices, or compliance, cite the specific figure from this context.');
  lines.push('- All amounts are in Indian Rupees (₹). Use ₹K/₹L/₹Cr shorthand where appropriate.');
  lines.push('- If compliance score < 60, proactively flag the overdue returns and active notices.');
  lines.push(`- Financial year runs April–March. Current FY is ${ctx.financialYear}. Current GST period is ${ctx.gstPeriod}.`);

  lines.push('');
  lines.push(`_Context size: ~${num(ctx.estimatedTokens)} tokens_`);

  return lines.join('\n');
}
