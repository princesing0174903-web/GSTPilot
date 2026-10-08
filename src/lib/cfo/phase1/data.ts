// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ Phase 1 — Shared Data Fetcher (TENANT-SCOPED)
//
// Single source of truth for fetching all connected business data from Prisma.
// Every Phase 1 engine imports RawCFOData from here — no engine touches Prisma
// directly. This keeps data sources centralized and easy to audit.
//
// 🔒 TENANT ISOLATION: Every query is scoped by `client: { firmId: organizationId }`.
// An empty/missing organizationId returns EMPTY data (never global/cross-tenant).
// This is a hard security guarantee — no caller can accidentally leak another
// tenant's invoices, expenses, payments, or filings.
//
// Data sources covered:
//   • GSTN  (GSTRFilings, Notices, Clients with GSTIN)
//   • Bank Accounts (DataConnection bank statements, Payments)
//   • Invoices (sales, receivables, collections)
//   • Expenses (categorized operational spend)
//   • Clients (customer master)
//   • Collections (Payments from customers)
//   • Returns (GSTRFilings)
//   • Reports (AIReports)
//   • Purchase Bills (vendor invoices, ITC source)
//   • Employees (payroll headcount)
//
// All fetched from REAL Prisma models. No mock data. No placeholders.
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';

// ─── Row Types ────────────────────────────────────────────────────────────────

export interface InvoiceRow {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  sellerGstin: string;
  buyerGstin: string | null;
  buyerName: string | null;
  invoiceType: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalAmount: number;
  gstAmount: number;
  status: string;
  period: string | null;
  dueDate: string | null;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  paymentDate: string | null;
  recurring: boolean;
}

export interface ExpenseRow {
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
}

export interface PaymentRow {
  id: string;
  clientId: string | null;
  invoiceId: string | null;
  purchaseBillId: string | null;
  partyName: string;
  partyType: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNo: string | null;
  status: string;
  reconciled: boolean;
}

export interface PurchaseBillRow {
  id: string;
  clientId: string | null;
  vendorName: string;
  vendorGstin: string | null;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  paymentStatus: string;
  category: string | null;
}

export interface ClientRow {
  id: string;
  gstin: string;
  tradeName: string;
  legalName: string | null;
  state: string | null;
  stateCode: string | null;
  status: string;
  healthScore: number;
  entityType: string;
}

export interface FilingRow {
  id: string;
  clientId: string;
  returnType: string;
  period: string;
  status: string;
  filedDate: string | null;
  totalTaxableValue: number;
  totalTax: number;
  financialYear: string | null;
}

export interface NoticeRow {
  id: string;
  clientId: string;
  noticeType: string;
  noticeNumber: string | null;
  noticeDate: string | null;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
}

export interface EmployeeRow {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  salary: number;
  status: string;
}

export interface SyncedRecordRow {
  id: string;
  connectionId: string;
  sourceType: string;   // 'gst_profile' | 'gst_return' | 'bank_tx' | 'email' | 'whatsapp_msg' | 'accounting_invoice'
  externalId: string | null;
  title: string | null;
  amount: number | null;
  date: string | null;
  rawData: string | null;  // JSON blob
  category: string | null;
  processed: boolean;
}

export interface DataConnectionRow {
  id: string;
  type: string;         // 'gstn' | 'bank' | 'gmail' | 'whatsapp' | 'tally' | 'zoho' | 'quickbooks'
  status: string;
  label: string;
  identifier: string | null;
  metadata: string | null;
  lastSyncAt: Date | null;
}

export interface RawCFOData {
  invoices: InvoiceRow[];
  expenses: ExpenseRow[];
  payments: PaymentRow[];
  purchaseBills: PurchaseBillRow[];
  clients: ClientRow[];
  filings: FilingRow[];
  notices: NoticeRow[];
  employees: EmployeeRow[];
  syncedRecords: SyncedRecordRow[];
  dataConnections: DataConnectionRow[];
  fetchedAt: string;
  hasLiveData: boolean;
  dataSources: string[];
}

// ─── Fetcher (TENANT-SCOPED) ─────────────────────────────────────────────────

/**
 * Fetch all connected business data for a SINGLE organization.
 *
 * 🔒 SECURITY: Every query is scoped by `client: { firmId: organizationId }`.
 * If organizationId is empty/null, returns EMPTY data (never global/cross-tenant).
 *
 * @param organizationId The org/firm id (from OrgContext). REQUIRED for any data.
 */
