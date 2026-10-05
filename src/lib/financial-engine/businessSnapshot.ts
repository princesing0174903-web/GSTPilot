// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Business Snapshot Orchestrator
//
// This is the SINGLE SOURCE OF TRUTH for every financial metric in GSTPilot.
//
// Every dashboard, Oracle, AI CFO, Run Business, Autonomous, and Home page
// MUST call getBusinessSnapshot() — never query the database directly.
//
// Flow:
//   1. Fetch all relevant records from Prisma (scoped by tenantId)
//   2. Pass raw data to each calculator
//   3. Assemble into a single BusinessSnapshot object
//   4. Return with hasLiveData flag
//
// When the database is empty, returns an emptySnapshot() — never invents data.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  BusinessSnapshot,
  FinancialData,
  InvoiceRow,
  PurchaseBillRow,
  ExpenseRow,
  PaymentRow,
  BankAccountRow,
  ClientRow,
  NoticeRow,
  GSTRFilingRow,
} from './types';
import { emptySnapshot } from './types';
import { calculateRevenue } from './calculateRevenue';
import { calculateExpenses } from './calculateExpenses';
import { calculateProfit } from './calculateProfit';
import { calculateCash } from './calculateCash';
import { calculateGST } from './calculateGST';
import { calculateCollections, calculateReceivablesPayables } from './calculateCollections';
import { calculateHealth } from './calculateHealth';
import { calculateRisk } from './calculateRisk';
import { calculateRunway, calculateForecast } from './calculateRunway';

// ─── In-memory cache (30 seconds) ────────────────────────────────────────────

interface CacheEntry {
  snapshot: BusinessSnapshot;
  timestamp: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const cache = new Map<string, CacheEntry>();

/**
 * Returns the canonical business snapshot for a given tenant.
 *
 * @param tenantId — The firm/organization ID (from OrgContext or Firm model)
 * @param opts.forceRefresh — Bypass the cache (e.g. after a mutation)
 *
 * This function is server-side only — it queries Prisma directly.
 */
export async function getBusinessSnapshot(
  tenantId: string | null | undefined,
  opts?: { forceRefresh?: boolean },
): Promise<BusinessSnapshot> {
  // ── No tenant → empty snapshot ──
  if (!tenantId) {
    return emptySnapshot();
  }

  // ── Check cache ──
  if (!opts?.forceRefresh) {
    const cached = cache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.snapshot;
    }
  }

  // ── Fetch all financial data from Prisma ──
  const data = await fetchFinancialData(tenantId);

  // ── If no data at all, return empty snapshot ──
  const hasData =
    data.invoices.length > 0 ||
    data.purchaseBills.length > 0 ||
    data.expenses.length > 0 ||
    data.bankAccounts.length > 0 ||
    data.clients.length > 0;

  if (!hasData) {
    const empty = emptySnapshot();
    cache.set(tenantId, { snapshot: empty, timestamp: Date.now() });
    return empty;
  }

  // ── Calculate all metrics ──
  const revenue = calculateRevenue(data.invoices);
  const expenses = calculateExpenses(data.purchaseBills, data.expenses);
  const profit = calculateProfit(data.invoices, data.purchaseBills, data.expenses);
  const cash = calculateCash(data.bankAccounts);
  const gst = calculateGST(data.invoices, data.purchaseBills, data.expenses);
  const collections = calculateCollections(data.invoices, data.payments);
  const receivablesPayables = calculateReceivablesPayables(data.invoices, data.purchaseBills);
  const health = calculateHealth(data);
  const risk = calculateRisk(data);
  const runway = calculateRunway(data);
  const forecast = calculateForecast(data);

  // ── Count vendors (unique vendorName from purchase bills) ──
  const vendorSet = new Set<string>();
  for (const bill of data.purchaseBills) {
    if (bill.vendorName) vendorSet.add(bill.vendorName);
  }

