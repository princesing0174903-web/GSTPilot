'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { PremiumPageLoader } from '@/components/ui/premium-loading'
import { motion } from 'framer-motion'
import {
  FileText,
  ShieldCheck,
  FileScan,
  GitCompareArrows,
  HeartHandshake,
  Landmark,
  TrendingUp,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  Bot,
  Sparkles,
  Brain,
  Gauge,
  Pause,
  Timer,
  ArrowRight,
  Target,
  History,
  Power,
  Calendar,
  FastForward,
} from 'lucide-react'
import {
  useFireClients,
  useFireReturns,
  useFireInvoices,
  useFireReconciliations,
  useFireTasks,
  useFireLeads,
  useFireDeals,
  useFireActivities,
  useFireFirm,
  useFireDocuments,
} from '@/hooks/use-firestore'
import { useAuth } from '@/contexts/AuthContext'
import { apiPost } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { fetchWithTimeout } from '@/lib/async'

// ─── Types ──────────────────────────────────────────────────────────────────────

type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'
type AgentId = 'filing-manager' | 'compliance-officer' | 'invoice-processor' | 'reconciliation-expert' | 'client-relationship' | 'finance-manager' | 'growth-manager'

interface AgentRunResult {
  summary: string
  tasks?: Array<{ title: string; clientId?: string; priority: string; dueDate?: string; description: string }>
  recommendations?: string[]
  risks?: Array<{ client: string; risk: string }>
  [key: string]: unknown
}

interface AgentRunRecord {
  id: string
  agentId: AgentId
  status: 'completed' | 'failed'
  startedAt: string
  completedAt: string
  duration: number
  result: AgentRunResult | null
  error: string | null
}

interface AgentConfig {
  id: AgentId
  name: string
  title: string
  description: string
  icon: React.ElementType
  colorClass: string
  colorBg: string
  colorBorder: string
  colorText: string
  colorGlow: string
  gradientFrom: string
  gradientTo: string
  runSteps: string[]
  scheduleDefault: 'daily' | 'weekly' | 'monthly'
}

// ─── Agent Configs ──────────────────────────────────────────────────────────────

const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'filing-manager',
    name: 'Filing Manager',
    title: 'AI Filing Manager',
    description: 'Manages all GST return filings, deadlines, and filing priorities across the firm',
    icon: FileText,
    colorClass: 'emerald',
    colorBg: 'bg-emerald-500/10',
    colorBorder: 'border-emerald-500/25',
    colorText: 'text-emerald-600 dark:text-emerald-400',
    colorGlow: 'shadow-emerald-500/20',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-emerald-600',
    runSteps: ['Scanning pending returns', 'Checking due dates', 'Calculating late fees', 'Prioritizing filings', 'Generating tasks', 'Complete'],
    scheduleDefault: 'daily',
  },
  {
    id: 'compliance-officer',
    name: 'Compliance Officer',
    title: 'AI Compliance Officer',
    description: 'Monitors compliance status, GSTIN validity, and filing patterns across all clients',
    icon: ShieldCheck,
    colorClass: 'amber',
    colorBg: 'bg-amber-500/10',
    colorBorder: 'border-amber-500/25',
    colorText: 'text-amber-600 dark:text-amber-400',
    colorGlow: 'shadow-amber-500/20',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-amber-600',
    runSteps: ['Auditing client compliance', 'Checking GSTIN validity', 'Scoring compliance profiles', 'Flagging violations', 'Generating alerts', 'Complete'],
    scheduleDefault: 'daily',
  },
  {
    id: 'invoice-processor',
    name: 'Invoice Processor',
    title: 'AI Invoice Processor',
    description: 'Validates invoices, checks tax calculations, and flags risky transactions automatically',
    icon: FileScan,
    colorClass: 'sky',
    colorBg: 'bg-sky-500/10',
    colorBorder: 'border-sky-500/25',
    colorText: 'text-sky-600 dark:text-sky-400',
    colorGlow: 'shadow-sky-500/20',
    gradientFrom: 'from-sky-500',
    gradientTo: 'to-sky-600',
    runSteps: ['Loading invoices', 'Validating GSTINs', 'Checking tax math', 'Risk scoring', 'Classification check', 'Complete'],
    scheduleDefault: 'daily',
  },
  {
    id: 'reconciliation-expert',
    name: 'Reconciliation Expert',
    title: 'AI Reconciliation Expert',
    description: 'Analyzes ITC mismatches, reconciles GSTR-2B with purchase registers, optimizes ITC claims',
    icon: GitCompareArrows,
    colorClass: 'violet',
    colorBg: 'bg-violet-500/10',
    colorBorder: 'border-violet-500/25',
    colorText: 'text-violet-600 dark:text-violet-400',
    colorGlow: 'shadow-violet-500/20',
    gradientFrom: 'from-violet-500',
    gradientTo: 'to-violet-600',
    runSteps: ['Loading reconciliation data', 'Computing match rates', 'Identifying mismatches', 'ITC impact analysis', 'Resolution suggestions', 'Complete'],
    scheduleDefault: 'weekly',
  },
  {
    id: 'client-relationship',
    name: 'Client Relationship',
    title: 'AI Client Relationship Manager',
    description: 'Monitors client health, predicts churn, and manages personalized follow-ups',
    icon: HeartHandshake,
    colorClass: 'rose',
    colorBg: 'bg-rose-500/10',
    colorBorder: 'border-rose-500/25',
    colorText: 'text-rose-600 dark:text-rose-400',
    colorGlow: 'shadow-rose-500/20',
    gradientFrom: 'from-rose-500',
    gradientTo: 'to-rose-600',
    runSteps: ['Scoring client health', 'Detecting churn signals', 'Checking engagement', 'Generating follow-ups', 'Upsell analysis', 'Complete'],
    scheduleDefault: 'weekly',
  },
  {
    id: 'finance-manager',
    name: 'Finance Manager',
    title: 'AI Finance Manager',
    description: 'Tracks revenue, cash collection, outstanding payments, and forecasts financial performance',
    icon: Landmark,
    colorClass: 'teal',
    colorBg: 'bg-teal-500/10',
    colorBorder: 'border-teal-500/25',
    colorText: 'text-teal-600 dark:text-teal-400',
    colorGlow: 'shadow-teal-500/20',
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-teal-600',
    runSteps: ['Computing revenue metrics', 'Aging receivables', 'Cash flow analysis', 'Revenue forecast', 'Collection strategy', 'Complete'],
    scheduleDefault: 'weekly',
  },
  {
    id: 'growth-manager',
    name: 'Growth Manager',
    title: 'AI Growth Manager',
    description: 'Manages the sales pipeline, scores leads, tracks deals, and identifies growth opportunities',
    icon: TrendingUp,
    colorClass: 'orange',
    colorBg: 'bg-orange-500/10',
    colorBorder: 'border-orange-500/25',
    colorText: 'text-orange-600 dark:text-orange-400',
    colorGlow: 'shadow-orange-500/20',
    gradientFrom: 'from-orange-500',
    gradientTo: 'to-orange-600',
    runSteps: ['Analyzing pipeline', 'Scoring leads', 'Reviewing deals', 'Conversion forecast', 'Growth strategies', 'Complete'],
    scheduleDefault: 'weekly',
  },
]

