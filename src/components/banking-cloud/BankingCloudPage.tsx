'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT BANKING CLOUD™
// Phase 8 — Step 2 — Connect. Execute. Automate. Scale.
//
// 7 Modules with REAL database persistence:
//   Module 1 — Bank Account Management™       GET/POST /api/bank/accounts (+/connect, +/sync)
//   Module 2 — Bank Statement Sync™           GET/POST /api/bank/statements (+/sync)
//                                             GET /api/bank/transactions
//   Module 3 — Account Aggregator Cloud™      POST /api/aa/connect, /api/aa/consent, GET /api/aa/status
//   Module 4 — Cash Flow Engine™              GET /api/bank/cashflow, /api/bank/cashflow/forecast
//   Module 5 — Auto Reconciliation Engine™    GET/POST /api/bank/reconciliation
//   Module 6 — UPI Cloud™                     GET /api/bank/upi, POST /api/bank/upi/connect, /api/bank/upi/sync
//   Module 7 — Collections Recovery Engine™   GET /api/bank/collections, POST /api/bank/collections/recover,
//                                             POST /api/bank/collections/remind
//
// Oracle speaks in past tense: "I've synced your bank accounts.",
// "I've detected ₹3,84,000 in collections.", "I've reconciled your transactions."
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Landmark, RefreshCw, Plus, Link2, AlertTriangle, TrendingDown, TrendingUp,
  Wallet, Building2, CreditCard, Banknote, ArrowUpRight, ArrowDownRight,
  Search, Filter, CheckCircle2, Clock, ShieldCheck, Zap, Smartphone,
  Receipt, Bell, Send, Play, AlertCircle, Activity, Calendar,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types (mirrors of src/lib/banking/types.ts) ──────────────────────────────

interface BankAccountSummary {
  id: string; bankName: string; accountMasked: string;
  accountType: 'savings' | 'current' | 'od' | 'cc';
  ifsc?: string; currentBalance: number; availableBalance: number;
  overdraftLimit: number; upiHandle?: string;
  aaConsent: boolean; aaConsentExpiry?: string;
  status: 'connected' | 'syncing' | 'disconnected' | 'error';
  lastSyncAt: string; recordsToday: number;
}
interface BankTransactionRow {
  id: string; accountId: string; bankName: string; accountMasked: string;
  date: string; description: string; amount: number;
  type: 'credit' | 'debit';
  category: 'revenue' | 'payroll' | 'tax' | 'purchase' | 'rent' | 'logistics' | 'fee' | 'interest' | 'refund' | 'transfer' | 'uncategorised';
  referenceNo?: string; counterparty?: string;
  matched: boolean; matchedInvoice?: string; matchedParty?: string; matchConfidence: number;
}
interface BankStatementSummary {
  totalTransactions: number; todayCount: number; last7dCount: number; last30dCount: number;
  inflow30d: number; outflow30d: number; net30d: number; categorisationPct: number;
  recentTransactions: BankTransactionRow[];
}
interface AAConnectionSummary {
  id: string; aaName: string; customerMobile?: string;
  consentStatus: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  consentHandle?: string; consentExpiry?: string; fiTypes: string[];
  linkedAccounts: number; lastFetchAt?: string;
  status: 'connected' | 'syncing' | 'disconnected' | 'error';
}
interface AAStatusSummary {
  totalConnections: number; approvedConnections: number; pendingConnections: number;
  totalLinkedAccounts: number; nextExpiryIn?: number; connections: AAConnectionSummary[];
}
interface CashFlowDailyPoint {
  date: string; opening: number; inflows: number; outflows: number;
  closing: number; shortage: boolean; shortageAmount: number;
}
interface CashFlowSummary {
  cashPosition: number; cashPositionChangePct: number;
  dailyBurn: number; monthlyBurn: number; runwayDays: number;
  expectedCollections: number; expectedPayments: number;
  shortageDetected: boolean; shortageAmount: number; shortageDate?: string;
  daily: CashFlowDailyPoint[]; forecast7d: CashFlowDailyPoint[]; forecast30d: CashFlowDailyPoint[];
}
interface ReconciliationEntry {
  id: string; bankRef: string; bankAmount: number;
  matchedInvoice?: string; matchedTo?: string;
  status: 'matched' | 'unmatched' | 'pending' | 'duplicate' | 'partial';
  mismatchType?: 'unmatched_payment' | 'duplicate' | 'missing_entry' | 'partial_payment' | 'bank_charge' | 'wrong_category';
  confidencePct: number; suggestedAction?: string; at: string;
}
interface ReconciliationSummary {
  totalTransactions: number; matched: number; unmatched: number; pending: number;
  duplicate: number; partial: number; matchedPct: number;
  matchedAmount: number; unmatchedAmount: number;
  pendingCollections: number; pendingPayments: number;
  riskScore: number; riskLevel: 'low' | 'medium' | 'high' | 'critical';
  entries: ReconciliationEntry[];
}
interface UPITransactionRow {
  id: string; upiId: string; vpaCounterparty?: string;
  date: string; amount: number; type: 'credit' | 'debit';
  referenceNo?: string; notes?: string;
  matched: boolean; matchedInvoice?: string; matchedParty?: string;
  status: 'pending' | 'settled' | 'failed' | 'reversed';
}
interface UPISummary {
  totalTransactions: number; todayCount: number;
  collections30d: number; payments30d: number;
  pendingSettlements: number; pendingSettlementAmount: number;
  topCustomers: Array<{ vpa: string; name: string; total: number; count: number }>;
  transactions: UPITransactionRow[];
}
interface CollectionsCase {
  id: string; invoiceNo: string; clientName: string;
  outstanding: number; dueDate?: string; daysOverdue: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reminderCount: number; lastReminderAt?: string; nextActionAt?: string;
  escalationLevel: 0 | 1 | 2 | 3;
  status: 'open' | 'recovered' | 'escalated' | 'written_off';
}
interface CollectionsSummary {
  totalCases: number; openCases: number; recoveredCases: number; escalatedCases: number;
  totalOutstanding: number; recovered30d: number; avgDaysOverdue: number;
  nextReminderAt?: string; cases: CollectionsCase[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return sign + '₹' + Math.round(abs).toLocaleString('en-IN');
}

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  savings: 'Savings', current: 'Current', od: 'OD Account', cc: 'CC Account',
};
const ACCOUNT_TYPE_GLYPH: Record<string, string> = {
  savings: '💵', current: '🏢', od: '📉', cc: '💳',
};
const SYNC_STATUS_GLYPH: Record<string, string> = {
  connected: '🟢', syncing: '🔄', disconnected: '⚪', error: '🔴',
};
const CATEGORY_LABEL: Record<string, string> = {
  revenue: 'Revenue', payroll: 'Payroll', tax: 'Tax', purchase: 'Purchase',
  rent: 'Rent', logistics: 'Logistics', fee: 'Bank Charges', interest: 'Interest',
  refund: 'Refund', transfer: 'Transfer', uncategorised: 'Uncategorised',
};
const CATEGORY_GLYPH: Record<string, string> = {
  revenue: '📈', payroll: '👥', tax: '🏛️', purchase: '🛒', rent: '🏢',
  logistics: '🚚', fee: '💸', interest: '💰', refund: '↩️', transfer: '🔄', uncategorised: '❓',
};
const RECON_STATUS_GLYPH: Record<string, string> = {
  matched: '✅', unmatched: '⚠️', pending: '⏳', duplicate: '🔁', partial: '⤴️',
};
const RISK_TONE: Record<string, string> = {
  low: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.06]',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/[0.06]',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/[0.06]',
  critical: 'text-red-400 border-red-500/30 bg-red-500/[0.06]',
};
const AA_CONSENT_GLYPH: Record<string, string> = {
  pending: '⏳', approved: '✅', rejected: '❌', expired: '⌛', revoked: '🚫',
};
const COLLECTIONS_STATUS_GLYPH: Record<string, string> = {
  open: '🔴', recovered: '✅', escalated: '⚠️', written_off: '🗑️',
};

