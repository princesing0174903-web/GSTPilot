'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import {
  FileText, Receipt, CreditCard, Landmark, Truck, ShoppingCart,
  Wallet, FolderArchive, CheckCircle2, XCircle, Clock, Eye,
  ArrowRight, TrendingUp, AlertCircle, ShieldCheck, Layers,
  GitBranch, Check, Loader2, Gauge,
} from 'lucide-react'
import { WORKFLOW_APPROVALS, fmtINR } from '@/lib/enterprise/data'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & META
// ═══════════════════════════════════════════════════════════════════════════════

type ApprovalType = 'Invoice' | 'Expense' | 'Payment' | 'GST Filing' | 'Vendor' | 'Purchase Order' | 'Salary' | 'Document'

type Approval = (typeof WORKFLOW_APPROVALS)[number]
type ApproverStatus = 'pending' | 'approved' | 'rejected' | 'in-review'

const TYPE_META: Record<
  ApprovalType,
  { icon: typeof FileText; color: string; bg: string }
> = {
  Invoice:         { icon: Receipt,         color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  Expense:         { icon: Wallet,          color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  Payment:         { icon: CreditCard,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  'GST Filing':    { icon: Landmark,       color: 'text-teal-400',    bg: 'bg-teal-500/10' },
  Vendor:          { icon: Truck,           color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  'Purchase Order':{ icon: ShoppingCart,    color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  Salary:          { icon: Wallet,          color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  Document:        { icon: FolderArchive,   color: 'text-slate-400',   bg: 'bg-slate-500/10' },
}

const PRIORITY_META: Record<Approval['priority'], { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  high:     { label: 'High',     cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  medium:   { label: 'Medium',   cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  low:      { label: 'Low',      cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
}

const APPROVER_STATUS_META: Record<
  ApproverStatus,
  { ring: string; bg: string; text: string; label: string }
> = {
  approved:   { ring: 'ring-emerald-500/60', bg: 'bg-emerald-500/15', text: 'text-emerald-300', label: 'Approved' },
  'in-review':{ ring: 'ring-amber-500/60',   bg: 'bg-amber-500/15',   text: 'text-amber-300',   label: 'In Review' },
  pending:    { ring: 'ring-slate-600/60',   bg: 'bg-slate-500/10',   text: 'text-slate-400',   label: 'Pending' },
  rejected:   { ring: 'ring-rose-500/60',    bg: 'bg-rose-500/15',    text: 'text-rose-300',    label: 'Rejected' },
}

const FILTER_TYPES: (ApprovalType | 'All')[] = [
  'All', 'Invoice', 'Expense', 'Payment', 'GST Filing',
  'Vendor', 'Purchase Order', 'Salary', 'Document',
]

// Workflow templates reference (8 workflow types)
const WORKFLOW_TEMPLATES: { type: ApprovalType; rule: string; levels: string[] }[] = [
  { type: 'Invoice',          rule: 'Invoice > ₹10L',     levels: ['Accountant', 'Finance Manager', 'CFO'] },
  { type: 'Expense',          rule: 'Expense > ₹1L',      levels: ['Department Head', 'Finance Manager'] },
  { type: 'Payment',          rule: 'Payment > ₹20L',     levels: ['Accountant', 'CFO'] },
  { type: 'GST Filing',       rule: 'Monthly GSTR-3B',    levels: ['GST Executive', 'Finance Manager'] },
  { type: 'Vendor',           rule: 'New Vendor',         levels: ['Accountant', 'Department Head', 'Finance Manager'] },
  { type: 'Purchase Order',   rule: 'PO > ₹5L',           levels: ['Accountant', 'GST Executive', 'CFO'] },
  { type: 'Salary',           rule: 'Monthly Payroll',    levels: ['HR', 'CFO'] },
  { type: 'Document',         rule: 'Board Resolution',   levels: ['Auditor', 'CFO'] },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({
  label, value, icon: Icon, accent, sub,
}: {
  label: string
  value: string | number
  icon: typeof Clock
  accent: string
  sub?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
      </div>
      <div className="mt-1.5 text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
    </motion.div>
  )
}

function ApprovalChain({ approvers, currentLevel, totalLevels }: {
  approvers: Approval['approvers']
  currentLevel: number
  totalLevels: number
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {approvers.map((a, i) => {
        const meta = APPROVER_STATUS_META[a.status]
        const isCurrent = i + 1 === currentLevel
        return (
          <div key={i} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div className="relative">
                <Avatar className={`h-9 w-9 ring-2 ${meta.ring}`}>
                  <AvatarFallback className={`text-[10px] font-semibold ${meta.bg} ${meta.text}`}>
                    {a.avatar}
                  </AvatarFallback>
                </Avatar>
                {a.status === 'approved' && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-[#0a0e14]">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                {a.status === 'in-review' && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-[#0a0e14]">
                    <Loader2 className="h-2.5 w-2.5 text-white animate-spin" />
                  </span>
                )}
                {a.status === 'rejected' && (
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 ring-2 ring-[#0a0e14]">
                    <XCircle className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                {isCurrent && a.status === 'in-review' && (
                  <motion.span
                    className="absolute -inset-1 rounded-full ring-2 ring-amber-500/40"
                    animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                )}
              </div>
              <div className="flex w-16 flex-col items-center text-center">
                <span className="truncate text-[10px] font-medium text-slate-300">{a.name.split(' ')[0]}</span>
                <span className="truncate text-[9px] text-slate-500">{a.role}</span>
                {a.actedAt && <span className="text-[9px] text-slate-600">{a.actedAt}</span>}
              </div>
            </div>
            {i < approvers.length - 1 && (
              <ArrowRight className={`mt-[-20px] h-3.5 w-3.5 shrink-0 ${
                approvers[i].status === 'approved' ? 'text-emerald-500/60' : 'text-slate-600'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ApprovalCard({
  approval,
  actionState,
  onApprove,
  onReject,
}: {
  approval: Approval
  actionState: 'idle' | 'approved' | 'rejected'
  onApprove: () => void
  onReject: () => void
}) {
  const meta = TYPE_META[approval.type]
  const Icon = meta.icon
  const p = PRIORITY_META[approval.priority]
  const amountDisplay = approval.amount > 0 ? fmtINR(approval.amount) : '—'
  const acted = actionState !== 'idle'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -2 }}
      className={`rounded-xl border bg-white/[0.02] p-4 transition-colors ${
        acted
          ? actionState === 'approved'
            ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
            : 'border-rose-500/40 bg-rose-500/[0.04]'
          : 'border-white/[0.06] hover:border-white/15'
      }`}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
            <Icon className={`h-5 w-5 ${meta.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${meta.bg} ${meta.color} border-white/10`}>
                {approval.type}
              </Badge>
              <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${p.cls}`}>
                {p.label}
              </Badge>
              {acted && (
                <Badge
                  variant="outline"
                  className={`h-5 px-1.5 text-[10px] ${
                    actionState === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {actionState === 'approved' ? (
                    <><CheckCircle2 className="mr-1 h-2.5 w-2.5" />You approved</>
                  ) : (
                    <><XCircle className="mr-1 h-2.5 w-2.5" />You rejected</>
                  )}
                </Badge>
              )}
            </div>
            <h3 className="mt-1 text-sm font-semibold leading-snug text-white">{approval.title}</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">{approval.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Amount</div>
          <div className="text-base font-bold text-white tabular-nums">{amountDisplay}</div>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Landmark className="h-3 w-3" />
          {approval.company}
        </span>
        <Separator orientation="vertical" className="h-3 bg-white/10" />
        <span className="flex items-center gap-1">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="bg-white/[0.06] text-[8px] text-slate-300">
              {approval.submittedByAvatar}
            </AvatarFallback>
          </Avatar>
          {approval.submittedBy}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {approval.submittedAt}
        </span>
      </div>

      <Separator className="my-3 bg-white/[0.06]" />

      {/* Approval chain */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
            <GitBranch className="h-3 w-3 text-cyan-400" />
            Approval Chain
          </span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-slate-300 border-white/10">
            Level {approval.currentLevel} of {approval.totalLevels}
          </Badge>
        </div>
        <ApprovalChain
          approvers={approval.approvers}
          currentLevel={approval.currentLevel}
          totalLevels={approval.totalLevels}
        />
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {acted ? (
          <div className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-slate-400">
            <ShieldCheck className={`h-3.5 w-3.5 ${actionState === 'approved' ? 'text-emerald-400' : 'text-rose-400'}`} />
            Decision recorded — workflow will continue routing automatically.
          </div>
        ) : (
          <>
            <Button
              size="sm"
              onClick={onApprove}
              className="h-8 gap-1.5 bg-emerald-500 text-xs font-medium text-white hover:bg-emerald-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onReject}
              className="h-8 gap-1.5 border-rose-500/40 text-xs font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-xs font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            >
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Button>
          </>
        )}
      </div>
    </motion.div>
  )
}

function WorkflowTemplatesCard() {
  return (
    <Card className="border-white/[0.06] bg-white/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
          <Layers className="h-4 w-4 text-cyan-400" />
          Workflow Templates
        </CardTitle>
        <p className="text-[11px] text-slate-500">8 configured multi-level approval chains</p>
      </CardHeader>
      <CardContent className="pt-1">
        <ScrollArea className="max-h-[40rem] pr-1">
          <div className="space-y-2">
            {WORKFLOW_TEMPLATES.map((tpl) => {
              const meta = TYPE_META[tpl.type]
              const Icon = meta.icon
              return (
                <div
                  key={tpl.type}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-white/15 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[12px] font-medium text-white">
                      <span className={`flex h-5 w-5 items-center justify-center rounded ${meta.bg}`}>
                        <Icon className={`h-3 w-3 ${meta.color}`} />
                      </span>
                      {tpl.type}
                    </span>
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-slate-400 border-white/10">
                      {tpl.levels.length} levels
                    </Badge>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">{tpl.rule}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {tpl.levels.map((lvl, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-300">
                          {lvl}
                        </span>
                        {i < tpl.levels.length - 1 && (
                          <ArrowRight className="h-2.5 w-2.5 text-slate-600" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function WorkflowEngine() {
  const { toast } = useToast()
  const [filter, setFilter] = useState<ApprovalType | 'All'>('All')
  const [actions, setActions] = useState<Record<string, 'idle' | 'approved' | 'rejected'>>({})

  // Compute stats from WORKFLOW_APPROVALS
  const stats = useMemo(() => {
    const pending = WORKFLOW_APPROVALS.filter((a) => a.status === 'pending').length
    const inReview = WORKFLOW_APPROVALS.filter((a) => a.status === 'in-review').length
    const approvedToday = WORKFLOW_APPROVALS.filter((a) => a.status === 'approved').length
    const rejectedToday = 1 // small sample number for "today"
    const avgApprovalTime = '4.2h'
    return { pending, inReview, approvedToday, rejectedToday, avgApprovalTime }
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'All') return WORKFLOW_APPROVALS
    return WORKFLOW_APPROVALS.filter((a) => a.type === filter)
  }, [filter])

  const handleApprove = (a: Approval) => {
    setActions((prev) => ({ ...prev, [a.id]: 'approved' }))
    toast({
      title: 'Approval recorded',
      description: `${a.type} — ${a.title} has been approved. Routing to next level.`,
    })
  }

  const handleReject = (a: Approval) => {
    setActions((prev) => ({ ...prev, [a.id]: 'rejected' }))
    toast({
      title: 'Request rejected',
      description: `${a.type} — ${a.title} has been sent back to submitter.`,
      variant: 'destructive',
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <GitBranch className="h-5 w-5 text-emerald-400" />
            Enterprise Workflow Engine™
          </h2>
          <p className="text-xs text-slate-400">Multi-level approval workflows across companies</p>
        </div>
        <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <ShieldCheck className="h-3 w-3" />
          8 active workflow templates
        </Badge>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        <StatCard label="Pending" value={stats.pending} icon={Clock} accent="text-amber-400" sub="Awaiting action" />
        <StatCard label="In Review" value={stats.inReview} icon={Loader2} accent="text-cyan-400" sub="Currently active" />
        <StatCard label="Approved Today" value={stats.approvedToday} icon={CheckCircle2} accent="text-emerald-400" sub="Last 24h" />
        <StatCard label="Rejected Today" value={stats.rejectedToday} icon={XCircle} accent="text-rose-400" sub="Sent back" />
        <StatCard label="Avg. Approval Time" value={stats.avgApprovalTime} icon={Gauge} accent="text-violet-400" sub="Across all chains" />
      </motion.div>

      {/* Main layout: queue + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Approval Queue + Filter */}
        <motion.div
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-8"
        >
          <Card className="border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-semibold text-white">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Approval Queue
                </span>
                <span className="text-[11px] font-normal text-slate-500">
                  {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Filter bar */}
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <ScrollArea className="w-full pb-1">
                  <TabsList className="flex w-max gap-1 bg-white/[0.03] p-1">
                    {FILTER_TYPES.map((t) => (
                      <TabsTrigger
                        key={t}
                        value={t}
                        className="text-[11px] data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300"
                      >
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>
              </Tabs>

              <Separator className="my-3 bg-white/[0.06]" />

              {/* Queue list */}
              <ScrollArea className="max-h-[44rem] pr-1">
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filtered.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-lg border border-dashed border-white/[0.06] p-8 text-center text-xs text-slate-500"
                      >
                        <AlertCircle className="mx-auto mb-2 h-5 w-5 opacity-40" />
                        No approvals match this filter.
                      </motion.div>
                    ) : (
                      filtered.map((a) => (
                        <ApprovalCard
                          key={a.id}
                          approval={a}
                          actionState={actions[a.id] ?? 'idle'}
                          onApprove={() => handleApprove(a)}
                          onReject={() => handleReject(a)}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sidebar: Workflow Templates */}
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-4"
        >
          <WorkflowTemplatesCard />

          {/* Legend card */}
          <Card className="mt-4 border-white/[0.06] bg-white/[0.02]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Approver Status Legend
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(APPROVER_STATUS_META).map(([key, meta]) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.bg.replace('/15', '/80')}`} />
                    <span className={`text-[11px] ${meta.text}`}>{meta.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
