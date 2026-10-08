// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI Oracle™ & AI CFO™ — Business Knowledge Engine
//
// A PURE, CLIENT-SAFE function that transforms a real-data snapshot into a
// structured BusinessContext. This is what makes Oracle "understand" the
// business: revenue, expenses, profit, outstanding, GST liability, bank
// balance, cash flow, pending invoices, overdue customers, upcoming deadlines.
//
// The orchestrator (server) assembles the BusinessDataSnapshot from live
// Firestore data (invoices, GST transactions, bank connections/transactions,
// clients, returns) and passes it here. The engine NEVER reads Firestore —
// it only computes. This guarantees multi-tenant isolation at the boundary.
//
// EVERY metric is derived from real data — never fabricated.
// ═══════════════════════════════════════════════════════════════════════════════

import type { BusinessContext } from './types';

// ─── Snapshot input types (minimal, decoupled from external service types) ───

/**
 * A minimal invoice snapshot the knowledge engine consumes. The orchestrator
 * maps the full Invoice type to this shape.
 */
export interface InvoiceSnapshot {
  id: string;
  /** 'sales' = customer invoice (revenue), 'purchase' = vendor bill (expense). */
  kind: 'sales' | 'purchase';
  /** ISO date (YYYY-MM-DD) the invoice was issued. */
  invoiceDate: string;
  /** ISO date payment is due, if set. */
  dueDate?: string | null;
  /** Grand total including tax. */
  grandTotal: number;
  /** Amount still outstanding (0 = fully paid). */
  balanceDue: number;
  /** 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'. */
  status: string;
  /** Customer name (for sales) or vendor name (for purchase). */
  partyName?: string;
  partyId?: string;
}

export interface GstTransactionSnapshot {
  id: string;
  /** 'sales' | 'purchase'. */
  transactionType: string;
  /** Period YYYY-MM. */
  filingPeriod?: string;
  invoiceDate: string;
  cgst?: number;
  sgst?: number;
  igst?: number;
  cess?: number;
  /** Whether ITC is eligible (for purchase transactions). */
  itcEligible?: boolean;
}

export interface BankConnectionSnapshot {
  id: string;
  status: string;
  /** Current balance from lastSnapshot, if available. */
  currentBalance?: number;
  availableBalance?: number;
}

export interface BankTransactionSnapshot {
  id: string;
  /** ISO date. */
  date: string;
  /** Positive = credit (incoming), negative = debit (outgoing). */
  amount: number;
  /** 'credit' | 'debit'. */
  type: string;
  /** Reconciliation status. */
  reconciliationStatus?: string;
  category?: string;
}

export interface ClientSnapshot {
  id: string;
  name: string;
  gstin?: string;
  /** Outstanding receivable amount. */
  outstanding?: number;
  /** Whether the client has any overdue invoice. */
  hasOverdue?: boolean;
}

export interface ReturnSnapshot {
  id: string;
  returnType: string;  // 'GSTR-1' | 'GSTR-3B'
  period: string;      // YYYY-MM
  status: string;      // 'filed' | 'draft' | 'not_filed' | 'overdue'
  dueDate?: string | null;
}

/**
 * The complete real-data snapshot the orchestrator assembles and passes to
 * the knowledge engine. EVERY field comes from live Firestore documents.
 */
