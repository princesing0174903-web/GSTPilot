'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS ENTERPRISE™ — SELF-RUNNING BUSINESS OS
//
// The World's First Autonomous Enterprise Operating System.
// Think. Decide. Execute. Learn. Grow.
//
// Oracle plans, decides, executes, monitors, learns & continuously improves
// every business operation from REAL connected data. 9 AI executives
// collaborate continuously. Everything is logged.
//
// Sections:
//   1. Executive Command Center (live metrics)
//   2. Voice Execution bar ("Run my company today")
//   3. Autonomous Company Engine (observation)
//   4. Nine AI Executives (collaborating)
//   5. AI Decision Engine (decisions with reasoning/ROI/rollback)
//   6. AI Strategy Room (boardroom debates)
//   7. Continuous Planning (daily/weekly/monthly/quarterly/yearly + roadmaps)
//   8. Goal Engine (live progress tracking)
//   9. Autonomous Workflows (action chains)
//  10. Digital Twin Simulator 2.0 (what-if scenarios)
//  11. Enterprise Memory (searchable forever)
//  12. Autonomous Alerts (fraud/cash/compliance/churn/...)
//  13. Learning Engine (every execution improves future decisions)
//  14. Self-Healing System (retry/failover/rollback)
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Brain, Settings2, TrendingUp, Shield, Scale, Users, Megaphone,
  RefreshCw, Cpu as CpuIcon, Activity, Wallet, Receipt, Banknote, AlertTriangle,
  Sparkles, Loader2, Play, CheckCircle2, XCircle, Clock, ArrowRight, Send,
  Search, Zap, Target, GitBranch, FlaskConical, Database, Server, Gauge,
  Bot, MessageSquare, FileText, Lightbulb, HeartPulse, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AUTONOMOUS_TAGLINE, AUTONOMOUS_SUBTAGLINE, AUTONOMOUS_FOUNDER,
  type AutonomousDashboard, type AutonomousDecision, type StrategyMeeting,
  type ContinuousPlan, type AutonomousGoal, type AutonomousWorkflow,
  type StrategySimulation, type AutonomousAlert, type LearningInsight,
  type SystemHealthCheck, type ExecutiveAgent, type VoiceCommand,
  type SimulationScenario,
} from '@/lib/autonomous/types';
import { SCENARIO_META } from '@/lib/autonomous/simulator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtINR(n: number): string {
  if (!isFinite(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function statusColor(status: string): string {
  if (['executed', 'approved', 'completed', 'healthy', 'achieved', 'auto_approved', 'on_track', 'recovered', 'proceed'].includes(status)) return 'text-emerald-400';
  if (['failed', 'rejected', 'down', 'overdue', 'behind', 'avoid', 'critical', 'aborted'].includes(status)) return 'text-red-400';
  if (['pending', 'running', 'in_progress', 'queued', 'debating', 'opened', 'at_risk', 'caution', 'degraded', 'recovering', 'deferred', 'needs_review'].includes(status)) return 'text-amber-400';
  return 'text-muted-foreground';
}

function severityColor(sev: string): string {
  if (sev === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (sev === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  if (sev === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (sev === 'low') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
}

function approvalColor(req: string): string {
  if (req === 'none') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (req === 'notify') return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
  if (req === 'manager') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  if (req === 'cfo') return 'bg-orange-500/10 text-orange-300 border-orange-500/20';
  if (req === 'ceo') return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
  return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
}

const EXEC_EMOJI: Record<string, string> = {
  ceo: '👑', cfo: '💰', coo: '⚙️', cto: '🛠️', cro: '📈',
  legal: '⚖️', hr: '👥', marketing: '📣', operations: '🔄',
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold mt-1 ${accent ?? 'text-foreground'}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
          <div className="shrink-0 rounded-lg bg-white/[0.04] p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Executive Card ───────────────────────────────────────────────────────────

function ExecutiveCard({ exec }: { exec: ExecutiveAgent }) {
  const m = exec.metrics;
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16] transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{exec.emoji}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{exec.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{exec.title}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 line-clamp-3">{exec.mandate}</p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Decisions 30d</span>
            <span className="font-semibold">{m.decisionsLast30d}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Auto-executed</span>
            <span className="font-semibold text-emerald-400">{m.autoExecutedLast30d}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Avg confidence</span>
            <span className="font-semibold">{Math.round(m.avgConfidence * 100)}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-muted-foreground">Active tasks</span>
            <span className="font-semibold text-amber-400">{m.activeTasks}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Decision Card ────────────────────────────────────────────────────────────

function DecisionCard({ d, onApprove, onReject, onExecute }: {
  d: AutonomousDecision;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
}) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={approvalColor(d.approvalRequired)}>
                {d.approvalRequired === 'none' ? 'auto' : d.approvalRequired}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {EXEC_EMOJI[d.proposedBy]} {d.proposedBy.toUpperCase()}
              </Badge>
              <span className={`text-[11px] font-semibold ${statusColor(d.status)}`}>{d.status.replace('_', ' ')}</span>
            </div>
            <p className="font-semibold text-sm mt-2">{d.title}</p>
            <p className="text-[12px] text-muted-foreground mt-1">{d.reason}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[11px]">
          <div>
            <p className="text-muted-foreground">Expected ROI</p>
            <p className="font-semibold text-emerald-400">{d.expectedROIPct > 0 ? `+${d.expectedROIPct.toFixed(0)}%` : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p className="font-semibold">{Math.round(d.confidence * 100)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Risk</p>
            <p className={`font-semibold ${d.riskScore >= 60 ? 'text-red-400' : d.riskScore >= 35 ? 'text-amber-400' : 'text-emerald-400'}`}>{d.riskLevel} ({d.riskScore})</p>
          </div>
          <div>
            <p className="text-muted-foreground">Impact</p>
            <p className="font-semibold">{d.financialImpactLabel}</p>
          </div>
        </div>

        {d.supportingEvidence.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Supporting evidence</p>
            <div className="flex flex-wrap gap-1.5">
              {d.supportingEvidence.slice(0, 4).map((e, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                  {e.source}: {e.fact}{e.value !== undefined ? ` (${typeof e.value === 'number' && e.value > 1000 ? fmtINR(e.value) : e.value})` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {d.rollbackStrategy && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rollback strategy</p>
            <p className="text-[11px] text-muted-foreground">{d.rollbackStrategy}</p>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {d.status === 'pending' && (
            <>
              <Button size="sm" variant="default" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(d.id)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={() => onReject(d.id)}>
                <XCircle className="h-3 w-3 mr-1" /> Reject
              </Button>
            </>
          )}
          {(d.status === 'approved' || d.status === 'auto_approved') && (
            <Button size="sm" variant="default" className="h-7 text-[11px]" onClick={() => onExecute(d.id)}>
              <Play className="h-3 w-3 mr-1" /> Execute
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Strategy Meeting Card ────────────────────────────────────────────────────

function MeetingCard({ m }: { m: StrategyMeeting }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{m.topic}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(m.createdAt)} · trigger: {m.trigger}</p>
          </div>
          <Badge variant="outline" className={statusColor(m.ceoApproval)}>
            CEO: {m.ceoApproval}
          </Badge>
        </div>
        <p className="text-[12px] text-muted-foreground mt-2 italic">&ldquo;{m.consensus}&rdquo;</p>
        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
          <div><span className="text-muted-foreground">Impact</span> <span className="font-semibold">{fmtINR(m.financialImpact)}</span></div>
          <div><span className="text-muted-foreground">Risk</span> <span className="font-semibold">{m.riskLevel}</span></div>
          <div><span className="text-muted-foreground">Confidence</span> <span className="font-semibold">{Math.round(m.confidence * 100)}%</span></div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-sky-300 hover:text-sky-200 mt-2 flex items-center gap-1">
          {expanded ? 'Hide' : 'Show'} {m.opinions.length} executive opinions <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        {expanded && (
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
            {m.opinions.map((o, i) => (
              <div key={i} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-2.5">
                <div className="flex items-center gap-2">
                  <span>{EXEC_EMOJI[o.executive]}</span>
                  <span className="text-[11px] font-semibold uppercase">{o.executive}</span>
                  <Badge variant="outline" className={`text-[10px] ml-auto ${o.stance === 'support' ? 'text-emerald-300 border-emerald-500/30' : o.stance === 'caution' ? 'text-amber-300 border-amber-500/30' : o.stance === 'oppose' ? 'text-red-300 border-red-500/30' : ''}`}>
                    {o.stance}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{o.opinion}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">{o.reasoning}</p>
              </div>
            ))}
            {m.disagreements.length > 0 && (
              <div className="rounded-lg bg-amber-500/[0.04] border border-amber-500/20 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-amber-300 mb-1">Disagreements</p>
                {m.disagreements.map((dg, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">• {dg}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AutonomousEnterprisePage() {
  const { toast } = useToast();
  const [data, setData] = useState<AutonomousDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [simScenario, setSimScenario] = useState<SimulationScenario>('hire_employees');
  const [simBusy, setSimBusy] = useState(false);
  const [memoryQuery, setMemoryQuery] = useState('');
  const [memoryResults, setMemoryResults] = useState<ReturnType<typeof Array> | null>(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [lastRun, setLastRun] = useState<{ consensus: string; decisions: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/autonomous/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load dashboard');
      const json = await res.json();
      setData(json);
    } catch (e) {
      if (!silent) toast({ title: 'Load failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
    pollRef.current = setInterval(() => fetchDashboard(true), 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchDashboard]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const onApprove = async (id: string) => {
    try {
      const res = await fetch('/api/autonomous/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId: id, role: 'ceo' }),
      });
      if (!res.ok) throw new Error('Approve failed');
      toast({ title: 'Decision approved', description: 'Oracle will execute it autonomously.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Approve failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  };

  const onReject = async (id: string) => {
    try {
      const res = await fetch('/api/autonomous/reject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId: id, role: 'ceo' }),
      });
      if (!res.ok) throw new Error('Reject failed');
      toast({ title: 'Decision rejected', description: 'Learning Engine recorded the rejection.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Reject failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  };

  const onExecute = async (id: string) => {
    try {
      const res = await fetch('/api/autonomous/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisionId: id, role: 'ceo' }),
      });
      if (!res.ok) throw new Error('Execute failed');
      toast({ title: 'Execution triggered', description: 'Autonomous workflow started. Everything is logged.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Execute failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  };

  const onVoice = async (cmd?: string) => {
    const command = cmd ?? voiceInput.trim();
    if (!command) return;
    setVoiceBusy(true);
    setVoiceInput('');
    try {
      const res = await fetch('/api/autonomous/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (!res.ok) throw new Error('Voice command failed');
      const json = await res.json();
      const vc = json.command as VoiceCommand;
      toast({
        title: `Intent: ${vc.intent}`,
        description: json.executed ? json.result : `${vc.plan.length} steps planned. Requires approval (${vc.riskLevel} risk).`,
      });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Command failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setVoiceBusy(false);
    }
  };

  const onRunCompany = async () => {
    setVoiceBusy(true);
    try {
      const res = await fetch('/api/autonomous/run-company', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      if (!res.ok) throw new Error('Run company failed');
      const json = await res.json();
      setLastRun({
        consensus: json.summary?.consensus ?? 'Completed',
        decisions: json.summary?.decisionsProposed ?? 0,
      });
      toast({
        title: 'Company run complete',
        description: `${json.summary?.executivesDebated} executives debated. ${json.summary?.decisionsProposed} decisions proposed. CEO: ${json.summary?.ceoApproval}.`,
      });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Run failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setVoiceBusy(false);
    }
  };

  const onSimulate = async () => {
    setSimBusy(true);
    try {
      const res = await fetch('/api/autonomous/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: simScenario }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const json = await res.json();
      const s = json.simulation as StrategySimulation;
      toast({
        title: `Simulation: ${s.title}`,
        description: `Recommendation: ${s.recommendation} · ROI ${s.predictions.roiPct.toFixed(0)}% · confidence ${Math.round(s.confidence * 100)}%`,
      });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Simulation failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setSimBusy(false);
    }
  };

  const onMemorySearch = async () => {
    setMemoryBusy(true);
    try {
      const url = memoryQuery
        ? `/api/autonomous/memory?q=${encodeURIComponent(memoryQuery)}&limit=50`
        : '/api/autonomous/memory?limit=50';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Memory search failed');
      const json = await res.json();
      setMemoryResults(json.entries);
    } catch (e) {
      toast({ title: 'Memory search failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setMemoryBusy(false);
    }
  };

  useEffect(() => { onMemorySearch(); /* initial memory load */ }, []);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="text-sm text-muted-foreground">Booting the Autonomous Enterprise OS…</p>
        </div>
      </div>
    );
  }

  const cc = data.commandCenter;
  const obs = data.observation;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-5">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-rose-500/20 p-2">
                <Crown className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Autonomous Enterprise™</h1>
                <p className="text-[11px] text-muted-foreground">{AUTONOMOUS_SUBTAGLINE}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">{AUTONOMOUS_FOUNDER}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${data.hasLiveData ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {data.hasLiveData ? 'LIVE DATA' : 'AWAITING DATA'}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => fetchDashboard()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ─── Voice Execution Bar ─── */}
        <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span className="text-sm font-semibold">Voice Execution</span>
              </div>
              <Input
                value={voiceInput}
                onChange={(e) => setVoiceInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onVoice(); }}
                placeholder='Try: "Run my company today" · "Pay all vendors" · "Prepare GST" · "Recover collections"'
                className="flex-1 bg-background/60"
              />
              <Button onClick={() => onVoice()} disabled={voiceBusy || !voiceInput.trim()} className="shrink-0">
                {voiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Execute
              </Button>
              <Button onClick={onRunCompany} disabled={voiceBusy} variant="default" className="shrink-0 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700">
                <Zap className="h-4 w-4 mr-1.5" />
                Run My Company Today
              </Button>
            </div>
            {lastRun && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                Last run: {lastRun.decisions} decisions proposed · <span className="italic">{lastRun.consensus}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Run my company today', 'Pay all vendors', 'Prepare GST', 'Generate monthly report', 'Recover collections', 'Reduce expenses', 'Predict next year revenue'].map((c) => (
                <button key={c} onClick={() => onVoice(c)} className="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-muted-foreground transition-colors">
                  {c}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── Executive Command Center KPIs ─── */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Gauge className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-semibold">Executive Command Center</h2>
            <span className="text-[10px] text-muted-foreground">live · updates every 30s</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard icon={Wallet} label="Revenue (mo)" value={fmtINR(cc.revenue)} sub={`profit ${fmtINR(cc.profit)}`} />
            <KPICard icon={Banknote} label="Cash" value={fmtINR(cc.cash)} sub={`runway ${obs.runwayDays}d`} accent={obs.runwayDays > 0 && obs.runwayDays < 30 ? 'text-red-400' : undefined} />
            <KPICard icon={Receipt} label="GST Payable" value={fmtINR(cc.gst)} sub={`${obs.receivables > 0 ? `AR ${fmtINR(obs.receivables)}` : 'no dues'}`} />
            <KPICard icon={Shield} label="Compliance" value={`${cc.compliance}%`} sub={cc.compliance < 80 ? 'below threshold' : 'healthy'} accent={cc.compliance < 80 ? 'text-amber-400' : 'text-emerald-400'} />
            <KPICard icon={Activity} label="Health Score" value={cc.companyHealthScore} sub={cc.companyHealthScore < 70 ? 'needs attention' : 'strong'} accent={cc.companyHealthScore < 70 ? 'text-amber-400' : 'text-emerald-400'} />
            <KPICard icon={Bot} label="AI Workforce" value={cc.aiWorkforce} sub={`${cc.employees} humans · ${cc.customers} clients`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
            <KPICard icon={TrendingUp} label="Decisions today" value={cc.decisionsToday} />
            <KPICard icon={Zap} label="Auto-actions today" value={cc.autonomousActionsToday} />
            <KPICard icon={Clock} label="Pending approvals" value={cc.approvals} accent={cc.approvals > 0 ? 'text-amber-400' : undefined} />
            <KPICard icon={AlertTriangle} label="Active alerts" value={cc.alerts} accent={cc.alerts > 0 ? 'text-amber-400' : undefined} />
            <KPICard icon={Target} label="Open tasks" value={cc.tasks} />
            <KPICard icon={FlaskConical} label="Predictions" value={cc.predictions} />
          </div>
        </div>

        {/* ─── Nine AI Executives ─── */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Users className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-semibold">Nine AI Executives — Collaborating Continuously</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.executives.map((e) => <ExecutiveCard key={e.id} exec={e} />)}
          </div>
        </div>

        {/* ─── Main Tabs ─── */}
        <Tabs defaultValue="decisions" className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-auto p-1 bg-white/[0.02] border border-white/[0.06]">
              <TabsTrigger value="decisions" className="text-xs">Decisions</TabsTrigger>
              <TabsTrigger value="strategy" className="text-xs">Strategy Room</TabsTrigger>
              <TabsTrigger value="plans" className="text-xs">Planning</TabsTrigger>
              <TabsTrigger value="goals" className="text-xs">Goals</TabsTrigger>
              <TabsTrigger value="workflows" className="text-xs">Workflows</TabsTrigger>
              <TabsTrigger value="simulations" className="text-xs">Simulator 2.0</TabsTrigger>
              <TabsTrigger value="memory" className="text-xs">Memory</TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
              <TabsTrigger value="learning" className="text-xs">Learning</TabsTrigger>
              <TabsTrigger value="health" className="text-xs">Self-Healing</TabsTrigger>
            </TabsList>
          </ScrollArea>

          {/* Decisions */}
          <TabsContent value="decisions" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.decisions.length === 0 && (
                <Card className="bg-white/[0.03] border-white/[0.08] sm:col-span-2"><CardContent className="p-6 text-center text-sm text-muted-foreground">No active decisions. Run the company to generate proposals.</CardContent></Card>
              )}
              {data.decisions.map((d) => (
                <DecisionCard key={d.id} d={d} onApprove={onApprove} onReject={onReject} onExecute={onExecute} />
              ))}
            </div>
          </TabsContent>

          {/* Strategy Room */}
          <TabsContent value="strategy" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.recentMeetings.length === 0 && (
                <Card className="bg-white/[0.03] border-white/[0.08] lg:col-span-2"><CardContent className="p-6 text-center text-sm text-muted-foreground">No strategy meetings yet. Click "Run My Company Today" to convene the boardroom.</CardContent></Card>
              )}
              {data.recentMeetings.map((m) => <MeetingCard key={m.id} m={m} />)}
            </div>
          </TabsContent>

          {/* Plans */}
          <TabsContent value="plans" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.plans.map((p) => <PlanCard key={p.id} p={p} />)}
            </div>
          </TabsContent>

          {/* Goals */}
          <TabsContent value="goals" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.goals.length === 0 && (
                <Card className="bg-white/[0.03] border-white/[0.08] md:col-span-2"><CardContent className="p-6 text-center text-sm text-muted-foreground">No goals yet.</CardContent></Card>
              )}
              {data.goals.map((g) => <GoalCard key={g.id} g={g} />)}
            </div>
          </TabsContent>

          {/* Workflows */}
          <TabsContent value="workflows" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.activeWorkflows.length === 0 && (
                <Card className="bg-white/[0.03] border-white/[0.08] lg:col-span-2"><CardContent className="p-6 text-center text-sm text-muted-foreground">No active workflows. Voice commands trigger them automatically.</CardContent></Card>
              )}
              {data.activeWorkflows.map((w) => <WorkflowCard key={w.id} w={w} />)}
              <Card className="bg-white/[0.02] border-dashed border-white/[0.1] lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Workflow Templates</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.workflowTemplates.map((t) => (
                      <div key={t.type} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {t.steps.slice(0, 5).map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] font-normal">{i + 1}. {s.stage}</Badge>
                          ))}
                          {t.steps.length > 5 && <Badge variant="secondary" className="text-[9px]">+{t.steps.length - 5}</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Simulator 2.0 */}
          <TabsContent value="simulations" className="mt-4">
            <Card className="bg-white/[0.03] border-white/[0.08] mb-3">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <FlaskConical className="h-4 w-4 text-amber-300" />
                    <span className="text-sm font-semibold">Run a Simulation</span>
                  </div>
                  <select
                    value={simScenario}
                    onChange={(e) => setSimScenario(e.target.value as SimulationScenario)}
                    className="flex-1 h-9 rounded-md bg-background/60 border border-white/[0.1] px-3 text-sm"
                  >
                    {(Object.keys(SCENARIO_META) as SimulationScenario[]).map((s) => (
                      <option key={s} value={s}>{SCENARIO_META[s].title}</option>
                    ))}
                  </select>
                  <Button onClick={onSimulate} disabled={simBusy} className="shrink-0">
                    {simBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
                    Simulate
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{SCENARIO_META[simScenario].description}</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.recentSimulations.length === 0 && (
                <Card className="bg-white/[0.03] border-white/[0.08] md:col-span-2"><CardContent className="p-6 text-center text-sm text-muted-foreground">No simulations yet. Run one above.</CardContent></Card>
              )}
              {data.recentSimulations.map((s) => <SimulationCard key={s.id} s={s} />)}
            </div>
          </TabsContent>

          {/* Memory */}
          <TabsContent value="memory" className="mt-4">
            <Card className="bg-white/[0.03] border-white/[0.08] mb-3">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-amber-300 shrink-0" />
                  <Input
                    value={memoryQuery}
                    onChange={(e) => setMemoryQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onMemorySearch(); }}
                    placeholder="Search every decision, meeting, strategy, simulation, alert…"
                    className="flex-1"
                  />
                  <Button onClick={onMemorySearch} disabled={memoryBusy} variant="outline">
                    {memoryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 text-[10px] text-muted-foreground">
                  <span>{data.memoryStats.total} memories</span>
                  {Object.entries(data.memoryStats.bySource).map(([k, v]) => (
                    <span key={k}>· {k}: {v}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {memoryResults && memoryResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No memories found.</p>
              )}
              {memoryResults?.map((m: any) => (
                <Card key={m.id} className="bg-white/[0.03] border-white/[0.08]">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] capitalize">{m.source}</Badge>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(m.occurredAt)}</span>
                          <span className="text-[10px] text-amber-300/70">importance {Math.round(m.importance * 100)}%</span>
                        </div>
                        <p className="text-sm font-medium mt-1">{m.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{m.description}</p>
                      </div>
                    </div>
                    {m.tags && m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.tags.slice(0, 6).map((t: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[9px] font-normal">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Alerts */}
          <TabsContent value="alerts" className="mt-4">
            <div className="space-y-2">
              {data.alerts.length === 0 && (
                <Card className="bg-white/[0.03] border-white/[0.08]"><CardContent className="p-6 text-center text-sm text-muted-foreground">No active alerts. All clear.</CardContent></Card>
              )}
              {data.alerts.map((a) => <AlertCard key={a.id} a={a} />)}
            </div>
          </TabsContent>

          {/* Learning */}
          <TabsContent value="learning" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.learnings.length === 0 && (
                <Card className="bg-white/[0.03] border-white/[0.08] md:col-span-2"><CardContent className="p-6 text-center text-sm text-muted-foreground">Oracle hasn't accumulated learnings yet. Approve/reject decisions to teach it.</CardContent></Card>
              )}
              {data.learnings.map((l, i) => (
                <Card key={i} className="bg-white/[0.03] border-white/[0.08]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-300 shrink-0" />
                      <Badge variant="outline" className="text-[10px]">{l.category}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">evidence ×{l.evidence}</span>
                    </div>
                    <p className="text-sm mt-2">{l.insight}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Impact: {l.impact}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground">confidence</span>
                      <Progress value={l.confidence * 100} className="h-1.5 flex-1" />
                      <span className="text-[10px] font-semibold">{Math.round(l.confidence * 100)}%</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Self-Healing */}
          <TabsContent value="health" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card className="bg-white/[0.03] border-white/[0.08]">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">System Health</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {data.systemHealth.map((h, i) => <HealthRow key={i} h={h} />)}
                </CardContent>
              </Card>
              <Card className="bg-white/[0.03] border-white/[0.08]">
                <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Recent Healing Events</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-2 max-h-80 overflow-y-auto">
                  {data.recentHealingEvents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No healing events. All systems healthy.</p>
                  )}
                  {data.recentHealingEvents.map((e) => (
                    <div key={e.id} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-2.5">
                      <div className="flex items-center gap-2">
                        <HeartPulse className="h-3.5 w-3.5 text-amber-300" />
                        <span className="text-[11px] font-semibold">{e.component}</span>
                        <Badge variant="outline" className="text-[9px] ml-auto">{e.status}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{e.failure}</p>
                      <p className="text-[10px] text-emerald-300/80 mt-0.5">→ {e.recoveryAction}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── Execution Stats ─── */}
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-amber-300" />
              <h3 className="text-sm font-semibold">Execution Statistics</h3>
              <span className="text-[10px] text-muted-foreground">all-time · from REAL records</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
              <Stat label="Total decisions" value={data.executionStats.totalDecisions} />
              <Stat label="Auto-executed" value={data.executionStats.autoExecuted} accent="text-emerald-400" />
              <Stat label="Approved" value={data.executionStats.approvedExecuted} />
              <Stat label="Rejected" value={data.executionStats.rejected} accent="text-red-400" />
              <Stat label="Pending" value={data.executionStats.pending} accent="text-amber-400" />
              <Stat label="Success rate" value={`${data.executionStats.successRate.toFixed(0)}%`} />
              <Stat label="Avg confidence" value={`${Math.round(data.executionStats.avgConfidence * 100)}%`} />
              <Stat label="Avg ROI" value={`${data.executionStats.avgROI.toFixed(0)}%`} accent="text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground/60 pt-2 pb-4">{AUTONOMOUS_TAGLINE}</p>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${accent ?? ''}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function PlanCard({ p }: { p: ContinuousPlan }) {
  const horizonColor: Record<string, string> = {
    daily: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    weekly: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    monthly: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    quarterly: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
    yearly: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  };
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={horizonColor[p.horizon]}>{p.horizon}</Badge>
          {p.department && <Badge variant="secondary" className="text-[10px]">{p.department}</Badge>}
          <span className="text-[10px] text-muted-foreground ml-auto">{Math.round(p.confidence * 100)}% conf</span>
        </div>
        <p className="font-semibold text-sm mt-2">{p.title}</p>
        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.summary}</p>
        {p.focusAreas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {p.focusAreas.slice(0, 4).map((f, i) => (
              <Badge key={i} variant="secondary" className="text-[9px] font-normal">{f}</Badge>
            ))}
          </div>
        )}
        {p.initiatives.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
            {p.initiatives.slice(0, 3).map((ini, i) => (
              <div key={i} className="text-[11px] flex items-start gap-1.5">
                <ArrowRight className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                <span className="flex-1">{ini.title}</span>
                <span className="text-[9px] text-muted-foreground shrink-0">{EXEC_EMOJI[ini.owner]} {ini.owner}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GoalCard({ g }: { g: AutonomousGoal }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px]">{g.category}</Badge>
          <span className={`text-[11px] font-semibold ${statusColor(g.status)}`}>{g.status.replace('_', ' ')}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{g.title}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{g.description}</p>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{g.progressPct}%</span>
          </div>
          <Progress value={g.progressPct} className="h-2" />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
          <div><span className="text-muted-foreground">Baseline</span><br /><span className="font-semibold">{g.unit === 'inr' ? fmtINR(g.baseline) : g.baseline}</span></div>
          <div><span className="text-muted-foreground">Current</span><br /><span className="font-semibold text-amber-300">{g.unit === 'inr' ? fmtINR(g.current) : g.current}</span></div>
          <div><span className="text-muted-foreground">Target</span><br /><span className="font-semibold text-emerald-300">{g.unit === 'inr' ? fmtINR(g.target) : g.target}</span></div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Owner: {EXEC_EMOJI[g.owner]} {g.owner}</p>
      </CardContent>
    </Card>
  );
}

function WorkflowCard({ w }: { w: AutonomousWorkflow }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm">{w.name}</p>
          <Badge variant="outline" className={statusColor(w.status)}>{w.status}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">trigger: {w.trigger}</p>
        <div className="mt-3 space-y-1">
          {w.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'completed' ? 'bg-emerald-400' : s.status === 'running' ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`} />
              <span className={s.status === 'completed' ? 'text-muted-foreground line-through' : ''}>{s.stage}</span>
              <span className="text-[9px] text-muted-foreground ml-auto">{EXEC_EMOJI[s.agent] ?? '🤖'} {s.agent}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SimulationCard({ s }: { s: StrategySimulation }) {
  const recColor: Record<string, string> = {
    proceed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    caution: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    avoid: 'bg-red-500/10 text-red-300 border-red-500/20',
    needs_review: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  };
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px]">{s.scenario.replace('_', ' ')}</Badge>
          <Badge variant="outline" className={recColor[s.recommendation]}>{s.recommendation.replace('_', ' ')}</Badge>
        </div>
        <p className="font-semibold text-sm mt-2">{s.title}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{s.description}</p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div><span className="text-muted-foreground">Revenue</span><br /><span className="font-semibold">{fmtINR(s.predictions.revenue)}</span></div>
          <div><span className="text-muted-foreground">Profit</span><br /><span className="font-semibold">{fmtINR(s.predictions.profit)}</span></div>
          <div><span className="text-muted-foreground">Cash flow</span><br /><span className="font-semibold">{fmtINR(s.predictions.cashFlow)}</span></div>
          <div><span className="text-muted-foreground">GST</span><br /><span className="font-semibold">{fmtINR(s.predictions.gst)}</span></div>
          <div><span className="text-muted-foreground">Risk</span><br /><span className={`font-semibold ${s.predictions.risk > 60 ? 'text-red-400' : s.predictions.risk > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>{s.predictions.risk}/100</span></div>
          <div><span className="text-muted-foreground">ROI</span><br /><span className="font-semibold text-emerald-400">{s.predictions.roiPct.toFixed(0)}%</span></div>
          <div><span className="text-muted-foreground">Runway</span><br /><span className="font-semibold">{s.predictions.runwayDays}d</span></div>
          <div><span className="text-muted-foreground">Break-even</span><br /><span className="font-semibold">{s.predictions.breakEvenMonths}mo</span></div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Confidence {Math.round(s.confidence * 100)}% · {timeAgo(s.createdAt)}</p>
      </CardContent>
    </Card>
  );
}

function AlertCard({ a }: { a: AutonomousAlert }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${a.severity === 'critical' || a.severity === 'high' ? 'text-red-400' : 'text-amber-400'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${severityColor(a.severity)}`}>{a.severity}</Badge>
              <Badge variant="secondary" className="text-[10px]">{a.category.replace('_', ' ')}</Badge>
              <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(a.detectedAt)}</span>
            </div>
            <p className="text-sm font-medium mt-1">{a.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{a.message}</p>
            <p className="text-[10px] text-amber-300/80 mt-1">→ {a.suggestedAction}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthRow({ h }: { h: SystemHealthCheck }) {
  const dot: Record<string, string> = {
    healthy: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    down: 'bg-red-400',
    recovering: 'bg-sky-400 animate-pulse',
  };
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className={`h-2 w-2 rounded-full shrink-0 ${dot[h.status] ?? 'bg-white/30'}`} />
      <span className="font-medium flex-1 truncate">{h.component}</span>
      <span className="text-muted-foreground text-[10px]">{h.latencyMs}ms</span>
      <Badge variant="outline" className={`text-[9px] ${statusColor(h.status)}`}>{h.status}</Badge>
    </div>
  );
}
