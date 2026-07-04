'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Infinity™ — Phase 9 Demo Preview Panel
// The Financial Brain of India™
//
// Rendered on dashboards that have no live data yet, so the product always
// feels alive (Revenue · GST · Invoices · Collections · Clients · Forecasts ·
// Compliance · Cash Flow). A clear "Demo Preview" banner keeps it honest.
//
// Pure UI — no databases, no API calls. Reads from src/lib/demo/preview-data.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, TrendingDown, Activity, CalendarClock, Users, IndianRupee } from 'lucide-react';
import {
  DEMO_KPIs,
  DEMO_ACTIVITIES,
  DEMO_CLIENTS,
  DEMO_COMPLIANCE,
  DEMO_CASH_FLOW,
  DEMO_TONE_COLORS,
  type DemoKpi,
} from '@/lib/demo/preview-data';
import { cn } from '@/lib/utils';

// ─── Tiny inline sparkline (no chart lib needed) ──────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 64;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={`0,${h} ${pts} ${w},${h}`}
        fill={`url(#spark-${color.replace('#', '')})`}
        stroke="none"
      />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ kpi, index }: { kpi: DemoKpi; index: number }) {
  const color = kpi.trend === 'up' ? '#3B82F6' : kpi.trend === 'down' ? '#F59E0B' : '#8B5CF6';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 * index }}
      className="premium-card p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {kpi.label}
        </span>
        <Sparkline data={kpi.spark} color={color} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</span>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-[11px] font-semibold',
            kpi.trend === 'up' ? 'text-blue-400' : kpi.trend === 'down' ? 'text-amber-400' : 'text-muted-foreground',
          )}
        >
          {kpi.trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {kpi.delta}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: 'current' | 'pending' | 'overdue' | 'filed' | 'draft' | 'due' }) {
  const map = {
    current: { label: 'Current', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
    filed: { label: 'Filed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
    pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
    draft: { label: 'Draft', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
    overdue: { label: 'Overdue', cls: 'bg-red-500/15 text-red-300 border-red-500/25' },
    due: { label: 'Due', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  } as const;
  const s = map[status];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', s.cls)}>
      {s.label}
    </span>
  );
}

// ─── Cash flow sparkline (larger) ─────────────────────────────────────────────
function CashFlowChart() {
  const data = DEMO_CASH_FLOW;
  const w = 280;
  const h = 64;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="cashflow-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill="url(#cashflow-grad)" stroke="none" />
      <polyline points={pts} fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function DemoPreviewPanel({ userName }: { userName?: string }) {
  const firstName = userName?.split(' ')[0];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-4"
    >
      {/* Demo Preview banner — honest, premium */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2.5 rounded-2xl brand-gradient-soft border border-blue-500/20 px-4 py-2.5"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg brand-gradient">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">
            Demo Preview — here&apos;s what your live dashboard will look like.
          </p>
          <p className="text-[10px] text-muted-foreground">
            Connect GSTN, bank, or upload invoices to replace this with real data.
          </p>
        </div>
        <span className="brand-shimmer rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Demo
        </span>
      </motion.div>

      {/* KPI grid — 6 cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {DEMO_KPIs.map((kpi, i) => (
          <KpiCard key={kpi.id} kpi={kpi} index={i} />
        ))}
      </div>

      {/* Two-column: Activity feed + Cash flow */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Activity feed — spans 2 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="premium-card p-4 lg:col-span-2"
        >
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-semibold text-foreground">Live Activity</h3>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-400" />
              </span>
              Live
            </span>
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto custom-scrollbar">
            {DEMO_ACTIVITIES.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: DEMO_TONE_COLORS[a.tone] }}
                />
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">{a.time}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{a.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{a.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cash flow forecast */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="premium-card p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <IndianRupee className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-semibold text-foreground">Cash Flow</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">12 weeks</span>
          </div>
          <CashFlowChart />
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Runway</span>
            <span className="font-semibold text-blue-300">12 days · healthy</span>
          </div>
        </motion.div>
      </div>

      {/* Two-column: Clients + Compliance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Clients */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="premium-card p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-semibold text-foreground">Top Clients</h3>
          </div>
          <div className="space-y-1.5">
            {DEMO_CLIENTS.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg brand-gradient-soft text-[10px] font-semibold brand-text">
                  {c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{c.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground/60">{c.gstin}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-[11px] font-semibold text-foreground">{c.outstanding}</p>
                  <p className="text-[9px] text-muted-foreground">outstanding</p>
                </div>
                <StatusPill status={c.status} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Compliance calendar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="premium-card p-4"
        >
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 brand-text" />
            <h3 className="text-sm font-semibold text-foreground">Compliance Calendar</h3>
          </div>
          <div className="space-y-1.5">
            {DEMO_COMPLIANCE.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex h-8 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-white/[0.04]">
                  <span className="text-[10px] font-bold text-foreground">{g.form}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">Due {g.due}</p>
                  <p className="text-[10px] text-muted-foreground">Liability {g.amount}</p>
                </div>
                <StatusPill status={g.status} />
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <p className="pt-1 text-center text-[10px] text-muted-foreground/50">
        {firstName ? `${firstName}, your ` : 'Your '}Financial Brain is learning. Connect data to go live.
      </p>
    </motion.div>
  );
}

export default DemoPreviewPanel;
