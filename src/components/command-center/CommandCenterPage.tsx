'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot™ — COMMAND CENTER™
// The Ultimate Layer of the Autonomous Business Operating System™
//
// "Good Morning 👋" Morning Brief + 5 Vitals + Today's Actions +
// 5 Engines (Observation · Decision · Execution · Approval · Learning) +
// 8 AI Agents (CEO · CFO · GST · Analyst · Collections · Compliance · Growth · Legal) +
// Digital Twin scenarios + Prediction Lab horizons
//
// Design: OpenAI + Stripe + Linear + Bloomberg + Ramp
//   • Pure black canvas · white text · blue→purple gradients
//   • Glassmorphism 28px blur · premium-card surfaces
//   • Framer Motion staggered entrance + live pulse indicators
//   • Interactive checklist with progress tracking
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, FileText, ShieldAlert, Sparkles,
  CheckCircle2, Circle, ArrowRight, Activity, Cpu, Brain, Zap,
  ShieldCheck, GraduationCap, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { cn } from '@/lib/utils';

// ─── Motion ───────────────────────────────────────────────────────────────────
const EASE = [0.22, 1, 0.36, 1] as const;
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: EASE } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}
function firstName(name?: string): string {
  if (!name) return 'Operator';
  return name.split(' ')[0];
}
function todayLong(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ─── Data: 5 Vitals (Morning Brief) ───────────────────────────────────────────
interface Vital {
  label: string;
  value: string;
  sub: string;
  trend: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  accent: string;
}
const VITALS: Vital[] = [
  { label: 'Revenue', value: '₹84.6L', sub: '+12.4% MoM', trend: 'up', icon: TrendingUp, accent: 'text-emerald-400' },
  { label: 'Cash', value: '₹2.4Cr', sub: '+3.1% WoW', trend: 'up', icon: Wallet, accent: 'text-cyan-400' },
  { label: 'GST Due', value: '₹12.8L', sub: 'Due 20th', trend: 'neutral', icon: FileText, accent: 'text-amber-400' },
  { label: 'Risk', value: 'Medium', sub: '2 alerts', trend: 'neutral', icon: ShieldAlert, accent: 'text-orange-400' },
  { label: 'Forecast', value: 'Positive', sub: 'Next 90d', trend: 'up', icon: Sparkles, accent: 'text-violet-400' },
];

// ─── Data: Today's Actions (interactive checklist) ────────────────────────────
interface Action {
  id: number;
  label: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  agent: string;
  done: boolean;
}
// INITIAL_ACTIONS — previously a hardcoded mock list of 6 fake actions
// ("Recover ₹4.2L from 3 overdue clients", "File GSTR-3B for Acme Industries",
// "Approve Q3 revenue forecast", "Reconcile ICICI bank statement", etc.).
// Removed during mock-data audit (Task 7). The actions list now starts empty;
// real actions should be sourced from /api/priority-queue or similar.
const INITIAL_ACTIONS: Action[] = [];

// ─── Data: 5 Engines ──────────────────────────────────────────────────────────
interface Engine {
  name: string;
  desc: string;
  status: 'active' | 'monitoring' | 'idle';
  metric: string;
  icon: LucideIcon;
}
const ENGINES: Engine[] = [
  { name: 'Observation Engine', desc: 'Monitors GST, Revenue, Cash, Collections, Expenses, Payroll, Banking, Compliance 24/7', status: 'active', metric: '8 systems live', icon: Activity },
  { name: 'Decision Engine', desc: 'Detects revenue decline, cash shortages, GST risks, vendor failures, collection issues', status: 'active', metric: '3 decisions queued', icon: Brain },
  { name: 'Execution Engine', desc: 'Generates reports, sends reminders, prepares GST returns, creates tasks, schedules meetings', status: 'active', metric: '12 actions today', icon: Zap },
  { name: 'Approval Engine', desc: 'High-risk actions require approval. Low-risk actions execute automatically.', status: 'monitoring', metric: '2 pending approval', icon: ShieldCheck },
  { name: 'Learning Engine', desc: 'Learns user behavior, filing habits, payment patterns, business routines, employee behavior', status: 'active', metric: 'learning continuously', icon: GraduationCap },
];

// ─── Data: 8 AI Agents ────────────────────────────────────────────────────────
interface Agent {
  emoji: string;
  name: string;
  role: string;
  status: 'active' | 'monitoring' | 'idle';
  lastAction: string;
}
const AGENTS: Agent[] = [
  { emoji: '\uD83D\uDC68\u200D\uD83D\uDCBC', name: 'CEO Agent', role: 'Strategic decisions & operations', status: 'active', lastAction: 'Reviewed Q3 expansion plan' },
  { emoji: '\uD83D\uDCB0', name: 'CFO Agent', role: 'Cash flow, profitability, forecasting', status: 'active', lastAction: 'Forecast model updated' },
  { emoji: '\uD83E\uDDFE', name: 'GST Agent', role: 'Returns, ITC, compliance', status: 'monitoring', lastAction: 'GSTR-3B prepped for 4 firms' },
  { emoji: '\uD83D\uDCCA', name: 'Analyst Agent', role: 'Business intelligence & insights', status: 'active', lastAction: 'Revenue anomaly detected' },
  { emoji: '\uD83D\uDCDE', name: 'Collections Agent', role: 'Receivables & payment recovery', status: 'active', lastAction: '3 reminders dispatched' },
  { emoji: '\uD83D\uDEE1\uFE0F', name: 'Compliance Agent', role: 'Regulatory & legal compliance', status: 'monitoring', lastAction: 'ROC deadline tracked' },
  { emoji: '\uD83D\uDCC8', name: 'Growth Agent', role: 'Expansion & opportunity discovery', status: 'idle', lastAction: 'Market scan complete' },
  { emoji: '\u2696\uFE0F', name: 'Legal Agent', role: 'Contracts, notices, disputes', status: 'idle', lastAction: 'Vendor contract reviewed' },
];

// ─── Data: Digital Twin scenarios ─────────────────────────────────────────────
interface Scenario {
  question: string;
  impact: string;
  severity: 'warning' | 'positive' | 'neutral';
}
const SCENARIOS: Scenario[] = [
  { question: 'What happens if sales fall 30%?', impact: 'Cash runway extends to 8 months. GST liability drops to ₹9L.', severity: 'warning' },
  { question: 'What happens if GST rises?', impact: 'Margin compression of 2.1%. Recommend repricing top 12 SKUs.', severity: 'warning' },
  { question: 'What happens if I hire 10 people?', impact: 'Monthly burn +₹6.5L. Profitable again in 5 months.', severity: 'neutral' },
  { question: 'What happens if I expand to 3 new states?', impact: 'Revenue +₹38L/quarter. Compliance load +14 hours/month.', severity: 'positive' },
];

// ─── Data: Prediction Lab horizons ────────────────────────────────────────────
interface Prediction {
  horizon: string;
  revenue: string;
  cashflow: string;
  gst: string;
  confidence: number;
}
const PREDICTIONS: Prediction[] = [
  { horizon: '7 Days', revenue: '₹18.2L', cashflow: '+₹4.1L', gst: '₹3.2L', confidence: 94 },
  { horizon: '30 Days', revenue: '₹78.5L', cashflow: '+₹12.8L', gst: '₹12.8L', confidence: 88 },
  { horizon: '90 Days', revenue: '₹2.4Cr', cashflow: '+₹38.6L', gst: '₹38.4L', confidence: 79 },
  { horizon: '1 Year', revenue: '₹9.8Cr', cashflow: '+₹1.6Cr', gst: '₹1.5Cr', confidence: 67 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CommandCenterPage() {
  const { user } = useAuth();
  const { setCurrentView } = useApp();
  const [actions, setActions] = useState<Action[]>(INITIAL_ACTIONS);
  const [liveClock, setLiveClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const completedCount = actions.filter(a => a.done).length;
  const progressPct = actions.length > 0
    ? Math.round((completedCount / actions.length) * 100)
    : 0;

  const toggleAction = (id: number) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a));
  };

  const name = firstName(user?.name);
  const timeStr = liveClock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8"
    >
      {/* ════════════════════════════════════════════════════════════════════════
          MORNING BRIEF HERO
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-6 backdrop-blur-xl md:p-8">
        {/* Aurora glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-violet-600/20 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-blue-600/20 blur-[100px]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                Morning Brief
              </span>
              <span className="text-[11px] font-medium text-white/40">{todayLong()}</span>
            </div>
            <h1 className="font-semibold tracking-tight text-white" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', lineHeight: 1.1 }}>
              {greeting()}, <span className="brand-text">{name}</span> <span className="inline-block">👋</span>
            </h1>
            <p className="max-w-xl text-sm text-white/50 md:text-base">
              Your Autonomous Business Operating System ran overnight. Here is what it observed, decided, and prepared for you.
            </p>
          </div>

          {/* Live clock + system status */}
          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 text-right backdrop-blur-md">
              <p className="font-mono text-2xl font-semibold tabular-nums text-white">{timeStr}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">System Live · IST</p>
            </div>
          </div>
        </div>

        {/* 5 Vitals */}
        <div className="relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {VITALS.map((v, i) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.5, ease: EASE }}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]', v.accent)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {v.trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                  {v.trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-white/40">{v.label}</p>
                <p className="mt-0.5 text-xl font-semibold tracking-tight text-white">{v.value}</p>
                <p className={cn('text-[11px] font-medium', v.accent)}>{v.sub}</p>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════════════
          TODAY'S ACTIONS + 5 ENGINES (2-column on xl)
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Today's Actions — interactive checklist */}
        <motion.section variants={itemVariants} className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl md:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
                <span className="brand-text">Today&apos;s Actions</span>
              </h2>
              <p className="mt-0.5 text-xs text-white/40">Ranked by the Decision Engine · execute or delegate</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums text-white">{progressPct}%</p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">{completedCount}/{actions.length} done</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full brand-gradient"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: EASE }}
            />
          </div>

          {/* Checklist */}
          <div className="mt-5 space-y-2">
            {actions.map((a, i) => (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.04, duration: 0.4, ease: EASE }}
                onClick={() => toggleAction(a.id)}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200',
                  a.done
                    ? 'border-emerald-500/15 bg-emerald-500/[0.04]'
                    : 'border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.04]',
                )}
              >
                {a.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-white/25 transition-colors group-hover:text-white/50" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-medium', a.done ? 'text-white/40 line-through' : 'text-white')}>
                      {a.label}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">{a.detail}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      a.priority === 'high' && 'bg-red-500/15 text-red-300',
                      a.priority === 'medium' && 'bg-amber-500/15 text-amber-300',
                      a.priority === 'low' && 'bg-white/[0.06] text-white/50',
                    )}>
                      {a.priority}
                    </span>
                    <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/50">
                      {a.agent} Agent
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* 5 Engines */}
        <motion.section variants={itemVariants} className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl md:p-7">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <Cpu className="h-4 w-4 brand-text" />
            <span className="brand-text">5 Engines</span> Running
          </h2>
          <p className="mt-0.5 text-xs text-white/40">The Autonomous Business Operating System™ core loop</p>

          <div className="mt-5 space-y-2.5">
            {ENGINES.map((e, i) => {
              const Icon = e.icon;
              const statusColor = e.status === 'active' ? 'emerald' : e.status === 'monitoring' ? 'amber' : 'white';
              return (
                <motion.div
                  key={e.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.4, ease: EASE }}
                  className="group flex items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-3.5 transition-all duration-200 hover:border-white/[0.10] hover:bg-white/[0.03]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 text-blue-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{e.name}</p>
                      <span className="flex items-center gap-1">
                        <span className="relative flex h-1.5 w-1.5">
                          {e.status !== 'idle' && (
                            <span className={cn(
                              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                              statusColor === 'emerald' && 'bg-emerald-400',
                              statusColor === 'amber' && 'bg-amber-400',
                            )} />
                          )}
                          <span className={cn(
                            'relative inline-flex h-1.5 w-1.5 rounded-full',
                            statusColor === 'emerald' && 'bg-emerald-400',
                            statusColor === 'amber' && 'bg-amber-400',
                            statusColor === 'white' && 'bg-white/40',
                          )} />
                        </span>
                        <span className={cn(
                          'text-[10px] font-semibold uppercase tracking-wider',
                          statusColor === 'emerald' && 'text-emerald-400',
                          statusColor === 'amber' && 'text-amber-400',
                          statusColor === 'white' && 'text-white/40',
                        )}>
                          {e.status}
                        </span>
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">{e.desc}</p>
                    <p className="mt-1.5 text-[11px] font-medium text-white/55">{e.metric}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          8 AI AGENTS — MULTI-AGENT SYSTEM
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.section variants={itemVariants} className="mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl md:p-7">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <span className="brand-text">Multi-Agent System™</span>
            </h2>
            <p className="mt-0.5 text-xs text-white/40">8 specialist AI agents collaborating on your business 24/7</p>
          </div>
          <p className="text-xs text-white/40">All agents collaborate through the Oracle brain</p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {AGENTS.map((a, i) => {
            const statusColor = a.status === 'active' ? 'emerald' : a.status === 'monitoring' ? 'amber' : 'white';
            return (
              <motion.div
                key={a.name}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.4, ease: EASE }}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4 transition-all duration-300 hover:border-white/[0.14] hover:from-white/[0.05]"
              >
                {/* status dot top-right */}
                <span className="absolute right-3 top-3 flex h-1.5 w-1.5">
                  {a.status !== 'idle' && (
                    <span className={cn(
                      'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                      statusColor === 'emerald' && 'bg-emerald-400',
                      statusColor === 'amber' && 'bg-amber-400',
                    )} />
                  )}
                  <span className={cn(
                    'relative inline-flex h-1.5 w-1.5 rounded-full',
                    statusColor === 'emerald' && 'bg-emerald-400',
                    statusColor === 'amber' && 'bg-amber-400',
                    statusColor === 'white' && 'bg-white/30',
                  )} />
                </span>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">
                  {a.emoji}
                </div>
                <p className="mt-3 text-sm font-semibold text-white">{a.name}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-white/45">{a.role}</p>
                <div className="mt-3 border-t border-white/[0.05] pt-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">Last action</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-white/60">{a.lastAction}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════════════════════
          DIGITAL TWIN + PREDICTION LAB
          ════════════════════════════════════════════════════════════════════════ */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Digital Twin */}
        <motion.section variants={itemVariants} className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl md:p-7">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <Brain className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">
                <span className="brand-text">Digital Twin™</span>
              </h2>
              <p className="text-xs text-white/40">Simulate any business scenario before you act</p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {SCENARIOS.map((s, i) => (
              <motion.div
                key={s.question}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: EASE }}
                className="group cursor-pointer rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 transition-all duration-200 hover:border-violet-500/25 hover:bg-violet-500/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-white">{s.question}</p>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-violet-300" />
                </div>
                <p className={cn(
                  'mt-1.5 text-xs leading-relaxed',
                  s.severity === 'warning' && 'text-amber-300/80',
                  s.severity === 'positive' && 'text-emerald-300/80',
                  s.severity === 'neutral' && 'text-white/50',
                )}>
                  {s.impact}
                </p>
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => setCurrentView('digital-twin')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06] hover:text-white"
          >
            Open Digital Twin
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.section>

        {/* Prediction Lab */}
        <motion.section variants={itemVariants} className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl md:p-7">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">
                <span className="brand-text">Prediction Lab™</span>
              </h2>
              <p className="text-xs text-white/40">Forecast revenue, cash, GST & growth across horizons</p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            {PREDICTIONS.map((p, i) => (
              <motion.div
                key={p.horizon}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: EASE }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{p.horizon}</p>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full brand-gradient"
                        style={{ width: `${p.confidence}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium tabular-nums text-white/50">{p.confidence}%</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">Revenue</p>
                    <p className="text-sm font-semibold text-white">{p.revenue}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">Cash Flow</p>
                    <p className="text-sm font-semibold text-emerald-300">{p.cashflow}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-white/35">GST Liab.</p>
                    <p className="text-sm font-semibold text-amber-300">{p.gst}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => setCurrentView('ai-predictions')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/[0.06] hover:text-white"
          >
            Open Prediction Lab
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.section>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          MANIFESTO FOOTER STRIP
          ════════════════════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants} className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-3xl border border-white/[0.06] bg-white/[0.015] py-5">
        {['Observe.', 'Think.', 'Decide.', 'Execute.', 'Learn.', 'Grow.'].map((word, i) => (
          <motion.span
            key={word}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: EASE }}
            className={cn(
              'text-sm font-semibold tracking-[0.2em] uppercase md:text-base',
              i % 2 === 0 ? 'brand-text' : 'text-white/40',
            )}
          >
            {word}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}
