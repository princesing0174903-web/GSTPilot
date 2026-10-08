'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI™ — Executive Response Renderer (PROMPT 5: Autonomous AI CFO)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Renders the structured executive output of the pipeline (ADDITIVE — no UI
// redesign). The components below render ABOVE / BELOW the streaming markdown
// narrative so the user sees real numbers + scores + insights instantly:
//
//   • ToolTrace              — which tools Oracle ran (collapsible)
//   • MetricsGrid            — deterministic KPI cards from REAL Prisma data
//   • BusinessScorecard      — 8-dimension scorecard + overall
//   • ConfidenceTags         — confidence % for each conclusion
   //   • AITimeline             — Today / Week / Month / Upcoming / Missed / Events
//   • AutonomousInsights     — proactive observations Oracle noticed
//   • StructuredRecommendations — explain-why recommendations (P0-P3)
//   • ActionsRow             — contextual action buttons
//   • SmartFollowUps         — intelligent follow-up questions
//
// The user NEVER sees raw internal agent reasoning — only the merged executive
// narrative + the structured cards above.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, CheckCircle2, AlertCircle, Loader2,
  ChevronDown, ChevronRight, Database, ShieldCheck, Zap, Sparkles,
  Target, Calendar, Lightbulb, ArrowRight, Crown, Gauge, Activity,
  AlertTriangle, Clock, FileWarning, Rocket,
} from 'lucide-react';
import type {
  OracleMetricCard,
  OracleActionButton,
  OracleToolExecution,
  OracleBusinessScorecard,
  OracleConfidenceTag,
  OracleTimelineItem,
  OracleInsight,
  OracleRecommendation,
  OracleSmartFollowUp,
  OracleScoreComponent,
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

// ─── PROMPT 5: Business Scorecard ─────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'Excellent': return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    case 'Good': return 'text-teal-400 border-teal-500/40 bg-teal-500/10';
    case 'Fair': return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    case 'Poor': return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
    case 'Critical': return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
    default: return 'text-white/60 border-white/10 bg-white/[0.03]';
  }
}

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-teal-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-rose-500';
}

function ScoreCard({ comp, isOverall }: { comp: OracleScoreComponent; isOverall?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`relative overflow-hidden rounded-2xl border p-3 backdrop-blur-sm ${
        isOverall
          ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-600/5'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium uppercase tracking-wider ${isOverall ? 'text-amber-300' : 'text-white/55'}`}>
          {isOverall && <Crown className="mr-1 inline h-2.5 w-2.5" />}
          {comp.label}
        </span>
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${gradeColor(comp.grade)}`}>
          {comp.grade}
        </span>
      </div>
      <div className={`mt-1.5 flex items-baseline gap-1 ${isOverall ? 'text-amber-300' : 'text-white'}`}>
        <span className="text-2xl font-bold tracking-tight">{comp.score}</span>
        <span className="text-[11px] text-white/40">/100</span>
      </div>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${comp.score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${scoreBarColor(comp.score)}`}
        />
      </div>
      <div className="mt-1.5 truncate text-[10px] text-white/40" title={comp.reason}>
        {comp.reason}
      </div>
    </motion.div>
  );
}

export function BusinessScorecardView({ scorecard }: { scorecard: OracleBusinessScorecard | null }) {
  if (!scorecard) return null;
  const comps = [
    scorecard.revenue,
    scorecard.profitability,
    scorecard.liquidity,
    scorecard.compliance,
    scorecard.customerHealth,
    scorecard.risk,
    scorecard.growth,
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Gauge className="h-3 w-3 text-amber-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Business Health Scorecard
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {comps.map((c) => (
          <ScoreCard key={c.key} comp={c} />
        ))}
      </div>
      <div className="mt-2">
        <ScoreCard comp={scorecard.overall} isOverall />
      </div>
    </motion.div>
  );
}

// ─── PROMPT 5: Confidence Tags ────────────────────────────────────────────────

