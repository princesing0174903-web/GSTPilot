'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import AICEOSections from '@/components/ceo/AICEOSections'
import {
  Crown, TrendingUp, TrendingDown, Users, Zap,
  Activity, BarChart3, Target, ArrowUpRight, ArrowDownRight,
  Radio, CheckCircle, Clock, Building, FileText,
  AlertTriangle, Brain, Eye, Play, MessageSquare,
  FileCheck, RefreshCw, Calendar, Mail, ListChecks,
  Gauge, ShieldAlert, UserX, Wallet, ChevronRight,
} from 'lucide-react'
import {
  useFireClients, useFireReturns, useFireInvoices,
  useFireReconciliations, useFireActivities, useFireAIRecommendations,
  useFireNotifications, useFireFirm, useFirmExecutiveScores,
  useFirePredictions, useFirePriorities,
} from '@/hooks/use-firestore'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'

// ── Helpers ──
const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN')

const fmtDate = (d: string | null | unknown) => {
  if (!d) return '—'
  try {
    const dt = new Date(d as string)
    if (isNaN(dt.getTime())) return '—'
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '—' }
}

const pct = (n: number, decimals = 1) => n.toFixed(decimals) + '%'

// ── Animation ──
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
}

const stagger = {
  initial: { opacity: 0, y: 12 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.3 },
  }),
}

// ── SVG Sparkline ──
function Sparkline({ data, color = '#10b981', w = 120, h = 32 }: {
  data: number[]; color?: string; w?: number; h?: number
}) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── SVG Gauge ──
function ScoreGauge({ value, size = 72, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 8) / 2
  const c = Math.PI * 2 * r
  const pctVal = Math.max(0, Math.min(100, value))
  const fill = (pctVal / 100) * c
  const color = pctVal > 70 ? '#10b981' : pctVal > 40 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c}
          animate={{ strokeDashoffset: c - fill }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <text
          x={size / 2} y={size / 2}
          textAnchor="middle" dominantBaseline="central"
          className="fill-slate-700 text-xs font-bold"
          transform={`rotate(90, ${size / 2}, ${size / 2})`}
        >
          {Math.round(pctVal)}
        </text>
      </svg>
      {label && <span className="text-[10px] text-slate-500 font-medium text-center">{label}</span>}
    </div>
  )
}

// ── Skeleton Grid ──
function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

