'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Upgrade Phase 1: AI Evolution Panel
//
// An overlay panel launched from within the Oracle workspace header (no rail
// navigation changes). Surfaces all 10 upgrades:
//   • Forecasting (30/90/365-day, 8 metrics, confidence)
//   • Specialist Agents (8 CFO-domain experts + auto-router)
//   • Diagnostic Chains (multi-step reasoning pipelines)
//   • AI Accuracy (validation + hallucination detection)
//   • Workspace (pinned chats, saved prompts, drafts, favorites)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, TrendingUp, Brain, ShieldCheck, Zap, Star,
  Pin, FileText, Edit3, Share2, Users, Activity, AlertTriangle,
  CheckCircle2, ChevronRight, Play, RefreshCw, Lightbulb,
} from 'lucide-react';
import type {
  ForecastBundle, ForecastPoint, ForecastMetric,
} from '@/lib/oracle-evolution/forecasting';
import { formatForecastCurrency } from '@/lib/oracle-evolution/forecasting';
import type { AgentId } from '@/lib/oracle-evolution/agents';
import type { DiagnosticResult, ChainId } from '@/lib/oracle-evolution/diagnostic';
import type { ValidationResult } from '@/lib/oracle-evolution/validation';
import {
  loadWorkspaceStore, getWorkspaceStats, savePrompt, deletePrompt,
  incrementPromptUse, type WorkspaceStore, type SavedPrompt,
} from '@/lib/oracle-evolution/workspace-store';

type TabId = 'forecast' | 'agents' | 'diagnostics' | 'accuracy' | 'workspace';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof TrendingUp;
  accent: string;
}

const TABS: TabDef[] = [
  { id: 'forecast', label: 'Forecasting', icon: TrendingUp, accent: 'emerald' },
  { id: 'agents', label: 'Specialists', icon: Users, accent: 'teal' },
  { id: 'diagnostics', label: 'Diagnostics', icon: Brain, accent: 'violet' },
  { id: 'accuracy', label: 'Accuracy', icon: ShieldCheck, accent: 'amber' },
  { id: 'workspace', label: 'Workspace', icon: Star, accent: 'rose' },
];

const METRIC_LABELS: Record<ForecastMetric, string> = {
  revenue: 'Revenue',
  gst_liability: 'GST Liability',
  cash_flow: 'Cash Flow',
  expenses: 'Expenses',
  working_capital: 'Working Capital',
  collections: 'Collections',
  profit: 'Profit',
  tax: 'Tax',
};

const AGENT_META: { id: AgentId; name: string; title: string; specialty: string; icon: string; accent: string }[] = [
  { id: 'finance', name: 'Arjun', title: 'Finance Agent', specialty: 'P&L · Margins · Profitability', icon: 'TrendingUp', accent: 'emerald' },
  { id: 'gst', name: 'Priya', title: 'GST Agent', specialty: 'GSTR · ITC · Filing', icon: 'FileText', accent: 'teal' },
  { id: 'tax', name: 'Vikram', title: 'Tax Agent', specialty: 'Income Tax · TDS · Advance Tax', icon: 'Receipt', accent: 'cyan' },
  { id: 'audit', name: 'Meera', title: 'Audit Agent', specialty: 'Reconciliation · Anomalies', icon: 'ShieldCheck', accent: 'violet' },
  { id: 'collections', name: 'Rohit', title: 'Collections Agent', specialty: 'Receivables · Aging · Dunning', icon: 'HandCoins', accent: 'amber' },
  { id: 'cashflow', name: 'Anita', title: 'Cash Flow Agent', specialty: 'Liquidity · Runway · Forecast', icon: 'Wallet', accent: 'rose' },
  { id: 'compliance', name: 'Sneha', title: 'Compliance Agent', specialty: 'Deadlines · Penalties', icon: 'ShieldAlert', accent: 'amber' },
  { id: 'reporting', name: 'Kabir', title: 'Reporting Agent', specialty: 'Executive Briefs · Board Packs', icon: 'BarChart3', accent: 'emerald' },
];