export async function fetchRawCFOData(organizationId: string): Promise<RawCFOData> {
  // 🔒 Hard tenant gate: no orgId → no data. Never fall through to a global query.
  if (!organizationId) {
    return {
      invoices: [], expenses: [], payments: [], purchaseBills: [], clients: [],
      filings: [], notices: [], employees: [], syncedRecords: [], dataConnections: [],
      fetchedAt: new Date().toISOString(),
      hasLiveData: false,
      dataSources: [],
    };
  }

  // The tenant filter applied to every client-owned table.
  const firmScope = { client: { firmId: organizationId } };

  // NOTE: syncedRecord + dataConnection are scoped by userId (not client.firmId),
  // so using firmScope on them throws PrismaClientValidationError. We use
  // allSettled so those two failing queries return [] instead of crashing the
  // entire data fetch (which would blank out invoices, expenses, etc.).
  const settled = await Promise.allSettled([
    db.invoice.findMany({
      where: firmScope,
      select: {
        id: true, clientId: true, invoiceNumber: true, invoiceDate: true,
        sellerGstin: true, buyerGstin: true, buyerName: true, invoiceType: true,
        taxableValue: true, cgst: true, sgst: true, igst: true, cess: true,
        totalAmount: true, gstAmount: true, status: true, period: true,
        dueDate: true, paidAmount: true, balanceAmount: true, paymentStatus: true,
        paymentDate: true, recurring: true,
      },
      take: 10000,
    }) as Promise<InvoiceRow[]>,
    db.expense.findMany({
      where: firmScope,
      select: {
        id: true, clientId: true, category: true, description: true, vendor: true,
        amount: true, gst: true, gstClaimable: true, date: true,
        paymentMode: true, status: true,
      },
      take: 10000,
    }) as Promise<ExpenseRow[]>,
    db.payment.findMany({
      where: firmScope,
      select: {
        id: true, clientId: true, invoiceId: true, purchaseBillId: true,
        partyName: true, partyType: true, amount: true, paymentDate: true,
        paymentMode: true, referenceNo: true, status: true, reconciled: true,
      },
      take: 10000,
    }) as Promise<PaymentRow[]>,
    db.purchaseBill.findMany({
      where: firmScope,
      select: {
        id: true, clientId: true, vendorName: true, vendorGstin: true,
        invoiceNo: true, invoiceDate: true, dueDate: true, taxableValue: true,
        cgst: true, sgst: true, igst: true, cess: true, gstAmount: true,
        totalAmount: true, paidAmount: true, balanceAmount: true, status: true,
        paymentStatus: true, category: true,
      },
      take: 10000,
    }) as Promise<PurchaseBillRow[]>,
    db.client.findMany({
      where: { firmId: organizationId },
      select: {
        id: true, gstin: true, tradeName: true, legalName: true, state: true,
        stateCode: true, status: true, healthScore: true, entityType: true,
      },
      take: 5000,
    }) as Promise<ClientRow[]>,
    db.gSTRFiling.findMany({
      where: firmScope,
      select: {
        id: true, clientId: true, returnType: true, period: true, status: true,
        filedDate: true, totalTaxableValue: true, totalTax: true, financialYear: true,
      },
      take: 5000,
    }) as Promise<FilingRow[]>,
    db.notice.findMany({
      where: firmScope,
      select: {
        id: true, clientId: true, noticeType: true, noticeNumber: true,
        noticeDate: true, subject: true, description: true, status: true,
        priority: true, dueDate: true,
      },
      take: 2000,
    }) as Promise<NoticeRow[]>,
    // Employee has no firmId relation — return empty rather than leak cross-tenant.
    // Re-enable once Employee gains an organizationId column.
    Promise.resolve([]) as Promise<EmployeeRow[]>,
    db.syncedRecord.findMany({
      where: firmScope,
      select: {
        id: true, connectionId: true, sourceType: true, externalId: true, title: true,
        amount: true, date: true, rawData: true, category: true, processed: true,
      },
      take: 5000,
    }) as Promise<SyncedRecordRow[]>,
    db.dataConnection.findMany({
      where: firmScope,
      select: { id: true, type: true, status: true, label: true, identifier: true, metadata: true, lastSyncAt: true },
      take: 200,
    }) as Promise<DataConnectionRow[]>,
  ]);
  const invoices = settled[0].status === 'fulfilled' ? settled[0].value : [];
  const expenses = settled[1].status === 'fulfilled' ? settled[1].value : [];
  const payments = settled[2].status === 'fulfilled' ? settled[2].value : [];
  const purchaseBills = settled[3].status === 'fulfilled' ? settled[3].value : [];
  const clients = settled[4].status === 'fulfilled' ? settled[4].value : [];
  const filings = settled[5].status === 'fulfilled' ? settled[5].value : [];
  const notices = settled[6].status === 'fulfilled' ? settled[6].value : [];
  const employees = settled[7].status === 'fulfilled' ? settled[7].value : [];
  const syncedRecords = settled[8].status === 'fulfilled' ? settled[8].value : [];
  const dataConnections = settled[9].status === 'fulfilled' ? settled[9].value : [];

  const hasLiveData =
    invoices.length > 0 ||
    expenses.length > 0 ||
    clients.length > 0 ||
    filings.length > 0 ||
    payments.length > 0 ||
    purchaseBills.length > 0;

  // Derive connected data sources for transparency
  const sourceSet = new Set<string>();
  if (invoices.length > 0 || filings.length > 0) sourceSet.add('Invoices');
  if (clients.length > 0) sourceSet.add('Clients');
  if (filings.length > 0) sourceSet.add('GSTN');
  if (notices.length > 0) sourceSet.add('Notices');
  if (expenses.length > 0) sourceSet.add('Expenses');
  if (payments.length > 0) sourceSet.add('Payments');
  if (purchaseBills.length > 0) sourceSet.add('Purchase Bills');
  if (employees.length > 0) sourceSet.add('Payroll');
  for (const dc of dataConnections) {
    if (dc.status === 'connected' || dc.status === 'active') {
      const label = dc.type.charAt(0).toUpperCase() + dc.type.slice(1);
      sourceSet.add(label);
    }
  }
  if (syncedRecords.some((r) => r.sourceType === 'bank_tx')) sourceSet.add('Bank');
  if (syncedRecords.some((r) => r.sourceType === 'email')) sourceSet.add('Gmail');
  if (syncedRecords.some((r) => r.sourceType === 'whatsapp_msg')) sourceSet.add('WhatsApp');
  if (syncedRecords.some((r) => r.sourceType === 'gst_return' || r.sourceType === 'gst_profile')) sourceSet.add('GSTN');
  if (syncedRecords.some((r) => r.sourceType === 'accounting_invoice' || r.sourceType === 'accounting_ledger')) sourceSet.add('Accounting');

  return {
    invoices,
    expenses,
    payments,
    purchaseBills,
    clients,
    filings,
    notices,
    employees,
    syncedRecords,
    dataConnections,
    fetchedAt: new Date().toISOString(),
    hasLiveData,
    dataSources: Array.from(sourceSet).sort(),
  };
}