  const snapshot: BusinessSnapshot = {
    revenue: revenue.total,
    expenses: expenses.total,
    profit: profit.netProfit,
    cash: cash.bankBalance,
    bankBalance: cash.bankBalance,

    invoices: {
      total: revenue.total,
      count: revenue.count,
      paid: collections.totalCollected,
      outstanding: collections.totalOutstanding,
      overdue: collections.totalOverdue,
      draftCount: data.invoices.filter(i => i.status === 'draft').length,
    },
    collections: {
      collectionRate: collections.collectionRate,
      totalCollected: collections.totalCollected,
      totalOutstanding: collections.totalOutstanding,
      averageDaysToPay: collections.averageDaysToPay,
    },
    receivables: receivablesPayables.receivables,
    payables: receivablesPayables.payables,

    gst: {
      outputTax: gst.outputTax,
      inputTax: gst.inputTax,
      netLiability: gst.netLiability,
      itcAvailable: gst.itcAvailable,
    },
    itc: gst.itcAvailable,

    customers: data.clients.filter(c => c.status === 'active').length,
    vendors: vendorSet.size,

    healthScore: health.score,
    risks: {
      overallRisk: risk.overallRisk,
      overdueExposure: risk.overdueExposure,
      complianceRisk: risk.complianceRisk,
      cashFlowRisk: risk.cashFlowRisk,
      riskLevel: risk.riskLevel,
    },

    forecast: {
      nextMonthRevenue: forecast.nextMonthRevenue,
      nextMonthExpenses: forecast.nextMonthExpenses,
      projectedCash: forecast.projectedCash,
      confidence: forecast.confidence,
    },
    runway: {
      monthsRemaining: runway.monthsRemaining,
      monthlyBurnRate: runway.monthlyBurnRate,
      isProfitable: runway.isProfitable,
    },

    notices: data.notices.length,

    updatedAt: new Date().toISOString(),
    // hasLiveData is TRUE only when there is at least one real financial
    // record (invoice, purchase bill, expense, payment, OR bank account).
    // Without this gate, dashboards would display "Health Score 0" and
    // "Revenue ₹0" as if they were real metrics — which the stabilization
    // directive explicitly forbids. When hasLiveData is false, every UI
    // should show the "Unavailable — connect supported integrations" state.
    hasLiveData:
      data.invoices.length > 0 ||
      data.purchaseBills.length > 0 ||
      data.expenses.length > 0 ||
      data.payments.length > 0 ||
      data.bankAccounts.length > 0,
  };

  // ── Cache the result ──
  cache.set(tenantId, { snapshot, timestamp: Date.now() });

  return snapshot;
}

/**
 * Fetches all financial data from Prisma, scoped by tenantId.
 *
 * The tenant scope flows through `client.firmId` for invoices, purchase bills,
 * expenses, payments, notices, and GSTR filings. Bank accounts are scoped by
 * `organizationId` (normalized to 'local' for local-* orgs so demo users see
 * the seeded banking data). Clients are scoped by firmId directly.
 */