// ─── Fade-in ──────────────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const }} className={className}>
      {children}
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, emoji, title, subtitle, action }: {
  icon: LucideIcon; emoji?: string; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            {emoji && <span className="text-base">{emoji}</span>}{title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Mini SVG charts ──────────────────────────────────────────────────────────

function CashFlowChart({ points }: { points: CashFlowDailyPoint[] }) {
  if (!points.length) return <div className="text-xs text-muted-foreground">No data yet.</div>;
  const w = 600, h = 120, padX = 4, padY = 8;
  const vals = points.map(p => p.closing);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const stepX = (w - padX * 2) / Math.max(1, points.length - 1);
  const pts = points.map((p, i) => {
    const x = padX + i * stepX;
    const y = h - padY - ((p.closing - min) / range) * (h - padY * 2);
    return { x, y, p };
  });
  const linePts = pts.map(pt => `${pt.x},${pt.y}`).join(' ');
  const shortageColor = '#f87171';
  const lineColor = '#2563EB';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`${padX},${h - padY} ${linePts} ${w - padX},${h - padY}`} fill="url(#cfGrad)" />
      <polyline points={linePts} fill="none" stroke={lineColor} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.filter(pt => pt.p.shortage).map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r="3.5" fill={shortageColor} stroke="#fff" strokeWidth="1" />
      ))}
    </svg>
  );
}

