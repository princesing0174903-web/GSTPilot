// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot AI CFO™ — Module 10: Automatic Financial Analysis (Phase 3)
//
// Detects 11 financial conditions from live business data:
//   1.  revenue_decline       — MoM revenue drop > 10%
//   2.  expense_increase      — MoM expense rise > 15%
//   3.  profit_reduction      — profit margin drop > 5 pts MoM
//   4.  negative_cash_flow    — monthly expenses > monthly revenue
//   5.  collection_delays     — overdue invoices OR efficiency < 80%
//   6.  gst_penalties         — penalty notices OR overdue returns
//   7.  itc_opportunities     — unutilised ITC from purchase bills
//   8.  duplicate_expenses    — same amount + vendor within 7 days
//   9.  vendor_risks          — vendor with > 3 overdue payables
//  10.  customer_risks        — client healthScore < 50 OR > 2 overdue invoices
//  11.  late_payments         — overdue payables > 0
//
// All logic is deterministic & transparent — every detected condition carries
// evidence strings so the UI / Oracle can show WHY it was triggered.
//
// This module is a pure server-side library imported by API routes.
// It does NOT use 'use server' and is safe to call from RSC / route handlers.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import type {
  AnalysisConditionType,
  FinancialAnalysis,
  FinancialCondition,
} from './types';

// ─── Time helpers (mirrors engine.ts — kept local to avoid coupling) ──────────

function now(): Date {
  return new Date();
}

function startOfToday(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfLastMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1);
}

