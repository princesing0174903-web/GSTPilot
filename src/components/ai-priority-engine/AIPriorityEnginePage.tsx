'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import {
  Target, AlertTriangle, Clock, CheckCircle, IndianRupee, Users,
  ArrowRight, Zap, Calendar, FileText, Phone, Upload, Shield,
  TrendingUp, Activity, Sparkles, CircleDot, Bell, ArrowUpRight,
  XCircle, ListChecks, Timer, UserCheck, FileCheck, MessageSquare,
  BarChart3,
} from 'lucide-react'
import {
  useFireClients, useFireReturns, useFireInvoices,
  useFireDocuments, useFireReconciliations, useFirePriorities,
  useFireActivities,
} from '@/hooks/use-firestore'
import { useApp } from '@/contexts/AppContext'

// ─── Animation Variants ───────────────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function formatINR(n: number): string {
  const s = Math.abs(Math.round(n)).toString()
  let result = ''
  let count = 0
  for (let i = s.length - 1; i >= 0; i--) {
    result = s[i] + result
    count++
    if (count === 3 && i > 0) { result = ',' + result; count = 0 }
    else if (count > 3 && count % 2 === 1 && i > 0) { result = ',' + result }
  }
  return '₹' + (n < 0 ? '-' : '') + result
}

function formatDate(iso: string | null | unknown): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso as string)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '—' }
}

// ─── Priority Types ───────────────────────────────────────────────────────
interface ComputedPriority {
  id: string
  title: string
  description: string
  category: 'filing' | 'follow_up' | 'review' | 'upload' | 'call' | 'reconciliation' | 'payment'
  urgency: number
  revenueImpact: number
  complianceRisk: number
  clientValue: number
  priorityScore: number
  clientName: string
  clientId: string | null
  dueDate: string
  icon: React.ReactNode
}

// ─── Category Config ──────────────────────────────────────────────────────
const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  filing: { label: 'Filing', icon: <FileText className="h-3.5 w-3.5" />, color: '#10b981' },
  follow_up: { label: 'Follow Up', icon: <MessageSquare className="h-3.5 w-3.5" />, color: '#3b82f6' },
  review: { label: 'Review', icon: <Shield className="h-3.5 w-3.5" />, color: '#8b5cf6' },
  upload: { label: 'Upload', icon: <Upload className="h-3.5 w-3.5" />, color: '#f59e0b' },
  call: { label: 'Call', icon: <Phone className="h-3.5 w-3.5" />, color: '#ef4444' },
  reconciliation: { label: 'Reconciliation', icon: <BarChart3 className="h-3.5 w-3.5" />, color: '#06b6d4' },
  payment: { label: 'Payment', icon: <IndianRupee className="h-3.5 w-3.5" />, color: '#f97316' },
}