// ── Empty State ──
function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <motion.div {...fadeUp} className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-600 mb-1">{title}</p>
      <p className="text-xs text-slate-400 max-w-xs">{desc}</p>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FirmCommandCenterPage() {
  const { setCurrentView } = useApp()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')

  // ── Live Firestore Data ──
  const { data: clients, loading: clientsLoading } = useFireClients()
  const { data: invoices, loading: invoicesLoading } = useFireInvoices()
  const { data: returns, loading: returnsLoading } = useFireReturns()
  const { data: reconciliations, loading: reconLoading } = useFireReconciliations()
  const { data: activities, loading: activitiesLoading } = useFireActivities()
  const { data: recommendations, loading: recsLoading } = useFireAIRecommendations()
  const { data: notifications, loading: notifsLoading } = useFireNotifications()
  const { data: firm, loading: firmLoading } = useFireFirm()
  const { scores, loading: scoresLoading } = useFirmExecutiveScores()
  const { data: predictions, loading: predsLoading } = useFirePredictions()
  const { data: priorities, loading: priosLoading } = useFirePriorities()

  const isLoading = clientsLoading || invoicesLoading || returnsLoading || activitiesLoading

  // ── Computed Metrics ──
  const metrics = useMemo(() => {
    const totalRevenue = invoices.reduce((s, i) => s + (i.totalTax || 0) + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0)
    const clientsAtRisk = clients.filter(c => (c.healthScore || 0) < 60)
    const pendingReturns = returns.filter(r => r.status !== 'filed')

    // Revenue last 6 months
    const now = new Date()
    const monthlyRevenue: number[] = []
    const monthLabels: string[] = []
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const rev = invoices
        .filter(i => i.period === key || (i.invoiceDate && i.invoiceDate.startsWith(key)))
        .reduce((s, i) => s + (i.totalTax || 0) + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0)
      monthlyRevenue.push(rev)
      monthLabels.push(d.toLocaleDateString('en-IN', { month: 'short' }))
    }

    // Trend (simple linear)
    const firstHalf = monthlyRevenue.slice(0, 3).reduce((s, v) => s + v, 0) / 3
    const secondHalf = monthlyRevenue.slice(3).reduce((s, v) => s + v, 0) / 3
    const growthRate = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0

    // Revenue forecast: project next month based on trend
    const revenueForecast = secondHalf > 0 ? secondHalf * (1 + growthRate / 100) : totalRevenue / 6

    // Staff utilization from activities
    const teamMemberActivity: Record<string, number> = {}
    activities.forEach(a => {
      const uid = a.userId || 'unknown'
      teamMemberActivity[uid] = (teamMemberActivity[uid] || 0) + 1
    })
    const maxActivity = Math.max(...Object.values(teamMemberActivity), 1)
    const avgUtilization = Object.keys(teamMemberActivity).length > 0
      ? Object.values(teamMemberActivity).reduce((s, v) => s + (v / maxActivity) * 100, 0) / Object.keys(teamMemberActivity).length
      : 0

    // Profit forecast: revenue minus estimated costs (70% cost ratio)
    const profitForecast = totalRevenue * 0.30

    // Cash collection prediction from reconciliation match rate
    const totalMatched = reconciliations.reduce((s, r) => s + (r.matched || 0), 0)
    const totalRecords = reconciliations.reduce((s, r) => s + (r.totalRecords || 0), 0)
    const matchRate = totalRecords > 0 ? (totalMatched / totalRecords) * 100 : 0
    const cashCollectionPrediction = totalRevenue * (matchRate / 100)

    // Filing delays prediction
    const overdueReturns = returns.filter(r => r.status !== 'filed' && r.period)
    const filingDelayPrediction = overdueReturns.length

    // Client health breakdown
    const healthyClients = clients.filter(c => (c.healthScore || 0) >= 75)
    const atRiskClients = clients.filter(c => (c.healthScore || 0) >= 40 && (c.healthScore || 0) < 75)
    const criticalClients = clients.filter(c => (c.healthScore || 0) < 40)

    return {
      totalRevenue,
      revenueForecast,
      clientsAtRisk: clientsAtRisk.length,
      pendingReturns: pendingReturns.length,
      staffUtilization: avgUtilization,
      profitForecast,
      cashCollectionPrediction,
      filingDelayPrediction,
      monthlyRevenue,
      monthLabels,
      growthRate,
      healthyClients: healthyClients.length,
      atRiskClients: atRiskClients.length,
      criticalClients: criticalClients.length,
      totalClients: clients.length,
      matchRate,
      teamMemberActivity,
      overdueReturns,
    }
  }, [clients, invoices, returns, reconciliations, activities])

  // ── AI CEO Questions ──
  const aiQuestions = useMemo(() => [
    {
      question: 'Run My Firm',
      icon: Play,
      answer: 'Launch autonomous firm operations',
      action: () => setCurrentView('autopilot'),
      actionLabel: 'Launch',
      color: 'emerald',
    },
    {
      question: 'Where are my bottlenecks?',
      icon: ShieldAlert,
      answer: `${metrics.pendingReturns} pending returns, ${metrics.filingDelayPrediction} overdue filings, ${metrics.clientsAtRisk} at-risk clients`,
      action: () => setCurrentView('returns'),
      actionLabel: 'View Returns',
      color: 'amber',
    },
    {
      question: 'Which clients may leave?',
      icon: UserX,
      answer: clients.filter(c => (c.healthScore || 0) < 60).slice(0, 3).map(c => c.tradeName).join(', ') || 'No at-risk clients',
      action: () => setCurrentView('clients'),
      actionLabel: 'View Clients',
      color: 'red',
    },
    {
      question: 'Who is overloaded?',
      icon: Activity,
      answer: Object.entries(metrics.teamMemberActivity).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([uid, count]) => `${uid}: ${count} tasks`).join(', ') || 'No activity data',
      action: () => setCurrentView('team'),
      actionLabel: 'View Team',
      color: 'slate',
    },
    {
      question: 'What will my revenue be next month?',
      icon: TrendingUp,
      answer: `Projected: ${fmtINR(Math.round(metrics.revenueForecast))} (${metrics.growthRate >= 0 ? '+' : ''}${pct(metrics.growthRate)} trend)`,
      action: () => setActiveTab('revenue'),
      actionLabel: 'Revenue Details',
      color: 'emerald',
    },
    {
      question: 'What should I prioritize today?',
      icon: ListChecks,
      answer: priorities.length > 0 ? `${priorities.length} items in queue — top: "${priorities[0]?.title || '—'}"` : 'No priorities queued',
      action: () => setCurrentView('tasks'),
      actionLabel: 'View Tasks',
      color: 'slate',
    },
  ], [metrics, clients, priorities, setCurrentView])

  // ── Action Handlers ──
  const handleAction = (action: string) => {
    switch (action) {
      case 'task': setCurrentView('tasks'); break
      case 'notify': break // marks notification
      case 'return': setCurrentView('return-prep'); break
      case 'reconcile': setCurrentView('reconcile'); break
      case 'automate': setCurrentView('automations'); break
      case 'email': break // placeholder
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── AI CEO Engine™ Sections (additive — autonomous decision engine) ── */}
      <AICEOSections />

      {/* ── Header ── */}
      <motion.div {...fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-600/20">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">AI CEO</h1>
            <p className="text-xs text-slate-500">Firm&apos;s autonomous operating brain</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
            <Radio className="h-3 w-3 animate-pulse" /> Live
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Brain className="h-3 w-3" /> AI Active
          </Badge>
          {firm && (
            <Badge variant="secondary" className="gap-1">
              <Building className="h-3 w-3" /> {firm.firmName}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Metric Cards */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', value: fmtINR(metrics.totalRevenue), icon: Wallet, trend: metrics.growthRate, color: 'emerald' },
                { label: 'Revenue Forecast', value: fmtINR(Math.round(metrics.revenueForecast)), icon: TrendingUp, trend: metrics.growthRate, color: 'emerald' },
                { label: 'Clients at Risk', value: String(metrics.clientsAtRisk), icon: AlertTriangle, trend: null, color: metrics.clientsAtRisk > 0 ? 'red' : 'emerald' },
                { label: 'Pending Returns', value: String(metrics.pendingReturns), icon: FileText, trend: null, color: metrics.pendingReturns > 0 ? 'amber' : 'emerald' },
                { label: 'Staff Utilization', value: pct(metrics.staffUtilization), icon: Users, trend: null, color: 'slate' },
                { label: 'Profit Forecast', value: fmtINR(Math.round(metrics.profitForecast)), icon: BarChart3, trend: metrics.growthRate, color: 'emerald' },
                { label: 'Cash Collection', value: fmtINR(Math.round(metrics.cashCollectionPrediction)), icon: Gauge, trend: null, color: 'emerald' },
                { label: 'Filing Delays', value: String(metrics.filingDelayPrediction), icon: Clock, trend: null, color: metrics.filingDelayPrediction > 0 ? 'amber' : 'emerald' },
              ].map((m, i) => (
                <motion.div key={m.label} custom={i} variants={stagger} initial="initial" animate="animate">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-500">{m.label}</span>
                        <m.icon className={`h-4 w-4 ${m.color === 'emerald' ? 'text-emerald-500' : m.color === 'red' ? 'text-red-500' : m.color === 'amber' ? 'text-amber-500' : 'text-slate-400'}`} />
                      </div>
                      <p className="text-lg font-bold text-slate-800">{m.value}</p>
                      {m.trend !== null && (
                        <div className={`flex items-center gap-1 text-xs mt-1 ${m.trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {m.trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {pct(Math.abs(m.trend))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* AI CEO Questions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-emerald-500" /> Ask Your AI CEO
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {aiQuestions.map((q, i) => (
                  <motion.div
                    key={q.question}
                    custom={i}
                    variants={stagger}
                    initial="initial"
                    animate="animate"
                    className="border border-slate-200 rounded-lg p-3 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={q.action}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <q.icon className={`h-4 w-4 ${q.color === 'emerald' ? 'text-emerald-500' : q.color === 'red' ? 'text-red-500' : q.color === 'amber' ? 'text-amber-500' : 'text-slate-400'}`} />
                      <span className="text-sm font-semibold text-slate-700">{q.question}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2 line-clamp-2">{q.answer}</p>
                    <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      {q.actionLabel} <ChevronRight className="h-3 w-3" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Executive Scores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Gauge className="h-4 w-4 text-emerald-500" /> Firm Executive Scores
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoresLoading ? (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                      <Skeleton className="h-[72px] w-[72px] rounded-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {[
                    { key: 'firmHealth', label: 'Firm Health' },
                    { key: 'revenue', label: 'Revenue' },
                    { key: 'compliance', label: 'Compliance' },
                    { key: 'teamEfficiency', label: 'Team' },
                    { key: 'clientSatisfaction', label: 'Clients' },
                    { key: 'cashFlow', label: 'Cash Flow' },
                  ].map(s => (
                    <ScoreGauge key={s.key} value={scores[s.key as keyof typeof scores]} label={s.label} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
              ) : activities.length === 0 ? (
                <EmptyState icon={Activity} title="No activity yet" desc="Activities will appear as your team works on clients, returns, and invoices." />
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {activities.slice(0, 10).map((a, i) => (
                      <motion.div key={a.id} custom={i} variants={stagger} initial="initial" animate="animate"
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{a.title}</p>
                          <p className="text-[10px] text-slate-400">{fmtDate(a.createdAt)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════ REVENUE TAB ══════════ */}
        <TabsContent value="revenue" className="space-y-6 mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              {/* Revenue Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <span className="text-xs text-slate-500">Total Revenue</span>
                    <p className="text-xl font-bold text-slate-800">{fmtINR(metrics.totalRevenue)}</p>
                    <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                      {metrics.growthRate >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {pct(Math.abs(metrics.growthRate))} growth
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <span className="text-xs text-slate-500">Forecast (Next Mo.)</span>
                    <p className="text-xl font-bold text-emerald-700">{fmtINR(Math.round(metrics.revenueForecast))}</p>
                    <span className="text-xs text-slate-400">Based on 6-month trend</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <span className="text-xs text-slate-500">Profit Forecast</span>
                    <p className="text-xl font-bold text-slate-800">{fmtINR(Math.round(metrics.profitForecast))}</p>
                    <span className="text-xs text-slate-400">Est. 30% margin</span>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <span className="text-xs text-slate-500">Cash Collection</span>
                    <p className="text-xl font-bold text-slate-800">{fmtINR(Math.round(metrics.cashCollectionPrediction))}</p>
                    <span className="text-xs text-slate-400">{pct(metrics.matchRate)} match rate</span>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Trend Chart */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">6-Month Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.monthlyRevenue.every(v => v === 0) ? (
                    <EmptyState icon={TrendingUp} title="No revenue data" desc="Revenue will appear as invoices are processed." />
                  ) : (
                    <div className="space-y-4">
                      {/* SVG Bar Chart */}
                      <div className="flex items-end gap-2 h-40">
                        {metrics.monthlyRevenue.map((val, i) => {
                          const maxVal = Math.max(...metrics.monthlyRevenue, 1)
                          const h = (val / maxVal) * 120
                          return (
                            <motion.div
                              key={i}
                              className="flex-1 flex flex-col items-center gap-1"
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              transition={{ delay: i * 0.08, duration: 0.4 }}
                            >
                              <span className="text-[10px] text-slate-500 font-medium">{fmtINR(val)}</span>
                              <motion.div
                                className="w-full bg-emerald-500 rounded-t-sm min-h-[2px]"
                                initial={{ height: 0 }}
                                animate={{ height: Math.max(h, 2) }}
                                transition={{ delay: i * 0.08 + 0.1, duration: 0.5 }}
                              />
                              <span className="text-[10px] text-slate-400">{metrics.monthLabels[i]}</span>
                            </motion.div>
                          )
                        })}
                      </div>
                      <Sparkline data={metrics.monthlyRevenue} color="#10b981" w={300} h={40} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Revenue Clients */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Top Revenue Clients</CardTitle>
                </CardHeader>
                <CardContent>
                  {clients.length === 0 ? (
                    <EmptyState icon={Users} title="No clients yet" desc="Add clients to see revenue breakdown." />
                  ) : (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {clients
                          .sort((a, b) => (b.totalTaxPaid || 0) - (a.totalTaxPaid || 0))
                          .slice(0, 8)
                          .map((c, i) => (
                            <motion.div key={c.id} custom={i} variants={stagger} initial="initial" animate="animate"
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50"
                            >
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                                  {i + 1}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-700">{c.tradeName}</p>
                                  <p className="text-[10px] text-slate-400">{c.gstin}</p>
                                </div>
                              </div>
                              <span className="text-sm font-semibold text-slate-800">{fmtINR(c.totalTaxPaid || 0)}</span>
                            </motion.div>
                          ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════ CLIENTS TAB ══════════ */}
        <TabsContent value="clients" className="space-y-6 mt-4">
          {clientsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : clients.length === 0 ? (
            <EmptyState icon={Users} title="No clients yet" desc="Add clients to your firm to see health scores and insights." />
          ) : (
            <>
              {/* Client Health Overview */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-emerald-200">
                  <CardContent className="p-4 text-center">
                    <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-emerald-100 mb-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-700">{metrics.healthyClients}</p>
                    <p className="text-xs text-slate-500">Healthy (75+)</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200">
                  <CardContent className="p-4 text-center">
                    <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-amber-100 mb-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-2xl font-bold text-amber-700">{metrics.atRiskClients}</p>
                    <p className="text-xs text-slate-500">At Risk (40-74)</p>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent className="p-4 text-center">
                    <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-red-100 mb-2">
                      <ShieldAlert className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-2xl font-bold text-red-700">{metrics.criticalClients}</p>
                    <p className="text-xs text-slate-500">Critical (&lt;40)</p>
                  </CardContent>
                </Card>
              </div>

              {/* Client Health SVG Pie */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Client Health Distribution</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  {metrics.totalClients === 0 ? (
                    <p className="text-sm text-slate-400">No data</p>
                  ) : (
                    <svg width={160} height={160} viewBox="0 0 160 160">
                      {(() => {
                        const total = metrics.totalClients || 1
                        const segments = [
                          { count: metrics.healthyClients, color: '#10b981' },
                          { count: metrics.atRiskClients, color: '#f59e0b' },
                          { count: metrics.criticalClients, color: '#ef4444' },
                        ]
                        const cumulativeAngles: number[] = []
                        segments.reduce((acc, seg, idx) => {
                          cumulativeAngles[idx] = acc
                          return acc + (seg.count / total) * 360
                        }, 0)
                        return segments.map((seg, idx) => {
                          if (seg.count === 0) return null
                          const startAngle = cumulativeAngles[idx] - 90
                          const endAngle = startAngle + (seg.count / total) * 360
                          const r = 60
                          const cx = 80
                          const cy = 80
                          const startRad = (startAngle * Math.PI) / 180
                          const endRad = (endAngle * Math.PI) / 180
                          const x1 = cx + r * Math.cos(startRad)
                          const y1 = cy + r * Math.sin(startRad)
                          const x2 = cx + r * Math.cos(endRad)
                          const y2 = cy + r * Math.sin(endRad)
                          const largeArc = (seg.count / total) > 0.5 ? 1 : 0
                          return (
                            <motion.path
                              key={idx}
                              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                              fill={seg.color}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 0.8, scale: 1 }}
                              transition={{ delay: idx * 0.15, duration: 0.4 }}
                              style={{ transformOrigin: `${cx}px ${cy}px` }}
                            />
                          )
                        })
                      })()}
                    </svg>
                  )}
                </CardContent>
              </Card>

              {/* At-Risk Client List */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> At-Risk Clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics.clientsAtRisk === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-slate-600 font-medium">All clients are healthy!</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {clients
                          .filter(c => (c.healthScore || 0) < 60)
                          .sort((a, b) => (a.healthScore || 0) - (b.healthScore || 0))
                          .map((c, i) => (
                            <motion.div key={c.id} custom={i} variants={stagger} initial="initial" animate="animate"
                              className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-amber-200 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                                  <span className="text-xs font-bold text-red-600">{Math.round(c.healthScore || 0)}</span>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-700">{c.tradeName}</p>
                                  <p className="text-[10px] text-slate-400">{c.gstin} • {c.pendingReturnCount || 0} pending</p>
                                </div>
                              </div>
                              <Badge variant="outline" className={
                                (c.healthScore || 0) < 40
                                  ? 'text-red-600 border-red-200 bg-red-50'
                                  : 'text-amber-600 border-amber-200 bg-amber-50'
                              }>
                                {(c.healthScore || 0) < 40 ? 'Critical' : 'At Risk'}
                              </Badge>
                            </motion.div>
                          ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════ PREDICTIONS TAB ══════════ */}
        <TabsContent value="predictions" className="space-y-6 mt-4">
          {predsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <>
              {/* Key Predictions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="p-4">
                    <span className="text-xs text-emerald-600 font-medium">Revenue Forecast</span>
                    <p className="text-lg font-bold text-emerald-800">{fmtINR(Math.round(metrics.revenueForecast))}</p>
                    <Sparkline data={metrics.monthlyRevenue} color="#10b981" />
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <span className="text-xs text-amber-600 font-medium">Filing Delays</span>
                    <p className="text-lg font-bold text-amber-800">{metrics.filingDelayPrediction} returns</p>
                    <span className="text-xs text-slate-400">May miss deadlines</span>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-slate-50/50">
                  <CardContent className="p-4">
                    <span className="text-xs text-slate-600 font-medium">Cash Collection</span>
                    <p className="text-lg font-bold text-slate-800">{fmtINR(Math.round(metrics.cashCollectionPrediction))}</p>
                    <span className="text-xs text-slate-400">{pct(metrics.matchRate)} match rate</span>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/50">
                  <CardContent className="p-4">
                    <span className="text-xs text-red-600 font-medium">Churn Risk</span>
                    <p className="text-lg font-bold text-red-800">{metrics.clientsAtRisk} clients</p>
                    <span className="text-xs text-slate-400">Score below 60</span>
                  </CardContent>
                </Card>
              </div>

              {/* Firestore Predictions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-emerald-500" /> AI Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {predictions.length === 0 ? (
                    <EmptyState icon={Eye} title="No predictions yet" desc="AI predictions will appear as your firm accumulates data." />
                  ) : (
                    <ScrollArea className="max-h-72">
                      <div className="space-y-3">
                        {predictions.map((p, i) => (
                          <motion.div key={p.id} custom={i} variants={stagger} initial="initial" animate="animate"
                            className="flex items-start gap-3 p-3 rounded-lg border border-slate-100"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 shrink-0">
                              <Target className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                                <span className="text-[10px] text-slate-400">{pct(p.confidence)} confidence</span>
                              </div>
                              <p className="text-xs text-slate-600">{p.recommendation}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-bold text-slate-800">{Math.round(p.score)}</span>
                              <p className="text-[10px] text-slate-400">score</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Priority Queue */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-emerald-500" /> Priority Queue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {priosLoading ? (
                    <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
                  ) : priorities.length === 0 ? (
                    <EmptyState icon={ListChecks} title="No priorities" desc="Priority items will be generated from your firm activity." />
                  ) : (
                    <ScrollArea className="max-h-72">
                      <div className="space-y-2">
                        {priorities.slice(0, 10).map((p, i) => (
                          <motion.div key={p.id} custom={i} variants={stagger} initial="initial" animate="animate"
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-emerald-200 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 shrink-0">
                                <span className="text-xs font-bold text-amber-700">{p.urgency}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{p.title}</p>
                                <p className="text-[10px] text-slate-400">{p.category} • Score: {p.priorityScore}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">{p.status}</Badge>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ══════════ ACTIONS TAB ══════════ */}
        <TabsContent value="actions" className="space-y-6 mt-4">
          {recsLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : (
            <>
              {/* AI Recommendations with Action Buttons */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-500" /> AI Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recommendations.length === 0 ? (
                    <EmptyState icon={Zap} title="No recommendations" desc="AI recommendations appear from reconciliation and workflow analysis." />
                  ) : (
                    <ScrollArea className="max-h-96">
                      <div className="space-y-3">
                        {recommendations.map((rec, i) => (
                          <motion.div key={rec.id} custom={i} variants={stagger} initial="initial" animate="animate"
                            className="border border-slate-200 rounded-lg p-4 hover:border-emerald-200 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <Badge className={
                                  rec.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                                  rec.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }>
                                  {rec.riskLevel}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">{rec.type}</Badge>
                                <span className="text-[10px] text-slate-400">{pct(rec.confidenceScore)} confidence</span>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-slate-700 mb-1">{rec.title}</p>
                            <p className="text-xs text-slate-500 mb-3">{rec.description}</p>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => handleAction('task')}>
                                <ListChecks className="h-3 w-3 mr-1" /> Create Task
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => handleAction('notify')}>
                                <MessageSquare className="h-3 w-3 mr-1" /> Notify Team
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => handleAction('return')}>
                                <FileCheck className="h-3 w-3 mr-1" /> Generate Return
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => handleAction('reconcile')}>
                                <RefreshCw className="h-3 w-3 mr-1" /> Reconcile
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => handleAction('automate')}>
                                <Calendar className="h-3 w-3 mr-1" /> Schedule
                              </Button>
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => handleAction('email')}>
                                <Mail className="h-3 w-3 mr-1" /> Send Email
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Active Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {notifsLoading ? (
                    <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</div>
                  ) : notifications.length === 0 ? (
                    <EmptyState icon={AlertTriangle} title="No notifications" desc="Notifications will appear as workflows generate alerts." />
                  ) : (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {notifications.slice(0, 10).map((n, i) => (
                          <motion.div key={n.id} custom={i} variants={stagger} initial="initial" animate="animate"
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50"
                          >
                            <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${
                              n.priority === 'urgent' ? 'bg-red-100' :
                              n.priority === 'high' ? 'bg-amber-100' : 'bg-slate-100'
                            }`}>
                              <AlertTriangle className={`h-3 w-3 ${
                                n.priority === 'urgent' ? 'text-red-600' :
                                n.priority === 'high' ? 'text-amber-600' : 'text-slate-400'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700">{n.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{n.message}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">{n.priority}</Badge>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
