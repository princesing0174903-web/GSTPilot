'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT RUN MY BUSINESS™ — Operating System Dashboard
// Phase 4 — The Operating System that runs the entire firm 24/7.
//
// Tagline: Ask Anything. Delegate Everything.
//          Think. Delegate. Execute. Operate.
//
// Modules rendered here (all 10):
//   Module 1  — Business Command Center™
//   Module 2  — Natural Language Business Commands™
//   Module 3  — Autopilot Engine™
//   Module 4  — Task Execution Engine™
//   Module 5  — Business Agents™
//   Module 6  — Orchestrator™
//   Module 7  — Daily CEO Brief™
//   Module 8  — Delegation Engine™
//   Module 9  — Memory™
//   Module 10 — Personality™
//
// Data source: GET /api/rmb → RmbState (auto-refresh every 60s).
// Interactions:
//   POST /api/rmb/command     → CommandIntent
//   POST /api/rmb/orchestrate → OrchestrationPlan
//   POST /api/rmb/delegate    → DelegationPlan
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, TrendingUp, Wallet, IndianRupee, FileText, Activity, Clock,
  RefreshCw, Send, Zap, Target, Users, Sparkles,
  CheckCircle2, AlertTriangle, ChevronRight, Bot, Cpu, Workflow,
  Gauge, MessageSquare, Eye, Lightbulb, Calendar,
  Rocket, PlayCircle, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { apiPost } from '@/lib/api';