async function fetchFinancialData(tenantId: string): Promise<FinancialData> {
  // PERF FIX: every query now uses `select` to fetch ONLY the columns the
  // calculators need (the Invoice model has ~30 columns; the mapper only
  // uses ~20). This cuts the data transferred from SQLite → Node by ~40%.
  // `take: 5000` is a safety cap so a very large org can't OOM the server.
  // `bankAccount.findMany` now scopes by `organizationId` (previously had NO
  // where clause — cross-tenant data leak + full table scan).
  const isLocal = tenantId === 'local' || tenantId.startsWith('local-');
  const bankingOrgId = isLocal ? 'local' : tenantId;
  const ROW_CAP = 5_000;

  // Run all queries in parallel for speed
  const [
    invoiceRows,
    purchaseBillRows,
    expenseRows,
    paymentRows,
    bankAccountRows,
    clientRows,
    noticeRows,
    gstrFilingRows,
  ] = await Promise.all([
    // Invoices scoped by client.firmId
    db.invoice.findMany({
      where: { client: { firmId: tenantId } },
      orderBy: { createdAt: 'desc' },
      take: ROW_CAP,
      select: {
        id: true, clientId: true, invoiceNumber: true, invoiceDate: true,
        sellerGstin: true, buyerGstin: true, buyerName: true, invoiceType: true,
        taxableValue: true, cgst: true, sgst: true, igst: true, cess: true,
        totalAmount: true, status: true, paymentStatus: true, paidAmount: true,
        balanceAmount: true, dueDate: true, createdAt: true,
      },
    }).then(rows => rows.map(mapInvoice)),

    // Purchase bills scoped by client.firmId
    db.purchaseBill.findMany({
      where: { client: { firmId: tenantId } },
      orderBy: { createdAt: 'desc' },
      take: ROW_CAP,
      select: {
        id: true, clientId: true, vendorName: true, vendorGstin: true,
        invoiceNo: true, invoiceDate: true, dueDate: true, taxableValue: true,
        cgst: true, sgst: true, igst: true, cess: true, gstAmount: true,
        totalAmount: true, paidAmount: true, balanceAmount: true, status: true,
        paymentStatus: true, createdAt: true,
      },
    }).then(rows => rows.map(mapPurchaseBill)),

    // Expenses scoped by client.firmId
    db.expense.findMany({
      where: { client: { firmId: tenantId } },
      orderBy: { createdAt: 'desc' },
      take: ROW_CAP,
      select: {
        id: true, clientId: true, category: true, description: true, vendor: true,
        amount: true, gst: true, gstClaimable: true, date: true, paymentMode: true,
        status: true, createdAt: true,
      },
    }).then(rows => rows.map(mapExpense)),

    // Payments scoped by client.firmId
    db.payment.findMany({
      where: { client: { firmId: tenantId } },
      orderBy: { createdAt: 'desc' },
      take: ROW_CAP,
      select: {
        id: true, clientId: true, invoiceId: true, purchaseBillId: true,
        partyName: true, partyType: true, amount: true, paymentDate: true,
        paymentMode: true, status: true, createdAt: true,
      },
    }).then(rows => rows.map(mapPayment)),

    // Bank accounts — NOW SCOPED by organizationId (was previously a full
    // table scan with no where clause, which was also a cross-tenant leak).
    db.bankAccount.findMany({
      where: { organizationId: bankingOrgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, bankName: true, accountMasked: true, accountType: true,
        balance: true, availableBalance: true, overdraftLimit: true, status: true,
      },
    }).then(rows => rows.map(mapBankAccount)),

    // Clients scoped by firmId
    db.client.findMany({
      where: { firmId: tenantId },
      select: {
        id: true, gstin: true, tradeName: true, legalName: true, state: true,
        stateCode: true, status: true, healthScore: true, firmId: true,
      },
    }).then(rows => rows.map(mapClient)),

    // Notices scoped by client.firmId
    db.notice.findMany({
      where: { client: { firmId: tenantId } },
      orderBy: { createdAt: 'desc' },
      take: ROW_CAP,
      select: { id: true, status: true, createdAt: true },
    }).then(rows => rows.map(mapNotice)),

    // GSTR filings scoped by client.firmId
    db.gSTRFiling.findMany({
      where: { client: { firmId: tenantId } },
      orderBy: { createdAt: 'desc' },
      take: ROW_CAP,
      select: {
        id: true, returnType: true, period: true, status: true,
        totalTaxableValue: true, totalTax: true, createdAt: true,
      },
    }).then(rows => rows.map(mapGSTRFiling)),
  ]);

  return {
    invoices: invoiceRows,
    purchaseBills: purchaseBillRows,
    expenses: expenseRows,
    payments: paymentRows,
    bankAccounts: bankAccountRows,
    clients: clientRows,
    notices: noticeRows,
    gstrFilings: gstrFilingRows,
  };
}

// ─── Mappers (Prisma row → typed FinancialData row) ──────────────────────────

function mapInvoice(r: {
  id: string; clientId: string; invoiceNumber: string; invoiceDate: string;
  sellerGstin: string; buyerGstin: string | null; buyerName: string | null;
  invoiceType: string; taxableValue: number; cgst: number; sgst: number;
  igst: number; cess: number; totalAmount: number; status: string;
  paymentStatus: string; paidAmount: number; balanceAmount: number;
  dueDate: string | null; createdAt: Date;
}): InvoiceRow {
  return {
    id: r.id, clientId: r.clientId, invoiceNumber: r.invoiceNumber,
    invoiceDate: r.invoiceDate, sellerGstin: r.sellerGstin,
    buyerGstin: r.buyerGstin, buyerName: r.buyerName, invoiceType: r.invoiceType,
    taxableValue: r.taxableValue, cgst: r.cgst, sgst: r.sgst, igst: r.igst,
    cess: r.cess, totalAmount: r.totalAmount, status: r.status,
    paymentStatus: r.paymentStatus, paidAmount: r.paidAmount,
    balanceAmount: r.balanceAmount, dueDate: r.dueDate, createdAt: r.createdAt,
  };
}

