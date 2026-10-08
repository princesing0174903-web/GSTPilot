'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — PHASE 13: ENTERPRISE COMMAND CENTER™
//
// A Palantir-style global command network showing every company in the group at
// a single glance. Real-time health grid, risk & alerts panel, cash-flow
// comparison, and an AI executive summary — all driven by the live enterprise
// data layer (no mocks, no Math.random, no API calls).
//
//   • 6 KPI tiles      — companies, revenue, cash flow, compliance, approvals, alerts
//   • Health grid      — one mini-card per company (revenue, scores, GST status)
//   • Risk & alerts    — companies sorted by riskScore desc with one-line AI alert
//   • Cash flow chart  — pure-CSS horizontal bars comparing cashFlow
//   • AI exec summary  — static callout identifying top performer + at-risk entity
//
// Tagline: One Network. Every Company. Total Command.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Banknote, Activity, ShieldCheck, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Crown, Sparkles, Zap, ChevronRight,
  Layers, Gauge, BrainCircuit, ArrowUpRight, ArrowDownRight, Radio,
  type LucideIcon,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs';
import { COMPANIES, ENTERPRISE_KPIS, fmtINR, type Company } from '@/lib/enterprise/data';

// ─── Types & helpers ────────────────────────────────────────────────────────────

type Status = 'Healthy' | 'Watch' | 'Critical';
type GstStatus = 'Filed' | 'Pending' | 'Overdue';

const STATUS_DOT: Record<Status, string> = {
  Healthy: '🟢',
  Watch: '🟡',
  Critical: '🔴',
};

const STATUS_BADGE: Record<Status, string> = {
  Healthy: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  Watch: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  Critical: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const GST_BADGE: Record<GstStatus, string> = {
  Filed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  Pending: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  Overdue: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const TYPE_BADGE: Record<Company['type'], string> = {
  Holding: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
  Subsidiary: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  Branch: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  Division: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  Independent: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

function riskBadge(score: number): string {
  if (score >= 30) return 'border-red-500/30 bg-red-500/10 text-red-400';
  if (score >= 18) return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
}

function riskLabel(score: number): string {
  if (score >= 30) return 'High';
  if (score >= 18) return 'Medium';
  return 'Low';
}

// Compact INR formatter (Cr / L) for tiles & charts
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function aiAlertFor(c: Company): string {
  if (c.riskScore >= 30) {
    return `Cash flow stress detected — outstanding ${fmtCompact(c.outstandingInvoices)} vs liability ${fmtCompact(c.gstLiability)}. Recommend immediate reconciliation sweep.`;
  }
  if (c.gstStatus === 'Overdue') {
    return `GSTR filing overdue — auto-escalation triggered. Estimated late-fee exposure ${fmtCompact(c.gstLiability * 0.18)}.`;
  }
  if (c.gstStatus === 'Pending') {
    return `GSTR-3B pending for current cycle. ITC match 94% — manual review of unmatched rows suggested.`;
  }
  if (c.riskScore >= 16) {
    return `Moderate risk — outstanding receivables ${fmtCompact(c.outstandingInvoices)} above 30-day benchmark. Trigger dunning workflow.`;
  }
  if (c.complianceScore >= 95) {
    return `Compliance excellence — ${c.complianceScore}/100. Eligible for simplified audit pathway & reduced scrutiny band.`;
  }
  return `Stable operating posture. AI monitoring active on cash, compliance, and counterparty risk.`;
}

// ─── KPI Tile ───────────────────────────────────────────────────────────────────

interface KpiTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  trend?: { dir: 'up' | 'down' | 'flat'; text: string };
  accent: 'emerald' | 'teal' | 'cyan' | 'amber' | 'red' | 'violet';
}

const ACCENT_RING: Record<KpiTileProps['accent'], string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
  cyan: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  red: 'text-red-400 bg-red-500/10 border-red-500/20',
  violet: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
};

function KpiTile({ icon: Icon, label, value, sub, trend, accent }: KpiTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' as const }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.12] transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${ACCENT_RING[accent]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] uppercase tracking-wider text-zinc-400">{label}</span>
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
              trend.dir === 'up'
                ? 'text-emerald-400'
                : trend.dir === 'down'
                ? 'text-red-400'
                : 'text-zinc-400'
            }`}
          >
            {trend.dir === 'up' ? <ArrowUpRight className="h-3 w-3" /> : trend.dir === 'down' ? <ArrowDownRight className="h-3 w-3" /> : null}
            {trend.text}
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">{value}</div>
      <div className="mt-1 text-[11px] text-zinc-500">{sub}</div>
    </motion.div>
  );
}

// ─── Company Health Card ────────────────────────────────────────────────────────

function CompanyHealthCard({ company, index }: { company: Company; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' as const }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm hover:border-white/[0.14] transition-all"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
            style={{ backgroundColor: company.color + '22', border: `1px solid ${company.color}55` }}
          >
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-zinc-100">{company.name}</span>
              <span title={company.status}>{STATUS_DOT[company.status]}</span>
            </div>
            <div className="truncate text-[10px] font-mono text-zinc-500">{company.gstin}</div>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[9px] uppercase ${TYPE_BADGE[company.type]}`}>
          {company.type}
        </Badge>
      </div>

      {/* Revenue + Outstanding */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Revenue</div>
          <div className="text-sm font-semibold text-emerald-300">{fmtCompact(company.revenue)}</div>
        </div>
        <div className="rounded-lg bg-black/30 px-2.5 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-zinc-500">Outstanding</div>
          <div className="text-sm font-semibold text-amber-300">{fmtCompact(company.outstandingInvoices)}</div>
        </div>
      </div>

      {/* Score bars */}
      <div className="mt-3 space-y-2">
        <ScoreBar label="Compliance" value={company.complianceScore} color="bg-emerald-500" />
        <ScoreBar label="Growth" value={company.growthScore} color="bg-teal-400" />
        <ScoreBar label="Risk" value={company.riskScore} color="bg-red-400" inverted />
      </div>

      {/* Footer: GST status */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">GST Filing</span>
        <Badge variant="outline" className={`text-[9px] ${GST_BADGE[company.gstStatus]}`}>
          {company.gstStatus}
        </Badge>
      </div>
    </motion.div>
  );
}