// ─── PT-1-b: Real-agent dispatch map ───────────────────────────────────────────
// Maps the 7 AgentsPage agent IDs to the 5 real RMB agents that write REAL
// DB rows via /api/rmb/run-agent. Lives at module scope so the useCallback
// dependency array stays stable.
const REAL_AGENT_MAP: Record<AgentId, 'collections' | 'compliance' | 'finance' | 'reporting' | 'gst'> = {
  'filing-manager': 'gst',
  'compliance-officer': 'compliance',
  'invoice-processor': 'gst',
  'reconciliation-expert': 'gst',
  'client-relationship': 'collections',
  'finance-manager': 'finance',
  'growth-manager': 'reporting',
}

// ─── Utility ────────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toLocaleString('en-IN')}`
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function AIWorkforcePage() {
  const { user } = useAuth()
  const { toast } = useToast()

  // Live Firestore data
  const clients = useFireClients()
  const returns = useFireReturns()
  const invoices = useFireInvoices()
  const reconciliations = useFireReconciliations()
  const tasks = useFireTasks()
  const leads = useFireLeads()
  const deals = useFireDeals()
  const activities = useFireActivities()
  const firm = useFireFirm()
  const documents = useFireDocuments()

  const isLoading = clients.loading || returns.loading || invoices.loading

  // Agent states
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentId, AgentStatus>>(() => {
    const s: Record<AgentId, AgentStatus> = {} as Record<AgentId, AgentStatus>
    AGENT_CONFIGS.forEach(a => { s[a.id] = 'idle' })
    return s
  })
  const [agentRunProgress, setAgentRunProgress] = useState<Record<AgentId, number>>(() => {
    const s: Record<AgentId, number> = {} as Record<AgentId, number>
    AGENT_CONFIGS.forEach(a => { s[a.id] = 0 })
    return s
  })
  const [agentRunStep, setAgentRunStep] = useState<Record<AgentId, string>>(() => {
    const s: Record<AgentId, string> = {} as Record<AgentId, string>
    AGENT_CONFIGS.forEach(a => { s[a.id] = '' })
    return s
  })
  const [agentResults, setAgentResults] = useState<Record<AgentId, AgentRunResult | null>>(() => {
    const s: Record<AgentId, AgentRunResult | null> = {} as Record<AgentId, AgentRunResult | null>
    AGENT_CONFIGS.forEach(a => { s[a.id] = null })
    return s
  })
  const [agentRunHistory, setAgentRunHistory] = useState<Record<AgentId, AgentRunRecord[]>>(() => {
    const s: Record<AgentId, AgentRunRecord[]> = {} as Record<AgentId, AgentRunRecord[]>
    AGENT_CONFIGS.forEach(a => { s[a.id] = [] })
    return s
  })
  const [agentLastActivity, setAgentLastActivity] = useState<Record<AgentId, string | null>>(() => {
    const s: Record<AgentId, string | null> = {} as Record<AgentId, string | null>
    AGENT_CONFIGS.forEach(a => { s[a.id] = null })
    return s
  })

  // UI state
  const [selectedAgent, setSelectedAgent] = useState<AgentId | null>(null)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [scheduleAgentId, setScheduleAgentId] = useState<AgentId | null>(null)
  const [scheduleFrequency, setScheduleFrequency] = useState<string>('daily')
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'history' | 'memory'>('overview')
  const [runAllLoading, setRunAllLoading] = useState(false)

  // ─── Computed Agent Metrics from Live Data ────────────────────────────────────

  const agentMetrics = useMemo(() => {
    const activeClients = clients.data.filter(c => c.status === 'active')
    const pendingReturns = returns.data.filter(r => !['filed', 'acknowledged'].includes(r.status))
    const filedReturns = returns.data.filter(r => r.status === 'filed' || r.status === 'acknowledged')
    const overdueReturns = returns.data.filter(r => r.status === 'overdue')
    const totalInvoices = invoices.data
    const flaggedInvoices = invoices.data.filter(i => i.riskLevel === 'high' || i.riskLevel === 'critical')
    const pendingRecons = reconciliations.data.filter(r => r.status !== 'completed')
    const completedRecons = reconciliations.data.filter(r => r.status === 'completed')
    const openTasks = tasks.data.filter(t => t.status !== 'completed')
    const completedTasks = tasks.data.filter(t => t.status === 'completed')
    const activeLeads = leads.data.filter(l => !['converted', 'lost'].includes(l.status))
    const activeDeals = deals.data.filter(d => !['closed_won', 'closed_lost'].includes(d.stage))
    const totalRevenue = invoices.data.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
    const totalTaxVolume = activeClients.reduce((sum, c) => sum + (c.totalTaxPaid || 0), 0)
    const avgHealthScore = activeClients.length > 0
      ? activeClients.reduce((sum, c) => sum + (c.healthScore || 0), 0) / activeClients.length
      : 0
    const clientAtRisk = activeClients.filter(c => (c.healthScore || 0) < 60)
    const pendingDocs = documents.data.filter(d => d.status === 'processing' || d.extractionStatus === 'pending')
    const matchRate = completedRecons.length > 0
      ? completedRecons.reduce((sum, r) => sum + (r.totalRecords > 0 ? (r.matched / r.totalRecords) * 100 : 100), 0) / completedRecons.length
      : 100

    // Per-agent metrics derived from live data
    return {
      'filing-manager': {
        tasksCompleted: filedReturns.length,
        tasksPending: pendingReturns.length,
        successRate: filedReturns.length > 0 || pendingReturns.length > 0
          ? Math.round((filedReturns.length / (filedReturns.length + overdueReturns.length)) * 100 || 95)
          : 95,
        timeSaved: filedReturns.length * 25, // ~25 min saved per filing
        quickStats: [
          { label: 'Pending Filings', value: `${pendingReturns.length}` },
          { label: 'Overdue', value: `${overdueReturns.length}` },
          { label: 'Filed This Month', value: `${filedReturns.length}` },
        ],
      },
      'compliance-officer': {
        tasksCompleted: activeClients.filter(c => (c.complianceProfile?.filingCompliance || 0) > 80).length,
        tasksPending: activeClients.filter(c => (c.complianceProfile?.filingCompliance || 0) < 80).length,
        successRate: activeClients.length > 0
          ? Math.round(activeClients.reduce((s, c) => s + (c.complianceProfile?.filingCompliance || 0), 0) / activeClients.length)
          : 95,
        timeSaved: activeClients.length * 15, // ~15 min per compliance check
        quickStats: [
          { label: 'Avg Compliance', value: `${activeClients.length > 0 ? Math.round(activeClients.reduce((s, c) => s + (c.complianceProfile?.filingCompliance || 0), 0) / activeClients.length) : 0}%` },
          { label: 'At Risk', value: `${clientAtRisk.length}` },
          { label: 'Overdue Returns', value: `${overdueReturns.length}` },
        ],
      },
      'invoice-processor': {
        tasksCompleted: totalInvoices.length - flaggedInvoices.length,
        tasksPending: flaggedInvoices.length + pendingDocs.length,
        successRate: totalInvoices.length > 0
          ? Math.round(((totalInvoices.length - flaggedInvoices.length) / totalInvoices.length) * 100)
          : 97,
        timeSaved: totalInvoices.length * 5, // ~5 min per invoice
        quickStats: [
          { label: 'Total Invoices', value: `${totalInvoices.length}` },
          { label: 'Flagged', value: `${flaggedInvoices.length}` },
          { label: 'Processing', value: `${pendingDocs.length}` },
        ],
      },
      'reconciliation-expert': {
        tasksCompleted: completedRecons.length,
        tasksPending: pendingRecons.length,
        successRate: completedRecons.length > 0 ? Math.round(matchRate) : 94,
        timeSaved: completedRecons.length * 45, // ~45 min per reconciliation
        quickStats: [
          { label: 'Match Rate', value: `${Math.round(matchRate)}%` },
          { label: 'Pending', value: `${pendingRecons.length}` },
          { label: 'ITC at Risk', value: formatINR(completedRecons.reduce((s, r) => s + (r.gstDifference || 0), 0)) },
        ],
      },
      'client-relationship': {
        tasksCompleted: activeClients.length - clientAtRisk.length,
        tasksPending: clientAtRisk.length,
        successRate: activeClients.length > 0
          ? Math.round(avgHealthScore)
          : 90,
        timeSaved: activeClients.length * 10, // ~10 min per client check
        quickStats: [
          { label: 'Avg Health', value: `${Math.round(avgHealthScore)}` },
          { label: 'At Risk', value: `${clientAtRisk.length}` },
          { label: 'Active', value: `${activeClients.length}` },
        ],
      },
      'finance-manager': {
        tasksCompleted: invoices.data.filter(i => i.status === 'paid' || i.matchStatus === 'matched').length,
        tasksPending: invoices.data.filter(i => i.status !== 'paid' && i.matchStatus !== 'matched').length,
        successRate: totalRevenue > 0 ? 88 : 90,
        timeSaved: Math.round(totalRevenue / 100000) * 10,
        quickStats: [
          { label: 'Revenue', value: formatINR(totalRevenue) },
          { label: 'Tax Volume', value: formatINR(totalTaxVolume) },
          { label: 'Outstanding', value: formatINR(invoices.data.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0)) },
        ],
      },
      'growth-manager': {
        tasksCompleted: leads.data.filter(l => l.status === 'converted').length + deals.data.filter(d => d.stage === 'closed_won').length,
        tasksPending: activeLeads.length + activeDeals.length,
        successRate: deals.data.length > 0
          ? Math.round((deals.data.filter(d => d.stage === 'closed_won').length / deals.data.length) * 100 || 75)
          : 75,
        timeSaved: activeLeads.length * 20,
        quickStats: [
          { label: 'Pipeline', value: formatINR(activeDeals.reduce((s, d) => s + (d.value || 0), 0)) },
          { label: 'Active Leads', value: `${activeLeads.length}` },
          { label: 'Open Deals', value: `${activeDeals.length}` },
        ],
      },
    }
  }, [clients.data, returns.data, invoices.data, reconciliations.data, tasks.data, leads.data, deals.data, documents.data])

  // ─── Aggregate Stats ────────────────────────────────────────────────────────

  const aggregateStats = useMemo(() => {
    const totalTasksCompleted = Object.values(agentMetrics).reduce((s, m) => s + m.tasksCompleted, 0)
    const totalTimeSaved = Object.values(agentMetrics).reduce((s, m) => s + m.timeSaved, 0)
    const avgSuccessRate = Object.values(agentMetrics).reduce((s, m) => s + m.successRate, 0) / AGENT_CONFIGS.length
    const activeAgents = Object.values(agentStatuses).filter(s => s === 'running').length
    const totalRuns = Object.values(agentRunHistory).reduce((s, h) => s + h.length, 0)
    return { totalTasksCompleted, totalTimeSaved, avgSuccessRate, activeAgents, totalRuns }
  }, [agentMetrics, agentStatuses, agentRunHistory])

  // ─── Run Agent ──────────────────────────────────────────────────────────────

  // PT-1-b: Every Run button dispatches a REAL DB write via /api/rmb/run-agent
  // alongside the existing LLM analysis. The mapping is at module scope
  // (REAL_AGENT_MAP above). This creates real Notification / AITask / AuditLog
  // / AIPrediction / ExecutiveReport / Issue rows so every Run has a real
  // effect on the database — not just an LLM summary.

  const runAgent = useCallback(async (agentId: AgentId) => {
    const config = AGENT_CONFIGS.find(a => a.id === agentId)
    if (!config) return

    // Single-flight: prevent double-clicks from re-entering runAgent while
    // the same agent is already running.
    if (agentStatuses[agentId] === 'running') return

    setAgentStatuses(prev => ({ ...prev, [agentId]: 'running' }))
    setAgentRunProgress(prev => ({ ...prev, [agentId]: 0 }))

    // Track the idle-reset timer so it can be cancelled on unmount.
    agentIdleTimersRef.current[agentId] = undefined
    const startTime = Date.now()

    try {
      // Simulate progress through steps
      const steps = config.runSteps
      for (let i = 0; i < steps.length; i++) {
        setAgentRunStep(prev => ({ ...prev, [agentId]: steps[i] }))
        setAgentRunProgress(prev => ({ ...prev, [agentId]: Math.round(((i + 1) / steps.length) * 90) }))
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400))
      }

      // Prepare firm data for the AI
      const firmData = {
        clients: clients.data.slice(0, 50).map(c => ({
          id: c.clientId, tradeName: c.tradeName, gstin: c.gstin,
          status: c.status, healthScore: c.healthScore,
          complianceScore: c.complianceProfile?.filingCompliance,
          overdueReturns: c.complianceProfile?.overdueReturns,
          pendingReturnCount: c.pendingReturnCount, totalTaxPaid: c.totalTaxPaid,
        })),
        returns: returns.data.slice(0, 50).map(r => ({
          id: r.returnId, clientId: r.clientId, returnType: r.returnType,
          period: r.period, status: r.status, totalTax: r.totalTax,
          issuesFound: r.issuesFound, criticalErrors: r.criticalErrors,
        })),
        invoices: invoices.data.slice(0, 50).map(i => ({
          id: i.invoiceId, invoiceNumber: i.invoiceNumber,
          sellerGstin: i.sellerGstin, totalAmount: i.totalAmount,
          riskLevel: i.riskLevel, matchStatus: i.matchStatus, status: i.status,
        })),
        reconciliations: reconciliations.data.slice(0, 20).map(r => ({
          id: r.reconId, clientId: r.clientId, period: r.period,
          status: r.status, matched: r.matched, totalRecords: r.totalRecords,
          unmatched: r.unmatched, gstDifference: r.gstDifference,
        })),
        tasks: tasks.data.slice(0, 30).map(t => ({
          id: t.taskId, title: t.title, priority: t.priority,
          status: t.status, dueDate: t.dueDate,
        })),
        leads: leads.data.slice(0, 20).map(l => ({
          id: l.leadId, contactName: l.contactName, company: l.company,
          status: l.status, leadScore: l.leadScore, estimatedValue: l.estimatedValue,
        })),
        deals: deals.data.slice(0, 20).map(d => ({
          id: d.dealId, title: d.title, value: d.value,
          stage: d.stage, probability: d.probability,
        })),
        firm: firm.data ? {
          name: firm.data.firmName,
          activeClientCount: firm.data.activeClientCount,
          complianceScore: firm.data.complianceScore,
          totalTaxVolume: firm.data.totalTaxVolume,
        } : null,
      }

      try {
        const res = await fetchWithTimeout('/api/agents/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            firmData,
            firmName: firm.data?.firmName || user?.firmName || 'CA Firm',
          }),
          timeoutMs: 60_000, // LLM call — give it up to a minute.
        })

        const data = await res.json()
        const duration = Math.round((Date.now() - startTime) / 1000)

        if (data.success) {
          const result = data.result as AgentRunResult
          setAgentResults(prev => ({ ...prev, [agentId]: result }))
          setAgentStatuses(prev => ({ ...prev, [agentId]: 'completed' }))
          setAgentRunProgress(prev => ({ ...prev, [agentId]: 100 }))
          setAgentLastActivity(prev => ({ ...prev, [agentId]: new Date().toISOString() }))

          // Add to run history
          const record: AgentRunRecord = {
            id: `run-${Date.now()}`,
            agentId,
            status: 'completed',
            startedAt: new Date(startTime).toISOString(),
            completedAt: new Date().toISOString(),
            duration,
            result,
            error: null,
          }
          setAgentRunHistory(prev => ({
            ...prev,
            [agentId]: [record, ...(prev[agentId] || [])].slice(0, 20),
          }))
        } else {
          throw new Error(data.error || 'Agent run failed')
        }
      } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000)
        setAgentStatuses(prev => ({ ...prev, [agentId]: 'error' }))
        setAgentRunProgress(prev => ({ ...prev, [agentId]: 0 }))

        const record: AgentRunRecord = {
          id: `run-${Date.now()}`,
          agentId,
          status: 'failed',
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          duration,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
        setAgentRunHistory(prev => ({
          ...prev,
          [agentId]: [record, ...(prev[agentId] || [])].slice(0, 20),
        }))
      }

      // PT-1-b: Dispatch REAL DB-writing agent run alongside the LLM analysis.
      // This is what creates Notification / AITask / AuditLog / AIPrediction /
      // ExecutiveReport / Issue rows so every "Run" button has a real effect
      // on the database — not just an LLM summary.
      try {
        const realAgentKey = REAL_AGENT_MAP[agentId]
        const realResult = await apiPost<{
          success: boolean
          summary: string
          metrics?: Record<string, number | string>
          error?: string
        }>('/api/rmb/run-agent', { agent: realAgentKey, userId: user?.id })
        if (realResult.success) {
          toast({
            title: `${config.name} → real DB writes`,
            description: realResult.summary,
          })
        } else {
          toast({
            title: `${config.name} → real DB writes failed`,
            description: realResult.error ?? 'Unknown error',
            variant: 'destructive',
          })
        }
      } catch (e) {
        // Don't fail the whole Run button — LLM analysis already succeeded
        toast({
          title: `${config.name} → real DB writes failed`,
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    } finally {
      // Always schedule the idle reset — even on error / abort / unmount-during-run.
      // Tracked so a useEffect cleanup can cancel it if the component unmounts.
      const timer = setTimeout(() => {
        setAgentStatuses(prev => ({ ...prev, [agentId]: 'idle' }))
        delete agentIdleTimersRef.current[agentId]
      }, 2000)
      agentIdleTimersRef.current[agentId] = timer
    }
  }, [clients.data, returns.data, invoices.data, reconciliations.data, tasks.data, leads.data, deals.data, firm.data, user, toast, agentStatuses])

  // Track idle-reset timers per agent so they can be cleared on unmount.
  const agentIdleTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({})
  useEffect(() => {
    const timers = agentIdleTimersRef.current
    return () => {
      // Cancel any pending idle-reset timers so they don't fire setState on a dead component.
      for (const id of Object.keys(timers)) {
        const t = timers[id]
        if (t) clearTimeout(t)
      }
    }
  }, [])

  // ─── Run All Agents ─────────────────────────────────────────────────────────

  const runAllAgents = useCallback(async () => {
    if (runAllLoading) return // single-flight
    setRunAllLoading(true)
    try {
      for (const config of AGENT_CONFIGS) {
        await runAgent(config.id)
        await new Promise(r => setTimeout(r, 500))
      }
    } finally {
      setRunAllLoading(false)
    }
  }, [runAgent, runAllLoading])

  // ─── Pause Agent ────────────────────────────────────────────────────────────

  const pauseAgent = useCallback((agentId: AgentId) => {
    setAgentStatuses(prev => ({ ...prev, [agentId]: 'paused' }))
  }, [])

  // ─── Agent Detail Panel ────────────────────────────────────────────────────

  const selectedConfig = AGENT_CONFIGS.find(a => a.id === selectedAgent)
  const selectedMetrics = selectedAgent ? agentMetrics[selectedAgent] : null
  const selectedHistory = selectedAgent ? agentRunHistory[selectedAgent] : []
  const selectedResult = selectedAgent ? agentResults[selectedAgent] : null

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <PremiumPageLoader label="Loading AI Workforce…" />
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">AI Workforce</h1>
              <p className="text-xs text-muted-foreground">7 autonomous AI employees managing your firm</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowScheduleDialog(true) }}
            className="gap-1.5 text-xs"
          >
            <Calendar className="h-3.5 w-3.5" />
            Schedule
          </Button>
          <Button
            size="sm"
            onClick={runAllAgents}
            disabled={runAllLoading || Object.values(agentStatuses).some(s => s === 'running')}
            className="gap-1.5 text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-500/20"
          >
            {runAllLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FastForward className="h-3.5 w-3.5" />
            )}
            Run All Agents
          </Button>
        </div>
      </div>

      {/* ─── Aggregate Stats Bar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Agents', value: `${aggregateStats.activeAgents}/${AGENT_CONFIGS.length}`, icon: Power, color: 'text-emerald-500' },
          { label: 'Tasks Completed', value: `${aggregateStats.totalTasksCompleted}`, icon: CheckCircle2, color: 'text-sky-500' },
          { label: 'Avg Success Rate', value: `${Math.round(aggregateStats.avgSuccessRate)}%`, icon: Target, color: 'text-amber-500' },
          { label: 'Time Saved', value: `${Math.round(aggregateStats.totalTimeSaved / 60)}h`, icon: Timer, color: 'text-violet-500' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50">
                <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── Main Content Tabs ──────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <Gauge className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-xs gap-1.5">
            <Bot className="h-3.5 w-3.5" /> Agents
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1.5">
            <History className="h-3.5 w-3.5" /> Run History
          </TabsTrigger>
          <TabsTrigger value="memory" className="text-xs gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Memory
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Agent Grid - Overview Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {AGENT_CONFIGS.map((config) => {
              const metrics = agentMetrics[config.id]
              const status = agentStatuses[config.id]
              const progress = agentRunProgress[config.id]
              const step = agentRunStep[config.id]
              const lastActivity = agentLastActivity[config.id]
              const isRunning = status === 'running'

              return (
                <motion.div
                  key={config.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className={`border shadow-sm hover:shadow-md transition-all cursor-pointer ${config.colorBorder} ${isRunning ? `ring-2 ring-${config.colorClass}-500/30` : ''}`}
                    onClick={() => setSelectedAgent(config.id)}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Agent header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.colorBg}`}>
                            <config.icon className={`h-4.5 w-4.5 ${config.colorText}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{config.name}</p>
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                isRunning ? 'bg-emerald-500 animate-pulse' :
                                status === 'paused' ? 'bg-amber-500' :
                                status === 'error' ? 'bg-red-500' :
                                'bg-slate-400'
                              }`} />
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {isRunning ? 'Running' : status === 'paused' ? 'Paused' : status === 'error' ? 'Error' : 'Idle'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 ${config.colorBg} hover:${config.colorBg}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (isRunning) { pauseAgent(config.id) } else { runAgent(config.id) }
                          }}
                          disabled={isRunning}
                        >
                          {isRunning ? (
                            <Pause className={`h-3.5 w-3.5 ${config.colorText}`} />
                          ) : (
                            <Play className={`h-3.5 w-3.5 ${config.colorText}`} />
                          )}
                        </Button>
                      </div>

                      {/* Progress bar when running */}
                      {isRunning && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">{step}</span>
                            <span className="text-[10px] font-medium text-muted-foreground">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      )}

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-1.5">
                        {metrics.quickStats.slice(0, 3).map((stat) => (
                          <div key={stat.label} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
                            <p className="text-xs font-semibold text-foreground">{stat.value}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Bottom stats row */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {metrics.tasksCompleted} done
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {metrics.successRate}%
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(lastActivity)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {/* Live Activity Feed */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Live Activity Feed
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                  Realtime
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="max-h-64">
                {activities.data.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No recent activity. Run an agent to get started.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activities.data.slice(0, 15).map((activity) => {
                      const agentConfig = AGENT_CONFIGS.find(a =>
                        activity.description?.toLowerCase().includes(a.name.toLowerCase())
                      )
                      return (
                        <div key={activity.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${agentConfig ? agentConfig.colorBg : 'bg-muted/50'}`}>
                            {agentConfig ? (
                              <agentConfig.icon className={`h-3 w-3 ${agentConfig.colorText}`} />
                            ) : (
                              <Activity className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate">{activity.title}</p>
                            {activity.description && (
                              <p className="text-[10px] text-muted-foreground truncate">{activity.description}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground/60 shrink-0">
                            {timeAgo(activity.createdAt as string)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Agents Tab (Detailed View) ────────────────────────────────── */}
        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {AGENT_CONFIGS.map((config) => {
              const metrics = agentMetrics[config.id]
              const status = agentStatuses[config.id]
              const progress = agentRunProgress[config.id]
              const step = agentRunStep[config.id]
              const lastActivity = agentLastActivity[config.id]
              const result = agentResults[config.id]
              const isRunning = status === 'running'
              const history = agentRunHistory[config.id] || []

              return (
                <motion.div
                  key={config.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className={`border shadow-sm ${config.colorBorder} ${isRunning ? `ring-2 ring-${config.colorClass}-500/30` : ''}`}>
                    <CardHeader className="pb-3 px-5 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} shadow-md ${config.colorGlow}`}>
                            <config.icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">{config.title}</CardTitle>
                            <CardDescription className="text-[10px]">{config.description}</CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] capitalize ${
                          isRunning ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                          status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' :
                          status === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400' :
                          'bg-muted/50 text-muted-foreground'
                        }`}>
                          {isRunning ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : isRunning ? null : (
                            <span className={`h-1.5 w-1.5 rounded-full mr-1 ${
                              status === 'paused' ? 'bg-amber-500' :
                              status === 'error' ? 'bg-red-500' :
                              'bg-slate-400'
                            }`} />
                          )}
                          {isRunning ? 'Running' : status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-4 space-y-4">
                      {/* Progress when running */}
                      {isRunning && (
                        <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                              {step}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <p className="text-base font-bold text-foreground">{metrics.tasksCompleted}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Completed</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <p className="text-base font-bold text-foreground">{metrics.successRate}%</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Success</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <p className="text-base font-bold text-foreground">{Math.round(metrics.timeSaved / 60)}h</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Saved</p>
                        </div>
                      </div>

                      {/* Quick Stats Row */}
                      <div className="flex items-center gap-2">
                        {metrics.quickStats.map((stat) => (
                          <div key={stat.label} className="flex-1 rounded-md bg-muted/30 px-2 py-1.5 text-center">
                            <p className="text-xs font-semibold">{stat.value}</p>
                            <p className="text-[8px] text-muted-foreground">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Last Activity + Run History Summary */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last: {timeAgo(lastActivity)}
                        </span>
                        <span className="flex items-center gap-1">
                          <History className="h-3 w-3" />
                          {history.length} runs
                        </span>
                        {history.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            Avg: {formatDuration(Math.round(history.reduce((s, r) => s + r.duration, 0) / history.length))}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => runAgent(config.id)}
                          disabled={isRunning}
                          className={`flex-1 gap-1.5 text-xs bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} text-white shadow-sm hover:opacity-90`}
                        >
                          {isRunning ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          {isRunning ? 'Running...' : 'Run Now'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => isRunning ? pauseAgent(config.id) : null}
                          disabled={!isRunning}
                          className="gap-1.5 text-xs"
                        >
                          <Pause className="h-3.5 w-3.5" />
                          Pause
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setScheduleAgentId(config.id)
                            setScheduleFrequency(config.scheduleDefault)
                            setShowScheduleDialog(true)
                          }}
                          className="gap-1.5 text-xs"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Schedule
                        </Button>
                      </div>

                      {/* AI Result Summary */}
                      {result && (
                        <div className={`rounded-lg ${config.colorBg} border ${config.colorBorder} p-3 space-y-2`}>
                          <div className="flex items-center gap-1.5">
                            <Sparkles className={`h-3.5 w-3.5 ${config.colorText}`} />
                            <span className={`text-xs font-semibold ${config.colorText}`}>AI Analysis</span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">
                            {result.summary || 'Analysis complete. View details for more information.'}
                          </p>
                          {result.recommendations && result.recommendations.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium text-muted-foreground">Top Recommendations:</p>
                              {result.recommendations.slice(0, 2).map((rec, i) => (
                                <p key={i} className="text-[10px] text-foreground/70 flex items-start gap-1">
                                  <ArrowRight className={`h-3 w-3 ${config.colorText} shrink-0 mt-0.5`} />
                                  {rec}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </TabsContent>

        {/* ─── Run History Tab ───────────────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 px-5 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-emerald-500" />
                Agent Run History
              </CardTitle>
              <CardDescription className="text-[10px]">
                Complete history of all agent executions with results and durations
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <ScrollArea className="max-h-[500px]">
                {Object.values(agentRunHistory).every(h => h.length === 0) ? (
                  <div className="text-center py-12">
                    <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No agent runs yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Run an agent to see its execution history here</p>
                    <Button
                      size="sm"
                      onClick={runAllAgents}
                      className="mt-4 gap-1.5 text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                    >
                      <FastForward className="h-3.5 w-3.5" />
                      Run All Agents
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {AGENT_CONFIGS.map(config => {
                      const history = agentRunHistory[config.id]
                      if (!history || history.length === 0) return null
                      return (
                        <div key={config.id} className="space-y-1.5">
                          <div className="flex items-center gap-2 py-1">
                            <config.icon className={`h-4 w-4 ${config.colorText}`} />
                            <span className="text-xs font-semibold text-foreground">{config.name}</span>
                            <Badge variant="secondary" className="text-[9px]">{history.length} runs</Badge>
                          </div>
                          {history.map((run) => (
                            <div key={run.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                                run.status === 'completed' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                              }`}>
                                {run.status === 'completed' ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">
                                  {run.result?.summary?.slice(0, 80) || run.error || 'Run completed'}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(run.startedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                    <Timer className="h-2.5 w-2.5" />
                                    {formatDuration(run.duration)}
                                  </span>
                                </div>
                              </div>
                              <Badge variant="outline" className={`text-[9px] ${
                                run.status === 'completed' ? 'text-emerald-600 border-emerald-200' : 'text-red-600 border-red-200'
                              }`}>
                                {run.status}
                              </Badge>
                            </div>
                          ))}
                          <Separator className="my-2" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Memory Tab ────────────────────────────────────────────────── */}
        <TabsContent value="memory" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {AGENT_CONFIGS.map(config => {
              const metrics = agentMetrics[config.id]
              const result = agentResults[config.id]
              const history = agentRunHistory[config.id] || []
              const successRuns = history.filter(r => r.status === 'completed')
              const failedRuns = history.filter(r => r.status === 'failed')

              // Build memory insights from live data and run results (plain function, not a hook)
              const memoryInsights = (() => {
                const insights: Array<{ text: string; confidence: number; source: string }> = []

                // Data-driven insights based on agent type
                if (config.id === 'filing-manager') {
                  const overdue = returns.data.filter(r => r.status === 'overdue')
                  if (overdue.length > 0) insights.push({ text: `${overdue.length} returns are overdue — late fees accumulating at ₹200/day`, confidence: 95, source: 'Returns analysis' })
                  const pending = returns.data.filter(r => !['filed', 'acknowledged'].includes(r.status))
                  if (pending.length > 0) insights.push({ text: `${pending.length} returns pending filing — prioritize by deadline proximity`, confidence: 90, source: 'Deadline scan' })
                }
                if (config.id === 'compliance-officer') {
                  const lowComp = clients.data.filter(c => (c.complianceProfile?.filingCompliance || 0) < 60)
                  if (lowComp.length > 0) insights.push({ text: `${lowComp.length} clients below 60% compliance — schedule intervention calls`, confidence: 92, source: 'Compliance audit' })
                }
                if (config.id === 'invoice-processor') {
                  const flagged = invoices.data.filter(i => i.riskLevel === 'high' || i.riskLevel === 'critical')
                  if (flagged.length > 0) insights.push({ text: `${flagged.length} high-risk invoices need manual review`, confidence: 88, source: 'Risk scoring' })
                }
                if (config.id === 'reconciliation-expert') {
                  const unmatched = reconciliations.data.filter(r => r.unmatched > 0)
                  if (unmatched.length > 0) insights.push({ text: `${unmatched.length} reconciliations have unmatched entries — potential ITC loss`, confidence: 91, source: 'Reconciliation scan' })
                }
                if (config.id === 'client-relationship') {
                  const atRisk = clients.data.filter(c => (c.healthScore || 0) < 50)
                  if (atRisk.length > 0) insights.push({ text: `${atRisk.length} clients have health score below 50 — churn risk`, confidence: 85, source: 'Health monitoring' })
                }
                if (config.id === 'finance-manager') {
                  const outstanding = invoices.data.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0)
                  if (outstanding > 0) insights.push({ text: `${formatINR(outstanding)} in outstanding payments — follow up recommended`, confidence: 90, source: 'Revenue tracking' })
                }
                if (config.id === 'growth-manager') {
                  const hotLeads = leads.data.filter(l => l.leadScore > 70)
                  if (hotLeads.length > 0) insights.push({ text: `${hotLeads.length} hot leads (score >70) need immediate outreach`, confidence: 87, source: 'Pipeline analysis' })
                }

                // Add insights from last AI result
                if (result?.recommendations) {
                  result.recommendations.slice(0, 2).forEach((rec, i) => {
                    insights.push({ text: rec, confidence: 80 + i * 5, source: 'AI Analysis' })
                  })
                }

                // Default insight if none generated
                if (insights.length === 0) {
                  insights.push({ text: `No insights yet. Run ${config.name} to generate memory.`, confidence: 0, source: 'System' })
                }

                return insights
              })()

              return (
                <Card key={config.id} className={`border shadow-sm ${config.colorBorder}`}>
                  <CardHeader className="pb-3 px-4 pt-4">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config.colorBg}`}>
                        <config.icon className={`h-4 w-4 ${config.colorText}`} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{config.name} Memory</CardTitle>
                        <CardDescription className="text-[10px]">
                          {successRuns.length} runs · {failedRuns.length} failures · {memoryInsights.length} insights
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {/* Learning Metrics */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <p className="text-xs font-semibold">{metrics.successRate}%</p>
                        <p className="text-[8px] text-muted-foreground">Accuracy</p>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <p className="text-xs font-semibold">{Math.round(metrics.timeSaved / 60)}h</p>
                        <p className="text-[8px] text-muted-foreground">Time Saved</p>
                      </div>
                    </div>

                    {/* Insights */}
                    <div className="space-y-1.5">
                      {memoryInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-muted/20">
                          <Brain className={`h-3.5 w-3.5 mt-0.5 ${config.colorText} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-foreground leading-relaxed">{insight.text}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-muted-foreground/60">{insight.source}</span>
                              {insight.confidence > 0 && (
                                <span className="text-[9px] text-muted-foreground/40">{insight.confidence}% confidence</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Agent Detail Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!selectedAgent} onOpenChange={(open) => { if (!open) setSelectedAgent(null) }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedConfig && selectedMetrics && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${selectedConfig.gradientFrom} ${selectedConfig.gradientTo} shadow-md ${selectedConfig.colorGlow}`}>
                    <selectedConfig.icon className="h-5.5 w-5.5 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">{selectedConfig.title}</DialogTitle>
                    <DialogDescription className="text-xs">{selectedConfig.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs capitalize ${
                    agentStatuses[selectedConfig.id] === 'running' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    agentStatuses[selectedConfig.id] === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    agentStatuses[selectedConfig.id] === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-muted/50 text-muted-foreground'
                  }`}>
                    {agentStatuses[selectedConfig.id] === 'running' && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    {agentStatuses[selectedConfig.id]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Last activity: {timeAgo(agentLastActivity[selectedConfig.id])}
                  </span>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Completed', value: selectedMetrics.tasksCompleted },
                    { label: 'Success Rate', value: `${selectedMetrics.successRate}%` },
                    { label: 'Time Saved', value: `${Math.round(selectedMetrics.timeSaved / 60)}h` },
                    { label: 'Total Runs', value: selectedHistory.length },
                  ].map(m => (
                    <div key={m.label} className="rounded-lg bg-muted/30 p-3 text-center">
                      <p className="text-lg font-bold">{m.value}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* AI Result */}
                {selectedResult && (
                  <div className={`rounded-lg ${selectedConfig.colorBg} border ${selectedConfig.colorBorder} p-4 space-y-3`}>
                    <div className="flex items-center gap-2">
                      <Sparkles className={`h-4 w-4 ${selectedConfig.colorText}`} />
                      <span className={`text-sm font-semibold ${selectedConfig.colorText}`}>AI Analysis Result</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {selectedResult.summary}
                    </p>
                    {selectedResult.recommendations && selectedResult.recommendations.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">Recommendations:</p>
                        {selectedResult.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <ArrowRight className={`h-3.5 w-3.5 ${selectedConfig.colorText} shrink-0 mt-0.5`} />
                            <p className="text-xs text-foreground/70">{rec}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedResult.tasks && selectedResult.tasks.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground">Generated Tasks:</p>
                        {selectedResult.tasks.slice(0, 5).map((task, i) => (
                          <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-background/50">
                            <Badge variant="outline" className="text-[9px]">{task.priority}</Badge>
                            <span className="text-xs text-foreground/70">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Run History */}
                {selectedHistory.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Recent Runs
                    </p>
                    {selectedHistory.slice(0, 5).map(run => (
                      <div key={run.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30">
                        {run.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate">
                            {run.result?.summary?.slice(0, 60) || run.error || 'Completed'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            {' · '}{formatDuration(run.duration)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAgent(selectedConfig.id)}
                  disabled={agentStatuses[selectedConfig.id] === 'running'}
                  className="gap-1.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run Again
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setScheduleAgentId(selectedConfig.id)
                    setScheduleFrequency(selectedConfig.scheduleDefault)
                    setShowScheduleDialog(true)
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Schedule
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Schedule Dialog ────────────────────────────────────────────── */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Schedule Agent
            </DialogTitle>
            <DialogDescription>
              Set up automated scheduling for {scheduleAgentId ? AGENT_CONFIGS.find(a => a.id === scheduleAgentId)?.name : 'agent'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Frequency</label>
              <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every Day</SelectItem>
                  <SelectItem value="weekly">Every Week</SelectItem>
                  <SelectItem value="monthly">Every Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Time of Day</label>
              <Select defaultValue="09:00">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="06:00">6:00 AM</SelectItem>
                  <SelectItem value="09:00">9:00 AM</SelectItem>
                  <SelectItem value="12:00">12:00 PM</SelectItem>
                  <SelectItem value="15:00">3:00 PM</SelectItem>
                  <SelectItem value="18:00">6:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scheduleFrequency === 'weekly' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Day of Week</label>
                <Select defaultValue="monday">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="tuesday">Tuesday</SelectItem>
                    <SelectItem value="wednesday">Wednesday</SelectItem>
                    <SelectItem value="thursday">Thursday</SelectItem>
                    <SelectItem value="friday">Friday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
              <div>
                <p className="text-xs font-medium">Enable Auto-Run</p>
                <p className="text-[10px] text-muted-foreground">Agent will run automatically on schedule</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowScheduleDialog(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowScheduleDialog(false);
                toast({
                  title: 'Scheduling coming soon',
                  description: 'Auto-scheduling is on the roadmap. Your agent is ready to run on demand.',
                });
              }}
              className="text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