function endOfLastMonth(d = now()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function monthLabel(d: Date): string {
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function inrFmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

function pctFmt(n: number): string {
  return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ─── Statutory GST due date from "YYYY-MM" period ─────────────────────────────
//  GSTR-1 → 11th of following month
//  GSTR-3B → 20th of following month
//  GSTR-9 → 31st December of the following year
//  others → 20th of following month
function filingDueDate(returnType: string, period: string): Date | null {
  const parts = period.split('-').map(Number);
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  const [year, month] = parts;
  const rt = (returnType || '').toUpperCase().replace('-', '');
  if (rt === 'GSTR9') {
    return new Date(year + 1, 11, 31);
  }
  let dueDay = 20;
  if (rt === 'GSTR1') dueDay = 11;
  else if (rt === 'GSTR3B') dueDay = 20;
  return new Date(year, month, dueDay);
}

// ─── Row shapes (subset of Prisma models used here) ───────────────────────────

interface InvoiceRow {
  id: string;
  invoiceDate: string;
  totalAmount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  status?: string;
  period?: string | null;
  buyerGstin?: string | null;
  buyerName?: string | null;
  dueDate?: string | null;
  paymentStatus?: string;
  paidAmount?: number;
  balanceAmount?: number;
}

interface ExpenseRow {
  id: string;
  date: string;
  amount: number;
  vendor?: string | null;
  category?: string | null;
  status?: string;
}

interface PurchaseBillRow {
  id: string;
  vendorName: string;
  vendorGstin?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  paidAmount?: number;
  status?: string;
  paymentStatus?: string;
}

interface PaymentRow {
  id: string;
  partyName: string;
  partyType?: string;
  amount: number;
  paymentDate: string;
  status?: string;
  invoiceId?: string | null;
  purchaseBillId?: string | null;
}

interface ClientRow {
  id: string;
  gstin: string;
  tradeName: string;
  healthScore?: number;
  status?: string;
}

interface FilingRow {
  id: string;
  returnType: string;
  period: string;
  status: string;
}

interface NoticeRow {
  id: string;
  noticeType?: string;
  status?: string;
  dueDate?: string | null;
}

// ─── Detection primitives ─────────────────────────────────────────────────────

/** Invoices considered overdue: paymentStatus='overdue' OR period-based with non-paid status. */
function isInvoiceOverdue(inv: InvoiceRow, today: Date): boolean {
  const ps = (inv.paymentStatus || '').toLowerCase();
  if (ps === 'overdue') return true;
  // Explicit due date on the invoice row
  if (inv.dueDate) {
    const dd = new Date(inv.dueDate);
    if (!isNaN(dd.getTime()) && dd < today) {
      const st = (inv.status || '').toLowerCase();
      return st !== 'paid' && st !== 'filed' && st !== 'cancelled' && ps !== 'paid';
    }
  }
  // Fall back to period-based heuristic (period = "YYYY-MM", due ~ 30 days after period end)
  if (inv.period) {
    const parts = inv.period.split('-').map(Number);
    if (parts[0] && parts[1]) {
      const due = new Date(parts[0], parts[1], 30);
      if (due < today) {
        const st = (inv.status || '').toLowerCase();
        return st !== 'paid' && st !== 'filed' && st !== 'cancelled';
      }
    }
  }
  return false;
}

/** Purchase bill considered overdue payables: dueDate < today AND not paid. */
function isPurchaseBillOverdue(bill: PurchaseBillRow, today: Date): boolean {
  const st = (bill.status || '').toLowerCase();
  const ps = (bill.paymentStatus || '').toLowerCase();
  if (st === 'paid' || ps === 'paid') return false;
  if (!bill.dueDate) return false;
  const dd = new Date(bill.dueDate);
  if (isNaN(dd.getTime())) return false;
  return dd < today;
}

/** Statutory filing overdue: status != 'filed' AND statutory due date is in the past. */
function isFilingOverdue(f: FilingRow, today: Date): boolean {
  if (f.status === 'filed') return false;
  const due = filingDueDate(f.returnType, f.period);
  if (!due) return false;
  return due < today;
}

// ─── 1. revenue_decline ───────────────────────────────────────────────────────

function detectRevenueDecline(
  invoices: InvoiceRow[],
  thisMonthStart: Date,
  tomorrow: Date,
  lmStart: Date,
  lmEnd: Date,
): FinancialCondition {
  const thisMonth = invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= thisMonthStart && d < tomorrow;
    })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  const lastMonth = invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= lmStart && d <= lmEnd;
    })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  const declinePct =
    lastMonth > 0 ? ((lastMonth - thisMonth) / lastMonth) * 100 : 0;

  const detected = lastMonth > 0 && declinePct > 10;
  const critical = declinePct > 25;

  return {
    type: 'revenue_decline',
    severity: detected ? (critical ? 'critical' : 'warning') : 'info',
    title: 'Revenue Decline',
    description: detected
      ? `Revenue dropped ${pctFmt(declinePct)} month-over-month — from ₹${inrFmt(
          lastMonth,
        )} to ₹${inrFmt(thisMonth)}.`
      : 'Revenue is stable or growing month-over-month.',
    metric: {
      label: 'MoM change',
      value: lastMonth > 0 ? pctFmt(-declinePct) : '0.0%',
      delta: detected ? `−${pctFmt(declinePct)}` : undefined,
    },
    detected,
    evidence: detected
      ? [
          `Last month (${monthLabel(lmStart)}): ₹${inrFmt(lastMonth)}`,
          `This month so far (${monthLabel(thisMonthStart)}): ₹${inrFmt(thisMonth)}`,
          `Decline: ${pctFmt(declinePct)} (> ${critical ? '25%' : '10%'} threshold).`,
        ]
      : undefined,
  };
}

// ─── 2. expense_increase ──────────────────────────────────────────────────────

