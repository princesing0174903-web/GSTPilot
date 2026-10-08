'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPILOT EXECUTION ENGINE™ — ExecutionEnginePage
// Phase 8 Step 5 — Observe. Think. Decide. Execute. Confirm. Learn.
// The flagship autonomous-operations UI. 8 tabs.
// Premium dark cinematic theme. Oracle proactive integration.
// "I don't operate VEYRO. VEYRO operates my business."
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Eye, Brain, GitBranch, Zap, CheckCircle2, Clock, AlertTriangle,
  ShieldCheck, Bot, Activity, Workflow as WorkflowIcon, GraduationCap,
  Sparkles, RefreshCw, FileCheck, TrendingUp, MessageSquare, BarChart3,
  Receipt, Users, Calendar, ArrowRight, PlayCircle,
  AlertCircle, FileText, ListChecks,
  ThumbsUp, ThumbsDown, Hourglass, Gauge, Cpu, Layers,
  ScanLine,
  UserCheck, CalendarClock, ArrowDownCircle, ArrowUpCircle,
  TrendingDown, Sparkle,
} from 'lucide-react'

// ── Pro primitives ────────────────────────────────────────────────────────────
import {
  ProButton, ProBadge, ProStatusDot, ProSkeleton,
} from '@/components/ui-pro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

// ── Engine types ──────────────────────────────────────────────────────────────
import type {
  ExecutionEngineState,
  ExecutionPipelineEntry,
  BusinessEvent,
  Decision,
  ExecutionTask,
  Approval,
  Workflow,
  ExecutionTimelineEntry,
  AIAgent,
  TimelineStage,
  BusinessEventType,
  EventSeverity,
  DecisionPriority,
  DecisionAction,
  ExecutionTaskType,
  ExecutionStatus,
  AgentName,
  ApprovalStatus,
  WorkflowType,
  WorkflowStatus,
  LearnedPattern,
  DetectedIssue,
} from '@/lib/execution/types'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — tabs, color maps, helpers
// ═══════════════════════════════════════════════════════════════════════════════

type TabKey =
  | 'overview'
  | 'observe'
  | 'decide'
  | 'execute'
  | 'approve'
  | 'workflow'
  | 'learn'
  | 'timeline'

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: Sparkles },
  { key: 'observe', label: 'Observation', icon: Eye },
  { key: 'decide', label: 'Decisions', icon: Brain },
  { key: 'execute', label: 'Execution', icon: Zap },
  { key: 'approve', label: 'Approvals', icon: ShieldCheck },
  { key: 'workflow', label: 'Workflows', icon: WorkflowIcon },
  { key: 'learn', label: 'Learning', icon: GraduationCap },
  { key: 'timeline', label: 'Timeline', icon: Activity },
]

// ── Motion variants ───────────────────────────────────────────────────────────
const containerStagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const itemReveal = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

