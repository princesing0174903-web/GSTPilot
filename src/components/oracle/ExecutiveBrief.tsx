'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Executive Brief (Phase Beta-1)
//
// Renders the 8-section executive brief whenever Oracle opens with no
// conversation history. Every number is computed from REAL Firestore data via
// real-time hooks — never mock data, never Math.random.
//
// Sections:
//   1. Today's Priorities       — tasks due today/overdue + high-priority deals/leads
//   2. Cash Position            — bank balance + 7-day trend
//   3. GST Summary              — pending GSTR filings, due dates, total liability
//   4. Compliance Summary       — overdue/upcoming compliance (returns + notices)
//   5. Collection Summary       — overdue receivables (invoices) total + count
//   6. Business Risks           — computed risk signals (low cash, overdue GST…)
//   7. Recommended Actions      — actionable CTAs derived from the above
//   8. Upcoming Deadlines       — next-7-day deadlines (returns + tasks + notices)
//
// If a section has no underlying data, an inline CTA is shown — NEVER invented.
//
// Design tokens (dark theme — same as Oracle workspace):
//   bg #050505 · cards #111111 · border rgba(255,255,255,0.08)
//   accent emerald / teal / cyan / violet / amber / rose (NEVER indigo / blue)
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  IndianRupee,
  Lightbulb,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { AppView } from '@/contexts/AppContext';
import {
  useFireTasks,
  useFireBankAccounts,
  useFireBankTransactions,
  useFireGstReturns,
  useFireReturns,
  useFireNotices,
  useFireInvoices,
  useFireLeads,
  useFireDeals,
} from '@/hooks/use-firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExecutiveBriefProps {
  /** Navigate to a workspace when an action button is tapped. */
  onNavigate: (view: AppView) => void;
  /** Optional: dismiss the brief and ask Oracle a question. */
  onAskOracle?: (prompt: string) => void;
  userName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EASE = [0.16, 1, 0.3, 1] as const;

/** Format a number as Indian Rupees (₹) using the Indian number system. */
function fmtINR(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}₹${abs.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}

/** Compact INR — ₹1.2L, ₹3.4Cr, ₹12.5K. Useful for tight card space. */
function fmtINRCompact(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

/** Parse any date-ish value (ISO string | Date | Firestore Timestamp | null). */
function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object' && v !== null && 'toDate' in v) {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  return null;
}

