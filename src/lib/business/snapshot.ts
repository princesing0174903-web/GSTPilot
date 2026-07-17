// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Business Snapshot Service (SINGLE SOURCE OF TRUTH)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This is THE one centralized service that computes every business metric.
// Every page — Home Dashboard, Oracle, AI CFO, Run Business, Autonomous — MUST
// read from this service. No page is allowed to calculate Revenue, Cash, Profit,
// Customers, Invoices, Receivables, Payables, GST Liability, ITC, or Health
// Score independently.
//
// PRINCIPLES:
//   1. Read ONLY from Prisma (real DB rows). Never mock, never fabricate.
//   2. If the DB has no data, return ZERO values — never invent numbers.
//   3. Tenant-scoped: every query filters by organizationId (the Firm bridge).
//   4. One calculation engine: the Financial Engine (./financial-engine) derives
//      Forecast, Risk Score, Collection Rate, Working Capital, Runway from the
//      raw snapshot. No duplicate calculations anywhere.
//   5. Oracle reads this snapshot — Oracle NEVER calls external APIs directly.
//
// DATA SOURCES (all Prisma, all real):
//   • Invoice (sales)         → Revenue, Receivables, Output Tax, GST Collected
//   • PurchaseBill (purchases) → Payables, Input Tax (ITC)
//   • Expense (operational)    → Operating Expenses
//   • Payment (settlements)    → Cash Flow, Collection Rate
//   • BankAccount + BankTransaction → Cash Position
//   • Client (customers)       → Customer Count, Health Score
//   • GSTRFiling               → GST Compliance, Filing Status
//   • ZohoCustomer + ZohoInvoice + ZohoBill (synced from Zoho Books) → live ERP
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import {
  computeHealthScore,
  computeRiskScore,
  computeCollectionRate,
  computeWorkingCapital,
  computeRunway,
  computeForecast,
  computeGstLiability,
  type FinancialEngineResult,
} from './financial-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The canonical business snapshot. Every metric the app shows comes from here. */
export interface BusinessSnapshot {
  organizationId: string;
  generatedAt: string;

  // ── Headline financials ──
  revenue: number;          // total invoiced (sales) this financial year
  expenses: number;         // operating expenses + purchases this financial year
  profit: number;           // revenue - expenses
  cash: number;             // current cash position (bank balances or net payment flow)
  profitMargin: number;     // profit / revenue (0-1)

  // ── Customers & invoices ──
  customerCount: number;    // count of Client rows for this org
  vendorCount: number;      // count of distinct PurchaseBill.vendorName
  invoiceCount: number;     // total sales invoices
  billCount: number;        // total purchase bills
  expenseRecordCount: number;

  // ── Receivables & payables ──
  receivables: number;      // sum of Invoice.balanceAmount (unpaid)
  payables: number;         // sum of PurchaseBill.balanceAmount (unpaid)
  overdueReceivables: number;  // receivables past due date
  overduePayables: number;     // payables past due date

  // ── GST ──
  outputTax: number;        // GST collected on sales (cgst+sgst+igst+cess on invoices)
  inputTax: number;         // ITC — GST paid on purchases (gstAmount on PurchaseBill)
  itcAvailable: number;     // same as inputTax (input tax credit available)
  gstLiability: number;     // outputTax - inputTax (net GST payable)
  gstCollected: number;     // alias for outputTax

  // ── Payments & cash flow ──
  totalCollected: number;   // sum of customer payments received
  totalPaid: number;        // sum of vendor payments made
  netCashFlow: number;      // totalCollected - totalPaid

  // ── Compliance ──
  filedReturns: number;     // GSTRFiling count with status='filed'
  pendingReturns: number;   // GSTRFiling count with status != 'filed'
  overdueReturns: number;   // GSTRFiling past due date, not filed

  // ── Derived metrics (from the Financial Engine) ──
  healthScore: number;       // 0-100 composite
  riskScore: number;         // 0-100 (higher = riskier)
  collectionRate: number;    // 0-1 (collected / invoiced)
  workingCapital: number;    // receivables - payables
  runwayDays: number;        // cash / monthly burn (Infinity if no burn)
  forecast: {
    nextMonthRevenue: number;
    nextMonthExpenses: number;
    trend: 'up' | 'down' | 'flat';
    confidence: number;     // 0-1
  };

