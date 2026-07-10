'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — INFINITY AGI™ — AUTONOMOUS ENTERPRISE INTELLIGENCE
//
// The World's First Enterprise AGI Operating System. Oracle becomes the
// autonomous intelligence that can understand, reason, decide, execute, learn,
// coordinate, and continuously improve an entire enterprise.
//
//   "One Intelligence. Every Decision. Entire Enterprise."
//   Founder & Owner: Prince Singh.
//
// 12 tabs: Overview · Reasoning · Swarm · Memory · Goals · Plans · Learning ·
//          Digital Twin · Decisions · Security · Analytics · Live State
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Cpu, Activity, Shield, ShieldCheck, ShieldAlert, AlertTriangle,
  AlertOctagon, Zap, Play, RefreshCw, Loader2, CheckCircle2, XCircle, Clock,
  TrendingUp, ArrowRight, Sparkles, FlaskConical, Bot, Users,
  MessageSquare, Send, MemoryStick, Database, Target,
  ClipboardList, GraduationCap, Lightbulb, Layers,
  Gauge, Fingerprint, Network, Server, Power,
  ChevronRight, Search, GitBranch, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { SIMULATION_SCENARIOS } from '@/lib/agi/twin';
import { GOAL_TEMPLATES } from '@/lib/agi/goals';
import type {
  AGIDashboard, SwarmAgent, AgentMessage, ReasoningCycle, ReasoningTrigger,
  ReasoningFocus, AGIGoal, AGIPlan, AGITask, LearningEpisode, TwinSimulation,
  AGIDecision, AGIAuditRecord, AGIApproval, AGIMemory, AGICapabilitySurface,
  AGIConclusion, Guardrail, GoalCategory, GoalPriority,
} from '@/lib/agi/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGI_TAGLINE = 'Infinity AGI™';
const AGI_SUBTAGLINE = 'One Intelligence. Every Decision. Entire Enterprise.';
const AGI_FOUNDER = 'Prince Singh';
const POLL_INTERVAL_MS = 30_000;

const REASONING_TRIGGERS: ReasoningTrigger[] = [
  'scheduled', 'anomaly', 'goal_review', 'incident', 'opportunity', 'human',
];
const REASONING_FOCUSES: ReasoningFocus[] = [
  'health', 'opportunity', 'risk', 'failure', 'growth', 'planning', 'prioritization',
];
const GOAL_CATEGORIES: GoalCategory[] = [
  'revenue', 'cost', 'retention', 'expansion', 'compliance', 'efficiency', 'growth', 'profit',
];
const GOAL_PRIORITIES: GoalPriority[] = ['low', 'medium', 'high', 'critical'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'just now';
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

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function healthColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function riskColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-emerald-400';
}

function statusClasses(status: string): string {
  const positive = ['online', 'completed', 'approved', 'executed', 'active', 'achieved', 'success', 'allow', 'verified', 'applied', 'proceed', 'running'];
  const negative = ['offline', 'failed', 'rejected', 'denied', 'down', 'critical', 'aborted', 'error', 'avoid', 'rolled_back', 'shutdown', 'blocked'];
  const pending = ['degraded', 'pending', 'in_review', 'investigating', 'recovering', 'open', 'syncing', 'warning', 'stale', 'paused', 'idle', 'needs_approval', 'needs_review', 'skipped', 'proposed', 'thinking', 'executing', 'todo', 'in_progress', 'simulated', 'caution', 'observed', 'learned', 'planning', 'cancelled', 'expired'];
  if (positive.includes(status)) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (negative.includes(status)) return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (pending.includes(status)) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
}