function ReconDonut({ matched, total }: { matched: number; total: number }) {
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  const r = 36, c = 2 * Math.PI * r;
  const dashOffset = c - (pct / 100) * c;
  const color = pct >= 80 ? '#2563EB' : pct >= 60 ? '#f59e0b' : '#f87171';
  return (
    <svg width="90" height="90" className="overflow-visible">
      <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
      <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={dashOffset} transform="rotate(-90 45 45)" />
      <text x="45" y="42" textAnchor="middle" className="text-sm font-bold" fill={color}>{pct}%</text>
      <text x="45" y="55" textAnchor="middle" className="text-[7px] fill-muted-foreground">Matched</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function BankingCloudPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<BankAccountSummary[]>([]);
  const [statements, setStatements] = useState<BankStatementSummary | null>(null);
  const [transactions, setTransactions] = useState<BankTransactionRow[]>([]);
  const [aa, setAA] = useState<AAStatusSummary | null>(null);
  const [cashflow, setCashflow] = useState<CashFlowSummary | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationSummary | null>(null);
  const [upi, setUpi] = useState<UPISummary | null>(null);
  const [collections, setCollections] = useState<CollectionsSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [txnFilter, setTxnFilter] = useState({ search: '', type: 'all', category: 'all', matched: 'all' });

  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);
  const totalAvailable = accounts.reduce((s, a) => s + a.availableBalance, 0);

  // ─── Loaders ─────────────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/accounts');
      const data = await res.json();
      if (data.ok) setAccounts(data.accounts);
    } catch { /* ignore */ }
  }, []);

  const loadStatements = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/statements');
      const data = await res.json();
      if (data.ok) setStatements(data.statements);
    } catch { /* ignore */ }
  }, []);

  const loadTransactions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (txnFilter.type !== 'all') params.set('type', txnFilter.type);
      if (txnFilter.category !== 'all') params.set('category', txnFilter.category);
      if (txnFilter.matched !== 'all') params.set('matched', txnFilter.matched);
      params.set('limit', '100');
      const res = await fetch(`/api/bank/transactions?${params}`);
      const data = await res.json();
      if (data.ok) setTransactions(data.transactions);
    } catch { /* ignore */ }
  }, [txnFilter]);

  const loadAA = useCallback(async () => {
    try {
      const res = await fetch('/api/aa/status');
      const data = await res.json();
      if (data.ok) setAA(data.aa);
    } catch { /* ignore */ }
  }, []);

  const loadCashflow = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/cashflow');
      const data = await res.json();
      if (data.ok) setCashflow(data.cashflow);
    } catch { /* ignore */ }
  }, []);

  const loadReconciliation = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/reconciliation');
      const data = await res.json();
      if (data.ok) setReconciliation(data.reconciliation);
    } catch { /* ignore */ }
  }, []);

  const loadUPI = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/upi');
      const data = await res.json();
      if (data.ok) setUpi(data.upi);
    } catch { /* ignore */ }
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/bank/collections');
      const data = await res.json();
      if (data.ok) setCollections(data.collections);
    } catch { /* ignore */ }
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      loadAccounts(), loadStatements(), loadTransactions(),
      loadAA(), loadCashflow(), loadReconciliation(), loadUPI(), loadCollections(),
    ]);
  }, [loadAccounts, loadStatements, loadTransactions, loadAA, loadCashflow, loadReconciliation, loadUPI, loadCollections]);

  useEffect(() => { reloadAll(); }, [reloadAll]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const callAction = async (id: string, url: string, method = 'POST', body?: unknown) => {
    setBusy(id);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: data.oracleAck, description: data.message });
        // Reload relevant module(s)
        if (url.includes('/accounts') || url.includes('/statements')) {
          await Promise.all([loadAccounts(), loadStatements(), loadTransactions(), loadCashflow()]);
        } else if (url.includes('/aa/')) {
          await loadAA();
        } else if (url.includes('/reconciliation')) {
          await loadReconciliation();
        } else if (url.includes('/upi')) {
          await loadUPI();
        } else if (url.includes('/collections')) {
          await loadCollections();
        }
      } else {
        toast({ title: 'Action failed', description: data.message || data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Action failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const filteredTxns = transactions.filter(t => {
    if (txnFilter.search && !`${t.description} ${t.counterparty ?? ''} ${t.referenceNo ?? ''}`.toLowerCase().includes(txnFilter.search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ═══ Header ═══ */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground md:text-2xl">
              <span className="accent-gradient-soft rounded-lg px-2 py-0.5 text-sm font-bold accent-text">BANKING CLOUD™</span>
              VEYRO Banking Cloud
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect. Execute. Automate. Scale. · Live banking, UPI &amp; Account Aggregator — the financial brain.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              {accounts.length} accounts live
            </Badge>
            <Button size="sm" variant="outline" onClick={() => reloadAll()} disabled={busy === 'reload'}
              className="gap-1.5 border-white/[0.08] bg-white/[0.03]">
              <RefreshCw className={cn('h-3.5 w-3.5', busy === 'reload' && 'animate-spin')} /> Refresh
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* ═══ Top KPI strip ═══ */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Landmark className="h-3 w-3" /> Total Balance
              </div>
              <div className="mt-1 text-lg font-bold text-foreground">{formatINR(totalBalance)}</div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Wallet className="h-3 w-3" /> Available
              </div>
              <div className="mt-1 text-lg font-bold text-foreground">{formatINR(totalAvailable)}</div>
            </CardContent>
          </Card>
          <Card className={cn('border-white/[0.06] bg-card/60 backdrop-blur-sm', cashflow?.shortageDetected && 'border-red-500/30 bg-red-500/[0.04]')}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {cashflow?.shortageDetected ? <AlertTriangle className="h-3 w-3 text-red-400" /> : <Activity className="h-3 w-3" />} Cash Position
              </div>
              <div className={cn('mt-1 text-lg font-bold', cashflow?.shortageDetected ? 'text-red-400' : 'text-foreground')}>
                {formatINR(cashflow?.cashPosition ?? 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3 w-3" /> Runway
              </div>
              <div className="mt-1 text-lg font-bold text-foreground">{cashflow?.runwayDays ?? 0}d</div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" /> Recon Match
              </div>
              <div className="mt-1 text-lg font-bold text-foreground">{reconciliation?.matchedPct ?? 0}%</div>
            </CardContent>
          </Card>
          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <AlertCircle className="h-3 w-3 text-amber-400" /> Overdue
              </div>
              <div className="mt-1 text-lg font-bold text-foreground">{collections?.openCases ?? 0}</div>
            </CardContent>
          </Card>
        </div>
      </FadeIn>

      {/* ═══ Tabs for 7 modules ═══ */}
      <FadeIn delay={0.1}>
        <Tabs defaultValue="accounts" className="w-full">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto w-max gap-1 rounded-2xl border border-white/[0.06] bg-card/60 p-1.5 backdrop-blur-sm">
              {[
                { v: 'accounts', l: 'Accounts', e: '🏦' },
                { v: 'statements', l: 'Statements', e: '📄' },
                { v: 'transactions', l: 'Transactions', e: '💸' },
                { v: 'aa', l: 'AA Cloud', e: '🔗' },
                { v: 'cashflow', l: 'Cash Flow', e: '💧' },
                { v: 'reconciliation', l: 'Reconciliation', e: '⚖️' },
                { v: 'upi', l: 'UPI Cloud', e: '📱' },
                { v: 'collections', l: 'Collections', e: '🔔' },
              ].map((t) => (
                <TabsTrigger key={t.v} value={t.v} className="gap-1.5 rounded-xl px-3 py-1.5 text-xs data-[state=active]:accent-gradient-soft">
                  <span>{t.e}</span><span>{t.l}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value="accounts" className="mt-4">
            <AccountsModule accounts={accounts} busy={busy} onConnect={() => callAction('connect', '/api/bank/accounts/connect', 'POST', {})} onSync={() => callAction('sync', '/api/bank/accounts/sync', 'POST', {})} />
          </TabsContent>
          <TabsContent value="statements" className="mt-4">
            <StatementsModule statements={statements} busy={busy} onSync={() => callAction('stmt-sync', '/api/bank/statements/sync', 'POST', {})} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-4">
            <TransactionsModule transactions={filteredTxns} filter={txnFilter} setFilter={setTxnFilter} />
          </TabsContent>
          <TabsContent value="aa" className="mt-4">
            <AAModule aa={aa} busy={busy}
              onConnect={() => callAction('aa-connect', '/api/aa/connect', 'POST', {})}
              onConsent={(action) => callAction('aa-consent', '/api/aa/consent', 'POST', { action })} />
          </TabsContent>
          <TabsContent value="cashflow" className="mt-4">
            <CashFlowModule cashflow={cashflow} />
          </TabsContent>
          <TabsContent value="reconciliation" className="mt-4">
            <ReconciliationModule reconciliation={reconciliation} busy={busy}
              onRun={() => callAction('recon-run', '/api/bank/reconciliation', 'POST', {})} />
          </TabsContent>
          <TabsContent value="upi" className="mt-4">
            <UPIModule upi={upi} busy={busy}
              onConnect={() => callAction('upi-connect', '/api/bank/upi/connect', 'POST', {})}
              onSync={() => callAction('upi-sync', '/api/bank/upi/sync', 'POST', {})} />
          </TabsContent>
          <TabsContent value="collections" className="mt-4">
            <CollectionsModule collections={collections} busy={busy}
              onRecover={() => callAction('coll-recover', '/api/bank/collections/recover', 'POST', {})}
              onRemind={() => callAction('coll-remind', '/api/bank/collections/remind', 'POST', {})} />
          </TabsContent>
        </Tabs>
      </FadeIn>

      {/* ═══ Footer ═══ */}
      <FadeIn delay={0.15}>
        <Card className="border-white/[0.06] bg-card/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 accent-text" />
                <span>18 endpoints · 7 DB tables · src/lib/banking/</span>
              </div>
              <span>Oracle speaks in past tense — "I've synced your bank accounts."</span>
            </div>
            <Separator className="my-3 bg-white/[0.06]" />
            <p className="text-center text-xs text-muted-foreground">
              <span className="accent-text font-semibold">VEYRO Banking Cloud™</span> — Connect. Execute. Automate. Scale.{' '}
              <span className="text-muted-foreground/70">The AI Operating System for Business™</span>
            </p>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — Bank Account Management™
// ═══════════════════════════════════════════════════════════════════════════════

function AccountsModule({ accounts, busy, onConnect, onSync }: {
  accounts: BankAccountSummary[];
  busy: string | null;
  onConnect: () => void;
  onSync: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Landmark} emoji="🏦" title="Bank Account Management™"
        subtitle="Multiple current, savings & OD/CC accounts · real-time sync"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onSync} disabled={busy === 'sync'}
              className="gap-1.5 border-white/[0.08] bg-white/[0.03]">
              <RefreshCw className={cn('h-3.5 w-3.5', busy === 'sync' && 'animate-spin')} /> Sync All
            </Button>
            <Button size="sm" onClick={onConnect} disabled={busy === 'connect'} className="gap-1.5">
              {busy === 'connect' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Connect
            </Button>
          </div>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            APIs: <code className="text-foreground">POST /api/bank/accounts/connect</code>, <code className="text-foreground">GET /api/bank/accounts</code>, <code className="text-foreground">POST /api/bank/accounts/sync</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oracle: <span className="accent-text">"I've synced your bank accounts."</span>
          </p>
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <Card className="border-dashed border-white/[0.1] bg-card/30">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No bank accounts connected yet. Click "Connect" to add one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {accounts.map((a) => (
            <Card key={a.id} className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                      <Building2 className="h-5 w-5 accent-text" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{a.bankName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{a.accountMasked} · {ACCOUNT_TYPE_GLYPH[a.accountType]} {ACCOUNT_TYPE_LABEL[a.accountType]}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    {SYNC_STATUS_GLYPH[a.status]} {a.status}
                  </Badge>
                </div>
                <Separator className="my-3 bg-white/[0.06]" />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Current Balance</div>
                    <div className="text-base font-bold text-foreground">{formatINR(a.currentBalance)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Available</div>
                    <div className="text-base font-bold text-emerald-400">{formatINR(a.availableBalance)}</div>
                  </div>
                  {a.overdraftLimit > 0 && (
                    <div>
                      <div className="text-muted-foreground">OD Limit</div>
                      <div className="font-semibold text-foreground">{formatINR(a.overdraftLimit)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground">Last Sync</div>
                    <div className="font-semibold text-foreground">{timeAgo(a.lastSyncAt)}</div>
                  </div>
                  {a.ifsc && (
                    <div>
                      <div className="text-muted-foreground">IFSC</div>
                      <div className="font-mono text-[11px] text-foreground">{a.ifsc}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground">Today</div>
                    <div className="font-semibold text-foreground">{a.recordsToday} txns</div>
                  </div>
                </div>
                <Separator className="my-3 bg-white/[0.06]" />
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  {a.upiHandle && (
                    <Badge variant="outline" className="gap-1 border-violet-500/30 bg-violet-500/[0.06] text-violet-300">
                      <Smartphone className="h-2.5 w-2.5" /> {a.upiHandle}
                    </Badge>
                  )}
                  {a.aaConsent ? (
                    <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">
                      <Link2 className="h-2.5 w-2.5" /> AA Consent
                      {a.aaConsentExpiry && <span className="opacity-70">· exp {new Date(a.aaConsentExpiry).toLocaleDateString('en-IN')}</span>}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 border-white/[0.08] text-muted-foreground">
                      No AA Consent
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — Bank Statement Sync™
// ═══════════════════════════════════════════════════════════════════════════════

function StatementsModule({ statements, busy, onSync }: {
  statements: BankStatementSummary | null;
  busy: string | null;
  onSync: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Receipt} emoji="📄" title="Bank Statement Sync™"
        subtitle="Auto transaction import · daily sync · categorisation · search & filters"
        action={
          <Button size="sm" onClick={onSync} disabled={busy === 'stmt-sync'} className="gap-1.5">
            {busy === 'stmt-sync' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync Statements
          </Button>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            APIs: <code className="text-foreground">GET /api/bank/statements</code>, <code className="text-foreground">POST /api/bank/statements/sync</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oracle: <span className="accent-text">"I've synced 348 bank transactions. I've detected ₹3,84,000 in collections."</span>
          </p>
        </CardContent>
      </Card>

      {statements ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Txns</div>
              <div className="text-xl font-bold text-foreground">{statements.totalTransactions}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</div>
              <div className="text-xl font-bold text-foreground">{statements.todayCount}</div>
            </CardContent></Card>
            <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">30d Inflow</div>
              <div className="text-xl font-bold text-emerald-400">{formatINR(statements.inflow30d)}</div>
            </CardContent></Card>
            <Card className="border-red-500/20 bg-red-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">30d Outflow</div>
              <div className="text-xl font-bold text-red-400">{formatINR(statements.outflow30d)}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Categorised</div>
              <div className="text-xl font-bold text-foreground">{statements.categorisationPct}%</div>
            </CardContent></Card>
          </div>

          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Transactions · {statements.recentTransactions.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {statements.recentTransactions.map((t) => (
                    <div key={t.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{CATEGORY_GLYPH[t.category]}</span>
                          <div>
                            <div className="font-semibold text-foreground">{t.description}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{t.bankName} {t.accountMasked} · {t.referenceNo ?? '—'} · {new Date(t.date).toLocaleDateString('en-IN')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.matched ? (
                            <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5" /> {t.matchedInvoice}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/[0.06] text-amber-400 text-[10px]">Unmatched</Badge>
                          )}
                          <span className={cn('font-bold', t.type === 'credit' ? 'text-emerald-400' : 'text-red-400')}>
                            {t.type === 'credit' ? '+' : ''}{formatINR(t.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading statements…</CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — Transactions (search & filter)
// ═══════════════════════════════════════════════════════════════════════════════

function TransactionsModule({ transactions, filter, setFilter }: {
  transactions: BankTransactionRow[];
  filter: { search: string; type: string; category: string; matched: string };
  setFilter: (f: { search: string; type: string; category: string; matched: string }) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Search} emoji="🔍" title="Transactions"
        subtitle="Search & filter across all bank transactions" />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            API: <code className="text-foreground">GET /api/bank/transactions?type=&category=&matched=&limit=</code>
          </p>
        </CardContent>
      </Card>

      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                placeholder="Search description, counterparty, reference…"
                className="h-8 pl-8 text-xs" />
            </div>
            <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-xs text-foreground outline-none">
              <option value="all">All types</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
            <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-xs text-foreground outline-none">
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={filter.matched} onChange={(e) => setFilter({ ...filter, matched: e.target.value })}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 text-xs text-foreground outline-none">
              <option value="all">All</option>
              <option value="true">Matched</option>
              <option value="false">Unmatched</option>
            </select>
            <Badge variant="outline" className="ml-auto text-[10px]">{transactions.length} shown</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-0">
          <ScrollArea className="max-h-[480px]">
            <div className="divide-y divide-white/[0.04]">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 text-xs hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base">{CATEGORY_GLYPH[t.category]}</span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{t.description}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{t.bankName} {t.accountMasked} · {t.referenceNo ?? '—'} · {new Date(t.date).toLocaleDateString('en-IN')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[t.category]}</Badge>
                    {t.matched ? (
                      <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400 text-[10px]">
                        ✓ {t.matchedInvoice}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">Unmatched</Badge>
                    )}
                    <span className={cn('font-bold tabular-nums', t.type === 'credit' ? 'text-emerald-400' : 'text-red-400')}>
                      {t.type === 'credit' ? '+' : ''}{formatINR(t.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No transactions match your filters.</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — Account Aggregator Cloud™
// ═══════════════════════════════════════════════════════════════════════════════

function AAModule({ aa, busy, onConnect, onConsent }: {
  aa: AAStatusSummary | null;
  busy: string | null;
  onConnect: () => void;
  onConsent: (action: 'approve' | 'reject') => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Link2} emoji="🔗" title="Account Aggregator Cloud™"
        subtitle="RBI-regulated AA framework · consented financial data sharing"
        action={
          <Button size="sm" onClick={onConnect} disabled={busy === 'aa-connect'} className="gap-1.5">
            {busy === 'aa-connect' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Connect AA
          </Button>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            APIs: <code className="text-foreground">POST /api/aa/connect</code>, <code className="text-foreground">POST /api/aa/consent</code>, <code className="text-foreground">GET /api/aa/status</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oracle: <span className="accent-text">"I've connected your financial accounts. I've refreshed your banking data."</span>
          </p>
        </CardContent>
      </Card>

      {aa ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Connections</div>
              <div className="text-xl font-bold text-foreground">{aa.totalConnections}</div>
            </CardContent></Card>
            <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Approved</div>
              <div className="text-xl font-bold text-emerald-400">{aa.approvedConnections}</div>
            </CardContent></Card>
            <Card className="border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</div>
              <div className="text-xl font-bold text-amber-400">{aa.pendingConnections}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Linked Accounts</div>
              <div className="text-xl font-bold text-foreground">{aa.totalLinkedAccounts}</div>
              {aa.nextExpiryIn !== undefined && <div className="text-[10px] text-amber-400">next expiry in {aa.nextExpiryIn}d</div>}
            </CardContent></Card>
          </div>

          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm">AA Connections</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {aa.connections.map((c) => (
                  <div key={c.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                          <Link2 className="h-4 w-4 accent-text" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{c.aaName}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{c.customerMobile ?? '—'} · {c.linkedAccounts} linked · FI {(c.fiTypes ?? []).join(', ')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('gap-1 text-[10px]', c.consentStatus === 'approved' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : c.consentStatus === 'pending' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400')}>
                          {AA_CONSENT_GLYPH[c.consentStatus]} {c.consentStatus}
                        </Badge>
                        {c.consentStatus === 'pending' && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => onConsent('approve')} disabled={busy === 'aa-consent'}
                              className="h-6 gap-1 border-emerald-500/30 bg-emerald-500/[0.06] px-2 text-[10px] text-emerald-400">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => onConsent('reject')} disabled={busy === 'aa-consent'}
                              className="h-6 gap-1 border-red-500/30 bg-red-500/[0.06] px-2 text-[10px] text-red-400">
                              <AlertCircle className="h-2.5 w-2.5" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                      {c.consentExpiry && <span>Consent expiry: {new Date(c.consentExpiry).toLocaleDateString('en-IN')}</span>}
                      {c.lastFetchAt && <span>Last fetch: {timeAgo(c.lastFetchAt)}</span>}
                      {c.consentHandle && <span className="font-mono">Handle: {c.consentHandle.slice(0, 24)}…</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading AA status…</CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5 — Cash Flow Engine™
// ═══════════════════════════════════════════════════════════════════════════════

function CashFlowModule({ cashflow }: { cashflow: CashFlowSummary | null }) {
  if (!cashflow) {
    return (
      <div className="space-y-4">
        <SectionHeader icon={Activity} emoji="💧" title="Cash Flow Engine™" subtitle="Runway · daily/monthly forecast · shortage detection" />
        <Card className="border-dashed border-white/[0.1] bg-card/30"><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading cash flow…</CardContent></Card>
      </div>
    );
  }

  const allPoints = [...cashflow.daily.slice(-30), ...cashflow.forecast7d];
  const changePositive = cashflow.cashPositionChangePct >= 0;

  return (
    <div className="space-y-4">
      <SectionHeader icon={Activity} emoji="💧" title="Cash Flow Engine™"
        subtitle="Cash position · burn · runway · shortage detection" />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            APIs: <code className="text-foreground">GET /api/bank/cashflow</code>, <code className="text-foreground">GET /api/bank/cashflow/forecast</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oracle: <span className="accent-text">"I've detected a cash shortage. I've forecasted your cash position."</span>
          </p>
        </CardContent>
      </Card>

      {cashflow.shortageDetected && (
        <Card className="border-red-500/30 bg-red-500/[0.06] backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <div>
                <div className="text-sm font-bold text-red-400">Cash shortage projected</div>
                <div className="text-xs text-muted-foreground">
                  Projected shortfall of <span className="font-semibold text-red-300">{formatINR(cashflow.shortageAmount)}</span>
                  {cashflow.shortageDate && <> on <span className="font-semibold">{new Date(cashflow.shortageDate).toLocaleDateString('en-IN')}</span></>}.
                  VEYRO has scheduled collections recovery to bridge the gap.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cash Position</div>
          <div className="text-xl font-bold text-foreground">{formatINR(cashflow.cashPosition)}</div>
          <div className={cn('text-[10px]', changePositive ? 'text-emerald-400' : 'text-red-400')}>
            {changePositive ? <TrendingUp className="inline h-2.5 w-2.5" /> : <TrendingDown className="inline h-2.5 w-2.5" />} {cashflow.cashPositionChangePct.toFixed(1)}% vs 30d
          </div>
        </CardContent></Card>
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily Burn</div>
          <div className="text-xl font-bold text-foreground">{formatINR(cashflow.dailyBurn)}</div>
        </CardContent></Card>
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly Burn</div>
          <div className="text-xl font-bold text-foreground">{formatINR(cashflow.monthlyBurn)}</div>
        </CardContent></Card>
        <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Runway</div>
          <div className="text-xl font-bold text-foreground">{cashflow.runwayDays}d</div>
        </CardContent></Card>
        <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected In (7d)</div>
          <div className="text-xl font-bold text-emerald-400">{formatINR(cashflow.expectedCollections)}</div>
        </CardContent></Card>
        <Card className="border-red-500/20 bg-red-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected Out (7d)</div>
          <div className="text-xl font-bold text-red-400">{formatINR(cashflow.expectedPayments)}</div>
        </CardContent></Card>
      </div>

      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Cash Position · Last 30 days + 7-day forecast</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <CashFlowChart points={allPoints} />
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>30d ago</span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-3 rounded-sm bg-emerald-500" /> closing balance
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-400" /> shortage
            </span>
            <span>+7d forecast</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3"><CardTitle className="text-sm">7-Day Forecast</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="max-h-72">
            <div className="space-y-1">
              {cashflow.forecast7d.map((d) => (
                <div key={d.date} className={cn('flex items-center justify-between rounded-lg p-2 text-xs', d.shortage ? 'border border-red-500/20 bg-red-500/[0.04]' : 'border border-white/[0.04] bg-white/[0.02]')}>
                  <div className="font-mono text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">+{formatINR(d.inflows)}</span>
                    <span className="text-red-400">-{formatINR(d.outflows)}</span>
                    <span className="font-bold text-foreground">{formatINR(d.closing)}</span>
                    {d.shortage && <Badge variant="outline" className="border-red-500/30 bg-red-500/[0.06] text-red-400 text-[10px]">shortage {formatINR(d.shortageAmount)}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6 — Auto Reconciliation Engine™
// ═══════════════════════════════════════════════════════════════════════════════

function ReconciliationModule({ reconciliation, busy, onRun }: {
  reconciliation: ReconciliationSummary | null;
  busy: string | null;
  onRun: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={CheckCircle2} emoji="⚖️" title="Auto Reconciliation Engine™"
        subtitle="Bank txns → invoices → payments → matching · mismatch detection"
        action={
          <Button size="sm" onClick={onRun} disabled={busy === 'recon-run'} className="gap-1.5">
            {busy === 'recon-run' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run Reconciliation
          </Button>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            APIs: <code className="text-foreground">POST /api/bank/reconciliation</code>, <code className="text-foreground">GET /api/bank/reconciliation</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oracle: <span className="accent-text">"I've reconciled your bank transactions. I've found ₹48,000 unmatched receipts. I've identified 5 pending collections."</span>
          </p>
        </CardContent>
      </Card>

      {reconciliation ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-4 flex items-center gap-4">
              <ReconDonut matched={reconciliation.matched} total={reconciliation.totalTransactions} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Match Rate</div>
                <div className="text-xl font-bold text-foreground">{reconciliation.matchedPct}%</div>
                <div className="text-[10px] text-muted-foreground">{reconciliation.matched}/{reconciliation.totalTransactions} matched</div>
              </div>
            </CardContent></Card>
            <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-sm"><CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Matched Amount</div>
              <div className="text-2xl font-bold text-emerald-400">{formatINR(reconciliation.matchedAmount)}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{reconciliation.matched} transactions reconciled</div>
            </CardContent></Card>
            <Card className="border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-sm"><CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unmatched Amount</div>
              <div className="text-2xl font-bold text-amber-400">{formatINR(reconciliation.unmatchedAmount)}</div>
              <div className="mt-1 text-[10px] text-muted-foreground">{reconciliation.unmatched + reconciliation.partial + reconciliation.duplicate} need review</div>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Matched</div>
              <div className="text-lg font-bold text-emerald-400">{reconciliation.matched}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unmatched</div>
              <div className="text-lg font-bold text-amber-400">{reconciliation.unmatched}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</div>
              <div className="text-lg font-bold text-foreground">{reconciliation.pending}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Duplicates</div>
              <div className="text-lg font-bold text-foreground">{reconciliation.duplicate}</div>
            </CardContent></Card>
            <Card className={cn('border-white/[0.06] bg-card/60 backdrop-blur-sm', RISK_TONE[reconciliation.riskLevel])}><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk Score</div>
              <div className="text-lg font-bold">{reconciliation.riskScore}/100</div>
              <div className="text-[10px]">{reconciliation.riskLevel}</div>
            </CardContent></Card>
          </div>

          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Recent Reconciliation Entries</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {reconciliation.entries.map((e) => (
                    <div key={e.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span>{RECON_STATUS_GLYPH[e.status]}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{e.bankRef}</span>
                          {e.mismatchType && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">{e.mismatchType.replace(/_/g, ' ')}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {e.matchedInvoice && (
                            <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400 text-[10px]">
                              {e.matchedInvoice} · {e.matchedTo}
                            </Badge>
                          )}
                          <span className="font-bold text-foreground">{formatINR(e.bankAmount)}</span>
                          <Badge variant="outline" className="text-[10px]">{e.confidencePct}%</Badge>
                        </div>
                      </div>
                      {e.suggestedAction && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          <span className="font-semibold">Suggested:</span> {e.suggestedAction}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading reconciliation…</CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7 — UPI Cloud™
// ═══════════════════════════════════════════════════════════════════════════════

function UPIModule({ upi, busy, onConnect, onSync }: {
  upi: UPISummary | null;
  busy: string | null;
  onConnect: () => void;
  onSync: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Smartphone} emoji="📱" title="UPI Cloud™"
        subtitle="UPI transaction sync · collection tracking · QR · reconciliation · analytics"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onSync} disabled={busy === 'upi-sync'}
              className="gap-1.5 border-white/[0.08] bg-white/[0.03]">
              <RefreshCw className={cn('h-3.5 w-3.5', busy === 'upi-sync' && 'animate-spin')} /> Sync UPI
            </Button>
            <Button size="sm" onClick={onConnect} disabled={busy === 'upi-connect'} className="gap-1.5">
              {busy === 'upi-connect' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} UPI Collect
            </Button>
          </div>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            APIs: <code className="text-foreground">POST /api/bank/upi/connect</code>, <code className="text-foreground">GET /api/bank/upi</code>, <code className="text-foreground">POST /api/bank/upi/sync</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oracle: <span className="accent-text">"I've detected ₹82,000 in UPI collections. I've matched UPI payments with invoices."</span>
          </p>
        </CardContent>
      </Card>

      {upi ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total UPI</div>
              <div className="text-xl font-bold text-foreground">{upi.totalTransactions}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Today</div>
              <div className="text-xl font-bold text-foreground">{upi.todayCount}</div>
            </CardContent></Card>
            <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Collections (30d)</div>
              <div className="text-xl font-bold text-emerald-400">{formatINR(upi.collections30d)}</div>
            </CardContent></Card>
            <Card className="border-red-500/20 bg-red-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Payments (30d)</div>
              <div className="text-xl font-bold text-red-400">{formatINR(upi.payments30d)}</div>
            </CardContent></Card>
            <Card className="border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending Settle</div>
              <div className="text-xl font-bold text-amber-400">{upi.pendingSettlements}</div>
              <div className="text-[10px] text-muted-foreground">{formatINR(upi.pendingSettlementAmount)}</div>
            </CardContent></Card>
          </div>

          {upi.topCustomers.length > 0 && (
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-3"><CardTitle className="text-sm">Top UPI Customers</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {upi.topCustomers.map((c, i) => (
                    <div key={c.vpa} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft text-[11px] font-bold accent-text">#{i + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-foreground">{c.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{c.vpa}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">{formatINR(c.total)}</div>
                        <div className="text-[10px] text-muted-foreground">{c.count} txns</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Recent UPI Transactions</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {upi.transactions.map((t) => (
                    <div key={t.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-3.5 w-3.5 text-violet-300" />
                          <div>
                            <div className="font-semibold text-foreground">{t.vpaCounterparty ?? t.upiId}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{t.upiId} · {t.referenceNo ?? '—'} · {new Date(t.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {t.matched ? (
                            <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400 text-[10px]">✓ {t.matchedInvoice}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Unmatched</Badge>
                          )}
                          <Badge variant="outline" className={cn('text-[10px]', t.status === 'settled' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400' : t.status === 'pending' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400' : 'border-red-500/30 bg-red-500/[0.06] text-red-400')}>
                            {t.status}
                          </Badge>
                          <span className={cn('font-bold', t.type === 'credit' ? 'text-emerald-400' : 'text-red-400')}>
                            {t.type === 'credit' ? '+' : ''}{formatINR(t.amount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading UPI state…</CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 8 — Collections Recovery Engine™
// ═══════════════════════════════════════════════════════════════════════════════

function CollectionsModule({ collections, busy, onRecover, onRemind }: {
  collections: CollectionsSummary | null;
  busy: string | null;
  onRecover: () => void;
  onRemind: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={Bell} emoji="🔔" title="Collections Recovery Engine™"
        subtitle="Detect overdue · WhatsApp/Email/SMS reminders · escalation workflows"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onRemind} disabled={busy === 'coll-remind'}
              className="gap-1.5 border-white/[0.08] bg-white/[0.03]">
              {busy === 'coll-remind' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send Reminders
            </Button>
            <Button size="sm" onClick={onRecover} disabled={busy === 'coll-recover'} className="gap-1.5">
              {busy === 'coll-recover' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run Recovery
            </Button>
          </div>
        } />
      <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            APIs: <code className="text-foreground">GET /api/bank/collections</code>, <code className="text-foreground">POST /api/bank/collections/recover</code>, <code className="text-foreground">POST /api/bank/collections/remind</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Oracle: <span className="accent-text">"I've detected 12 overdue invoices. I've scheduled collection reminders. I've initiated recovery workflows."</span>
          </p>
        </CardContent>
      </Card>

      {collections ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="border-red-500/20 bg-red-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Open Cases</div>
              <div className="text-xl font-bold text-red-400">{collections.openCases}</div>
            </CardContent></Card>
            <Card className="border-emerald-500/20 bg-emerald-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recovered (30d)</div>
              <div className="text-xl font-bold text-emerald-400">{collections.recoveredCases}</div>
              <div className="text-[10px] text-muted-foreground">{formatINR(collections.recovered30d)}</div>
            </CardContent></Card>
            <Card className="border-amber-500/20 bg-amber-500/[0.04] backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Escalated</div>
              <div className="text-xl font-bold text-amber-400">{collections.escalatedCases}</div>
            </CardContent></Card>
            <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm"><CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Outstanding</div>
              <div className="text-xl font-bold text-foreground">{formatINR(collections.totalOutstanding)}</div>
              <div className="text-[10px] text-muted-foreground">avg {collections.avgDaysOverdue}d overdue</div>
            </CardContent></Card>
          </div>

          <Card className="border-white/[0.06] bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Overdue Invoices · {collections.cases.length} cases</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="max-h-[480px]">
                <div className="space-y-1.5">
                  {collections.cases.map((c) => (
                    <div key={c.id} className={cn('rounded-lg border p-2.5 text-xs', RISK_TONE[c.riskLevel])}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span>{COLLECTIONS_STATUS_GLYPH[c.status]}</span>
                          <div>
                            <div className="font-semibold text-foreground">{c.invoiceNo} · {c.clientName}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {c.dueDate && <>due {new Date(c.dueDate).toLocaleDateString('en-IN')} · </>}
                              {c.daysOverdue}d overdue · {c.reminderCount} reminders · escalation L{c.escalationLevel}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px]', RISK_TONE[c.riskLevel])}>
                            {c.riskLevel}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge>
                          <span className="font-bold text-foreground">{formatINR(c.outstanding)}</span>
                        </div>
                      </div>
                      {c.nextActionAt && c.status === 'open' && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          <Calendar className="mr-1 inline h-2.5 w-2.5" />
                          Next action: {new Date(c.nextActionAt).toLocaleDateString('en-IN')}
                          {c.lastReminderAt && <> · last reminder {timeAgo(c.lastReminderAt)}</>}
                        </div>
                      )}
                    </div>
                  ))}
                  {collections.cases.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">No overdue invoices — all caught up!</div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed border-white/[0.1] bg-card/30">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading collections…</CardContent>
        </Card>
      )}
    </div>
  );
}
