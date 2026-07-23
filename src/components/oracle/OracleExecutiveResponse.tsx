'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Executive Response Renderer (PROMPT 4)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders the structured executive output of the pipeline:
//   • ToolTrace    — which tools Oracle ran (collapsible, transparency)
//   • MetricsGrid  — deterministic KPI cards from REAL Prisma data
//   • ActionsRow   — action buttons (Generate Report, Collect Payment, etc.)
//
// These are rendered ABOVE the streaming markdown narrative so the user sees
// real numbers instantly — before the LLM even starts writing.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle, Loader2,
  ChevronDown, ChevronRight, Database, ShieldCheck, Zap,
} from 'lucide-react';
import type {
  OracleMetricCard,
  OracleActionButton,
  OracleToolExecution,
} from '@/lib/oracle-conversations';

// ─── Metric card tone → colors ────────────────────────────────────────────────

function metricToneClasses(tone?: string): { ring: string; text: string; bg: string; dot: string } {
  switch (tone) {
    case 'positive':
      return { ring: 'border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/[0.07]', dot: 'bg-emerald-500' };
    case 'negative':
      return { ring: 'border-rose-500/30', text: 'text-rose-400', bg: 'bg-rose-500/[0.07]', dot: 'bg-rose-500' };
    case 'warning':
      return { ring: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/[0.07]', dot: 'bg-amber-500' };
    default:
      return { ring: 'border-white/10', text: 'text-white', bg: 'bg-white/[0.03]', dot: 'bg-white/40' };
  }
}

function trendIcon(trend?: string) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-rose-400" />;
  return <Minus className="h-3 w-3 text-white/40" />;
}

// ─── Tool Trace (collapsible) ─────────────────────────────────────────────────

export function ToolTrace({
  tools,
  intent,
}: {
  tools: OracleToolExecution[];
  intent?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!tools || tools.length === 0) return null;

  const done = tools.filter((t) => t.status === 'done').length;
  const total = tools.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <Database className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          {intent ? `${intent.replace(/_/g, ' ')} · ` : ''}Real Data Sources
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[10.5px] text-white/45">
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-400">
            <ShieldCheck className="h-2.5 w-2.5" />
            {done}/{total} verified
          </span>
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/[0.05]"
          >
            <ul className="space-y-1 px-3.5 py-2.5">
              {tools.map((t) => (
                <li key={t.toolId} className="flex items-start gap-2 text-[11px]">
                  {t.status === 'done' ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                  ) : t.status === 'error' ? (
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-500" />
                  ) : (
                    <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-amber-500" />
                  )}
                  <span className="font-medium text-white/80">{t.label}</span>
                  <span className="ml-auto truncate text-white/45">{t.summary}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Metrics Grid ─────────────────────────────────────────────────────────────

export function MetricsGrid({ metrics }: { metrics: OracleMetricCard[] }) {
  if (!metrics || metrics.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      {metrics.map((m, idx) => {
        const c = metricToneClasses(m.tone);
        return (
          <motion.div
            key={m.key}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: idx * 0.04 }}
            className={`relative overflow-hidden rounded-2xl border ${c.ring} ${c.bg} p-3 backdrop-blur-sm`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-white/55">
                {m.label}
              </span>
              {trendIcon(m.trend)}
            </div>
            <div className={`mt-1.5 text-xl font-bold tracking-tight ${c.text}`}>
              {m.value}
            </div>
            {m.sub && (
              <div className="mt-0.5 truncate text-[10.5px] text-white/45">{m.sub}</div>
            )}
            <div className={`absolute -right-3 -top-3 h-10 w-10 rounded-full ${c.dot} opacity-[0.06] blur-xl`} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── Actions Row ──────────────────────────────────────────────────────────────

export function ActionsRow({
  actions,
  onAction,
}: {
  actions: OracleActionButton[];
  onAction: (prompt: string) => void;
}) {
  if (!actions || actions.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-3 flex flex-wrap gap-2"
    >
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => onAction(a.prompt)}
          className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-all ${
            a.tone === 'primary'
              ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 hover:from-amber-500/30 hover:to-amber-600/20 hover:shadow-[0_0_16px_-4px_rgba(245,158,11,0.4)]'
              : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          <Zap className="h-3 w-3 opacity-70 transition-opacity group-hover:opacity-100" />
          {a.label}
        </button>
      ))}
    </motion.div>
  );
}

// ─── Combined: the full executive response header (trace + metrics) ──────────

export function OracleExecutiveHeader({
  tools,
  metrics,
  intent,
}: {
  tools?: OracleToolExecution[];
  metrics?: OracleMetricCard[];
  intent?: string;
}) {
  if (!tools?.length && !metrics?.length) return null;
  return (
    <div className="mb-3">
      {tools && tools.length > 0 && <ToolTrace tools={tools} intent={intent} />}
      {metrics && metrics.length > 0 && <MetricsGrid metrics={metrics} />}
    </div>
  );
}