export function ConfidenceTags({ tags }: { tags: OracleConfidenceTag[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3 flex flex-wrap gap-1.5"
    >
      {tags.map((t, idx) => {
        const color = t.confidence >= 90 ? 'emerald' : t.confidence >= 70 ? 'amber' : 'rose';
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03 }}
            className={`group relative inline-flex items-center gap-1.5 rounded-full border bg-white/[0.03] px-2.5 py-1 text-[10.5px] ${
              color === 'emerald' ? 'border-emerald-500/30' : color === 'amber' ? 'border-amber-500/30' : 'border-rose-500/30'
            }`}
            title={t.rationale}
          >
            <span className="text-white/55">{t.label}</span>
            <span className={`font-bold ${
              color === 'emerald' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {t.confidence}%
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── PROMPT 5: AI Timeline ────────────────────────────────────────────────────

const bucketMeta: Record<string, { label: string; icon: typeof Calendar }> = {
  today: { label: 'Today', icon: Clock },
  this_week: { label: 'This Week', icon: Calendar },
  this_month: { label: 'This Month', icon: Calendar },
  upcoming: { label: 'Upcoming Deadlines', icon: AlertTriangle },
  missed: { label: 'Missed Actions', icon: FileWarning },
  events: { label: 'Important Events', icon: Activity },
};

function severityDot(sev?: string): string {
  switch (sev) {
    case 'critical': return 'bg-rose-500';
    case 'warn': return 'bg-amber-500';
    case 'watch': return 'bg-sky-500';
    default: return 'bg-emerald-500';
  }
}

export function AITimelineView({ items }: { items: OracleTimelineItem[] }) {
  if (!items || items.length === 0) return null;
  // Group items by bucket preserving canonical order.
  const order = ['today', 'this_week', 'this_month', 'upcoming', 'missed', 'events'];
  const grouped: Record<string, OracleTimelineItem[]> = {};
  for (const it of items) {
    if (!grouped[it.bucket]) grouped[it.bucket] = [];
    grouped[it.bucket].push(it);
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Calendar className="h-3 w-3 text-amber-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          AI Timeline
        </span>
      </div>
      <div className="space-y-2.5">
        {order.map((bucket) => {
          const list = grouped[bucket];
          if (!list || list.length === 0) return null;
          const meta = bucketMeta[bucket];
          const Icon = meta.icon;
          return (
            <div key={bucket}>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/45">
                <Icon className="h-2.5 w-2.5" />
                {meta.label}
              </div>
              <ul className="space-y-1">
                {list.map((it, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-[11px]">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${severityDot(it.severity)}`} />
                    <span className="min-w-0 flex-1">
                      <span className="text-white/80">{it.title}</span>
                      {it.detail && <span className="block truncate text-[10px] text-white/40">{it.detail}</span>}
                    </span>
                    <span className="shrink-0 text-[10px] text-white/40">{it.when}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── PROMPT 5: Autonomous Insights ────────────────────────────────────────────

function insightToneClasses(tone: string): { ring: string; text: string; bg: string; icon: typeof Sparkles } {
  switch (tone) {
    case 'positive':
      return { ring: 'border-emerald-500/30', text: 'text-emerald-400', bg: 'bg-emerald-500/[0.07]', icon: TrendingUp };
    case 'negative':
      return { ring: 'border-rose-500/30', text: 'text-rose-400', bg: 'bg-rose-500/[0.07]', icon: TrendingDown };
    case 'warning':
      return { ring: 'border-amber-500/30', text: 'text-amber-400', bg: 'bg-amber-500/[0.07]', icon: AlertTriangle };
    case 'opportunity':
      return { ring: 'border-teal-500/30', text: 'text-teal-400', bg: 'bg-teal-500/[0.07]', icon: Rocket };
    default:
      return { ring: 'border-white/10', text: 'text-white', bg: 'bg-white/[0.03]', icon: Sparkles };
  }
}

export function AutonomousInsightsView({
  insights,
  onAction,
}: {
  insights: OracleInsight[];
  onAction?: (prompt: string) => void;
}) {
  if (!insights || insights.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Lightbulb className="h-3 w-3 text-amber-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Autonomous Insights
        </span>
        <span className="ml-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
          {insights.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {insights.map((ins, idx) => {
          const c = insightToneClasses(ins.tone);
          const Icon = c.icon;
          return (
            <motion.div
              key={ins.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`group relative overflow-hidden rounded-2xl border ${c.ring} ${c.bg} p-2.5`}
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${c.text}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11.5px] font-semibold text-white/90">{ins.headline}</span>
                    {ins.metric && (
                      <span className={`shrink-0 text-[10px] font-bold ${c.text}`}>{ins.metric}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/55">{ins.detail}</p>
                  {ins.actionPrompt && onAction && (
                    <button
                      onClick={() => onAction(ins.actionPrompt!)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-white/50 transition-colors hover:text-white/80"
                    >
                      Investigate
                      <ArrowRight className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── PROMPT 5: Structured Recommendations ─────────────────────────────────────

function priorityBadge(p: string): { label: string; cls: string } {
  switch (p) {
    case 'P0': return { label: 'P0 · Critical', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
    case 'P1': return { label: 'P1 · High', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
    case 'P2': return { label: 'P2 · Medium', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
    case 'P3': return { label: 'P3 · Low', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
    default: return { label: p, cls: 'bg-white/10 text-white/60 border-white/10' };
  }
}

export function StructuredRecommendationsView({
  recs,
  onAction,
}: {
  recs: OracleRecommendation[];
  onAction?: (prompt: string) => void;
}) {
  if (!recs || recs.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-3"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <Target className="h-3 w-3 text-amber-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Recommendations
        </span>
      </div>
      <div className="space-y-2">
        {recs.map((r, idx) => {
          const badge = priorityBadge(r.priority);
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-[11px] font-bold text-white/30">{idx + 1}.</span>
                  <span className="text-[12px] font-semibold text-white/90">{r.title}</span>
                </div>
                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-3">
                <div className="text-[10.5px]">
                  <span className="font-medium text-white/45">Why: </span>
                  <span className="text-white/70">{r.reason}</span>
                </div>
                <div className="text-[10.5px]">
                  <span className="font-medium text-white/45">Impact: </span>
                  <span className="text-white/70">{r.impact}</span>
                </div>
                <div className="text-[10.5px]">
                  <span className="font-medium text-white/45">Outcome: </span>
                  <span className="text-emerald-400">{r.estimatedOutcome}</span>
                </div>
              </div>
              {r.actionPrompt && onAction && (
                <button
                  onClick={() => onAction(r.actionPrompt!)}
                  className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  Take action
                  <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── PROMPT 5: Smart Follow-ups ───────────────────────────────────────────────

export function SmartFollowUpsView({
  followUps,
  onAsk,
}: {
  followUps: OracleSmartFollowUp[];
  onAsk: (question: string) => void;
}) {
  if (!followUps || followUps.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="mt-3"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-amber-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
          Oracle suggests
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {followUps.map((f) => (
          <button
            key={f.id}
            onClick={() => onAsk(f.question)}
            title={f.rationale}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] text-white/70 transition-all hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-200"
          >
            {f.question}
            <ArrowRight className="h-2.5 w-2.5 opacity-50 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
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

// ─── Combined: the full executive response (PROMPT 5) ────────────────────────

export interface ExecutiveResponseProps {
  tools?: OracleToolExecution[];
  metrics?: OracleMetricCard[];
  intent?: string;
  scorecard?: OracleBusinessScorecard | null;
  confidences?: OracleConfidenceTag[];
  timeline?: OracleTimelineItem[];
  insights?: OracleInsight[];
  recommendations?: OracleRecommendation[];
  followUps?: OracleSmartFollowUp[];
  actions?: OracleActionButton[];
  onAction?: (prompt: string) => void;
  onAsk?: (question: string) => void;
}

export function OracleExecutiveHeader({
  tools,
  metrics,
  intent,
  scorecard,
  confidences,
  timeline,
  insights,
  recommendations,
  followUps,
  actions,
  onAction,
  onAsk,
}: ExecutiveResponseProps) {
  const hasAnything =
    (tools?.length ?? 0) > 0 ||
    (metrics?.length ?? 0) > 0 ||
    scorecard ||
    (confidences?.length ?? 0) > 0 ||
    (timeline?.length ?? 0) > 0 ||
    (insights?.length ?? 0) > 0 ||
    (recommendations?.length ?? 0) > 0;
  if (!hasAnything) return null;
  return (
    <div className="mb-3">
      {tools && tools.length > 0 && <ToolTrace tools={tools} intent={intent} />}
      {metrics && metrics.length > 0 && <MetricsGrid metrics={metrics} />}
      {scorecard && <BusinessScorecardView scorecard={scorecard} />}
      {confidences && confidences.length > 0 && <ConfidenceTags tags={confidences} />}
      {insights && insights.length > 0 && (
        <AutonomousInsightsView insights={insights} onAction={onAction} />
      )}
      {timeline && timeline.length > 0 && <AITimelineView items={timeline} />}
      {recommendations && recommendations.length > 0 && (
        <StructuredRecommendationsView recs={recommendations} onAction={onAction} />
      )}
      {actions && actions.length > 0 && onAction && (
        <ActionsRow actions={actions} onAction={onAction} />
      )}
      {followUps && followUps.length > 0 && onAsk && (
        <SmartFollowUpsView followUps={followUps} onAsk={onAsk} />
      )}
    </div>
  );
}