function urgencyClasses(urgency: string): string {
  if (urgency === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (urgency === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  if (urgency === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
}

function recommendationClasses(rec: string): string {
  if (rec === 'proceed') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (rec === 'caution') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (rec === 'avoid') return 'bg-red-500/15 text-red-300 border-red-500/30';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

function reasoningStatusClasses(s: string): string {
  if (s === 'active') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (s === 'idle') return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
  if (s === 'paused') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (s === 'shutdown') return 'bg-red-500/15 text-red-300 border-red-500/30';
  return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
}

// ─── Small shared UI primitives ───────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, accent }: {
  icon: LucideIcon; label: string; value: string | number; sub?: string; accent?: string;
}) {
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

function SectionHeader({ icon: Icon, title, hint, right }: {
  icon: LucideIcon; title: string; hint?: string; right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
      <Icon className="h-4 w-4 text-amber-300" />
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-6 text-center text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${accent ?? ''}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function SummaryCard({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Card className="bg-white/[0.02] border-white/[0.06]">
      <CardContent className="p-4">
        {hint && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">{hint}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Capability card (Overview tab) ───────────────────────────────────────────

function CapabilityCard({ c }: { c: AGICapabilitySurface }) {
  const dotClass = c.status === 'online' ? 'bg-emerald-400' : c.status === 'degraded' ? 'bg-amber-400' : 'bg-red-400';
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16] transition-colors">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${dotClass} ${c.status === 'online' ? 'animate-pulse' : ''}`} />
              <p className="font-semibold text-sm truncate">{c.label}</p>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{c.role}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${statusClasses(c.status)}`}>{c.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2.5 text-[11px]">
          <div>
            <p className="text-muted-foreground">Signals</p>
            <p className="font-semibold">{c.signalsLastCycle.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Decisions</p>
            <p className="font-semibold text-amber-300">{c.decisionsContributed}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-2">synced {timeAgo(c.lastSync)}</p>
      </CardContent>
    </Card>
  );
}

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function OverviewTab({ core, liveState }: { core: AGIDashboard['core']; liveState: AGIDashboard['liveState'] }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader icon={Network} title="AGI Core — Capability Surface"
          hint={`${core.onlineCapabilities}/${core.totalCapabilities} online · ${core.totalSignals.toLocaleString()} signals · ${core.totalDecisionsContributed} decisions informed`} />
        {core.capabilityGraph.length === 0 ? (
          <EmptyState message="No capabilities provisioned yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {core.capabilityGraph.map((c) => <CapabilityCard key={c.capability} c={c} />)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Brain className="h-3.5 w-3.5" /> Reasoning Engine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                <Badge variant="outline" className={`text-[10px] ${reasoningStatusClasses(core.reasoningEngine.status)}`}>{core.reasoningEngine.status}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Cycles today</span><span className="font-semibold">{core.reasoningEngine.cyclesToday}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Avg cycle</span><span className="font-semibold">{core.reasoningEngine.avgCycleMs}ms</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last cycle</span><span className="font-semibold">{timeAgo(core.reasoningEngine.lastCycleAt)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Safety State
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Emergency shutdown</span>
                {core.safetyState.emergencyShutdown
                  ? <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-300 border-red-500/30">ACTIVE</Badge>
                  : <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30">SAFE</Badge>}
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Guardrails</span>
                {core.safetyState.guardrailsActive
                  ? <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30">ACTIVE</Badge>
                  : <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-300 border-red-500/30">OFF</Badge>}
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Approval queue</span><span className="font-semibold text-amber-300">{core.safetyState.humanApprovalQueue}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rolled-back actions</span><span className="font-semibold text-red-300">{core.safetyState.rolledBackActions}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Live Enterprise State
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between"><span className="text-muted-foreground">Cash position</span><span className="font-semibold text-emerald-300">{fmtINR(liveState.cashPositionINR)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Revenue MTD</span><span className="font-semibold">{fmtINR(liveState.revenueMTD)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Compliance</span><span className={`font-semibold ${healthColor(liveState.complianceScore)}`}>{fmtPct(liveState.complianceScore)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Runway</span><span className="font-semibold">{liveState.runwayDays}d</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Open incidents</span><span className={`font-semibold ${liveState.openIncidents > 0 ? 'text-red-400' : ''}`}>{liveState.openIncidents}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Active workflows</span><span className="font-semibold">{liveState.activeWorkflows}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {liveState.dataSources.length > 0 && (
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Database className="h-3.5 w-3.5" /> Connected Data Sources ({liveState.dataSources.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {liveState.dataSources.map((s, i) => (
                <Badge key={`${s}-${i}`} variant="secondary" className="text-[10px] font-normal">{s.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 2: Reasoning ─────────────────────────────────────────────────────────

function ConclusionCard({ c }: { c: AGIConclusion }) {
  return (
    <div className={`rounded-lg border p-3 ${urgencyClasses(c.urgency)}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Badge variant="outline" className={`text-[10px] ${statusClasses(c.focus)}`}>{c.focus}</Badge>
        <Badge variant="outline" className={`text-[10px] ${urgencyClasses(c.urgency)}`}>{c.urgency}</Badge>
      </div>
      <p className="text-[12px] font-semibold mt-2">{c.finding}</p>
      {c.supportingEvidence.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Evidence</p>
          <ul className="mt-1 space-y-0.5">
            {c.supportingEvidence.map((e, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" /> <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {c.proposedActions.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Proposed actions</p>
          <ul className="mt-1 space-y-0.5">
            {c.proposedActions.map((a, i) => (
              <li key={i} className="text-[11px] text-foreground flex items-start gap-1">
                <Zap className="h-3 w-3 mt-0.5 shrink-0 text-amber-300" /> <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 text-[11px]">
        <span className="text-muted-foreground">confidence</span>
        <span className="font-semibold">{Math.round(c.confidence * 100)}%</span>
      </div>
      <Progress value={c.confidence * 100} className="h-1 mt-1" />
    </div>
  );
}

function CycleCard({ cycle }: { cycle: ReasoningCycle }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">#{cycle.cycleNumber}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(cycle.trigger)}`}>{cycle.trigger.replace(/_/g, ' ')}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(cycle.focus)}`}>{cycle.focus}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(cycle.status)}`}>{cycle.status}</Badge>
            {cycle.shutdownFlag && <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-300 border-red-500/30">SHUTDOWN</Badge>}
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(cycle.createdAt)}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px]">
          <div><p className="text-muted-foreground">Confidence</p><p className="font-semibold">{Math.round(cycle.confidence * 100)}%</p></div>
          <div><p className="text-muted-foreground">Duration</p><p className="font-semibold">{cycle.durationMs}ms</p></div>
          <div><p className="text-muted-foreground">Proposed</p><p className="font-semibold text-amber-300">{cycle.actionsProposed}</p></div>
          <div><p className="text-muted-foreground">Executed</p><p className="font-semibold text-emerald-300">{cycle.actionsExecuted}</p></div>
        </div>

        {cycle.reasoning && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reasoning chain</p>
            <ScrollArea className="h-32 rounded-md bg-background/40 border border-white/[0.04]">
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap p-3 font-mono">{cycle.reasoning}</pre>
            </ScrollArea>
          </div>
        )}

        {cycle.conclusions.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Conclusions · {cycle.conclusions.length}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cycle.conclusions.map((c, i) => <ConclusionCard key={i} c={c} />)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReasoningTab({ summary, recent, onRun, busy }: {
  summary: AGIDashboard['reasoning']['summary'];
  recent: ReasoningCycle[];
  onRun: (trigger: ReasoningTrigger, focus: ReasoningFocus | '') => void;
  busy: boolean;
}) {
  const [trigger, setTrigger] = useState<ReasoningTrigger>('scheduled');
  const [focus, setFocus] = useState<ReasoningFocus | ''>('');
  return (
    <div className="space-y-4">
      <SummaryCard>
        <MiniStat label="Total cycles" value={summary.totalCycles} />
        <MiniStat label="Cycles today" value={summary.cyclesToday} accent="text-amber-300" />
        <MiniStat label="Avg confidence" value={fmtPct(summary.avgConfidence * 100)} />
        <MiniStat label="Avg duration" value={`${summary.avgDurationMs}ms`} />
        <MiniStat label="Actions proposed" value={summary.actionsProposed} />
        <MiniStat label="Actions executed" value={summary.actionsExecuted} accent="text-emerald-400" />
        <MiniStat label="Execution rate" value={fmtPct(summary.executionRate * 100)} />
        <MiniStat label="Last cycle" value={timeAgo(summary.lastCycleAt)} />
      </SummaryCard>

      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-semibold">Run New Reasoning Cycle</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={trigger} onValueChange={(v) => setTrigger(v as ReasoningTrigger)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="trigger" /></SelectTrigger>
              <SelectContent>
                {REASONING_TRIGGERS.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={focus || '__any__'} onValueChange={(v) => setFocus(v === '__any__' ? '' : (v as ReasoningFocus))}>
              <SelectTrigger className="h-9"><SelectValue placeholder="focus (any)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">any focus</SelectItem>
                {REASONING_FOCUSES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => onRun(trigger, focus)} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
              Run Cycle
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No reasoning cycles yet. Oracle reasons continuously — run a new cycle above." />}
        {recent.map((c) => <CycleCard key={c.id} cycle={c} />)}
      </div>
    </div>
  );
}

// ─── Tab 3: Swarm ─────────────────────────────────────────────────────────────

function AgentCard({ a }: { a: SwarmAgent }) {
  const statusDot = a.status === 'active' ? 'bg-emerald-400 animate-pulse'
    : a.status === 'thinking' ? 'bg-amber-400 animate-pulse'
    : a.status === 'executing' ? 'bg-sky-400 animate-pulse'
    : a.status === 'paused' ? 'bg-orange-400'
    : a.status === 'shutdown' ? 'bg-red-400' : 'bg-white/20';
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16] transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0">{a.emoji}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm truncate">{a.name}</p>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot} shrink-0`} />
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{a.role}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${statusClasses(a.status)}`}>{a.status}</Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{a.mandate}</p>
        {a.currentTask && (
          <div className="mt-2 rounded-md bg-amber-500/[0.06] border border-amber-500/20 px-2 py-1">
            <p className="text-[10px] text-amber-300/80">▸ current task</p>
            <p className="text-[11px] text-foreground truncate">{a.currentTask}</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div><span className="text-muted-foreground">24h decisions</span><p className="font-semibold">{a.decisionsLast24h}</p></div>
          <div><span className="text-muted-foreground">Total</span><p className="font-semibold">{a.decisionsTotal}</p></div>
          <div><span className="text-muted-foreground">Messages</span><p className="font-semibold">{a.messagesExchanged}</p></div>
          <div><span className="text-muted-foreground">Confidence</span><p className="font-semibold">{Math.round(a.avgConfidence * 100)}%</p></div>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>success rate</span><span className="text-foreground font-semibold">{Math.round(a.successRate * 100)}%</span>
          </div>
          <Progress value={a.successRate * 100} className="h-1.5" />
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-2">active {timeAgo(a.lastActiveAt)}</p>
      </CardContent>
    </Card>
  );
}

function SwarmTab({ summary, agents, recentMessages }: {
  summary: AGIDashboard['swarm']['summary'];
  agents: SwarmAgent[];
  recentMessages: AgentMessage[];
}) {
  const intentColor = (i: string) => statusClasses(i);
  return (
    <div className="space-y-4">
      <SummaryCard>
        <MiniStat label="Total agents" value={summary.totalAgents} />
        <MiniStat label="Active" value={summary.activeAgents} accent="text-emerald-400" />
        <MiniStat label="Thinking" value={summary.thinkingAgents} accent="text-amber-400" />
        <MiniStat label="Executing" value={summary.executingAgents} accent="text-sky-400" />
        <MiniStat label="Decisions (24h)" value={summary.totalDecisions24h} />
        <MiniStat label="Messages" value={summary.totalMessagesExchanged} />
        <MiniStat label="Avg confidence" value={fmtPct(summary.avgConfidence * 100)} />
        <MiniStat label="Avg success" value={fmtPct(summary.avgSuccessRate * 100)} />
      </SummaryCard>

      <div>
        <SectionHeader icon={Bot} title="Agent Roster"
          hint={`${agents.length} agents · top contributor: ${summary.topContributor ?? '—'}`} />
        {agents.length === 0 ? (
          <EmptyState message="No agents provisioned yet." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((a) => <AgentCard key={a.id} a={a} />)}
          </div>
        )}
      </div>

      <div>
        <SectionHeader icon={MessageSquare} title="Inter-Agent Messages"
          hint={`${recentMessages.length} recent · coordination load ${summary.coordinationLoad}`} />
        {recentMessages.length === 0 ? (
          <EmptyState message="No inter-agent messages yet." />
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {recentMessages.map((m) => (
              <Card key={m.id} className="bg-white/[0.03] border-white/[0.08]">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-full bg-amber-500/15 p-1.5 shrink-0">
                      <Bot className="h-3.5 w-3.5 text-amber-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold">{m.fromAgent}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[12px] font-semibold">{m.toAgent}</span>
                        <Badge variant="outline" className={`text-[9px] ${intentColor(m.intent)}`}>{m.intent}</Badge>
                        <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(m.createdAt)}</span>
                      </div>
                      <p className="text-[12px] text-foreground mt-1">{m.content}</p>
                      {m.relatedDecision && (
                        <Badge variant="outline" className="text-[9px] mt-1.5">decision: {m.relatedDecision.slice(0, 8)}…</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 4: Memory ────────────────────────────────────────────────────────────

function MemoryCard({ m }: { m: AGIMemory }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${statusClasses(m.category)}`}>{m.category}</Badge>
            {m.sourceModule && <Badge variant="secondary" className="text-[10px] font-normal">{m.sourceModule.replace(/_/g, ' ')}</Badge>}
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-1.5">{m.title}</p>
        {m.summary && <p className="text-[11px] text-muted-foreground mt-0.5">{m.summary}</p>}
        {m.content && (
          <div className="mt-2">
            <p className={`text-[12px] text-muted-foreground ${expanded ? '' : 'line-clamp-3'}`}>{m.content}</p>
            {m.content.length > 200 && (
              <Button variant="link" size="sm" className="h-6 px-0 text-[10px]" onClick={() => setExpanded((v) => !v)}>
                {expanded ? 'Show less' : 'Show more'}
              </Button>
            )}
          </div>
        )}
        {m.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {m.tags.map((t, i) => (
              <Badge key={`${t}-${i}`} variant="secondary" className="text-[9px] font-normal">#{t}</Badge>
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
          <div><span className="text-muted-foreground">Importance</span><p className={`font-semibold ${m.importance > 0.7 ? 'text-amber-300' : ''}`}>{Math.round(m.importance * 100)}%</p></div>
          <div><span className="text-muted-foreground">Retrievals</span><p className="font-semibold">{m.retrievalCount}</p></div>
          <div><span className="text-muted-foreground">Source</span><p className="font-semibold truncate">{m.sourceEntity ?? '—'}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemoryTab({ summary, recent, onSearch }: {
  summary: AGIDashboard['memory']['summary'];
  recent: AGIMemory[];
  onSearch: (q: string) => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      await onSearch(q);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Search className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold">Search Oracle Memory</span>
            </div>
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
              placeholder="search memories… (e.g. 'GST', 'cash', 'client')" className="flex-1 h-9" />
            <Button onClick={doSearch} disabled={searching} className="shrink-0">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <SummaryCard>
        <MiniStat label="Total memories" value={summary.totalMemories} />
        <MiniStat label="Retrievals" value={summary.totalRetrievals} />
        <MiniStat label="Avg importance" value={fmtPct(summary.avgImportance * 100)} accent="text-amber-300" />
        <MiniStat label="Storage" value={fmtBytes(summary.storageBytes)} />
      </SummaryCard>

      {Object.keys(summary.byCategory).length > 0 && (
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" /> By Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.byCategory)
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v]) => (
                  <Badge key={k} variant="outline" className={`text-[10px] ${statusClasses(k)}`}>
                    {k.replace(/_/g, ' ')} · {v as number}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No memories recorded yet." />}
        {recent.map((m) => <MemoryCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}

// ─── Tab 5: Goals ─────────────────────────────────────────────────────────────

function MilestoneRow({ m }: { m: AGIGoal['milestones'][number] }) {
  const icon = m.status === 'achieved' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    : m.status === 'in_progress' ? <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
    : m.status === 'missed' ? <XCircle className="h-3.5 w-3.5 text-red-400" />
    : <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {icon}
      <span className="flex-1 truncate">{m.label}</span>
      <span className="text-muted-foreground">{m.achievedValue}/{m.targetValue}</span>
    </div>
  );
}

function GoalCard({ g }: { g: AGIGoal }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${statusClasses(g.category)}`}>{g.category}</Badge>
            <Badge variant="outline" className={`text-[10px] ${urgencyClasses(g.priority === 'critical' ? 'critical' : g.priority === 'high' ? 'high' : g.priority === 'medium' ? 'medium' : 'low')}`}>{g.priority}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(g.status)}`}>{g.status}</Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(g.updatedAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{g.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{g.description}</p>

        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">Progress · {g.targetMetric.replace(/_/g, ' ')}</span>
            <span className="font-semibold">{fmtPct(g.progressPct)}</span>
          </div>
          <Progress value={g.progressPct} className="h-1.5" />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
          <div>
            <p className="text-muted-foreground">Current</p>
            <p className="font-semibold text-emerald-300">{g.currentValue.toLocaleString('en-IN')}{g.unit ? ` ${g.unit}` : ''}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p className="font-semibold">{g.targetValue.toLocaleString('en-IN')}{g.unit ? ` ${g.unit}` : ''}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p className="font-semibold">{Math.round(g.confidence * 100)}%</p>
          </div>
        </div>

        {g.milestones.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Milestones · {g.milestones.length}</p>
            <div className="space-y-1.5">
              {g.milestones.map((m, i) => <MilestoneRow key={i} m={m} />)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] text-muted-foreground">
          <div>owner: <span className="text-foreground font-medium">{g.ownerId ?? '—'}</span></div>
          <div>deadline: <span className="text-foreground font-medium">{g.deadline ? new Date(g.deadline).toLocaleDateString('en-IN') : '—'}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalsTab({ summary, recent, onCreate, busy }: {
  summary: AGIDashboard['goals']['summary'];
  recent: AGIGoal[];
  onCreate: (input: { title: string; description: string; category: GoalCategory; priority: GoalPriority; targetMetric: string; targetValue: number; unit: string; ownerId: string }) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<GoalCategory>('growth');
  const [priority, setPriority] = useState<GoalPriority>('high');
  const [targetMetric, setTargetMetric] = useState('');
  const [targetValue, setTargetValue] = useState('100');
  const [unit, setUnit] = useState('');
  const [ownerId, setOwnerId] = useState('ceo');

  const applyTemplate = (idx: number) => {
    const t = GOAL_TEMPLATES[idx];
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description);
    setCategory(t.category);
    setPriority(t.priority);
    setTargetMetric(t.targetMetric);
    setUnit(t.unit);
    setOwnerId(t.ownerAgent);
  };

  const submit = () => {
    if (!title.trim() || !targetMetric.trim()) return;
    onCreate({ title, description, category, priority, targetMetric, targetValue: Number(targetValue) || 0, unit, ownerId });
    setTitle(''); setDescription(''); setTargetMetric(''); setUnit(''); setTargetValue('100');
  };

  return (
    <div className="space-y-4">
      <SummaryCard>
        <MiniStat label="Total goals" value={summary.totalGoals} />
        <MiniStat label="Active" value={summary.activeGoals} accent="text-amber-300" />
        <MiniStat label="Achieved" value={summary.achievedGoals} accent="text-emerald-400" />
        <MiniStat label="Failed" value={summary.failedGoals} accent="text-red-400" />
        <MiniStat label="Avg progress" value={fmtPct(summary.avgProgress)} />
        <MiniStat label="Avg confidence" value={fmtPct(summary.avgConfidence * 100)} />
        <MiniStat label="At risk" value={summary.goalsAtRisk} accent={summary.goalsAtRisk > 0 ? 'text-red-400' : undefined} />
        <MiniStat label="Categories" value={Object.values(summary.byCategory).filter((v) => (v as number) > 0).length} />
      </SummaryCard>

      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Target className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-semibold">Create Goal</span>
            <span className="text-[10px] text-muted-foreground ml-2">apply a template:</span>
            <Select onValueChange={(v) => applyTemplate(Number(v))}>
              <SelectTrigger className="h-7 w-[260px] text-[11px]"><SelectValue placeholder="8 goal templates…" /></SelectTrigger>
              <SelectContent>
                {GOAL_TEMPLATES.map((t, i) => <SelectItem key={t.goalKey} value={String(i)}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" className="h-9 sm:col-span-2" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="sm:col-span-2 min-h-[60px]" />
            <Select value={category} onValueChange={(v) => setCategory(v as GoalCategory)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as GoalPriority)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={targetMetric} onChange={(e) => setTargetMetric(e.target.value)} placeholder="targetMetric (e.g. revenue_mtd)" className="h-9" />
            <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="targetValue" className="h-9" type="number" />
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit (INR / pct / days)" className="h-9" />
            <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="ownerId (agent id)" className="h-9" />
          </div>
          <Button onClick={submit} disabled={busy || !title.trim() || !targetMetric.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4 mr-1.5" />}
            Create Goal
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No goals defined yet. Create one above or apply a template." />}
        {recent.map((g) => <GoalCard key={g.id} g={g} />)}
      </div>
    </div>
  );
}

// ─── Tab 6: Plans (Autonomous Project Manager) ────────────────────────────────

function TaskRow({ t }: { t: AGITask }) {
  const icon = t.status === 'done' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
    : t.status === 'in_progress' ? <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />
    : t.status === 'blocked' ? <AlertTriangle className="h-3 w-3 text-red-400" />
    : t.status === 'cancelled' ? <XCircle className="h-3 w-3 text-muted-foreground" />
    : <Clock className="h-3 w-3 text-muted-foreground" />;
  return (
    <div className="flex items-center gap-2 text-[11px] py-1">
      {icon}
      <span className="flex-1 truncate">{t.title}</span>
      {t.assignedAgent && <Badge variant="secondary" className="text-[9px] font-normal">{t.assignedAgent}</Badge>}
      <span className="text-muted-foreground shrink-0">{t.estimatedHours}h</span>
    </div>
  );
}

function PlanCard({ p }: { p: AGIPlan }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{p.planType}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(p.status)}`}>{p.status}</Badge>
            {p.ownerAgent && <Badge variant="outline" className="text-[10px]">owner: {p.ownerAgent}</Badge>}
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(p.updatedAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{p.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>

        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold">{fmtPct(p.progressPct)}</span>
          </div>
          <Progress value={p.progressPct} className="h-1.5" />
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">Risk of delay</span>
            <span className={`font-semibold ${riskColor(p.riskOfDelayPct)}`}>{fmtPct(p.riskOfDelayPct)}</span>
          </div>
          <Progress value={p.riskOfDelayPct} className="h-1.5" />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
          <div><span className="text-muted-foreground">Tasks</span><p className="font-semibold">{p.tasks.length}</p></div>
          <div><span className="text-muted-foreground">Est. days</span><p className="font-semibold">{p.estimatedDays}</p></div>
          <div><span className="text-muted-foreground">Target</span><p className="font-semibold">{p.targetDate ? new Date(p.targetDate).toLocaleDateString('en-IN') : '—'}</p></div>
        </div>

        {p.tasks.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Tasks · {p.tasks.filter((t) => t.status === 'done').length}/{p.tasks.length} done</p>
            <div className="space-y-0.5">
              {p.tasks.map((t) => <TaskRow key={t.id} t={t} />)}
            </div>
          </div>
        )}

        {p.milestones.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {p.milestones.map((m, i) => (
              <Badge key={i} variant="outline" className="text-[9px] font-normal">{m}</Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlansTab({ summary, recent }: {
  summary: AGIDashboard['plans']['summary'];
  recent: AGIPlan[];
}) {
  return (
    <div className="space-y-4">
      <SummaryCard>
        <MiniStat label="Total plans" value={summary.totalPlans} />
        <MiniStat label="Active" value={summary.activePlans} accent="text-amber-300" />
        <MiniStat label="Blocked" value={summary.blockedPlans} accent={summary.blockedPlans > 0 ? 'text-red-400' : undefined} />
        <MiniStat label="Completed" value={summary.completedPlans} accent="text-emerald-400" />
        <MiniStat label="Total tasks" value={summary.totalTasks} />
        <MiniStat label="Done tasks" value={summary.doneTasks} accent="text-emerald-400" />
        <MiniStat label="Avg progress" value={fmtPct(summary.avgProgress)} />
        <MiniStat label="At risk" value={summary.plansAtRisk} accent={summary.plansAtRisk > 0 ? 'text-red-400' : undefined} />
      </SummaryCard>

      {Object.keys(summary.agentUtilization).length > 0 && (
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Agent Utilization (hours allocated)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(summary.agentUtilization)
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v]) => (
                  <Badge key={k} variant="outline" className="text-[10px]">
                    {k} · {v as number}h
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No plans yet. Oracle creates plans from active goals." />}
        {recent.map((p) => <PlanCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}

// ─── Tab 7: Learning (Self-Improvement) ───────────────────────────────────────

function LearningCard({ e }: { e: LearningEpisode }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${statusClasses(e.learningType)}`}>{e.learningType}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(e.status)}`}>{e.status}</Badge>
            {e.sourceModule && <Badge variant="secondary" className="text-[10px] font-normal">{e.sourceModule.replace(/_/g, ' ')}</Badge>}
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{e.subject}</p>
        <div className="mt-2 space-y-1">
          <p className="text-[11px] text-muted-foreground"><span className="text-foreground/80 font-medium">Observation:</span> {e.observation}</p>
          <p className="text-[11px] text-foreground"><span className="text-muted-foreground font-medium">Lesson:</span> {e.lesson}</p>
          {e.appliedOptimization && (
            <p className="text-[11px] text-emerald-300"><span className="text-muted-foreground font-medium">Applied:</span> {e.appliedOptimization}</p>
          )}
        </div>
        {(e.beforeMetric !== null || e.afterMetric !== null) && (
          <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
            <div><span className="text-muted-foreground">Before</span><p className="font-semibold text-red-300">{e.beforeMetric ?? '—'}</p></div>
            <div><span className="text-muted-foreground">After</span><p className="font-semibold text-emerald-300">{e.afterMetric ?? '—'}</p></div>
            <div><span className="text-muted-foreground">Improvement</span><p className={`font-semibold ${e.improvementPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{e.improvementPct >= 0 ? '+' : ''}{e.improvementPct}%</p></div>
          </div>
        )}
        {e.improvementPct !== 0 && (
          <Progress value={Math.min(100, Math.abs(e.improvementPct))} className="h-1 mt-2" />
        )}
        <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
          <span>confidence: <span className="text-foreground font-medium">{Math.round(e.confidence * 100)}%</span></span>
          {e.sourceEntity && <span>source: {e.sourceEntity}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function LearningTab({ summary, recent, onSubmit, busy }: {
  summary: AGIDashboard['learning']['summary'];
  recent: LearningEpisode[];
  onSubmit: (input: { subject: string; observation: string; lesson: string; sourceModule: string }) => void;
  busy: boolean;
}) {
  const [subject, setSubject] = useState('');
  const [observation, setObservation] = useState('');
  const [lesson, setLesson] = useState('');
  const [sourceModule, setSourceModule] = useState('');

  const submit = () => {
    if (!subject.trim() || !lesson.trim()) return;
    onSubmit({ subject, observation, lesson, sourceModule });
    setSubject(''); setObservation(''); setLesson(''); setSourceModule('');
  };

  return (
    <div className="space-y-4">
      <SummaryCard>
        <MiniStat label="Total episodes" value={summary.totalEpisodes} />
        <MiniStat label="Applied" value={summary.appliedOptimizations} accent="text-amber-300" />
        <MiniStat label="Verified" value={summary.verifiedImprovements} accent="text-emerald-400" />
        <MiniStat label="Avg improvement" value={`${summary.avgImprovementPct >= 0 ? '+' : ''}${summary.avgImprovementPct}%`} />
        <MiniStat label="Self-improve rate" value={fmtPct(summary.selfImprovementRate * 100)} accent="text-emerald-400" />
      </SummaryCard>

      {summary.topLesson && (
        <Card className="bg-gradient-to-r from-emerald-500/[0.06] via-amber-500/[0.04] to-transparent border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold">Top Lesson</span>
            </div>
            <p className="text-[12px] text-foreground mt-2">{summary.topLesson}</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-semibold">Submit Feedback (Oracle will learn)</span>
          </div>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (what is this about?)" className="h-9" />
          <Textarea value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Observation (what did you observe?)" className="min-h-[60px]" />
          <Textarea value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="Lesson (what should Oracle learn?)" className="min-h-[60px]" />
          <div className="flex items-center gap-2">
            <Input value={sourceModule} onChange={(e) => setSourceModule(e.target.value)} placeholder="source module (optional)" className="h-9 flex-1" />
            <Button onClick={submit} disabled={busy || !subject.trim() || !lesson.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
              Submit
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No learning episodes yet. Oracle learns from successes, failures, and feedback." />}
        {recent.map((e) => <LearningCard key={e.id} e={e} />)}
      </div>
    </div>
  );
}

// ─── Tab 8: Digital Twin (Simulations) ────────────────────────────────────────

function StateTable({ baseline, projected }: { baseline: Record<string, number>; projected: Record<string, number> }) {
  const keys = Array.from(new Set([...Object.keys(baseline), ...Object.keys(projected)]));
  if (keys.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="rounded-md border border-white/[0.06] bg-background/40 p-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Baseline</p>
        <div className="space-y-0.5">
          {keys.map((k) => (
            <div key={k} className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{(baseline[k] ?? 0).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-2">
        <p className="text-[10px] uppercase tracking-wider text-amber-300/80 mb-1">Projected</p>
        <div className="space-y-0.5">
          {keys.map((k) => {
            const delta = (projected[k] ?? 0) - (baseline[k] ?? 0);
            return (
              <div key={k} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{(projected[k] ?? 0).toLocaleString('en-IN')}
                  {delta !== 0 && <span className={`ml-1 text-[10px] ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>({delta > 0 ? '+' : ''}{delta.toLocaleString('en-IN')})</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SimulationCard({ s }: { s: TwinSimulation }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{s.scenarioKey}</Badge>
            <Badge variant="outline" className={`text-[10px] ${recommendationClasses(s.recommendation)}`}>{s.recommendation.replace(/_/g, ' ')}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(s.status)}`}>{s.status}</Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(s.createdAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{s.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-[11px]">
          <div><span className="text-muted-foreground">Financial impact</span><p className={`font-semibold ${s.financialImpact >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtINR(s.financialImpact)}</p></div>
          <div><span className="text-muted-foreground">Revenue Δ</span><p className={`font-semibold ${s.revenueImpact >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtINR(s.revenueImpact)}</p></div>
          <div><span className="text-muted-foreground">Cost Δ</span><p className={`font-semibold ${s.costImpact >= 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{fmtINR(s.costImpact)}</p></div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <div className="flex justify-between text-[11px] mb-1"><span className="text-muted-foreground">Risk</span><span className={`font-semibold ${riskColor(s.riskScore)}`}>{s.riskScore}/100</span></div>
            <Progress value={s.riskScore} className="h-1.5" />
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1"><span className="text-muted-foreground">Confidence</span><span className="font-semibold">{Math.round(s.confidence * 100)}%</span></div>
            <Progress value={s.confidence * 100} className="h-1.5" />
          </div>
        </div>

        <StateTable baseline={s.baselineState} projected={s.projectedState} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[10px] text-muted-foreground">
          <div>timeline: <span className="text-foreground font-medium">{s.timeline ?? '—'}</span></div>
          {s.initiatedBy && <div>initiated by: <span className="text-foreground font-medium">{s.initiatedBy}</span></div>}
          {s.competitorReaction && <div className="sm:col-span-2">competitor: <span className="text-foreground font-medium">{s.competitorReaction}</span></div>}
          {s.rollbackStrategy && <div className="sm:col-span-2">rollback: <span className="text-foreground font-medium">{s.rollbackStrategy}</span></div>}
        </div>
      </CardContent>
    </Card>
  );
}

function TwinTab({ summary, recent, onRun, busy, lastResult }: {
  summary: AGIDashboard['twin']['summary'];
  recent: TwinSimulation[];
  onRun: (scenario: string) => void;
  busy: boolean;
  lastResult: TwinSimulation | null;
}) {
  const [scenario, setScenario] = useState<string>(SIMULATION_SCENARIOS[0]?.scenarioKey ?? 'pricing');
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <FlaskConical className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold">Run Simulation</span>
            </div>
            <Select value={scenario} onValueChange={setScenario}>
              <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIMULATION_SCENARIOS.map((s) => (
                  <SelectItem key={s.scenarioKey} value={s.scenarioKey}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => onRun(scenario)} disabled={busy} className="shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
              Simulate
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {SIMULATION_SCENARIOS.find((s) => s.scenarioKey === scenario)?.description ?? 'Select a scenario.'}
          </p>
        </CardContent>
      </Card>

      {lastResult && (
        <div>
          <SectionHeader icon={Sparkles} title="Latest Simulation Result" hint="just produced" />
          <SimulationCard s={lastResult} />
        </div>
      )}

      <SummaryCard>
        <MiniStat label="Total simulations" value={summary.totalSimulations} />
        <MiniStat label="Executed" value={summary.executedSimulations} accent="text-emerald-400" />
        <MiniStat label="Avg confidence" value={fmtPct(summary.avgConfidence * 100)} />
        <MiniStat label="Rollback rate" value={fmtPct(summary.rollbackRate * 100)} accent={summary.rollbackRate > 0.2 ? 'text-amber-400' : undefined} />
        <MiniStat label="Projected impact" value={fmtINR(summary.totalProjectedImpactINR)} accent={summary.totalProjectedImpactINR >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <MiniStat label="Scenarios run" value={Object.values(summary.byScenario).filter((v) => (v as number) > 0).length} />
      </SummaryCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No simulations yet. Run one above to predict outcomes before execution." />}
        {recent.map((s) => <SimulationCard key={s.id} s={s} />)}
      </div>
    </div>
  );
}

// ─── Tab 9: Decisions ─────────────────────────────────────────────────────────

function DecisionCard({ d, onApprove, onReject, onExecute, busy }: {
  d: AGIDecision;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${statusClasses(d.category)}`}>{d.category}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(d.status)}`}>{d.status.replace(/_/g, ' ')}</Badge>
            <Badge variant="secondary" className="text-[10px] font-normal">approval: {d.approvalRequired}</Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{d.title}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{d.summary}</p>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">by {d.proposingAgent}</Badge>
          {d.collaborators.length > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              {d.collaborators.map((c) => (
                <Badge key={c} variant="outline" className="text-[9px] font-normal">{c}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px]">
          <div><span className="text-muted-foreground">Financial</span><p className="font-semibold text-emerald-300">{fmtINR(d.financialImpact)}</p></div>
          <div><span className="text-muted-foreground">Expected ROI</span><p className="font-semibold">{fmtPct(d.expectedROI)}</p></div>
          <div><span className="text-muted-foreground">Confidence</span><p className="font-semibold">{Math.round(d.confidence * 100)}%</p></div>
          <div><span className="text-muted-foreground">Risk</span><p className={`font-semibold ${riskColor(d.riskScore)}`}>{d.riskScore}/100</p></div>
        </div>
        <Progress value={d.riskScore} className="h-1 mt-2" />

        {d.reasoning && (
          <div className="mt-3">
            <Button variant="link" size="sm" className="h-6 px-0 text-[10px]" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Hide' : 'Show'} reasoning chain
            </Button>
            {expanded && (
              <ScrollArea className="h-32 rounded-md bg-background/40 border border-white/[0.04]">
                <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap p-3 font-mono">{d.reasoning}</pre>
              </ScrollArea>
            )}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-white/[0.06] text-[10px] text-muted-foreground space-y-1">
          <div>signature: <code className="text-foreground/80 font-mono">{d.signature.slice(0, 18)}…</code></div>
          {d.approvedBy && <div>approved by: <span className="text-foreground font-medium">{d.approvedBy}</span> · {timeAgo(d.approvedAt)}</div>}
          {d.rollbackStrategy && <div>rollback: <span className="text-foreground/80">{d.rollbackStrategy}</span></div>}
        </div>

        <div className="flex gap-2 mt-3">
          {(d.status === 'proposed' || d.status === 'in_review') && (
            <>
              <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => onApprove(d.id)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] border-red-500/30 text-red-300 hover:bg-red-500/10" disabled={busy} onClick={() => onReject(d.id)}>
                <XCircle className="h-3 w-3 mr-1" /> Reject
              </Button>
            </>
          )}
          {(d.status === 'approved') && (
            <Button size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => onExecute(d.id)}>
              <Play className="h-3 w-3 mr-1" /> Execute
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionsTab({ recent, pending, onApprove, onReject, onExecute }: {
  recent: AGIDecision[];
  pending: number;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onExecute: (id: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const wrap = (fn: (id: string) => Promise<void>) => async (id: string) => {
    setBusyId(id);
    try { await fn(id); } finally { setBusyId(null); }
  };
  return (
    <div className="space-y-4">
      <SummaryCard>
        <MiniStat label="Pending" value={pending} accent={pending > 0 ? 'text-amber-400' : undefined} />
        <MiniStat label="Recent" value={recent.length} />
        <MiniStat label="Executed" value={recent.filter((d) => d.status === 'executed').length} accent="text-emerald-400" />
        <MiniStat label="Rejected" value={recent.filter((d) => d.status === 'rejected').length} accent="text-red-400" />
      </SummaryCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No decisions yet. Oracle proposes decisions through reasoning cycles." />}
        {recent.map((d) => (
          <DecisionCard key={d.id} d={d}
            onApprove={wrap(onApprove)} onReject={wrap(onReject)} onExecute={wrap(onExecute)}
            busy={busyId === d.id} />
        ))}
      </div>
    </div>
  );
}

// ─── Tab 10: Security ─────────────────────────────────────────────────────────

function GuardrailCard({ g }: { g: Guardrail }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {g.enabled
                ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                : <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <p className="font-semibold text-sm truncate">{g.label}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{g.description}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${g.enabled ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-white/[0.04] text-muted-foreground'}`}>
            {g.enabled ? 'ON' : 'OFF'}
          </Badge>
        </div>
        {g.violations > 0 && (
          <p className="text-[10px] text-red-300 mt-2">{g.violations} violation{g.violations !== 1 ? 's' : ''}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ApprovalCard({ a, onDecide, busy }: {
  a: AGIApproval;
  onDecide: (id: string, decision: 'approved' | 'rejected') => void;
  busy: boolean;
}) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{a.requestType}</Badge>
            <Badge variant="outline" className={`text-[10px] ${urgencyClasses(a.riskScore >= 70 ? 'critical' : a.riskScore >= 40 ? 'high' : a.riskScore >= 20 ? 'medium' : 'low')}`}>risk {a.riskScore}</Badge>
            <Badge variant="outline" className={`text-[10px] ${statusClasses(a.status)}`}>{a.status}</Badge>
            <Badge variant="outline" className="text-[10px]">needs: {a.requiredRole}</Badge>
          </div>
          <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{a.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
        <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
          <span>requested by: <span className="text-foreground font-medium">{a.requestedBy}</span></span>
          {a.decidedBy && <span>decided by: <span className="text-foreground font-medium">{a.decidedBy}</span></span>}
        </div>
        {a.status === 'pending' && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => onDecide(a.id, 'approved')}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] border-red-500/30 text-red-300 hover:bg-red-500/10" disabled={busy} onClick={() => onDecide(a.id, 'rejected')}>
              <XCircle className="h-3 w-3 mr-1" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SecurityTab({ summary, recentAudit, pendingApprovals, onShutdown, onResume, onDecideApproval, shutdownBusy, approvalBusy }: {
  summary: AGIDashboard['security']['summary'];
  recentAudit: AGIAuditRecord[];
  pendingApprovals: AGIApproval[];
  onShutdown: (reason: string) => void;
  onResume: () => void;
  onDecideApproval: (id: string, decision: 'approved' | 'rejected') => void;
  shutdownBusy: boolean;
  approvalBusy: string | null;
}) {
  const [showShutdown, setShowShutdown] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4">
      <SummaryCard>
        <MiniStat label="Total actions" value={summary.totalActions} />
        <MiniStat label="RBAC allow" value={fmtPct(summary.rbacAllowRate)} accent={summary.rbacAllowRate > 90 ? 'text-emerald-400' : 'text-amber-400'} />
        <MiniStat label="Denied" value={summary.deniedActions} accent={summary.deniedActions > 0 ? 'text-red-400' : undefined} />
        <MiniStat label="Pending" value={summary.pendingApprovals} accent={summary.pendingApprovals > 0 ? 'text-amber-400' : undefined} />
        <MiniStat label="Violations" value={summary.policyViolations} accent={summary.policyViolations > 0 ? 'text-red-400' : undefined} />
        <MiniStat label="Rolled back" value={summary.rolledBackActions} accent={summary.rolledBackActions > 0 ? 'text-red-400' : undefined} />
        <MiniStat label="Audit size" value={summary.auditTrailSize} />
        <MiniStat label="Shutdown" value={summary.emergencyShutdownActive ? 'ACTIVE' : 'SAFE'} accent={summary.emergencyShutdownActive ? 'text-red-400' : 'text-emerald-400'} />
      </SummaryCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Guardrails · {summary.guardrails.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.guardrails.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No guardrails provisioned.</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {summary.guardrails.map((g) => <GuardrailCard key={g.id} g={g} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`border ${summary.emergencyShutdownActive ? 'bg-red-500/[0.06] border-red-500/30' : 'bg-white/[0.03] border-white/[0.08]'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Power className="h-3.5 w-3.5" /> Emergency Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`text-[12px] ${summary.emergencyShutdownActive ? 'text-red-300' : 'text-emerald-300'}`}>
              {summary.emergencyShutdownActive
                ? '⚠ AGI is in EMERGENCY SHUTDOWN. All autonomous actions frozen except approvals and rollback.'
                : '✓ AGI is operating normally. Guardrails active.'}
            </div>
            {summary.emergencyShutdownActive ? (
              <Button onClick={onResume} disabled={shutdownBusy} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {shutdownBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4 mr-1.5" />}
                Resume Operations
              </Button>
            ) : showShutdown ? (
              <div className="space-y-2">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for shutdown (audited)" className="min-h-[60px]" />
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" disabled={shutdownBusy || !reason.trim()} onClick={() => { onShutdown(reason); setReason(''); setShowShutdown(false); }}>
                    {shutdownBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4 mr-1.5" />}
                    Confirm Shutdown
                  </Button>
                  <Button variant="outline" onClick={() => setShowShutdown(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="w-full border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={() => setShowShutdown(true)}>
                <AlertOctagon className="h-4 w-4 mr-1.5" /> Trigger Emergency Shutdown
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <SectionHeader icon={ClipboardList} title="Pending Approvals" hint={`${pendingApprovals.length} pending`} />
        {pendingApprovals.length === 0 ? (
          <EmptyState message="No pending approvals. AGI operates autonomously within guardrails." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendingApprovals.map((a) => (
              <ApprovalCard key={a.id} a={a} onDecide={onDecideApproval} busy={approvalBusy === a.id} />
            ))}
          </div>
        )}
      </div>

      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5" /> Audit Trail — Signed · Zero-Trust · Immutable
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/[0.06]">
                  <th className="py-2 pr-2">Action</th>
                  <th className="py-2 pr-2">Target</th>
                  <th className="py-2 pr-2">Actor</th>
                  <th className="py-2 pr-2">RBAC</th>
                  <th className="py-2 pr-2">Result</th>
                  <th className="py-2 pr-2">Signature</th>
                  <th className="py-2 pr-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-sm text-muted-foreground py-6">No audit records yet.</td></tr>
                )}
                {recentAudit.map((r) => (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2 pr-2"><Badge variant="secondary" className="text-[9px]">{r.actionType}</Badge></td>
                    <td className="py-2 pr-2 truncate max-w-[100px]">{r.targetType}{r.targetId ? ` · ${r.targetId.slice(0, 6)}` : ''}</td>
                    <td className="py-2 pr-2"><span className="font-medium">{r.actorType}</span> <span className="text-muted-foreground">({r.role})</span></td>
                    <td className="py-2 pr-2"><Badge variant="outline" className={`text-[9px] ${r.rbacDecision === 'allow' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : r.rbacDecision === 'deny' ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>{r.rbacDecision}</Badge></td>
                    <td className="py-2 pr-2"><Badge variant="outline" className={`text-[9px] ${statusClasses(r.result)}`}>{r.result}</Badge></td>
                    <td className="py-2 pr-2"><code className="text-[10px] text-muted-foreground font-mono">{r.signature.slice(0, 12)}…</code></td>
                    <td className="py-2 pr-2 text-right text-muted-foreground">{timeAgo(r.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 11: Analytics ────────────────────────────────────────────────────────

function AnalyticsProgress({ label, value, sub, accent }: {
  label: string; value: number; sub?: string; accent?: string;
}) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold mt-1 ${accent ?? 'text-foreground'}`}>{fmtPct(value)}{sub && <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">{sub}</span>}</p>
        <Progress value={value} className="h-1.5 mt-2" />
      </CardContent>
    </Card>
  );
}

function AnalyticsTab({ d }: { d: AGIDashboard }) {
  const capCoverage = d.core.totalCapabilities > 0 ? (d.core.onlineCapabilities / d.core.totalCapabilities) * 100 : 0;
  const swarmUtil = d.swarm.summary.totalAgents > 0 ? (d.swarm.summary.activeAgents / d.swarm.summary.totalAgents) * 100 : 0;
  const execRate = d.reasoning.summary.actionsProposed > 0 ? (d.reasoning.summary.actionsExecuted / d.reasoning.summary.actionsProposed) * 100 : 0;
  const simConf = d.twin.summary.avgConfidence * 100;
  const memGrowth = d.memoryEntries > 0 ? Math.min(100, (d.memoryEntries / 1000) * 100) : 0;
  const learnApply = d.learning.summary.totalEpisodes > 0 ? d.learning.summary.selfImprovementRate * 100 : 0;
  const rbac = d.security.summary.rbacAllowRate;
  return (
    <div className="space-y-4">
      <SummaryCard hint="AGI system KPIs — every value derived from real AGI subsystem activity">
        <MiniStat label="AGI Health" value={fmtPct(d.agiHealth)} accent={healthColor(d.agiHealth)} />
        <MiniStat label="Org Health" value={fmtPct(d.organizationHealth)} accent={healthColor(d.organizationHealth)} />
        <MiniStat label="Capabilities" value={`${d.capabilitiesOnline}/${d.core.totalCapabilities}`} />
        <MiniStat label="Reasoning" value={d.reasoningStatus} accent={d.reasoningStatus === 'active' ? 'text-emerald-400' : d.reasoningStatus === 'shutdown' ? 'text-red-400' : undefined} />
      </SummaryCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AnalyticsProgress label="AGI Health" value={d.agiHealth} accent={healthColor(d.agiHealth)} />
        <AnalyticsProgress label="Organization Health" value={d.organizationHealth} accent={healthColor(d.organizationHealth)} />
        <AnalyticsProgress label="Capability Coverage" value={capCoverage} sub={`${d.capabilitiesOnline}/${d.core.totalCapabilities}`} />
        <AnalyticsProgress label="Swarm Utilization" value={swarmUtil} sub={`${d.swarm.summary.activeAgents}/${d.swarm.summary.totalAgents}`} accent={swarmUtil > 60 ? 'text-emerald-400' : 'text-amber-400'} />
        <AnalyticsProgress label="Reasoning Execution Rate" value={execRate} sub={`${d.reasoning.summary.actionsExecuted}/${d.reasoning.summary.actionsProposed}`} accent={execRate > 60 ? 'text-emerald-400' : 'text-amber-400'} />
        <AnalyticsProgress label="Avg Reasoning Confidence" value={d.reasoning.summary.avgConfidence * 100} accent={d.reasoning.summary.avgConfidence > 0.7 ? 'text-emerald-400' : 'text-amber-400'} />
        <AnalyticsProgress label="Memory Growth" value={memGrowth} sub={`${d.memoryEntries} entries`} />
        <AnalyticsProgress label="Learning Application Rate" value={learnApply} sub={`${d.learning.summary.appliedOptimizations} applied`} accent={learnApply > 30 ? 'text-emerald-400' : 'text-amber-400'} />
        <AnalyticsProgress label="Simulation Confidence" value={simConf} accent={simConf > 70 ? 'text-emerald-400' : 'text-amber-400'} />
        <AnalyticsProgress label="RBAC Allow Rate" value={rbac} accent={rbac > 90 ? 'text-emerald-400' : 'text-amber-400'} />
        <AnalyticsProgress label="Swarm Avg Success" value={d.swarm.summary.avgSuccessRate * 100} accent={d.swarm.summary.avgSuccessRate > 0.8 ? 'text-emerald-400' : 'text-amber-400'} />
        <AnalyticsProgress label="Goals Avg Progress" value={d.goals.summary.avgProgress} sub={`${d.goals.summary.activeGoals} active`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Brain className="h-3.5 w-3.5" /> Reasoning Triggers Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(d.reasoning.summary.triggersBreakdown).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No triggers recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(d.reasoning.summary.triggersBreakdown)
                  .filter(([, v]) => (v as number) > 0)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                      <Badge variant="secondary" className="text-[10px]">{v as number}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Reasoning Focus Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(d.reasoning.summary.focusBreakdown).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No focus areas recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(d.reasoning.summary.focusBreakdown)
                  .filter(([, v]) => (v as number) > 0)
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                      <Badge variant="secondary" className="text-[10px]">{v as number}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab 12: Live State ───────────────────────────────────────────────────────

function LiveStateTab({ liveState }: { liveState: AGIDashboard['liveState'] }) {
  return (
    <div className="space-y-4">
      <SummaryCard hint="Live enterprise state — refreshed every 30s via the dashboard poll">
        <MiniStat label="Cash position" value={fmtINR(liveState.cashPositionINR)} accent="text-emerald-300" />
        <MiniStat label="Revenue MTD" value={fmtINR(liveState.revenueMTD)} />
        <MiniStat label="Compliance" value={fmtPct(liveState.complianceScore)} accent={healthColor(liveState.complianceScore)} />
        <MiniStat label="Runway" value={`${liveState.runwayDays}d`} accent={liveState.runwayDays < 60 ? 'text-red-400' : 'text-emerald-400'} />
        <MiniStat label="Open incidents" value={liveState.openIncidents} accent={liveState.openIncidents > 0 ? 'text-red-400' : undefined} />
        <MiniStat label="Active workflows" value={liveState.activeWorkflows} />
        <MiniStat label="Data sources" value={liveState.dataSources.length} />
      </SummaryCard>

      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Database className="h-3.5 w-3.5" /> Connected Data Sources ({liveState.dataSources.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveState.dataSources.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No data sources connected.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {liveState.dataSources.map((s, i) => (
                <div key={`${s}-${i}`} className="rounded-md border border-white/[0.06] bg-background/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Server className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="text-[12px] font-medium truncate">{s.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Cash Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-300">{fmtINR(liveState.cashPositionINR)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">runway: {liveState.runwayDays} days</p>
          </CardContent>
        </Card>
        <Card className="bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> Revenue MTD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmtINR(liveState.revenueMTD)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">compliance: {fmtPct(liveState.complianceScore)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-[1400px] mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="bg-white/[0.03] border-red-500/30 max-w-md w-full">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-semibold mt-3">Infinity AGI™ unavailable</h2>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
          <Button onClick={onRetry} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AGIDashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AGIDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  // Memory search state (lifted from MemoryTab so the parent can call the API)
  const [memoryResults, setMemoryResults] = useState<AGIMemory[] | null>(null);

  // Action busy states
  const [reasoningBusy, setReasoningBusy] = useState(false);
  const [goalBusy, setGoalBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [lastSim, setLastSim] = useState<TwinSimulation | null>(null);
  const [shutdownBusy, setShutdownBusy] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/agi/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load AGI dashboard (HTTP ${res.status})`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load AGI dashboard');
      setData(json.dashboard);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (!silent) setError(msg);
      else console.warn('[agi/dashboard] silent poll failed:', msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    pollRef.current = setInterval(() => fetchDashboard(true), POLL_INTERVAL_MS);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(clock);
    };
  }, [fetchDashboard]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const onRunReasoning = async (trigger: ReasoningTrigger, focus: ReasoningFocus | '') => {
    setReasoningBusy(true);
    try {
      const params = new URLSearchParams({ run: '1', trigger });
      if (focus) params.set('focus', focus);
      const res = await fetch(`/api/agi/reasoning?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Reasoning failed');
      toast({
        title: 'Reasoning cycle complete',
        description: `Cycle #${json.newCycle?.cycleNumber ?? '—'} · ${json.newCycle?.conclusions?.length ?? 0} conclusions · confidence ${Math.round((json.newCycle?.confidence ?? 0) * 100)}%`,
      });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Reasoning failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setReasoningBusy(false);
    }
  };

  const onSearchMemory = async (q: string) => {
    try {
      const res = await fetch(`/api/agi/memory?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Search failed');
      setMemoryResults(json.results ?? []);
      toast({ title: 'Memory search', description: `${json.results?.length ?? 0} memories match "${q}"` });
    } catch (e) {
      toast({ title: 'Search failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  };

  const onCreateGoal = async (input: { title: string; description: string; category: GoalCategory; priority: GoalPriority; targetMetric: string; targetValue: number; unit: string; ownerId: string }) => {
    setGoalBusy(true);
    try {
      const res = await fetch('/api/agi/goal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Create failed');
      toast({ title: 'Goal created', description: `Oracle will break "${input.title}" into milestones, tasks, and plans.` });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Create failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setGoalBusy(false);
    }
  };

  const onSubmitFeedback = async (input: { subject: string; observation: string; lesson: string; sourceModule: string }) => {
    setFeedbackBusy(true);
    try {
      const res = await fetch('/api/agi/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Submit failed');
      toast({ title: 'Feedback recorded', description: 'Oracle will learn from this observation.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Submit failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setFeedbackBusy(false);
    }
  };

  const onRunSimulation = async (scenario: string) => {
    setSimBusy(true);
    try {
      const res = await fetch('/api/agi/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, initiatedBy: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Simulation failed');
      setLastSim(json.simulation);
      toast({
        title: `Simulation: ${json.simulation?.title ?? scenario}`,
        description: `Recommendation: ${json.simulation?.recommendation ?? '—'} · impact ${fmtINR(json.simulation?.financialImpact ?? 0)} · confidence ${Math.round((json.simulation?.confidence ?? 0) * 100)}%`,
      });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Simulation failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setSimBusy(false);
    }
  };

  const onExecuteAction = async (decisionId: string, action: 'approve' | 'reject' | 'execute') => {
    try {
      const body = action === 'execute'
        ? { action: 'execute', targetType: 'decision', targetId: decisionId, actorId: 'ceo', role: 'ceo', reason: 'Manual execution from AGI Dashboard' }
        : { action: action === 'approve' ? 'approve_decision' : 'reject_decision', targetType: 'decision', targetId: decisionId, actorId: 'ceo', role: 'ceo', reason: `Manual ${action} from AGI Dashboard` };
      const res = await fetch('/api/agi/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok && res.status !== 202) throw new Error(json.error || `${action} failed`);
      if (res.status === 202 && json.approvalId) {
        toast({ title: 'Approval required', description: 'This decision requires human approval. A request has been queued.' });
      } else {
        toast({
          title: action === 'approve' ? 'Decision approved' : action === 'reject' ? 'Decision rejected' : 'Execution triggered',
          description: action === 'execute' ? 'Coordinated execution in progress. Audit trail recorded.' : 'Recorded in Oracle Memory for future learning.',
        });
      }
      fetchDashboard(true);
    } catch (e) {
      toast({ title: `${action} failed`, description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    }
  };

  const onTriggerShutdown = async (reason: string) => {
    setShutdownBusy(true);
    try {
      const res = await fetch('/api/agi/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'shutdown', reason, decidedBy: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Shutdown failed');
      toast({ title: 'EMERGENCY SHUTDOWN ACTIVE', description: 'All autonomous AGI actions frozen.', variant: 'destructive' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Shutdown failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setShutdownBusy(false);
    }
  };

  const onResumeShutdown = async () => {
    setShutdownBusy(true);
    try {
      const res = await fetch('/api/agi/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume_shutdown', decidedBy: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Resume failed');
      toast({ title: 'Operations resumed', description: 'Emergency shutdown lifted. AGI resuming autonomous operation.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Resume failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setShutdownBusy(false);
    }
  };

  const onDecideApproval = async (approvalId: string, decision: 'approved' | 'rejected') => {
    setApprovalBusy(approvalId);
    try {
      const res = await fetch('/api/agi/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decision, decidedBy: 'manager' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Decision failed');
      toast({ title: `Approval ${decision}`, description: 'Decision recorded in audit trail.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Decision failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setApprovalBusy(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? 'No data available'} onRetry={() => fetchDashboard()} />;

  const liveIndicator = data.reasoningStatus === 'shutdown' || data.emergencyShutdown
    ? 'bg-red-400'
    : data.reasoningStatus === 'active' || data.reasoningStatus === 'idle'
      ? 'bg-emerald-400 animate-pulse'
      : 'bg-amber-400';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="max-w-[1400px] w-full mx-auto p-4 sm:p-6 space-y-5 flex-1">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-purple-500/20 p-2">
                <Brain className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{AGI_TAGLINE}</h1>
                <p className="text-[11px] text-muted-foreground">{AGI_SUBTAGLINE}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">Founded, developed and owned by {AGI_FOUNDER}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${liveIndicator}`} />
              LIVE · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => fetchDashboard()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => onRunReasoning('scheduled', '')} disabled={reasoningBusy}
              className="bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700">
              {reasoningBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Run Reasoning Cycle
            </Button>
          </div>
        </motion.div>

        {/* ─── Emergency Shutdown Banner ─── */}
        {data.emergencyShutdown && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-red-500/[0.08] border-red-500/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="h-5 w-5 text-red-400" />
                    <div>
                      <p className="text-sm font-bold text-red-300">⚠️ EMERGENCY SHUTDOWN ACTIVE</p>
                      <p className="text-[11px] text-red-300/80">All AGI actions frozen except approvals and rollback.</p>
                    </div>
                  </div>
                  <Button onClick={onResumeShutdown} disabled={shutdownBusy} className="bg-emerald-600 hover:bg-emerald-700">
                    {shutdownBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4 mr-1.5" />}
                    Resume Operations
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── 12 KPI row ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <SectionHeader icon={Gauge} title="Infinity AGI™ — Live KPIs" hint="updates every 30s · Oracle's autonomous enterprise intelligence" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
            <KPICard icon={Brain} label="AGI Health" value={fmtPct(data.agiHealth)} accent={healthColor(data.agiHealth)} />
            <KPICard icon={Activity} label="Org Health" value={fmtPct(data.organizationHealth)} accent={healthColor(data.organizationHealth)} />
            <KPICard icon={Cpu} label="Capabilities" value={`${data.capabilitiesOnline}/${data.core.totalCapabilities}`} />
            <KPICard icon={Brain} label="Reasoning" value={data.reasoningStatus}
              accent={data.reasoningStatus === 'active' ? 'text-emerald-400' : data.reasoningStatus === 'shutdown' ? 'text-red-400' : 'text-muted-foreground'} />
            <KPICard icon={RefreshCw} label="Cycles Today" value={data.cyclesToday} />
            <KPICard icon={Bot} label="Active Agents" value={`${data.activeAgents}/${data.swarm.summary.totalAgents}`} />
            <KPICard icon={Target} label="Active Goals" value={data.activeGoals} accent="text-amber-300" />
            <KPICard icon={Clock} label="Pending Approvals" value={data.pendingApprovals} accent={data.pendingApprovals > 0 ? 'text-amber-400' : undefined} />
            <KPICard icon={MemoryStick} label="Memory Entries" value={data.memoryEntries} />
            <KPICard icon={GraduationCap} label="Learnings Applied" value={data.learningsApplied} accent="text-emerald-400" />
            <KPICard icon={FlaskConical} label="Simulations" value={data.simulationsRun} />
            <KPICard icon={data.emergencyShutdown ? AlertOctagon : ShieldCheck}
              label="Shutdown" value={data.emergencyShutdown ? 'ACTIVE' : 'SAFE'}
              accent={data.emergencyShutdown ? 'text-red-400' : 'text-emerald-400'} />
          </div>
        </motion.div>

        {/* ─── 12 Tabs ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-auto p-1 bg-white/[0.02] border border-white/[0.06]">
              <TabsTrigger value="overview" className="text-xs"><Network className="h-3 w-3 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="reasoning" className="text-xs"><Brain className="h-3 w-3 mr-1" />Reasoning</TabsTrigger>
              <TabsTrigger value="swarm" className="text-xs"><Bot className="h-3 w-3 mr-1" />Swarm</TabsTrigger>
              <TabsTrigger value="memory" className="text-xs"><MemoryStick className="h-3 w-3 mr-1" />Memory</TabsTrigger>
              <TabsTrigger value="goals" className="text-xs"><Target className="h-3 w-3 mr-1" />Goals</TabsTrigger>
              <TabsTrigger value="plans" className="text-xs"><ClipboardList className="h-3 w-3 mr-1" />Plans</TabsTrigger>
              <TabsTrigger value="learning" className="text-xs"><GraduationCap className="h-3 w-3 mr-1" />Learning</TabsTrigger>
              <TabsTrigger value="twin" className="text-xs"><FlaskConical className="h-3 w-3 mr-1" />Digital Twin</TabsTrigger>
              <TabsTrigger value="decisions" className="text-xs"><GitBranch className="h-3 w-3 mr-1" />Decisions</TabsTrigger>
              <TabsTrigger value="security" className="text-xs"><Shield className="h-3 w-3 mr-1" />Security</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs"><Gauge className="h-3 w-3 mr-1" />Analytics</TabsTrigger>
              <TabsTrigger value="live" className="text-xs"><Activity className="h-3 w-3 mr-1" />Live State</TabsTrigger>
            </TabsList>
          </ScrollArea>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab core={data.core} liveState={data.liveState} />
          </TabsContent>
          <TabsContent value="reasoning" className="mt-4">
            <ReasoningTab summary={data.reasoning.summary} recent={data.reasoning.recent} onRun={onRunReasoning} busy={reasoningBusy} />
          </TabsContent>
          <TabsContent value="swarm" className="mt-4">
            <SwarmTab summary={data.swarm.summary} agents={data.swarm.agents} recentMessages={data.swarm.recentMessages} />
          </TabsContent>
          <TabsContent value="memory" className="mt-4">
            <MemoryTab summary={data.memory.summary} recent={memoryResults ?? data.memory.recent} onSearch={onSearchMemory} />
          </TabsContent>
          <TabsContent value="goals" className="mt-4">
            <GoalsTab summary={data.goals.summary} recent={data.goals.recent} onCreate={onCreateGoal} busy={goalBusy} />
          </TabsContent>
          <TabsContent value="plans" className="mt-4">
            <PlansTab summary={data.plans.summary} recent={data.plans.recent} />
          </TabsContent>
          <TabsContent value="learning" className="mt-4">
            <LearningTab summary={data.learning.summary} recent={data.learning.recent} onSubmit={onSubmitFeedback} busy={feedbackBusy} />
          </TabsContent>
          <TabsContent value="twin" className="mt-4">
            <TwinTab summary={data.twin.summary} recent={data.twin.recent} onRun={onRunSimulation} busy={simBusy} lastResult={lastSim} />
          </TabsContent>
          <TabsContent value="decisions" className="mt-4">
            <DecisionsTab recent={data.decisions.recent} pending={data.decisions.pending}
              onApprove={(id) => onExecuteAction(id, 'approve')}
              onReject={(id) => onExecuteAction(id, 'reject')}
              onExecute={(id) => onExecuteAction(id, 'execute')}
            />
          </TabsContent>
          <TabsContent value="security" className="mt-4">
            <SecurityTab summary={data.security.summary} recentAudit={data.security.recentAudit} pendingApprovals={data.security.pendingApprovals}
              onShutdown={onTriggerShutdown} onResume={onResumeShutdown} onDecideApproval={onDecideApproval}
              shutdownBusy={shutdownBusy} approvalBusy={approvalBusy} />
          </TabsContent>
          <TabsContent value="analytics" className="mt-4">
            <AnalyticsTab d={data} />
          </TabsContent>
          <TabsContent value="live" className="mt-4">
            <LiveStateTab liveState={data.liveState} />
          </TabsContent>
        </Tabs>

        {/* ─── Footer ─── */}
        <footer className="mt-6 pt-4 border-t border-white/[0.06]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div>
              <p className="text-sm font-semibold tracking-tight">GSTPilot Infinity™ — {AGI_TAGLINE}</p>
              <p className="text-[11px] text-muted-foreground">{AGI_SUBTAGLINE}</p>
              <p className="text-[11px] text-muted-foreground/70">Founder & Owner: {AGI_FOUNDER}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${liveIndicator}`} />
              <span className="text-[11px] text-muted-foreground">Reasoning: <span className={`font-semibold ${data.reasoningStatus === 'shutdown' ? 'text-red-400' : data.reasoningStatus === 'active' ? 'text-emerald-400' : 'text-amber-400'}`}>{data.reasoningStatus}</span></span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