function detectExpenseIncrease(
  expenses: ExpenseRow[],
  thisMonthStart: Date,
  tomorrow: Date,
  lmStart: Date,
  lmEnd: Date,
): FinancialCondition {
  const thisMonth = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= thisMonthStart && d < tomorrow;
    })
    .reduce((s, e) => s + (e.amount || 0), 0);

  const lastMonth = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= lmStart && d <= lmEnd;
    })
    .reduce((s, e) => s + (e.amount || 0), 0);

  const increasePct =
    lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  const detected = lastMonth > 0 && increasePct > 15;
  const critical = increasePct > 40;

  return {
    type: 'expense_increase',
    severity: detected ? (critical ? 'critical' : 'warning') : 'info',
    title: 'Expense Increase',
    description: detected
      ? `Operating expenses rose ${pctFmt(increasePct)} month-over-month — from ₹${inrFmt(
          lastMonth,
        )} to ₹${inrFmt(thisMonth)}.`
      : 'Expense base is stable month-over-month.',
    metric: {
      label: 'MoM change',
      value: lastMonth > 0 ? pctFmt(increasePct) : '0.0%',
      delta: detected ? `+${pctFmt(increasePct)}` : undefined,
    },
    detected,
    evidence: detected
      ? [
          `Last month (${monthLabel(lmStart)}): ₹${inrFmt(lastMonth)}`,
          `This month so far (${monthLabel(thisMonthStart)}): ₹${inrFmt(thisMonth)}`,
          `Increase: ${pctFmt(increasePct)} (> 15% threshold).`,
        ]
      : undefined,
  };
}

// ─── 3. profit_reduction ──────────────────────────────────────────────────────

function detectProfitReduction(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  thisMonthStart: Date,
  tomorrow: Date,
  lmStart: Date,
  lmEnd: Date,
): FinancialCondition {
  // Profit = revenue (invoice totalAmount) − expenses
  const revThis = invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= thisMonthStart && d < tomorrow;
    })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
  const revLast = invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= lmStart && d <= lmEnd;
    })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  const expThis = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= thisMonthStart && d < tomorrow;
    })
    .reduce((s, e) => s + (e.amount || 0), 0);
  const expLast = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= lmStart && d <= lmEnd;
    })
    .reduce((s, e) => s + (e.amount || 0), 0);

  const marginThis = revThis > 0 ? ((revThis - expThis) / revThis) * 100 : 0;
  const marginLast = revLast > 0 ? ((revLast - expLast) / revLast) * 100 : 0;

  const drop = marginLast - marginThis; // positive = margin shrank
  const detected = revLast > 0 && drop > 5;
  const critical = drop > 15;

  return {
    type: 'profit_reduction',
    severity: detected ? (critical ? 'critical' : 'warning') : 'info',
    title: 'Profit Reduction',
    description: detected
      ? `Net margin dropped ${pctFmt(drop)} pts — from ${pctFmt(
          marginLast,
        )} to ${pctFmt(marginThis)}.`
      : 'Net margin is stable or improving month-over-month.',
    metric: {
      label: 'Margin',
      value: `${pctFmt(marginThis)} (was ${pctFmt(marginLast)})`,
      delta: detected ? `−${pctFmt(drop)} pts` : undefined,
    },
    detected,
    evidence: detected
      ? [
          `Last month: revenue ₹${inrFmt(revLast)} − expenses ₹${inrFmt(
            expLast,
          )} = ${pctFmt(marginLast)} margin`,
          `This month: revenue ₹${inrFmt(revThis)} − expenses ₹${inrFmt(
            expThis,
          )} = ${pctFmt(marginThis)} margin`,
          `Margin drop: ${pctFmt(drop)} pts (> 5 pt threshold).`,
        ]
      : undefined,
  };
}

// ─── 4. negative_cash_flow ────────────────────────────────────────────────────

function detectNegativeCashFlow(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  thisMonthStart: Date,
  tomorrow: Date,
): FinancialCondition {
  const revThis = invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= thisMonthStart && d < tomorrow;
    })
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  const expThis = expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d >= thisMonthStart && d < tomorrow;
    })
    .reduce((s, e) => s + (e.amount || 0), 0);

  const detected = expThis > revThis && revThis > 0; // ignore empty-data month
  const shortfall = expThis - revThis;

  return {
    type: 'negative_cash_flow',
    severity: detected ? 'critical' : 'info',
    title: 'Negative Cash Flow',
    description: detected
      ? `Monthly expenses (₹${inrFmt(expThis)}) exceed revenue (₹${inrFmt(
          revThis,
        )}) by ₹${inrFmt(shortfall)}. Cash is being burned this month.`
      : 'Cash flow is positive this month — revenue covers expenses.',
    metric: {
      label: 'Net cash',
      value: `₹${inrFmt(revThis - expThis)}`,
      delta: detected ? `−₹${inrFmt(shortfall)}` : undefined,
    },
    detected,
    evidence: detected
      ? [
          `This month revenue: ₹${inrFmt(revThis)}`,
          `This month expenses: ₹${inrFmt(expThis)}`,
          `Net monthly cash flow: −₹${inrFmt(shortfall)}.`,
        ]
      : undefined,
  };
}

