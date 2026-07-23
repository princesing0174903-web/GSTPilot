'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Oracle Rich Answer — Structured content cards inside Oracle messages
//
// Detects patterns in Oracle's markdown response and renders premium cards:
//   • ExecutiveSummaryCard — revenue/cash/receivables/profit/risk grid
//   • CashFlowChartCard — 30-day bar chart (pure SVG)
//   • GSTRiskCard — risk level + reasons + fix button
//   • RecommendationCard — customer + chance + amount + action
//
// Falls back to OracleMarkdown for plain prose.
// ═══════════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Wallet, IndianRupee, ShieldCheck,
  AlertTriangle, Phone, MessageSquare, ArrowUpRight, Activity,
} from 'lucide-react';
import { Sparkline } from '@/components/dashboard/home/Sparkline';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toFixed(0)}`;
}

// ─── Executive Summary Card ───────────────────────────────────────────────────

interface MetricItem {
  label: string;
  value: string;
  icon: typeof TrendingUp;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
}

export function ExecutiveSummaryCard({ metrics }: { metrics: MetricItem[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="my-3 rounded-2xl border border-[#1F1F1F] bg-gradient-to-br from-[#111111] to-[#0D0D0D] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
          <Activity className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
          Executive Summary
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          const trendColor = m.trend === 'up' ? 'text-emerald-400' : m.trend === 'down' ? 'text-red-400' : 'text-white/50';
          const TrendIcon = m.trend === 'up' ? TrendingUp : m.trend === 'down' ? TrendingDown : null;
          return (
            <div key={i} className="rounded-xl bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="h-3 w-3 text-white/40" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {m.label}
                </span>
              </div>
              <p className="text-lg font-bold tabular-nums text-white">{m.value}</p>
              {m.trendLabel && (
                <div className={`flex items-center gap-1 mt-0.5 text-[10px] ${trendColor}`}>
                  {TrendIcon && <TrendIcon className="h-2.5 w-2.5" />}
                  <span>{m.trendLabel}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Cash Flow Chart Card (30-day forecast, pure SVG) ─────────────────────────

export function CashFlowChartCard({
  data,
  label = 'Next 30 Days',
}: {
  data: number[];
  label?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const barWidth = 100 / data.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="my-3 rounded-2xl border border-[#1F1F1F] bg-gradient-to-br from-[#111111] to-[#0D0D0D] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20">
            <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
            Cash Flow Prediction
          </span>
        </div>
        <span className="text-[10px] text-white/40">{label}</span>
      </div>
      <div className="relative h-32 flex items-end gap-px">
        {data.map((val, i) => {
          const heightPct = ((val - min) / range) * 100;
          const isPositive = val >= 0;
          return (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(heightPct, 2)}%` }}
              transition={{ delay: i * 0.02, duration: 0.4, ease: 'easeOut' }}
              className={`flex-1 rounded-t-sm ${isPositive ? 'bg-gradient-to-t from-cyan-500/30 to-cyan-400/80' : 'bg-gradient-to-t from-red-500/30 to-red-400/80'}`}
              style={{ minWidth: `${barWidth}%` }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] text-white/40">
        <span>Today</span>
        <span>+{formatINR(max)} peak</span>
        <span>Day 30</span>
      </div>
    </motion.div>
  );
}

// ─── GST Risk Card ────────────────────────────────────────────────────────────

export function GSTRiskCard({
  riskLevel,
  reasons,
}: {
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
}) {
  const config = {
    low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', icon: ShieldCheck, label: 'Low Risk' },
    medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', ring: 'ring-amber-500/20', icon: AlertTriangle, label: 'Medium Risk' },
    high: { color: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/20', icon: AlertTriangle, label: 'High Risk' },
  };
  const c = config[riskLevel];
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="my-3 rounded-2xl border border-[#1F1F1F] bg-gradient-to-br from-[#111111] to-[#0D0D0D] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg} ring-1 ${c.ring}`}>
            <Icon className={`h-3.5 w-3.5 ${c.color}`} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            GST Risk
          </span>
        </div>
        <span className={`text-[11px] font-semibold ${c.color}`}>{c.label}</span>
      </div>
      {reasons.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-white/70">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-white/30 shrink-0" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="w-full rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-400 ring-1 ring-amber-500/20 transition-colors hover:bg-amber-500/20">
        Fix Automatically
      </button>
    </motion.div>
  );
}

// ─── AI Recommendation Card ───────────────────────────────────────────────────

export function RecommendationCard({
  customer,
  chancePercent,
  expectedAmount,
  actionLabel = 'Send WhatsApp Reminder',
}: {
  customer: string;
  chancePercent: number;
  expectedAmount: number;
  actionLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="my-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <Phone className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
          AI Recommendation
        </span>
      </div>
      <p className="text-[14px] font-semibold text-white mb-3">
        Call {customer} today
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1">
            Chance of payment
          </p>
          <p className="text-xl font-bold tabular-nums text-emerald-400">{chancePercent}%</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1">
            Expected amount
          </p>
          <p className="text-xl font-bold tabular-nums text-white">{formatINR(expectedAmount)}</p>
        </div>
      </div>
      <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[12px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20 transition-colors hover:bg-emerald-500/20">
        <MessageSquare className="h-3.5 w-3.5" />
        {actionLabel}
      </button>
    </motion.div>
  );
}

// ─── Trend mini-card with sparkline ───────────────────────────────────────────

export function TrendCard({
  label,
  value,
  trendData,
  trend,
}: {
  label: string;
  value: string;
  trendData: number[];
  trend: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="my-3 rounded-2xl border border-[#1F1F1F] bg-[#111111] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1">{label}</p>
          <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
        </div>
        <Sparkline data={trendData} trend={trend} width={100} height={40} />
      </div>
    </div>
  );
}

const OracleRichAnswer = { ExecutiveSummaryCard, CashFlowChartCard, GSTRiskCard, RecommendationCard, TrendCard };
export default OracleRichAnswer;