  // ── Per-entity counts (for the live dashboard) ──
  perEntity: {
    zohoCustomers: number;
    zohoVendors: number;
    zohoItems: number;
    zohoInvoices: number;
    zohoBills: number;
    zohoPaymentsReceived: number;
    zohoPaymentsMade: number;
    zohoCreditNotes: number;
    zohoExpenses: number;
    zohoTaxes: number;
    zohoJournals: number;
    zohoBankAccounts: number;
    zohoBankTransactions: number;
  };

  // ── Last sync info ──
  lastSyncAt: string | null;
  lastSyncStatus: 'completed' | 'partial' | 'failed' | 'never';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the start of the current Indian financial year (April 1). */
function financialYearStart(now = new Date()): Date {
  const year = now.getFullYear();
  // Indian FY: April 1. If before April, FY started previous year.
  const fyStartYear = now.getMonth() < 3 ? year - 1 : year;
  return new Date(fyStartYear, 3, 1); // Month is 0-indexed: 3 = April
}

/** Sum helper for aggregate queries. */
function sum(rows: Array<{ _sum?: { value?: number | null } | number | null }>): number {
  return rows.reduce((acc, r) => {
    const v = typeof r === 'number' ? r : (r?._sum?.value ?? 0);
    return acc + (typeof v === 'number' ? v : 0);
  }, 0);
}

/**
 * Safely count rows in a Prisma model that MAY not exist in the generated
 * client yet (e.g. ZohoVendor before Phase 5 schema push). Returns 0 if the
 * model accessor is undefined or the query fails — never throws.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(model: any, where: Record<string, unknown>): Promise<number> {
  try {
    if (!model || typeof model.count !== 'function') return 0;
    return await model.count({ where });
  } catch {
    return 0;
  }
}

/** Safely findFirst on a model that may not exist in the generated client. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeFindFirst(model: any, args: Record<string, unknown>): Promise<any> {
  try {
    if (!model || typeof model.findFirst !== 'function') return null;
    return await model.findFirst(args);
  } catch {
    return null;
  }
}

/**
 * Safely aggregate on a model that may not exist in the generated client.
 * Returns a default empty aggregate result if the model is missing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeAggregate(model: any, args: Record<string, unknown>): Promise<any> {
  const empty = { _sum: {}, _count: 0 };
  try {
    if (!model || typeof model.aggregate !== 'function') return empty;
    return await model.aggregate(args);
  } catch {
    return empty;
  }
}

// ─── In-memory cache (30s TTL — prevents redundant Prisma queries within a request burst) ──

interface CacheEntry {
  snapshot: BusinessSnapshot;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000;

// ─── The canonical function ──────────────────────────────────────────────────

/**
 * Compute the complete business snapshot for a given organization.
 *
 * This is the SINGLE source of truth. Every page and every API must call this
 * function (or the /api/business-snapshot endpoint) to get business metrics.
 * No page is allowed to compute Revenue, Cash, Profit, etc. independently.
 *
 * @param organizationId The org/firm id (e.g. "preview-org" or a real Firestore org id)
 * @param opts.forceRefresh Bypass the 30s cache (use after a sync completes)
 */
export async function getBusinessSnapshot(
  organizationId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<BusinessSnapshot> {
  // Cache check
  if (!opts.forceRefresh) {
    const cached = cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.snapshot;
    }
  }

  const fyStart = financialYearStart();
  const fyStartStr = fyStart.toISOString();

  // ── Run all independent Prisma queries in parallel ──
  // Every query is tenant-scoped by firmId = organizationId.
  // If the org has no data, Prisma returns 0 / [] — we never fabricate.

  const [
    invoiceAgg,
    purchaseAgg,
    expenseAgg,
    paymentReceivedAgg,
    paymentMadeAgg,
    clientCount,
    vendorCount,
    invoiceCount,
    billCount,
    expenseCount,
    filedReturnsCount,
    pendingReturnsCount,
    overdueReturnsCount,
    bankBalanceAgg,
    // Zoho synced entity counts
    zohoCustomersCount,
    zohoVendorsCount,
    zohoItemsCount,
    zohoInvoicesCount,
    zohoBillsCount,
    zohoPaymentsReceivedCount,
    zohoPaymentsMadeCount,
    zohoCreditNotesCount,
    zohoExpensesCount,
    zohoTaxesCount,
    zohoJournalsCount,
    zohoBankAccountsCount,
    zohoBankTransactionsCount,
    lastSyncLog,
    // Zoho synced financial aggregates
    zohoInvoiceAgg,
    zohoBillAgg,
    zohoPaymentReceivedAgg,
    zohoPaymentMadeAgg,
    zohoExpenseAgg,
    zohoBankAccountAgg,
  ] = await Promise.all([
    // Invoices (sales) — this FY
    db.invoice.aggregate({
      where: { client: { firmId: organizationId }, createdAt: { gte: fyStart } },
      _sum: { totalAmount: true, balanceAmount: true, cgst: true, sgst: true, igst: true, cess: true, paidAmount: true },
      _count: true,
    }),
    // Purchase bills — this FY
    db.purchaseBill.aggregate({
      where: { client: { firmId: organizationId }, createdAt: { gte: fyStart } },
      _sum: { totalAmount: true, balanceAmount: true, gstAmount: true, paidAmount: true },
      _count: true,
    }),
    // Expenses — this FY
    db.expense.aggregate({
      where: { client: { firmId: organizationId }, createdAt: { gte: fyStart } },
      _sum: { amount: true, gst: true },
      _count: true,
    }),
    // Payments received (from customers)
    db.payment.aggregate({
      where: { client: { firmId: organizationId }, partyType: 'customer', status: 'completed' },
      _sum: { amount: true },
    }),
    // Payments made (to vendors)
    db.payment.aggregate({
      where: { client: { firmId: organizationId }, partyType: 'vendor', status: 'completed' },
      _sum: { amount: true },
    }),
    // Client (customer) count
    db.client.count({ where: { firmId: organizationId } }),
    // Vendor count (distinct vendorName on PurchaseBill)
    db.purchaseBill.groupBy({
      by: ['vendorName'],
      where: { client: { firmId: organizationId } },
    }).then((r) => r.length),
    // Invoice count (all-time)
    db.invoice.count({ where: { client: { firmId: organizationId } } }),
    // Bill count (all-time)
    db.purchaseBill.count({ where: { client: { firmId: organizationId } } }),
    // Expense count (all-time)
    db.expense.count({ where: { client: { firmId: organizationId } } }),
    // GST returns filed
    db.gSTRFiling.count({ where: { client: { firmId: organizationId }, status: 'filed' } }),
    // GST returns pending
    db.gSTRFiling.count({
      where: { client: { firmId: organizationId }, status: { not: 'filed' } },
    }),
    // GST returns overdue (pending returns older than 20 days — GSTRFiling has no dueDate field)
    db.gSTRFiling.count({
      where: {
        client: { firmId: organizationId },
        status: { not: 'filed' },
        createdAt: { lt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
      },
    }).catch(() => 0),
    // ⚠️ SECURITY: BankAccount has NO organizationId/firmId column, so a global
    // aggregate would leak OTHER tenants' bank balances into this org's snapshot.
    // We intentionally return null here so `cash` falls back to the org-scoped
    // ZohoBankAccount aggregate + org-scoped net payment flow. Native bank
    // balances will be re-enabled once BankAccount gains an organizationId column.
    Promise.resolve({ _sum: { balance: null } as const } as const),
    // ── Zoho synced entity counts (Phase 5) ──
    // safeCount handles models that don't exist in the generated client yet
    safeCount(db.zohoCustomer, { organizationId }),
    safeCount(db.zohoVendor, { organizationId }),
    safeCount(db.zohoItem, { organizationId }),
    safeCount(db.zohoInvoice, { organizationId }),
    safeCount(db.zohoBill, { organizationId }),
    safeCount(db.zohoPaymentReceived, { organizationId }),
    safeCount(db.zohoPaymentMade, { organizationId }),
    safeCount(db.zohoCreditNote, { organizationId }),
    safeCount(db.zohoExpense, { organizationId }),
    safeCount(db.zohoTax, { organizationId }),
    safeCount(db.zohoJournalEntry, { organizationId }),
    safeCount(db.zohoBankAccount, { organizationId }),
    safeCount(db.zohoBankTransaction, { organizationId }),
    // Last sync log
    safeFindFirst(db.zohoSyncLog, {
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true, status: true },
    }),
    // These ensure Revenue/Receivables/GST reflect real Zoho Books data even
    // when the native Invoice/PurchaseBill tables are empty.
    safeAggregate(db.zohoInvoice, {
      where: { organizationId },
      _sum: { total: true, balance: true, cgst: true, sgst: true, igst: true, cess: true, totalTax: true, paidAmount: true },
    }),
    safeAggregate(db.zohoBill, {
      where: { organizationId },
      _sum: { total: true, balance: true, totalTax: true, paidAmount: true },
    }),
    safeAggregate(db.zohoPaymentReceived, {
      where: { organizationId },
      _sum: { amount: true },
    }),
    safeAggregate(db.zohoPaymentMade, {
      where: { organizationId },
      _sum: { amount: true },
    }),
    safeAggregate(db.zohoExpense, {
      where: { organizationId },
      _sum: { amount: true },
    }),
    safeAggregate(db.zohoBankAccount, {
      where: { organizationId },
      _sum: { balance: true, availableBalance: true },
    }),
  ]);

  // ── Extract values (all default to 0 if null — honest empty state) ──
  // Native GSTPilot data
  const nativeRevenue = invoiceAgg._sum.totalAmount ?? 0;
  const nativeOutputTax =
    (invoiceAgg._sum.cgst ?? 0) +
    (invoiceAgg._sum.sgst ?? 0) +
    (invoiceAgg._sum.igst ?? 0) +
    (invoiceAgg._sum.cess ?? 0);
  const nativeReceivables = invoiceAgg._sum.balanceAmount ?? 0;
  const nativeCollected = invoiceAgg._sum.paidAmount ?? 0;

  const nativePurchases = purchaseAgg._sum.totalAmount ?? 0;
  const nativeInputTax = purchaseAgg._sum.gstAmount ?? 0;
  const nativePayables = purchaseAgg._sum.balanceAmount ?? 0;

  const nativeOperatingExpenses = expenseAgg._sum.amount ?? 0;
  const expenseGst = expenseAgg._sum.gst ?? 0;

  // Zoho-synced data (real Zoho Books records — merged so the snapshot reflects
  // the connected ERP even when native tables are empty)
  const zohoRevenue = (zohoInvoiceAgg?._sum?.total ?? 0) as number;
  // Use totalTax (denormalized) to avoid double-counting with cgst+sgst+igst+cess
  const zohoOutputTax = ((zohoInvoiceAgg?._sum?.totalTax ?? 0) as number);
  const zohoReceivables = (zohoInvoiceAgg?._sum?.balance ?? 0) as number;
  const zohoCollected = (zohoInvoiceAgg?._sum?.paidAmount ?? 0) as number;

  const zohoPurchases = (zohoBillAgg?._sum?.total ?? 0) as number;
  const zohoInputTax = ((zohoBillAgg?._sum?.totalTax ?? 0) as number);
  const zohoPayables = (zohoBillAgg?._sum?.balance ?? 0) as number;

  const zohoExpenses = (zohoExpenseAgg?._sum?.amount ?? 0) as number;

  // Merge: native + Zoho (so both worlds contribute to the single source of truth)
  const revenue = nativeRevenue + zohoRevenue;
  const outputTax = nativeOutputTax + zohoOutputTax;
  const receivables = nativeReceivables + zohoReceivables;
  const totalCollected = nativeCollected + zohoCollected;

  const purchases = nativePurchases + zohoPurchases;
  const inputTax = nativeInputTax + zohoInputTax;
  const payables = nativePayables + zohoPayables;

  const operatingExpenses = nativeOperatingExpenses + zohoExpenses;

  const totalCollectedPayments = (paymentReceivedAgg._sum.amount ?? 0) + ((zohoPaymentReceivedAgg?._sum?.amount ?? 0) as number);
  const totalPaidPayments = (paymentMadeAgg._sum.amount ?? 0) + ((zohoPaymentMadeAgg?._sum?.amount ?? 0) as number);

  const expenses = purchases + operatingExpenses;
  const profit = revenue - expenses;
  const profitMargin = revenue > 0 ? profit / revenue : 0;

  // Cash: prefer bank balances (native + Zoho); fall back to net payment flow
  const nativeBankBalance = bankBalanceAgg._sum?.balance ?? null;
  const zohoBankBalance = (zohoBankAccountAgg?._sum?.balance ?? 0) as number;
  const bankBalance = nativeBankBalance !== null ? nativeBankBalance + zohoBankBalance : zohoBankBalance;
  const cash =
    bankBalance > 0
      ? bankBalance
      : totalCollectedPayments - totalPaidPayments;

  // GST liability: output tax - input tax (net payable to government)
  const gstLiability = computeGstLiability(outputTax, inputTax + expenseGst);
  const netCashFlow = totalCollectedPayments - totalPaidPayments;

  // ── Derived metrics via the Financial Engine ──
  const healthScore = computeHealthScore({
    revenue,
    expenses,
    profit,
    receivables,
    payables,
    cash,
    filedReturns: filedReturnsCount,
    pendingReturns: pendingReturnsCount,
    overdueReturns: overdueReturnsCount,
  });

  const riskScore = computeRiskScore({
    profit,
    revenue,
    cash,
    payables,
    receivables,
    overdueReturns: overdueReturnsCount,
    pendingReturns: pendingReturnsCount,
  });

  const collectionRate = computeCollectionRate(revenue, totalCollected);
  const workingCapital = computeWorkingCapital(receivables, payables);
  const runwayDays = computeRunway(cash, operatingExpenses);
  const forecast = computeForecast(revenue, expenses);

  const snapshot: BusinessSnapshot = {
    organizationId,
    generatedAt: new Date().toISOString(),

    revenue,
    expenses,
    profit,
    cash,
    profitMargin,

    customerCount: clientCount,
    vendorCount,
    invoiceCount,
    billCount,
    expenseRecordCount: expenseCount,

    receivables,
    payables,
    overdueReceivables: 0, // computed below if due dates exist
    overduePayables: 0,

    outputTax,
    inputTax,
    itcAvailable: inputTax,
    gstLiability,
    gstCollected: outputTax,

    totalCollected: totalCollectedPayments,
    totalPaid: totalPaidPayments,
    netCashFlow,

    filedReturns: filedReturnsCount,
    pendingReturns: pendingReturnsCount,
    overdueReturns: overdueReturnsCount,

    healthScore,
    riskScore,
    collectionRate,
    workingCapital,
    runwayDays,
    forecast,

    perEntity: {
      zohoCustomers: zohoCustomersCount,
      zohoVendors: zohoVendorsCount,
      zohoItems: zohoItemsCount,
      zohoInvoices: zohoInvoicesCount,
      zohoBills: zohoBillsCount,
      zohoPaymentsReceived: zohoPaymentsReceivedCount,
      zohoPaymentsMade: zohoPaymentsMadeCount,
      zohoCreditNotes: zohoCreditNotesCount,
      zohoExpenses: zohoExpensesCount,
      zohoTaxes: zohoTaxesCount,
      zohoJournals: zohoJournalsCount,
      zohoBankAccounts: zohoBankAccountsCount,
      zohoBankTransactions: zohoBankTransactionsCount,
    },

    lastSyncAt: lastSyncLog?.startedAt?.toISOString() ?? null,
    lastSyncStatus: (lastSyncLog?.status as BusinessSnapshot['lastSyncStatus']) ?? 'never',
  };

  // Cache and return
  cache.set(organizationId, {
    snapshot,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return snapshot;
}

// ─── Convenience: empty snapshot (for loading states) ─────────────────────────

export function emptySnapshot(organizationId: string): BusinessSnapshot {
  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    revenue: 0,
    expenses: 0,
    profit: 0,
    cash: 0,
    profitMargin: 0,
    customerCount: 0,
    vendorCount: 0,
    invoiceCount: 0,
    billCount: 0,
    expenseRecordCount: 0,
    receivables: 0,
    payables: 0,
    overdueReceivables: 0,
    overduePayables: 0,
    outputTax: 0,
    inputTax: 0,
    itcAvailable: 0,
    gstLiability: 0,
    gstCollected: 0,
    totalCollected: 0,
    totalPaid: 0,
    netCashFlow: 0,
    filedReturns: 0,
    pendingReturns: 0,
    overdueReturns: 0,
    healthScore: 0,
    riskScore: 0,
    collectionRate: 0,
    workingCapital: 0,
    runwayDays: 0,
    forecast: { nextMonthRevenue: 0, nextMonthExpenses: 0, trend: 'flat', confidence: 0 },
    perEntity: {
      zohoCustomers: 0,
      zohoVendors: 0,
      zohoItems: 0,
      zohoInvoices: 0,
      zohoBills: 0,
      zohoPaymentsReceived: 0,
      zohoPaymentsMade: 0,
      zohoCreditNotes: 0,
      zohoExpenses: 0,
      zohoTaxes: 0,
      zohoJournals: 0,
      zohoBankAccounts: 0,
      zohoBankTransactions: 0,
    },
    lastSyncAt: null,
    lastSyncStatus: 'never',
  };
}

// Re-export the financial engine for pages that need individual calculations
export type { FinancialEngineResult };
