'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AI CEO™ — AUTONOMOUS BUSINESS OPERATING SYSTEM SECTIONS
//
// Renders the full AI CEO Engine bundle on top of the existing Firm Command
// Center (AI CEO) page. Additive only — does NOT modify or replace any
// existing UI. All values come from REAL connected business data via the
// /api/ceo/dashboard endpoint.
//
// Sections (per AI CEO Engine spec):
//   1.  CEO Header (Live status + Data sources)
//   2.  Live Business State (12 metrics: revenue/profit/cash/WC/GST/ITC/etc.)
//   3.  Daily CEO Brief™ (greeting + executive summary + one-liner + priorities)
//   4.  Executive Decision Engine™ (decision cards with approve/reject/execute)
//   5.  Executive Alert System™ (severity-colored alert feed)
//   6.  Autonomous Task Engine™ (auto-created tasks)
//   7.  AI Strategy Engine™ (active strategies with KPIs)
//   8.  Business Goals™ (progress bars with status)
//   9.  CEO Memory™ (recent memories)
//  10.  Autonomous Workflow Engine™ (workflow templates)
//  11.  Board Meeting Mode™ (collapsible board report)
//
// Tagline: VEYRO AI CEO™ — Run Your Business. Not Your Software.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Brain, TrendingUp, TrendingDown, Wallet, IndianRupee, FileText,
  Sparkles, AlertTriangle, CheckCircle2, Lightbulb, Activity, Clock,
  RefreshCw, ChevronRight, Zap, Target, ShieldAlert, Users, Send,
  FileBarChart, Eye, Play, Ban, Rocket, Radio, Gauge, Calendar,
  CheckCircle, XCircle, AlertOctagon, ListChecks, Workflow, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import type {
  CEODashboard, ExecutiveDecision, ExecutiveAlert, AutonomousTask,
  Strategy, BusinessGoal, CEOMemory, DailyCEOBrief,
  DecisionStatus, DecisionPriority, AlertSeverity,
} from '@/lib/ceo/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatINRFull(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function formatPct(p: number, decimals = 1): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(decimals)}%`;
}

function priorityColor(p: DecisionPriority): string {
  switch (p) {
    case 'critical': return 'border-red-500/40 bg-red-500/[0.08]';
    case 'high': return 'border-orange-500/30 bg-orange-500/[0.06]';
    case 'medium': return 'border-amber-500/30 bg-amber-500/[0.05]';
    default: return 'border-cyan-500/30 bg-cyan-500/[0.04]';
  }
}

function priorityBadge(p: DecisionPriority): string {
  switch (p) {
    case 'critical': return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'high': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'medium': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    default: return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  }
}

function severityColor(s: AlertSeverity | DecisionPriority): string {
  switch (s) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-orange-400';
    case 'medium': return 'text-amber-400';
    case 'low': return 'text-emerald-400';
    case 'info': return 'text-cyan-400';
    default: return 'text-slate-400';
  }
}

function severityBg(s: AlertSeverity): string {
  switch (s) {
    case 'critical': return 'border-red-500/40 bg-red-500/[0.08]';
    case 'high': return 'border-orange-500/30 bg-orange-500/[0.06]';
    case 'medium': return 'border-amber-500/30 bg-amber-500/[0.05]';
    case 'low': return 'border-emerald-500/30 bg-emerald-500/[0.04]';
    default: return 'border-cyan-500/30 bg-cyan-500/[0.04]';
  }
}