import type {
  AgentId, AutopilotState, BusinessAgent, CommandCenter, CommandCenterItem,
  CommandCenterSection, CommandIntent, DailyCEOBrief, DelegationPlan,
  OrchestrationPlan, OrchestrationStep, PriorityActionCEO, PriorityItem,
  RmbMemory, RmbPersonality, RmbState, RmbTask, TaskPriority, TaskStatus,
  TeamPerfRecord,
} from '@/lib/rmb/types';
import {
  TASK_STATUS_GLYPH, TASK_STATUS_LABEL,
} from '@/lib/rmb/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  const abs = Math.abs(amount);
  if (abs >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function formatINRFull(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '₹0';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function timeAgo(iso: string): string {
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

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

const AGENT_LABEL: Record<AgentId, string> = {
  'gst-agent': 'GST Agent',
  'finance-agent': 'Finance Agent',
  'collections-agent': 'Collections Agent',
  'compliance-agent': 'Compliance Agent',
  'reporting-agent': 'Reporting Agent',
};

const AGENT_EMOJI: Record<AgentId, string> = {
  'gst-agent': '🗂️',
  'finance-agent': '💰',
  'collections-agent': '📞',
  'compliance-agent': '🛡️',
  'reporting-agent': '📊',
};

function priorityColor(p?: TaskPriority): string {
  switch (p) {
    case 'critical': return 'text-red-400';
    case 'high': return 'text-amber-400';
    case 'medium': return 'text-cyan-400';
    case 'low': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

function priorityBg(p?: TaskPriority): string {
  switch (p) {
    case 'critical': return 'border-red-500/30 bg-red-500/[0.05]';
    case 'high': return 'border-amber-500/30 bg-amber-500/[0.05]';
    case 'medium': return 'border-cyan-500/20 bg-cyan-500/[0.03]';
    default: return 'border-white/[0.06] bg-white/[0.02]';
  }
}

function priorityLabel(p?: TaskPriority): string {
  switch (p) {
    case 'critical': return 'CRITICAL';
    case 'high': return 'HIGH';
    case 'medium': return 'MEDIUM';
    case 'low': return 'LOW';
    default: return '';
  }
}

// ─── Quick Commands (Module 2 chips) ──────────────────────────────────────────

const QUICK_COMMANDS: { label: string; text: string }[] = [
  { label: 'Recover collections', text: 'Recover collections.' },
  { label: 'File my GST returns', text: 'File my GST returns.' },
  { label: 'Generate monthly report', text: 'Generate monthly report.' },
  { label: 'Create reminders', text: 'Create reminders for upcoming deadlines.' },
  { label: 'Send WhatsApp to clients', text: 'Send WhatsApp to clients.' },
  { label: 'Show risky clients', text: 'Show risky clients.' },
  { label: 'Prepare next month forecast', text: 'Prepare next month forecast.' },
  { label: 'Run my business today', text: 'Run my business today.' },
];

const QUICK_DELEGATIONS: { label: string; text: string }[] = [
  { label: 'Prepare monthly compliance report', text: 'Prepare monthly compliance report.' },
  { label: 'Recover collections', text: 'Recover collections from all overdue clients.' },
  { label: 'Generate P&L', text: 'Generate P&L for this month.' },
  { label: 'Send reminders', text: 'Send reminders to clients with overdue invoices.' },
];

// ─── Motion wrapper ───────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' as const }}
    >
      {children}
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon, title, subtitle, action,
}: { icon: LucideIcon; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg accent-gradient-soft">
          <Icon className="h-4 w-4 accent-text" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── Task Card (reused by Modules 2, 4, 6, 8) ─────────────────────────────────

function TaskCard({ task, delay = 0 }: { task: RmbTask; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`rounded-xl border p-3 ${priorityBg(task.priority)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{task.title}</span>
            <span className="text-[10px]">{TASK_STATUS_GLYPH[task.status]}</span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{task.description}</p>
        </div>
        {task.amount != null && task.amount > 0 && (
          <span className="shrink-0 text-xs font-semibold text-foreground">{formatINR(task.amount)}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        {task.assignedAgent && (
          <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
            {AGENT_EMOJI[task.assignedAgent]} {AGENT_LABEL[task.assignedAgent]}
          </Badge>
        )}
        <Badge variant="outline" className="border-white/10 bg-white/[0.03] capitalize text-[10px]">
          {task.category}
        </Badge>
        <span className={`font-bold ${priorityColor(task.priority)}`}>{priorityLabel(task.priority)}</span>
        {task.dueAt && (
          <span className="ml-auto flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {task.dueAt}
          </span>
        )}
      </div>
      {task.status === 'running' && (
        <div className="mt-2">
          <Progress value={task.progressPct} className="h-1.5 bg-white/[0.05]" />
          <p className="mt-1 text-[10px] text-muted-foreground">{task.progressPct}% · {TASK_STATUS_LABEL[task.status]}</p>
        </div>
      )}
      {task.output && (task.status === 'completed' || task.status === 'failed') && (
        <div className="mt-2 rounded-lg bg-white/[0.03] p-2">
          <p className="text-[11px] leading-relaxed text-foreground/80">
            <span className="font-medium">Output:</span> {task.output}
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RmbSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 7 — DAILY CEO BRIEF™ (hero card)
// ═══════════════════════════════════════════════════════════════════════════════

function DailyBriefCard({ brief, delay }: { brief: DailyCEOBrief; delay: number }) {
  const riskDot = brief.riskLevel === 'high' ? '🔴' : brief.riskLevel === 'medium' ? '🟡' : '🟢';
  const riskColor = brief.riskLevel === 'high' ? 'text-red-400'
    : brief.riskLevel === 'medium' ? 'text-amber-400' : 'text-emerald-400';

  const metrics = [
    { label: 'Revenue', value: brief.metrics.revenue, icon: TrendingUp },
    { label: 'Collections', value: brief.metrics.collections, icon: IndianRupee },
    { label: 'Cash', value: brief.metrics.cash, icon: Wallet },
    { label: 'GST', value: brief.metrics.gst, icon: FileText },
  ];

  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.05] via-card/60 to-teal-500/[0.05] backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Greeting */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground sm:text-3xl">{brief.greeting}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{brief.dateLabel}</p>
              <p className="mt-1 text-sm font-medium accent-text">{brief.tagline}</p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300">
                <Activity className="mr-1 h-3 w-3" />
                Today&apos;s Business Brief
              </Badge>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${riskColor}`}>
                <span>{riskDot}</span>
                Risk level: {brief.riskLabel}
              </span>
            </div>
          </div>

          {/* 4-metric grid */}
          <div className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</span>
                  </div>
                  <p className="text-lg font-bold text-foreground sm:text-xl">{formatINR(m.value)}</p>
                </div>
              );
            })}
          </div>

          {/* Priority Actions */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-3.5 w-3.5 accent-text" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Priority Actions</h3>
            </div>
            {brief.priorityActions.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-center">
                <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-emerald-400" />
                <p className="text-xs text-foreground">You&apos;re all caught up. No priority actions today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {brief.priorityActions.map((a: PriorityActionCEO, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: delay + 0.1 + i * 0.05 }}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg accent-gradient-soft text-xs font-bold">
                      {a.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{a.text}</p>
                        {a.amount != null && a.amount > 0 && (
                          <span className="shrink-0 text-xs font-semibold text-amber-300">{formatINR(a.amount)}</span>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
                          → {AGENT_LABEL[a.agentId]}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 1 — BUSINESS COMMAND CENTER™
// ═══════════════════════════════════════════════════════════════════════════════

function StatusMetricCard({
  icon: Icon, label, value, sub, subColor,
}: {
  icon: LucideIcon; label: string; value: string; sub?: string; subColor?: string;
}) {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        {sub && <p className={`mt-0.5 text-[11px] ${subColor || 'text-muted-foreground'}`}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CommandCenterSectionCard({
  section, delay, onCta,
}: {
  section: CommandCenterSection; delay: number;
  onCta: (s: CommandCenterSection) => void;
}) {
  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition-colors hover:bg-white/[0.04]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="text-base">{section.emoji}</span>
              {section.title}
            </CardTitle>
            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
              {section.count}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {section.items.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No items.</p>
          ) : (
            <ScrollArea className="max-h-64 pr-2">
              <div className="space-y-1.5">
                {section.items.map((item: CommandCenterItem) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-2 ${priorityBg(item.urgency)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">{item.title}</p>
                        {item.subtitle && (
                          <p className="truncate text-[10px] text-muted-foreground">{item.subtitle}</p>
                        )}
                      </div>
                      {item.amount != null && item.amount > 0 && (
                        <span className="shrink-0 text-[11px] font-semibold text-foreground">
                          {formatINR(item.amount)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {item.urgency && (
                        <span className={`font-bold ${priorityColor(item.urgency)}`}>
                          {priorityLabel(item.urgency)}
                        </span>
                      )}
                      {item.dueLabel && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {item.dueLabel}
                        </span>
                      )}
                      {item.meta && (
                        <span className="ml-auto text-muted-foreground">{item.meta}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onCta(section)}
            className="mt-3 h-7 w-full border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.06]"
          >
            {section.cta}
            <ChevronRight className="ml-1 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function CommandCenterModule({
  cc, delay,
}: { cc: CommandCenter; delay: number }) {
  const { setCurrentView } = useApp();
  const handleCta = useCallback((s: CommandCenterSection) => {
    if (s.ctaView) {
      setCurrentView(s.ctaView as Parameters<typeof setCurrentView>[0]);
    }
  }, [setCurrentView]);

  const status = cc.businessStatus;
  const healthColor = status.healthScore >= 75 ? 'text-emerald-400'
    : status.healthScore >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div>
      <SectionHeader
        icon={Gauge}
        title="Business Command Center"
        subtitle="Real-time pulse of the firm — one glance, every signal"
      />

      {/* 5 status metric cards */}
      <FadeIn delay={delay}>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatusMetricCard icon={TrendingUp} label="Revenue" value={formatINR(status.revenue)} sub="this month" />
          <StatusMetricCard icon={Wallet} label="Cash Position" value={formatINR(status.cash)} sub="available" />
          <StatusMetricCard icon={FileText} label="GST Liability" value={formatINR(status.gstLiability)} sub="outstanding" />
          <StatusMetricCard icon={IndianRupee} label="Pending Collections" value={formatINR(status.pendingCollections)} sub="overdue" />
          <StatusMetricCard
            icon={Activity}
            label="Business Health"
            value={`${status.healthScore}/100`}
            sub={status.healthLabel}
            subColor={healthColor}
          />
        </div>
      </FadeIn>

      {/* 6 section cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cc.sections.map((s, i) => (
          <CommandCenterSectionCard
            key={s.id}
            section={s}
            delay={delay + 0.05 + i * 0.04}
            onCta={handleCta}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 2 — NATURAL LANGUAGE BUSINESS COMMANDS™
// ═══════════════════════════════════════════════════════════════════════════════

function CommandModule({ delay }: { delay: number }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CommandIntent | null>(null);

  const submit = useCallback(async (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/rmb/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CommandIntent;
      setResult(json);
      setText('');
    } catch (e) {
      toast({
        title: 'Command failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [toast]);

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;
  const confidenceColor = result
    ? result.confidence >= 0.7 ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
    : result.confidence >= 0.4 ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300'
    : 'border-red-500/30 bg-red-500/[0.08] text-red-300'
    : '';

  return (
    <div>
      <SectionHeader
        icon={MessageSquare}
        title="Natural Language Business Commands"
        subtitle="Type a command in plain English — Oracle dispatches the right agent"
      />
      <FadeIn delay={delay}>
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. Recover collections. · File my GST returns. · Generate monthly report."
                className="min-h-[48px] resize-none border-white/10 bg-white/[0.03] text-sm"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submit(text);
                  }
                }}
              />
              <Button
                onClick={() => submit(text)}
                disabled={submitting || !text.trim()}
                className="accent-gradient h-12 shrink-0 text-white hover:opacity-90 sm:w-32"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" />
                    Send
                  </>
                )}
              </Button>
            </div>

            {/* Quick command chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_COMMANDS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => submit(q.text)}
                  disabled={submitting}
                  className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-foreground transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] hover-lift disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground">
              Tip: ⌘/Ctrl + Enter to send. Oracle reads your command, identifies intent, and dispatches tasks to the right Business Agent.
            </p>

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-3 overflow-hidden"
                >
                  <Separator className="bg-white/[0.06]" />

                  {/* Intent + confidence */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Matched intent:</span>
                    <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px] capitalize">
                      {result.intent.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${confidenceColor}`}>
                      {confidencePct}% confidence
                    </Badge>
                    {result.matchedPhrases.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        matched: {result.matchedPhrases.join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Spoken ack — Oracle response */}
                  <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-teal-500/[0.04] p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 accent-text" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider accent-text">
                        Oracle
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{result.spokenAck}</p>
                  </div>

                  {/* Generated task plan */}
                  {result.generatedTaskPlan.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 accent-text" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                          Generated Task Plan · {result.generatedTaskPlan.length} task(s)
                        </span>
                      </div>
                      <div className="space-y-2">
                        {result.generatedTaskPlan.map((task, i) => (
                          <TaskCard key={task.id} task={task} delay={0.05 + i * 0.03} />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 3 — AUTOPILOT ENGINE™
// ═══════════════════════════════════════════════════════════════════════════════

function AutopilotCard({ ap, delay }: { ap: AutopilotState; delay: number }) {
  const [expanded, setExpanded] = useState(false);
  const statusBadge = ap.status === 'on' || ap.status === 'running'
    ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
    : ap.status === 'error' ? 'border-red-500/30 bg-red-500/[0.08] text-red-300'
    : 'border-white/10 bg-white/[0.03] text-muted-foreground';
  const statusLabel = ap.status === 'on' ? 'ON' : ap.status === 'running' ? 'RUNNING' : ap.status === 'error' ? 'ERROR' : 'OFF';

  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="text-base">{ap.emoji}</span>
              {ap.name}
            </CardTitle>
            <Badge variant="outline" className={`text-[10px] ${statusBadge}`}>
              {ap.status === 'running' && <RefreshCw className="mr-1 h-2.5 w-2.5 animate-spin" />}
              {statusLabel}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">{ap.cadenceLabel}</p>
        </CardHeader>
        <CardContent className="pt-0">
          {ap.lastRunSummary && (
            <div className="mb-2 rounded-lg bg-white/[0.03] p-2">
              <p className="text-[11px] leading-relaxed text-foreground/80">
                <span className="font-medium">Last run:</span> {ap.lastRunSummary}
              </p>
            </div>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs hover:bg-white/[0.04]"
          >
            <span className="text-muted-foreground">{ap.routines.length} routine(s)</span>
            <span className="text-[10px] text-muted-foreground">{expanded ? 'Hide' : 'Show'}</span>
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {ap.routines.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{TASK_STATUS_GLYPH[r.status]}</span>
                        <p className="truncate text-xs font-medium text-foreground">{r.name}</p>
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">{r.description}</p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    {r.lastRunAt && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        last: {timeAgo(r.lastRunAt)}
                      </span>
                    )}
                    {r.nextRunAt && (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        next: {timeAgo(r.nextRunAt)}
                      </span>
                    )}
                  </div>
                  {r.output && (
                    <p className="mt-1 text-[10px] leading-relaxed text-foreground/70">
                      <span className="font-medium">Output:</span> {r.output}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function AutopilotModule({
  autopilots, masterOn, onToggleMaster, delay,
}: {
  autopilots: AutopilotState[]; masterOn: boolean;
  onToggleMaster: (v: boolean) => void; delay: number;
}) {
  return (
    <div>
      <SectionHeader
        icon={Workflow}
        title="Autopilot Engine"
        subtitle="Self-running routines that keep the firm compliant, collected, and reported"
        action={
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Master Switch</span>
            <Switch checked={masterOn} onCheckedChange={onToggleMaster} />
            <span className={`text-[10px] font-bold ${masterOn ? 'text-emerald-300' : 'text-muted-foreground'}`}>
              {masterOn ? 'ON' : 'OFF'}
            </span>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {autopilots.map((ap, i) => (
          <AutopilotCard key={ap.id} ap={ap} delay={delay + i * 0.05} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 4 — TASK EXECUTION ENGINE™
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_GROUPS: { key: TaskStatus; label: string; glyph: string }[] = [
  { key: 'running', label: 'Running', glyph: '🟡' },
  { key: 'pending', label: 'Pending', glyph: '⚪' },
  { key: 'scheduled', label: 'Scheduled', glyph: '🔵' },
  { key: 'completed', label: 'Completed', glyph: '🟢' },
  { key: 'failed', label: 'Failed', glyph: '🔴' },
];

function TaskBoard({ tasks, delay }: { tasks: RmbTask[]; delay: number }) {
  const grouped = useMemo(() => {
    const m: Record<TaskStatus, RmbTask[]> = {
      pending: [], running: [], completed: [], failed: [], scheduled: [],
    };
    for (const t of tasks) m[t.status].push(t);
    return m;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {STATUS_GROUPS.map((g, i) => {
        const items = grouped[g.key];
        return (
          <FadeIn key={g.key} delay={delay + i * 0.04}>
            <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 text-xs">
                    <span>{g.glyph}</span>
                    {g.label}
                  </CardTitle>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
                    {items.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="max-h-80 pr-2">
                  {items.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-muted-foreground">No tasks.</p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((task, j) => (
                        <TaskCard key={task.id} task={task} delay={0.03 + j * 0.02} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </FadeIn>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 5 — BUSINESS AGENTS™
// ═══════════════════════════════════════════════════════════════════════════════

function agentStatusColor(s: BusinessAgent['status']): string {
  switch (s) {
    case 'working': return 'text-amber-400';
    case 'alert': return 'text-red-400';
    case 'monitoring': return 'text-cyan-400';
    default: return 'text-emerald-400';
  }
}

function agentStatusDot(s: BusinessAgent['status']): string {
  switch (s) {
    case 'working': return 'bg-amber-400';
    case 'alert': return 'bg-red-400';
    case 'monitoring': return 'bg-cyan-400';
    default: return 'bg-emerald-400';
  }
}

function AgentCard({
  agent,
  delay,
  running = false,
  onRun,
}: {
  agent: BusinessAgent;
  delay: number;
  running?: boolean;
  onRun?: (agentId: AgentId) => void;
}) {
  const statusLabel = agent.status === 'working' ? 'Working'
    : agent.status === 'alert' ? 'Alert'
    : agent.status === 'monitoring' ? 'Monitoring' : 'Idle';

  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition-colors hover:bg-white/[0.04]">
        <CardContent className="p-4">
          {/* Header */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl accent-gradient-soft text-xl">
                {agent.emoji}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{agent.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">{agent.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${agentStatusDot(agent.status)} ${agent.status === 'working' ? 'animate-pulse' : ''}`} />
              <span className={`text-[10px] font-medium ${agentStatusColor(agent.status)}`}>{statusLabel}</span>
            </div>
          </div>

          <p className="mb-3 text-[11px] italic leading-relaxed text-muted-foreground">&quot;{agent.tagline}&quot;</p>

          {/* Current task */}
          {agent.currentTask && (
            <div className="mb-3 flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-2">
              <span className="mt-0.5 text-xs">⚡</span>
              <p className="text-[11px] leading-relaxed text-foreground/90">
                <span className="font-medium">Working on:</span> {agent.currentTask}
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="mb-3 grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5">
              <p className="text-sm font-bold text-amber-300">{agent.activeTaskCount}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Active</p>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5">
              <p className="text-sm font-bold text-emerald-300">{agent.completedToday}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Done</p>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-1.5">
              <p className="text-sm font-bold text-red-300">{agent.failedToday}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Failed</p>
            </div>
          </div>

          {agent.lastAction && (
            <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">
              <span className="font-medium">Last action:</span> {agent.lastAction}
            </p>
          )}

          {/* Handles */}
          <div className="mb-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Handles</p>
            <ul className="space-y-0.5">
              {agent.handles.map((h, i) => (
                <li key={i} className="flex items-start gap-1 text-[11px] text-foreground/80">
                  <ChevronRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Run Agent button (PT-1-b: dispatches REAL DB writes) */}
          {onRun && (
            <Button
              size="sm"
              onClick={() => onRun(agent.id)}
              disabled={running}
              className="w-full accent-gradient text-white hover:opacity-90"
            >
              {running ? (
                <>
                  <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <PlayCircle className="mr-1.5 h-3 w-3" />
                  Run {agent.name.replace(' Agent', '')}
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}

function AgentsModule({
  agents,
  delay,
  runningAgentId,
  onRunAgent,
  onRunAll,
  runAllLoading,
}: {
  agents: BusinessAgent[];
  delay: number;
  runningAgentId?: AgentId | null;
  onRunAgent?: (agentId: AgentId) => void;
  onRunAll?: () => void;
  runAllLoading?: boolean;
}) {
  return (
    <div>
      <SectionHeader
        icon={Bot}
        title="Business Agents"
        subtitle="Specialised AI employees that execute real work — each Run dispatches DB writes (Notification / AITask / AuditLog)"
        action={
          <div className="flex items-center gap-2">
            {onRunAll && (
              <Button
                size="sm"
                onClick={onRunAll}
                disabled={runAllLoading}
                className="accent-gradient text-white hover:opacity-90"
              >
                {runAllLoading ? (
                  <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <PlayCircle className="mr-1.5 h-3 w-3" />
                )}
                {runAllLoading ? 'Running All…' : 'Run All Agents'}
              </Button>
            )}
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300">{agents.length} active</Badge>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {agents.map((a, i) => (
          <AgentCard
            key={a.id}
            agent={a}
            delay={delay + i * 0.05}
            running={runningAgentId === a.id}
            onRun={onRunAgent}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 6 — ORCHESTRATOR™
// ═══════════════════════════════════════════════════════════════════════════════

function OrchestrationPipeline({ steps, delay }: { steps: OrchestrationStep[]; delay: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {steps.map((s, i) => (
        <FadeIn key={s.id} delay={delay + i * 0.05}>
          <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-lg">{s.emoji}</span>
              <span className="text-sm">{TASK_STATUS_GLYPH[s.status]}</span>
            </div>
            <p className="text-xs font-semibold text-foreground">{s.name}</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{s.detail}</p>
            {s.producedTasks > 0 && (
              <div className="mt-2">
                <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.05] text-[10px] text-emerald-300">
                  <Zap className="mr-1 h-2.5 w-2.5" />
                  {s.producedTasks} tasks
                </Badge>
              </div>
            )}
            {i < steps.length - 1 && (
              <ChevronRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground lg:block xl:hidden" />
            )}
          </div>
        </FadeIn>
      ))}
    </div>
  );
}

function OrchestratorModule({
  plan, liveResult, delay, onAskOracle,
}: {
  plan: OrchestrationPlan;
  liveResult: OrchestrationPlan | null;
  delay: number;
  onAskOracle: () => void;
}) {
  const display = liveResult || plan;
  const tasksByAgentText = useMemo(() => {
    const entries = Object.entries(display.tasksByAgent) as [AgentId, number][];
    return entries
      .filter(([, n]) => n > 0)
      .map(([id, n]) => `${AGENT_LABEL[id]}: ${n}`)
      .join(' · ') || 'No tasks assigned yet';
  }, [display]);

  return (
    <div>
      <SectionHeader
        icon={Cpu}
        title="Orchestrator"
        subtitle="Analyses the business, generates priorities, dispatches work to every agent"
        action={
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/[0.08] text-amber-300 text-[10px]">
            <Rocket className="mr-1 h-3 w-3" />
            Trigger: {display.trigger}
          </Badge>
        }
      />
      <FadeIn delay={delay}>
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <CardContent className="p-5">
            {/* Analysis paragraph */}
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 accent-text" />
                <span className="text-[10px] font-semibold uppercase tracking-wider accent-text">Business Read</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{display.analysis}</p>
            </div>

            {/* Pipeline */}
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Orchestration Pipeline
            </p>
            <OrchestrationPipeline steps={display.steps} delay={delay + 0.05} />

            {/* Priorities */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-3.5 w-3.5 accent-text" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">
                  Priorities · {display.priorities.length} ranked
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {display.priorities.map((p: PriorityItem) => (
                  <div
                    key={p.rank}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 ${priorityBg(p.urgency)}`}
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg accent-gradient-soft text-xs font-bold">
                      {p.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">{p.title}</p>
                        <span className={`shrink-0 text-[10px] font-bold ${priorityColor(p.urgency)}`}>
                          {priorityLabel(p.urgency)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{p.detail}</p>
                      <div className="mt-1.5">
                        <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
                          {AGENT_EMOJI[p.agentId]} {AGENT_LABEL[p.agentId]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks by agent + completion report */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 accent-text" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Tasks by Agent</span>
                </div>
                <p className="text-xs leading-relaxed text-foreground/80">{tasksByAgentText}</p>
                <p className="mt-1.5 text-[11px] font-semibold text-foreground">
                  Total created: {display.tasksCreated}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Completion Report</span>
                </div>
                <p className="text-xs leading-relaxed text-foreground/80">{display.completionReport}</p>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={onAskOracle}
                className="border-white/10 bg-white/[0.03] text-xs hover:bg-white/[0.06]"
              >
                <MessageSquare className="mr-1.5 h-3 w-3" />
                Ask Oracle about this plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 8 — DELEGATION ENGINE™
// ═══════════════════════════════════════════════════════════════════════════════

function DelegationModule({ delay }: { delay: number }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [plan, setPlan] = useState<DelegationPlan | null>(null);

  const submit = useCallback(async (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/rmb/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: t }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DelegationPlan;
      setPlan(json);
      setText('');
    } catch (e) {
      toast({
        title: 'Delegation failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [toast]);

  const execModeBadge = plan?.executionMode === 'now'
    ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300'
    : plan?.executionMode === 'scheduled'
    ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300'
    : 'border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-300';

  return (
    <div>
      <SectionHeader
        icon={Send}
        title="Delegation Engine"
        subtitle="Delegate anything — Oracle understands, schedules, and dispatches the right agent"
      />
      <FadeIn delay={delay}>
        <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Delegate anything… e.g. Prepare monthly compliance report."
                className="min-h-[48px] resize-none border-white/10 bg-white/[0.03] text-sm"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    submit(text);
                  }
                }}
              />
              <Button
                onClick={() => submit(text)}
                disabled={submitting || !text.trim()}
                className="accent-gradient h-12 shrink-0 text-white hover:opacity-90 sm:w-32"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4" />
                    Delegate
                  </>
                )}
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {QUICK_DELEGATIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => submit(q.text)}
                  disabled={submitting}
                  className="rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 text-[11px] text-foreground transition-all hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] hover-lift disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {plan && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-3 overflow-hidden"
                >
                  <Separator className="bg-white/[0.06]" />

                  {/* Understood */}
                  <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-teal-500/[0.04] p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 accent-text" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider accent-text">Understood</span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{plan.understood}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Execution mode:</span>
                    <Badge variant="outline" className={`text-[10px] capitalize ${execModeBadge}`}>
                      {plan.executionMode}
                    </Badge>
                    <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px] capitalize">
                      intent: {plan.intent.replace(/_/g, ' ')}
                    </Badge>
                    {plan.scheduledFor && (
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/[0.05] text-[10px] text-amber-300">
                        <Calendar className="mr-1 h-2.5 w-2.5" />
                        Scheduled: {formatDateTime(plan.scheduledFor)}
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-lg bg-white/[0.03] p-2.5">
                    <p className="text-xs leading-relaxed text-foreground/90">
                      <span className="font-medium accent-text">Oracle: </span>
                      {plan.ack}
                    </p>
                  </div>

                  {plan.tasks.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 accent-text" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                          Tasks Created · {plan.tasks.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {plan.tasks.map((task, i) => (
                          <TaskCard key={task.id} task={task} delay={0.05 + i * 0.03} />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 9 — MEMORY™
// ═══════════════════════════════════════════════════════════════════════════════

function behaviourColor(b: 'on_time' | 'slight_delay' | 'chronic_late' | 'no_data'): string {
  switch (b) {
    case 'on_time': return 'text-emerald-400';
    case 'slight_delay': return 'text-amber-400';
    case 'chronic_late': return 'text-red-400';
    default: return 'text-muted-foreground';
  }
}

function behaviourLabel(b: 'on_time' | 'slight_delay' | 'chronic_late' | 'no_data'): string {
  switch (b) {
    case 'on_time': return 'On time';
    case 'slight_delay': return 'Slight delay';
    case 'chronic_late': return 'Chronic late';
    default: return 'No data';
  }
}

function MemoryModule({ memory, delay }: { memory: RmbMemory; delay: number }) {
  return (
    <div>
      <SectionHeader
        icon={Brain}
        title="Memory"
        subtitle="Long-term patterns, client behaviour, generated artefacts, and routines"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Insights */}
        <FadeIn delay={delay}>
          <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="h-4 w-4 accent-text" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.insights.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No insights recorded yet.</p>
              ) : (
                <ScrollArea className="max-h-56 pr-2">
                  <ul className="space-y-1.5">
                    {memory.insights.map((ins, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 accent-text" />
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Collection history */}
        <FadeIn delay={delay + 0.05}>
          <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <IndianRupee className="h-4 w-4 accent-text" />
                Collection History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.collectionHistory.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No collection history yet.</p>
              ) : (
                <ScrollArea className="max-h-56 pr-2">
                  <div className="space-y-1.5">
                    {memory.collectionHistory.map((c, i) => (
                      <div key={i} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-xs font-medium text-foreground">{c.clientName}</p>
                          <span className={`shrink-0 text-[10px] font-bold ${behaviourColor(c.usualBehaviour)}`}>
                            {behaviourLabel(c.usualBehaviour)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span>avg delay: {c.avgDelayDays}d</span>
                          <span>·</span>
                          <span>outstanding: {formatINR(c.outstanding)}</span>
                        </div>
                        {c.note && <p className="mt-0.5 text-[10px] italic text-muted-foreground">{c.note}</p>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Reports generated */}
        <FadeIn delay={delay + 0.1}>
          <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 accent-text" />
                Reports Generated
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.reportsGenerated.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No reports generated yet.</p>
              ) : (
                <ScrollArea className="max-h-56 pr-2">
                  <div className="space-y-1.5">
                    {memory.reportsGenerated.map((r) => (
                      <div key={r.id} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-foreground">{r.title}</p>
                            <p className="text-[10px] text-muted-foreground">{r.type}</p>
                          </div>
                          {r.pages != null && (
                            <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
                              {r.pages}p
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {timeAgo(r.generatedAt)}
                          </span>
                          <span>·</span>
                          <span>{AGENT_LABEL[r.generatedBy]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Routines */}
        <FadeIn delay={delay + 0.15}>
          <Card className="border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Workflow className="h-4 w-4 accent-text" />
                Routines
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memory.routines.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No routines configured.</p>
              ) : (
                <ScrollArea className="max-h-56 pr-2">
                  <div className="space-y-1.5">
                    {memory.routines.map((r) => (
                      <div key={r.id} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-xs font-medium text-foreground">{r.name}</p>
                          <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px]">
                            {r.cadence}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            last: {timeAgo(r.lastRun)}
                          </span>
                          <span>·</span>
                          <span>{AGENT_EMOJI[r.owner]} {AGENT_LABEL[r.owner]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Team Performance table */}
      <FadeIn delay={delay + 0.2}>
        <Card className="mt-4 border-white/[0.06] bg-white/[0.02] backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 accent-text" />
              Team Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Agent</th>
                    <th className="pb-2 pr-3 font-medium">Completed</th>
                    <th className="pb-2 pr-3 font-medium">Failed</th>
                    <th className="pb-2 pr-3 font-medium">On-Time %</th>
                    <th className="pb-2 font-medium">Highlight</th>
                  </tr>
                </thead>
                <tbody>
                  {memory.teamPerformance.map((row: TeamPerfRecord) => (
                    <tr key={row.agentId} className="border-b border-white/[0.03] last:border-0">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>{AGENT_EMOJI[row.agentId]}</span>
                          {row.name}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-emerald-300">{row.completed}</td>
                      <td className="py-2 pr-3 text-red-300">{row.failed}</td>
                      <td className="py-2 pr-3">
                        <span className={row.onTimePct >= 90 ? 'text-emerald-300' : row.onTimePct >= 70 ? 'text-amber-300' : 'text-red-300'}>
                          {row.onTimePct}%
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{row.highlight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE 10 — PERSONALITY™
// ═══════════════════════════════════════════════════════════════════════════════

function PersonalityModule({ personality, delay }: { personality: RmbPersonality; delay: number }) {
  return (
    <FadeIn delay={delay}>
      <Card className="border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.04] via-card/60 to-teal-500/[0.04] backdrop-blur-sm">
        <CardContent className="p-5">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Oracle operates as:
                <span className="ml-1.5 accent-text">
                  {personality.roles.join(' · ')}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{personality.tagline}</p>
            </div>
            <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300 text-[10px]">
              <Sparkles className="mr-1 h-3 w-3" />
              Personality
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Spoken behaviours */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 accent-text" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Spoken Behaviours</span>
              </div>
              <ul className="space-y-1">
                {personality.spokenBehaviours.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    <span>&ldquo;{b}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Never says */}
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.02] p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Never Says</span>
              </div>
              <ul className="space-y-1">
                {personality.forbiddenPhrases.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-red-400">✕</span>
                    <span className="line-through">&ldquo;{p}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Separator className="my-4 bg-white/[0.06]" />

          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              GSTPilot Run My Business<span className="accent-text">™</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Think · Delegate · Execute · Operate.
            </p>
            <p className="mt-2 text-[10px] text-muted-foreground/60">
              Founded &amp; developed by the GSTPilot team
            </p>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RunMyBusinessPage() {
  const { setCurrentView } = useApp();
  const { toast } = useToast();
  const { user } = useAuth();
  const [data, setData] = useState<RmbState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterAutopilot, setMasterAutopilot] = useState(true);
  const [orchestrating, setOrchestrating] = useState(false);
  const [liveOrchestration, setLiveOrchestration] = useState<OrchestrationPlan | null>(null);
  const [runningAgentId, setRunningAgentId] = useState<AgentId | null>(null);
  const [runAllLoading, setRunAllLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/rmb', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as RmbState;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Run My Business state');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── PT-1-b: Map RMB AgentId → /api/rmb/run-agent agent key ──────────────
  const agentKeyMap: Record<AgentId, 'collections' | 'compliance' | 'finance' | 'reporting' | 'gst'> = {
    'collections-agent': 'collections',
    'compliance-agent': 'compliance',
    'finance-agent': 'finance',
    'reporting-agent': 'reporting',
    'gst-agent': 'gst',
  };

  const dispatchAgent = useCallback(async (agentId: AgentId) => {
    const agentKey = agentKeyMap[agentId];
    setRunningAgentId(agentId);
    try {
      const result = await apiPost<{
        success: boolean;
        agent: string;
        summary: string;
        metrics?: Record<string, number | string>;
        error?: string;
      }>('/api/rmb/run-agent', { agent: agentKey, userId: user?.id });
      if (result.success) {
        toast({
          title: `${AGENT_LABEL[agentId]} executed`,
          description: result.summary,
        });
        // Refresh the RMB state so the user sees the new tasks/notifications
        void fetchData();
      } else {
        toast({
          title: `${AGENT_LABEL[agentId]} failed`,
          description: result.error ?? 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (e) {
      toast({
        title: `${AGENT_LABEL[agentId]} failed`,
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRunningAgentId(null);
    }
  }, [toast, user?.id, fetchData]);

  const runAllAgents = useCallback(async () => {
    setRunAllLoading(true);
    const order: AgentId[] = ['collections-agent', 'compliance-agent', 'finance-agent', 'gst-agent', 'reporting-agent'];
    const summaries: string[] = [];
    for (const agentId of order) {
      const agentKey = agentKeyMap[agentId];
      setRunningAgentId(agentId);
      try {
        const result = await apiPost<{ success: boolean; summary?: string; error?: string }>(
          '/api/rmb/run-agent',
          { agent: agentKey, userId: user?.id },
        );
        if (result.success && result.summary) {
          summaries.push(`• ${AGENT_LABEL[agentId]}: ${result.summary}`);
        } else {
          summaries.push(`• ${AGENT_LABEL[agentId]}: ${result.error ?? 'failed'}`);
        }
      } catch (e) {
        summaries.push(
          `• ${AGENT_LABEL[agentId]}: ${e instanceof Error ? e.message : 'failed'}`,
        );
      }
    }
    setRunningAgentId(null);
    setRunAllLoading(false);
    void fetchData();
    toast({
      title: 'All 5 agents executed',
      description: summaries.join('\n'),
    });
  }, [toast, user?.id, fetchData]);

  const runMyBusinessToday = useCallback(async () => {
    setOrchestrating(true);
    try {
      const res = await fetch('/api/rmb/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'Run my business today' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const plan = (await res.json()) as OrchestrationPlan;
      setLiveOrchestration(plan);

      // PT-1-b: Also dispatch REAL DB-writing agent runs after orchestrate
      try {
        const agentResults = await Promise.allSettled([
          apiPost<{ success: boolean; summary?: string }>('/api/rmb/run-agent', { agent: 'collections', userId: user?.id }),
          apiPost<{ success: boolean; summary?: string }>('/api/rmb/run-agent', { agent: 'compliance', userId: user?.id }),
          apiPost<{ success: boolean; summary?: string }>('/api/rmb/run-agent', { agent: 'finance', userId: user?.id }),
          apiPost<{ success: boolean; summary?: string }>('/api/rmb/run-agent', { agent: 'gst', userId: user?.id }),
          apiPost<{ success: boolean; summary?: string }>('/api/rmb/run-agent', { agent: 'reporting', userId: user?.id }),
        ]);
        const succeeded = agentResults
          .filter((r): r is PromiseFulfilledResult<{ success: boolean; summary?: string }> => r.status === 'fulfilled' && r.value.success)
          .map((r) => r.value.summary ?? '');
        toast({
          title: 'Orchestration complete',
          description: `${plan.tasksCreated} tasks dispatched. ${succeeded.length}/5 real agents wrote DB rows.${succeeded.length > 0 ? '\n' + succeeded.join('\n') : ''}`,
        });
      } catch (err) {
        toast({
          title: 'Orchestration complete (agent dispatch warning)',
          description: `${plan.tasksCreated} tasks dispatched. Real agent execution had an issue: ${err instanceof Error ? err.message : 'unknown'}`,
        });
      }

      void fetchData();
      // scroll to orchestrator section
      const el = document.getElementById('rmb-orchestrator');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      toast({
        title: 'Orchestration failed',
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setOrchestrating(false);
    }
  }, [toast, user?.id, fetchData]);

  const askOracle = useCallback((prompt: string) => {
    window.dispatchEvent(new CustomEvent('oracle-ask', { detail: { prompt } }));
  }, []);

  if (loading) return <RmbSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <Card className="max-w-md border-white/[0.06] bg-card/60">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
            <p className="text-sm font-medium text-foreground">Couldn&apos;t load Run My Business state</p>
            <p className="mt-1 text-xs text-muted-foreground">{error || 'Unknown error'}</p>
            <Button onClick={fetchData} variant="outline" className="mt-4 border-white/10 bg-white/[0.03]">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 pb-24 sm:p-6">
      {/* ═══ HEADER ═══ */}
      <FadeIn>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl accent-gradient shadow-lg shadow-emerald-500/20">
                <Rocket className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  GSTPilot Run My Business<span className="accent-text">™</span>
                </h1>
                <p className="text-xs text-muted-foreground">
                  Ask Anything · Delegate Everything · Think · Delegate · Execute · Operate.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchData}
              disabled={refreshing}
              className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              size="sm"
              onClick={runMyBusinessToday}
              disabled={orchestrating}
              className="accent-gradient text-white hover:opacity-90"
            >
              {orchestrating ? (
                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-3.5 w-3.5" />
              )}
              {orchestrating ? 'Running...' : 'Run My Business Today'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => askOracle('Run my business today. Give me a full read on what needs to happen.')}
              className="border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-300 hover:bg-emerald-500/[0.1]"
            >
              <MessageSquare className="mr-2 h-3.5 w-3.5" />
              Ask Oracle
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Last updated {timeAgo(data.generatedAt)} · {data.clientCount} clients · {data.hasLiveData ? 'Live data' : 'Limited data — connect sources for full insights'}
        </p>
      </FadeIn>

      {/* ═══ MODULE 7: DAILY CEO BRIEF (hero) ═══ */}
      <DailyBriefCard brief={data.dailyBrief} delay={0.05} />

      {/* ═══ MODULE 1: BUSINESS COMMAND CENTER ═══ */}
      <CommandCenterModule cc={data.commandCenter} delay={0.1} />

      {/* ═══ MODULE 2: NATURAL LANGUAGE COMMANDS ═══ */}
      <CommandModule delay={0.15} />

      {/* ═══ MODULE 3: AUTOPILOT ENGINE ═══ */}
      <AutopilotModule
        autopilots={data.autopilots}
        masterOn={masterAutopilot}
        onToggleMaster={setMasterAutopilot}
        delay={0.2}
      />

      {/* ═══ MODULE 4: TASK EXECUTION ENGINE ═══ */}
      <div>
        <SectionHeader
          icon={Zap}
          title="Task Execution Engine"
          subtitle="Every task — across every agent — in one board"
          action={<Badge variant="outline" className="border-white/10 bg-white/[0.03]">{data.recentTasks.length} recent</Badge>}
        />
        <TaskBoard tasks={data.recentTasks} delay={0.25} />
      </div>

      {/* ═══ MODULE 5: BUSINESS AGENTS ═══ */}
      <AgentsModule
        agents={data.agents}
        delay={0.3}
        runningAgentId={runningAgentId}
        onRunAgent={dispatchAgent}
        onRunAll={runAllAgents}
        runAllLoading={runAllLoading}
      />

      {/* ═══ MODULE 6: ORCHESTRATOR ═══ */}
      <div id="rmb-orchestrator" className="scroll-mt-4">
        <OrchestratorModule
          plan={data.orchestrator}
          liveResult={liveOrchestration}
          delay={0.35}
          onAskOracle={() => askOracle('Walk me through today\'s orchestration plan — what was analysed, what was prioritised, and what was dispatched.')}
        />
      </div>

      {/* ═══ MODULE 8: DELEGATION ENGINE ═══ */}
      <DelegationModule delay={0.4} />

      {/* ═══ MODULE 9: MEMORY ═══ */}
      <MemoryModule memory={data.memory} delay={0.45} />

      {/* ═══ MODULE 10: PERSONALITY ═══ */}
      <PersonalityModule personality={data.personality} delay={0.5} />
    </div>
  );
}