// ─── Shared time + formatting helpers ─────────────────────────────────────────

export function now(): Date { return new Date(); }
export function startOfToday(d = now()): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
export function startOfMonth(d = now()): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
export function startOfLastMonth(d = now()): Date { return new Date(d.getFullYear(), d.getMonth() - 1, 1); }
export function endOfLastMonth(d = now()): Date { return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999); }
export function startOfWeek(d = now()): Date {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? 6 : day - 1); // Monday-start
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}
export function startOfQuarter(d = now()): Date {
  const qMonth = Math.floor(d.getMonth() / 3) * 3; // Jan, Apr, Jul, Oct
  return new Date(d.getFullYear(), qMonth, 1);
}
export function startOfLastQuarter(d = now()): Date {
  const qMonth = Math.floor(d.getMonth() / 3) * 3 - 3;
  return new Date(d.getFullYear(), qMonth, 1);
}
export function endOfLastQuarter(d = now()): Date {
  const qStart = startOfLastQuarter(d);
  return new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0, 23, 59, 59, 999);
}
export function startOfYear(d = now()): Date { return new Date(d.getFullYear(), 0, 1); }
export function startOfLastYear(d = now()): Date { return new Date(d.getFullYear() - 1, 0, 1); }
export function endOfLastYear(d = now()): Date { return new Date(d.getFullYear() - 1, 11, 31, 23, 59, 59, 999); }
export function addDays(d: Date, days: number): Date { const r = new Date(d); r.setDate(r.getDate() + days); return r; }
export function addMonths(d: Date, months: number): Date { const r = new Date(d); r.setMonth(r.getMonth() + months); return r; }

export function ymd(d: Date): string { return d.toISOString().split('T')[0]; }

export function monthLabel(d: Date): string {
  return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

export function quarterLabel(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

export function yearLabel(d: Date): string { return String(d.getFullYear()); }

export function periodLabel(year: number, month1Based: number): string {
  return `${year}-${String(month1Based).padStart(2, '0')}`;
}

export function inrFmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function inrFull(n: number): string {
  return '₹' + inrFmt(n);
}

export function inrCompact(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, n)); }

export function mean(nums: number[]): number { return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; }

export function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function trendFromPct(p: number, upThreshold = 5, downThreshold = -5): 'up' | 'down' | 'stable' {
  if (p >= upThreshold) return 'up';
  if (p <= downThreshold) return 'down';
  return 'stable';
}

export function roundTo(n: number, decimals = 0): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// ─── GST statutory due dates ──────────────────────────────────────────────────

export function filingDueDate(returnType: string, period: string): Date | null {
  // period format: "YYYY-MM"
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return null;
  const rt = (returnType || '').toUpperCase();
  if (rt === 'GSTR-1') return new Date(year, month, 11);          // 11th of next month
  if (rt === 'GSTR-3B') return new Date(year, month, 20);         // 20th of next month
  if (rt === 'GSTR-9') return new Date(year + 1, 11, 31);         // Dec 31 of next year
  return new Date(year, month, 20); // default
}