// ─── 5. collection_delays ─────────────────────────────────────────────────────

function detectCollectionDelays(
  invoices: InvoiceRow[],
  today: Date,
): FinancialCondition {
  const overdue = invoices.filter((i) => isInvoiceOverdue(i, today));
  const totalBilled = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const outstanding = invoices
    .filter((i) => {
      const st = (i.status || '').toLowerCase();
      const ps = (i.paymentStatus || '').toLowerCase();
      return st !== 'paid' && st !== 'filed' && st !== 'cancelled' && ps !== 'paid';
    })
    .reduce((s, i) => s + ((i.balanceAmount ?? i.totalAmount) || 0), 0);
  const collected = Math.max(totalBilled - outstanding, 0);
  const efficiency =
    totalBilled > 0 ? clamp(Math.round((collected / totalBilled) * 100), 0, 100) : 100;

  const detected = overdue.length > 0 || efficiency < 80;
  const critical = overdue.length > 5 || efficiency < 60;

  return {
    type: 'collection_delays',
    severity: detected ? (critical ? 'critical' : 'warning') : 'info',
    title: 'Collection Delays',
    description: detected
      ? `${overdue.length} overdue invoice(s) and collection efficiency at ${efficiency}%.`
      : `No overdue invoices — collection efficiency at ${efficiency}%.`,
    metric: {
      label: 'Efficiency',
      value: `${efficiency}%`,
      delta: detected ? `${overdue.length} overdue` : undefined,
    },
    detected,
    evidence: detected
      ? [
          `Total billed: ₹${inrFmt(totalBilled)}`,
          `Outstanding: ₹${inrFmt(outstanding)}`,
          `Collected: ₹${inrFmt(collected)} → ${efficiency}% efficiency`,
          `Overdue invoices: ${overdue.length}`,
        ]
      : undefined,
  };
}

// ─── 6. gst_penalties ─────────────────────────────────────────────────────────

function detectGSTPenalties(
  notices: NoticeRow[],
  filings: FilingRow[],
  today: Date,
): FinancialCondition {
  const penaltyNotices = notices.filter((n) => {
    const t = (n.noticeType || '').toLowerCase();
    return t.includes('penalty') || t.includes('fine') || t.includes('interest');
  });
  const overdueFilings = filings.filter((f) => isFilingOverdue(f, today));

  const detected = penaltyNotices.length > 0 || overdueFilings.length > 0;
  const critical = penaltyNotices.length > 0;

  return {
    type: 'gst_penalties',
    severity: detected ? (critical ? 'critical' : 'warning') : 'info',
    title: 'GST Penalties',
    description: detected
      ? critical
        ? `${penaltyNotices.length} penalty notice(s) received — respond immediately to avoid escalation.`
        : `${overdueFilings.length} overdue GST return(s) — late fee ₹50/day + 18% p.a. interest accruing.`
      : 'No GST penalties or overdue returns. Clean compliance posture.',
    metric: {
      label: 'Exposure',
      value: critical
        ? `${penaltyNotices.length} notice(s)`
        : `${overdueFilings.length} overdue`,
    },
    detected,
    evidence: detected
      ? [
          ...(penaltyNotices.length > 0
            ? [
                `Penalty/fine/interest notices: ${penaltyNotices.length} (${penaltyNotices
                  .slice(0, 3)
                  .map((n) => n.noticeType || 'gst_notice')
                  .join(', ')})`,
              ]
            : []),
          ...(overdueFilings.length > 0
            ? [
                `Overdue returns: ${overdueFilings.length} (${overdueFilings
                  .slice(0, 5)
                  .map((f) => `${f.returnType} (${f.period})`)
                  .join(', ')})`,
              ]
            : []),
        ]
      : undefined,
  };
}

