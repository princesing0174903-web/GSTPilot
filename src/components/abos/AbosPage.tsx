'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT AUTONOMOUS BUSINESS OPERATING SYSTEM™ (ABOS)
// Phase 7 — Think. Decide. Execute. Grow Automatically.
//           Observe. Think. Decide. Execute. Learn. Grow.
//
// Modules rendered here (all 10):
//   Module 1  — Autonomous CEO™
//   Module 2  — Business Digital Twin™
//   Module 3  — Decision Engine™
//   Module 4  — Execution Engine™
//   Module 5  — Multi-Agent System™
//   Module 6  — Event Engine™
//   Module 7  — Prediction Lab™
//   Module 8  — Autonomous Workflows™
//   Module 9  — Learning Engine™
//   Module 10 — Command Center™ (Morning Brief)
//
// Data source: GET /api/abos → AbosState (auto-refresh every 60s).
// Interactions:
//   POST /api/abos/simulate  → SimulationResult (Digital Twin what-if)
//   POST /api/abos/decide    → approve a Decision
//   POST /api/abos/execute   → trigger an Execution capability
//   POST /api/abos/predict   → focused Prediction Lab reading
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Brain, TrendingUp, Wallet, IndianRupee, Clock,
  RefreshCw, Zap, Target, Users, Sparkles, CheckCircle2, AlertTriangle,
  Cpu, Workflow, Eye, Lightbulb,
  PlayCircle, Send,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type {
  AbosAgent, AbosAgentId, AbosState, AbosRiskLevel, AutonomousCEO,
  AutonomousWorkflow, BusinessDecision, DetectedProblem, ExecutionAction,
  ExecutionCapability, ExecutionStatus, LearnedFact, MorningBrief,
  NetworkEvent, PredictionHorizon, PredictionMatrix, SimulationRequest,
  SimulationResult, WhatIfScenario, WorkflowStep,
} from '@/lib/abos/types';
import {
  ABOS_RISK_GLYPH, ABOS_RISK_LABEL, EXEC_STATUS_GLYPH, EXEC_STATUS_LABEL,
  HORIZON_LABEL, WHATIF_PRESETS,
} from '@/lib/abos/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '₹0';
  const abs = Math.abs(n);
  if (abs >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

function signedINR(n: number): string {
  if (n === 0) return '₹0';
  return `${n >= 0 ? '+' : '−'}${formatINR(Math.abs(n))}`;
}

function signedPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 0) return 'just now';
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const RISK_TONE: Record<AbosRiskLevel, string> = {
  low: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.06]',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/[0.06]',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/[0.06]',
  critical: 'text-red-400 border-red-500/30 bg-red-500/[0.06]',
};

const AGENT_META: Record<AbosAgentId, { emoji: string; name: string }> = {
  'ceo-agent': { emoji: '👨‍💼', name: 'CEO Agent' },
  'cfo-agent': { emoji: '💰', name: 'CFO Agent' },
  'gst-agent': { emoji: '🧾', name: 'GST Agent' },
  'analyst-agent': { emoji: '📊', name: 'Analyst Agent' },
  'collections-agent': { emoji: '📞', name: 'Collections Agent' },
  'compliance-agent': { emoji: '🛡️', name: 'Compliance Agent' },
  'growth-agent': { emoji: '📈', name: 'Growth Agent' },
  'legal-agent': { emoji: '⚖️', name: 'Legal Agent' },
};