function statusColor(s: DecisionStatus): string {
  switch (s) {
    case 'executed':
    case 'auto_approved':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'approved':
    case 'executing':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'rejected':
    case 'failed':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'superseded':
      return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    default:
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Animated number hook ─────────────────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 1000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ─── Animated Metric Card ─────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, accent = 'emerald', trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: 'emerald' | 'orange' | 'amber' | 'cyan' | 'red' | 'slate';
  trend?: number;
}) {
  const accentMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    orange: 'text-orange-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    red: 'text-red-400',
    slate: 'text-slate-400',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="bg-slate-900/60 border-slate-800 hover:border-slate-700 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{label}</span>
            <Icon className={`h-4 w-4 ${accentMap[accent]}`} />
          </div>
          <p className="text-xl font-bold text-white tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-[11px] mt-1 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPct(trend)}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Decision Card ────────────────────────────────────────────────────────────

function DecisionCard({
  decision, onApprove, onReject, onExecute, busy,
}: {
  decision: ExecutiveDecision;
  onApprove: () => void;
  onReject: () => void;
  onExecute: () => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`rounded-lg border ${priorityColor(decision.priority)} p-4`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={`text-[10px] uppercase ${priorityBadge(decision.priority)}`}>
              {decision.priority}
            </Badge>
            <Badge variant="outline" className={`text-[10px] uppercase ${statusColor(decision.status)}`}>
              {decision.status.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase border-slate-700 text-slate-400">
              {decision.type.replace(/_/g, ' ')}
            </Badge>
            {decision.approvalRequired !== 'none' && (
              <Badge variant="outline" className="text-[10px] uppercase border-purple-500/30 text-purple-400">
                needs {decision.approvalRequired}
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">{decision.title}</h4>
          <p className="text-xs text-slate-400 line-clamp-2">{decision.reason}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-500 uppercase">Financial Impact</p>
          <p className={`text-sm font-bold tabular-nums ${decision.financialImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {decision.financialImpact >= 0 ? '+' : ''}{formatINR(decision.financialImpact)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Confidence {decision.confidence}%</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button
          size="sm"
          variant="default"
          disabled={busy || decision.status === 'executed' || decision.status === 'rejected' || decision.status === 'executing'}
          onClick={onApprove}
          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500"
        >
          <CheckCircle className="h-3 w-3" /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || decision.status === 'executed' || decision.status === 'rejected'}
          onClick={onExecute}
          className="h-7 text-xs gap-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
        >
          <Play className="h-3 w-3" /> Execute
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || decision.status === 'executed' || decision.status === 'rejected'}
          onClick={onReject}
          className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <Ban className="h-3 w-3" /> Reject
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((e) => !e)}
          className="h-7 text-xs gap-1 text-slate-400 hover:text-slate-200"
        >
          <Eye className="h-3 w-3" /> {expanded ? 'Hide' : 'Details'}
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-slate-800 space-y-3"
          >
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Business Impact</p>
              <p className="text-xs text-slate-300">{decision.businessImpact}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Rollback Plan</p>
              <p className="text-xs text-slate-300">{decision.rollbackPlan}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Actions</p>
              <ul className="space-y-1">
                {decision.actions.map((a, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-cyan-400 mt-0.5">→</span>
                    <span>
                      <span className="font-medium">{a.label}</span>
                      <span className="text-slate-500"> · {a.agent} · {a.estimatedMinutes}m{a.automated ? ' · automated' : ''}{a.destructive ? ' · destructive' : ''}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 mb-1">Evidence</p>
              <ul className="space-y-1">
                {decision.evidence.map((e, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                    <Sparkles className="h-3 w-3 mt-0.5 text-amber-400" />
                    <span><span className="text-slate-500">[{e.source}]</span> {e.fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: ExecutiveAlert }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-lg border ${severityBg(alert.severity)} p-3`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor(alert.severity)}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white truncate">{alert.title}</p>
            <Badge variant="outline" className={`text-[10px] uppercase ${severityColor(alert.severity)} border-current`}>
              {alert.severity}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 line-clamp-2">{alert.message}</p>
          <p className="text-[10px] text-slate-500 mt-1">{timeAgo(alert.detectedAt)} · {alert.type.replace(/_/g, ' ')}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

function StrategyCard({ strategy }: { strategy: Strategy }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px] uppercase border-purple-500/30 text-purple-400">
              {strategy.category}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase border-slate-700 text-slate-400">
              {strategy.status.replace('_', ' ')}
            </Badge>
          </div>
          <h4 className="text-sm font-semibold text-white">{strategy.title}</h4>
          <p className="text-xs text-slate-400 line-clamp-2 mt-1">{strategy.description}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-500 uppercase">Expected ROI</p>
          <p className="text-sm font-bold text-emerald-400">{formatINR(strategy.expectedROI)}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{formatPct(strategy.expectedROIPct)} · {strategy.confidence}% conf</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Progress</span>
          <span className="tabular-nums">{strategy.progressPct.toFixed(0)}% · {strategy.timeline}</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, strategy.progressPct)}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
      </div>

      {/* KPIs */}
      {strategy.kpis.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {strategy.kpis.slice(0, 6).map((kpi, i) => {
            const progress = kpi.target > kpi.baseline
              ? Math.min(100, ((kpi.current - kpi.baseline) / (kpi.target - kpi.baseline)) * 100)
              : Math.min(100, ((kpi.baseline - kpi.current) / (kpi.baseline - kpi.target)) * 100);
            const fmt = (v: number) => kpi.unit === 'inr' ? formatINR(v) : kpi.unit === 'pct' ? `${v.toFixed(1)}%` : kpi.unit === 'days' ? `${Math.round(v)}d` : String(Math.round(v));
            return (
              <div key={i} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                <p className="text-[10px] text-slate-500 truncate">{kpi.name}</p>
                <p className="text-xs font-semibold text-white tabular-nums">{fmt(kpi.current)} <span className="text-slate-500 font-normal">/ {fmt(kpi.target)}</span></p>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal }: { goal: BusinessGoal }) {
  const statusColorMap: Record<string, string> = {
    on_track: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    achieved: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300',
    at_risk: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    behind: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    overdue: 'border-red-500/30 bg-red-500/10 text-red-400',
  };
  const fmt = (v: number) => goal.unit === 'inr' ? formatINR(v) : goal.unit === 'pct' ? `${v.toFixed(1)}%` : goal.unit === 'days' ? `${Math.round(v)}d` : String(Math.round(v));
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-white">{goal.title}</p>
        <Badge variant="outline" className={`text-[10px] uppercase ${statusColorMap[goal.status] ?? statusColorMap.behind}`}>
          {goal.status.replace('_', ' ')}
        </Badge>
      </div>
      <p className="text-xs text-slate-400 mb-2">{goal.description}</p>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
        <span className="tabular-nums">{fmt(goal.current)} <span className="text-slate-600">/ {fmt(goal.target)}</span></span>
        <span className="tabular-nums">{goal.progressPct.toFixed(0)}% {goal.trendPct >= 0 ? `↑${formatPct(goal.trendPct, 0)}` : `↓${formatPct(goal.trendPct, 0)}`}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${goal.status === 'achieved' ? 'bg-emerald-400' : goal.status === 'on_track' ? 'bg-emerald-500' : goal.status === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, goal.progressPct)}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AICEOSections() {
  const [data, setData] = useState<CEODashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showBoardReport, setShowBoardReport] = useState(false);
  const { toast } = useToast();

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ceo/dashboard?role=ceo');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('[AICEO] Failed to load dashboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const callMutation = useCallback(async (endpoint: string, body: Record<string, unknown>, successMsg: string) => {
    try {
      setBusyId(body.decisionId as string);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      toast({
        title: 'Action completed',
        description: successMsg,
      });
      await fetchDashboard();
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  }, [fetchDashboard, toast]);

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full bg-slate-900/60" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-slate-900/60" />
          ))}
        </div>
        <Skeleton className="h-48 w-full bg-slate-900/60" />
        <Skeleton className="h-48 w-full bg-slate-900/60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-slate-300 mb-3">AI CEO Engine is loading live data…</p>
          <Button onClick={fetchDashboard} size="sm" variant="outline">
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const brief = data.brief;
  const liveState = data.liveState;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ═══════ SECTION 1 — CEO HEADER ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/30">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI CEO Engine™</h2>
                <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  <Radio className="h-3 w-3 animate-pulse" /> LIVE
                </Badge>
              </div>
              <p className="text-xs text-slate-400">Autonomous Business Operating System · Run Your Business. Not Your Software.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchDashboard} size="sm" variant="outline" disabled={loading} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button onClick={() => setShowBoardReport((s) => !s)} size="sm" variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
              <FileBarChart className="h-3 w-3" /> Board Report
            </Button>
          </div>
        </div>
        {!data.hasLiveData && (
          <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-300">
            <ShieldAlert className="h-3 w-3 inline mr-1" />
            Connect GSTN, Bank, and Accounting to activate autonomous decisions. Showing partial state.
          </div>
        )}
        {data.dataSources.length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-500">Connected:</span>
            {data.dataSources.map((src) => (
              <Badge key={src} variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                {src}
              </Badge>
            ))}
          </div>
        )}
      </motion.div>

      {/* ═══════ SECTION 2 — LIVE BUSINESS STATE ═══════ */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" /> Live Business State
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Revenue MTD" value={formatINR(liveState.revenue)} icon={IndianRupee} accent="emerald" />
          <MetricCard label="Profit MTD" value={formatINR(liveState.profit)} icon={TrendingUp} accent={liveState.profit >= 0 ? 'emerald' : 'red'} />
          <MetricCard label="Cash" value={formatINR(liveState.cash)} icon={Wallet} accent="cyan" sub={`Runway ${liveState.runwayDays}d`} />
          <MetricCard label="Working Capital" value={formatINR(liveState.workingCapital)} icon={Gauge} accent="emerald" />
          <MetricCard label="GST Payable" value={formatINR(liveState.gstPayable)} icon={FileText} accent={liveState.gstPayable > 0 ? 'amber' : 'emerald'} sub={`ITC: ${formatINR(liveState.itc)}`} />
          <MetricCard label="Receivables" value={formatINR(liveState.receivables)} icon={Clock} accent="orange" sub={`Payables: ${formatINR(liveState.payables)}`} />
          <MetricCard label="Expenses MTD" value={formatINR(liveState.expenses)} icon={TrendingDown} accent="amber" sub={`Burn ${formatINR(liveState.burnRate)}/mo`} />
          <MetricCard label="Employees" value={String(liveState.employees)} icon={Users} accent="slate" sub={`Payroll ${formatINR(liveState.payroll)}/mo`} />
          <MetricCard label="Clients" value={String(liveState.clients)} icon={Users} accent="cyan" />
          <MetricCard label="Health Score" value={`${liveState.healthScore}/100`} icon={Sparkles} accent={liveState.healthScore >= 65 ? 'emerald' : liveState.healthScore >= 50 ? 'amber' : 'red'} />
          <MetricCard label="Risk Score" value={`${liveState.riskScore}/100`} icon={ShieldAlert} accent={liveState.riskScore < 30 ? 'emerald' : liveState.riskScore < 60 ? 'amber' : 'red'} />
          <MetricCard label="Forecast 30d Rev" value={formatINR(liveState.forecastRevenue30d)} icon={Rocket} accent="emerald" sub={`${liveState.forecastConfidencePct}% conf`} />
        </div>
      </div>

      {/* ═══════ SECTION 3 — DAILY CEO BRIEF ═══════ */}
      {brief && (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
              <Brain className="h-4 w-4 text-emerald-400" /> Daily CEO Brief™
              <span className="text-xs text-slate-500 font-normal ml-auto">{brief.greeting} · {brief.asOfDay}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
              <p className="text-xs text-slate-300 leading-relaxed">{brief.executiveSummary}</p>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.04] p-3">
              <p className="text-[11px] uppercase text-slate-500 mb-1">Today&apos;s Focus</p>
              <p className="text-sm font-medium text-cyan-300">{brief.oneLiner}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Priorities */}
              <div>
                <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
                  <Target className="h-3 w-3" /> Today&apos;s Priorities ({brief.todaysPriorities.length})
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {brief.todaysPriorities.length === 0 ? (
                    <p className="text-xs text-slate-500">No critical priorities today.</p>
                  ) : brief.todaysPriorities.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`rounded border ${priorityColor(p.priority)} p-2`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-xs font-semibold text-white">{p.title}</p>
                        <Badge variant="outline" className={`text-[9px] uppercase ${priorityBadge(p.priority)}`}>{p.priority}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{p.reason}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Impact: {p.impact} · Deadline: {p.deadline}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Critical Risks */}
              <div>
                <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Critical Risks ({brief.criticalRisks.length})
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {brief.criticalRisks.length === 0 ? (
                    <p className="text-xs text-slate-500">No critical risks detected.</p>
                  ) : brief.criticalRisks.map((r, i) => (
                    <div key={i} className={`rounded border ${severityBg(r.severity as AlertSeverity)} p-2`}>
                      <p className="text-xs font-semibold text-white">{r.title}</p>
                      <p className="text-[11px] text-slate-400">{r.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* GST Deadlines + Collections side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> GST Deadlines ({brief.gstDeadlines.length})
                </p>
                <div className="space-y-1">
                  {brief.gstDeadlines.length === 0 ? (
                    <p className="text-xs text-slate-500">No upcoming deadlines.</p>
                  ) : brief.gstDeadlines.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-950/40 border border-slate-800">
                      <span className="text-slate-300">{d.returnType} {d.period}</span>
                      <div className="flex items-center gap-2">
                        <span className={`tabular-nums ${d.daysLeft <= 3 ? 'text-red-400' : d.daysLeft <= 7 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d overdue` : `${d.daysLeft}d left`}
                        </span>
                        <Badge variant="outline" className={`text-[9px] uppercase ${
                          d.status === 'overdue' ? 'border-red-500/30 text-red-400' :
                          d.status === 'ready' ? 'border-amber-500/30 text-amber-400' :
                          d.status === 'filed' ? 'border-emerald-500/30 text-emerald-400' :
                          'border-slate-700 text-slate-400'
                        }`}>{d.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase text-slate-500 mb-2 flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" /> Collections Due ({brief.collections.length})
                </p>
                <div className="space-y-1">
                  {brief.collections.length === 0 ? (
                    <p className="text-xs text-slate-500">No overdue collections.</p>
                  ) : brief.collections.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-slate-950/40 border border-slate-800">
                      <div className="min-w-0">
                        <p className="text-slate-300 truncate">{c.client}</p>
                        <p className="text-[10px] text-slate-500">{c.daysOverdue}d overdue · {c.action}</p>
                      </div>
                      <span className="text-amber-400 font-semibold tabular-nums">{formatINR(c.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bank + Payroll */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[11px] uppercase text-slate-500 mb-1">Bank Balance</p>
                <p className="text-lg font-bold text-cyan-400 tabular-nums">{formatINR(brief.bankBalance.totalBalance)}</p>
                <div className="mt-1 space-y-0.5">
                  {brief.bankBalance.accounts.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">{a.bank}</span>
                      <span className="text-slate-300 tabular-nums">{formatINR(a.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[11px] uppercase text-slate-500 mb-1">Payroll Status</p>
                <p className="text-lg font-bold text-white tabular-nums">{formatINR(brief.payrollStatus.amount)}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {brief.payrollStatus.headcount} employees · Next run {new Date(brief.payrollStatus.nextRunDate).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>

            <div className="rounded border border-purple-500/20 bg-purple-500/[0.04] p-2">
              <p className="text-[11px] uppercase text-slate-500 mb-1">Top Opportunity</p>
              <p className="text-sm text-purple-300">{brief.topOpportunity}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════ SECTION 4 — EXECUTIVE DECISION ENGINE ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Zap className="h-4 w-4 text-amber-400" /> Executive Decision Engine™
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 ml-2">
              {data.pendingDecisionCount} pending
            </Badge>
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.decisions.length} total active</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.decisions.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-300">No active decisions. Business is operating smoothly.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px] pr-2">
              <div className="space-y-3">
                <AnimatePresence>
                  {data.decisions.map((d) => (
                    <DecisionCard
                      key={d.id}
                      decision={d}
                      busy={busyId === d.id}
                      onApprove={() => callMutation('/api/ceo/approve', { decisionId: d.id, role: 'ceo' }, `Approved: ${d.title}`)}
                      onReject={() => callMutation('/api/ceo/reject', { decisionId: d.id, role: 'ceo' }, `Rejected: ${d.title}`)}
                      onExecute={() => callMutation('/api/ceo/execute', { decisionId: d.id, role: 'ceo' }, `Executed: ${d.title}`)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 5 — EXECUTIVE ALERTS ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <AlertOctagon className="h-4 w-4 text-red-400" /> Executive Alert System™
            {data.criticalAlertCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 bg-red-500/10 ml-2 animate-pulse">
                {data.criticalAlertCount} critical
              </Badge>
            )}
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.activeAlertCount} active</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.alerts.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-slate-300">No alerts. All systems normal.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-80 pr-2">
              <div className="space-y-2">
                {data.alerts.slice(0, 12).map((a) => <AlertCard key={a.id} alert={a} />)}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 6 — AUTONOMOUS TASKS ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <ListChecks className="h-4 w-4 text-cyan-400" /> Autonomous Task Engine™
            <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-400 ml-2">
              {data.openTaskCount} open
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.tasks.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No autonomous tasks queued.</p>
          ) : (
            <ScrollArea className="max-h-80 pr-2">
              <div className="space-y-2">
                {data.tasks.slice(0, 10).map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded border ${priorityColor(t.priority)} p-2.5`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-white">{t.title}</p>
                      <Badge variant="outline" className={`text-[9px] uppercase ${priorityBadge(t.priority)}`}>{t.priority}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{t.description}</p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                      <span>Owner: {t.owner} · Deadline {new Date(t.deadline).toLocaleDateString('en-IN')}</span>
                      <span className={`uppercase ${t.status === 'completed' ? 'text-emerald-400' : t.status === 'open' ? 'text-amber-400' : 'text-slate-400'}`}>{t.status}</span>
                    </div>
                    {t.aiExplanation && (
                      <p className="text-[10px] text-slate-500 mt-1 italic">AI: {t.aiExplanation}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 7 — STRATEGIES ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Rocket className="h-4 w-4 text-purple-400" /> AI Strategy Engine™
            <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 ml-2">
              {data.activeStrategyCount} active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.strategies.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No active strategies. Connect more data sources to enable strategy planning.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.strategies.slice(0, 6).map((s) => <StrategyCard key={s.id} strategy={s} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 8 — BUSINESS GOALS ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Target className="h-4 w-4 text-emerald-400" /> Business Goals™
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.goals.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No goals set.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {data.goals.map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 9 — CEO MEMORY ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Brain className="h-4 w-4 text-cyan-400" /> CEO Memory™
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.memory.length} memories</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.memory.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No memories recorded yet.</p>
          ) : (
            <ScrollArea className="max-h-72 pr-2">
              <div className="space-y-2">
                {data.memory.slice(0, 10).map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded border border-slate-800 bg-slate-950/40 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] uppercase border-slate-700 text-slate-400">{m.memoryType.replace('_', ' ')}</Badge>
                        <p className="text-xs font-semibold text-white">{m.title}</p>
                      </div>
                      <span className="text-[10px] text-slate-500">{timeAgo(m.occurredAt)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{m.description}</p>
                    {m.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {m.tags.slice(0, 4).map((t) => (
                          <span key={t} className="text-[9px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ═══════ SECTION 10 — WORKFLOWS ═══════ */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
            <Workflow className="h-4 w-4 text-amber-400" /> Autonomous Workflow Engine™
            <span className="text-xs text-slate-500 font-normal ml-auto">{data.workflows.length} templates</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {data.workflows.map((w) => (
              <div key={w.type} className="rounded border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-white">{w.label}</p>
                  {w.destructive ? (
                    <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400">destructive</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">safe</Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{w.description}</p>
                <div className="text-[10px] text-slate-500">
                  {w.steps.length} steps · {w.estimatedMinutes}m · needs {w.requiresApproval}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══════ SECTION 11 — BOARD REPORT (collapsible) ═══════ */}
      <AnimatePresence>
        {showBoardReport && data.boardReport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-slate-900/60 border-purple-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                  <FileBarChart className="h-4 w-4 text-purple-400" /> Board Meeting Mode™
                  <span className="text-xs text-slate-500 font-normal ml-auto">{data.boardReport.period}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded border border-purple-500/20 bg-purple-500/[0.04] p-3">
                  <p className="text-[11px] uppercase text-slate-500 mb-1">Executive Summary</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{data.boardReport.executiveSummary}</p>
                </div>

                {/* Financial Summary */}
                <div>
                  <p className="text-[11px] uppercase text-slate-500 mb-2">Financial Summary</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[10px] text-slate-500">Revenue</p>
                      <p className="text-sm font-bold text-white tabular-nums">{formatINR(data.boardReport.financialSummary.revenue)}</p>
                      <p className={`text-[10px] ${data.boardReport.financialSummary.revenueChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(data.boardReport.financialSummary.revenueChangePct)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[10px] text-slate-500">Profit</p>
                      <p className="text-sm font-bold text-white tabular-nums">{formatINR(data.boardReport.financialSummary.profit)}</p>
                      <p className={`text-[10px] ${data.boardReport.financialSummary.profitChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(data.boardReport.financialSummary.profitChangePct)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[10px] text-slate-500">Cash</p>
                      <p className="text-sm font-bold text-white tabular-nums">{formatINR(data.boardReport.financialSummary.cash)}</p>
                      <p className={`text-[10px] ${data.boardReport.financialSummary.cashChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPct(data.boardReport.financialSummary.cashChangePct)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[10px] text-slate-500">EBITDA</p>
                      <p className="text-sm font-bold text-white tabular-nums">{formatINR(data.boardReport.financialSummary.ebitda)}</p>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950/40 p-2">
                      <p className="text-[10px] text-slate-500">GST Paid</p>
                      <p className="text-sm font-bold text-white tabular-nums">{formatINR(data.boardReport.financialSummary.gstPaid)}</p>
                    </div>
                  </div>
                </div>

                {/* Major Risks */}
                <div>
                  <p className="text-[11px] uppercase text-slate-500 mb-2">Major Risks</p>
                  <div className="space-y-1">
                    {data.boardReport.majorRisks.slice(0, 5).map((r, i) => (
                      <div key={i} className={`rounded border ${severityBg(r.severity as AlertSeverity)} p-2`}>
                        <p className="text-xs font-semibold text-white">{r.title}</p>
                        <p className="text-[11px] text-slate-400">Mitigation: {r.mitigation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations + Future Strategy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[11px] uppercase text-slate-500 mb-2">Recommendations</p>
                    <ul className="space-y-1">
                      {data.boardReport.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" /> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-slate-500 mb-2">Future Strategy</p>
                    <ul className="space-y-1">
                      {data.boardReport.futureStrategy.map((s, i) => (
                        <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                          <Rocket className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer tagline */}
      <div className="text-center pt-2">
        <p className="text-[11px] text-slate-500 italic">
          VEYRO AI CEO™ — Run Your Business. Not Your Software. · Founded by Prince Singh
        </p>
      </div>
    </div>
  );
}