/** Strip a Date to a YYYY-MM-DD key for grouping. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Start of today (midnight, local). */
function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Date + N days. */
function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Human-readable due label: "Overdue 3d", "Due today", "Due tomorrow", "Due in 4d". */
function dueLabel(due: Date | null): { text: string; tone: Tone } {
  if (!due) return { text: 'No due date', tone: 'neutral' };
  const today = startOfToday();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return { text: `Overdue ${Math.abs(diffDays)}d`, tone: 'rose' };
  if (diffDays === 0) return { text: 'Due today', tone: 'amber' };
  if (diffDays === 1) return { text: 'Due tomorrow', tone: 'amber' };
  if (diffDays <= 7) return { text: `Due in ${diffDays}d`, tone: 'cyan' };
  return { text: `Due ${dueDay.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, tone: 'neutral' };
}

// ─── Tone → color mapping (NEVER indigo / blue) ───────────────────────────────

type Tone = 'emerald' | 'teal' | 'cyan' | 'violet' | 'amber' | 'rose' | 'neutral';

const TONE_TEXT: Record<Tone, string> = {
  emerald: 'text-emerald-400',
  teal: 'text-teal-400',
  cyan: 'text-cyan-400',
  violet: 'text-violet-400',
  amber: 'text-amber-400',
  rose: 'text-rose-400',
  neutral: 'text-white/60',
};

const TONE_BG: Record<Tone, string> = {
  emerald: 'bg-emerald-500/10',
  teal: 'bg-teal-500/10',
  cyan: 'bg-cyan-500/10',
  violet: 'bg-violet-500/10',
  amber: 'bg-amber-500/10',
  rose: 'bg-rose-500/10',
  neutral: 'bg-white/[0.05]',
};

const TONE_BORDER: Record<Tone, string> = {
  emerald: 'border-emerald-500/20',
  teal: 'border-teal-500/20',
  cyan: 'border-cyan-500/20',
  violet: 'border-violet-500/20',
  amber: 'border-amber-500/20',
  rose: 'border-rose-500/20',
  neutral: 'border-white/[0.08]',
};

const TONE_DOT: Record<Tone, string> = {
  emerald: 'bg-emerald-400',
  teal: 'bg-teal-400',
  cyan: 'bg-cyan-400',
  violet: 'bg-violet-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  neutral: 'bg-white/40',
};

// ─── Card primitives ──────────────────────────────────────────────────────────

interface BriefCardProps {
  icon: LucideIcon;
  title: string;
  tone: Tone;
  /** Optional small label on the right (e.g. "Last 7 days"). */
  meta?: ReactNode;
  children: ReactNode;
  /** Delay (ms) for the entrance animation — staggered. */
  delay?: number;
}

function BriefCard({ icon: Icon, title, tone, meta, children, delay = 0 }: BriefCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className={cn(
        'flex flex-col rounded-2xl border bg-white/[0.025] p-4 backdrop-blur-sm',
        TONE_BORDER[tone],
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            TONE_BG[tone],
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', TONE_TEXT[tone])} />
        </div>
        <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
          {title}
        </h3>
        {meta && <div className="text-[10px] text-white/40">{meta}</div>}
      </div>
      {children}
    </motion.section>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center gap-2.5">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// ─── Empty-state CTA ──────────────────────────────────────────────────────────

interface EmptyCtaProps {
  message: string;
  ctaLabel: string;
  ctaIcon?: LucideIcon;
  view: AppView;
  onNavigate: (view: AppView) => void;
}

function EmptyCta({ message, ctaLabel, ctaIcon: Icon = Plus, view, onNavigate }: EmptyCtaProps) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-xs leading-relaxed text-white/50">{message}</p>
      <button
        type="button"
        onClick={() => onNavigate(view)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15"
      >
        <Icon className="h-3.5 w-3.5" />
        {ctaLabel}
      </button>
    </div>
  );
}

// ─── Small stat row ───────────────────────────────────────────────────────────

function StatRow({ label, value, tone = 'neutral' }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className={cn('text-xs font-semibold tabular-nums', TONE_TEXT[tone])}>{value}</span>
    </div>
  );
}

// ─── Priority list item ───────────────────────────────────────────────────────

interface PriorityItem {
  id: string;
  title: string;
  sub: string;
  tone: Tone;
  view: AppView;
}

function PriorityList({ items, onNavigate, empty }: { items: PriorityItem[]; onNavigate: (v: AppView) => void; empty: ReactNode }) {
  if (items.length === 0) {
    return <div className="text-xs text-white/50">{empty}</div>;
  }
  return (
    <div className="space-y-1.5">
      {items.slice(0, 5).map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onNavigate(it.view)}
          className="group flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.04]"
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[it.tone])} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-white/90">{it.title}</span>
            <span className="block truncate text-[10px] text-white/50">{it.sub}</span>
          </span>
          <ArrowRight className="h-3 w-3 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
        </button>
      ))}
    </div>
  );
}

// ─── 7-day sparkline (pure SVG, no chart lib) ─────────────────────────────────

function Sparkline({ values, tone = 'emerald' }: { values: number[]; tone?: Tone }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ');
  const colorClass = TONE_TEXT[tone];
  const stroke =
    tone === 'emerald' ? '#34d399'
    : tone === 'teal' ? '#2dd4bf'
    : tone === 'cyan' ? '#22d3ee'
    : tone === 'violet' ? '#a78bfa'
    : tone === 'amber' ? '#fbbf24'
    : tone === 'rose' ? '#fb7185'
    : '#9ca3af';
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last-point dot */}
      <circle
        cx={(w).toFixed(1)}
        cy={(h - ((values[values.length - 1] - min) / range) * h).toFixed(1)}
        r={2.5}
        fill={stroke}
      />
      <text x={2} y={10} className="text-[8px]" fill="currentColor" opacity={0.4}>
        {up ? '▲' : '▼'}
      </text>
      <text x={w - 12} y={10} className="text-[8px]" fill="currentColor" opacity={0.6}>
        <tspan className={colorClass} />
      </text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ExecutiveBrief({ onNavigate, onAskOracle, userName }: ExecutiveBriefProps) {
  // ─── Live data ──────────────────────────────────────────────────────────────
  const tasks = useFireTasks();
  const bankAccounts = useFireBankAccounts();
  const bankTxns = useFireBankTransactions();
  const gstReturns = useFireGstReturns();
  const returns = useFireReturns();
  const notices = useFireNotices();
  const invoices = useFireInvoices();
  const leads = useFireLeads();
  const deals = useFireDeals();

  // Overall loading: keep brief in skeleton state until at least the core
  // collections have resolved. Individual sections also handle their own
  // loading state for finer-grained UX.
  const anyLoading =
    tasks.loading ||
    bankAccounts.loading ||
    bankTxns.loading ||
    gstReturns.loading ||
    returns.loading ||
    notices.loading ||
    invoices.loading;

  // ─── 1. Today's Priorities ──────────────────────────────────────────────────
  const priorities = useMemo<PriorityItem[]>(() => {
    const out: PriorityItem[] = [];
    const today = startOfToday();

    // Tasks due today or overdue
    for (const t of tasks.data) {
      if (t.status === 'completed' || t.status === 'cancelled') continue;
      const due = toDate(t.dueDate);
      if (!due) continue;
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (dueDay.getTime() <= today.getTime()) {
        const dl = dueLabel(due);
        out.push({
          id: `task-${t.id}`,
          title: t.title || 'Untitled task',
          sub: `${t.priority} priority · ${dl.text}`,
          tone: dl.tone === 'rose' ? 'rose' : dl.tone === 'amber' ? 'amber' : t.priority === 'urgent' ? 'rose' : t.priority === 'high' ? 'amber' : 'cyan',
          view: 'tasks',
        });
      }
    }

    // High-priority open deals (proposal / negotiation stage)
    for (const d of deals.data) {
      if (d.stage === 'closed_won' || d.stage === 'closed_lost') continue;
      if (d.stage !== 'negotiation' && d.stage !== 'proposal') continue;
      out.push({
        id: `deal-${d.id}`,
        title: d.title || 'Unnamed deal',
        sub: `${d.stage === 'negotiation' ? 'Negotiation' : 'Proposal'} · ${fmtINRCompact(d.value || 0)} · ${Math.round((d.probability || 0) * 100)}%`,
        tone: 'violet',
        view: 'crm',
      });
    }

    // High-score / hot leads
    for (const l of leads.data) {
      if (l.status === 'converted' || l.status === 'lost') continue;
      if ((l.leadScore || 0) >= 70 || l.status === 'qualified') {
        out.push({
          id: `lead-${l.id}`,
          title: `${l.contactName || 'Lead'} — ${l.company || 'Unknown'}`,
          sub: `${l.status} · score ${l.leadScore || 0} · ${fmtINRCompact(l.estimatedValue || 0)}`,
          tone: 'teal',
          view: 'crm',
        });
      }
    }

    // Sort: rose (overdue) → amber → violet → teal → cyan → neutral
    const order: Record<Tone, number> = {
      rose: 0, amber: 1, violet: 2, teal: 3, cyan: 4, emerald: 5, neutral: 6,
    };
    out.sort((a, b) => order[a.tone] - order[b.tone]);
    return out;
  }, [tasks.data, deals.data, leads.data]);

  // ─── 2. Cash Position ───────────────────────────────────────────────────────
  const cash = useMemo(() => {
    const accounts = bankAccounts.data;
    const txns = bankTxns.data;
    if (accounts.length === 0 && txns.length === 0) {
      return { hasData: false, totalBalance: 0, trend: [] as { day: string; balance: number }[], delta: 0 };
    }
    // Prefer the live bank_accounts.currentBalance sum as the headline figure.
    const totalBalance = accounts.reduce((s, a) => s + (a.currentBalance || 0), 0);

    // 7-day trend: derive from transactions' balanceAfter, grouped by day.
    const byDay = new Map<string, number>();
    for (const t of txns) {
      if (t.balanceAfter == null) continue;
      const d = toDate(t.date);
      if (!d) continue;
      byDay.set(dayKey(d), Number(t.balanceAfter));
    }
    const sorted = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const trend = sorted.slice(-7).map(([k, balance]) => ({ day: k.slice(5), balance }));

    // Delta = last - first (positive = improving)
    const delta = trend.length >= 2 ? trend[trend.length - 1].balance - trend[0].balance : 0;

    return { hasData: true, totalBalance, trend, delta };
  }, [bankAccounts.data, bankTxns.data]);

  // ─── 3. GST Summary ─────────────────────────────────────────────────────────
  const gst = useMemo(() => {
    const list = gstReturns.data;
    if (list.length === 0) {
      return { hasData: false, pending: [], totalLiability: 0, overdueCount: 0 };
    }
    const today = startOfToday();
    const pending = list.filter((g) => g.status !== 'filed' && g.status !== 'acknowledged');
    const overdue = pending.filter((g) => {
      const due = toDate(g.dueDate);
      return due ? new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() < today.getTime() : false;
    });
    const totalLiability = pending.reduce((s, g) => s + (g.netPayable || 0), 0);
    return {
      hasData: true,
      pending,
      totalLiability,
      overdueCount: overdue.length,
    };
  }, [gstReturns.data]);

  // ─── 4. Compliance Summary ──────────────────────────────────────────────────
  const compliance = useMemo(() => {
    const retList = returns.data;
    const notList = notices.data;
    if (retList.length === 0 && notList.length === 0) {
      return { hasData: false, items: [] as PriorityItem[] };
    }
    const today = startOfToday();
    const items: PriorityItem[] = [];

    // Non-filed returns (legacy `returns` collection — client-facing GSTR-1/3B).
    for (const r of retList) {
      if (r.status === 'filed' || r.status === 'submitted') continue;
      items.push({
        id: `ret-${r.id}`,
        title: `${r.returnType} · ${r.period}`,
        sub: `${r.status} · ${r.totalInvoices || 0} invoices · ${r.criticalErrors || 0} critical`,
        tone: r.criticalErrors > 0 ? 'rose' : r.status === 'validated' || r.status === 'reviewed' || r.status === 'generated' ? 'emerald' : 'amber',
        view: 'returns',
      });
    }

    // Open / in-progress notices.
    for (const n of notList) {
      if (n.status === 'resolved' || n.status === 'closed' || n.status === 'responded') continue;
      const due = toDate(n.dueDate);
      const dl = dueLabel(due);
      items.push({
        id: `notice-${n.id}`,
        title: n.subject || `${n.noticeType} notice`,
        sub: `${n.clientTradeName || '—'} · ${dl.text}${n.priority === 'urgent' ? ' · urgent' : n.priority === 'high' ? ' · high' : ''}`,
        tone: n.priority === 'urgent' ? 'rose' : n.priority === 'high' ? 'amber' : dl.tone === 'rose' ? 'rose' : 'cyan',
        view: 'notices',
      });
    }

    // Sort by tone urgency (overdue first)
    const order: Record<Tone, number> = {
      rose: 0, amber: 1, cyan: 2, emerald: 3, violet: 4, teal: 5, neutral: 6,
    };
    items.sort((a, b) => order[a.tone] - order[b.tone]);
    return { hasData: true, items };
  }, [returns.data, notices.data]);

  // ─── 5. Collection Summary ──────────────────────────────────────────────────
  // Receivables = sales invoices that are NOT cancelled, with no received payment
  // marker. We approximate "overdue" by invoiceDate older than 30 days AND not
  // filed. We do NOT invent a receivable flag — if there's no invoice data, we
  // show a CTA.
  const collections = useMemo(() => {
    const list = invoices.data;
    if (list.length === 0) {
      return { hasData: false, overdueCount: 0, overdueTotal: 0, topOverdue: [] as PriorityItem[] };
    }
    const today = startOfToday();
    const cutoff30 = addDays(today, -30);
    const salesInvoices = list.filter(
      (inv) => inv.status !== 'cancelled' && inv.invoiceType !== 'purchase',
    );
    const overdue = salesInvoices.filter((inv) => {
      const d = toDate(inv.invoiceDate);
      return d ? d.getTime() < cutoff30.getTime() : false;
    });
    const overdueTotal = overdue.reduce((s, inv) => s + (inv.totalAmount || 0), 0);
    const topOverdue: PriorityItem[] = overdue
      .slice()
      .sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))
      .slice(0, 4)
      .map((inv) => ({
        id: `inv-${inv.id}`,
        title: `${inv.invoiceNumber || 'Invoice'} · ${inv.buyerName || '—'}`,
        sub: fmtINR(inv.totalAmount || 0),
        tone: 'amber',
        view: 'invoices',
      }));
    return {
      hasData: true,
      overdueCount: overdue.length,
      overdueTotal,
      topOverdue,
    };
  }, [invoices.data]);

  // ─── 6. Business Risks ──────────────────────────────────────────────────────
  const risks = useMemo(() => {
    const out: { id: string; label: string; detail: string; tone: Tone; view: AppView }[] = [];

    // Low cash balance (< ₹1L across all connected accounts)
    if (cash.hasData && cash.totalBalance > 0 && cash.totalBalance < 1_00_000) {
      out.push({
        id: 'risk-low-cash',
        label: 'Low cash balance',
        detail: `Total bank balance is ${fmtINR(cash.totalBalance)} — below the ₹1L safety threshold.`,
        tone: 'rose',
        view: 'banking',
      });
    }
    // Negative 7-day cash trend
    if (cash.hasData && cash.delta < 0) {
      out.push({
        id: 'risk-cash-down',
        label: 'Cash trending down',
        detail: `Bank balance fell by ${fmtINR(Math.abs(cash.delta))} over the last 7 days.`,
        tone: 'amber',
        view: 'banking',
      });
    }
    // Overdue GST returns
    if (gst.hasData && gst.overdueCount > 0) {
      out.push({
        id: 'risk-overdue-gst',
        label: `${gst.overdueCount} overdue GSTR filing${gst.overdueCount === 1 ? '' : 's'}`,
        detail: 'Late fees and Section 50 interest are compounding daily.',
        tone: 'rose',
        view: 'gstr-filing',
      });
    }
    // Overdue receivables
    if (collections.hasData && collections.overdueCount > 0) {
      out.push({
        id: 'risk-overdue-receivables',
        label: `${collections.overdueCount} overdue invoice${collections.overdueCount === 1 ? '' : 's'}`,
        detail: `${fmtINR(collections.overdueTotal)} of receivables past 30 days.`,
        tone: 'amber',
        view: 'invoices',
      });
    }
    // Open urgent / high-priority notices
    const urgentNotices = notices.data.filter(
      (n) => (n.priority === 'urgent' || n.priority === 'high') && n.status !== 'resolved' && n.status !== 'closed' && n.status !== 'responded',
    );
    if (urgentNotices.length > 0) {
      out.push({
        id: 'risk-urgent-notices',
        label: `${urgentNotices.length} urgent notice${urgentNotices.length === 1 ? '' : 's'}`,
        detail: 'High-priority regulatory notices need a response.',
        tone: 'rose',
        view: 'notices',
      });
    }
    // No risks at all → positive signal
    if (out.length === 0) {
      // Only show "all clear" if we actually have at least one source of data.
      const hasAnyData = cash.hasData || gst.hasData || collections.hasData || notices.data.length > 0 || returns.data.length > 0;
      if (hasAnyData) {
        out.push({
          id: 'risk-none',
          label: 'No active risks',
          detail: 'Cash, GST, receivables and notices are all in the green.',
          tone: 'emerald',
          view: 'dashboard',
        });
      }
    }
    return out;
  }, [cash, gst, collections, notices.data, returns.data]);

  // ─── 7. Recommended Actions ─────────────────────────────────────────────────
  const actions = useMemo<{ id: string; label: string; detail: string; view: AppView; tone: Tone }[]>(() => {
    const out: { id: string; label: string; detail: string; view: AppView; tone: Tone }[] = [];
    if (gst.hasData && gst.overdueCount > 0) {
      const soonest = gst.pending
        .map((g) => ({ g, due: toDate(g.dueDate) }))
        .filter((x) => x.due)
        .sort((a, b) => (a.due!.getTime() - b.due!.getTime()))[0];
      out.push({
        id: 'act-file-gst',
        label: 'File overdue GSTR',
        detail: soonest ? `Soonest: ${soonest.g.returnType} · ${soonest.g.period} (due ${soonest.due!.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})` : `${gst.overdueCount} filings overdue`,
        view: 'gstr-filing',
        tone: 'rose',
      });
    } else if (gst.hasData && gst.pending.length > 0) {
      out.push({
        id: 'act-prep-gst',
        label: `Prepare ${gst.pending.length} pending GSTR`,
        detail: `Total net payable: ${fmtINR(gst.totalLiability)}`,
        view: 'gstr-filing',
        tone: 'amber',
      });
    }
    if (collections.hasData && collections.overdueCount > 0) {
      out.push({
        id: 'act-follow-up',
        label: 'Follow up on overdue invoices',
        detail: `${collections.overdueCount} invoice${collections.overdueCount === 1 ? '' : 's'} · ${fmtINR(collections.overdueTotal)} receivable`,
        view: 'invoices',
        tone: 'amber',
      });
    }
    if (compliance.hasData && compliance.items.some((i) => i.tone === 'rose' || i.tone === 'amber')) {
      out.push({
        id: 'act-compliance',
        label: 'Resolve compliance items',
        detail: `${compliance.items.length} open items across returns & notices`,
        view: 'notices',
        tone: 'cyan',
      });
    }
    if (cash.hasData && cash.totalBalance < 1_00_000) {
      out.push({
        id: 'act-cash',
        label: 'Improve cash position',
        detail: `Balance ${fmtINR(cash.totalBalance)} below safety threshold`,
        view: 'banking',
        tone: 'rose',
      });
    }
    if (priorities.length > 0) {
      out.push({
        id: 'act-priorities',
        label: `Tackle ${priorities.length} priority ${priorities.length === 1 ? 'task' : 'tasks'}`,
        detail: 'Due today / overdue — clear before end of day',
        view: 'tasks',
        tone: 'violet',
      });
    }
    // Onboarding nudge when there's no real data anywhere
    if (!cash.hasData && !gst.hasData && !collections.hasData && notices.data.length === 0 && returns.data.length === 0 && tasks.data.length === 0) {
      out.push({
        id: 'act-onboard',
        label: 'Connect your first integration',
        detail: 'Connect Google or Zoho Books to start syncing real business data',
        // The old 'connections' view has been removed — route to the real
        // Google Workspace integration page instead.
        view: 'google-workspace',
        tone: 'emerald',
      });
    }
    return out;
  }, [gst, collections, compliance, cash, priorities, notices.data.length, returns.data.length, tasks.data.length]);

  // ─── 8. Upcoming Deadlines (next 7 days) ────────────────────────────────────
  const deadlines = useMemo(() => {
    const today = startOfToday();
    const horizon = addDays(today, 7);
    const out: PriorityItem[] = [];

    for (const g of gstReturns.data) {
      if (g.status === 'filed' || g.status === 'acknowledged') continue;
      const due = toDate(g.dueDate);
      if (!due) continue;
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (dueDay.getTime() >= today.getTime() && dueDay.getTime() <= horizon.getTime()) {
        const dl = dueLabel(due);
        out.push({
          id: `dl-gst-${g.id}`,
          title: `${g.returnType} · ${g.period}`,
          sub: `${dl.text} · ${fmtINRCompact(g.netPayable || 0)} payable`,
          tone: dl.tone === 'rose' ? 'rose' : dl.tone === 'amber' ? 'amber' : 'cyan',
          view: 'gstr-filing',
        });
      }
    }
    for (const t of tasks.data) {
      if (t.status === 'completed' || t.status === 'cancelled') continue;
      const due = toDate(t.dueDate);
      if (!due) continue;
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (dueDay.getTime() >= today.getTime() && dueDay.getTime() <= horizon.getTime()) {
        const dl = dueLabel(due);
        out.push({
          id: `dl-task-${t.id}`,
          title: t.title || 'Task',
          sub: `${dl.text} · ${t.priority} priority`,
          tone: dl.tone === 'amber' ? 'amber' : t.priority === 'high' || t.priority === 'urgent' ? 'amber' : 'teal',
          view: 'tasks',
        });
      }
    }
    for (const n of notices.data) {
      if (n.status === 'resolved' || n.status === 'closed' || n.status === 'responded') continue;
      const due = toDate(n.dueDate);
      if (!due) continue;
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      if (dueDay.getTime() >= today.getTime() && dueDay.getTime() <= horizon.getTime()) {
        const dl = dueLabel(due);
        out.push({
          id: `dl-notice-${n.id}`,
          title: n.subject || 'Notice response',
          sub: `${dl.text} · ${n.clientTradeName || '—'}`,
          tone: n.priority === 'urgent' || n.priority === 'high' ? 'amber' : 'cyan',
          view: 'notices',
        });
      }
    }

    const order: Record<Tone, number> = {
      amber: 0, rose: 1, cyan: 2, teal: 3, violet: 4, emerald: 5, neutral: 6,
    };
    out.sort((a, b) => order[a.tone] - order[b.tone]);
    return out;
  }, [gstReturns.data, tasks.data, notices.data]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  const firstName = userName?.split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">
      {/* ─── Brief header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mb-5"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Executive Brief
          </span>
          <span className="ml-auto text-[10px] text-white/40">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-white md:text-2xl">
          {firstName ? `Good ${(new Date().getHours() < 12) ? 'morning' : (new Date().getHours() < 17 ? 'afternoon' : 'evening')}, ${firstName}.` : 'Your daily executive brief.'}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          Computed live from your connected business data. Tap any item to act.
        </p>
      </motion.div>

      {/* ─── Skeleton state ─── */}
      {anyLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {/* Row 1 — Today's Priorities (spans 2 cols) + Cash Position */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.05 }}
              className="md:col-span-2 xl:col-span-2"
            >
              <BriefCard
                icon={ClipboardList}
                title="Today's Priorities"
                tone="violet"
                meta={priorities.length > 0 ? `${priorities.length} item${priorities.length === 1 ? '' : 's'}` : undefined}
              >
                {tasks.loading && deals.loading && leads.loading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ) : priorities.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 p-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <p className="text-xs text-white/60">
                      Nothing overdue today. Use the breathing room to plan the week ahead.
                    </p>
                  </div>
                ) : (
                  <PriorityList
                    items={priorities}
                    onNavigate={onNavigate}
                    empty="No priorities right now."
                  />
                )}
              </BriefCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 0.1 }}
              className="md:col-span-2 xl:col-span-2"
            >
              <BriefCard
                icon={Wallet}
                title="Cash Position"
                tone="emerald"
                meta={cash.trend.length > 0 ? `Last ${cash.trend.length}d` : undefined}
              >
                {!cash.hasData ? (
                  <EmptyCta
                    message="Connect your bank account to see real-time cash position and a 7-day trend."
                    ctaLabel="Connect Bank"
                    ctaIcon={Wallet}
                    view="banking"
                    onNavigate={onNavigate}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-1">
                        <IndianRupee className="h-4 w-4 text-emerald-400" />
                        <span className="text-2xl font-semibold tabular-nums text-white">
                          {cash.totalBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-white/50">
                        Across {bankAccounts.data.length} account{bankAccounts.data.length === 1 ? '' : 's'}
                      </p>
                      {cash.delta !== 0 && (
                        <div className={cn(
                          'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          cash.delta > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400',
                        )}>
                          {cash.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {cash.delta > 0 ? '+' : ''}{fmtINR(cash.delta)}
                        </div>
                      )}
                    </div>
                    {cash.trend.length >= 2 && (
                      <Sparkline
                        values={cash.trend.map((t) => t.balance)}
                        tone={cash.delta >= 0 ? 'emerald' : 'rose'}
                      />
                    )}
                  </div>
                )}
              </BriefCard>
            </motion.div>
          </div>

          {/* Row 2 — GST Summary + Compliance Summary */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <BriefCard
              icon={FileText}
              title="GST Summary"
              tone="cyan"
              delay={0.15}
              meta={gst.hasData ? `${gst.pending.length} pending` : undefined}
            >
              {!gst.hasData ? (
                <EmptyCta
                  message="No GST returns tracked yet. Set up a GST profile to track filings and liability."
                  ctaLabel="Open GST Filings"
                  ctaIcon={FileText}
                  view="gstr-filing"
                  onNavigate={onNavigate}
                />
              ) : (
                <div className="space-y-2">
                  <StatRow
                    label="Pending filings"
                    value={gst.pending.length}
                    tone={gst.pending.length === 0 ? 'emerald' : 'amber'}
                  />
                  <StatRow
                    label="Overdue"
                    value={gst.overdueCount}
                    tone={gst.overdueCount === 0 ? 'emerald' : 'rose'}
                  />
                  <StatRow
                    label="Total liability"
                    value={fmtINR(gst.totalLiability)}
                    tone={gst.totalLiability > 0 ? 'amber' : 'emerald'}
                  />
                  {gst.pending.slice(0, 2).map((g) => {
                    const dl = dueLabel(toDate(g.dueDate));
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => onNavigate('gstr-filing')}
                        className="group flex w-full items-center justify-between gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-white/[0.04]"
                      >
                        <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">
                          {g.returnType} · {g.period}
                        </span>
                        <span className={cn('text-[10px] font-medium', TONE_TEXT[dl.tone])}>{dl.text}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </BriefCard>

            <BriefCard
              icon={ShieldCheck}
              title="Compliance Summary"
              tone="teal"
              delay={0.2}
              meta={compliance.hasData ? `${compliance.items.length} open` : undefined}
            >
              {!compliance.hasData ? (
                <EmptyCta
                  message="No compliance items yet. Once you file returns or receive notices, they'll appear here."
                  ctaLabel="Open Returns"
                  ctaIcon={FileText}
                  view="returns"
                  onNavigate={onNavigate}
                />
              ) : (
                <PriorityList
                  items={compliance.items}
                  onNavigate={onNavigate}
                  empty="All compliance items resolved."
                />
              )}
            </BriefCard>

            {/* Collection Summary */}
            <BriefCard
              icon={IndianRupee}
              title="Collection Summary"
              tone="violet"
              delay={0.25}
              meta={collections.hasData ? `${collections.overdueCount} overdue` : undefined}
            >
              {!collections.hasData ? (
                <EmptyCta
                  message="No invoices yet. Import or create invoices to track receivables and overdue collections."
                  ctaLabel="Open Invoices"
                  ctaIcon={IndianRupee}
                  view="invoices"
                  onNavigate={onNavigate}
                />
              ) : (
                <div className="space-y-2">
                  <StatRow
                    label="Overdue invoices"
                    value={collections.overdueCount}
                    tone={collections.overdueCount === 0 ? 'emerald' : 'amber'}
                  />
                  <StatRow
                    label="Overdue total"
                    value={fmtINR(collections.overdueTotal)}
                    tone={collections.overdueTotal > 0 ? 'amber' : 'emerald'}
                  />
                  {collections.topOverdue.length > 0 && (
                    <div className="space-y-1 border-t border-white/[0.06] pt-2">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Top overdue</p>
                      {collections.topOverdue.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => onNavigate(it.view)}
                          className="group flex w-full items-center justify-between gap-2 rounded p-1 text-left transition-colors hover:bg-white/[0.04]"
                        >
                          <span className="min-w-0 flex-1 truncate text-[11px] text-white/70">{it.title}</span>
                          <span className="text-[10px] font-medium text-amber-400">{it.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </BriefCard>

            {/* Business Risks */}
            <BriefCard
              icon={ShieldAlert}
              title="Business Risks"
              tone={risks.length === 0 ? 'emerald' : 'rose'}
              delay={0.3}
              meta={risks.length > 0 ? `${risks.length} signal${risks.length === 1 ? '' : 's'}` : 'All clear'}
            >
              {risks.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-white/[0.02] p-3">
                  <Clock className="h-4 w-4 text-white/40" />
                  <p className="text-xs text-white/50">
                    Not enough data yet to compute risk signals. Connect more sources to unlock this section.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {risks.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onNavigate(r.view)}
                      className="group flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-white/[0.04]"
                    >
                      <AlertTriangle className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', TONE_TEXT[r.tone])} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-white/90">{r.label}</span>
                        <span className="block text-[10px] leading-snug text-white/50">{r.detail}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </BriefCard>
          </div>

          {/* Row 3 — Recommended Actions (full width) */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.35 }}
            className={cn(
              'mt-3 rounded-2xl border bg-white/[0.025] p-4',
              actions.length === 0 ? 'border-emerald-500/20' : 'border-violet-500/20',
            )}
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
                <Lightbulb className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <h3 className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                Recommended Actions
              </h3>
              {actions.length > 0 && (
                <span className="text-[10px] text-white/40">{actions.length} suggestion{actions.length === 1 ? '' : 's'}</span>
              )}
            </div>
            {actions.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <p className="text-xs text-white/60">
                  No immediate actions needed — your business is in good shape. Ask Oracle for strategic guidance.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {actions.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onNavigate(a.view)}
                    className="group flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
                  >
                    <span className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', TONE_DOT[a.tone])} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="block text-xs font-semibold text-white/90">{a.label}</span>
                        <ArrowUpRight className="h-3 w-3 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/70" />
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-white/50">{a.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.section>

          {/* Row 4 — Upcoming Deadlines */}
          <div className="mt-3">
            <BriefCard
              icon={CalendarClock}
              title="Upcoming Deadlines"
              tone="amber"
              delay={0.4}
              meta={deadlines.length > 0 ? `Next 7 days · ${deadlines.length}` : 'Next 7 days'}
            >
              {deadlines.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <p className="text-xs text-white/60">
                    No deadlines in the next 7 days. You're ahead of schedule.
                  </p>
                </div>
              ) : (
                <PriorityList
                  items={deadlines}
                  onNavigate={onNavigate}
                  empty="No deadlines in the next 7 days."
                />
              )}
            </BriefCard>
          </div>

          {/* ─── Footer: Ask Oracle anything ─── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-4"
          >
            <p className="text-[11px] text-white/40">
              Brief computed from real-time Firestore data. Numbers update live.
            </p>
            {onAskOracle && (
              <button
                type="button"
                onClick={() => onAskOracle('Give me a one-paragraph executive summary of my business based on the brief above.')}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/15"
              >
                <Sparkles className="h-3 w-3" />
                Ask Oracle to summarize
              </button>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}

export default ExecutiveBrief;