const ACCENT_COLORS: Record<string, { text: string; bg: string; border: string; ring: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', ring: 'ring-emerald-500/30' },
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', ring: 'ring-teal-500/30' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', ring: 'ring-cyan-500/30' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', ring: 'ring-violet-500/30' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', ring: 'ring-amber-500/30' },
  rose: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', ring: 'ring-rose-500/30' },
};

function ConfidenceRing({ value, size = 40 }: { value: number; size?: number }) {
  const pct = Math.round(value * 100);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);
  const color = pct >= 70 ? '#2563EB' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">{pct}%</span>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OracleEvolutionPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabId>('forecast');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[210] flex justify-end"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-3xl flex-col border-l"
            style={{ background: '#070707', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between border-b px-5 py-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.15), rgba(59,130,246,0.15))' }}>
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Oracle AI Evolution</h2>
                  <p className="text-[11px] text-white/50">Enterprise AI CFO Capabilities</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Tabs */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {TABS.map((t) => {
                const Icon = t.icon;
                const accent = ACCENT_COLORS[t.accent];
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                      isActive ? `${accent.bg} ${accent.text}` : 'text-white/50 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
              {tab === 'forecast' && <ForecastTab />}
              {tab === 'agents' && <AgentsTab />}
              {tab === 'diagnostics' && <DiagnosticsTab />}
              {tab === 'accuracy' && <AccuracyTab />}
              {tab === 'workspace' && <WorkspaceTab />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══ Forecast Tab ═════════════════════════════════════════════════════════════

function ForecastTab() {
  const [bundle, setBundle] = useState<ForecastBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<ForecastMetric>('revenue');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/oracle/forecast');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBundle(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load forecasts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState label="Computing forecasts..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!bundle) return null;

  const metrics = Array.from(new Set(bundle.forecasts.map((f) => f.metric)));
  const selectedForecasts = bundle.forecasts.filter((f) => f.metric === selectedMetric);

  return (
    <div className="space-y-5 p-5">
      {/* Summary */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="mb-2 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Financial Forecast Summary</h3>
        </div>
        <p className="text-xs leading-relaxed text-white/60">{bundle.summary}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-[11px]">
          <span className="text-white/50">Overall confidence: <span className="font-semibold text-emerald-400">{Math.round(bundle.overallConfidence * 100)}%</span></span>
          <span className="text-white/50">Data points: <span className="font-semibold text-white">{bundle.dataPoints}</span></span>
          <span className="text-white/50">Generated: <span className="font-semibold text-white">{new Date(bundle.generatedAt).toLocaleTimeString()}</span></span>
        </div>
      </div>

      {/* Metric selector */}
      <div className="flex flex-wrap gap-2">
        {metrics.map((m) => {
          const active = m === selectedMetric;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMetric(m)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/[0.08] text-white/50 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          );
        })}
      </div>

      {/* Horizon cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {selectedForecasts.map((f) => (
          <ForecastCard key={f.horizon} forecast={f} />
        ))}
      </div>

      {/* Refresh */}
      <button
        type="button"
        onClick={load}
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh Forecasts
      </button>
    </div>
  );
}

function ForecastCard({ forecast }: { forecast: ForecastPoint }) {
  const trendColor = forecast.trend === 'up' ? 'text-emerald-400' : forecast.trend === 'down' ? 'text-rose-400' : 'text-white/50';
  const trendIcon = forecast.trend === 'up' ? '↗' : forecast.trend === 'down' ? '↘' : '→';
  const horizonLabel = forecast.horizon === 30 ? '30 Days' : forecast.horizon === 90 ? '90 Days' : '1 Year';

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">{horizonLabel}</span>
        <ConfidenceRing value={forecast.confidence} size={36} />
      </div>
      <p className="text-xl font-bold text-white">{formatForecastCurrency(forecast.predicted)}</p>
      <p className={`mt-1 text-xs font-medium ${trendColor}`}>
        {trendIcon} {forecast.changePct > 0 ? '+' : ''}{forecast.changePct.toFixed(0)}% vs run-rate
      </p>
      <div className="mt-3 space-y-1 text-[10px] text-white/40">
        <div className="flex justify-between">
          <span>Range:</span>
          <span className="text-white/60">{formatForecastCurrency(forecast.low)} – {formatForecastCurrency(forecast.high)}</span>
        </div>
        <div className="flex justify-between">
          <span>Current/mo:</span>
          <span className="text-white/60">{formatForecastCurrency(forecast.currentRunRate)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══ Agents Tab ═══════════════════════════════════════════════════════════════

function AgentsTab() {
  const [query, setQuery] = useState('');
  const [routing, setRouting] = useState<{ agent: AgentId; agentName: string; confidence: number; reason: string; alternatives: { agent: AgentId; score: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const route = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/oracle/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRouting(data);
    } catch {
      setRouting(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-5 p-5">
      {/* Agent grid */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">8 Specialist Agents</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {AGENT_META.map((agent) => {
            const accent = ACCENT_COLORS[agent.accent];
            return (
              <div
                key={agent.id}
                className={`rounded-xl border p-3 ${accent.border} ${accent.bg}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent.bg} ${accent.text}`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">{agent.name}</p>
                    <p className="truncate text-[10px] text-white/50">{agent.title}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-white/40">{agent.specialty}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Router demo */}
      <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Auto-Router Demo</h3>
        </div>
        <p className="mb-3 text-[11px] text-white/50">Type a question and Oracle will route it to the best specialist.</p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && route()}
            placeholder="e.g. Why did my GST liability increase?"
            className="flex-1 rounded-lg border px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
          />
          <button
            type="button"
            onClick={route}
            disabled={loading || !query.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Route
          </button>
        </div>

        {routing && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <ConfidenceRing value={routing.confidence} size={44} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{routing.agentName} Agent</p>
                <p className="text-[11px] text-white/50">{routing.reason}</p>
              </div>
            </div>
            {routing.alternatives.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/40">Also considered</p>
                <div className="flex flex-wrap gap-1.5">
                  {routing.alternatives.map((a) => (
                    <span key={a.agent} className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] text-white/50">
                      {a.agent} ({a.score.toFixed(1)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ Diagnostics Tab ══════════════════════════════════════════════════════════

function DiagnosticsTab() {
  const [chains, setChains] = useState<{ id: ChainId; name: string; trigger: string; stepCount: number; leadAgent: AgentId }[]>([]);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningChain, setRunningChain] = useState<ChainId | null>(null);

  useEffect(() => {
    fetch('/api/oracle/diagnose')
      .then((r) => r.json())
      .then((data) => setChains(data.chains ?? []))
      .catch(() => {});
  }, []);

  const runChain = useCallback(async (chainId: ChainId) => {
    setLoading(true);
    setRunningChain(chainId);
    setResult(null);
    try {
      const res = await fetch('/api/oracle/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
      setRunningChain(null);
    }
  }, []);

  return (
    <div className="space-y-5 p-5">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Multi-Step Diagnostic Chains</h3>
        </div>
        <p className="mb-3 text-[11px] text-white/50">Each chain runs a sequence of specialist analyses to solve complex finance problems step-by-step.</p>
        <div className="grid gap-2">
          {chains.map((c) => {
            const accent = ACCENT_COLORS[AGENT_META.find((a) => a.id === c.leadAgent)?.accent ?? 'violet'];
            const isRunning = runningChain === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => runChain(c.id)}
                disabled={loading}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-40 ${accent.border}`}
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white">{c.name}</p>
                  <p className="mt-0.5 text-[10px] text-white/40">{c.trigger} · {c.stepCount} steps · Lead: {c.leadAgent}</p>
                </div>
                {isRunning ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-white/50" />
                ) : (
                  <Play className={`h-4 w-4 ${accent.text}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          {/* Steps trace */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-white">Analysis Trace</h4>
              <ConfidenceRing value={result.confidence} size={36} />
            </div>
            <div className="space-y-2">
              {result.steps.map((step, i) => {
                const statusColor = step.status === 'critical' ? 'text-rose-400' : step.status === 'warning' ? 'text-amber-400' : step.status === 'ok' ? 'text-emerald-400' : 'text-white/50';
                return (
                  <div key={step.stepId} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${statusColor}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {i + 1}
                      </div>
                      {i < result.steps.length - 1 && <div className="h-full w-px flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />}
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-xs font-medium text-white">{step.label}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-white/50">{step.summary}</p>
                      {step.metrics.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {step.metrics.map((m, j) => (
                            <span key={j} className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-white/40">
                              {m.label}: <span className="text-white/70">{m.value}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Root cause */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-violet-400" />
              <h4 className="text-xs font-semibold text-white">Root Cause</h4>
            </div>
            <p className="text-xs leading-relaxed text-white/70">{result.rootCause}</p>
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <h4 className="mb-3 text-xs font-semibold text-white">Recommended Actions</h4>
            <div className="space-y-2">
              {result.recommendations.map((r, i) => {
                const pColor = r.priority === 'high' ? 'text-rose-400' : r.priority === 'medium' ? 'text-amber-400' : 'text-white/50';
                return (
                  <div key={i} className="flex gap-2">
                    <ChevronRight className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${pColor}`} />
                    <div className="flex-1">
                      <p className="text-xs text-white">{r.action}</p>
                      <p className="mt-0.5 text-[10px] text-white/40">{r.impact}</p>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${pColor}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {r.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Accuracy Tab ═════════════════════════════════════════════════════════════

function AccuracyTab() {
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = useCallback(async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/oracle/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer, context: {} }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [answer]);

  return (
    <div className="space-y-5 p-5">
      <div>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">AI Accuracy Validation</h3>
        </div>
        <p className="mb-3 text-[11px] text-white/50">Paste an Oracle answer to check for hallucinated numbers, GST errors, missing citations, and contradictions.</p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Paste Oracle's answer here..."
          rows={5}
          className="w-full resize-none rounded-lg border px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
        />
        <button
          type="button"
          onClick={validate}
          disabled={loading || !answer.trim()}
          className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
        >
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Validate Answer
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ConfidenceRing value={result.adjustedConfidence} size={48} />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {result.valid ? (
                      <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Passed</span>
                    ) : (
                      <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-rose-400" /> {result.requiresReview ? 'Needs Review' : 'Issues Found'}</span>
                    )}
                  </p>
                  <p className="text-[11px] text-white/50">{result.summary}</p>
                </div>
              </div>
            </div>
          </div>

          {result.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-white">Issues Detected ({result.issues.length})</h4>
              {result.issues.map((issue, i) => {
                const sevColor = issue.severity === 'fail' ? 'border-rose-500/20 bg-rose-500/5' : issue.severity === 'warning' ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/[0.08]';
                const sevIcon = issue.severity === 'fail' ? 'text-rose-400' : 'text-amber-400';
                return (
                  <div key={i} className={`rounded-lg border p-3 ${sevColor}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-3.5 w-3.5 ${sevIcon}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">{issue.type.replace(/_/g, ' ')}</span>
                      <span className={`ml-auto text-[9px] font-bold uppercase ${sevIcon}`}>{issue.severity}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/70">{issue.message}</p>
                    {issue.correction && (
                      <p className="mt-1.5 text-[10px] text-emerald-400/80">→ {issue.correction}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══ Workspace Tab ════════════════════════════════════════════════════════════

function WorkspaceTab() {
  // Lazy-initialize from localStorage (client-side). Use a tick counter to
  // trigger re-reads after mutations without calling setState inside an effect.
  const [tick, setTick] = useState(0);
  const store = useMemo(() => loadWorkspaceStore(), [tick]);
  const stats = useMemo(() => getWorkspaceStats(), [tick]);
  const [newPromptTitle, setNewPromptTitle] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptAgent, setNewPromptAgent] = useState<AgentId | 'general'>('general');

  const reload = useCallback(() => setTick((t) => t + 1), []);

  if (!store || !stats) return <LoadingState label="Loading workspace..." />;

  const handleSavePrompt = () => {
    if (!newPromptTitle.trim() || !newPromptText.trim()) return;
    savePrompt({
      title: newPromptTitle,
      prompt: newPromptText,
      agentId: newPromptAgent === 'general' ? undefined : newPromptAgent,
      category: newPromptAgent,
    });
    setNewPromptTitle('');
    setNewPromptText('');
    reload();
  };

  return (
    <div className="space-y-5 p-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Pinned', value: stats.totalPinned, icon: Pin, color: 'text-emerald-400' },
          { label: 'Prompts', value: stats.totalPrompts, icon: FileText, color: 'text-teal-400' },
          { label: 'Drafts', value: stats.totalDrafts, icon: Edit3, color: 'text-amber-400' },
          { label: 'Favorites', value: stats.totalFavorites, icon: Star, color: 'text-rose-400' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border p-3 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <Icon className={`mx-auto mb-1 h-4 w-4 ${s.color}`} />
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-white/40">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Saved Prompts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white">Saved Prompts</h3>
          </div>
          <span className="text-[10px] text-white/40">{store.savedPrompts.length} total</span>
        </div>

        {/* New prompt form */}
        <div className="mb-3 rounded-xl border p-3" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <input
            value={newPromptTitle}
            onChange={(e) => setNewPromptTitle(e.target.value)}
            placeholder="Prompt title..."
            className="mb-2 w-full rounded-lg border px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
          />
          <textarea
            value={newPromptText}
            onChange={(e) => setNewPromptText(e.target.value)}
            placeholder="Prompt text..."
            rows={2}
            className="mb-2 w-full resize-none rounded-lg border px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
          />
          <div className="flex items-center gap-2">
            <select
              value={newPromptAgent}
              onChange={(e) => setNewPromptAgent(e.target.value as AgentId | 'general')}
              className="flex-1 rounded-lg border px-2 py-1.5 text-[11px] text-white focus:outline-none"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: '#111111' }}
            >
              <option value="general">General</option>
              {AGENT_META.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSavePrompt}
              disabled={!newPromptTitle.trim() || !newPromptText.trim()}
              className="rounded-lg bg-teal-500/10 px-3 py-1.5 text-[11px] font-medium text-teal-400 transition-colors hover:bg-teal-500/20 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>

        {/* Prompt list */}
        <div className="max-h-80 space-y-1.5 overflow-y-auto custom-scrollbar">
          {store.savedPrompts.map((p) => (
            <PromptRow key={p.id} prompt={p} onChange={reload} />
          ))}
        </div>
      </div>

      {/* Recent Actions */}
      {store.recentActions.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Recent Actions</h3>
          </div>
          <div className="space-y-1.5">
            {store.recentActions.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <div className={`h-1.5 w-1.5 rounded-full ${a.status === 'success' ? 'bg-emerald-400' : a.status === 'failed' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                <span className="flex-1 text-xs text-white/70">{a.label}</span>
                <span className="text-[10px] text-white/30">{new Date(a.executedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shared */}
      {store.shared.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Share2 className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Shared Conversations</h3>
          </div>
          <div className="space-y-1.5">
            {store.shared.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <Share2 className="h-3.5 w-3.5 text-cyan-400" />
                <span className="flex-1 text-xs text-white/70">{s.title}</span>
                <span className="rounded border border-white/[0.08] px-1.5 py-0.5 text-[9px] font-mono text-white/50">{s.shareToken}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PromptRow({ prompt, onChange }: { prompt: SavedPrompt; onChange: () => void }) {
  const accent = ACCENT_COLORS[AGENT_META.find((a) => a.id === prompt.agentId)?.accent ?? 'emerald'];
  return (
    <div className="group rounded-lg border p-2.5 transition-colors hover:bg-white/[0.03]" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-white">{prompt.title}</p>
            {prompt.useCount > 0 && <span className="text-[9px] text-white/30">· used {prompt.useCount}×</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] text-white/40">{prompt.prompt}</p>
        </div>
        <button
          type="button"
          onClick={() => { incrementPromptUse(prompt.id); onChange(); }}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title="Use prompt"
        >
          <Zap className={`h-3.5 w-3.5 ${accent.text}`} />
        </button>
        <button
          type="button"
          onClick={() => { deletePrompt(prompt.id); onChange(); }}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          title="Delete"
        >
          <X className="h-3.5 w-3.5 text-white/40 hover:text-rose-400" />
        </button>
      </div>
    </div>
  );
}

// ═══ Shared UI ════════════════════════════════════════════════════════════════

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
        <p className="text-xs text-white/50">{label}</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-6 w-6 text-rose-400" />
        <p className="text-xs text-white/60">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.05]"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
