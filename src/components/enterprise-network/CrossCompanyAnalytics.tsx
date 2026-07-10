'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT CROSS-COMPANY ANALYTICS™ — MULTI-ENTITY COMPARISON
//
// Compare performance across all companies in your group. Metric selector,
// animated bar charts, leaderboard with medals, full comparison matrix with
// heat-coded cells, AI insight callouts and per-company radar scorecard.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, TrendingUp, TrendingDown, Sparkles, Trophy,
  Building2, ArrowUpRight, ArrowDownRight, Crown, Scale,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  CROSS_COMPANY_METRICS,
  COMPANIES,
  fmtINR,
} from '@/lib/enterprise/data';

// ─── Metric definitions ───────────────────────────────────────────────────────
type MetricKey = 'revenue' | 'expenses' | 'profit' | 'gst' | 'compliance' | 'growth' | 'cashFlow' | 'risk' | 'aiScore';

interface MetricMeta {
  key: MetricKey;
  label: string;
  short: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  isCurrency: boolean;
  higherIsBetter: boolean;
  max: number; // 100 for scores, computed otherwise
}

const maxCurrency = (k: MetricKey) => Math.max(...CROSS_COMPANY_METRICS.map(c => Math.abs(c[k] as number)));

const METRICS: MetricMeta[] = [
  { key: 'revenue', label: 'Revenue', short: 'REV', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500', isCurrency: true, higherIsBetter: true, max: maxCurrency('revenue') },
  { key: 'expenses', label: 'Expenses', short: 'EXP', icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500', isCurrency: true, higherIsBetter: false, max: maxCurrency('expenses') },
  { key: 'profit', label: 'Profit', short: 'PRO', icon: Scale, color: 'text-teal-400', bg: 'bg-teal-500', isCurrency: true, higherIsBetter: true, max: maxCurrency('profit') },
  { key: 'gst', label: 'GST Liability', short: 'GST', icon: BarChart3, color: 'text-cyan-400', bg: 'bg-cyan-500', isCurrency: true, higherIsBetter: false, max: maxCurrency('gst') },
  { key: 'compliance', label: 'Compliance', short: 'CMP', icon: Scale, color: 'text-emerald-400', bg: 'bg-emerald-500', isCurrency: false, higherIsBetter: true, max: 100 },
  { key: 'growth', label: 'Growth', short: 'GRW', icon: TrendingUp, color: 'text-teal-400', bg: 'bg-teal-500', isCurrency: false, higherIsBetter: true, max: 100 },
  { key: 'cashFlow', label: 'Cash Flow', short: 'CFL', icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500', isCurrency: true, higherIsBetter: true, max: maxCurrency('cashFlow') },
  { key: 'risk', label: 'Risk Score', short: 'RSK', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500', isCurrency: false, higherIsBetter: false, max: 100 },
  { key: 'aiScore', label: 'AI Score', short: 'AIS', icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500', isCurrency: false, higherIsBetter: true, max: 100 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMetric(value: number, isCurrency: boolean): string {
  if (isCurrency) return fmtINR(value);
  return String(Math.round(value));
}

function companyColor(name: string): string {
  return COMPANIES.find(c => c.name === name)?.color ?? '#10b981';
}

// ─── Metric Chip ──────────────────────────────────────────────────────────────
function MetricChip({ meta, active, onClick }: { meta: MetricMeta; active: boolean; onClick: () => void }) {
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
        active
          ? 'border-emerald-500/50 bg-emerald-500/[0.08] text-emerald-300 shadow-sm'
          : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.04]'
      }`}
    >
      <Icon className={`size-3.5 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
      {meta.label}
    </button>
  );
}

// ─── Comparison Bar ───────────────────────────────────────────────────────────
function ComparisonBar({ name, value, meta, max, delay }: { name: string; value: number; meta: MetricMeta; max: number; delay: number }) {
  const pct = Math.max(2, Math.min(100, (Math.abs(value) / max) * 100));
  const color = companyColor(name);
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 md:w-40 shrink-0 text-xs text-slate-300 truncate">{name}</div>
      <div className="flex-1 h-7 rounded-md bg-white/[0.03] overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay, ease: 'easeOut' as const }}
          className="h-full rounded-md flex items-center justify-end pr-2"
          style={{ background: `linear-gradient(90deg, ${color}22, ${color}66)` }}
        >
          <span className="text-[10px] font-medium text-white/90 tabular-nums">{fmtMetric(value, meta.isCurrency)}</span>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Leaderboard Row ──────────────────────────────────────────────────────────
function LeaderboardRow({ rank, name, value, meta, delta, color }: { rank: number; name: string; value: number; meta: MetricMeta; delta: number; color: string }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
  const positive = meta.higherIsBetter ? delta >= 0 : delta <= 0;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        rank <= 3 ? 'border-white/[0.08] bg-white/[0.03]' : 'border-white/[0.04] bg-white/[0.01]'
      }`}
    >
      <div className="w-7 text-center">
        {medal ? <span className="text-base">{medal}</span> : <span className="text-xs text-slate-500 font-medium">#{rank}</span>}
      </div>
      <div className="size-2 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{name}</div>
        <div className="text-[11px] text-slate-500">{fmtMetric(value, meta.isCurrency)}</div>
      </div>
      <div className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {Math.abs(delta).toFixed(1)}%
      </div>
    </motion.div>
  );
}

// ─── Cell color (heat-map) ────────────────────────────────────────────────────
function cellTone(value: number, avg: number, higherIsBetter: boolean): string {
  const diff = value - avg;
  const better = higherIsBetter ? diff >= 0 : diff <= 0;
  if (Math.abs(diff) < 0.01 * Math.abs(avg || 1)) return 'text-slate-300 bg-white/[0.02]';
  if (better) return 'text-emerald-300 bg-emerald-500/[0.08]';
  return 'text-red-300 bg-red-500/[0.08]';
}

// ─── Radar comparison ─────────────────────────────────────────────────────────
function ScoreBar({ label, value, avg, higherIsBetter, color }: { label: string; value: number; avg: number; higherIsBetter: boolean; color: string }) {
  const better = higherIsBetter ? value >= avg : value <= avg;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className={`font-medium tabular-nums ${better ? 'text-emerald-300' : 'text-red-300'}`}>{Math.round(value)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
        {/* avg marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-slate-500"
          style={{ left: `${avg}%` }}
          title={`Avg: ${Math.round(avg)}`}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <div className="text-[10px] text-slate-600">Avg: {Math.round(avg)}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CrossCompanyAnalytics() {
  const [selectedMetricKey, setSelectedMetricKey] = useState<MetricKey>('revenue');
  const [selectedCompany, setSelectedCompany] = useState<string>(COMPANIES[1].name); // Aurora Tech

  const selectedMetric = useMemo(
    () => METRICS.find(m => m.key === selectedMetricKey)!,
    [selectedMetricKey]
  );

  const sortedByMetric = useMemo(
    () => [...CROSS_COMPANY_METRICS].sort((a, b) => {
      const av = a[selectedMetric.key] as number;
      const bv = b[selectedMetric.key] as number;
      return selectedMetric.higherIsBetter ? bv - av : av - bv;
    }),
    [selectedMetricKey, selectedMetric]
  );

  const avgOfMetric = useMemo(
    () => CROSS_COMPANY_METRICS.reduce((s, c) => s + (c[selectedMetric.key] as number), 0) / CROSS_COMPANY_METRICS.length,
    [selectedMetric]
  );

  // Averages for radar/scoreboard
  const avgs = useMemo(() => ({
    compliance: COMPANIES.reduce((s, c) => s + c.complianceScore, 0) / COMPANIES.length,
    growth: COMPANIES.reduce((s, c) => s + c.growthScore, 0) / COMPANIES.length,
    risk: COMPANIES.reduce((s, c) => s + c.riskScore, 0) / COMPANIES.length,
    aiScore: COMPANIES.reduce((s, c) => s + c.aiScore, 0) / COMPANIES.length,
  }), []);

  const selectedCo = useMemo(
    () => COMPANIES.find(c => c.name === selectedCompany) ?? COMPANIES[0],
    [selectedCompany]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/30">
            <BarChart3 className="size-4 text-emerald-400" />
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Cross-Company Analytics<span className="text-emerald-400">™</span>
          </h1>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Compare performance across all your companies
        </p>
      </div>

      {/* Metric selector */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-4 text-emerald-400" />
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Select Metric to Compare</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {METRICS.map(m => (
              <MetricChip
                key={m.key}
                meta={m}
                active={m.key === selectedMetricKey}
                onClick={() => setSelectedMetricKey(m.key)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart + leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Comparison bar chart */}
        <Card className="lg:col-span-2 border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="size-4 text-emerald-400" />
                {selectedMetric.label} Comparison
              </CardTitle>
              <Badge variant="outline" className="border-white/10 text-slate-400 bg-white/[0.03]">
                Avg: {fmtMetric(avgOfMetric, selectedMetric.isCurrency)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {CROSS_COMPANY_METRICS.map((c, idx) => (
                  <ComparisonBar
                    key={c.company}
                    name={c.company}
                    value={c[selectedMetric.key] as number}
                    meta={selectedMetric}
                    max={selectedMetric.max}
                    delay={idx * 0.05}
                  />
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Trophy className="size-4 text-amber-400" />
              Leaderboard
            </CardTitle>
            <p className="text-xs text-slate-500">Ranked by {selectedMetric.label.toLowerCase()}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scroll">
              {sortedByMetric.map((c, idx) => {
                const value = c[selectedMetric.key] as number;
                const delta = ((value - avgOfMetric) / (Math.abs(avgOfMetric) || 1)) * 100;
                return (
                  <LeaderboardRow
                    key={c.company}
                    rank={idx + 1}
                    name={c.company}
                    value={value}
                    meta={selectedMetric}
                    delta={delta}
                    color={companyColor(c.company)}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full comparison table */}
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Scale className="size-4 text-emerald-400" />
            Full Comparison Matrix
          </CardTitle>
          <p className="text-xs text-slate-500">Heat-coded cells: green = above average, red = below</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto custom-scroll">
            <table className="w-full text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-2 pr-3 text-slate-400 font-medium sticky left-0 bg-[#0a0e14] z-10">Company</th>
                  {METRICS.map(m => (
                    <th key={m.key} className="text-right py-2 px-2 text-slate-400 font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <m.icon className={`size-3 ${m.color}`} />
                        {m.short}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CROSS_COMPANY_METRICS.map(c => (
                  <tr key={c.company} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2 pr-3 text-slate-200 font-medium sticky left-0 bg-[#0a0e14] z-10">
                      <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full" style={{ background: companyColor(c.company) }} />
                        {c.company}
                      </div>
                    </td>
                    {METRICS.map(m => {
                      const value = c[m.key] as number;
                      const avg = CROSS_COMPANY_METRICS.reduce((s, x) => s + (x[m.key] as number), 0) / CROSS_COMPANY_METRICS.length;
                      return (
                        <td key={m.key} className={`text-right py-1.5 px-2 tabular-nums rounded ${cellTone(value, avg, m.higherIsBetter)}`}>
                          {fmtMetric(value, m.isCurrency)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Avg row */}
                <tr className="border-t-2 border-white/[0.08] bg-white/[0.02]">
                  <td className="py-2 pr-3 text-slate-400 font-medium sticky left-0 bg-[#0d1219] z-10">Average</td>
                  {METRICS.map(m => {
                    const avg = CROSS_COMPANY_METRICS.reduce((s, x) => s + (x[m.key] as number), 0) / CROSS_COMPANY_METRICS.length;
                    return (
                      <td key={m.key} className="text-right py-1.5 px-2 tabular-nums text-slate-400">
                        {fmtMetric(avg, m.isCurrency)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Insight + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI insight */}
        <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-400" />
              AI Cross-Company Insight
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <p className="text-sm text-slate-200 leading-relaxed">
                <span className="text-emerald-300 font-medium">Aurora Tech</span> leads in{' '}
                <span className="text-emerald-300 font-medium">growth (92%)</span> and{' '}
                <span className="text-emerald-300 font-medium">AI score (97%)</span>.{' '}
                <span className="text-red-300 font-medium">Standalone Traders</span> shows critical risk (38) —
                recommend immediate compliance review and cash flow audit.
              </p>
            </div>
            <Separator className="bg-white/[0.06]" />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-[11px] text-slate-500">Top Performer</div>
                <div className="text-sm text-emerald-300 font-medium mt-0.5">Aurora Tech</div>
                <div className="text-[11px] text-slate-400">Best growth + AI score</div>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-2.5">
                <div className="text-[11px] text-slate-500">At Risk</div>
                <div className="text-sm text-red-300 font-medium mt-0.5">Standalone Traders</div>
                <div className="text-[11px] text-slate-400">Risk 38 · Overdue GST</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-300 hover:bg-emerald-500/[0.12] hover:text-emerald-200"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              Generate Full AI Comparison Report
            </Button>
          </CardContent>
        </Card>

        {/* Radar/scorecard for selected company */}
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Building2 className="size-4 text-emerald-400" />
                Score Comparison
              </CardTitle>
              <Badge variant="outline" className="border-white/10 text-slate-300 bg-white/[0.03]">
                <div className="size-2 rounded-full mr-1.5" style={{ background: selectedCo.color }} />
                {selectedCo.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Company picker */}
            <ScrollArea className="w-full whitespace-nowrap mb-4">
              <div className="inline-flex gap-2 pb-1">
                {COMPANIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCompany(c.name)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                      c.name === selectedCompany
                        ? 'border-emerald-500/50 bg-emerald-500/[0.08] text-emerald-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="size-1.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </ScrollArea>

            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <ScoreBar label="Compliance" value={selectedCo.complianceScore} avg={avgs.compliance} higherIsBetter={true} color={selectedCo.color} />
              <ScoreBar label="Growth" value={selectedCo.growthScore} avg={avgs.growth} higherIsBetter={true} color={selectedCo.color} />
              <ScoreBar label="Risk" value={selectedCo.riskScore} avg={avgs.risk} higherIsBetter={false} color={selectedCo.color} />
              <ScoreBar label="AI Score" value={selectedCo.aiScore} avg={avgs.aiScore} higherIsBetter={true} color={selectedCo.color} />
            </div>

            <Separator className="my-4 bg-white/[0.06]" />

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-[11px] text-slate-500">Industry</div>
                <div className="text-sm text-white">{selectedCo.industry}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-[11px] text-slate-500">Status</div>
                <div className={`text-sm font-medium ${selectedCo.status === 'Healthy' ? 'text-emerald-300' : selectedCo.status === 'Watch' ? 'text-amber-300' : 'text-red-300'}`}>
                  {selectedCo.status}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.16); }
      `}</style>
    </div>
  );
}