// ── Stage color system ────────────────────────────────────────────────────────
const STAGE_COLORS: Record<TimelineStage, { text: string; bg: string; border: string; dot: string; hex: string }> = {
  observe: { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30', dot: 'bg-blue-400', hex: '#3B82F6' },
  think: { text: 'text-purple-300', bg: 'bg-purple-500/15', border: 'border-purple-500/30', dot: 'bg-purple-400', hex: '#8B5CF6' },
  decide: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30', dot: 'bg-amber-400', hex: '#F59E0B' },
  execute: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', dot: 'bg-emerald-400', hex: '#2563EB' },
  confirm: { text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', dot: 'bg-cyan-400', hex: '#3B82F6' },
  learn: { text: 'text-pink-300', bg: 'bg-pink-500/15', border: 'border-pink-500/30', dot: 'bg-pink-400', hex: '#EC4899' },
}

const STAGE_LABELS: Record<TimelineStage, string> = {
  observe: 'Observe',
  think: 'Think',
  decide: 'Decide',
  execute: 'Execute',
  confirm: 'Confirm',
  learn: 'Learn',
}

const STAGE_ORDER: TimelineStage[] = ['observe', 'think', 'decide', 'execute', 'confirm', 'learn']

// ── Stage icons (static map — avoids "create component during render" lint) ──
const STAGE_ICONS: Record<TimelineStage, React.ComponentType<{ className?: string }>> = {
  observe: Eye,
  think: Brain,
  decide: GitBranch,
  execute: Zap,
  confirm: CheckCircle2,
  learn: GraduationCap,
}

// ── Severity color system ─────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<EventSeverity, { text: string; bg: string; border: string }> = {
  critical: { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  high: { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  medium: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  low: { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  info: { text: 'text-white/60', bg: 'bg-white/5', border: 'border-white/10' },
}

// ── Priority color system ─────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<DecisionPriority, { text: string; bg: string; border: string }> = {
  urgent: { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  high: { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  medium: { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  low: { text: 'text-white/55', bg: 'bg-white/5', border: 'border-white/10' },
}

// ── Execution status color system ─────────────────────────────────────────────
const EXEC_STATUS_COLORS: Record<ExecutionStatus, { text: string; bg: string; border: string }> = {
  queued: { text: 'text-white/55', bg: 'bg-white/5', border: 'border-white/10' },
  running: { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  completed: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  failed: { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  awaiting_approval: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  cancelled: { text: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10' },
}

// ── Approval status color system ──────────────────────────────────────────────
const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, { text: string; bg: string; border: string }> = {
  pending: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  approved: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  rejected: { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
  auto_approved: { text: 'text-cyan-300', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30' },
  expired: { text: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10' },
}

// ── Workflow status color system ──────────────────────────────────────────────
const WF_STATUS_COLORS: Record<WorkflowStatus, { text: string; bg: string; border: string }> = {
  idle: { text: 'text-white/55', bg: 'bg-white/5', border: 'border-white/10' },
  running: { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  paused: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  completed: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  aborted: { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30' },
}

// ── Event type icons + labels ─────────────────────────────────────────────────
const EVENT_TYPE_META: Record<BusinessEventType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  gst_due: { label: 'GST Due', icon: CalendarClock },
  bank_transaction: { label: 'Bank Txn', icon: TrendingUp },
  receivable: { label: 'Receivable', icon: ArrowDownCircle },
  payable: { label: 'Payable', icon: ArrowUpCircle },
  payroll: { label: 'Payroll', icon: Users },
  tds: { label: 'TDS', icon: Receipt },
  client_behaviour: { label: 'Behaviour', icon: UserCheck },
  cash_flow: { label: 'Cash Flow', icon: TrendingDown },
  collection_risk: { label: 'Collection Risk', icon: AlertTriangle },
}

// ── Agent meta (icon + label) ─────────────────────────────────────────────────
const AGENT_META: Record<AgentName, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  gst_agent: { label: 'GST Agent', icon: FileCheck },
  cfo_agent: { label: 'CFO Agent', icon: TrendingUp },
  collection_agent: { label: 'Collection Agent', icon: MessageSquare },
  compliance_agent: { label: 'Compliance Agent', icon: ShieldCheck },
  reporting_agent: { label: 'Reporting Agent', icon: BarChart3 },
}

// ── Decision action labels ────────────────────────────────────────────────────
const DECISION_ACTION_LABELS: Record<DecisionAction, string> = {
  prepare_return: 'Prepare Return',
  send_reminder: 'Send Reminder',
  reconcile: 'Reconcile',
  delay_payment: 'Delay Payment',
  forecast: 'Forecast',
  escalate: 'Escalate',
  download_2b: 'Download 2B',
  run_payroll: 'Run Payroll',
  calc_tds: 'Calculate TDS',
  send_invoice: 'Send Invoice',
}

// ── Execution task type labels ────────────────────────────────────────────────
const TASK_TYPE_LABELS: Record<ExecutionTaskType, string> = {
  gst_prepare: 'GST Prepare',
  gst_json: 'GST JSON',
  download_2b: 'Download 2B',
  bank_reconcile: 'Bank Reconcile',
  send_invoice: 'Send Invoice',
  send_report: 'Send Report',
  send_whatsapp: 'WhatsApp',
  send_email: 'Email',
  send_sms: 'SMS',
  run_payroll: 'Run Payroll',
  calc_tds: 'TDS Calc',
}

// ── Workflow type meta ────────────────────────────────────────────────────────
const WORKFLOW_TYPE_META: Record<WorkflowType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  collection_recovery: { label: 'Collection Recovery', icon: MessageSquare, description: 'Multi-step client recovery: reminder → WhatsApp → legal notice → IBC Sec 9' },
  gst_filing: { label: 'GST Filing', icon: FileCheck, description: '2B download → ITC reconcile → 3B draft → JSON → portal upload' },
  cash_crisis: { label: 'Cash Crisis', icon: TrendingDown, description: 'Forecast deficit → delay payables → chase receivables → arrange credit' },
  onboarding: { label: 'Client Onboarding', icon: UserCheck, description: 'KYC → GST profile → compliance calendar → first return setup' },
  tds_filing: { label: 'TDS Filing', icon: Receipt, description: 'Section-wise calc → 26Q/24Q draft → verify → file on TRACES' },
  payroll_run: { label: 'Payroll Run', icon: Users, description: 'Timesheet → salary calc → PF/ESI/TDS/PT → payslips → bank file' },
}

// ── Risk score color (green<40, amber 40-59, red>=60) ─────────────────────────
function riskColor(score: number): { text: string; bg: string; border: string; bar: string; label: string } {
  if (score >= 60) return { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30', bar: 'bg-rose-500', label: 'High Risk' }
  if (score >= 40) return { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30', bar: 'bg-amber-500', label: 'Medium Risk' }
  return { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', bar: 'bg-emerald-500', label: 'Low Risk' }
}

// ── Indian number formatting (1,23,456 with lakh/crore grouping) ──────────────
function formatInNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

// ── IST timestamp formatters ──────────────────────────────────────────────────
function formatTimeIST(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }) + ' IST'
}

function formatDateIST(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatDateTimeIST(iso: string | null | undefined): string {
  if (!iso) return '—'
  return `${formatTimeIST(iso)} · ${formatDateIST(iso)}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Premium KPI card with icon, big number, subtitle. */
function KpiCard({
  label, value, subtitle, icon: Icon, tone = 'neutral',
}: {
  label: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'neutral' | 'bull' | 'bear' | 'accent' | 'purple' | 'amber' | 'cyan' | 'pink'
}) {
  const toneText =
    tone === 'bull' ? 'text-emerald-400'
      : tone === 'bear' ? 'text-rose-400'
        : tone === 'accent' ? 'text-[#60A5FA]'
          : tone === 'purple' ? 'text-purple-300'
            : tone === 'amber' ? 'text-amber-300'
              : tone === 'cyan' ? 'text-cyan-300'
                : tone === 'pink' ? 'text-pink-300'
                  : 'text-white'
  const iconBg =
    tone === 'bull' ? 'bg-emerald-500/15 text-emerald-300'
      : tone === 'bear' ? 'bg-rose-500/15 text-rose-300'
        : tone === 'accent' ? 'bg-[#3B82F6]/15 text-[#60A5FA]'
          : tone === 'purple' ? 'bg-purple-500/15 text-purple-300'
            : tone === 'amber' ? 'bg-amber-500/15 text-amber-300'
              : tone === 'cyan' ? 'bg-cyan-500/15 text-cyan-300'
                : tone === 'pink' ? 'bg-pink-500/15 text-pink-300'
                  : 'bg-white/5 text-white/70'
  return (
    <motion.div variants={itemReveal}>
      <div className="glass-surface rounded-2xl p-5 hover-lift border border-white/[0.06] h-full">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${toneText}`}>{value}</div>
        <div className="text-xs text-white/55 mt-0.5">{label}</div>
        {subtitle && <div className="text-[10px] text-white/40 mt-1">{subtitle}</div>}
      </div>
    </motion.div>
  )
}

/** Section heading with icon + label + optional action. */
function SectionHead({
  title, icon: Icon, action,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#60A5FA]" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {action}
    </div>
  )
}

/** Empty state placeholder. */
function EmptyState({ label, icon: Icon }: { label: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
      {Icon && <Icon className="h-5 w-5 text-white/30" />}
      <span className="text-white/40 text-sm">{label}</span>
    </div>
  )
}

/** Colored status pill — generic over any status string with a color map. */
function ColoredPill({
  status,
  colors,
  label,
}: {
  status: string
  colors: { text: string; bg: string; border: string }
  label?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      <span className="capitalize">{label ?? status}</span>
    </span>
  )
}

/** Agent badge — colored dot + label, using the agent's accent color. */
function AgentBadge({ agent }: { agent: AgentName | 'oracle' | null | undefined }) {
  if (!agent) return <span className="text-[10px] text-white/40">—</span>
  if (agent === 'oracle') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-white/[0.06] text-white/80 border-white/10">
        <Sparkle className="h-2.5 w-2.5" />
        Oracle
      </span>
    )
  }
  const meta = AGENT_META[agent]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-white/[0.06] text-white/80 border-white/10">
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}

// (stageIcon lookup replaced by STAGE_ICONS map above)

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — OVERVIEW (hero)
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({ state }: { state: ExecutionEngineState }) {
  const metrics = [
    { label: 'Events Observed', value: formatInNumber(state.observation.totalEvents), subtitle: `${state.observation.openEvents} open`, icon: Eye, tone: 'accent' as const },
    { label: 'Decisions Made', value: formatInNumber(state.decisions.total), subtitle: `${state.decisions.pending} pending`, icon: Brain, tone: 'purple' as const },
    { label: 'Tasks Executed', value: formatInNumber(state.execution.completed), subtitle: `${state.execution.successRate}% success`, icon: Zap, tone: 'bull' as const },
    { label: 'Pending Approvals', value: formatInNumber(state.approvals.pending), subtitle: `Risk cap ${state.approvals.riskThreshold}`, icon: ShieldCheck, tone: 'amber' as const },
    { label: 'Active Workflows', value: formatInNumber(state.workflows.running), subtitle: `${state.workflows.total} total`, icon: WorkflowIcon, tone: 'cyan' as const },
    { label: 'Learned Patterns', value: formatInNumber(state.learning.totalMemories), subtitle: `${state.learning.highConfidence} high-confidence`, icon: GraduationCap, tone: 'pink' as const },
  ]

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-8">
      {/* ── Metric cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </div>

      {/* ── Execution Pipeline (the cinematic centerpiece) ──────────────────── */}
      <PipelineSection pipeline={state.pipeline} />

      {/* ── AI Agents Roster ────────────────────────────────────────────────── */}
      <AgentsSection state={state} />
    </motion.div>
  )
}

function PipelineSection({ pipeline }: { pipeline: ExecutionPipelineEntry[] }) {
  return (
    <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 sm:p-6 border border-white/[0.06]">
      <SectionHead title="Execution Pipeline" icon={GitBranch} action={
        <ProBadge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
          Live
        </ProBadge>
      } />
      <p className="text-xs text-white/45 mb-5">
        Observe → Think → Decide → Execute → Confirm → Learn — the autonomous loop VEYRO runs every minute of every day.
      </p>

      {/* Horizontal flow — wraps on smaller screens */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 relative">
        {STAGE_ORDER.map((stage, idx) => {
          const entry = pipeline.find((p) => p.stage === stage)
          const colors = STAGE_COLORS[stage]
          const Icon = STAGE_ICONS[stage]
          return (
            <motion.div
              key={stage}
              variants={itemReveal}
              className="relative"
            >
              <div className={`rounded-xl p-4 border ${colors.border} ${colors.bg} h-full flex flex-col gap-2`}>
                {/* Stage label + icon */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${colors.text}`}>
                      {STAGE_LABELS[stage]}
                    </span>
                  </div>
                  <span className="text-[9px] text-white/40 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                </div>
                {/* Title */}
                {entry ? (
                  <>
                    <div className="text-xs font-semibold text-white leading-snug line-clamp-2">
                      {entry.title}
                    </div>
                    {entry.description && (
                      <div className="text-[10px] text-white/50 leading-relaxed line-clamp-2">
                        {entry.description}
                      </div>
                    )}
                    <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                      <AgentBadge agent={entry.agent} />
                      <span className="text-[9px] text-white/40 tabular-nums">{formatTimeIST(entry.timestamp)}</span>
                    </div>
                    {/* Status pulse */}
                    {entry.status === 'in_progress' && (
                      <div className="absolute top-2 right-2">
                        <ProStatusDot status="live" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center py-4">
                    <span className="text-[10px] text-white/30">No entry yet</span>
                  </div>
                )}
              </div>
              {/* Connector arrow (hidden on wrap) */}
              {idx < STAGE_ORDER.length - 1 && (
                <div className="hidden lg:flex absolute top-1/2 -right-2 -translate-y-1/2 z-10 items-center justify-center w-4 h-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                  >
                    <ArrowRight className={`h-3 w-3 ${colors.text}`} />
                  </motion.div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

function AgentsSection({ state }: { state: ExecutionEngineState }) {
  const agents = state.agents.agents
  return (
    <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 sm:p-6 border border-white/[0.06]">
      <SectionHead
        title="AI Agents Roster"
        icon={Bot}
        action={
          <div className="flex items-center gap-3 text-[10px] text-white/55">
            <span className="tabular-nums">{state.agents.activeAgents}/{state.agents.totalAgents} active</span>
            <span className="text-white/30">·</span>
            <span className="tabular-nums">{state.agents.totalTasksExecuted} lifetime tasks</span>
            <span className="text-white/30">·</span>
            <span className="tabular-nums">{state.agents.avgSuccessRate}% avg success</span>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </motion.div>
  )
}

function AgentCard({ agent }: { agent: AIAgent }) {
  const statusTone = agent.status === 'idle' ? 'warn' : 'live'
  const statusLabel =
    agent.status === 'busy' ? 'Busy'
      : agent.status === 'active' ? 'Active'
        : 'Idle'
  return (
    <motion.div
      variants={itemReveal}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3 h-full"
      style={{ borderTopColor: agent.color, borderTopWidth: 2 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${agent.color}22`, color: agent.color }}
          >
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{agent.name}</div>
            <div className="text-[10px] text-white/45 truncate">{agent.title}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-1.5">
          <ProStatusDot status={statusTone} />
          <span className={agent.status === 'idle' ? 'text-white/45' : 'text-white/70'}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-white/40">Tasks</div>
          <div className="text-sm font-semibold text-white tabular-nums">{formatInNumber(agent.tasksExecuted)}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-white/40">Success</div>
          <div className="text-sm font-semibold text-emerald-300 tabular-nums">{agent.successRate}%</div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[9px] uppercase tracking-wider text-white/40">Capabilities</div>
        {agent.capabilities.slice(0, 3).map((cap) => (
          <div key={cap} className="flex items-center gap-1.5 text-[10px] text-white/55">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400/80 shrink-0" />
            <span className="truncate">{cap}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — OBSERVATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function ObserveTab({ state }: { state: ExecutionEngineState }) {
  const obs = state.observation
  const metrics = [
    { label: 'Open Events', value: formatInNumber(obs.openEvents), icon: Eye, tone: 'accent' as const },
    { label: 'Critical', value: formatInNumber(obs.criticalEvents), icon: AlertCircle, tone: 'bear' as const },
    { label: 'High Severity', value: formatInNumber(obs.highSeverityEvents), icon: AlertTriangle, tone: 'amber' as const },
    { label: 'Detected Issues', value: formatInNumber(obs.detectedIssues.length), icon: ScanLine, tone: 'purple' as const },
  ]

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left — Events by Type */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
          <SectionHead title="Events by Type" icon={BarChart3} />
          <EventsByTypeChart byType={obs.byType} />
        </motion.div>

        {/* Right — Detected Issues */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
          <SectionHead title="Detected Issues" icon={AlertTriangle} action={
            <ProBadge className="bg-rose-500/15 text-rose-300 border border-rose-500/20">
              {obs.detectedIssues.length} flagged
            </ProBadge>
          } />
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
            {obs.detectedIssues.length === 0 ? (
              <EmptyState label="No issues detected. Business is operating normally." icon={CheckCircle2} />
            ) : (
              obs.detectedIssues.map((issue, idx) => (
                <DetectedIssueCard key={`${issue.type}-${idx}`} issue={issue} />
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent events feed */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
        <SectionHead title="Recent Events Feed" icon={Activity} action={
          <ProBadge className="bg-white/[0.06] text-white/60 border border-white/10">
            last {Math.min(obs.recentEvents.length, 10)}
          </ProBadge>
        } />
        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-1">
          {obs.recentEvents.length === 0 ? (
            <EmptyState label="No events observed yet." icon={Eye} />
          ) : (
            obs.recentEvents.slice(0, 10).map((event) => (
              <EventRow key={event.id} event={event} />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function EventsByTypeChart({ byType }: { byType: Record<BusinessEventType, number> }) {
  const entries = (Object.entries(byType) as Array<[BusinessEventType, number]>)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, n]) => n), 1)
  if (entries.length === 0) {
    return <EmptyState label="No events recorded." icon={BarChart3} />
  }
  return (
    <div className="space-y-2.5">
      {entries.map(([type, count]) => {
        const meta = EVENT_TYPE_META[type]
        const Icon = meta.icon
        const pct = (count / max) * 100
        return (
          <div key={type} className="flex items-center gap-3">
            <div className="flex items-center gap-2 w-32 shrink-0">
              <Icon className="h-3.5 w-3.5 text-[#60A5FA]" />
              <span className="text-[11px] text-white/65 truncate">{meta.label}</span>
            </div>
            <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
                className="h-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] rounded-full"
              />
            </div>
            <div className="text-[11px] font-semibold text-white tabular-nums w-8 text-right">
              {count}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DetectedIssueCard({ issue }: { issue: DetectedIssue }) {
  const colors = SEVERITY_COLORS[issue.severity]
  const meta = EVENT_TYPE_META[issue.type]
  const Icon = meta.icon
  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-3`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
          <span className="text-xs font-semibold text-white truncate">{issue.title}</span>
        </div>
        <ColoredPill status={issue.severity} colors={colors} />
      </div>
      <p className="text-[11px] text-white/55 leading-relaxed mb-2">{issue.description}</p>
      <div className="flex items-start gap-1.5">
        <Sparkle className="h-3 w-3 text-[#60A5FA] mt-0.5 shrink-0" />
        <p className="text-[11px] text-white/70 leading-relaxed">
          <span className="text-white/45">Suggested:</span> {issue.suggestedAction}
        </p>
      </div>
    </div>
  )
}

function EventRow({ event }: { event: BusinessEvent }) {
  const meta = EVENT_TYPE_META[event.type]
  const Icon = meta.icon
  const sevColors = SEVERITY_COLORS[event.severity]
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition-colors">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${sevColors.bg} ${sevColors.text}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white truncate">{meta.label}</span>
          <ColoredPill status={event.severity} colors={sevColors} />
        </div>
        <div className="text-[10px] text-white/40 mt-0.5 flex items-center gap-2">
          <span>via {event.source}</span>
          <span>·</span>
          <span className="tabular-nums">{formatTimeIST(event.createdAt)}</span>
        </div>
      </div>
      <ColoredPill status={event.status} colors={event.status === 'open' ? SEVERITY_COLORS.high : SEVERITY_COLORS.info} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — DECISION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function DecideTab({ state }: { state: ExecutionEngineState }) {
  const dec = state.decisions
  const metrics = [
    { label: 'Total Decisions', value: formatInNumber(dec.total), icon: Brain, tone: 'purple' as const },
    { label: 'Pending', value: formatInNumber(dec.pending), icon: Hourglass, tone: 'amber' as const },
    { label: 'Executed', value: formatInNumber(dec.executed), icon: CheckCircle2, tone: 'bull' as const },
    { label: 'Urgent Priority', value: formatInNumber(dec.byPriority.urgent ?? 0), icon: AlertCircle, tone: 'bear' as const },
  ]

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </div>

      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
        <SectionHead title="Decision Log" icon={Brain} action={
          <ProBadge className="bg-white/[0.06] text-white/60 border border-white/10">
            {dec.recentDecisions.length} entries
          </ProBadge>
        } />
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {dec.recentDecisions.length === 0 ? (
            <EmptyState label="No decisions made yet." icon={Brain} />
          ) : (
            dec.recentDecisions.map((decision) => (
              <DecisionRow key={decision.id} decision={decision} />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function DecisionRow({ decision }: { decision: Decision }) {
  const priColors = PRIORITY_COLORS[decision.priority]
  const actionLabel = DECISION_ACTION_LABELS[decision.action] ?? decision.action
  const statusColors = decision.status === 'executed'
    ? EXEC_STATUS_COLORS.completed
    : decision.status === 'approved'
      ? APPROVAL_STATUS_COLORS.approved
      : APPROVAL_STATUS_COLORS.pending
  return (
    <motion.div
      variants={itemReveal}
      className={`rounded-xl border ${priColors.border} ${priColors.bg} p-4 hover-lift`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ColoredPill status={decision.priority} colors={priColors} />
          <ProBadge className="bg-white/[0.06] text-white/80 border border-white/10">
            {actionLabel}
          </ProBadge>
          <ColoredPill status={decision.status} colors={statusColors} />
        </div>
        <span className="text-[10px] text-white/40 tabular-nums shrink-0">
          {formatTimeIST(decision.createdAt)}
        </span>
      </div>
      <p className="text-xs text-white/75 leading-relaxed mb-2">
        <span className="text-white/45">Reasoning:</span> {decision.reason}
      </p>
      <div className="flex items-center gap-2 text-[10px] text-white/40">
        <GitBranch className="h-3 w-3" />
        <span>Linked event: </span>
        <code className="text-white/55">{decision.eventId}</code>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — EXECUTION ENGINE (autonomous tasks)
// ═══════════════════════════════════════════════════════════════════════════════

function ExecuteTab({ state }: { state: ExecutionEngineState }) {
  const exec = state.execution
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all')

  const metrics = [
    { label: 'Total Tasks', value: formatInNumber(exec.total), icon: ListChecks, tone: 'accent' as const },
    { label: 'Completed', value: formatInNumber(exec.completed), icon: CheckCircle2, tone: 'bull' as const },
    { label: 'Running', value: formatInNumber(exec.running), icon: Activity, tone: 'cyan' as const },
    { label: 'Awaiting Approval', value: formatInNumber(exec.awaitingApproval), icon: Hourglass, tone: 'amber' as const },
    { label: 'Success Rate', value: `${exec.successRate}%`, icon: Gauge, tone: 'purple' as const },
  ]

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'all') return exec.recentTasks
    return exec.recentTasks.filter((t) => t.status === statusFilter)
  }, [exec.recentTasks, statusFilter])

  const statusOptions: Array<{ key: ExecutionStatus | 'all'; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'running', label: 'Running' },
    { key: 'queued', label: 'Queued' },
    { key: 'completed', label: 'Completed' },
    { key: 'awaiting_approval', label: 'Awaiting Approval' },
    { key: 'failed', label: 'Failed' },
  ]

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </div>

      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
        <SectionHead
          title="Autonomous Tasks"
          icon={Zap}
          action={
            <ProButton
              variant="accent"
              size="sm"
              onClick={() => {
                toast.success("I've executed today's autonomous plan", {
                  description: 'All low-risk tasks have been queued and dispatched to the appropriate agents.',
                })
              }}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Run Today's Plan
            </ProButton>
          }
        />

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto custom-scrollbar pb-px">
          {statusOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setStatusFilter(opt.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors border ${
                statusFilter === opt.key
                  ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                  : 'bg-white/[0.03] text-white/55 border-white/[0.06] hover:text-white/80 hover:bg-white/[0.06]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {filteredTasks.length === 0 ? (
            <EmptyState label={`No ${statusFilter === 'all' ? '' : statusFilter.replace('_', ' ')} tasks found.`} icon={Zap} />
          ) : (
            filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function TaskRow({ task }: { task: ExecutionTask }) {
  const statusColors = EXEC_STATUS_COLORS[task.status]
  const typeLabel = TASK_TYPE_LABELS[task.type] ?? task.type
  const risk = riskColor(task.riskScore)
  return (
    <motion.div
      variants={itemReveal}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 hover-lift"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-white leading-snug">{task.description}</div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            <ProBadge className="bg-white/[0.06] text-white/75 border border-white/10">
              {typeLabel}
            </ProBadge>
            <AgentBadge agent={task.agent} />
            <ColoredPill status={task.status} colors={statusColors} />
          </div>
        </div>
        {/* Risk score */}
        <div className={`rounded-lg ${risk.bg} ${risk.border} border px-2.5 py-1.5 shrink-0 text-center min-w-[60px]`}>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Risk</div>
          <div className={`text-sm font-bold tabular-nums ${risk.text}`}>{task.riskScore}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-[10px] text-white/40">
        <div className="flex items-center gap-3">
          {task.startedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">started {formatTimeIST(task.startedAt)}</span>
            </span>
          )}
          {task.completedAt && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span className="tabular-nums">done {formatTimeIST(task.completedAt)}</span>
            </span>
          )}
        </div>
        <span className="tabular-nums">{formatDateIST(task.createdAt)}</span>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — APPROVAL ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function ApproveTab({ state }: { state: ExecutionEngineState }) {
  const appr = state.approvals
  const metrics = [
    { label: 'Pending', value: formatInNumber(appr.pending), icon: Hourglass, tone: 'amber' as const },
    { label: 'Approved', value: formatInNumber(appr.approved), icon: ThumbsUp, tone: 'bull' as const },
    { label: 'Rejected', value: formatInNumber(appr.rejected), icon: ThumbsDown, tone: 'bear' as const },
    { label: 'Auto-Approved', value: formatInNumber(appr.autoApproved), icon: Cpu, tone: 'cyan' as const },
    { label: 'Risk Threshold', value: `${appr.riskThreshold}`, icon: Gauge, tone: 'purple' as const },
  ]

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (vars: { action: 'approve' | 'reject'; approvalId: string }) => {
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string })?.error ?? 'Approval action failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-engine'] })
    },
    onError: () => {
      // Seed-only approvals may not exist in DB — still refetch to keep UI in sync.
      queryClient.invalidateQueries({ queryKey: ['execution-engine'] })
    },
  })

  const tasksById = useMemo(() => {
    const m = new Map<string, ExecutionTask>()
    for (const t of state.execution.recentTasks) m.set(t.id, t)
    return m
  }, [state.execution.recentTasks])

  const handleAction = (approval: Approval, action: 'approve' | 'reject') => {
    const task = tasksById.get(approval.taskId)
    const taskDesc = task?.description ?? `task ${approval.taskId.slice(-6)}`
    mutation.mutate({ action, approvalId: approval.id })
    if (action === 'approve') {
      toast.success(`I've approved "${taskDesc}"`, {
        description: 'The task has been queued for autonomous execution by its assigned agent.',
      })
    } else {
      toast.error(`I've rejected "${taskDesc}"`, {
        description: 'The task has been cancelled and the originating decision has been flagged for review.',
      })
    }
  }

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </div>

      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
        <SectionHead
          title="Pending Approvals Queue"
          icon={ShieldCheck}
          action={
            <ProBadge className="bg-amber-500/15 text-amber-300 border border-amber-500/20">
              {appr.pendingApprovals.length} awaiting review
            </ProBadge>
          }
        />

        <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar pr-1">
          {appr.pendingApprovals.length === 0 ? (
            <EmptyState label="No approvals pending. VEYRO is operating autonomously." icon={CheckCircle2} />
          ) : (
            appr.pendingApprovals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                task={tasksById.get(approval.taskId)}
                onAction={handleAction}
                pending={mutation.isPending}
              />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ApprovalCard({
  approval,
  task,
  onAction,
  pending,
}: {
  approval: Approval
  task?: ExecutionTask
  onAction: (a: Approval, action: 'approve' | 'reject') => void
  pending: boolean
}) {
  const risk = riskColor(approval.risk)
  const desc = task?.description ?? `Task ${approval.taskId.slice(-6)}`
  const typeLabel = task ? (TASK_TYPE_LABELS[task.type] ?? task.type) : null
  return (
    <motion.div
      variants={itemReveal}
      className={`rounded-xl border ${risk.border} bg-white/[0.02] p-4`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-white leading-snug">{desc}</div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {typeLabel && (
              <ProBadge className="bg-white/[0.06] text-white/75 border border-white/10">
                {typeLabel}
              </ProBadge>
            )}
            {task?.agent && <AgentBadge agent={task.agent} />}
          </div>
        </div>
        <ColoredPill status={approval.status} colors={APPROVAL_STATUS_COLORS[approval.status]} />
      </div>

      {/* Risk progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-white/45">Risk Score</span>
          <span className={`font-semibold tabular-nums ${risk.text}`}>
            {approval.risk} <span className="text-white/40">/ 100</span> · {risk.label}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${approval.risk}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
            className={`h-full rounded-full ${risk.bar}`}
          />
        </div>
      </div>

      {approval.reason && (
        <p className="text-[11px] text-white/55 leading-relaxed mb-3">
          <span className="text-white/40">Reason:</span> {approval.reason}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-white/40 tabular-nums">
          Requested {formatDateTimeIST(approval.createdAt)}
        </span>
        <div className="flex items-center gap-2">
          <ProButton
            variant="glass"
            size="sm"
            disabled={pending}
            onClick={() => onAction(approval, 'reject')}
            className="!text-rose-300 hover:!bg-rose-500/15"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Reject
          </ProButton>
          <ProButton
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => onAction(approval, 'approve')}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Approve
          </ProButton>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6 — WORKFLOW ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function WorkflowTab({ state }: { state: ExecutionEngineState }) {
  const wf = state.workflows
  const metrics = [
    { label: 'Active', value: formatInNumber(wf.running), icon: Activity, tone: 'cyan' as const },
    { label: 'Completed', value: formatInNumber(wf.completed), icon: CheckCircle2, tone: 'bull' as const },
    { label: 'Paused', value: formatInNumber(wf.paused), icon: Hourglass, tone: 'amber' as const },
    { label: 'Total', value: formatInNumber(wf.total), icon: Layers, tone: 'purple' as const },
  ]

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (vars: { action: 'start' | 'advance'; type?: WorkflowType; workflowId?: string }) => {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string })?.error ?? 'Workflow action failed')
      }
      return res.json() as Promise<{ workflow: Workflow }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-engine'] })
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-engine'] })
    },
  })

  const handleStart = (type: WorkflowType) => {
    const meta = WORKFLOW_TYPE_META[type]
    mutation.mutate({ action: 'start', type })
    toast.success(`I've started the ${meta.label} workflow`, {
      description: meta.description,
    })
  }

  const handleAdvance = (workflow: Workflow) => {
    mutation.mutate({ action: 'advance', workflowId: workflow.id })
    const totalSteps = workflow.steps.length
    toast.success(`I've advanced "${workflow.name}"`, {
      description: `Step ${Math.min(workflow.currentStep + 2, totalSteps + 1)} of ${totalSteps} — ${workflow.status === 'completed' ? 'completed' : 'in progress'}.`,
    })
  }

  const templates = (Object.keys(WORKFLOW_TYPE_META) as WorkflowType[])

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </div>

      {/* Templates grid */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
        <SectionHead title="Workflow Templates" icon={WorkflowIcon} action={
          <ProBadge className="bg-white/[0.06] text-white/60 border border-white/10">
            {templates.length} templates
          </ProBadge>
        } />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((type) => {
            const meta = WORKFLOW_TYPE_META[type]
            const Icon = meta.icon
            return (
              <motion.div
                key={type}
                variants={itemReveal}
                whileHover={{ y: -2 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col gap-2 h-full"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="h-9 w-9 rounded-xl bg-[#3B82F6]/15 text-[#60A5FA] flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <ProButton
                    variant="accent"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => handleStart(type)}
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Start
                  </ProButton>
                </div>
                <div className="text-sm font-semibold text-white">{meta.label}</div>
                <p className="text-[11px] text-white/50 leading-relaxed">{meta.description}</p>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Active workflows */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
        <SectionHead title="Active Workflows" icon={Activity} action={
          <ProBadge className="bg-blue-500/15 text-blue-300 border border-blue-500/20">
            {wf.activeWorkflows.length} running
          </ProBadge>
        } />
        <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
          {wf.activeWorkflows.length === 0 ? (
            <EmptyState label="No active workflows. Start a template above to begin." icon={WorkflowIcon} />
          ) : (
            wf.activeWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onAdvance={handleAdvance}
                pending={mutation.isPending}
              />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function WorkflowCard({
  workflow,
  onAdvance,
  pending,
}: {
  workflow: Workflow
  onAdvance: (w: Workflow) => void
  pending: boolean
}) {
  const meta = WORKFLOW_TYPE_META[workflow.type]
  const Icon = meta.icon
  const statusColors = WF_STATUS_COLORS[workflow.status]
  const totalSteps = workflow.steps.length
  const currentStep = workflow.currentStep
  const pct = totalSteps > 0 ? Math.round(((currentStep + 1) / totalSteps) * 100) : 0
  const isCompleted = workflow.status === 'completed'
  return (
    <motion.div
      variants={itemReveal}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover-lift"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-xl bg-[#8B5CF6]/15 text-purple-300 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{workflow.name}</div>
            <div className="text-[10px] text-white/40 mt-0.5">
              Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps} · {workflow.trigger ?? 'manual'}
            </div>
          </div>
        </div>
        <ColoredPill status={workflow.status} colors={statusColors} />
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-white/45">Progress</span>
          <span className="text-white/70 font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
            className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]'}`}
          />
        </div>
      </div>

      {/* Current step detail */}
      {workflow.steps[currentStep] && (
        <div className="mb-3 rounded-lg bg-white/[0.03] px-3 py-2 border border-white/[0.04]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Current Step</div>
          <div className="text-[11px] text-white/80">
            <span className="font-medium">{workflow.steps[currentStep].stage}</span>
            <span className="text-white/40"> · </span>
            {workflow.steps[currentStep].action}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-white/40 tabular-nums">
          {workflow.startedAt ? `Started ${formatDateTimeIST(workflow.startedAt)}` : 'Not started'}
        </span>
        <ProButton
          variant="glass"
          size="sm"
          disabled={pending || isCompleted}
          onClick={() => onAdvance(workflow)}
        >
          <ArrowRight className="h-3.5 w-3.5" />
          {isCompleted ? 'Completed' : 'Advance'}
        </ProButton>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 7 — LEARNING ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

function LearnTab({ state }: { state: ExecutionEngineState }) {
  const lrn = state.learning
  const avgConfidence = lrn.totalMemories > 0
    ? Math.round((lrn.learnedPatterns.reduce((s, p) => s + p.confidence, 0) / Math.max(lrn.learnedPatterns.length, 1)) * 10) / 10
    : 0

  const metrics = [
    { label: 'Total Memories', value: formatInNumber(lrn.totalMemories), icon: GraduationCap, tone: 'pink' as const },
    { label: 'High Confidence', value: formatInNumber(lrn.highConfidence), icon: Sparkles, tone: 'bull' as const },
    { label: 'Avg Confidence', value: `${avgConfidence}%`, icon: Gauge, tone: 'purple' as const },
    { label: 'Top Preferences', value: formatInNumber(lrn.topPreferences.length), icon: Brain, tone: 'accent' as const },
  ]

  const sortedPatterns = useMemo(() =>
    [...lrn.learnedPatterns].sort((a, b) => b.confidence - a.confidence),
    [lrn.learnedPatterns]
  )

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((m) => (
          <KpiCard key={m.label} {...m} />
        ))}
      </div>

      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
        <SectionHead title="Learned Patterns" icon={GraduationCap} action={
          <ProBadge className="bg-pink-500/15 text-pink-300 border border-pink-500/20">
            {sortedPatterns.length} patterns · sorted by confidence
          </ProBadge>
        } />
        <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar pr-1">
          {sortedPatterns.length === 0 ? (
            <EmptyState label="No patterns learned yet. VEYRO is still observing your behaviour." icon={GraduationCap} />
          ) : (
            sortedPatterns.map((pattern, idx) => (
              <PatternCard key={`${pattern.action}-${idx}`} pattern={pattern} />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function PatternCard({ pattern }: { pattern: LearnedPattern }) {
  const confColor = pattern.confidence >= 80 ? 'text-emerald-300' : pattern.confidence >= 50 ? 'text-amber-300' : 'text-white/55'
  const barColor = pattern.confidence >= 80 ? 'bg-emerald-500' : pattern.confidence >= 50 ? 'bg-amber-500' : 'bg-white/30'
  return (
    <motion.div
      variants={itemReveal}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover-lift"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ProBadge className="bg-pink-500/15 text-pink-300 border border-pink-500/20 capitalize">
              {pattern.action.replace(/_/g, ' ')}
            </ProBadge>
            <span className="text-xs font-semibold text-white">{pattern.pattern}</span>
          </div>
        </div>
      </div>

      {/* Confidence progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-white/45">Confidence</span>
          <span className={`font-semibold tabular-nums ${confColor}`}>{pattern.confidence}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pattern.confidence}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
            className={`h-full rounded-full ${barColor}`}
          />
        </div>
      </div>

      <div className="flex items-start gap-1.5 mt-2">
        <Sparkle className="h-3 w-3 text-[#60A5FA] mt-0.5 shrink-0" />
        <p className="text-[11px] text-white/70 leading-relaxed">{pattern.insight}</p>
      </div>

      <div className="flex items-center justify-end mt-2 text-[10px] text-white/40">
        <span className="tabular-nums">{pattern.evidence} evidence observations</span>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 8 — EXECUTION TIMELINE
// ═══════════════════════════════════════════════════════════════════════════════

function TimelineTab({ state }: { state: ExecutionEngineState }) {
  const tl = state.timeline
  const entries = tl.entries

  return (
    <motion.div variants={containerStagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemReveal} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAGE_ORDER.map((stage) => {
          const colors = STAGE_COLORS[stage]
          const count = tl.byStage[stage] ?? 0
          const Icon = STAGE_ICONS[stage]
          return (
            <motion.div key={stage} variants={itemReveal}>
              <div className={`glass-surface rounded-xl p-4 border ${colors.border} h-full`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${colors.text}`}>
                    {STAGE_LABELS[stage]}
                  </span>
                </div>
                <div className="text-2xl font-semibold tabular-nums text-white">{formatInNumber(count)}</div>
                <div className="text-[10px] text-white/40 mt-0.5">entries</div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 sm:p-6 border border-white/[0.06]">
        <SectionHead
          title="Execution Timeline"
          icon={Activity}
          action={
            <div className="flex items-center gap-2">
              <ProBadge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                <ProStatusDot status="live" />
                <span className="ml-1.5">{tl.todayCount} today</span>
              </ProBadge>
            </div>
          }
        />
        <p className="text-xs text-white/45 mb-5">
          A live activity feed of everything VEYRO has done today — newest first. Every observation, decision, execution, and learning is recorded here.
        </p>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />

          <div className="space-y-3 max-h-[700px] overflow-y-auto custom-scrollbar pr-1">
            {entries.length === 0 ? (
              <EmptyState label="No timeline entries yet." icon={Activity} />
            ) : (
              entries.map((entry, idx) => (
                <TimelineRow key={entry.id ?? idx} entry={entry} />
              ))
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TimelineRow({ entry }: { entry: ExecutionTimelineEntry }) {
  const colors = STAGE_COLORS[entry.stage]
  const Icon = STAGE_ICONS[entry.stage]
  return (
    <motion.div
      variants={itemReveal}
      className="relative pl-12 pb-3"
    >
      {/* Node */}
      <div className={`absolute left-0 top-1 h-9 w-9 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${colors.text}`} />
      </div>

      <div className={`rounded-xl border ${colors.border} bg-white/[0.02] p-3 hover-lift`}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ProBadge className={`${colors.bg} ${colors.text} ${colors.border} border capitalize`}>
                {STAGE_LABELS[entry.stage]}
              </ProBadge>
              <span className="text-xs font-semibold text-white">{entry.title}</span>
            </div>
          </div>
          <span className="text-[10px] text-white/45 tabular-nums shrink-0 font-medium">
            {formatTimeIST(entry.timestamp)}
          </span>
        </div>

        {entry.description && (
          <p className="text-[11px] text-white/55 leading-relaxed mt-1.5">
            {entry.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-2">
          <AgentBadge agent={entry.agent} />
          <span className="text-[10px] text-white/40 tabular-nums">{formatDateIST(entry.timestamp)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING + ERROR STATES
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <ProSkeleton lines={1} className="h-7 w-64" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ProSkeleton key={i} lines={3} className="h-28" />
        ))}
      </div>
      <ProSkeleton lines={6} className="h-64" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <ProSkeleton key={i} lines={5} className="h-44" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass-surface rounded-2xl p-10 border border-white/[0.06] flex flex-col items-center justify-center text-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-rose-500/15 text-rose-300 flex items-center justify-center">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">Execution Engine state unavailable</h3>
        <p className="text-xs text-white/55 mt-1 max-w-md">
          I couldn&apos;t reach the VEYRO Execution Engine API. This usually clears in a moment — please retry.
        </p>
      </div>
      <ProButton variant="primary" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </ProButton>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ExecutionEnginePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const { data: state, isLoading, isError, refetch, isFetching } = useQuery<ExecutionEngineState>({
    queryKey: ['execution-engine'],
    queryFn: () => fetch('/api/execution').then((r) => {
      if (!r.ok) throw new Error('Failed to load Execution Engine state')
      return r.json() as Promise<ExecutionEngineState>
    }),
    staleTime: 30 * 1000,
  })

  const handleSync = useCallback(() => {
    refetch()
    toast.success('Execution Engine synced', {
      description: 'I\'ve refreshed the live state across all 8 modules.',
    })
  }, [refetch])

  return (
    <div className="min-h-screen bg-black">
      {/* ── Sticky glass header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 glass-surface border-b border-white/[0.06]">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl glass-surface-strong border border-white/[0.08] flex items-center justify-center">
              <Cpu className="h-5 w-5 text-[#60A5FA]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate flex items-center gap-2">
                VEYRO Execution Engine
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-white/40 border border-white/10 rounded-full px-2 py-0.5">
                  Phase 8 · Step 5
                </span>
              </h1>
              <p className="text-[11px] text-white/55 truncate">
                Observe. Think. Decide. Execute. Confirm. Learn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live status */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <ProStatusDot status="live" />
              <span className="text-[10px] font-medium text-emerald-300">Live</span>
            </div>

            <ProButton variant="glass" size="sm" onClick={handleSync} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </ProButton>
          </div>
        </div>

        {/* ── Tabs bar (scrollable on mobile) ───────────────────────────────── */}
        <div className="px-4 sm:px-6 overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-1 min-w-max pb-px">
            {TABS.map((t) => {
              const isActive = activeTab === t.key
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors rounded-t-lg whitespace-nowrap ${
                    isActive
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="execution-engine-tab-underline"
                      className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#3B82F6] rounded-full"
                      transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
          >
            {isLoading ? (
              <LoadingSkeleton />
            ) : isError || !state ? (
              <ErrorState onRetry={() => refetch()} />
            ) : activeTab === 'overview' ? (
              <OverviewTab state={state} />
            ) : activeTab === 'observe' ? (
              <ObserveTab state={state} />
            ) : activeTab === 'decide' ? (
              <DecideTab state={state} />
            ) : activeTab === 'execute' ? (
              <ExecuteTab state={state} />
            ) : activeTab === 'approve' ? (
              <ApproveTab state={state} />
            ) : activeTab === 'workflow' ? (
              <WorkflowTab state={state} />
            ) : activeTab === 'learn' ? (
              <LearnTab state={state} />
            ) : activeTab === 'timeline' ? (
              <TimelineTab state={state} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