function mapPurchaseBill(r: {
  id: string; clientId: string | null; vendorName: string; vendorGstin: string | null;
  invoiceNo: string; invoiceDate: string; dueDate: string | null;
  taxableValue: number; cgst: number; sgst: number; igst: number; cess: number;
  gstAmount: number; totalAmount: number; paidAmount: number; balanceAmount: number;
  status: string; paymentStatus: string; createdAt: Date;
}): PurchaseBillRow {
  return {
    id: r.id, clientId: r.clientId, vendorName: r.vendorName,
    vendorGstin: r.vendorGstin, invoiceNo: r.invoiceNo, invoiceDate: r.invoiceDate,
    dueDate: r.dueDate, taxableValue: r.taxableValue, cgst: r.cgst, sgst: r.sgst,
    igst: r.igst, cess: r.cess, gstAmount: r.gstAmount, totalAmount: r.totalAmount,
    paidAmount: r.paidAmount, balanceAmount: r.balanceAmount, status: r.status,
    paymentStatus: r.paymentStatus, createdAt: r.createdAt,
  };
}

function mapExpense(r: {
  id: string; clientId: string | null; category: string; description: string | null;
  vendor: string | null; amount: number; gst: number; gstClaimable: boolean;
  date: string; paymentMode: string | null; status: string; createdAt: Date;
}): ExpenseRow {
  return {
    id: r.id, clientId: r.clientId, category: r.category, description: r.description,
    vendor: r.vendor, amount: r.amount, gst: r.gst, gstClaimable: r.gstClaimable,
    date: r.date, paymentMode: r.paymentMode, status: r.status, createdAt: r.createdAt,
  };
}

function mapPayment(r: {
  id: string; clientId: string | null; invoiceId: string | null;
  purchaseBillId: string | null; partyName: string; partyType: string;
  amount: number; paymentDate: string; paymentMode: string; status: string;
  createdAt: Date;
}): PaymentRow {
  return {
    id: r.id, clientId: r.clientId, invoiceId: r.invoiceId,
    purchaseBillId: r.purchaseBillId, partyName: r.partyName, partyType: r.partyType,
    amount: r.amount, paymentDate: r.paymentDate, paymentMode: r.paymentMode,
    status: r.status, createdAt: r.createdAt,
  };
}

function mapBankAccount(r: {
  id: string; bankName: string; accountMasked: string; accountType: string;
  balance: number; availableBalance: number; overdraftLimit: number; status: string;
}): BankAccountRow {
  return {
    id: r.id, bankName: r.bankName, accountMasked: r.accountMasked,
    accountType: r.accountType, balance: r.balance,
    availableBalance: r.availableBalance, overdraftLimit: r.overdraftLimit,
    status: r.status,
  };
}

function mapClient(r: {
  id: string; gstin: string; tradeName: string; legalName: string | null;
  state: string | null; stateCode: string | null; status: string;
  healthScore: number; firmId: string | null;
}): ClientRow {
  return {
    id: r.id, gstin: r.gstin, tradeName: r.tradeName, legalName: r.legalName,
    state: r.state, stateCode: r.stateCode, status: r.status,
    healthScore: r.healthScore, firmId: r.firmId,
  };
}

function mapNotice(r: {
  id: string; status: string; createdAt: Date;
}): NoticeRow {
  return { id: r.id, status: r.status, createdAt: r.createdAt };
}

function mapGSTRFiling(r: {
  id: string; returnType: string; period: string; status: string;
  totalTaxableValue: number; totalTax: number; createdAt: Date;
}): GSTRFilingRow {
  return {
    id: r.id, returnType: r.returnType, period: r.period, status: r.status,
    totalTaxableValue: r.totalTaxableValue, totalTax: r.totalTax, createdAt: r.createdAt,
  };
}

/**
 * Invalidates the cache for a specific tenant (call after mutations).
 */
export function invalidateSnapshotCache(tenantId?: string): void {
  if (tenantId) {
    cache.delete(tenantId);
  } else {
    cache.clear();
  }
}