// ─── Donut Chart SVG ──────────────────────────────────────────────────────
function DonutChart({ data, size = 160 }: {
  data: Array<{ label: string; value: number; color: string }>; size?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const radius = size / 2 - 16
  const cx = size / 2
  const cy = size / 2

  // Pre-compute segments with immutable reduce
  const segments = data.reduce<Array<{ label: string; color: string; offset: number; length: number }>>((acc, d, i) => {
    const offset = i === 0 ? 0 : acc[i - 1].offset + acc[i - 1].length
    const length = (d.value / total) * 100
    acc.push({ label: d.label, color: d.color, offset, length })
    return acc
  }, [])

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
          stroke={seg.color} strokeWidth="16"
          strokeDasharray={`${seg.length} ${100 - seg.length}`}
          strokeDashoffset={-seg.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity={0.85} />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" className="text-lg font-bold fill-slate-800">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" className="text-[10px] fill-slate-500">
        priorities
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AIPriorityEnginePage() {
  const [activeTab, setActiveTab] = useState('today')
  const [queueFilter, setQueueFilter] = useState<string>('all')
  const { setCurrentView } = useApp()

  // ─── Live Firestore Data ───────────────────────────────────────────────
  const { data: clients, loading: clientsLoading } = useFireClients()
  const { data: returns, loading: returnsLoading } = useFireReturns()
  const { data: invoices, loading: invoicesLoading } = useFireInvoices()
  const { data: documents, loading: docsLoading } = useFireDocuments()
  const { data: reconciliations, loading: reconsLoading } = useFireReconciliations()
  const { data: priorities, loading: prioritiesLoading } = useFirePriorities()
  const { data: activities, loading: activitiesLoading } = useFireActivities()

  const loading = clientsLoading || returnsLoading || invoicesLoading || docsLoading || reconsLoading

  // ─── Compute Today's Priorities from Live Data ────────────────────────
  const computedPriorities = useMemo(() => {
    const result: ComputedPriority[] = []
    const now = new Date()

    // 1. File GSTR-3B/GSTR-1 for clients with pending returns and deadlines approaching
    returns.filter(r => r.status !== 'filed').forEach(r => {
      const period = r.period || ''
      const [month, year] = period.split('-').map(Number)
      let dueDate: Date | null = null
      if (month && year) {
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        dueDate = new Date(nextYear, nextMonth - 1, 20)
      }
      const daysUntilDue = dueDate ? Math.floor((dueDate.getTime() - now.getTime()) / 86400000) : 999
      const client = clients.find(c => c.clientId === r.clientId || c.id === r.clientId)
      const clientName = client?.tradeName || 'Unknown Client'

      // Urgency: based on deadline proximity
      let urgency = 1
      if (daysUntilDue < 0) urgency = 10
      else if (daysUntilDue <= 2) urgency = 9
      else if (daysUntilDue <= 5) urgency = 7
      else if (daysUntilDue <= 10) urgency = 5
      else urgency = 3

      // Revenue Impact: based on client totalTaxPaid
      const taxPaid = client?.totalTaxPaid || 0
      let revenueImpact = 3
      if (taxPaid > 500000) revenueImpact = 9
      else if (taxPaid > 200000) revenueImpact = 7
      else if (taxPaid > 50000) revenueImpact = 5

      // Compliance Risk: based on overdue returns and health score
      const overdueReturns = client?.complianceProfile?.overdueReturns || 0
      const healthScore = client?.healthScore || 50
      let complianceRisk = 3
      if (overdueReturns > 2 || healthScore < 30) complianceRisk = 9
      else if (overdueReturns > 0 || healthScore < 50) complianceRisk = 6

      // Client Value: based on totalTaxPaid and invoice count
      const invoiceCount = client?.invoiceCount || 0
      let clientValue = 3
      if (taxPaid > 500000 && invoiceCount > 20) clientValue = 9
      else if (taxPaid > 100000 || invoiceCount > 10) clientValue = 6

      const priorityScore = urgency * revenueImpact * complianceRisk * clientValue

      if (daysUntilDue <= 14 || r.status === 'draft') {
        result.push({
          id: `filing-${r.id}`,
          title: `File ${r.returnType} for ${clientName}`,
          description: `${r.returnType} for period ${period} is ${r.status}. Due ${dueDate ? formatDate(dueDate.toISOString()) : '—'}. ${r.criticalErrors > 0 ? `${r.criticalErrors} critical errors found.` : ''}`,
          category: 'filing',
          urgency, revenueImpact, complianceRisk, clientValue, priorityScore,
          clientName, clientId: r.clientId || null,
          dueDate: dueDate ? formatDate(dueDate.toISOString()) : '—',
          icon: <FileText className="h-4 w-4" />,
        })
      }
    })

    // 2. Follow up with clients that have pending docs or low health
    clients.filter(c => (c.healthScore || 0) < 70 || (c.pendingReturnCount || 0) > 1).forEach(c => {
      const health = c.healthScore || 50
      const urgency = health < 40 ? 8 : health < 60 ? 6 : 4
      const taxPaid = c.totalTaxPaid || 0
      const revenueImpact = taxPaid > 200000 ? 8 : taxPaid > 50000 ? 5 : 3
      const complianceRisk = (c.pendingReturnCount || 0) > 2 ? 8 : (c.pendingReturnCount || 0) > 0 ? 5 : 3
      const clientValue = taxPaid > 200000 ? 7 : taxPaid > 50000 ? 5 : 3
      const priorityScore = urgency * revenueImpact * complianceRisk * clientValue

      result.push({
        id: `followup-${c.id}`,
        title: `Follow up with ${c.tradeName}`,
        description: `Health: ${health}/100. ${c.pendingReturnCount || 0} pending returns. ${c.complianceProfile?.overdueReturns || 0} overdue.`,
        category: 'follow_up',
        urgency, revenueImpact, complianceRisk, clientValue, priorityScore,
        clientName: c.tradeName, clientId: c.id,
        dueDate: 'Today',
        icon: <MessageSquare className="h-4 w-4" />,
      })
    })

    // 3. Review ITC mismatches from reconciliations
    reconciliations.filter(r => r.unmatched > 0 || r.highRisk > 0).forEach(r => {
      const client = clients.find(c => c.clientId === r.clientId || c.id === r.clientId)
      const clientName = client?.tradeName || 'Unknown'

      const urgency = r.highRisk > 5 ? 8 : r.highRisk > 0 ? 6 : 4
      const revenueImpact = Math.abs(r.gstDifference || 0) > 50000 ? 8 : Math.abs(r.gstDifference || 0) > 10000 ? 5 : 3
      const complianceRisk = r.unmatched > 10 ? 9 : r.unmatched > 3 ? 6 : 3
      const clientValue = (client?.totalTaxPaid || 0) > 200000 ? 7 : 4
      const priorityScore = urgency * revenueImpact * complianceRisk * clientValue

      result.push({
        id: `recon-${r.id}`,
        title: `Review ITC mismatch for ${clientName}`,
        description: `${r.unmatched} unmatched, ${r.highRisk} high-risk entries. ITC diff: ${formatINR(Math.abs(r.gstDifference || 0))}.`,
        category: 'reconciliation',
        urgency, revenueImpact, complianceRisk, clientValue, priorityScore,
        clientName, clientId: r.clientId || null,
        dueDate: formatDate(r.createdAt),
        icon: <BarChart3 className="h-4 w-4" />,
      })
    })

    // 4. Upload missing documents
    documents.filter(d => d.status === 'uploading' || d.status === 'processing' || d.extractionStatus === 'pending').forEach(d => {
      const client = clients.find(c => c.clientId === d.clientId || c.id === d.clientId)
      const clientName = client?.tradeName || 'Unknown'

      const urgency = d.status === 'uploading' ? 7 : 5
      const revenueImpact = 4
      const complianceRisk = d.documentType === 'gstr1' || d.documentType === 'gstr3b' ? 7 : 3
      const clientValue = (client?.totalTaxPaid || 0) > 100000 ? 6 : 3
      const priorityScore = urgency * revenueImpact * complianceRisk * clientValue

      result.push({
        id: `upload-${d.id}`,
        title: `Upload missing documents for ${clientName}`,
        description: `${d.fileName} is ${d.status}. Type: ${d.documentType}. Extraction: ${d.extractionStatus}.`,
        category: 'upload',
        urgency, revenueImpact, complianceRisk, clientValue, priorityScore,
        clientName, clientId: d.clientId || null,
        dueDate: 'Today',
        icon: <Upload className="h-4 w-4" />,
      })
    })

    // 5. Call high-risk clients (healthScore < 50)
    clients.filter(c => (c.healthScore || 0) < 50).forEach(c => {
      const health = c.healthScore || 0
      const urgency = health < 30 ? 10 : 7
      const taxPaid = c.totalTaxPaid || 0
      const revenueImpact = taxPaid > 200000 ? 9 : taxPaid > 50000 ? 6 : 3
      const complianceRisk = (c.complianceProfile?.overdueReturns || 0) > 2 ? 9 : 6
      const clientValue = taxPaid > 200000 ? 8 : 5
      const priorityScore = urgency * revenueImpact * complianceRisk * clientValue

      result.push({
        id: `call-${c.id}`,
        title: `Call high-risk client ${c.tradeName}`,
        description: `Health: ${health}/100. ${c.complianceProfile?.overdueReturns || 0} overdue returns. Urgent attention needed.`,
        category: 'call',
        urgency, revenueImpact, complianceRisk, clientValue, priorityScore,
        clientName: c.tradeName, clientId: c.id,
        dueDate: 'Today',
        icon: <Phone className="h-4 w-4" />,
      })
    })

    // Sort by priority score descending
    return result.sort((a, b) => b.priorityScore - a.priorityScore)
  }, [returns, clients, invoices, documents, reconciliations])

  // ─── Upcoming Deadlines (next 7 days) ──────────────────────────────────
  const upcomingDeadlines = useMemo(() => {
    const now = new Date()
    const sevenDays = 7 * 86400000
    return returns
      .filter(r => {
        if (r.status === 'filed') return false
        const [month, year] = (r.period || '').split('-').map(Number)
        if (!month || !year) return false
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const dueDate = new Date(nextYear, nextMonth - 1, 20)
        const diff = dueDate.getTime() - now.getTime()
        return diff >= 0 && diff <= sevenDays
      })
      .map(r => {
        const [month, year] = (r.period || '').split('-').map(Number)
        const nextMonth = month === 12 ? 1 : month + 1
        const nextYear = month === 12 ? year + 1 : year
        const dueDate = new Date(nextYear, nextMonth - 1, 20)
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / 86400000)
        const client = clients.find(c => c.clientId === r.clientId || c.id === r.clientId)
        return { ...r, dueDateStr: formatDate(dueDate.toISOString()), daysUntilDue, clientName: client?.tradeName || 'Unknown' }
      })
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
  }, [returns, clients])

  // ─── Priority Distribution by Category ─────────────────────────────────
  const categoryDistribution = useMemo(() => {
    const counts: Record<string, number> = {}
    computedPriorities.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1
    })
    return Object.entries(counts).map(([cat, count]) => ({
      label: categoryConfig[cat]?.label || cat,
      value: count,
      color: categoryConfig[cat]?.color || '#94a3b8',
    }))
  }, [computedPriorities])

  // ─── Firestore Priority Queue with filters ─────────────────────────────
  const { data: filteredPriorities } = useFirePriorities(
    queueFilter !== 'all' ? queueFilter : undefined
  )

  // ─── Completed Today ───────────────────────────────────────────────────
  const completedToday = useMemo(() => {
    const today = new Date().toDateString()
    return priorities.filter(p => {
      if (p.status !== 'completed') return false
      const d = p.updatedAt ? new Date(p.updatedAt as string) : null
      return d && d.toDateString() === today
    })
  }, [priorities])

  // ─── Summary Stats ─────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const total = computedPriorities.length
    const urgent = computedPriorities.filter(p => p.urgency >= 8).length
    const highScore = computedPriorities.filter(p => p.priorityScore > 2000).length
    const avgScore = total > 0 ? Math.round(computedPriorities.reduce((s, p) => s + p.priorityScore, 0) / total) : 0
    return { total, urgent, highScore, avgScore }
  }, [computedPriorities])

  // ─── Skeleton Loader ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-28" /></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-6 w-16" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent></Card>
      </div>
    )
  }

  // ─── Empty State ───────────────────────────────────────────────────────
  const isEmpty = clients.length === 0 && invoices.length === 0 && returns.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-6">
          <Target className="h-10 w-10 text-emerald-600" />
        </motion.div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data for Priorities</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Add clients, returns, and invoices to generate AI priorities. The engine scores every task from live data.
        </p>
        <Button onClick={() => setCurrentView('clients')} className="bg-emerald-600 hover:bg-emerald-700">
          Add Clients <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    )
  }

  // ─── Score Color ───────────────────────────────────────────────────────
  function scoreColor(score: number): string {
    if (score > 3000) return '#ef4444'
    if (score > 1500) return '#f59e0b'
    if (score > 500) return '#10b981'
    return '#94a3b8'
  }

  function urgencyBadge(urgency: number): { label: string; color: string } {
    if (urgency >= 9) return { label: 'Critical', color: '#ef4444' }
    if (urgency >= 7) return { label: 'Urgent', color: '#f59e0b' }
    if (urgency >= 5) return { label: 'High', color: '#f97316' }
    if (urgency >= 3) return { label: 'Normal', color: '#10b981' }
    return { label: 'Low', color: '#94a3b8' }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="flex items-start justify-between">
        <motion.div variants={fadeUp} className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">AI Priority Engine</h1>
            <p className="text-xs text-slate-500">Today&apos;s priorities auto-generated from live data</p>
          </div>
        </motion.div>
        <motion.div variants={fadeUp} className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <Sparkles className="h-3 w-3 mr-1" /> Live
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Badge>
        </motion.div>
      </motion.div>

      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Priorities', value: summaryStats.total, icon: <ListChecks className="h-4 w-4" />, color: '#10b981' },
          { label: 'Urgent Items', value: summaryStats.urgent, icon: <AlertTriangle className="h-4 w-4" />, color: '#ef4444' },
          { label: 'High Priority', value: summaryStats.highScore, icon: <Zap className="h-4 w-4" />, color: '#f59e0b' },
          { label: 'Avg Score', value: summaryStats.avgScore, icon: <TrendingUp className="h-4 w-4" />, color: '#06b6d4' },
        ].map(stat => (
          <motion.div key={stat.label} variants={fadeUp}>
            <Card className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: stat.color + '18', color: stat.color }}>
                    {stat.icon}
                  </div>
                  <span className="text-[10px] text-slate-500">{stat.label}</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 h-9 p-0.5">
          {['today', 'queue', 'deadlines', 'completed'].map(tab => (
            <TabsTrigger key={tab} value={tab}
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Today Tab ────────────────────────────────────────────────── */}
        <TabsContent value="today" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Today's Priorities List */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-emerald-600" />
                    Today&apos;s Priorities — {computedPriorities.length} items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {computedPriorities.length > 0 ? (
                    <ScrollArea className="max-h-[520px]">
                      <div className="space-y-2">
                        {computedPriorities.slice(0, 20).map((p, idx) => {
                          const badge = urgencyBadge(p.urgency)
                          return (
                            <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                    style={{ backgroundColor: (categoryConfig[p.category]?.color || '#94a3b8') + '18', color: categoryConfig[p.category]?.color || '#94a3b8' }}>
                                    {p.icon}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-slate-800 truncate">{p.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4"
                                        style={{ borderColor: badge.color, color: badge.color }}>
                                        {badge.label}
                                      </Badge>
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 capitalize">
                                        {categoryConfig[p.category]?.label || p.category}
                                      </Badge>
                                      <span className="text-[9px] text-slate-400">Due: {p.dueDate}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold" style={{ color: scoreColor(p.priorityScore) }}>
                                    {p.priorityScore}
                                  </p>
                                  <p className="text-[9px] text-slate-400">score</p>
                                </div>
                              </div>
                              {/* Score Breakdown */}
                              <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-100">
                                {[
                                  { label: 'Urgency', value: p.urgency, max: 10 },
                                  { label: 'Revenue', value: p.revenueImpact, max: 10 },
                                  { label: 'Compliance', value: p.complianceRisk, max: 10 },
                                  { label: 'Value', value: p.clientValue, max: 10 },
                                ].map(factor => (
                                  <div key={factor.label}>
                                    <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                                      <span>{factor.label}</span><span>{factor.value}/{factor.max}</span>
                                    </div>
                                    <Progress value={(factor.value / factor.max) * 100} className="h-1" />
                                  </div>
                                ))}
                              </div>
                              {/* AI Actions */}
                              <div className="flex items-center gap-1.5 mt-2">
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                                  onClick={() => setCurrentView('returns')}>
                                  <FileText className="h-3 w-3 mr-0.5" /> Create Task
                                </Button>
                                <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                                  onClick={() => setCurrentView('clients')}>
                                  <Bell className="h-3 w-3 mr-0.5" /> Notify
                                </Button>
                                {p.category === 'filing' && (
                                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                                    onClick={() => setCurrentView('returns')}>
                                    <FileCheck className="h-3 w-3 mr-0.5" /> Generate Return
                                  </Button>
                                )}
                                {p.category === 'reconciliation' && (
                                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2"
                                    onClick={() => setCurrentView('reconcile')}>
                                    <BarChart3 className="h-3 w-3 mr-0.5" /> View Recon
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-40 flex flex-col items-center justify-center text-center">
                      <CheckCircle className="h-10 w-10 text-emerald-400 mb-2" />
                      <p className="text-sm font-semibold text-slate-700">All Clear!</p>
                      <p className="text-xs text-slate-500">No priorities generated — everything looks good.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Priority Breakdown Sidebar */}
            <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-4">
              {/* Distribution Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Priority Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryDistribution.length > 0 ? (
                    <div className="flex flex-col items-center">
                      <DonutChart data={categoryDistribution} size={150} />
                      <div className="grid grid-cols-2 gap-1.5 mt-3 w-full">
                        {categoryDistribution.map(d => (
                          <div key={d.label} className="flex items-center gap-1.5 text-[10px]">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-slate-600">{d.label} ({d.value})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-xs text-slate-400">No priorities</div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Score Formula</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">Priority Score</p>
                    <p className="text-xs font-mono font-semibold text-slate-700">
                      Urgency × Revenue × Compliance × Value
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Urgency', desc: 'Deadline proximity', color: '#ef4444' },
                      { label: 'Revenue Impact', desc: 'Client tax volume', color: '#10b981' },
                      { label: 'Compliance Risk', desc: 'Overdue returns + health', color: '#f59e0b' },
                      { label: 'Client Value', desc: 'Tax paid + invoice count', color: '#06b6d4' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[10px] font-medium text-slate-700">{item.label}</span>
                        </div>
                        <span className="text-[9px] text-slate-400">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Completed Today */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Completed Today — {completedToday.length}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {completedToday.length > 0 ? (
                    <ScrollArea className="max-h-40">
                      <div className="space-y-1.5">
                        {completedToday.map(p => (
                          <div key={p.id} className="flex items-center gap-2 p-1.5 rounded bg-emerald-50 text-[10px]">
                            <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span className="text-slate-700 truncate">{p.title}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">No items completed yet today</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* ── Queue Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="queue" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-emerald-600" />
                    Priority Queue
                  </CardTitle>
                  <div className="flex gap-1">
                    {['all', 'pending', 'in_progress', 'completed', 'dismissed'].map(f => (
                      <Button key={f} variant={queueFilter === f ? 'default' : 'outline'} size="sm"
                        className={`h-6 text-[10px] px-2 ${queueFilter === f ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                        onClick={() => setQueueFilter(f)}>
                        {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPriorities.length > 0 ? (
                  <ScrollArea className="max-h-[520px]">
                    <div className="space-y-2">
                      {filteredPriorities.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: (categoryConfig[p.category]?.color || '#94a3b8') + '18', color: categoryConfig[p.category]?.color || '#94a3b8' }}>
                              {categoryConfig[p.category]?.icon || <CircleDot className="h-3.5 w-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{p.title}</p>
                              <p className="text-[10px] text-slate-500 truncate">{p.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-sm font-bold" style={{ color: scoreColor(p.priorityScore) }}>
                                {p.priorityScore}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 capitalize"
                              style={{ borderColor: p.status === 'completed' ? '#10b981' : p.status === 'in_progress' ? '#f59e0b' : p.status === 'dismissed' ? '#94a3b8' : '#ef4444', color: p.status === 'completed' ? '#10b981' : p.status === 'in_progress' ? '#f59e0b' : p.status === 'dismissed' ? '#94a3b8' : '#ef4444' }}>
                              {p.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-center">
                    <ListChecks className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">
                      {queueFilter === 'all' ? 'No items in priority queue' : `No ${queueFilter.replace('_', ' ')} items`}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Priorities are auto-generated from live data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Deadlines Tab ─────────────────────────────────────────────── */}
        <TabsContent value="deadlines" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  Upcoming Deadlines — Next 7 Days
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingDeadlines.length > 0 ? (
                  <ScrollArea className="max-h-[520px]">
                    <div className="space-y-3">
                      {upcomingDeadlines.map(r => (
                        <div key={r.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-amber-50">
                                <Timer className="h-5 w-5 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{r.clientName}</p>
                                <p className="text-[10px] text-slate-500">{r.returnType} · Period: {r.period}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-amber-600">{r.daysUntilDue} days</p>
                              <p className="text-[10px] text-slate-500">{r.dueDateStr}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">
                                {r.status}
                              </Badge>
                              {r.criticalErrors > 0 && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-red-600 border-red-200">
                                  {r.criticalErrors} errors
                                </Badge>
                              )}
                              {r.issuesFound > 0 && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-amber-600 border-amber-200">
                                  {r.issuesFound} issues
                                </Badge>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-600"
                              onClick={() => setCurrentView('returns')}>
                              File Now <ArrowRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-center">
                    <Calendar className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No upcoming deadlines in next 7 days</p>
                    <p className="text-xs text-slate-400 mt-1">Check back when returns are approaching due dates</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Deadline Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-slate-500 mb-1">Returns Pending</p>
                <p className="text-2xl font-bold text-amber-600">
                  {returns.filter(r => r.status !== 'filed').length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-slate-500 mb-1">Overdue Returns</p>
                <p className="text-2xl font-bold text-red-600">
                  {returns.filter(r => {
                    if (r.status === 'filed') return false
                    const [m, y] = (r.period || '').split('-').map(Number)
                    if (!m || !y) return false
                    const due = new Date(y, m, 20)
                    return due < new Date()
                  }).length}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-slate-500 mb-1">Filed This Month</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {returns.filter(r => {
                    if (r.status !== 'filed' || !r.filedDate) return false
                    const d = new Date(r.filedDate)
                    const now = new Date()
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                  }).length}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Completed Tab ─────────────────────────────────────────────── */}
        <TabsContent value="completed" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Completed Priorities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedToday.length > 0 ? (
                  <ScrollArea className="max-h-[520px]">
                    <div className="space-y-2">
                      {completedToday.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                          <div className="flex items-center gap-3 min-w-0">
                            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{p.title}</p>
                              <p className="text-[10px] text-slate-500 truncate">{p.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-500">{formatDate(p.updatedAt)}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 capitalize bg-white">
                              {p.category}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-center">
                    <CheckCircle className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No completed priorities yet today</p>
                    <p className="text-xs text-slate-400 mt-1">Complete items from Today&apos;s priorities to see them here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Also show all completed from Firestore */}
          {priorities.filter(p => p.status === 'completed').length > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">All Completed (from Firestore)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {priorities.filter(p => p.status === 'completed').slice(0, 15).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span className="text-xs text-slate-700 truncate">{p.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">{formatDate(p.updatedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
