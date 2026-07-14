'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// ORACLE INTELLIGENCE — Executive Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
// The financial brain of the company. Bloomberg Terminal density + Apple polish
// + Stripe precision. Every number comes from the real database. When the DB
// is empty, a graceful empty state appears — never fake intelligence.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Zap, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock,
  IndianRupee, Users, Building2, Receipt, Send, FileText, Banknote, Database,
  Network, Activity, Sparkles, RefreshCw, ArrowUpRight, ArrowDownRight,
  Command, Send as SendIcon, CornerDownLeft, CircleDollarSign, ShieldAlert,
  Calendar, Hash, type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useOracleDashboard, useOracleCommand } from '@/hooks/useOracleBrain';
import type { OracleDashboardData, CommandResultData } from '@/hooks/useOracleBrain';
import { COMMAND_SUGGESTIONS } from '@/lib/oracle-intelligence/command-center';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

function formatINR(amount: number, compact = false): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (compact) {
    if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
    if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
    if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  }
  return `${sign}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(abs)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const severityConfig: Record<string, { color: string; bg: string; border: string; icon: LucideIcon }> = {
  critical: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', icon: ShieldAlert },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: AlertTriangle },
  positive: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2 },
  neutral: { color: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-500/30', icon: Activity },
};

const categoryIcon: Record<string, LucideIcon> = {
  cash_flow: CircleDollarSign,
  receivables: Receipt,
  payables: Building2,
  gst: FileText,
  customer: Users,
  vendor: Building2,
  expense: IndianRupee,
  compliance: ShieldAlert,
};

const timelineIcon: Record<string, LucideIcon> = {
  invoice_created: FileText,
  invoice_paid: CheckCircle2,
  payment_received: ArrowDownRight,
  payment_sent: ArrowUpRight,
  expense_recorded: IndianRupee,
  purchase_recorded: Receipt,
  gst_filed: CheckCircle2,
  gst_prepared: FileText,
  email_sent: Send,
  tds_deducted: Banknote,
  bank_transaction: CircleDollarSign,
  bank_synced: RefreshCw,
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sublabel, icon: Icon, trend, accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'emerald' | 'rose' | 'amber' | 'sky';
}) {
  const accentMap = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    sky: 'text-sky-300',
  };
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-white/40';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-4"
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</span>
        <Icon className={`h-4 w-4 ${accent ? accentMap[accent] : 'text-white/40'}`} />
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white tabular-nums">
        {value}
      </div>
      {sublabel && (
        <div className={`mt-1 text-xs ${trendColor} flex items-center gap-1`}>
          {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
          {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
          {sublabel}
        </div>
      )}
    </motion.div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: OracleDashboardData['reasoning']['insights'][number] }) {
  const cfg = severityConfig[insight.severity] || severityConfig.neutral;
  const Icon = categoryIcon[insight.category] || Activity;
  const SevIcon = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <SevIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {insight.category.replace('_', ' ')}
            </span>
            {insight.metric !== undefined && (
              <Badge variant="outline" className="ml-auto border-white/10 bg-white/5 font-mono text-[10px] text-white/60">
                {insight.metric} {insight.metricLabel}
              </Badge>
            )}
          </div>
          <h4 className="mt-1.5 text-sm font-semibold leading-snug text-white">
            {insight.headline}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            {insight.detail}
          </p>
          {insight.recommendation && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1.5">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
              <span className="text-xs text-white/70">{insight.recommendation}</span>
            </div>
          )}
          {insight.sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {insight.sources.slice(0, 5).map((s, i) => (
                <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/35">
                  {s.kind}:{s.label.slice(0, 12)}
                </span>
              ))}
              {insight.sources.length > 5 && (
                <span className="text-[10px] text-white/30">+{insight.sources.length - 5} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Command Center ───────────────────────────────────────────────────────────

function CommandCenter() {
  const { result, loading, runCommand } = useOracleCommand();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    runCommand(input);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2">
        <Command className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Command Center</h3>
        <span className="text-[10px] text-white/30">Natural language → real data</span>
      </div>
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Oracle anything… e.g. Who owes me more than ₹5 lakh?"
            className="border-white/10 bg-white/5 pr-9 font-medium text-white placeholder:text-white/30 focus-visible:border-emerald-500/40"
            disabled={loading}
          />
          {!loading && (
            <CornerDownLeft className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
          )}
        </div>
        <Button type="submit" disabled={loading || !input.trim()} className="bg-emerald-500 text-black hover:bg-emerald-400">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COMMAND_SUGGESTIONS.slice(0, 5).map((s) => (
          <button
            key={s}
            onClick={() => { setInput(s); runCommand(s); }}
            disabled={loading}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/50 transition hover:border-emerald-500/30 hover:text-white/80"
          >
            {s}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {result && <CommandResult result={result} />}
      </AnimatePresence>
    </div>
  );
}

function CommandResult({ result }: { result: CommandResultData }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 overflow-hidden"
    >
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/70">
            Oracle • {result.durationMs}ms
          </span>
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          Interpreted: <span className="text-white/60">{result.interpreted}</span>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-white/90">{result.answer}</p>
        {result.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[10px] text-white/30">Sources:</span>
            {result.sources.slice(0, 8).map((s, i) => (
              <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40">
                {s.kind}:{s.label.slice(0, 14)}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function TimelineView({ events }: { events: OracleDashboardData['timeline']['events'] }) {
  const [visible, setVisible] = useState(15);
  const shown = events.slice(0, visible);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Unified Timeline</h3>
          <span className="text-[10px] text-white/30">{events.length} events</span>
        </div>
      </div>
      <div className="mt-4 max-h-[420px] space-y-1 overflow-y-auto pr-2 oracle-scroll">
        {shown.map((ev) => {
          const Icon = timelineIcon[ev.kind] || Activity;
          const isCredit = ev.kind === 'payment_received' || ev.kind === 'invoice_paid' || (ev.kind === 'bank_transaction' && ev.amount && ev.amount > 0);
          return (
            <div key={ev.id} className="flex gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]">
              <div className="flex flex-col items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-white/50'}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="mt-1 w-px flex-1 bg-white/5" />
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-white/85">{ev.title}</span>
                  {ev.amount !== undefined && ev.amount > 0 && (
                    <span className={`shrink-0 font-mono text-xs tabular-nums ${isCredit ? 'text-emerald-400' : 'text-white/60'}`}>
                      {formatINR(ev.amount, true)}
                    </span>
                  )}
                </div>
                <p className="truncate text-[11px] text-white/40">{ev.description}</p>
                <span className="text-[10px] text-white/25">
                  {new Date(ev.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        {visible < events.length && (
          <button
            onClick={() => setVisible((v) => v + 20)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2 text-xs text-white/50 transition hover:bg-white/5"
          >
            Load {Math.min(20, events.length - visible)} more
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Memory & Graph Stats ─────────────────────────────────────────────────────

function MemoryPanel({ data }: { data: OracleDashboardData }) {
  const { counts, financials } = data.memory;
  const items = [
    { label: 'Invoices', count: counts.invoice || 0, icon: FileText, value: financials.totalSalesInvoiced },
    { label: 'Customers', count: counts.customer || 0, icon: Users, value: null },
    { label: 'Vendors', count: counts.vendor || 0, icon: Building2, value: financials.totalPayables },
    { label: 'Payments', count: counts.payment || 0, icon: Banknote, value: financials.totalCollected },
    { label: 'Expenses', count: counts.expense || 0, icon: IndianRupee, value: financials.totalExpenses },
    { label: 'GST Returns', count: counts.gst || 0, icon: FileText, value: financials.totalGstCollected },
    { label: 'Bank Txns', count: counts.bank || 0, icon: CircleDollarSign, value: financials.totalBankBalance },
    { label: 'TDS', count: counts.tds || 0, icon: Receipt, value: financials.totalTdsDeducted },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Memory Engine</h3>
        <span className="text-[10px] text-white/30">{data.memory.totalRecords} records remembered</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/35">{it.label}</span>
              <it.icon className="h-3 w-3 text-white/30" />
            </div>
            <div className="mt-0.5 font-mono text-lg font-semibold text-white tabular-nums">{it.count}</div>
            {it.value !== null && it.value > 0 && (
              <div className="text-[10px] text-white/40">{formatINR(it.value, true)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphPanel({ data }: { data: OracleDashboardData }) {
  const { stats } = data.graph;
  const edgeKinds = useMemo(() => {
    const entries = Object.entries(stats.byKind).filter(([k]) =>
      ['owns', 'settled_by', 'supplied', 'paid_to', 'incurred', 'filed', 'emailed', 'deducted_for', 'transacted_on'].includes(k),
    );
    return entries.sort((a, b) => b[1] - a[1]);
  }, [stats]);
  const maxEdge = edgeKinds.length > 0 ? edgeKinds[0][1] : 1;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Business Graph</h3>
        <span className="text-[10px] text-white/30">{stats.totalNodes} nodes • {stats.totalEdges} edges</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {edgeKinds.length === 0 && <p className="text-xs text-white/30">No relationships yet. Create invoices and payments to build the graph.</p>}
        {edgeKinds.map(([kind, count]) => (
          <div key={kind} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-white/40">{kind.replace('_', ' ')}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(count / maxEdge) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-400"
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[10px] text-white/50 tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
        <Brain className="h-8 w-8 text-emerald-400/60" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-white">Oracle is awake. Awaiting data.</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/45">
        Oracle&apos;s financial brain is connected to your database, but no business records
        were found yet. Create invoices, record payments, or add customers to awaken
        Oracle&apos;s intelligence. Every insight will be traceable to a real record.
      </p>
      <div className="mt-5 flex gap-2">
        <Button onClick={onRefresh} variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Re-scan database
        </Button>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-3 text-left">
        {[
          { icon: FileText, label: 'Invoices', desc: 'Issue your first invoice' },
          { icon: Users, label: 'Customers', desc: 'Add a client record' },
          { icon: Banknote, label: 'Payments', desc: 'Record a payment' },
        ].map((it) => (
          <div key={it.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <it.icon className="h-4 w-4 text-white/30" />
            <div className="mt-1.5 text-xs font-medium text-white/70">{it.label}</div>
            <div className="text-[10px] text-white/30">{it.desc}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Loading State ────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5"
      >
        <Brain className="h-7 w-7 text-emerald-400" />
      </motion.div>
      <p className="mt-4 text-sm text-white/50">Oracle is reading your business…</p>
      <div className="mt-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function OracleBrainDashboard() {
  const { data, loading, error, refreshing, refresh } = useOracleDashboard();

  if (loading) return <LoadingState />;
  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <ShieldAlert className="h-10 w-10 text-rose-400" />
        <p className="mt-3 text-sm text-white/60">Oracle encountered an error: {error}</p>
        <Button onClick={refresh} className="mt-4 bg-emerald-500 text-black hover:bg-emerald-400">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
              <Brain className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                Oracle Intelligence
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                  Live
                </span>
              </h1>
              <p className="text-xs text-white/40">
                The financial brain • {data.memory.totalRecords} records • {data.reasoning.dataPoints} data points analysed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">
              {refreshing ? 'Refreshing…' : `Updated ${timeAgo(data.generatedAt)}`}
            </span>
            <Button
              onClick={refresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </motion.header>

        {data.empty ? (
          <EmptyState onRefresh={refresh} />
        ) : (
          <div className="space-y-5">
            {/* ── Executive Summary ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-white/[0.02] to-transparent p-5"
            >
              <div className="absolute right-0 top-0 h-32 w-32 -translate-y-12 translate-x-12 rounded-full bg-emerald-500/5 blur-3xl" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">Executive Brief</h2>
                    <span className="text-[10px] text-white/30">Grounded in {data.reasoning.dataPoints} real records</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                    {data.reasoning.executiveSummary}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── KPI Strip ── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="Revenue (30d)" value={formatINR(data.kpis.revenue30d, true)} icon={TrendingUp} accent="emerald" sublabel="invoiced" trend="up" />
              <KpiCard label="Collected (30d)" value={formatINR(data.kpis.collected30d, true)} icon={ArrowDownRight} accent="emerald" sublabel="received" trend="up" />
              <KpiCard label="Outstanding" value={formatINR(data.kpis.outstandingNow, true)} icon={Receipt} accent="sky" sublabel="awaiting payment" />
              <KpiCard label="Overdue" value={formatINR(data.kpis.overdueNow, true)} icon={AlertTriangle} accent={data.kpis.overdueNow > 0 ? 'rose' : 'emerald'} sublabel={data.kpis.overdueNow > 0 ? 'needs attention' : 'all clear'} />
              <KpiCard label="Expenses (30d)" value={formatINR(data.kpis.expenses30d, true)} icon={IndianRupee} accent="amber" sublabel="spent" trend="down" />
              <KpiCard label="GST (this month)" value={formatINR(data.kpis.gstThisMonth, true)} icon={FileText} accent={data.kpis.gstThisMonth > 0 ? 'amber' : 'emerald'} sublabel={data.kpis.gstThisMonth >= 0 ? 'payable' : 'refundable'} />
              <KpiCard label="Cash Runway" value={data.kpis.cashRunwayDays !== null ? `${data.kpis.cashRunwayDays}d` : '∞'} icon={Clock} accent={data.kpis.cashRunwayDays !== null && data.kpis.cashRunwayDays < 30 ? 'rose' : 'emerald'} sublabel="at current burn" />
              <KpiCard label="Avg Pay Delay" value={`${data.kpis.avgPaymentDelayDays}d`} icon={Clock} accent={data.kpis.avgPaymentDelayDays > 7 ? 'amber' : 'emerald'} sublabel="customers pay late by" />
              <KpiCard label="Active Customers" value={`${data.kpis.activeCustomers}`} icon={Users} accent="sky" sublabel="clients" />
              <KpiCard label="Active Vendors" value={`${data.kpis.activeVendors}`} icon={Building2} accent="sky" sublabel="suppliers" />
            </div>

            {/* ── Main grid: Insights + Side column ── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Insights (spans 2) */}
              <div className="lg:col-span-2 space-y-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-white">Reasoning Engine</h3>
                      <span className="text-[10px] text-white/30">{data.reasoning.insights.length} conclusions</span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {data.reasoning.insights.length === 0 ? (
                      <div className="col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center">
                        <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400/50" />
                        <p className="mt-2 text-xs text-white/40">No critical patterns detected. Oracle is monitoring.</p>
                      </div>
                    ) : (
                      data.reasoning.insights.map((ins) => <InsightCard key={ins.id} insight={ins} />)
                    )}
                  </div>
                </div>

                <CommandCenter />
              </div>

              {/* Side column */}
              <div className="space-y-5">
                <MemoryPanel data={data} />
                <GraphPanel data={data} />
              </div>
            </div>

            {/* ── Timeline (full width) ── */}
            <TimelineView events={data.timeline.events} />
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="mt-8 border-t border-white/5 pt-4 text-center">
          <p className="text-[10px] text-white/25">
            Oracle Intelligence • Every number traceable to a real database record • No fabricated analytics
          </p>
        </footer>
      </div>
    </div>
  );
}

export default OracleBrainDashboard;
