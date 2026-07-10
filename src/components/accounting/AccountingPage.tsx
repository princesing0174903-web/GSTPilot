'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — AccountingPage (Rebuilt from real Firestore data)
// ═══════════════════════════════════════════════════════════════════════════════
// Previously this file was 100% hardcoded demo data (16 fake COA entries, 10 fake
// journal entries, fake stat cards, fake 12-month chart arrays). It is now wired
// to REAL Firestore collections: invoices, expenses, payments, bank_accounts,
// bank_transactions. All metrics are COMPUTED from real records — no mock data.
//
// What's auto-generated from real data:
//   • Stat cards: Total Revenue / Total Expenses / Net Profit / Retained Earnings
//   • Chart of Accounts: Cash & Bank, AR, AP, GST Payable, Sales Revenue, Expense-by-category
//   • Journal Entries: one per invoice / expense / payment (debit/credit math)
//   • 6 Reports (dialog): P&L, Balance Sheet, Trial Balance, Cash Flow, General Ledger, Aging
//   • Export: downloads current Journal Entries as CSV
//
// What's honestly limited (no full accounting engine yet):
//   • "New Entry" / "New Account" open a notice dialog (not a dead button)
//   • "Change %" column shows "—" (no historical comparison yet)
//   • Retained Earnings = Net Profit (no prior-year carryforward yet)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  IndianRupee, FileText, BarChart3, Scale, CreditCard,
  Wallet, Building2, ChevronRight, Plus, Search,
  ArrowRight, CheckCircle2, Clock, AlertCircle,
  PieChart, RefreshCw, Download, Filter, Info,
  Check, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/EmptyState';

import {
  useFireInvoices, useFireExpenses, useFirePayments,
  useFireBankAccounts, useFireBankTransactions, useFireJournalEntries,
} from '@/hooks/use-firestore';
import {
  createJournalEntry, deleteJournalEntry,
} from '@/lib/firestore-service';
import type {
  FirestoreInvoice, FirestoreExpense, FirestorePayment,
  FirestoreBankAccount, FirestoreBankTransaction, FirestoreJournalEntry,
} from '@/lib/firestore-schema';

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => '₹' + (Number.isFinite(n) ? n : 0).toLocaleString('en-IN');
const fmtINRAbs = (n: number) => '₹' + Math.abs(Number.isFinite(n) ? n : 0).toLocaleString('en-IN');
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const safeNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES (derived from real data)
// ═══════════════════════════════════════════════════════════════════════════════

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

interface AccountRow {
  code: string;
  name: string;
  type: AccountType;
  balance: number; // signed: positive=debit-balance (asset/expense), negative=credit-balance (liab/equity/rev)
  change: number | null; // null → "—" (no historical data yet)
}

interface JournalEntry {
  id: string;
  date: string; // ISO
  description: string;
  debitAccount: string;
  creditAccount: string;
  debit: number;
  credit: number;
  status: 'posted' | 'pending';
  source: 'invoice' | 'expense' | 'payment' | 'manual';
}