const STATUS_TONE: Record<ExecutionStatus, string> = {
  detected: 'text-sky-400',
  planning: 'text-violet-400',
  executing: 'text-amber-400',
  completed: 'text-emerald-400',
  monitoring: 'text-cyan-400',
  failed: 'text-red-400',
  idle: 'text-muted-foreground',
};

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ icon: Icon, emoji, title, subtitle, action }: {
  icon: LucideIcon; emoji?: string; title: string; subtitle?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            {emoji && <span className="text-base">{emoji}</span>}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (!data.length) return null;
  const w = 80, h = 24;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function AbosPage() {
  const { toast } = useToast();
  const [state, setState] = useState<AbosState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchState = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/abos', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AbosState = await res.json();
      setState(data);
    } catch (err) {
      console.error('[ABOS] fetch failed:', err);
      if (!silent) toast({ title: 'Failed to load ABOS state', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchState();
    const id = setInterval(() => fetchState(true), 60000);
    return () => clearInterval(id);
  }, [fetchState]);

  if (loading || !state) {
    return <AbosSkeleton />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header strip */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground md:text-2xl">
              <span className="accent-gradient-soft rounded-lg px-2 py-0.5 text-sm font-bold accent-text">ABOS™</span>
              Autonomous Business Operating System
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Think. Decide. Execute. Grow Automatically. · Observe → Think → Decide → Execute → Learn → Grow
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Autonomous · {state.ceo.operatingMode}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => fetchState()} disabled={refreshing} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </FadeIn>

      {/* Module 10: Command Center (Morning Brief) */}
      <MorningBriefSection brief={state.morningBrief} />

      {/* Module 1: Autonomous CEO */}
      <AutonomousCEOSection ceo={state.ceo} />

      {/* Module 5: Multi-Agent System */}
      <MultiAgentSection agents={state.agents} onExecute={(cap) => onExecute(cap, toast, fetchState)} />

      {/* Module 3: Decision Engine + Module 2: Digital Twin (side by side on xl) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DecisionEngineSection decisions={state.decisions} onApprove={(id) => onDecide(id, toast, fetchState)} />
        <DigitalTwinSection twin={state.digitalTwin} />
      </div>

      {/* Module 7: Prediction Lab */}
      <PredictionLabSection predictions={state.predictions} />

      {/* Module 8: Autonomous Workflows */}
      <WorkflowsSection workflows={state.workflows} />

      {/* Module 6 + Module 4: Event Engine + Execution Engine */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <EventEngineSection events={state.events} />
        <ExecutionEngineSection execution={state.execution} onExecute={(cap) => onExecute(cap, toast, fetchState)} />
      </div>

      {/* Module 9: Learning Engine */}
      <LearningSection learning={state.learning} />

      {/* Footer personality strip */}
      <FadeIn delay={0.1}>
        <Card className="overflow-hidden border-white/[0.06] bg-white/[0.02]">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient-soft">
                <Sparkles className="h-5 w-5 accent-text" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Oracle Autonomous Personality™</p>
                <p className="text-xs text-muted-foreground">
                  {state.personality.roles.join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.personality.spokenBehaviours.slice(0, 3).map((b) => (
                <Badge key={b} variant="outline" className="border-white/[0.08] bg-white/[0.02] text-[10px] font-normal text-muted-foreground">
                  “{b}”
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <div className="h-4" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 10: Command Center (Morning Brief)
// ═══════════════════════════════════════════════════════════════════════════════

function MorningBriefSection({ brief }: { brief: MorningBrief }) {
  const metrics = [
    { label: 'Revenue', value: brief.metrics.revenue, icon: TrendingUp, tone: 'text-emerald-400' },
    { label: 'Cash', value: brief.metrics.cash, icon: Wallet, tone: 'text-cyan-400' },
    { label: 'GST Liability', value: brief.metrics.gst, icon: IndianRupee, tone: 'text-amber-400' },
    { label: 'Collections', value: brief.metrics.collections, icon: Activity, tone: 'text-violet-400' },
  ];
  return (
    <FadeIn delay={0.05}>
      <Card className="overflow-hidden border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span>{brief.greeting}, {brief.userName} 👋</span>
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{brief.dateLabel} · {brief.tagline}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`gap-1.5 ${RISK_TONE[brief.riskLevel]}`}>
                {ABOS_RISK_GLYPH[brief.riskLevel]} Risk: {brief.riskLabel}
              </Badge>
              <Badge variant="outline" className="gap-1.5 border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-400">
                <TrendingUp className="h-3 w-3" /> Forecast: {brief.forecastLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</span>
                    <Icon className={`h-3.5 w-3.5 ${m.tone}`} />
                  </div>
                  <p className={`mt-1.5 text-lg font-bold ${m.tone}`}>{formatINR(m.value)}</p>
                </div>
              );
            })}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Decisions</p>
            <div className="space-y-1.5">
              {brief.todaysDecisions.length === 0 && (
                <p className="text-sm text-muted-foreground">No critical decisions today — you're all caught up.</p>
              )}
              {brief.todaysDecisions.map((d) => (
                <div key={d.rank} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md accent-gradient-soft text-xs font-bold accent-text">{d.rank}</span>
                  <span className="flex-1 text-sm text-foreground">{d.text}</span>
                  {d.amountINR ? <span className="text-xs font-semibold text-amber-400">{formatINR(d.amountINR)}</span> : null}
                  <Badge variant="outline" className="gap-1 border-white/[0.08] text-[10px] text-muted-foreground">
                    {AGENT_META[d.ownerAgent].emoji} {AGENT_META[d.ownerAgent].name}
                  </Badge>
                  {d.autoExecutable && (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.06] text-[10px] text-emerald-400">Auto</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 1: Autonomous CEO
// ═══════════════════════════════════════════════════════════════════════════════

function AutonomousCEOSection({ ceo }: { ceo: AutonomousCEO }) {
  const statusTone = ceo.status === 'executing' ? 'text-amber-400' : ceo.status === 'thinking' ? 'text-violet-400' : 'text-emerald-400';
  return (
    <FadeIn delay={0.08}>
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader
            icon={Cpu}
            emoji="🧠"
            title="Autonomous CEO™"
            subtitle="Monitors 24/7 · Detects problems · Creates plans · Prioritises · Executes · Learns"
            action={
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`gap-1.5 ${statusTone === 'text-emerald-400' ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : statusTone === 'text-amber-400' ? 'border-amber-500/30 bg-amber-500/[0.06]' : 'border-violet-500/30 bg-violet-500/[0.06]'} ${statusTone}`}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                  </span>
                  {ceo.status}
                </Badge>
                <Badge variant="outline" className="gap-1 border-white/[0.08] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {ceo.uptimeHours}h uptime
                </Badge>
              </div>
            }
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-sm text-foreground">
            <span className="mr-2 accent-text font-semibold">Headline:</span>{ceo.headline}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Cycles Today" value={`${ceo.cycleCount}`} icon={RefreshCw} />
            <StatTile label="Executed Today" value={`${ceo.executedActionsToday}`} icon={CheckCircle2} tone="text-emerald-400" />
            <StatTile label="Problems Detected" value={`${ceo.detectedProblems.length}`} icon={AlertTriangle} tone="text-amber-400" />
            <StatTile label="Active Plans" value={`${ceo.activePlans.length}`} icon={Target} tone="text-violet-400" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detected Problems → Routed</p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                {ceo.detectedProblems.length === 0 && <EmptyRow text="No problems detected — business is healthy." />}
                {ceo.detectedProblems.map((p: DetectedProblem) => (
                  <div key={p.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{p.title}</p>
                      <Badge variant="outline" className={`shrink-0 gap-1 ${RISK_TONE[p.severity]}`}>
                        {ABOS_RISK_GLYPH[p.severity]} {ABOS_RISK_LABEL[p.severity]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="gap-1 border-white/[0.08] text-[10px]">
                        {AGENT_META[p.routedTo].emoji} {AGENT_META[p.routedTo].name}
                      </Badge>
                      <span className={STATUS_TONE[p.status]}>{EXEC_STATUS_GLYPH[p.status]} {EXEC_STATUS_LABEL[p.status]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Learning Log (today)</p>
              <div className="max-h-64 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                {ceo.learningLog.map((l, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <p className="text-xs text-muted-foreground">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function StatTile({ label, value, icon: Icon, tone = 'text-foreground' }: {
  label: string; value: string; icon: LucideIcon; tone?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-white/[0.06] p-3 text-center text-xs text-muted-foreground">{text}</p>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 5: Multi-Agent System
// ═══════════════════════════════════════════════════════════════════════════════

function MultiAgentSection({ agents, onExecute }: {
  agents: AbosAgent[];
  onExecute: (cap: ExecutionCapability) => void;
}) {
  return (
    <FadeIn delay={0.1}>
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader icon={Users} emoji="🤖" title="Multi-Agent System™" subtitle="8 AI employees collaborating 24/7" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {agents.map((a, i) => (
              <FadeIn key={a.id} delay={0.03 * i}>
                <AgentCard agent={a} />
              </FadeIn>
            ))}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function AgentCard({ agent }: { agent: AbosAgent }) {
  const statusTone =
    agent.status === 'alert' ? 'border-red-500/30 bg-red-500/[0.06] text-red-400'
    : agent.status === 'working' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400'
    : agent.status === 'monitoring' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400'
    : 'border-white/[0.08] bg-white/[0.02] text-muted-foreground';
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{agent.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-foreground">{agent.name}</p>
            <p className="text-[10px] text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <Badge variant="outline" className={`gap-1 text-[10px] ${statusTone}`}>
          <span className="relative flex h-1.5 w-1.5">
            {(agent.status === 'alert' || agent.status === 'working') && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          {agent.status}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] italic text-muted-foreground">“{agent.tagline}”</p>
      <div className="mt-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2">
        <p className="text-[11px] font-medium text-foreground">{agent.currentTask}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Last: {agent.lastAction}</p>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>⚙️ {agent.activeWorkflows} flows</span>
        <span>✅ {agent.completedToday} done</span>
        <span>🎯 {agent.decisionsToday} decisions</span>
      </div>
      <Separator className="my-2.5 bg-white/[0.06]" />
      <div className="flex flex-wrap gap-1">
        {agent.expertise.slice(0, 3).map((e) => (
          <Badge key={e} variant="outline" className="border-white/[0.08] text-[9px] font-normal text-muted-foreground">{e}</Badge>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Collaborates with: {agent.collaboratesWith.map((c) => AGENT_META[c]?.emoji ?? '🤖').join(' ')}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 3: Decision Engine
// ═══════════════════════════════════════════════════════════════════════════════

function DecisionEngineSection({ decisions, onApprove }: {
  decisions: BusinessDecision[];
  onApprove: (id: string) => void;
}) {
  return (
    <FadeIn delay={0.12}>
      <Card className="flex h-full flex-col border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader icon={Target} emoji="🎯" title="Decision Engine™" subtitle="Every decision: Impact · Confidence · Risk · Expected ROI" />
        </CardHeader>
        <CardContent className="flex-1">
          <div className="max-h-[28rem] space-y-2 overflow-y-auto custom-scrollbar pr-1">
            {decisions.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{d.title}</p>
                    <p className="mt-0.5 text-xs accent-text">{d.headline}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 gap-1 ${RISK_TONE[d.risk]}`}>
                    {ABOS_RISK_GLYPH[d.risk]} {ABOS_RISK_LABEL[d.risk]}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{d.rationale}</p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <Metric label="Impact" value={formatINR(d.impactMagnitudeINR)} tone="text-emerald-400" />
                  <Metric label="Confidence" value={`${d.confidencePct}%`} tone="text-cyan-400" />
                  <Metric label="Expected ROI" value={`${d.expectedROI}%`} tone="text-violet-400" />
                  <Metric label="Horizon" value={HORIZON_LABEL_SHORT[d.timeHorizon]} tone="text-amber-400" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="gap-1 border-white/[0.08] text-[10px] text-muted-foreground">
                    {AGENT_META[d.ownerAgent].emoji} {AGENT_META[d.ownerAgent].name}
                  </Badge>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => onApprove(d.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

const HORIZON_LABEL_SHORT: Record<string, string> = { '7d': '7D', '30d': '30D', '90d': '90D', '1y': '1Y' };

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-white/[0.05] bg-white/[0.02] py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xs font-bold ${tone}`}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 2: Business Digital Twin
// ═══════════════════════════════════════════════════════════════════════════════

function DigitalTwinSection({ twin }: {
  twin: AbosState['digitalTwin'];
}) {
  const { toast } = useToast();
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const ts = twin.twinState;
  const twinMetrics = [
    { label: 'Revenue', value: formatINR(ts.revenue), tone: 'text-emerald-400' },
    { label: 'Cash', value: formatINR(ts.cash), tone: 'text-cyan-400' },
    { label: 'GST', value: formatINR(ts.gstLiability), tone: 'text-amber-400' },
    { label: 'Net Profit', value: formatINR(ts.netProfit), tone: 'text-violet-400' },
    { label: 'Margin', value: `${ts.profitMarginPct.toFixed(1)}%`, tone: 'text-emerald-400' },
    { label: 'Collections', value: formatINR(ts.pendingCollections), tone: 'text-cyan-400' },
    { label: 'Employees', value: `${ts.employeeCount}`, tone: 'text-foreground' },
    { label: 'Vendors', value: `${ts.vendorCount}`, tone: 'text-foreground' },
  ];
  const run = async (req: SimulationRequest) => {
    setBusy(true);
    try {
      const res = await fetch('/api/abos/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const data = await res.json();
      if (data.result) {
        setResult(data.result);
        toast({ title: 'Simulation complete', description: data.result.impactSummary });
      } else {
        toast({ title: 'Simulation failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Simulation failed', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <FadeIn delay={0.14}>
      <Card className="flex h-full flex-col border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader icon={Cpu} emoji="🪞" title="Business Digital Twin™" subtitle="A live digital copy — simulate before you execute" />
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {twinMetrics.map((m) => (
              <div key={m.label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2 text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className={`mt-0.5 text-xs font-bold ${m.tone}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Run a What-If Simulation</p>
            <div className="flex flex-wrap gap-1.5">
              {WHATIF_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => run(p)}
                  className="h-7 gap-1.5 text-xs"
                >
                  <PlayCircle className="h-3.5 w-3.5" /> {p.label}
                </Button>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-white/[0.08] accent-gradient-soft p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{result.emoji} {result.question}</p>
                  <Badge variant="outline" className={`shrink-0 gap-1 ${RISK_TONE[result.riskAfter]}`}>
                    {ABOS_RISK_GLYPH[result.riskAfter]} Risk → {ABOS_RISK_LABEL[result.riskAfter]}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-foreground">{result.impactSummary}</p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <Metric label="Cash After" value={formatINR(result.projection.cash)} tone={result.projection.deltas.cash >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                  <Metric label="Δ Cash" value={signedINR(result.projection.deltas.cash)} tone={result.projection.deltas.cash >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                  <Metric label="Margin" value={`${result.projection.profitMarginPct.toFixed(1)}%`} tone="text-violet-400" />
                  <Metric label="Runway" value={result.projection.runwayDays ? `${result.projection.runwayDays}d` : '∞'} tone="text-cyan-400" />
                </div>
                <p className="mt-2 text-[11px] accent-text">💡 {result.recommendation}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-computed Scenarios</p>
            <div className="space-y-1.5">
              {twin.scenarios.map((s: WhatIfScenario) => (
                <div key={s.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{s.emoji} {s.question}</p>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${RISK_TONE[s.riskAfter]}`}>
                      {ABOS_RISK_GLYPH[s.riskAfter]} {ABOS_RISK_LABEL[s.riskAfter]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Cash {signedINR(s.projection.deltas.cash)} · Margin {s.projection.profitMarginPct.toFixed(1)}% · Runway {s.projection.runwayDays || '∞'}d
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 7: Prediction Lab
// ═══════════════════════════════════════════════════════════════════════════════

function PredictionLabSection({ predictions }: { predictions: PredictionMatrix[] }) {
  const horizons: PredictionHorizon[] = ['7d', '30d', '90d', '1y'];
  return (
    <FadeIn delay={0.16}>
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader icon={TrendingUp} emoji="🔮" title="Prediction Lab™" subtitle="7 metrics × 4 horizons (7D · 30D · 90D · 1Y)" />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Metric</th>
                  <th className="px-3 py-2 text-right font-medium">Baseline</th>
                  {horizons.map((h) => (
                    <th key={h} className="px-3 py-2 text-right font-medium">{HORIZON_LABEL[h]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {predictions.map((m) => (
                  <tr key={m.metric} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{m.emoji}</span>
                        <div>
                          <p className="font-medium text-foreground">{m.label}</p>
                          <p className="text-[10px] text-muted-foreground">{m.horizons['30d'].note}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                      {m.unit === 'INR' ? formatINR(m.currentBaseline) : `${m.currentBaseline}${m.unit === 'pct' ? '%' : ''}`}
                    </td>
                    {horizons.map((h) => {
                      const r = m.horizons[h];
                      const tone = r.trend === 'up' ? 'text-emerald-400' : r.trend === 'down' ? 'text-red-400' : 'text-muted-foreground';
                      const arrow = r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→';
                      return (
                        <td key={h} className="px-3 py-2.5 text-right">
                          <p className={`text-xs font-bold ${tone}`}>{arrow} {m.unit === 'INR' ? formatINR(r.value) : `${r.value}${m.unit === 'pct' ? '%' : ''}`}</p>
                          <p className="text-[9px] text-muted-foreground">{r.confidencePct}% conf.</p>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 8: Autonomous Workflows
// ═══════════════════════════════════════════════════════════════════════════════

function WorkflowsSection({ workflows }: { workflows: AutonomousWorkflow[] }) {
  return (
    <FadeIn delay={0.18}>
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader icon={Workflow} emoji="⚙️" title="Autonomous Workflows™" subtitle="Detect → Plan → Execute → Monitor → Report — automatically" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {workflows.map((w) => (
              <WorkflowCard key={w.id} workflow={w} />
            ))}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function WorkflowCard({ workflow }: { workflow: AutonomousWorkflow }) {
  const statusTone =
    workflow.status === 'running' ? 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400'
    : workflow.status === 'alert' ? 'border-red-500/30 bg-red-500/[0.06] text-red-400'
    : workflow.status === 'completed' ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-400'
    : 'border-white/[0.08] bg-white/[0.02] text-muted-foreground';
  const completedSteps = workflow.steps.filter((s) => s.status === 'completed').length;
  const pct = Math.round((completedSteps / workflow.steps.length) * 100);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{workflow.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-foreground">{workflow.name}</p>
            <p className="text-[10px] text-muted-foreground">{workflow.tagline}</p>
          </div>
        </div>
        <Badge variant="outline" className={`gap-1 text-[10px] ${statusTone}`}>
          <span className="relative flex h-1.5 w-1.5">
            {workflow.status === 'running' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          {workflow.status}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{workflow.outcomeSummary ?? workflow.description}</p>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={pct} className="h-1.5" />
        <span className="text-[10px] text-muted-foreground">{completedSteps}/{workflow.steps.length}</span>
      </div>
      <div className="mt-2.5 space-y-1">
        {workflow.steps.map((s: WorkflowStep) => (
          <div key={s.order} className="flex items-center gap-2 text-[11px]">
            <span className={`${STATUS_TONE[s.status]} shrink-0`}>{EXEC_STATUS_GLYPH[s.status]}</span>
            <span className="text-muted-foreground">{s.order}.</span>
            <span className="flex-1 text-foreground">{s.title}</span>
            <Badge variant="outline" className="border-white/[0.08] text-[9px] text-muted-foreground">
              {AGENT_META[s.ownerAgent].emoji}
            </Badge>
          </div>
        ))}
      </div>
      {workflow.impactINR ? (
        <p className="mt-2 text-[11px] font-semibold text-emerald-400">Impact: {formatINR(workflow.impactINR)}</p>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 6: Event Engine
// ═══════════════════════════════════════════════════════════════════════════════

function EventEngineSection({ events }: { events: NetworkEvent[] }) {
  return (
    <FadeIn delay={0.2}>
      <Card className="flex h-full flex-col border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader icon={Zap} emoji="⚡" title="Event Engine™" subtitle="Triggers → routed to the right agent → handled automatically" />
        </CardHeader>
        <CardContent className="flex-1">
          <div className="max-h-[24rem] space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
            {events.length === 0 && <EmptyRow text="No events fired — all quiet." />}
            {events.map((e) => (
              <div key={e.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{e.title}</p>
                  <Badge variant="outline" className={`shrink-0 gap-1 text-[10px] ${RISK_TONE[e.severity]}`}>
                    {ABOS_RISK_GLYPH[e.severity]} {ABOS_RISK_LABEL[e.severity]}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{e.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <Badge variant="outline" className="gap-1 border-white/[0.08] text-muted-foreground">
                    ⚡ {e.trigger.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="gap-1 border-white/[0.08] text-muted-foreground">
                    {AGENT_META[e.routedTo].emoji} {AGENT_META[e.routedTo].name}
                  </Badge>
                  <span className={STATUS_TONE[e.status]}>{EXEC_STATUS_GLYPH[e.status]} {EXEC_STATUS_LABEL[e.status]}</span>
                  {e.autoHandled && (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.06] text-[9px] text-emerald-400">auto-handled</Badge>
                  )}
                  <span className="ml-auto text-muted-foreground">{timeAgo(e.firedAt)}</span>
                </div>
                <p className="mt-1 text-[11px] accent-text">↳ {e.actionTaken}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 4: Execution Engine
// ═══════════════════════════════════════════════════════════════════════════════

function ExecutionEngineSection({ execution, onExecute }: {
  execution: AbosState['execution'];
  onExecute: (cap: ExecutionCapability) => void;
}) {
  return (
    <FadeIn delay={0.22}>
      <Card className="flex h-full flex-col border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader
            icon={Cpu}
            emoji="⚙️"
            title="Execution Engine™"
            subtitle={`${execution.executedToday} executed · ${execution.pendingToday} pending today`}
          />
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {execution.capabilities.map((c) => (
              <div key={c.capability} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{c.emoji}</span>
                  <div>
                    <p className="text-xs font-medium text-foreground">{c.label}</p>
                    <p className="text-[9px] text-muted-foreground">{c.runsToday} run(s) today</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={c.enabled} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 px-2 text-[10px]"
                    onClick={() => onExecute(c.capability)}
                  >
                    <Send className="h-3 w-3" /> Run
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Actions</p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
              {execution.recentActions.map((a: ExecutionAction) => (
                <div key={a.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{a.title}</p>
                    <span className={`shrink-0 text-[10px] ${STATUS_TONE[a.status]}`}>{EXEC_STATUS_GLYPH[a.status]} {EXEC_STATUS_LABEL[a.status]}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{a.description}</p>
                  {a.output && <p className="mt-1 text-[10px] accent-text">{a.output}</p>}
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-muted-foreground">
                    <Badge variant="outline" className="border-white/[0.08] text-[9px]">{AGENT_META[a.ownerAgent].emoji} {AGENT_META[a.ownerAgent].name}</Badge>
                    <span>via {a.triggeredBy}</span>
                    {a.amountINR ? <span className="text-amber-400">{formatINR(a.amountINR)}</span> : null}
                    {a.status !== 'completed' && <Progress value={a.progressPct} className="h-1 flex-1" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module 9: Learning Engine
// ═══════════════════════════════════════════════════════════════════════════════

function LearningSection({ learning }: { learning: AbosState['learning'] }) {
  return (
    <FadeIn delay={0.24}>
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardHeader className="pb-3">
          <SectionHeader
            icon={Brain}
            emoji="🧠"
            title="Learning Engine™"
            subtitle={`${learning.totalLearned} facts learned · ${learning.successRate}% autonomous success rate`}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Learned Facts</p>
              <div className="max-h-72 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                {learning.facts.map((f: LearnedFact) => (
                  <div key={f.id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 text-xs text-foreground">{f.fact}</p>
                      {f.actionable && <Badge variant="outline" className="shrink-0 border-emerald-500/30 bg-emerald-500/[0.06] text-[9px] text-emerald-400">actionable</Badge>}
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{f.evidence}</p>
                    <div className="mt-1 flex items-center gap-2 text-[9px] text-muted-foreground">
                      <Badge variant="outline" className="border-white/[0.08] text-[9px]">{f.type.replace(/_/g, ' ')}</Badge>
                      <span>· {f.subject}</span>
                      <span>· {f.confidencePct}% conf.</span>
                      <span>· seen {f.observedCount}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Behaviour Patterns</p>
                <div className="space-y-1.5">
                  {learning.behaviourPatterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                      <p className="text-xs text-muted-foreground">{p}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Insights</p>
                <div className="space-y-1.5">
                  {learning.insights.map((ins, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border border-white/[0.05] accent-gradient-soft p-2.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-text" />
                      <p className="text-xs text-foreground">{ins}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Action handlers (call APIs + toast)
// ═══════════════════════════════════════════════════════════════════════════════

async function onDecide(decisionId: string, toast: ReturnType<typeof useToast>['toast'], refresh: () => void) {
  try {
    const res = await fetch('/api/abos/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisionId }),
    });
    const data = await res.json();
    if (data.ok) {
      toast({ title: 'Decision approved', description: data.spokenAck });
      refresh();
    } else {
      toast({ title: 'Decision failed', description: data.error, variant: 'destructive' });
    }
  } catch {
    toast({ title: 'Decision failed', variant: 'destructive' });
  }
}

async function onExecute(capability: ExecutionCapability, toast: ReturnType<typeof useToast>['toast'], refresh: () => void) {
  try {
    const res = await fetch('/api/abos/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capability }),
    });
    const data = await res.json();
    if (data.ok) {
      toast({ title: 'Execution dispatched', description: data.spokenAck });
      refresh();
    } else {
      toast({ title: 'Execution failed', description: data.error, variant: 'destructive' });
    }
  } catch {
    toast({ title: 'Execution failed', variant: 'destructive' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════════════════════════════

function AbosSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}