// ─── 7. itc_opportunities ─────────────────────────────────────────────────────

function detectITCOpportunities(
  purchaseBills: PurchaseBillRow[],
  invoices: InvoiceRow[],
  thisMonthStart: Date,
  tomorrow: Date,
): FinancialCondition {
  // ITC available = GST paid on purchase bills not yet fully utilised.
  // We approximate "unutilised" = bills that are recorded/matched but NOT yet paid
  // OR paid within the current filing window. For a transparent heuristic, we
  // treat ALL billed GST as available ITC until claimed.
  const itcAvailable = purchaseBills
    .filter((b) => {
      const st = (b.status || '').toLowerCase();
      return st !== 'cancelled';
    })
    .reduce(
      (s, b) => s + (b.gstAmount || (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0) + (b.cess || 0)),
      0,
    );

  // Approximate output liability (this month so far) to gauge utilisation headroom
  const outputLiability = invoices
    .filter((i) => {
      const d = new Date(i.invoiceDate);
      return d >= thisMonthStart && d < tomorrow;
    })
    .reduce((s, i) => s + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0) + (i.cess || 0), 0);

  const netLiability = Math.max(outputLiability - itcAvailable, 0);
  const fullyUtilised = itcAvailable > 0 && netLiability === 0 && outputLiability > 0;
  const detected = itcAvailable > 0 && !fullyUtilised;

  return {
    type: 'itc_opportunities',
    severity: detected ? 'opportunity' : 'info',
    title: 'ITC Opportunity',
    description: detected
      ? `₹${inrFmt(itcAvailable)} input tax credit available to offset against upcoming GST liability.`
      : 'No claimable ITC available from purchase bills.',
    metric: {
      label: 'ITC available',
      value: `₹${inrFmt(itcAvailable)}`,
      delta: detected ? `vs ₹${inrFmt(outputLiability)} liability` : undefined,
    },
    detected,
    evidence: detected
      ? [
          `Total ITC from ${purchaseBills.length} purchase bill(s): ₹${inrFmt(itcAvailable)}`,
          `Output tax liability this month: ₹${inrFmt(outputLiability)}`,
          fullyUtilised
            ? `ITC fully utilised against liability.`
            : `Net liability after ITC offset: ₹${inrFmt(netLiability)} — claim in next GSTR-3B.`,
        ]
      : undefined,
  };
}

// ─── 8. duplicate_expenses ────────────────────────────────────────────────────