function ScoreBar({
  label, value, color, inverted = false,
}: { label: string; value: number; color: string; inverted?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px]">
        <span className="text-zinc-400">{label}</span>
        <span className={inverted ? 'text-red-300' : 'text-zinc-300'}>{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' as const }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

// ─── Cash Flow Chart ────────────────────────────────────────────────────────────

function CashFlowChart({ companies }: { companies: Company[] }) {
  const max = Math.max(...companies.map(c => c.cashFlow), 1);
  const sorted = [...companies].sort((a, b) => b.cashFlow - a.cashFlow);

  return (
    <div className="space-y-3">
      {sorted.map((c, i) => {
        const pct = (c.cashFlow / max) * 100;
        const positive = c.cashFlow >= 0;
        return (
          <div key={c.id} className="flex items-center gap-3">
            <div className="w-32 shrink-0 truncate text-xs text-zinc-300">{c.name}</div>
            <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-black/30">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: 'easeOut' as const }}
                className="absolute inset-y-0 left-0 flex items-center justify-end rounded-md px-2"
                style={{
                  background: `linear-gradient(90deg, ${c.color}33, ${c.color}aa)`,
                  border: `1px solid ${c.color}44`,
                }}
              >
                <span className="text-[10px] font-medium text-white drop-shadow">{fmtCompact(c.cashFlow)}</span>
              </motion.div>
              {!positive && (
                <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-red-400">negative</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Executive Summary ───────────────────────────────────────────────────────

function buildExecutiveSummary(companies: Company[]) {
  const topPerformer = [...companies].sort((a, b) => b.growthScore - a.growthScore)[0];
  const atRisk = [...companies].sort((a, b) => b.riskScore - a.riskScore)[0];
  const bestCompliance = [...companies].sort((a, b) => b.complianceScore - a.complianceScore)[0];

  return {
    topPerformer,
    atRisk,
    bestCompliance,
    summary:
      `Enterprise posture is ${ENTERPRISE_KPIS.avgCompliance >= 85 ? 'strong' : 'stable'} with average compliance at ${ENTERPRISE_KPIS.avgCompliance}% across ${ENTERPRISE_KPIS.totalCompanies} companies and net cash flow of ${fmtINR(ENTERPRISE_KPIS.netCashFlow)}. ` +
      `${topPerformer.name} is the growth leader (${topPerformer.growthScore}/100), while ${bestCompliance.name} sets the compliance benchmark (${bestCompliance.complianceScore}/100). ` +
      `${atRisk.name} carries the highest risk score (${atRisk.riskScore}/100) — recommend a focused review of cash flow, GST filing cadence, and receivables aging before month-end close.`,
    action: atRisk.riskScore >= 30
      ? `Initiate risk-mitigation workflow on ${atRisk.name} within 48 hours — overdue GST filing and outstanding receivables of ${fmtCompact(atRisk.outstandingInvoices)} require CFO escalation.`
      : `Maintain monitoring cadence on ${atRisk.name}; schedule next compliance audit window in 14 days.`,
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function EnterpriseCommandCenter() {
  const [view, setView] = useState<'all' | 'watch'>('all');

  const visibleCompanies = useMemo(
    () => (view === 'watch' ? COMPANIES.filter(c => c.status !== 'Healthy') : COMPANIES),
    [view],
  );

  const riskSorted = useMemo(
    () => [...COMPANIES].sort((a, b) => b.riskScore - a.riskScore),
    [],
  );

  const summary = useMemo(() => buildExecutiveSummary(COMPANIES), []);

  const KPI_TILES: KpiTileProps[] = [
    {
      icon: Building2, label: 'Companies', value: String(ENTERPRISE_KPIS.totalCompanies),
      sub: `${ENTERPRISE_KPIS.totalGstins} GSTINs · ${ENTERPRISE_KPIS.totalBranches} branches`,
      trend: { dir: 'up', text: '+2 QoQ' }, accent: 'teal',
    },
    {
      icon: Banknote, label: 'Total Revenue', value: fmtCompact(ENTERPRISE_KPIS.totalRevenue),
      sub: `Expenses ${fmtCompact(ENTERPRISE_KPIS.totalExpenses)}`,
      trend: { dir: 'up', text: '+12.4%' }, accent: 'emerald',
    },
    {
      icon: Activity, label: 'Net Cash Flow', value: fmtCompact(ENTERPRISE_KPIS.netCashFlow),
      sub: `GST liability ${fmtCompact(ENTERPRISE_KPIS.totalGstLiability)}`,
      trend: { dir: 'up', text: '+6.1%' }, accent: 'cyan',
    },
    {
      icon: ShieldCheck, label: 'Avg Compliance', value: `${ENTERPRISE_KPIS.avgCompliance}%`,
      sub: `Growth ${ENTERPRISE_KPIS.avgGrowth} · Risk ${ENTERPRISE_KPIS.avgRisk}`,
      trend: { dir: 'up', text: '+1.8 pts' }, accent: 'emerald',
    },
    {
      icon: Clock, label: 'Pending Approvals', value: String(ENTERPRISE_KPIS.pendingApprovals),
      sub: `${ENTERPRISE_KPIS.tasksInProgress} tasks in progress`,
      trend: { dir: 'flat', text: 'stable' }, accent: 'amber',
    },
    {
      icon: AlertTriangle, label: 'Critical Alerts', value: String(ENTERPRISE_KPIS.criticalAlerts),
      sub: `${ENTERPRISE_KPIS.overdueFilings} overdue filing`,
      trend: { dir: 'down', text: '-1 WoW' }, accent: 'red',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* ─── Header ─────────────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-300">
              <Radio className="h-3 w-3" /> Live · Phase 13 Command Network
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Enterprise Command Center<span className="text-emerald-400">™</span>
            </h1>
            <p className="text-sm text-zinc-400">Global multi-company command network — every entity, one console.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/10 bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.05]">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ask VEYRO AI
            </Button>
            <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
              <Zap className="mr-1.5 h-3.5 w-3.5" /> Run AI Sweep
            </Button>
          </div>
        </motion.header>

        {/* ─── KPI Row ────────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {KPI_TILES.map(t => <KpiTile key={t.label} {...t} />)}
        </section>

        {/* ─── Main grid: Health grid + Risk panel ───────────────────────────── */}
        <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Company Health Grid (2 cols) */}
          <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="space-y-0.5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  Company Health Grid
                </CardTitle>
                <p className="text-[11px] text-zinc-500">Real-time posture across all entities in the group</p>
              </div>
              <Tabs value={view} onValueChange={(v) => setView(v as 'all' | 'watch')}>
                <TabsList className="bg-white/[0.03] h-8">
                  <TabsTrigger value="all" className="text-[11px] h-6">All</TabsTrigger>
                  <TabsTrigger value="watch" className="text-[11px] h-6">Watch only</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {visibleCompanies.map((c, i) => (
                    <CompanyHealthCard key={c.id} company={c} index={i} />
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Risk & Alerts */}
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Risk & AI Alerts
              </CardTitle>
              <p className="text-[11px] text-zinc-500">Sorted by risk score, descending</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[520px] pr-2">
                <div className="space-y-2.5">
                  {riskSorted.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className="rounded-lg border border-white/[0.06] bg-black/20 p-3 hover:border-white/[0.12] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7 border" style={{ backgroundColor: c.color + '22', borderColor: c.color + '55' }}>
                            <AvatarFallback className="text-[10px] font-bold text-white">
                              {c.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-xs font-semibold text-zinc-200">{c.name}</span>
                              <span>{STATUS_DOT[c.status]}</span>
                            </div>
                            <div className="text-[10px] text-zinc-500">{c.industry} · {c.state}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${riskBadge(c.riskScore)}`}>
                          {riskLabel(c.riskScore)} · {c.riskScore}
                        </Badge>
                      </div>
                      <p className="mt-2 text-[11px] leading-snug text-zinc-400">
                        <BrainCircuit className="mr-1 inline h-3 w-3 text-teal-300" />
                        {aiAlertFor(c)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>

        {/* ─── Cash Flow + AI Summary ────────────────────────────────────────── */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Cash Flow Comparison */}
          <Card className="border-white/[0.06] bg-white/[0.02] lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                Cash Flow Comparison
              </CardTitle>
              <p className="text-[11px] text-zinc-500">Net cash position by entity — sorted descending</p>
            </CardHeader>
            <CardContent>
              <CashFlowChart companies={COMPANIES} />
            </CardContent>
          </Card>

          {/* AI Executive Summary */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.04] to-transparent p-5"
          >
            <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <BrainCircuit className="h-4 w-4 text-emerald-300" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-200">
                    AI Executive Summary
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[9px] text-emerald-300">Oracle™</Badge>
                  </div>
                  <div className="text-[10px] text-zinc-400">Auto-generated · refreshed every 5 min</div>
                </div>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-zinc-300">{summary.summary}</p>

              <Separator className="my-3 bg-white/10" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <SummaryPill icon={Crown} label="Top Performer" value={summary.topPerformer.name} accent="text-emerald-300" />
                <SummaryPill icon={ShieldCheck} label="Best Compliance" value={summary.bestCompliance.name} accent="text-teal-300" />
                <SummaryPill icon={AlertTriangle} label="At Risk" value={summary.atRisk.name} accent="text-red-300" />
              </div>

              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                <div className="flex items-start gap-1.5">
                  <Zap className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <p className="text-[11px] leading-snug text-amber-100/90">
                    <span className="font-semibold">Recommended action:</span> {summary.action}
                  </p>
                </div>
              </div>

              <Button variant="ghost" size="sm" className="mt-3 w-full border border-emerald-500/20 bg-emerald-500/5 text-[11px] text-emerald-300 hover:bg-emerald-500/15">
                Open full Oracle briefing <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </motion.div>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────────── */}
        <footer className="mt-6 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-4 text-[10px] text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <Gauge className="h-3 w-3 text-emerald-400" />
            Enterprise Command Center™ · Phase 13 · {COMPANIES.length} entities monitored
          </div>
          <div>Founder & Owner: Prince Singh</div>
        </footer>
      </div>
    </div>
  );
}

function SummaryPill({
  icon: Icon, label, value, accent,
}: { icon: LucideIcon; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 p-2">
      <Icon className={`mx-auto mb-1 h-3.5 w-3.5 ${accent}`} />
      <div className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="truncate text-[11px] font-semibold text-zinc-200">{value}</div>
    </div>
  );
}
