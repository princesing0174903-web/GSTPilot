'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT INFINITY™ — ENTERPRISE COMMAND NETWORK™ — GLOBAL COMMAND CENTER
//
// One Command. Every Team. Entire Enterprise. Founder & Owner: Prince Singh.
//
// The live command dashboard of the entire enterprise — 22 modules, 9 AI
// executives, decisions, workflows, incidents, playbooks, simulations, the
// operations map, analytics, observability, collaboration, automation and
// security — all coordinated from one screen.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crown, Shield, Activity, AlertTriangle, Zap, Play, CheckCircle2, XCircle,
  Clock, ArrowRight, GitBranch, FlaskConical, Map as MapIcon, Gauge, Bot,
  MessageSquare, Server, Network, Radio, RefreshCw, Loader2, Sparkles,
  TrendingUp, TrendingDown, Brain, Users, Send, Eye, FileText, Workflow,
  Cpu, Target, ChevronRight, ArrowUpRight, ArrowDownRight, ShieldCheck,
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
import { SIMULATION_SCENARIOS } from '@/lib/command-network/simulator-defs';
import { WORKFLOW_TEMPLATES } from '@/lib/command-network/workflows-defs';
import type {
  CommandDashboard, CommandFabric, ConnectedModule, CoordinatedDecision,
  CoordinatedWorkflow, CommandIncident, CommandPlaybook, CommandSimulation,
  CommandAnalytics, ObservabilitySignal, CollaborationMessage, AutomationRule,
  CommandAuditRecord, CommandExecutive, OperationNode, DecisionStage,
  WorkflowStep, RecoveryStep, PlaybookPhase, WorkflowType,
} from '@/lib/command-network/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMAND_TAGLINE = 'Enterprise Command Network™';
const COMMAND_SUBTAGLINE = 'Global Command Center — One Command. Every Team. Entire Enterprise.';
const COMMAND_FOUNDER = 'Prince Singh';
const POLL_INTERVAL_MS = 30_000;

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

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function severityClasses(sev: string): string {
  if (sev === 'critical') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (sev === 'high') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  if (sev === 'medium') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (sev === 'low') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
}

function statusClasses(status: string): string {
  const positive = ['online', 'completed', 'approved', 'executed', 'active', 'synced', 'healthy', 'resolved', 'allow', 'success', 'achieved'];
  const negative = ['offline', 'failed', 'rejected', 'denied', 'down', 'critical', 'aborted', 'error'];
  const pending = ['degraded', 'pending', 'running', 'in_review', 'in_review', 'investigating', 'recovering', 'contained', 'open', 'syncing', 'warning', 'stale', 'paused', 'idle', 'needs_approval', 'blocked', 'skipped', 'proposed'];
  if (positive.includes(status)) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (negative.includes(status)) return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (pending.includes(status)) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
}

function statusTextColor(status: string): string {
  const positive = ['online', 'completed', 'approved', 'executed', 'active', 'synced', 'healthy', 'resolved', 'allow', 'success', 'achieved'];
  const negative = ['offline', 'failed', 'rejected', 'denied', 'down', 'critical', 'aborted', 'error'];
  const pending = ['degraded', 'pending', 'running', 'in_review', 'investigating', 'recovering', 'contained', 'open', 'syncing', 'warning', 'stale', 'paused', 'idle', 'needs_approval', 'blocked', 'skipped', 'proposed'];
  if (positive.includes(status)) return 'text-emerald-400';
  if (negative.includes(status)) return 'text-red-400';
  if (pending.includes(status)) return 'text-amber-400';
  return 'text-muted-foreground';
}