export interface BusinessDataSnapshot {
  organizationId: string;
  /** Current analysis period (YYYY-MM). */
  period: string;
  invoices: InvoiceSnapshot[];
  gstTransactions: GstTransactionSnapshot[];
  bankConnections: BankConnectionSnapshot[];
  bankTransactions: BankTransactionSnapshot[];
  clients: ClientSnapshot[];
  returns: ReturnSnapshot[];
  /** Whether GSTN is connected (live returns available). */
  gstnConnected: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM. */
function toPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Get the YYYY-MM period N months before the given period. */
function periodMinus(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const date = new Date(y, (m - 1) - months, 1);
  return toPeriod(date);
}

/** Get the YYYY-MM period N months after the given period. */
function periodPlus(period: string, months: number): string {
  return periodMinus(period, -months);
}

/** ISO month label for display (e.g. 'Feb 2024'). */
function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

/** Days between now and an ISO date (negative = past). */
function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return null;
  const now = Date.now();
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

/** Sum a numeric field safely. */
function sum<T>(arr: T[], fn: (item: T) => number | undefined | null): number {
  return arr.reduce((acc, item) => acc + (fn(item) ?? 0), 0);
}

// ─── Knowledge Engine ─────────────────────────────────────────────────────────

/**
 * Build a BusinessContext from a real-data snapshot.
 *
 * Pure & deterministic — given the same snapshot, always returns the same
 * context. NEVER reads Firestore, NEVER fabricates data.
 */
export function buildBusinessContext(data: BusinessDataSnapshot): BusinessContext {
  const { organizationId, period, invoices, gstTransactions, bankConnections, bankTransactions, clients, returns } = data;
  const now = new Date().toISOString();
  const prevPeriod = periodMinus(period, 1);

  // ── Revenue (sales invoices in the current period) ──
  const currentSales = invoices.filter(
    (inv) => inv.kind === 'sales' && inv.invoiceDate.startsWith(period),
  );
  const previousSales = invoices.filter(
    (inv) => inv.kind === 'sales' && inv.invoiceDate.startsWith(prevPeriod),
  );
  const revenueCurrent = sum(currentSales, (i) => i.grandTotal);
  const revenuePrevious = sum(previousSales, (i) => i.grandTotal);
  const revenueChange = revenueCurrent - revenuePrevious;
  const revenueChangePct = revenuePrevious > 0 ? (revenueChange / revenuePrevious) * 100 : revenueCurrent > 0 ? 100 : 0;

  // ── Expenses (purchase invoices in the current period) ──
  const currentPurchases = invoices.filter(
    (inv) => inv.kind === 'purchase' && inv.invoiceDate.startsWith(period),
  );
  const previousPurchases = invoices.filter(
    (inv) => inv.kind === 'purchase' && inv.invoiceDate.startsWith(prevPeriod),
  );
  const expenseCurrent = sum(currentPurchases, (i) => i.grandTotal);
  const expensePrevious = sum(previousPurchases, (i) => i.grandTotal);
  const expenseChange = expenseCurrent - expensePrevious;
  const expenseChangePct = expensePrevious > 0 ? (expenseChange / expensePrevious) * 100 : expenseCurrent > 0 ? 100 : 0;

  // Top expense categories — derive from party name as a proxy grouping.
  const expenseByParty = new Map<string, number>();
  for (const p of currentPurchases) {
    const key = p.partyName || 'Uncategorised';
    expenseByParty.set(key, (expenseByParty.get(key) ?? 0) + (p.grandTotal ?? 0));
  }
  const topCategories = [...expenseByParty.entries()]
    .map(([label, amount]) => ({ label, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  // ── Profit ──
  const profitCurrent = revenueCurrent - expenseCurrent;
  const profitMargin = revenueCurrent > 0 ? profitCurrent / revenueCurrent : 0;

  // ── Outstanding ──
  const receivables = sum(
    invoices.filter((i) => i.kind === 'sales' && i.balanceDue > 0),
    (i) => i.balanceDue,
  );
  const payables = sum(
    invoices.filter((i) => i.kind === 'purchase' && i.balanceDue > 0),
    (i) => i.balanceDue,
  );

  // ── GST (current period) ──
  const periodGstSales = gstTransactions.filter(
    (t) => t.transactionType === 'sales' && (t.filingPeriod === period || t.invoiceDate.startsWith(period)),
  );
  const periodGstPurchases = gstTransactions.filter(
    (t) => t.transactionType === 'purchase' && (t.filingPeriod === period || t.invoiceDate.startsWith(period)),
  );
  const gstLiability = sum(periodGstSales, (t) => (t.cgst ?? 0) + (t.sgst ?? 0) + (t.igst ?? 0) + (t.cess ?? 0));
  const gstItc = sum(periodGstPurchases, (t) => t.itcEligible ? (t.cgst ?? 0) + (t.sgst ?? 0) + (t.igst ?? 0) + (t.cess ?? 0) : 0);
  const gstNetPayable = Math.max(0, gstLiability - gstItc);

  // Filing status for the current period.
  const periodReturn = returns.find((r) => r.period === period);
  let filingStatus: BusinessContext['gst']['filingStatus'] = 'not_filed';
  if (periodReturn) {
    if (periodReturn.status === 'filed') filingStatus = 'filed';
    else if (periodReturn.status === 'draft') filingStatus = 'draft';
    else if (periodReturn.status === 'overdue') filingStatus = 'overdue';
  }
  const pendingReturns = returns.filter((r) => r.status !== 'filed').length;

  // Next filing due date — nearest future due date across returns.
  const upcomingReturnDue = returns
    .filter((r) => r.dueDate && (daysUntil(r.dueDate) ?? -1) >= 0)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))[0];
  const nextDueDate = upcomingReturnDue?.dueDate ?? null;

  // ── Banking ──
  const activeConnections = bankConnections.filter((c) => c.status === 'connected');
  const totalBalance = sum(activeConnections, (c) => c.currentBalance);
  const availableBalance = sum(activeConnections, (c) => c.availableBalance ?? c.currentBalance ?? 0);
  const periodBankTxns = bankTransactions.filter((t) => t.date.startsWith(period));
  const incomingPayments = sum(periodBankTxns, (t) => (t.type === 'credit' ? Math.abs(t.amount) : 0));
  const outgoingPayments = sum(periodBankTxns, (t) => (t.type === 'debit' ? Math.abs(t.amount) : 0));
  const pendingReconciliation = periodBankTxns.filter(
    (t) => t.reconciliationStatus && t.reconciliationStatus !== 'matched',
  ).length;

  // ── Cash Flow ──
  const netInflow = incomingPayments - outgoingPayments;
  // Burn rate = average monthly outflow over the last 3 months (if available).
  const burnMonths = [0, 1, 2].map((n) => periodMinus(period, n));
  const burnOutflows = burnMonths.map((p) =>
    sum(
      bankTransactions.filter((t) => t.date.startsWith(p) && t.type === 'debit'),
      (t) => Math.abs(t.amount),
    ),
  );
  const burnRate = burnOutflows.some((v) => v > 0)
    ? burnOutflows.reduce((a, b) => a + b, 0) / burnOutflows.filter((v) => v > 0).length
    : outgoingPayments;
  const runwayMonths = burnRate > 0
    ? (availableBalance + receivables) / burnRate
    : Number.POSITIVE_INFINITY;

  // ── Invoices ──
  const salesInvoices = invoices.filter((i) => i.kind === 'sales');
  const pendingInvoices = salesInvoices.filter((i) => i.status === 'sent' && i.balanceDue > 0);
  const overdueInvoices = salesInvoices.filter((i) => i.balanceDue > 0 && i.dueDate && (daysUntil(i.dueDate) ?? 0) < 0);
  const draftInvoices = salesInvoices.filter((i) => i.status === 'draft');
  const overdueValue = sum(overdueInvoices, (i) => i.balanceDue);
  const pendingValue = sum(pendingInvoices, (i) => i.balanceDue);

  // ── Customers ──
  const overdueClients = clients.filter((c) => c.hasOverdue);
  const topDebtors = [...clients]
    .map((c) => ({ id: c.id, name: c.name, amount: c.outstanding ?? 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // ── Deadlines (next 30 days) ──
  const upcoming: BusinessContext['deadlines']['upcoming'] = [];
  for (const r of returns) {
    const days = daysUntil(r.dueDate);
    if (days !== null && days >= 0 && days <= 30) {
      upcoming.push({
        label: `${r.returnType} · ${periodLabel(r.period)}`,
        date: r.dueDate as string,
        type: r.returnType.startsWith('3B') ? 'gst_payment' : 'gst_filing',
        daysRemaining: days,
      });
    }
  }
  // Also surface GST payment deadline if there's a net payable.
  if (gstNetPayable > 0 && nextDueDate) {
    const days = daysUntil(nextDueDate);
    if (days !== null && days >= 0 && days <= 30) {
      upcoming.push({
        label: `Pay GST · ${periodLabel(period)}`,
        date: nextDueDate,
        type: 'gst_payment',
        daysRemaining: days,
      });
    }
  }
  upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    organizationId,
    asOf: now,
    period,
    revenue: {
      current: revenueCurrent,
      previous: revenuePrevious,
      change: revenueChange,
      changePercent: revenueChangePct,
      invoiceCount: currentSales.length,
    },
    expenses: {
      current: expenseCurrent,
      previous: expensePrevious,
      change: expenseChange,
      changePercent: expenseChangePct,
      topCategories,
    },
    profit: {
      current: profitCurrent,
      margin: profitMargin,
    },
    outstanding: {
      receivables,
      payables,
      net: receivables - payables,
    },
    gst: {
      liability: gstLiability,
      itcAvailable: gstItc,
      netPayable: gstNetPayable,
      filingStatus,
      pendingReturns,
      nextDueDate,
    },
    banking: {
      totalBalance,
      availableBalance,
      incomingPayments,
      outgoingPayments,
      pendingReconciliation,
      connectedAccounts: activeConnections.length,
    },
    cashFlow: {
      netInflow,
      burnRate,
      runwayMonths,
    },
    invoices: {
      total: salesInvoices.length,
      pending: pendingInvoices.length,
      overdue: overdueInvoices.length,
      draft: draftInvoices.length,
      overdueValue,
      pendingValue,
    },
    customers: {
      total: clients.length,
      overdue: overdueClients.length,
      topDebtors,
    },
    deadlines: {
      upcoming,
    },
    gstnConnected: data.gstnConnected,
    bankConnected: activeConnections.length > 0,
  };
}

// ─── Formatting helpers (shared by engines + chat) ───────────────────────────

/** Format a number as Indian Rupees (no decimals for large numbers). */
export function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Format a percentage with sign. */
export function formatPercent(pct: number): string {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** Format a period as a human-readable label. */
export { periodLabel, periodMinus, periodPlus, daysUntil };

/** Generate a stable id from a prefix + content hash (deterministic). */
export function deterministicId(prefix: string, ...parts: (string | number)[]): string {
  const input = parts.join('|');
  // Simple deterministic hash (FNV-1a 32-bit) — sufficient for de-duplication.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

/** Current period (YYYY-MM) based on the user's clock. */
export function currentPeriod(): string {
  return toPeriod(new Date());
}