function detectDuplicateExpenses(expenses: ExpenseRow[]): FinancialCondition {
  // Group by (vendor, amount) — same vendor + same amount within a 7-day window
  // is a strong duplicate signal.
  const groups = new Map<string, ExpenseRow[]>();
  for (const e of expenses) {
    const vendor = (e.vendor || '').trim().toLowerCase();
    if (!vendor) continue; // skip entries with no vendor
    const key = `${vendor}|${(e.amount || 0).toFixed(2)}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const duplicates: Array<{ vendor: string; amount: number; dates: string[] }> = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    // Walk adjacent pairs — if any pair is within 7 days, flag the whole group
    for (let i = 1; i < sorted.length; i++) {
      const a = new Date(sorted[i - 1].date);
      const b = new Date(sorted[i].date);
      if (isNaN(a.getTime()) || isNaN(b.getTime())) continue;
      const gapDays = Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
      if (gapDays <= 7) {
        duplicates.push({
          vendor: sorted[0].vendor || 'unknown',
          amount: sorted[0].amount || 0,
          dates: sorted.map((s) => s.date),
        });
        break;
      }
    }
  }

  const detected = duplicates.length > 0;

  return {
    type: 'duplicate_expenses',
    severity: detected ? 'warning' : 'info',
    title: 'Duplicate Expenses',
    description: detected
      ? `${duplicates.length} potential duplicate expense group(s) detected — same vendor + amount within 7 days.`
      : 'No duplicate expense patterns detected.',
    metric: {
      label: 'Duplicate groups',
      value: `${duplicates.length}`,
    },
    detected,
    evidence: detected
      ? duplicates
          .slice(0, 5)
          .map(
            (d) =>
              `${d.vendor} · ₹${inrFmt(d.amount)} × ${d.dates.length} entries (${d.dates
                .slice(0, 3)
                .join(', ')})`,
          )
      : undefined,
  };
}

// ─── 9. vendor_risks ──────────────────────────────────────────────────────────

function detectVendorRisks(
  purchaseBills: PurchaseBillRow[],
  today: Date,
): FinancialCondition {
  const byVendor = new Map<string, PurchaseBillRow[]>();
  for (const b of purchaseBills) {
    const key = (b.vendorGstin || b.vendorName || 'unknown').trim().toLowerCase();
    const list = byVendor.get(key) ?? [];
    list.push(b);
    byVendor.set(key, list);
  }

  const riskyVendors: Array<{ name: string; overdueCount: number; totalOutstanding: number }> = [];
  for (const list of byVendor.values()) {
    const overdue = list.filter((b) => isPurchaseBillOverdue(b, today));
    if (overdue.length > 3) {
      const outstanding = overdue.reduce(
        (s, b) => s + ((b.totalAmount ?? 0) - (b.paidAmount ?? 0)),
        0,
      );
      riskyVendors.push({
        name: list[0].vendorName || 'unknown',
        overdueCount: overdue.length,
        totalOutstanding: outstanding,
      });
    }
  }
  riskyVendors.sort((a, b) => b.overdueCount - a.overdueCount);

  const detected = riskyVendors.length > 0;

  return {
    type: 'vendor_risks',
    severity: detected ? 'warning' : 'info',
    title: 'Vendor Risks',
    description: detected
      ? `${riskyVendors.length} vendor(s) with > 3 overdue payables — relationship / supply risk.`
      : 'No vendors with critical overdue payable concentration.',
    metric: {
      label: 'At-risk vendors',
      value: `${riskyVendors.length}`,
    },
    detected,
    evidence: detected
      ? riskyVendors
          .slice(0, 5)
          .map(
            (v) =>
              `${v.name}: ${v.overdueCount} overdue bills, ₹${inrFmt(
                v.totalOutstanding,
              )} outstanding`,
          )
      : undefined,
  };
}

// ─── 10. customer_risks ───────────────────────────────────────────────────────

function detectCustomerRisks(
  clients: ClientRow[],
  invoices: InvoiceRow[],
  today: Date,
): FinancialCondition {
  const byGstin = new Map<string, InvoiceRow[]>();
  for (const inv of invoices) {
    const key = (inv.buyerGstin || '').trim().toLowerCase();
    if (!key) continue;
    const list = byGstin.get(key) ?? [];
    list.push(inv);
    byGstin.set(key, list);
  }

  const riskyClients: Array<{
    name: string;
    gstin: string;
    healthScore: number;
    overdueCount: number;
    reason: string;
  }> = [];

  for (const c of clients) {
    const key = (c.gstin || '').trim().toLowerCase();
    const cInvoices = byGstin.get(key) ?? [];
    const overdueCount = cInvoices.filter((i) => isInvoiceOverdue(i, today)).length;
    const hs = c.healthScore ?? 0;
    const lowHealth = hs < 50;
    const manyOverdue = overdueCount > 2;
    if (lowHealth || manyOverdue) {
      riskyClients.push({
        name: c.tradeName,
        gstin: c.gstin,
        healthScore: hs,
        overdueCount,
        reason: lowHealth
          ? `health score ${hs}/100 < 50`
          : `${overdueCount} overdue invoices`,
      });
    }
  }
  riskyClients.sort(
    (a, b) => b.overdueCount - a.overdueCount || a.healthScore - b.healthScore,
  );

  const detected = riskyClients.length > 0;
  const critical = riskyClients.some(
    (r) => r.healthScore > 0 && r.healthScore < 25,
  );

  return {
    type: 'customer_risks',
    severity: detected ? (critical ? 'critical' : 'warning') : 'info',
    title: 'Customer Risks',
    description: detected
      ? `${riskyClients.length} client(s) flagged — low health score or chronic overdue invoices.`
      : 'No clients with critical risk indicators.',
    metric: {
      label: 'At-risk clients',
      value: `${riskyClients.length}`,
    },
    detected,
    evidence: detected
      ? riskyClients
          .slice(0, 5)
          .map(
            (r) =>
              `${r.name} (${r.gstin}): ${r.reason}`,
          )
      : undefined,
  };
}

// ─── 11. late_payments ────────────────────────────────────────────────────────

function detectLatePayments(
  purchaseBills: PurchaseBillRow[],
  invoices: InvoiceRow[],
  payments: PaymentRow[],
  today: Date,
): FinancialCondition {
  // Overdue vendor payables + overdue customer receivables + pending/failed payments
  const overduePayables = purchaseBills.filter((b) =>
    isPurchaseBillOverdue(b, today),
  );
  const overdueReceivables = invoices.filter((i) => isInvoiceOverdue(i, today));
  const stuckPayments = payments.filter((p) => {
    const s = (p.status || '').toLowerCase();
    return s === 'pending' || s === 'failed';
  });

  const totalLate = overduePayables.length + overdueReceivables.length + stuckPayments.length;
  const detected = totalLate > 0;
  const critical = overduePayables.length > 5 || totalLate > 10;

  const totalValue =
    overduePayables.reduce((s, b) => s + ((b.totalAmount ?? 0) - (b.paidAmount ?? 0)), 0) +
    overdueReceivables.reduce(
      (s, i) => s + ((i.balanceAmount ?? i.totalAmount) || 0),
      0,
    );

  return {
    type: 'late_payments',
    severity: detected ? (critical ? 'critical' : 'warning') : 'info',
    title: 'Late Payments',
    description: detected
      ? `${totalLate} late payment item(s) — ${overduePayables.length} overdue vendor bill(s), ${overdueReceivables.length} overdue invoice(s), ${stuckPayments.length} stuck payment(s).`
      : 'No overdue vendor bills, receivables, or stuck payments.',
    metric: {
      label: 'Late items',
      value: `${totalLate}`,
      delta: detected ? `₹${inrFmt(totalValue)} at stake` : undefined,
    },
    detected,
    evidence: detected
      ? [
          `Overdue vendor bills (payables): ${overduePayables.length}`,
          `Overdue customer invoices (receivables): ${overdueReceivables.length}`,
          `Stuck / failed payments: ${stuckPayments.length}`,
          `Total value at stake: ₹${inrFmt(totalValue)}`,
        ]
      : undefined,
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Build a full FinancialAnalysis from live Prisma data.
 *
 * Deterministic & transparent: every condition is computed independently and
 * carries evidence strings explaining WHY it triggered.
 *
 * Empty data → all conditions return detected=false with valid structures.
 * Never throws.
 */
export async function buildFinancialAnalysis(): Promise<FinancialAnalysis> {
  try {
    const [invoicesRaw, expensesRaw, paymentsRaw, purchaseBillsRaw, clientsRaw, filingsRaw, noticesRaw] =
      await Promise.all([
        db.invoice.findMany({
          select: {
            id: true,
            invoiceDate: true,
            totalAmount: true,
            taxableValue: true,
            cgst: true,
            sgst: true,
            igst: true,
            cess: true,
            status: true,
            period: true,
            buyerGstin: true,
            buyerName: true,
            dueDate: true,
            paymentStatus: true,
            paidAmount: true,
            balanceAmount: true,
          },
          take: 5000,
        }) as Promise<InvoiceRow[]>,
        db.expense.findMany({
          select: {
            id: true,
            date: true,
            amount: true,
            vendor: true,
            category: true,
            status: true,
          },
          take: 5000,
        }) as Promise<ExpenseRow[]>,
        db.payment.findMany({
          select: {
            id: true,
            partyName: true,
            partyType: true,
            amount: true,
            paymentDate: true,
            status: true,
            invoiceId: true,
            purchaseBillId: true,
          },
          take: 5000,
        }) as Promise<PaymentRow[]>,
        db.purchaseBill.findMany({
          select: {
            id: true,
            vendorName: true,
            vendorGstin: true,
            invoiceDate: true,
            dueDate: true,
            totalAmount: true,
            cgst: true,
            sgst: true,
            igst: true,
            cess: true,
            gstAmount: true,
            paidAmount: true,
            status: true,
            paymentStatus: true,
          },
          take: 5000,
        }) as Promise<PurchaseBillRow[]>,
        db.client.findMany({
          select: {
            id: true,
            gstin: true,
            tradeName: true,
            healthScore: true,
            status: true,
          },
          take: 1000,
        }) as Promise<ClientRow[]>,
        db.gSTRFiling.findMany({
          select: {
            id: true,
            returnType: true,
            period: true,
            status: true,
          },
          take: 2000,
        }) as Promise<FilingRow[]>,
        db.notice.findMany({
          select: {
            id: true,
            noticeType: true,
            status: true,
            dueDate: true,
          },
          take: 500,
        }) as Promise<NoticeRow[]>,
      ]);

    // Time anchors
    const today = now();
    const todayStart = startOfToday(today);
    const tomorrow = addDays(todayStart, 1);
    const mStart = startOfMonth(today);
    const lmStart = startOfLastMonth(today);
    const lmEnd = endOfLastMonth(today);

    // Build all 11 conditions
    const conditions: FinancialCondition[] = [
      detectRevenueDecline(invoicesRaw, mStart, tomorrow, lmStart, lmEnd),
      detectExpenseIncrease(expensesRaw, mStart, tomorrow, lmStart, lmEnd),
      detectProfitReduction(invoicesRaw, expensesRaw, mStart, tomorrow, lmStart, lmEnd),
      detectNegativeCashFlow(invoicesRaw, expensesRaw, mStart, tomorrow),
      detectCollectionDelays(invoicesRaw, today),
      detectGSTPenalties(noticesRaw, filingsRaw, today),
      detectITCOpportunities(purchaseBillsRaw, invoicesRaw, mStart, tomorrow),
      detectDuplicateExpenses(expensesRaw),
      detectVendorRisks(purchaseBillsRaw, today),
      detectCustomerRisks(clientsRaw, invoicesRaw, today),
      detectLatePayments(purchaseBillsRaw, invoicesRaw, paymentsRaw, today),
    ];

    const detectedCount = conditions.filter((c) => c.detected).length;
    const criticalCount = conditions.filter((c) => c.severity === 'critical').length;

    return { conditions, detectedCount, criticalCount };
  } catch (err) {
    // Fail-safe: never throw from analysis — return an empty-but-valid structure.
    // This lets the API route respond gracefully even if Prisma hiccups.
    const fallbackConditions: FinancialCondition[] = (
      [
        'revenue_decline',
        'expense_increase',
        'profit_reduction',
        'negative_cash_flow',
        'collection_delays',
        'gst_penalties',
        'itc_opportunities',
        'duplicate_expenses',
        'vendor_risks',
        'customer_risks',
        'late_payments',
      ] as AnalysisConditionType[]
    ).map((type) => ({
      type,
      severity: 'info' as const,
      title: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: 'Analysis unavailable — data fetch failed.',
      detected: false,
    }));
    return {
      conditions: fallbackConditions,
      detectedCount: 0,
      criticalCount: 0,
    };
  }
}

// Re-export types for convenience
export type { FinancialAnalysis, FinancialCondition, AnalysisConditionType } from './types';