function recommendationClasses(rec: string): string {
  if (rec === 'proceed') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (rec === 'caution') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (rec === 'avoid') return 'bg-red-500/15 text-red-300 border-red-500/30';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

function impactClasses(impact: string): string {
  const v = impact.toLowerCase();
  if (['positive', 'low', 'minimal', 'neutral'].includes(v)) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (['moderate', 'medium', 'review'].includes(v)) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (['high', 'negative', 'severe', 'critical'].includes(v)) return 'bg-red-500/15 text-red-300 border-red-500/30';
  return 'bg-white/[0.04] text-muted-foreground border-white/[0.08]';
}

function riskColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-emerald-400';
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
    <div className="flex items-center gap-2 mb-2.5">
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
    <div>
      <p className={`text-lg font-bold ${accent ?? ''}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ─── Overview Tab: Fabric + Executives ────────────────────────────────────────

function ModuleCard({ m }: { m: ConnectedModule }) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16] transition-colors">
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{m.label}</p>
            <p className="text-[11px] text-muted-foreground truncate">{m.role}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] ${statusClasses(m.status)}`}>{m.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2.5 text-[11px]">
          <div>
            <p className="text-muted-foreground">Msgs / hr</p>
            <p className="font-semibold">{m.messagesLastHour.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Active WFs</p>
            <p className="font-semibold text-amber-300">{m.coordinatedWorkflows}</p>
          </div>
        </div>
        {m.lastHeartbeat && (
          <p className="text-[10px] text-muted-foreground/70 mt-2">♥ {timeAgo(m.lastHeartbeat)}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ExecutiveCard({ e }: { e: CommandExecutive }) {
  const emojiFor = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('ceo')) return '👑';
    if (r.includes('cfo')) return '💰';
    if (r.includes('coo')) return '⚙️';
    if (r.includes('cto')) return '🛠️';
    if (r.includes('cro')) return '📈';
    if (r.includes('legal')) return '⚖️';
    if (r.includes('hr')) return '👥';
    if (r.includes('marketing')) return '📣';
    if (r.includes('operation')) return '🔄';
    return '🤖';
  };
  return (
    <Card className="bg-white/[0.03] border-white/[0.08] hover:border-white/[0.16] transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{emojiFor(e.role)}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{e.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{e.role}</p>
          </div>
          <span className={`h-2 w-2 rounded-full ${e.status === 'active' ? 'bg-emerald-400 animate-pulse' : e.status === 'reviewing' ? 'bg-amber-400 animate-pulse' : 'bg-white/20'}`} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{e.mandate}</p>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div>
            <span className="text-muted-foreground">Decisions today</span>
            <p className="font-semibold">{e.decisionsToday}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Active workflows</span>
            <p className="font-semibold text-amber-300">{e.activeWorkflows}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Incidents owned</span>
            <p className="font-semibold text-red-300">{e.incidentsOwned}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Approval accuracy</span>
            <p className="font-semibold text-emerald-300">{Math.round(e.approvalAccuracy)}%</p>
          </div>
        </div>
        {e.lastActiveAt && (
          <p className="text-[10px] text-muted-foreground/70 mt-2">active {timeAgo(e.lastActiveAt)}</p>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ fabric, executives }: { fabric: CommandFabric; executives: CommandExecutive[] }) {
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader icon={Network} title="Command Fabric — 22-Module Graph" hint={`${fabric.onlineModules}/${fabric.totalModules} online · ${fabric.totalConnections.toLocaleString()} msgs/hr · ${fabric.activeWorkflows} active workflows`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {fabric.moduleGraph.length === 0 && <EmptyState message="No connected modules." />}
          {fabric.moduleGraph.map((m) => <ModuleCard key={m.module} m={m} />)}
        </div>
      </div>
      <div>
        <SectionHeader icon={Bot} title="AI Executive Roster — 9 Executives" hint={`${executives.filter((e) => e.status === 'active').length} active now`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {executives.length === 0 && <EmptyState message="No executives provisioned." />}
          {executives.map((e) => <ExecutiveCard key={e.id} e={e} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Decisions Tab ────────────────────────────────────────────────────────────

function StageIcon({ status }: { status: DecisionStage['status'] }) {
  if (status === 'approved' || status === 'skipped') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === 'rejected' || status === 'blocked') return <XCircle className="h-3.5 w-3.5 text-red-400" />;
  if (status === 'in_review') return <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function DecisionCard({ d, onApprove, onReject, onExecute }: {
  d: CoordinatedDecision;
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
              <Badge variant="secondary" className="text-[10px]">{d.category}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusClasses(d.status)}`}>{d.status.replace('_', ' ')}</Badge>
              <span className="text-[10px] text-muted-foreground">by {d.initiator}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(d.createdAt)}</span>
            </div>
            <p className="font-semibold text-sm mt-2">{d.title}</p>
            <p className="text-[12px] text-muted-foreground mt-1">{d.summary}</p>
          </div>
        </div>

        {/* Stage pipeline */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Decision Pipeline · {d.stages.length} stages</p>
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
            {d.stages.map((s, i) => (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div className={`rounded-lg border px-2 py-1.5 min-w-[110px] max-w-[150px] ${statusClasses(s.status)}`}>
                  <div className="flex items-center gap-1">
                    <StageIcon status={s.status} />
                    <span className="text-[10px] font-semibold truncate">{s.role}</span>
                  </div>
                  <p className="text-[9px] opacity-80 truncate mt-0.5">{s.module.replace(/_/g, ' ')}</p>
                </div>
                {i < d.stages.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[11px]">
          <div>
            <p className="text-muted-foreground">Financial impact</p>
            <p className="font-semibold text-emerald-300">{fmtINR(d.financialImpact)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p className="font-semibold">{Math.round(d.confidence * 100)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Risk</p>
            <p className={`font-semibold ${riskColor(d.riskScore)}`}>{d.riskScore}/100</p>
          </div>
          <div>
            <p className="text-muted-foreground">Approval</p>
            <p className="font-semibold">{d.requiresApproval}</p>
          </div>
        </div>

        {d.rollbackStrategy && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rollback</p>
            <p className="text-[11px] text-muted-foreground">{d.rollbackStrategy}</p>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {(d.status === 'proposed' || d.status === 'in_review') && (
            <>
              <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(d.id)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px] border-red-500/30 text-red-300 hover:bg-red-500/10" onClick={() => onReject(d.id)}>
                <XCircle className="h-3 w-3 mr-1" /> Reject
              </Button>
            </>
          )}
          {d.status === 'approved' && (
            <Button size="sm" className="h-7 text-[11px]" onClick={() => onExecute(d.id)}>
              <Play className="h-3 w-3 mr-1" /> Execute
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionsTab({ decisions, onApprove, onReject, onExecute }: {
  decisions: CoordinatedDecision[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {decisions.length === 0 && <EmptyState message="No decisions yet. The Command Engine proposes decisions as signals arrive." />}
      {decisions.map((d) => (
        <DecisionCard key={d.id} d={d} onApprove={onApprove} onReject={onReject} onExecute={onExecute} />
      ))}
    </div>
  );
}

// ─── Workflows Tab ────────────────────────────────────────────────────────────

function WorkflowCard({ w }: { w: CoordinatedWorkflow }) {
  const stepStatusColor = (s: WorkflowStep['status']) =>
    s === 'completed' ? 'bg-emerald-400' :
    s === 'running' ? 'bg-amber-400 animate-pulse' :
    s === 'failed' ? 'bg-red-400' : 'bg-white/20';
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{w.type.replace(/_/g, ' ')}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusClasses(w.status)}`}>{w.status}</Badge>
              <span className="text-[10px] text-muted-foreground">{w.coordinatedModules.length} modules</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(w.createdAt)}</span>
            </div>
            <p className="font-semibold text-sm mt-2">{w.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{w.description}</p>
          </div>
        </div>

        <div className="mt-3 space-y-1">
          {w.steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stepStatusColor(s.status)}`} />
              <span className={`flex-1 truncate ${s.status === 'completed' ? 'text-muted-foreground line-through' : ''}`}>{s.action}</span>
              <Badge variant="outline" className="text-[9px] shrink-0">{s.module.replace(/_/g, ' ')}</Badge>
              <span className="text-[9px] text-muted-foreground shrink-0 w-14 text-right">{s.status}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 mt-3">
          {w.coordinatedModules.map((mod) => (
            <Badge key={mod} variant="secondary" className="text-[9px] font-normal">{mod.replace(/_/g, ' ')}</Badge>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-[10px] text-muted-foreground">
          <div>trigger: <span className="text-foreground font-medium">{w.trigger ?? 'manual'}</span></div>
          <div>step: <span className="text-foreground font-medium">{w.currentStep + 1}/{w.steps.length}</span></div>
          <div>started: <span className="text-foreground font-medium">{w.startedAt ? timeAgo(w.startedAt) : '—'}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowsTab({ workflows, onLaunch, busy }: {
  workflows: CoordinatedWorkflow[];
  onLaunch: (type: WorkflowType) => void;
  busy: boolean;
}) {
  const [type, setType] = useState<WorkflowType>(WORKFLOW_TEMPLATES[0]?.type ?? 'hire_employee');
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Zap className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold">Launch Coordinated Workflow</span>
            </div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WorkflowType)}
              className="flex-1 h-9 rounded-md bg-background/60 border border-white/[0.1] px-3 text-sm"
            >
              {WORKFLOW_TEMPLATES.map((t) => (
                <option key={t.type} value={t.type}>{t.name}</option>
              ))}
            </select>
            <Button onClick={() => onLaunch(type)} disabled={busy} className="shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
              Launch
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {WORKFLOW_TEMPLATES.find((t) => t.type === type)?.description ?? 'Select a workflow template.'}
          </p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {workflows.length === 0 && <EmptyState message="No workflows yet. Launch one above." />}
        {workflows.map((w) => <WorkflowCard key={w.id} w={w} />)}
      </div>
    </div>
  );
}

// ─── Incidents Tab ────────────────────────────────────────────────────────────

function IncidentCard({ inc, onEscalate, onRecover, busy }: {
  inc: CommandIncident;
  onEscalate: (id: string) => void;
  onRecover: (id: string) => void;
  busy: boolean;
}) {
  const recoveryStepIcon = (s: RecoveryStep['status']) =>
    s === 'completed' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> :
    s === 'running' ? <Loader2 className="h-3 w-3 text-amber-400 animate-spin" /> :
    s === 'failed' ? <XCircle className="h-3 w-3 text-red-400" /> :
    <Clock className="h-3 w-3 text-muted-foreground" />;
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${severityClasses(inc.severity)}`}>{inc.severity}</Badge>
              <Badge variant="secondary" className="text-[10px]">{inc.category.replace(/_/g, ' ')}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusClasses(inc.status)}`}>{inc.status}</Badge>
              <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(inc.detectedAt)}</span>
            </div>
            <p className="font-semibold text-sm mt-2">{inc.title}</p>
          </div>
        </div>

        {inc.rootCause && (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Root cause</p>
            <p className="text-[11px] text-muted-foreground">{inc.rootCause}</p>
          </div>
        )}
        {inc.impactAssessment && (
          <div className="mt-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Impact</p>
            <p className="text-[11px] text-muted-foreground">{inc.impactAssessment}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mt-2">
          {inc.affectedModules.map((m) => (
            <Badge key={m} variant="secondary" className="text-[9px] font-normal">{m.replace(/_/g, ' ')}</Badge>
          ))}
        </div>

        {inc.recoveryPlan.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Recovery plan</p>
            <div className="space-y-1.5">
              {inc.recoveryPlan.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  {recoveryStepIcon(s.status)}
                  <span className="flex-1 truncate">{s.action}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{s.module.replace(/_/g, ' ')}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {inc.status !== 'resolved' && inc.status !== 'closed' && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-[11px] border-orange-500/30 text-orange-300 hover:bg-orange-500/10" disabled={busy} onClick={() => onEscalate(inc.id)}>
                <AlertTriangle className="h-3 w-3 mr-1" /> Escalate
              </Button>
              <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => onRecover(inc.id)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Recover
              </Button>
            </>
          )}
          {inc.resolution && (
            <span className="text-[11px] text-emerald-300/80 self-center">✓ {inc.resolution}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IncidentsTab({ incidents, summary, onEscalate, onRecover, busy }: {
  incidents: CommandIncident[];
  summary: { openCritical: number; resolvedToday: number; mttrMin: number; totalIncidents: number };
  onEscalate: (id: string) => void;
  onRecover: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <MiniStat label="Open critical" value={summary.openCritical} accent={summary.openCritical > 0 ? 'text-red-400' : undefined} />
            <MiniStat label="Resolved today" value={summary.resolvedToday} accent="text-emerald-400" />
            <MiniStat label="MTTR (min)" value={summary.mttrMin} />
            <MiniStat label="Total" value={summary.totalIncidents} />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {incidents.length === 0 && <EmptyState message="No active incidents. All clear." />}
        {incidents.map((inc) => (
          <IncidentCard key={inc.id} inc={inc} onEscalate={onEscalate} onRecover={onRecover} busy={busy} />
        ))}
      </div>
    </div>
  );
}

// ─── Playbooks Tab ────────────────────────────────────────────────────────────

function PlaybookCard({ p, onRun, busy }: {
  p: CommandPlaybook;
  onRun: (key: string) => void;
  busy: boolean;
}) {
  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">{p.type.replace(/_/g, ' ')}</Badge>
              <Badge variant="outline" className={`text-[10px] ${p.isActive ? 'text-emerald-300 border-emerald-500/30' : 'text-muted-foreground'}`}>
                {p.isActive ? 'active' : 'inactive'}
              </Badge>
              <span className="text-[10px] text-muted-foreground">used ×{p.useCount}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{Math.round(p.successRate)}% success</span>
            </div>
            <p className="font-semibold text-sm mt-2">{p.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-[11px]">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trigger</p>
            <p className="text-muted-foreground">{p.trigger}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Objective</p>
            <p className="text-muted-foreground">{p.objective}</p>
          </div>
        </div>

        {p.phases.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Phases · {p.phases.length} · ~{p.estimatedDurationHrs}h</p>
            <div className="space-y-2">
              {p.phases.map((ph: PlaybookPhase, i: number) => (
                <div key={i} className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-[11px] font-semibold flex-1 truncate">{ph.name}</span>
                    <Badge variant="outline" className="text-[9px] shrink-0">{ph.ownerRole}</Badge>
                    <span className="text-[9px] text-muted-foreground shrink-0">{ph.expectedDurationHrs}h</span>
                  </div>
                  <ul className="mt-1.5 ml-7 space-y-0.5">
                    {ph.actions.map((a, j) => (
                      <li key={j} className="text-[10px] text-muted-foreground flex items-start gap-1">
                        <ArrowRight className="h-2.5 w-2.5 mt-0.5 shrink-0" /> <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                    {ph.modules.map((m) => (
                      <Badge key={m} variant="secondary" className="text-[9px] font-normal">{m.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {p.successCriteria.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Success criteria</p>
            <ul className="space-y-0.5">
              {p.successCriteria.map((c, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" /> <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {p.risks.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Risks</p>
            <div className="flex flex-wrap gap-1">
              {p.risks.map((r, i) => (
                <Badge key={i} variant="outline" className="text-[9px] font-normal text-amber-300 border-amber-500/30">{r}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <Button size="sm" className="h-7 text-[11px]" disabled={busy} onClick={() => onRun(p.playbookKey)}>
            <Play className="h-3 w-3 mr-1" /> Run Playbook
          </Button>
          {p.lastUsedAt && <span className="text-[10px] text-muted-foreground self-center ml-auto">last run {timeAgo(p.lastUsedAt)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function PlaybooksTab({ playbooks, onRun, busy, onSelect, selectBusy, selectedPlaybook }: {
  playbooks: CommandPlaybook[];
  onRun: (key: string) => void;
  busy: boolean;
  onSelect: (situation: string) => void;
  selectBusy: boolean;
  selectedPlaybook: CommandPlaybook | null;
}) {
  const [situation, setSituation] = useState('');
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 shrink-0 mb-2">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-semibold">Oracle Auto-Select Playbook</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && situation.trim()) onSelect(situation); }}
              placeholder='Describe a situation: "Q3 GST filing is overdue", "server outage in UAE office", "acquire competitor X"'
              className="flex-1"
            />
            <Button onClick={() => onSelect(situation)} disabled={selectBusy || !situation.trim()} className="shrink-0">
              {selectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              Oracle Select
            </Button>
          </div>
          {selectedPlaybook && (
            <div className="mt-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                <span className="text-[11px] text-emerald-300 font-semibold">Oracle selected:</span>
                <Badge variant="secondary" className="text-[10px]">{selectedPlaybook.type.replace(/_/g, ' ')}</Badge>
              </div>
              <p className="text-sm font-semibold mt-1">{selectedPlaybook.name}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{selectedPlaybook.description}</p>
              <Button size="sm" className="h-7 text-[11px] mt-2" disabled={busy} onClick={() => onRun(selectedPlaybook.playbookKey)}>
                <Play className="h-3 w-3 mr-1" /> Run this playbook
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {playbooks.length === 0 && <EmptyState message="No playbooks provisioned." />}
        {playbooks.map((p) => <PlaybookCard key={p.id} p={p} onRun={onRun} busy={busy} />)}
      </div>
    </div>
  );
}

// ─── Simulator Tab ────────────────────────────────────────────────────────────

function SimulationResultCard({ s }: { s: CommandSimulation }) {
  return (
    <Card className="bg-white/[0.03] border-amber-500/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">{s.scenario.replace(/_/g, ' ')}</Badge>
          <Badge variant="outline" className={`text-[10px] ${recommendationClasses(s.recommendation)}`}>
            <span className="uppercase font-semibold mr-1">{s.recommendation.replace('_', ' ')}</span>
          </Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(s.createdAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-2">{s.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-[11px]">
          <div>
            <p className="text-muted-foreground">Financial impact</p>
            <p className={`font-semibold ${s.financialImpact >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{fmtINR(s.financialImpact)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Operational impact</p>
            <p className="font-semibold">{s.operationalImpact >= 0 ? '+' : ''}{s.operationalImpact}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Expected ROI</p>
            <p className="font-semibold text-emerald-300">{s.expectedROI >= 0 ? '+' : ''}{s.expectedROI}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Risk score</span>
              <span className={`font-semibold ${riskColor(s.riskScore)}`}>{s.riskScore}/100</span>
            </div>
            <Progress value={s.riskScore} className="h-1.5" />
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-semibold">{Math.round(s.confidence * 100)}%</span>
            </div>
            <Progress value={s.confidence * 100} className="h-1.5" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <Badge variant="outline" className={`text-[10px] ${impactClasses(s.complianceImpact)}`}>compliance: {s.complianceImpact}</Badge>
          <Badge variant="outline" className={`text-[10px] ${impactClasses(s.legalImpact)}`}>legal: {s.legalImpact}</Badge>
        </div>

        {s.rollbackStrategy && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rollback strategy</p>
            <p className="text-[11px] text-muted-foreground">{s.rollbackStrategy}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimulatorTab({ recent, onRun, busy, lastResult }: {
  recent: CommandSimulation[];
  onRun: (scenario: string) => void;
  busy: boolean;
  lastResult: CommandSimulation | null;
}) {
  const [scenario, setScenario] = useState(SIMULATION_SCENARIOS[0]?.scenario ?? 'hire_5_engineers');
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500/[0.06] via-rose-500/[0.04] to-transparent border-amber-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <FlaskConical className="h-4 w-4 text-amber-300" />
              <span className="text-sm font-semibold">Command Simulator</span>
            </div>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="flex-1 h-9 rounded-md bg-background/60 border border-white/[0.1] px-3 text-sm"
            >
              {SIMULATION_SCENARIOS.map((s) => (
                <option key={s.scenario} value={s.scenario}>{s.title}</option>
              ))}
            </select>
            <Button onClick={() => onRun(scenario)} disabled={busy} className="shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
              Run Simulation
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {SIMULATION_SCENARIOS.find((s) => s.scenario === scenario)?.description ?? ''}
          </p>
        </CardContent>
      </Card>
      {lastResult && <SimulationResultCard s={lastResult} />}
      <div>
        <SectionHeader icon={Clock} title="Recent Simulations" hint={`${recent.length} recent`} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {recent.length === 0 && <EmptyState message="No simulations yet. Run one above." />}
          {recent.map((s) => <SimulationResultCard key={s.id} s={s} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Operations Map Tab ───────────────────────────────────────────────────────

function OperationsMapTab({ map }: { map: CommandDashboard['operationsMap'] }) {
  const types = Array.from(new Set(map.nodes.map((n) => n.type)));
  const iconFor = (t: string): LucideIcon => {
    if (t === 'country') return MapIcon;
    if (t === 'ai_executive') return Bot;
    if (t === 'connector') return Radio;
    if (t === 'worker') return Cpu;
    if (t === 'queue') return Server;
    if (t === 'department' || t === 'organization') return Network;
    return Users;
  };
  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <MiniStat label="Total nodes" value={map.totalNodes} />
            <MiniStat label="Avg health" value={`${Math.round(map.avgHealthScore)}%`} accent={map.avgHealthScore > 80 ? 'text-emerald-400' : 'text-amber-400'} />
            <MiniStat label="Node types" value={Object.keys(map.byType).length} />
            <MiniStat label="Countries" value={Object.keys(map.byCountry).length} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(map.byStatus).map(([k, v]) => (
              <Badge key={k} variant="outline" className={`text-[10px] ${statusClasses(k)}`}>{k}: {v}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="space-y-5">
        {types.map((type) => {
          const nodes = map.nodes.filter((n) => n.type === type);
          const Icon = iconFor(type);
          return (
            <div key={type}>
              <SectionHeader icon={Icon} title={`${type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}s`} hint={`${nodes.length} nodes`} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {nodes.map((n: OperationNode) => (
                  <Card key={n.id} className="bg-white/[0.03] border-white/[0.08]">
                    <CardContent className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{n.label}</p>
                          {n.country && <p className="text-[10px] text-muted-foreground">📍 {n.country}</p>}
                        </div>
                        <Badge variant="outline" className={`text-[9px] ${statusClasses(n.status)}`}>{n.status}</Badge>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">health</span>
                          <span className="font-semibold">{Math.round(n.healthScore)}%</span>
                        </div>
                        <Progress value={n.healthScore} className="h-1.5" />
                      </div>
                      {Object.keys(n.metrics).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(n.metrics).slice(0, 4).map(([k, v]) => (
                            <Badge key={k} variant="secondary" className="text-[9px] font-normal">{k}: {v}</Badge>
                          ))}
                        </div>
                      )}
                      {n.lastUpdate && <p className="text-[9px] text-muted-foreground/70 mt-2">updated {timeAgo(n.lastUpdate)}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
        {map.nodes.length === 0 && <EmptyState message="No operations map nodes provisioned." />}
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ a, coordination }: { a: CommandAnalytics; coordination: CommandDashboard['coordination'] }) {
  const metrics: { key: string; label: string; value: number; isINR?: boolean }[] = [
    { key: 'decisionSpeedHrs', label: 'Decision Speed', value: a.decisionSpeedHrs },
    { key: 'executionEfficiency', label: 'Execution Efficiency', value: a.executionEfficiency },
    { key: 'departmentProductivity', label: 'Dept Productivity', value: a.departmentProductivity },
    { key: 'crossTeamCollaboration', label: 'Cross-Team Collab', value: a.crossTeamCollaboration },
    { key: 'automationCoverage', label: 'Automation Coverage', value: a.automationCoverage },
    { key: 'revenueImpactINR', label: 'Revenue Impact', value: a.revenueImpactINR, isINR: true },
    { key: 'compliancePerformance', label: 'Compliance Perf', value: a.compliancePerformance },
    { key: 'executivePerformance', label: 'Executive Perf', value: a.executivePerformance },
    { key: 'operationalEfficiency', label: 'Operational Eff', value: a.operationalEfficiency },
    { key: 'globalPerformance', label: 'Global Performance', value: a.globalPerformance },
  ];
  const delta = (key: string): number | undefined => a.trendDelta?.[key];
  return (
    <div className="space-y-5">
      <div>
        <SectionHeader icon={Gauge} title="Enterprise Command Analytics — 10 KPIs" hint="live · from REAL executed commands" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {metrics.map((m) => {
            const d = delta(m.key);
            return (
              <Card key={m.key} className="bg-white/[0.03] border-white/[0.08]">
                <CardContent className="p-3.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                    {d !== undefined && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {d > 0 ? <ArrowUpRight className="h-3 w-3" /> : d < 0 ? <ArrowDownRight className="h-3 w-3" /> : null}
                        {d > 0 ? '+' : ''}{d}
                      </span>
                    )}
                  </div>
                  <p className="text-xl font-bold mt-1">
                    {m.isINR ? fmtINR(m.value) : m.key === 'decisionSpeedHrs' ? `${m.value.toFixed(1)}h` : `${Math.round(m.value)}%`}
                  </p>
                  {!m.isINR && m.key !== 'decisionSpeedHrs' && (
                    <Progress value={m.value} className="h-1.5 mt-2" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <div>
        <SectionHeader icon={GitBranch} title="Cross-Module Coordination" hint={`${coordination.syncedDepartments}/${coordination.totalDepartments} synced · avg lag ${coordination.avgSyncLagMin}min`} />
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center p-4 border-b border-white/[0.06]">
              <MiniStat label="Active workflows" value={coordination.totalActiveWorkflows} />
              <MiniStat label="Pending approvals" value={coordination.totalPendingApprovals} accent={coordination.totalPendingApprovals > 0 ? 'text-amber-400' : undefined} />
              <MiniStat label="Open tasks" value={coordination.totalOpenTasks} />
              <MiniStat label="Stale depts" value={coordination.staleDepartments} accent={coordination.staleDepartments > 0 ? 'text-red-400' : undefined} />
            </div>
            <div className="p-4 space-y-1.5 max-h-96 overflow-y-auto">
              {coordination.departments.map((d) => (
                <div key={d.department} className="flex items-center gap-2 text-[12px] py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${d.status === 'synced' ? 'bg-emerald-400' : d.status === 'syncing' ? 'bg-amber-400 animate-pulse' : d.status === 'stale' ? 'bg-orange-400' : 'bg-red-400'}`} />
                  <span className="font-medium flex-1 truncate">{d.label}</span>
                  <Badge variant="outline" className={`text-[9px] ${statusClasses(d.status)}`}>{d.status}</Badge>
                  <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">lag {d.syncLagMin}m</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 w-20 text-right">{d.pendingApprovals} pending</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">{d.openTasks} tasks</span>
                </div>
              ))}
              {coordination.departments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No departments tracked.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Observability Tab ────────────────────────────────────────────────────────

function ObservabilityTab({ summary, recent }: {
  summary: CommandDashboard['observability']['summary'];
  recent: ObservabilitySignal[];
}) {
  const obsColor = (s: string) =>
    s === 'healthy' ? 'text-emerald-400' :
    s === 'warning' ? 'text-amber-400' :
    s === 'critical' ? 'text-orange-400' :
    s === 'down' ? 'text-red-400' : 'text-muted-foreground';
  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <MiniStat label="Health score" value={`${Math.round(summary.healthScore)}%`} accent={summary.healthScore > 80 ? 'text-emerald-400' : 'text-amber-400'} />
            <MiniStat label="Critical" value={summary.criticalCount} accent={summary.criticalCount > 0 ? 'text-red-400' : undefined} />
            <MiniStat label="Warnings" value={summary.warningCount} accent={summary.warningCount > 0 ? 'text-amber-400' : undefined} />
            <MiniStat label="Total signals" value={summary.totalSignals} />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(summary.byTarget).map(([k, v]) => (
              <Badge key={k} variant="secondary" className="text-[10px] font-normal">{k}: {v}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {recent.length === 0 && <EmptyState message="No observability signals. System is quiet." />}
        {recent.map((s) => (
          <Card key={s.id} className="bg-white/[0.03] border-white/[0.08]">
            <CardContent className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${statusClasses(s.status)}`}>{s.status}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{s.target}</Badge>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(s.observedAt)}</span>
                  </div>
                  <p className="font-semibold text-sm mt-1.5 truncate">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{s.message}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-[11px]">
                <div>
                  <span className="text-muted-foreground">metric</span>
                  <p className={`font-semibold ${obsColor(s.status)}`}>{s.metricName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">value</span>
                  <p className="font-semibold">{s.metricValue} {s.metricUnit}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">threshold</span>
                  <p className="font-semibold">{s.threshold} {s.metricUnit}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Collaboration Tab ────────────────────────────────────────────────────────

function CollaborationTab({ summary }: { summary: CommandDashboard['collaboration'] }) {
  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <MiniStat label="Threads" value={summary.totalThreads} />
            <MiniStat label="Messages" value={summary.totalMessages} />
            <MiniStat label="Oracle memory msgs" value={summary.oracleMemoryMessages} accent="text-amber-300" />
            <MiniStat label="Active threads" value={summary.activeThreads} />
          </div>
        </CardContent>
      </Card>
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {summary.recentMessages.length === 0 && <EmptyState message="No collaboration messages." />}
        {summary.recentMessages.map((m: CollaborationMessage) => (
          <Card key={m.id} className="bg-white/[0.03] border-white/[0.08]">
            <CardContent className="p-3">
              <div className="flex items-start gap-2.5">
                <div className="rounded-full bg-amber-500/15 p-1.5 shrink-0">
                  {m.collaboratorType === 'ai_agent' ? <Bot className="h-3.5 w-3.5 text-amber-300" /> : <Users className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold">{m.collaboratorLabel}</span>
                    <Badge variant="secondary" className="text-[9px]">{m.collaboratorType}</Badge>
                    <Badge variant="outline" className="text-[9px]">{m.intent}</Badge>
                    {m.oracleMemorySaved && <Brain className="h-3 w-3 text-amber-300" />}
                    <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(m.timestamp)}</span>
                  </div>
                  <p className="text-[12px] text-foreground mt-1">{m.message}</p>
                  {m.moduleRef && <Badge variant="outline" className="text-[9px] mt-1.5">{m.moduleRef.replace(/_/g, ' ')}</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Automation Tab ───────────────────────────────────────────────────────────

function AutomationTab({ summary }: { summary: CommandDashboard['automation'] }) {
  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <MiniStat label="Total rules" value={summary.totalRules} />
            <MiniStat label="Enabled" value={summary.enabledRules} accent="text-emerald-400" />
            <MiniStat label="Executions today" value={summary.executionsToday} />
            <MiniStat label="Avg success" value={`${Math.round(summary.avgSuccessRate)}%`} />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {summary.recentRules.length === 0 && <EmptyState message="No automation rules provisioned." />}
        {summary.recentRules.map((r: AutomationRule) => (
          <Card key={r.id} className="bg-white/[0.03] border-white/[0.08]">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{r.type.replace(/_/g, ' ')}</Badge>
                    {r.enabled ? <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/30">enabled</Badge>
                      : <Badge variant="outline" className="text-[10px] text-muted-foreground">disabled</Badge>}
                    <span className="text-[10px] text-muted-foreground ml-auto">{r.lastFiredAt ? `last fired ${timeAgo(r.lastFiredAt)}` : 'never fired'}</span>
                  </div>
                  <p className="font-semibold text-sm mt-1.5">{r.name}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-[11px]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trigger</p>
                  <p className="text-muted-foreground">{r.trigger}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</p>
                  <p className="text-muted-foreground">{r.action}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {r.coordinatedModules.map((m) => (
                  <Badge key={m} variant="secondary" className="text-[9px] font-normal">{m.replace(/_/g, ' ')}</Badge>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                <div>
                  <span className="text-muted-foreground">Today</span>
                  <p className="font-semibold">{r.executionsToday}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">All-time</span>
                  <p className="font-semibold">{r.totalExecutions.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Success</span>
                  <p className="font-semibold text-emerald-300">{Math.round(r.successRate)}%</p>
                </div>
              </div>
              <Progress value={r.successRate} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab({ summary }: { summary: CommandDashboard['security'] }) {
  return (
    <div className="space-y-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <MiniStat label="Total commands" value={summary.totalCommands} />
            <MiniStat label="RBAC allow rate" value={`${Math.round(summary.rbacAllowRate)}%`} accent={summary.rbacAllowRate > 90 ? 'text-emerald-400' : 'text-amber-400'} />
            <MiniStat label="Denied" value={summary.deniedCommands} accent={summary.deniedCommands > 0 ? 'text-red-400' : undefined} />
            <MiniStat label="Policy violations" value={summary.policyViolations} accent={summary.policyViolations > 0 ? 'text-red-400' : undefined} />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> Command Audit Trail — Zero-Trust · Signed · Replay-Protected
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/[0.06]">
                  <th className="py-2 pr-2">Command</th>
                  <th className="py-2 pr-2">Module</th>
                  <th className="py-2 pr-2">Actor</th>
                  <th className="py-2 pr-2">RBAC</th>
                  <th className="py-2 pr-2">Result</th>
                  <th className="py-2 pr-2">Signature</th>
                  <th className="py-2 pr-2 text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentAudit.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-sm text-muted-foreground py-6">No audit records yet. Execute a command to create one.</td></tr>
                )}
                {summary.recentAudit.map((r: CommandAuditRecord) => (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2 pr-2"><Badge variant="secondary" className="text-[9px]">{r.commandType}</Badge></td>
                    <td className="py-2 pr-2 truncate max-w-[100px]">{r.targetModule.replace(/_/g, ' ')}</td>
                    <td className="py-2 pr-2"><span className="font-medium">{r.actorType}</span> <span className="text-muted-foreground">({r.role})</span></td>
                    <td className="py-2 pr-2"><Badge variant="outline" className={`text-[9px] ${r.rbacDecision === 'allow' ? 'text-emerald-300 border-emerald-500/30' : r.rbacDecision === 'deny' ? 'text-red-300 border-red-500/30' : 'text-amber-300 border-amber-500/30'}`}>{r.rbacDecision}</Badge></td>
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

// ─── Critical Alert Card (strip) ──────────────────────────────────────────────

function CriticalAlertCard({ inc, onEscalate, onRecover, busy }: {
  inc: CommandIncident;
  onEscalate: (id: string) => void;
  onRecover: (id: string) => void;
  busy: boolean;
}) {
  return (
    <Card className={`shrink-0 w-[280px] sm:w-[320px] border ${inc.severity === 'critical' ? 'bg-red-500/[0.06] border-red-500/30' : 'bg-orange-500/[0.06] border-orange-500/30'}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${inc.severity === 'critical' ? 'text-red-400' : 'text-orange-400'}`} />
          <Badge variant="outline" className={`text-[10px] ${severityClasses(inc.severity)}`}>{inc.severity}</Badge>
          <Badge variant="secondary" className="text-[10px]">{inc.category.replace(/_/g, ' ')}</Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(inc.detectedAt)}</span>
        </div>
        <p className="font-semibold text-sm mt-1.5 line-clamp-2">{inc.title}</p>
        <div className="flex gap-1.5 mt-2">
          <Button size="sm" variant="outline" className="h-6 text-[10px] border-orange-500/30 text-orange-300 hover:bg-orange-500/10" disabled={busy} onClick={() => onEscalate(inc.id)}>
            <AlertTriangle className="h-3 w-3 mr-1" /> Escalate
          </Button>
          <Button size="sm" className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => onRecover(inc.id)}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Recover
          </Button>
        </div>
      </CardContent>
    </Card>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
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
          <h2 className="text-lg font-semibold mt-3">Command Center unavailable</h2>
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

export default function CommandNetworkPage() {
  const { toast } = useToast();
  const [data, setData] = useState<CommandDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  // Action busy states
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [incidentBusy, setIncidentBusy] = useState<string | null>(null);
  const [playbookRunBusy, setPlaybookRunBusy] = useState(false);
  const [playbookSelectBusy, setPlaybookSelectBusy] = useState(false);
  const [selectedPlaybook, setSelectedPlaybook] = useState<CommandPlaybook | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [lastSim, setLastSim] = useState<CommandSimulation | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/command/dashboard', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load dashboard (HTTP ${res.status})`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load dashboard');
      setData(json.dashboard);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (!silent) setError(msg);
      else console.warn('[command/dashboard] silent poll failed:', msg);
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

  const onApprove = async (id: string) => {
    setDecisionBusy(id);
    try {
      const res = await fetch('/api/command/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_decision', decisionId: id, approve: true, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Approve failed');
      toast({ title: 'Decision approved', description: 'Advanced to next stage. Multi-module coordination in progress.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Approve failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setDecisionBusy(null);
    }
  };

  const onReject = async (id: string) => {
    setDecisionBusy(id);
    try {
      const res = await fetch('/api/command/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_decision', decisionId: id, approve: false, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Reject failed');
      toast({ title: 'Decision rejected', description: 'Rejection recorded in VEYRO AI Memory for future learning.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Reject failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setDecisionBusy(null);
    }
  };

  const onExecuteDecision = async (id: string) => {
    setDecisionBusy(id);
    try {
      const res = await fetch('/api/command/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute_decision', decisionId: id, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Execute failed');
      toast({ title: 'Execution triggered', description: 'Coordinated workflow launched. Audit trail recorded.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Execute failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setDecisionBusy(null);
    }
  };

  const onLaunchWorkflow = async (type: WorkflowType) => {
    setWorkflowBusy(true);
    try {
      const res = await fetch('/api/command/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch_workflow', type, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Launch failed');
      toast({ title: 'Workflow launched', description: `${json.workflow?.name ?? type} coordinated across ${json.workflow?.coordinatedModules?.length ?? 0} modules.` });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Launch failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setWorkflowBusy(false);
    }
  };

  const onEscalateIncident = async (id: string) => {
    setIncidentBusy(id);
    try {
      const res = await fetch('/api/command/escalate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: id, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Escalate failed');
      toast({ title: 'Incident escalated', description: `Severity raised to ${json.incident?.severity ?? 'higher'}. Executives notified.` });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Escalate failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setIncidentBusy(null);
    }
  };

  const onRecoverIncident = async (id: string) => {
    setIncidentBusy(id);
    try {
      const res = await fetch('/api/command/recover', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: id, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Recover failed');
      toast({ title: 'Incident recovered', description: 'Recovery plan executed. Status updated. Logged to audit trail.' });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Recover failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setIncidentBusy(null);
    }
  };

  const onSelectPlaybook = async (situation: string) => {
    setPlaybookSelectBusy(true);
    try {
      const res = await fetch('/api/command/playbook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select', situation, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Select failed');
      setSelectedPlaybook(json.playbook);
      toast({ title: 'Oracle selected a playbook', description: `${json.playbook?.name ?? '—'} · ${json.playbook?.type ?? ''}` });
    } catch (e) {
      toast({ title: 'Select failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setPlaybookSelectBusy(false);
    }
  };

  const onRunPlaybook = async (key: string) => {
    setPlaybookRunBusy(true);
    try {
      const res = await fetch('/api/command/playbook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', playbookKey: key, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Run failed');
      toast({
        title: 'Playbook executed',
        description: json.workflow ? `${json.playbook?.name} launched workflow: ${json.workflow.name}` : `${json.playbook?.name} marked as used.`,
      });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Playbook run failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setPlaybookRunBusy(false);
    }
  };

  const onRunSimulation = async (scenario: string) => {
    setSimBusy(true);
    try {
      const res = await fetch('/api/command/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, role: 'ceo' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'Simulation failed');
      setLastSim(json.simulation);
      toast({
        title: `Simulation: ${json.simulation?.title ?? scenario}`,
        description: `Recommendation: ${json.simulation?.recommendation ?? '—'} · ROI ${json.simulation?.expectedROI ?? 0}% · confidence ${Math.round((json.simulation?.confidence ?? 0) * 100)}%`,
      });
      fetchDashboard(true);
    } catch (e) {
      toast({ title: 'Simulation failed', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setSimBusy(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error ?? 'No data available'} onRetry={() => fetchDashboard()} />;

  const go = data.globalOperations;

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
              <div className="rounded-lg bg-gradient-to-br from-amber-500/20 to-rose-500/20 p-2">
                <Crown className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{COMMAND_TAGLINE}</h1>
                <p className="text-[11px] text-muted-foreground">{COMMAND_SUBTAGLINE}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-1.5">Founder & Owner: {COMMAND_FOUNDER}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => fetchDashboard()} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setActiveTab('simulator')} className="bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700">
              <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              Command Simulator
            </Button>
          </div>
        </motion.div>

        {/* ─── Global Command Center live KPI row ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <SectionHeader icon={Gauge} title="Global Command Center" hint="live · updates every 30s" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KPICard icon={Activity} label="Org Health" value={`${Math.round(data.organizationHealth)}%`} accent={data.organizationHealth > 80 ? 'text-emerald-400' : 'text-amber-400'} />
            <KPICard icon={Workflow} label="Active Workflows" value={go.activeWorkflows} />
            <KPICard icon={AlertTriangle} label="Open Incidents" value={go.openIncidents} accent={go.openIncidents > 0 ? 'text-red-400' : undefined} />
            <KPICard icon={Clock} label="Pending Decisions" value={go.pendingDecisions} accent={go.pendingDecisions > 0 ? 'text-amber-400' : undefined} />
            <KPICard icon={Shield} label="Cash Position" value={fmtINR(data.cashPositionINR)} sub={`execution ${data.executionHealth}%`} />
            <KPICard icon={TrendingUp} label="Revenue MTD" value={fmtINR(data.revenueMTD)} sub={`compliance ${Math.round(data.complianceScore)}%`} />
            <KPICard icon={ShieldCheck} label="Compliance" value={`${Math.round(data.complianceScore)}%`} accent={data.complianceScore > 90 ? 'text-emerald-400' : 'text-amber-400'} />
            <KPICard icon={Bot} label="AI Activity" value={data.aiActivity.activeExecutives} sub={`${data.aiActivity.decisionsToday} decisions today`} />
          </div>
        </motion.div>

        {/* ─── Critical Alerts strip ─── */}
        {data.criticalAlerts.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <SectionHeader icon={AlertTriangle} title="Critical Alerts" hint={`${data.criticalAlerts.length} active`} right={
              <Badge variant="outline" className="text-[10px] text-red-300 border-red-500/30">{data.criticalAlerts.filter((a) => a.severity === 'critical').length} critical</Badge>
            } />
            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {data.criticalAlerts.map((inc) => (
                  <CriticalAlertCard
                    key={inc.id}
                    inc={inc}
                    onEscalate={onEscalateIncident}
                    onRecover={onRecoverIncident}
                    busy={incidentBusy === inc.id}
                  />
                ))}
              </div>
            </ScrollArea>
          </motion.div>
        )}

        {/* ─── Tabs ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-auto p-1 bg-white/[0.02] border border-white/[0.06]">
              <TabsTrigger value="overview" className="text-xs"><Network className="h-3 w-3 mr-1" />Overview</TabsTrigger>
              <TabsTrigger value="decisions" className="text-xs"><GitBranch className="h-3 w-3 mr-1" />Decisions</TabsTrigger>
              <TabsTrigger value="workflows" className="text-xs"><Workflow className="h-3 w-3 mr-1" />Workflows</TabsTrigger>
              <TabsTrigger value="incidents" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Incidents</TabsTrigger>
              <TabsTrigger value="playbooks" className="text-xs"><FileText className="h-3 w-3 mr-1" />Playbooks</TabsTrigger>
              <TabsTrigger value="simulator" className="text-xs"><FlaskConical className="h-3 w-3 mr-1" />Simulator</TabsTrigger>
              <TabsTrigger value="map" className="text-xs"><MapIcon className="h-3 w-3 mr-1" />Operations Map</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs"><Gauge className="h-3 w-3 mr-1" />Analytics</TabsTrigger>
              <TabsTrigger value="observability" className="text-xs"><Eye className="h-3 w-3 mr-1" />Observability</TabsTrigger>
              <TabsTrigger value="collaboration" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Collaboration</TabsTrigger>
              <TabsTrigger value="automation" className="text-xs"><Zap className="h-3 w-3 mr-1" />Automation</TabsTrigger>
              <TabsTrigger value="security" className="text-xs"><Shield className="h-3 w-3 mr-1" />Security</TabsTrigger>
            </TabsList>
          </ScrollArea>

          <TabsContent value="overview" className="mt-4"><OverviewTab fabric={data.fabric} executives={data.executives} /></TabsContent>
          <TabsContent value="decisions" className="mt-4">
            <DecisionsTab
              decisions={data.decisions.recent}
              onApprove={onApprove}
              onReject={onReject}
              onExecute={onExecuteDecision}
            />
          </TabsContent>
          <TabsContent value="workflows" className="mt-4">
            <WorkflowsTab workflows={data.workflows.recent} onLaunch={onLaunchWorkflow} busy={workflowBusy} />
          </TabsContent>
          <TabsContent value="incidents" className="mt-4">
            <IncidentsTab
              incidents={data.incidents.recent}
              summary={data.incidents.summary}
              onEscalate={onEscalateIncident}
              onRecover={onRecoverIncident}
              busy={!!incidentBusy}
            />
          </TabsContent>
          <TabsContent value="playbooks" className="mt-4">
            <PlaybooksTab
              playbooks={data.playbooks.recent}
              onRun={onRunPlaybook}
              busy={playbookRunBusy}
              onSelect={onSelectPlaybook}
              selectBusy={playbookSelectBusy}
              selectedPlaybook={selectedPlaybook}
            />
          </TabsContent>
          <TabsContent value="simulator" className="mt-4">
            <SimulatorTab
              recent={data.simulations.recent}
              onRun={onRunSimulation}
              busy={simBusy}
              lastResult={lastSim}
            />
          </TabsContent>
          <TabsContent value="map" className="mt-4"><OperationsMapTab map={data.operationsMap} /></TabsContent>
          <TabsContent value="analytics" className="mt-4"><AnalyticsTab a={data.analytics} coordination={data.coordination} /></TabsContent>
          <TabsContent value="observability" className="mt-4">
            <ObservabilityTab summary={data.observability.summary} recent={data.observability.recent} />
          </TabsContent>
          <TabsContent value="collaboration" className="mt-4"><CollaborationTab summary={data.collaboration} /></TabsContent>
          <TabsContent value="automation" className="mt-4"><AutomationTab summary={data.automation} /></TabsContent>
          <TabsContent value="security" className="mt-4"><SecurityTab summary={data.security} /></TabsContent>
        </Tabs>

        {/* ─── Footer ─── */}
        <footer className="mt-6 pt-4 border-t border-white/[0.06]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div>
              <p className="text-sm font-semibold tracking-tight">VEYRO™ — {COMMAND_TAGLINE}</p>
              <p className="text-[11px] text-muted-foreground">One Command. Every Team. Entire Enterprise.</p>
              <p className="text-[11px] text-muted-foreground/70">Founder & Owner: {COMMAND_FOUNDER}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${data.systemHealth > 80 ? 'bg-emerald-400 animate-pulse' : data.systemHealth > 60 ? 'bg-amber-400' : 'bg-red-400'}`} />
              <span className="text-[11px] text-muted-foreground">System Health: <span className={`font-semibold ${data.systemHealth > 80 ? 'text-emerald-400' : data.systemHealth > 60 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(data.systemHealth)}%</span></span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