interface StatCard {
  label: string;
  value: number;
  icon: typeof TrendingUp;
  tone: 'emerald' | 'rose' | 'slate';
  hint?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS (kept from original — purely cosmetic from computed arrays)
// ═══════════════════════════════════════════════════════════════════════════════

function SparklineChart({ data, color = '#10b981', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120;
  const pts = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`);
  return (
    <svg width={w} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarChartMini({ data, labels, color = '#10b981' }: { data: number[]; labels: string[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const barW = 28;
  const gap = 8;
  const h = 80;
  return (
    <svg width={data.length * (barW + gap)} height={h + 20} className="overflow-visible">
      {data.map((v, i) => {
        const barH = (v / max) * (h - 10);
        return (
          <g key={i}>
            <rect x={i * (barW + gap)} y={h - barH} width={barW} height={Math.max(barH, 0)} rx={4} fill={color} opacity={0.8} />
            <text x={i * (barW + gap) + barW / 2} y={h + 14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT TYPE COLORS (kept from original)
// ═══════════════════════════════════════════════════════════════════════════════

const typeColors: Record<AccountType, string> = {
  Asset: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Liability: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  Equity: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Revenue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  Expense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

// ═══════════════════════════════════════════════════════════════════════════════
// COMPUTATION HELPERS — pure functions, fully typed
// ═══════════════════════════════════════════════════════════════════════════════

type InvoiceRow = FirestoreInvoice & { id: string };
type ExpenseRow = FirestoreExpense & { id: string };
type PaymentRow = FirestorePayment & { id: string };
type BankAccountRow = FirestoreBankAccount & { id: string };
type BankTxnRow = FirestoreBankTransaction & { id: string };

const invoiceTax = (inv: InvoiceRow): number =>
  safeNum(inv.cgst) + safeNum(inv.sgst) + safeNum(inv.igst) + safeNum(inv.cess);

// Invoices that count toward recognised revenue (exclude drafts / cancelled).
const isRevenueInvoice = (inv: InvoiceRow): boolean =>
  inv.status !== 'draft' && inv.status !== 'cancelled';

// Unpaid invoice → contributes to Accounts Receivable.
const isUnpaidInvoice = (inv: InvoiceRow): boolean =>
  inv.status !== 'cancelled' && inv.status !== 'filed';
// (We treat 'filed' as fully reconciled/realised for AR purposes — pragmatic
// simplification documented in worklog. 'draft' / 'approved' still owe us money.)

interface ComputedAccounts {
  cashAndBank: number;
  accountsReceivable: number;
  accountsPayable: number;
  gstPayable: number;
  salesRevenue: number;
  totalTaxOutput: number;
  totalTaxInput: number;
  expenseByCategory: { category: string; amount: number }[];
  totalExpenses: number;
  netProfit: number;
}

function computeAccounts(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  bankAccounts: BankAccountRow[],
): ComputedAccounts {
  const cashAndBank = bankAccounts.reduce(
    (s, a) => s + safeNum(a.currentBalance),
    0,
  );

  const accountsReceivable = invoices
    .filter(isUnpaidInvoice)
    .reduce((s, inv) => s + safeNum(inv.totalAmount), 0);

  // Accounts Payable = approved/pending expenses that are NOT yet paid.
  // ('paid' expenses have already left cash — they are no longer a payable.)
  const payableExpenses = expenses.filter(
    (e) => e.status === 'draft' || e.status === 'pending' || e.status === 'approved',
  );
  const accountsPayable = payableExpenses.reduce(
    (s, e) => s + safeNum(e.amount),
    0,
  );

  const revenueInvoices = invoices.filter(isRevenueInvoice);
  const salesRevenue = revenueInvoices.reduce(
    (s, inv) => s + safeNum(inv.totalAmount),
    0,
  );
  const totalTaxOutput = revenueInvoices.reduce((s, inv) => s + invoiceTax(inv), 0);
  const totalTaxInput = expenses.reduce((s, e) => s + safeNum(e.gst), 0);

  const byCat = new Map<string, number>();
  for (const e of expenses) {
    const cat = (e.category || 'Uncategorised').trim() || 'Uncategorised';
    byCat.set(cat, (byCat.get(cat) ?? 0) + safeNum(e.amount));
  }
  const expenseByCategory = Array.from(byCat.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = expenses.reduce((s, e) => s + safeNum(e.amount), 0);

  return {
    cashAndBank,
    accountsReceivable,
    accountsPayable,
    gstPayable: totalTaxOutput - totalTaxInput,
    salesRevenue,
    totalTaxOutput,
    totalTaxInput,
    expenseByCategory,
    totalExpenses,
    netProfit: salesRevenue - totalExpenses,
  };
}

function buildChartOfAccounts(accts: ComputedAccounts): AccountRow[] {
  const rows: AccountRow[] = [
    { code: '1000', name: 'Cash & Bank', type: 'Asset', balance: accts.cashAndBank, change: null },
    { code: '1100', name: 'Accounts Receivable', type: 'Asset', balance: accts.accountsReceivable, change: null },
    { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: -accts.accountsPayable, change: null },
    { code: '2100', name: 'GST Payable', type: 'Liability', balance: -accts.gstPayable, change: null },
    { code: '3100', name: 'Retained Earnings', type: 'Equity', balance: -accts.netProfit, change: null },
    { code: '4000', name: 'Sales Revenue', type: 'Revenue', balance: -accts.salesRevenue, change: null },
  ];
  // Expense accounts — one per category actually used in the data.
  const expenseRows: AccountRow[] = accts.expenseByCategory.map((c, i) => ({
    code: `5${String(i + 1).padStart(3, '0')}`,
    name: c.category,
    type: 'Expense',
    balance: c.amount,
    change: null,
  }));
  return [...rows, ...expenseRows];
}

function buildJournalEntries(
  invoices: InvoiceRow[],
  expenses: ExpenseRow[],
  payments: PaymentRow[],
): JournalEntry[] {
  const jes: JournalEntry[] = [];

  // Invoices → Dr AR, Cr Sales Revenue + GST Payable
  for (const inv of invoices) {
    if (!isRevenueInvoice(inv)) continue;
    const tax = invoiceTax(inv);
    const taxable = safeNum(inv.totalAmount) - tax;
    const desc = `Sales Invoice ${inv.invoiceNumber || inv.id.slice(0, 8)}${inv.buyerName ? ` — ${inv.buyerName}` : ''}`;
    jes.push({
      id: `JE-INV-${inv.id.slice(0, 10)}`,
      date: inv.invoiceDate || (inv.createdAt as string) || new Date().toISOString(),
      description: desc,
      debitAccount: 'Accounts Receivable',
      creditAccount: tax > 0 ? 'Sales Revenue / GST Payable' : 'Sales Revenue',
      debit: safeNum(inv.totalAmount),
      credit: taxable + tax,
      status: inv.status === 'filed' ? 'posted' : 'pending',
      source: 'invoice',
    });
  }

  // Expenses → Dr Expense (category), Cr Cash/Bank
  for (const e of expenses) {
    const cat = (e.category || 'Expense').trim() || 'Expense';
    const desc = `Expense — ${e.vendor || cat}${e.description ? ` (${e.description})` : ''}`;
    jes.push({
      id: `JE-EXP-${e.id.slice(0, 10)}`,
      date: e.date || (e.createdAt as string) || new Date().toISOString(),
      description: desc,
      debitAccount: cat,
      creditAccount: 'Cash & Bank',
      debit: safeNum(e.amount),
      credit: safeNum(e.amount),
      status: e.status === 'paid' ? 'posted' : 'pending',
      source: 'expense',
    });
  }

  // Payments → Dr Cash/Bank, Cr AR (for customer receipts) OR Dr AP, Cr Cash/Bank (vendor)
  for (const p of payments) {
    if (p.status === 'failed' || p.status === 'cancelled') continue;
    const isCustomer = p.partyType === 'customer';
    const desc = `${isCustomer ? 'Customer Receipt' : 'Vendor Payment'} — ${p.partyName || 'Unknown'}${p.referenceNo ? ` (Ref ${p.referenceNo})` : ''}`;
    jes.push({
      id: `JE-PAY-${p.id.slice(0, 10)}`,
      date: p.paymentDate || (p.createdAt as string) || new Date().toISOString(),
      description: desc,
      debitAccount: isCustomer ? 'Cash & Bank' : 'Accounts Payable',
      creditAccount: isCustomer ? 'Accounts Receivable' : 'Cash & Bank',
      debit: safeNum(p.amount),
      credit: safeNum(p.amount),
      status: p.status === 'completed' ? 'posted' : 'pending',
      source: 'payment',
    });
  }

  // Sort by date desc
  return jes.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });
}

// 12-month revenue/expense series computed from real invoice/expense dates.
function buildMonthlySeries(invoices: InvoiceRow[], expenses: ExpenseRow[]) {
  const now = new Date();
  const buckets: { key: string; label: string; revenue: number; expense: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short' }).slice(0, 1).toUpperCase();
    buckets.push({ key, label, revenue: 0, expense: 0 });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));

  for (const inv of invoices) {
    if (!isRevenueInvoice(inv)) continue;
    const d = new Date(inv.invoiceDate || (inv.createdAt as string) || now);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idx.get(key);
    if (i !== undefined) buckets[i].revenue += safeNum(inv.totalAmount);
  }
  for (const e of expenses) {
    const d = new Date(e.date || (e.createdAt as string) || now);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const i = idx.get(key);
    if (i !== undefined) buckets[i].expense += safeNum(e.amount);
  }

  return {
    revenue: buckets.map((b) => b.revenue),
    expense: buckets.map((b) => b.expense),
    labels: buckets.map((b) => b.label),
  };
}

// Aging buckets for unpaid invoices.
interface AgingRow {
  invoiceNumber: string;
  buyerName: string;
  amount: number;
  daysOverdue: number;
  bucket: '0-30' | '31-60' | '61-90' | '90+';
}

function buildAging(invoices: InvoiceRow[]): AgingRow[] {
  const now = Date.now();
  const rows: AgingRow[] = [];
  for (const inv of invoices) {
    if (!isUnpaidInvoice(inv)) continue;
    const dueStr = inv.invoiceDate || (inv.createdAt as string);
    if (!dueStr) continue;
    const due = new Date(dueStr);
    if (Number.isNaN(due.getTime())) continue;
    // Pragmatic: assume 30-day payment terms → due = invoiceDate + 30d.
    const dueTime = due.getTime() + 30 * 24 * 60 * 60 * 1000;
    const daysOverdue = Math.max(0, Math.floor((now - dueTime) / (24 * 60 * 60 * 1000)));
    const bucket: AgingRow['bucket'] =
      daysOverdue <= 30 ? '0-30' : daysOverdue <= 60 ? '31-60' : daysOverdue <= 90 ? '61-90' : '90+';
    rows.push({
      invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 8),
      buyerName: inv.buyerName || '—',
      amount: safeNum(inv.totalAmount),
      daysOverdue,
      bucket,
    });
  }
  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CSV EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function exportJournalEntriesCSV(jes: JournalEntry[]) {
  try {
    const header = ['JE ID', 'Date', 'Description', 'Debit Account', 'Credit Account', 'Debit (INR)', 'Credit (INR)', 'Status', 'Source'];
    const rows = jes.map((j) => [
      j.id,
      fmtDate(j.date),
      j.description.replace(/"/g, '""'),
      j.debitAccount,
      j.creditAccount,
      String(j.debit),
      String(j.credit),
      j.status,
      j.source,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-entries-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${jes.length} journal entries to CSV`);
  } catch (err) {
    console.error('[Accounting] CSV export failed', err);
    toast.error('Failed to export journal entries');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCardSkeleton() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-6 w-28 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function StatCardView({ s }: { s: StatCard }) {
  const Icon = s.icon;
  const toneCls =
    s.tone === 'emerald'
      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
      : s.tone === 'rose'
        ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return (
    <Card className="border-white/[0.06] bg-white/[0.02] hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneCls}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          {s.hint ? (
            <span className="text-[10px] text-zinc-400">{s.hint}</span>
          ) : null}
        </div>
        <p className="text-xl font-bold text-white">{fmtINR(s.value)}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{s.label}</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT DIALOGS
// ═══════════════════════════════════════════════════════════════════════════════

type ReportKey = 'pnl' | 'balance-sheet' | 'trial-balance' | 'cash-flow' | 'general-ledger' | 'aging' | null;

function ReportDialog({
  report, onClose, accounts, jes, payments, invoices, bankTxns,
}: {
  report: ReportKey;
  onClose: () => void;
  accounts: ComputedAccounts;
  jes: JournalEntry[];
  payments: PaymentRow[];
  invoices: InvoiceRow[];
  bankTxns: BankTxnRow[];
}) {
  const [ledgerAccount, setLedgerAccount] = useState<string>('');
  const coa = useMemo(() => buildChartOfAccounts(accounts), [accounts]);

  // Lifted to component scope so the rules-of-hooks lint passes (the general-ledger
  // body inside renderBody consumes these values rather than calling useMemo itself).
  const ledgerAccountNames = useMemo(
    () => Array.from(new Set(jes.flatMap((j) => [j.debitAccount, j.creditAccount]))).sort(),
    [jes],
  );
  const ledgerFilteredJEs = useMemo(
    () => (ledgerAccount ? jes.filter((j) => j.debitAccount === ledgerAccount || j.creditAccount === ledgerAccount) : jes),
    [jes, ledgerAccount],
  );

  const titleMap: Record<Exclude<ReportKey, null>, string> = {
    'pnl': 'Profit & Loss Statement',
    'balance-sheet': 'Balance Sheet',
    'trial-balance': 'Trial Balance',
    'cash-flow': 'Cash Flow Statement',
    'general-ledger': 'General Ledger',
    'aging': 'Aging Report',
  };

  const renderBody = () => {
    if (!report) return null;

    if (report === 'pnl') {
      return (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Sales Revenue</span>
            <span className="font-semibold text-emerald-400">{fmtINR(accounts.salesRevenue)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Output Tax (GST Collected)</span>
            <span className="text-zinc-300">{fmtINR(accounts.totalTaxOutput)}</span>
          </div>
          <Separator className="bg-white/[0.06]" />
          <div className="flex justify-between py-1.5">
            <span className="text-zinc-400">Total Expenses</span>
            <span className="font-semibold text-rose-400">- {fmtINR(accounts.totalExpenses)}</span>
          </div>
          {accounts.expenseByCategory.map((c) => (
            <div key={c.category} className="flex justify-between py-1 pl-4 text-xs">
              <span className="text-zinc-500">└ {c.category}</span>
              <span className="text-zinc-400">{fmtINR(c.amount)}</span>
            </div>
          ))}
          <Separator className="bg-white/[0.06]" />
          <div className="flex justify-between py-2 font-bold">
            <span className="text-white">Net Profit</span>
            <span className={accounts.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmtINR(accounts.netProfit)}</span>
          </div>
        </div>
      );
    }

    if (report === 'balance-sheet') {
      const totalAssets = accounts.cashAndBank + accounts.accountsReceivable;
      const totalLiabilities = accounts.accountsPayable + Math.max(0, accounts.gstPayable);
      const totalEquity = accounts.netProfit;
      return (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Assets</p>
            <div className="flex justify-between py-1.5"><span className="text-zinc-400">Cash & Bank</span><span className="text-white">{fmtINR(accounts.cashAndBank)}</span></div>
            <div className="flex justify-between py-1.5"><span className="text-zinc-400">Accounts Receivable</span><span className="text-white">{fmtINR(accounts.accountsReceivable)}</span></div>
            <Separator className="bg-white/[0.06] my-1" />
            <div className="flex justify-between py-1 font-bold"><span className="text-white">Total Assets</span><span className="text-white">{fmtINR(totalAssets)}</span></div>
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-400 mb-2 uppercase tracking-wider">Liabilities</p>
            <div className="flex justify-between py-1.5"><span className="text-zinc-400">Accounts Payable</span><span className="text-white">{fmtINR(accounts.accountsPayable)}</span></div>
            <div className="flex justify-between py-1.5"><span className="text-zinc-400">GST Payable</span><span className="text-white">{fmtINR(Math.max(0, accounts.gstPayable))}</span></div>
            <Separator className="bg-white/[0.06] my-1" />
            <div className="flex justify-between py-1 font-bold"><span className="text-white">Total Liabilities</span><span className="text-white">{fmtINR(totalLiabilities)}</span></div>
          </div>
          <div>
            <p className="text-xs font-semibold text-violet-400 mb-2 uppercase tracking-wider">Equity</p>
            <div className="flex justify-between py-1.5"><span className="text-zinc-400">Retained Earnings (current period)</span><span className="text-white">{fmtINR(totalEquity)}</span></div>
            <Separator className="bg-white/[0.06] my-1" />
            <div className="flex justify-between py-1 font-bold"><span className="text-white">Total Equity</span><span className="text-white">{fmtINR(totalEquity)}</span></div>
          </div>
          <Separator className="bg-white/[0.06]" />
          <div className="flex justify-between py-2 text-xs font-semibold">
            <span className="text-zinc-300">Liabilities + Equity</span>
            <span className="text-white">{fmtINR(totalLiabilities + totalEquity)}</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            Note: simplified — no prior-year retained earnings, share capital, or fixed assets yet.
          </p>
        </div>
      );
    }

    if (report === 'trial-balance') {
      let drTotal = 0;
      let crTotal = 0;
      coa.forEach((a) => {
        if (a.balance > 0) drTotal += a.balance;
        else crTotal += Math.abs(a.balance);
      });
      return (
        <div className="space-y-1 text-sm">
          <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-zinc-500 pb-2 border-b border-white/[0.06]">
            <span>Account</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
          </div>
          {coa.map((a) => (
            <div key={a.code} className="grid grid-cols-3 gap-2 py-1.5 text-xs">
              <span className="text-zinc-300"><span className="font-mono text-zinc-500 mr-2">{a.code}</span>{a.name}</span>
              <span className="text-right text-white">{a.balance > 0 ? fmtINR(a.balance) : '—'}</span>
              <span className="text-right text-white">{a.balance < 0 ? fmtINRAbs(a.balance) : '—'}</span>
            </div>
          ))}
          <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-white/[0.06] font-bold text-xs">
            <span className="text-white">Total</span>
            <span className="text-right text-emerald-400">{fmtINR(drTotal)}</span>
            <span className="text-right text-rose-400">{fmtINR(crTotal)}</span>
          </div>
          <div className="flex justify-between pt-2 text-[11px]">
            <span className="text-zinc-500">Difference</span>
            <span className={Math.abs(drTotal - crTotal) < 1 ? 'text-emerald-400' : 'text-amber-400'}>
              {Math.abs(drTotal - crTotal) < 1 ? 'Balanced ✓' : fmtINR(drTotal - crTotal)}
            </span>
          </div>
        </div>
      );
    }

    if (report === 'cash-flow') {
      const inflow = payments.filter((p) => p.partyType === 'customer' && p.status === 'completed').reduce((s, p) => s + safeNum(p.amount), 0);
      const outflow = payments.filter((p) => p.partyType === 'vendor' && p.status === 'completed').reduce((s, p) => s + safeNum(p.amount), 0);
      const net = inflow - outflow;
      return (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Cash Inflows (Operating)</p>
            <div className="flex justify-between py-1.5"><span className="text-zinc-400">Customer Receipts</span><span className="text-white">{fmtINR(inflow)}</span></div>
          </div>
          <div>
            <p className="text-xs font-semibold text-rose-400 mb-2 uppercase tracking-wider">Cash Outflows (Operating)</p>
            <div className="flex justify-between py-1.5"><span className="text-zinc-400">Vendor Payments</span><span className="text-white">{fmtINR(outflow)}</span></div>
          </div>
          <Separator className="bg-white/[0.06]" />
          <div className="flex justify-between py-2 font-bold">
            <span className="text-white">Net Cash Flow</span>
            <span className={net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmtINR(net)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-xs">
            <span className="text-zinc-400">Cash & Bank Balance (per bank accounts)</span>
            <span className="text-white">{fmtINR(accounts.cashAndBank)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-xs">
            <span className="text-zinc-400">Reconciled bank transactions</span>
            <span className="text-white">{bankTxns.filter((t) => t.reconciled).length} / {bankTxns.length}</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            Simplified: operating activities only. Investing & financing activities require the full engine.
          </p>
        </div>
      );
    }

    if (report === 'general-ledger') {
      const accountNames = ledgerAccountNames;
      const filtered = ledgerFilteredJEs;
      return (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Account:</span>
            <select
              value={ledgerAccount}
              onChange={(e) => setLedgerAccount(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
            >
              <option value="">All accounts</option>
              {accountNames.map((n) => (
                <option key={n} value={n} className="bg-zinc-900">{n}</option>
              ))}
            </select>
            <span className="text-[10px] text-zinc-500 ml-auto">{filtered.length} entries</span>
          </div>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-1.5 pr-2">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-6">No entries for this account.</p>
              ) : (
                filtered.map((j) => (
                  <div key={j.id} className="border border-white/[0.06] rounded-md p-2.5 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-zinc-500">{j.id}</span>
                      <span className="text-[10px] text-zinc-500">{fmtDate(j.date)}</span>
                    </div>
                    <p className="text-xs text-white mb-1.5">{j.description}</p>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-emerald-400">Dr {j.debitAccount}: {fmtINR(j.debit)}</span>
                      <span className="text-rose-400">Cr {j.creditAccount}: {fmtINR(j.credit)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (report === 'aging') {
      const aging = buildAging(invoices);
      const buckets: AgingRow['bucket'][] = ['0-30', '31-60', '61-90', '90+'];
      const totals = buckets.map((b) => aging.filter((r) => r.bucket === b).reduce((s, r) => s + r.amount, 0));
      return (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-4 gap-2">
            {buckets.map((b, i) => (
              <div key={b} className="border border-white/[0.06] rounded-md p-2.5 bg-white/[0.02] text-center">
                <p className="text-[10px] text-zinc-500 uppercase">{b} days</p>
                <p className="text-sm font-bold text-white mt-1">{fmtINR(totals[i])}</p>
              </div>
            ))}
          </div>
          <Separator className="bg-white/[0.06]" />
          <ScrollArea className="max-h-[360px]">
            <div className="space-y-1.5 pr-2">
              {aging.length === 0 ? (
                <p className="text-center text-xs text-zinc-500 py-6">No unpaid invoices.</p>
              ) : (
                aging.map((r, i) => (
                  <div key={`${r.invoiceNumber}-${i}`} className="flex items-center justify-between border border-white/[0.06] rounded-md p-2.5 bg-white/[0.02]">
                    <div>
                      <p className="text-xs text-white">{r.invoiceNumber}</p>
                      <p className="text-[10px] text-zinc-500">{r.buyerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-white">{fmtINR(r.amount)}</p>
                      <Badge variant="outline" className={`text-[9px] mt-0.5 ${r.bucket === '90+' ? 'border-rose-500/40 text-rose-400' : r.bucket === '61-90' ? 'border-amber-500/40 text-amber-400' : 'border-zinc-500/40 text-zinc-400'}`}>
                        {r.daysOverdue}d overdue
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={report !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-white/[0.08]">
        <DialogHeader>
          <DialogTitle className="text-white">{report ? titleMap[report] : ''}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Computed live from your invoices, expenses, payments, and bank accounts.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-2">{renderBody()}</div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQ, setSearchQ] = useState('');
  const [openReport, setOpenReport] = useState<ReportKey>(null);
  const [showNotice, setShowNotice] = useState<null | 'new-entry' | 'new-account'>(null);
  // Manual journal entry form state
  const [jeForm, setJeForm] = useState({
    entryDate: new Date().toISOString().slice(0, 10),
    description: '',
    debitAccount: 'Cash & Bank',
    creditAccount: 'Sales Revenue',
    amount: '',
  });
  const [jeSaving, setJeSaving] = useState(false);

  // Real Firestore data
  const { data: invoices, loading: invLoading, error: invError } = useFireInvoices();
  const { data: expenses, loading: expLoading, error: expError } = useFireExpenses();
  const { data: payments, loading: payLoading, error: payError } = useFirePayments();
  const { data: bankAccounts, loading: bankLoading, error: bankError } = useFireBankAccounts();
  const { data: bankTxns, loading: txnLoading, error: txnError } = useFireBankTransactions();
  const { data: manualJEs, loading: manualJEsLoading } = useFireJournalEntries();

  // Surface any genuine (non-permission) Firestore errors as a toast.
  React.useEffect(() => {
    const errs = [invError, expError, payError, bankError, txnError].filter(Boolean) as string[];
    if (errs.length) {
      console.warn('[Accounting] Firestore errors:', errs);
      toast.error('Some accounting data failed to load — showing partial results.');
    }
  }, [invError, expError, payError, bankError, txnError]);

  const loading = invLoading || expLoading || payLoading || bankLoading || txnLoading;

  const accounts = useMemo(
    () => computeAccounts(invoices, expenses, bankAccounts),
    [invoices, expenses, bankAccounts],
  );
  const chartOfAccounts = useMemo(() => buildChartOfAccounts(accounts), [accounts]);

  // Account options for the manual journal entry dropdowns.
  const accountOptions = useMemo(
    () => chartOfAccounts.map((a) => a.name).sort(),
    [chartOfAccounts],
  );

  const handleSaveJournalEntry = async () => {
    const amount = parseFloat(jeForm.amount);
    if (!jeForm.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a description and a valid amount.');
      return;
    }
    if (jeForm.debitAccount === jeForm.creditAccount) {
      toast.error('Debit and credit accounts must differ.');
      return;
    }
    setJeSaving(true);
    try {
      await createJournalEntry({
        entryDate: jeForm.entryDate,
        description: jeForm.description.trim(),
        debitAccount: jeForm.debitAccount,
        creditAccount: jeForm.creditAccount,
        amount,
        status: 'posted',
      });
      toast.success('Journal entry posted.');
      setShowNotice(null);
      setJeForm({
        entryDate: new Date().toISOString().slice(0, 10),
        description: '',
        debitAccount: 'Cash & Bank',
        creditAccount: 'Sales Revenue',
        amount: '',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post journal entry.');
    } finally {
      setJeSaving(false);
    }
  };

  const handleDeleteManualEntry = async (jeId: string) => {
    try {
      await deleteJournalEntry(jeId);
      toast.success('Journal entry deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete entry.');
    }
  };

  const journalEntries = useMemo(() => {
    const auto = buildJournalEntries(invoices, expenses, payments);
    // Merge manual journal entries from Firestore (adjusting entries, depreciation, etc.)
    const manual: JournalEntry[] = (manualJEs as Array<FirestoreJournalEntry & { id: string }>).map((je) => ({
      id: je.id,
      date: je.entryDate,
      description: je.description,
      debitAccount: je.debitAccount,
      creditAccount: je.creditAccount,
      debit: je.amount,
      credit: je.amount,
      status: je.status,
      source: 'manual' as const,
    }));
    // Sort by date descending (manual + auto combined)
    return [...manual, ...auto].sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return db - da;
    });
  }, [invoices, expenses, payments, manualJEs]);
  const monthly = useMemo(() => buildMonthlySeries(invoices, expenses), [invoices, expenses]);

  const statCards: StatCard[] = [
    { label: 'Total Revenue', value: accounts.salesRevenue, icon: TrendingUp, tone: 'emerald', hint: 'non-draft invoices' },
    { label: 'Total Expenses', value: accounts.totalExpenses, icon: TrendingDown, tone: 'rose', hint: 'all expenses' },
    { label: 'Net Profit', value: accounts.netProfit, icon: ArrowUpRight, tone: accounts.netProfit >= 0 ? 'emerald' : 'rose' },
    { label: 'Retained Earnings', value: accounts.netProfit, icon: Wallet, tone: 'slate', hint: 'simplified' },
  ];

  const filteredCOA = chartOfAccounts.filter((a) => {
    const q = searchQ.toLowerCase().trim();
    if (!q) return true;
    if (q === 'all') return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.code.includes(q) ||
      a.type.toLowerCase().includes(q)
    );
  });

  const filteredJEs = journalEntries.filter((j) => {
    const q = searchQ.toLowerCase().trim();
    if (!q) return true;
    return j.description.toLowerCase().includes(q) || j.id.toLowerCase().includes(q) || j.status.includes(q);
  });

  const totalAssets = chartOfAccounts.filter((a) => a.type === 'Asset').reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = chartOfAccounts.filter((a) => a.type === 'Liability').reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalEquity = chartOfAccounts.filter((a) => a.type === 'Equity').reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalRevenue = chartOfAccounts.filter((a) => a.type === 'Revenue').reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalExpenses = chartOfAccounts.filter((a) => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);

  const hasAnyData =
    invoices.length > 0 || expenses.length > 0 || payments.length > 0 || bankAccounts.length > 0;

  const reportCards: { key: Exclude<ReportKey, null>; title: string; desc: string; icon: typeof PieChart; period: string }[] = [
    { key: 'pnl', title: 'Profit & Loss Statement', desc: 'Revenue, expenses, and net profit', icon: PieChart, period: 'Current period' },
    { key: 'balance-sheet', title: 'Balance Sheet', desc: 'Assets, liabilities, and equity position', icon: Scale, period: 'As of today' },
    { key: 'trial-balance', title: 'Trial Balance', desc: 'Debit and credit balances for all accounts', icon: BarChart3, period: 'As of today' },
    { key: 'cash-flow', title: 'Cash Flow Statement', desc: 'Operating cash inflows and outflows', icon: IndianRupee, period: 'Current period' },
    { key: 'general-ledger', title: 'General Ledger', desc: 'Complete transaction history by account', icon: BookOpen, period: 'All entries' },
    { key: 'aging', title: 'Aging Report', desc: 'Receivables aging analysis by bucket', icon: Clock, period: 'As of today' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-white/[0.06]">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Accounting</h1>
              <p className="text-xs text-zinc-400">Live from invoices · expenses · payments · bank accounts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-white/[0.08] text-zinc-200 hover:bg-white/[0.04]"
              onClick={() => exportJournalEntriesCSV(journalEntries)}
              disabled={journalEntries.length === 0}
            >
              <Download className="h-3.5 w-3.5" />Export
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => setShowNotice('new-entry')}
            >
              <Plus className="h-3.5 w-3.5" />New Entry
            </Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
          <TabsList className="bg-transparent h-9 p-0 gap-1 border-b-0">
            {['overview', 'journal-entries', 'chart-of-accounts', 'reports'].map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-t-lg rounded-b-none data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/20 dark:data-[state=active]:text-emerald-400 text-xs px-3 h-8 capitalize"
              >
                {t.replace(/-/g, ' ')}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            {/* Stat Cards */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
              </div>
            ) : !hasAnyData ? (
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardContent className="p-0">
                  <EmptyState
                    icon={BookOpen}
                    title="No accounting data yet"
                    description="Your accounting overview will populate automatically once you have invoices, expenses, payments, or connected bank accounts."
                  />
                </CardContent>
              </Card>
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((s) => (
                  <motion.div key={s.label} variants={item}>
                    <StatCardView s={s} />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* P&L + Balance Sheet */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                      <PieChart className="h-4 w-4 text-emerald-400" /> Profit & Loss Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ) : totalRevenue === 0 && totalExpenses === 0 ? (
                      <p className="text-xs text-zinc-500 py-6 text-center">No revenue or expenses recorded yet.</p>
                    ) : (
                      <>
                        <div className="flex gap-6 items-end">
                          <div className="flex-1 space-y-3">
                            <div>
                              <div className="flex justify-between text-xs mb-1"><span className="text-zinc-400">Revenue</span><span className="font-semibold text-emerald-400">{fmtINR(totalRevenue)}</span></div>
                              <div className="h-2 rounded-full bg-white/[0.06]"><div className="h-2 rounded-full bg-emerald-500" style={{ width: '100%' }} /></div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1"><span className="text-zinc-400">Expenses</span><span className="font-semibold text-rose-400">{fmtINR(totalExpenses)}</span></div>
                              <div className="h-2 rounded-full bg-white/[0.06]"><div className="h-2 rounded-full bg-rose-400" style={{ width: `${totalRevenue > 0 ? Math.min(100, (totalExpenses / totalRevenue) * 100) : 0}%` }} /></div>
                            </div>
                            <Separator className="bg-white/[0.06]" />
                            <div className="flex justify-between text-sm font-bold"><span className="text-white">Net Profit</span><span className={accounts.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmtINR(accounts.netProfit)}</span></div>
                          </div>
                          <div className="hidden sm:block">
                            <SparklineChart data={monthly.revenue.slice(-6)} color="#10b981" height={60} />
                          </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-white/[0.06]">
                          <p className="text-[10px] text-zinc-400 mb-2">Monthly Trend (last 12 months)</p>
                          <div className="flex gap-1 items-end overflow-x-auto">
                            <BarChartMini data={monthly.revenue} labels={monthly.labels} color="#10b981" />
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                      <Scale className="h-4 w-4 text-emerald-400" /> Balance Sheet Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ) : !hasAnyData ? (
                      <p className="text-xs text-zinc-500 py-6 text-center">No balance sheet data yet.</p>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Assets</p>
                          {chartOfAccounts.filter((a) => a.type === 'Asset').map((a) => (
                            <div key={a.code} className="flex justify-between py-1.5 text-xs">
                              <span className="text-zinc-400">{a.name}</span>
                              <span className="font-medium text-white">{fmtINR(a.balance)}</span>
                            </div>
                          ))}
                          <Separator className="bg-white/[0.06] my-1" />
                          <div className="flex justify-between py-1 text-xs font-bold"><span className="text-white">Total Assets</span><span className="text-white">{fmtINR(totalAssets)}</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-semibold text-rose-400 mb-2 uppercase tracking-wider">Liabilities</p>
                            {chartOfAccounts.filter((a) => a.type === 'Liability').map((a) => (
                              <div key={a.code} className="flex justify-between py-1 text-xs">
                                <span className="text-zinc-400">{a.name}</span>
                                <span className="font-medium text-white">{fmtINRAbs(a.balance)}</span>
                              </div>
                            ))}
                            <Separator className="bg-white/[0.06] my-1" />
                            <div className="flex justify-between py-1 text-xs font-bold"><span className="text-white">Total</span><span className="text-white">{fmtINR(totalLiabilities)}</span></div>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-violet-400 mb-2 uppercase tracking-wider">Equity</p>
                            {chartOfAccounts.filter((a) => a.type === 'Equity').map((a) => (
                              <div key={a.code} className="flex justify-between py-1 text-xs">
                                <span className="text-zinc-400">{a.name}</span>
                                <span className="font-medium text-white">{fmtINRAbs(a.balance)}</span>
                              </div>
                            ))}
                            <Separator className="bg-white/[0.06] my-1" />
                            <div className="flex justify-between py-1 text-xs font-bold"><span className="text-white">Total</span><span className="text-white">{fmtINR(totalEquity)}</span></div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Trial Balance + Recent Journal Entries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                      <BarChart3 className="h-4 w-4 text-emerald-400" /> Trial Balance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                      </div>
                    ) : !hasAnyData ? (
                      <p className="text-xs text-zinc-500 py-6 text-center">No accounts to balance yet.</p>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as AccountType[]).map((type) => {
                            const accs = chartOfAccounts.filter((a) => a.type === type);
                            if (accs.length === 0) return null;
                            const debitTotal = accs.reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0);
                            const creditTotal = accs.reduce((s, a) => s + (a.balance < 0 ? Math.abs(a.balance) : 0), 0);
                            return (
                              <div key={type} className="flex items-center justify-between py-2 border-b last:border-b-0 border-white/[0.06]">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={`text-[10px] ${typeColors[type]}`}>{type}</Badge>
                                  <span className="text-xs text-zinc-400">{accs.length} accounts</span>
                                </div>
                                <div className="flex gap-6 text-xs">
                                  <div><span className="text-zinc-400">Dr: </span><span className="font-semibold text-white">{fmtINR(debitTotal)}</span></div>
                                  <div><span className="text-zinc-400">Cr: </span><span className="font-semibold text-white">{fmtINR(creditTotal)}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <Separator className="bg-white/[0.06] my-3" />
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-zinc-300">Trial Balance Check</span>
                          <span className="text-emerald-400">Computed from real data</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="border-white/[0.06] bg-white/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                      <FileText className="h-4 w-4 text-emerald-400" /> Recent Journal Entries
                      <span className="ml-auto text-[10px] text-zinc-400 font-normal">{journalEntries.length} total</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-72">
                      <div className="px-4 pb-4 space-y-2">
                        {loading ? (
                          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                        ) : journalEntries.length === 0 ? (
                          <p className="text-xs text-zinc-500 py-6 text-center">No journal entries yet.</p>
                        ) : (
                          journalEntries.slice(0, 7).map((je) => (
                            <div key={je.id} className="flex items-center justify-between py-2 border-b last:border-b-0 border-white/[0.06] hover:bg-white/[0.04] rounded px-2 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-zinc-400">{je.id}</span>
                                  <Badge
                                    variant={je.status === 'posted' ? 'default' : 'secondary'}
                                    className={`text-[9px] h-4 ${je.status === 'posted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}
                                  >
                                    {je.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-zinc-300 truncate mt-0.5">{je.description}</p>
                                <p className="text-[10px] text-zinc-500">{fmtDate(je.date)}</p>
                              </div>
                              <div className="text-right ml-3">
                                <p className="text-xs font-semibold text-white">Dr {fmtINR(je.debit)}</p>
                                {je.credit > 0 && <p className="text-[10px] text-zinc-400">Cr: {fmtINR(je.credit)}</p>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* ─── JOURNAL ENTRIES TAB ─── */}
          <TabsContent value="journal-entries" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search entries..."
                    className="w-64 h-8 text-xs bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-500"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 border-white/[0.08] text-zinc-200 hover:bg-white/[0.04]">
                    <Filter className="h-3 w-3" />Filter
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setShowNotice('new-entry')}
                >
                  <Plus className="h-3.5 w-3.5" />New Entry
                </Button>
              </div>
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : filteredJEs.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title={journalEntries.length === 0 ? 'No journal entries yet' : 'No matching entries'}
                      description={
                        journalEntries.length === 0
                          ? 'Journal entries are auto-generated from your invoices, expenses, and payments. Create one of those to see entries here.'
                          : 'Try adjusting your search query.'
                      }
                      compact
                    />
                  ) : (
                    <ScrollArea className="max-h-[600px]">
                      <div className="divide-y divide-white/[0.06]">
                        {filteredJEs.map((je, i) => (
                          <motion.div
                            key={je.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(i * 0.03, 0.6) }}
                            className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                                <FileText className="h-4 w-4 text-zinc-400" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-semibold text-white">{je.id}</span>
                                  <Badge
                                    variant={je.status === 'posted' ? 'default' : 'secondary'}
                                    className={`text-[9px] h-4 ${je.status === 'posted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}
                                  >
                                    {je.status}
                                  </Badge>
                                  <Badge variant="outline" className="text-[9px] h-4 border-white/[0.1] text-zinc-400 capitalize">{je.source}</Badge>
                                </div>
                                <p className="text-xs text-zinc-300 mt-0.5">{je.description}</p>
                                <p className="text-[10px] text-zinc-500">{fmtDate(je.date)} · Dr {je.debitAccount} / Cr {je.creditAccount}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-white">Dr: {fmtINR(je.debit)}</p>
                              {je.credit > 0 && <p className="text-[10px] text-zinc-400">Cr: {fmtINR(je.credit)}</p>}
                            </div>
                            <ChevronRight className="h-4 w-4 text-zinc-500 ml-3" />
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── CHART OF ACCOUNTS TAB ─── */}
          <TabsContent value="chart-of-accounts" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Search accounts..."
                    className="w-64 h-8 text-xs bg-white/[0.04] border-white/[0.08] text-zinc-200 placeholder:text-zinc-500"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                  <div className="flex gap-1 flex-wrap">
                    {['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map((t) => (
                      <Button
                        key={t}
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-2 border-white/[0.08] text-zinc-200 hover:bg-white/[0.04]"
                        onClick={() => setSearchQ(t === 'All' ? '' : t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setShowNotice('new-account')}
                >
                  <Plus className="h-3.5 w-3.5" />New Account
                </Button>
              </div>
              <Card className="border-white/[0.06] bg-white/[0.02]">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-4 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : filteredCOA.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title={chartOfAccounts.length === 0 ? 'No accounts yet' : 'No matching accounts'}
                      description={
                        chartOfAccounts.length === 0
                          ? 'Chart of accounts is generated automatically from your invoices, expenses, and bank accounts.'
                          : 'Try a different search.'
                      }
                      compact
                    />
                  ) : (
                    <div className="divide-y divide-white/[0.06]">
                      {filteredCOA.map((acc, i) => (
                        <motion.div
                          key={acc.code}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i * 0.03, 0.6) }}
                          className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-mono font-semibold text-zinc-500 w-12">{acc.code}</span>
                            <div>
                              <p className="text-xs font-medium text-white">{acc.name}</p>
                              <Badge variant="secondary" className={`text-[9px] h-4 mt-0.5 ${typeColors[acc.type]}`}>{acc.type}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                              {acc.change === null ? (
                                <span>—</span>
                              ) : (
                                <>
                                  {acc.change >= 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                                  <span className={acc.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmtPct(acc.change)}</span>
                                </>
                              )}
                            </div>
                            <span className="text-xs font-bold text-white min-w-[100px] text-right">{fmtINRAbs(acc.balance)}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── REPORTS TAB ─── */}
          <TabsContent value="reports" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportCards.map((r, i) => {
                const Icon = r.icon;
                return (
                  <motion.div key={r.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card
                      className="hover:shadow-md transition-all border-white/[0.06] bg-white/[0.02] cursor-pointer group"
                      onClick={() => setOpenReport(r.key)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <ArrowRight className="h-4 w-4 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">{r.title}</h3>
                        <p className="text-xs text-zinc-400 mb-2">{r.desc}</p>
                        <p className="text-[10px] text-zinc-500">{r.period}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Report Dialog */}
      <ReportDialog
        report={openReport}
        onClose={() => setOpenReport(null)}
        accounts={accounts}
        jes={journalEntries}
        payments={payments}
        invoices={invoices}
        bankTxns={bankTxns}
      />

      {/* Manual Journal Entry Form (New Entry button) */}
      <Dialog open={showNotice === 'new-entry'} onOpenChange={(o) => { if (!o) setShowNotice(null); }}>
        <DialogContent className="max-w-lg bg-zinc-950 border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-400" />
              New Manual Journal Entry
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Post an adjusting entry (depreciation, accruals, corrections). Debit and credit must balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Date</Label>
                <Input
                  type="date"
                  value={jeForm.entryDate}
                  onChange={(e) => setJeForm((p) => ({ ...p, entryDate: e.target.value }))}
                  className="bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Amount (₹)</Label>
                <Input
                  type="number"
                  value={jeForm.amount}
                  onChange={(e) => setJeForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="50000"
                  className="bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-400">Description</Label>
              <Input
                value={jeForm.description}
                onChange={(e) => setJeForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g., Monthly depreciation for office equipment"
                className="bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Debit Account (Dr)</Label>
                <select
                  value={jeForm.debitAccount}
                  onChange={(e) => setJeForm((p) => ({ ...p, debitAccount: e.target.value }))}
                  className="w-full h-9 rounded-md bg-white/[0.03] border border-white/[0.08] text-white text-sm px-3"
                >
                  {accountOptions.map((name) => (
                    <option key={name} value={name} className="bg-zinc-900">{name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Credit Account (Cr)</Label>
                <select
                  value={jeForm.creditAccount}
                  onChange={(e) => setJeForm((p) => ({ ...p, creditAccount: e.target.value }))}
                  className="w-full h-9 rounded-md bg-white/[0.03] border border-white/[0.08] text-white text-sm px-3"
                >
                  {accountOptions.map((name) => (
                    <option key={name} value={name} className="bg-zinc-900">{name}</option>
                  ))}
                </select>
              </div>
            </div>
            {jeForm.debitAccount && jeForm.creditAccount && jeForm.debitAccount === jeForm.creditAccount && (
              <p className="text-xs text-rose-400">Debit and credit accounts must differ.</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/[0.08] text-zinc-200 hover:bg-white/[0.04]"
              onClick={() => setShowNotice(null)}
              disabled={jeSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleSaveJournalEntry}
              disabled={jeSaving || !jeForm.description.trim() || !jeForm.amount || jeForm.debitAccount === jeForm.creditAccount}
            >
              {jeSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Post Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Account info dialog (custom COA creation) */}
      <Dialog open={showNotice === 'new-account'} onOpenChange={(o) => { if (!o) setShowNotice(null); }}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Info className="h-4 w-4 text-emerald-400" />
              Chart of Accounts
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Your chart of accounts is auto-generated from real records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-zinc-300">
            <p>
              The chart of accounts is <span className="text-emerald-400 font-medium">dynamically computed</span> from your real transactions:
            </p>
            <ul className="space-y-1.5 text-xs pl-4">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />Cash &amp; Bank from bank accounts + payments</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />Accounts Receivable from outstanding invoices</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />GST Payable from tax collected on invoices</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />Sales Revenue + Expense-by-category from invoices/expenses</li>
            </ul>
            <p className="text-xs text-zinc-500">
              To add a new account, create the corresponding invoice, expense, or payment — it will appear here automatically.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-white/[0.08] text-zinc-200 hover:bg-white/[0.04]"
              onClick={() => setShowNotice(null)}
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
