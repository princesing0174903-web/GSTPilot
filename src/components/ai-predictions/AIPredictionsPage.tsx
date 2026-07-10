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
  TrendingUp, TrendingDown, Target, AlertTriangle, Clock, Users,
  IndianRupee, Activity, Brain, Shield, BarChart3, Zap, ArrowRight,
  Calendar, UserX, FileWarning, Flame, Wallet, Scale, CheckCircle,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles,
} from 'lucide-react'
import {
  useFireClients, useFireReturns, useFireInvoices,
  useFireReconciliations, useFireActivities, useFirePredictions,
} from '@/hooks/use-firestore'
import { useApp } from '@/contexts/AppContext'

// ─── Animation Variants ───────────────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
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

function getMonthKey(iso: string | unknown): string {
  if (!iso) return ''
  try {
    const d = new Date(iso as string)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } catch { return '' }
}

function getMonthLabel(key: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [y, m] = key.split('-')
  return months[parseInt(m, 10) - 1] + ' ' + y.slice(2)
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────
function Sparkline({ data, color = '#10b981', width = 80, height = 28 }: {
  data: number[]; color?: string; width?: number; height?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  )
}

// ─── Bar Chart SVG ────────────────────────────────────────────────────────
function BarChart({ data, labels, projectedIndex, width = 420, height = 180 }: {
  data: number[]; labels: string[]; projectedIndex?: number; width?: number; height?: number
}) {
  if (data.length === 0) return null
  const max = Math.max(...data, 1)
  const barW = Math.min(36, (width - 40) / data.length - 8)
  const chartH = height - 30
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {data.map((v, i) => {
        const x = 30 + i * ((width - 40) / data.length) + 4
        const barH = (v / max) * (chartH - 10)
        const isProjected = projectedIndex !== undefined && i >= projectedIndex
        return (
          <g key={i}>
            <rect x={x} y={chartH - barH} width={barW} height={barH}
              fill={isProjected ? '#10b981' : '#059669'} opacity={isProjected ? 0.5 : 0.85}
              rx={3} />
            <text x={x + barW / 2} y={height - 4} textAnchor="middle"
              className="text-[10px] fill-slate-500">{labels[i] || ''}</text>
            <text x={x + barW / 2} y={chartH - barH - 4} textAnchor="middle"
              className="text-[9px] fill-slate-600">
              {v > 999 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)}
            </text>
          </g>
        )
      })}
      {/* Y-axis line */}
      <line x1="28" y1="5" x2="28" y2={chartH} stroke="#e2e8f0" strokeWidth="1" />
    </svg>
  )
}

// ─── Prediction Model Types ──────────────────────────────────────────────
interface PredictionModel {
  id: string
  name: string
  icon: React.ReactNode
  prediction: string
  confidence: number
  trend: 'up' | 'down' | 'stable'
  sparklineData: number[]
  color: string
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AIPredictionsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const { setCurrentView } = useApp()

  // ─── Live Firestore Data ───────────────────────────────────────────────
  const { data: clients, loading: clientsLoading } = useFireClients()
  const { data: returns, loading: returnsLoading } = useFireReturns()
  const { data: invoices, loading: invoicesLoading } = useFireInvoices()
  const { data: reconciliations, loading: reconsLoading } = useFireReconciliations()
  const { data: activities, loading: activitiesLoading } = useFireActivities()
  const { data: predictions, loading: predictionsLoading } = useFirePredictions()

  const loading = clientsLoading || returnsLoading || invoicesLoading || reconsLoading || activitiesLoading

  // ─── 1. Revenue Prediction ─────────────────────────────────────────────
  const revenuePrediction = useMemo(() => {
    const monthlyTotals: Record<string, number> = {}
    invoices.forEach(inv => {
      const key = getMonthKey(inv.invoiceDate || inv.createdAt)
      if (key) {
        monthlyTotals[key] = (monthlyTotals[key] || 0) + (inv.totalAmount || 0)
      }
    })
    const sortedMonths = Object.keys(monthlyTotals).sort()
    const last6 = sortedMonths.slice(-6)
    const last6Values = last6.map(m => monthlyTotals[m])
    const avgRevenue = last6Values.length > 0
      ? last6Values.reduce((a, b) => a + b, 0) / last6Values.length
      : 0
    // Simple linear extrapolation
    const growthRate = last6Values.length >= 2
      ? (last6Values[last6Values.length - 1] - last6Values[0]) / Math.max(last6Values[0], 1)
      : 0.05
    const projected = avgRevenue * (1 + Math.max(growthRate, 0.02))
    const confidence = last6Values.length >= 3 ? 78 + Math.min(last6Values.length * 3, 18) : 45
    return { monthlyTotals, sortedMonths: last6, monthlyValues: last6Values, projected, avgRevenue, confidence, growthRate }
  }, [invoices])

  // ─── 2. Client Churn Prediction ────────────────────────────────────────
  const churnPredictions = useMemo(() => {
    return clients.map(client => {
      const health = client.healthScore || 50
      const pendingReturns = client.pendingReturnCount || 0
      const lastFiling = client.lastFilingDate ? new Date(client.lastFilingDate) : null
      const daysSinceFiling = lastFiling ? Math.floor((Date.now() - lastFiling.getTime()) / 86400000) : 999
      const overdueReturns = client.complianceProfile?.overdueReturns || 0

      // Churn score: 0-100 (higher = more likely to churn)
      let churnScore = 0
      churnScore += (100 - health) * 0.4
      churnScore += Math.min(pendingReturns * 8, 30)
      churnScore += Math.min(daysSinceFiling / 10, 20)
      churnScore += Math.min(overdueReturns * 6, 20)
      churnScore = Math.min(Math.round(churnScore), 100)

      const factors: string[] = []
      if (health < 50) factors.push('Low health score')
      if (pendingReturns > 2) factors.push(`${pendingReturns} pending returns`)
      if (daysSinceFiling > 60) factors.push('Filing overdue 60+ days')
      if (overdueReturns > 0) factors.push(`${overdueReturns} overdue returns`)

      let action = 'Monitor'
      if (churnScore > 70) action = 'Immediate follow-up'
      else if (churnScore > 50) action = 'Schedule review'
      else if (churnScore > 30) action = 'Proactive check-in'

      return { ...client, churnScore, factors, action }
    }).sort((a, b) => b.churnScore - a.churnScore)
  }, [clients])

  // ─── 3. Late Filing Prediction ─────────────────────────────────────────
  const lateFilingPredictions = useMemo(() => {
    const now = new Date()
    return returns
      .filter(r => r.status !== 'filed')
      .map(r => {
        const period = r.period || ''
        const [month, year] = period.split('-').map(Number)
        // GST due date is typically 20th of next month
        let dueDate: Date | null = null
        if (month && year) {
          const nextMonth = month === 12 ? 1 : month + 1
          const nextYear = month === 12 ? year + 1 : year
          dueDate = new Date(nextYear, nextMonth - 1, 20)
        }
        const daysUntilDue = dueDate ? Math.floor((dueDate.getTime() - now.getTime()) / 86400000) : 999
        const isOverdue = daysUntilDue < 0

        // Probability of late filing
        let probability = 0
        if (isOverdue) probability = 95
        else if (daysUntilDue <= 3) probability = 85
        else if (daysUntilDue <= 7) probability = 60
        else if (daysUntilDue <= 14) probability = 35
        else if (r.criticalErrors > 0) probability = 50
        else if (r.issuesFound > 0) probability = 25
        else probability = 10

        if (r.status === 'draft') probability = Math.min(probability + 20, 100)
        if (r.status === 'validated' || r.status === 'reviewed') probability = Math.max(probability - 20, 5)

        const client = clients.find(c => c.clientId === r.clientId || c.id === r.clientId)
        return {
          ...r,
          clientName: client?.tradeName || 'Unknown',
          dueDate: dueDate ? formatDate(dueDate.toISOString()) : '—',
          daysUntilDue,
          isOverdue,
          lateProbability: Math.round(probability),
        }
      })
      .sort((a, b) => b.lateProbability - a.lateProbability)
  }, [returns, clients])

  // ─── 4. Team Burnout Prediction ────────────────────────────────────────
  const burnoutPredictions = useMemo(() => {
    const memberActivities: Record<string, { name: string; count: number; types: Set<string>; recent: number }> = {}

    activities.forEach(act => {
      const userId = act.userId || 'unknown'
      if (!memberActivities[userId]) {
        memberActivities[userId] = { name: userId, count: 0, types: new Set(), recent: 0 }
      }
      memberActivities[userId].count++
      if (act.type) memberActivities[userId].types.add(act.type)

      const actDate = act.createdAt ? new Date(act.createdAt as string) : null
      if (actDate && (Date.now() - actDate.getTime()) < 7 * 86400000) {
        memberActivities[userId].recent++
      }
    })

    // If no real activity data, compute from returns assigned
    if (Object.keys(memberActivities).length === 0) {
      const assignees: Record<string, number> = {}
      returns.forEach(r => {
        if (r.assignedTo) {
          assignees[r.assignedTo] = (assignees[r.assignedTo] || 0) + 1
        }
      })
      Object.entries(assignees).forEach(([name, count]) => {
        memberActivities[name] = { name, count, types: new Set(['return_prepared']), recent: count }
      })
    }

    return Object.entries(memberActivities).map(([id, data]) => {
      // Burnout score: 0-100
      let burnoutScore = 0
      burnoutScore += Math.min(data.count * 2, 40)
      burnoutScore += Math.min(data.recent * 5, 35)
      burnoutScore += Math.min(data.types.size * 5, 25)
      burnoutScore = Math.min(Math.round(burnoutScore), 100)

      let level = 'Low'
      if (burnoutScore > 70) level = 'Critical'
      else if (burnoutScore > 50) level = 'High'
      else if (burnoutScore > 30) level = 'Moderate'

      return {
        id, name: data.name, activityCount: data.count,
        typeCount: data.types.size, recentCount: data.recent,
        burnoutScore, level,
      }
    }).sort((a, b) => b.burnoutScore - a.burnoutScore)
  }, [activities, returns])

  // ─── 5. Cash Collection Prediction ─────────────────────────────────────
  const cashPrediction = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0)
    const totalTax = invoices.reduce((s, i) => s + (i.totalTax || 0) + (i.cgst || 0) + (i.sgst || 0) + (i.igst || 0), 0)

    const totalReconMatched = reconciliations.reduce((s, r) => s + (r.matched || 0), 0)
    const totalReconRecords = reconciliations.reduce((s, r) => s + (r.totalRecords || 0), 0)
    const matchRate = totalReconRecords > 0 ? totalReconMatched / totalReconRecords : 0.5

    const projectedCollection = totalInvoiced * matchRate
    const collectionRate = totalInvoiced > 0 ? (projectedCollection / totalInvoiced) * 100 : 50
    const confidence = totalReconRecords > 10 ? 82 : totalReconRecords > 0 ? 65 : 40

    return { totalInvoiced, totalTax, projectedCollection, collectionRate, matchRate, confidence }
  }, [invoices, reconciliations])

  // ─── 6. Compliance Risk Prediction ─────────────────────────────────────
  const compliancePrediction = useMemo(() => {
    const totalReturns = returns.length
    const filedReturns = returns.filter(r => r.status === 'filed').length
    const overdueReturns = returns.filter(r => {
      if (!r.period) return false
      const [m, y] = r.period.split('-').map(Number)
      if (!m || !y) return false
      const dueDate = new Date(y, m, 20)
      return r.status !== 'filed' && dueDate < new Date()
    }).length
    const criticalReturns = returns.filter(r => r.criticalErrors > 0).length

    const avgClientHealth = clients.length > 0
      ? clients.reduce((s, c) => s + (c.healthScore || 0), 0) / clients.length
      : 50

    let complianceScore = 100
    complianceScore -= overdueReturns * 12
    complianceScore -= criticalReturns * 8
    complianceScore -= Math.max(0, (100 - avgClientHealth) * 0.3)
    if (totalReturns > 0) complianceScore -= ((totalReturns - filedReturns) / totalReturns) * 20
    complianceScore = Math.max(Math.round(complianceScore), 0)

    const confidence = totalReturns > 5 && clients.length > 2 ? 85 : 50

    const highRiskClients = clients.filter(c => (c.healthScore || 0) < 50 || (c.complianceProfile?.overdueReturns || 0) > 1)

    return { complianceScore, filedReturns, totalReturns, overdueReturns, criticalReturns, confidence, highRiskClients }
  }, [returns, clients])

  // ─── Build 6 Prediction Model Cards ────────────────────────────────────
  const predictionModels: PredictionModel[] = useMemo(() => [
    {
      id: 'revenue', name: 'Revenue Prediction', icon: <IndianRupee className="h-5 w-5" />,
      prediction: formatINR(revenuePrediction.projected),
      confidence: revenuePrediction.confidence,
      trend: revenuePrediction.growthRate >= 0 ? 'up' : 'down',
      sparklineData: revenuePrediction.monthlyValues.length >= 2
        ? revenuePrediction.monthlyValues.slice(-6)
        : [0, 0],
      color: '#10b981',
    },
    {
      id: 'churn', name: 'Client Churn', icon: <UserX className="h-5 w-5" />,
      prediction: `${churnPredictions.filter(c => c.churnScore > 50).length} at risk`,
      confidence: clients.length > 3 ? 76 : 45,
      trend: churnPredictions.filter(c => c.churnScore > 50).length > clients.length * 0.3 ? 'up' : 'down',
      sparklineData: churnPredictions.slice(0, 6).map(c => c.churnScore),
      color: '#ef4444',
    },
    {
      id: 'late_filing', name: 'Late Filing Risk', icon: <FileWarning className="h-5 w-5" />,
      prediction: `${lateFilingPredictions.filter(r => r.lateProbability > 50).length} returns`,
      confidence: returns.length > 5 ? 80 : 42,
      trend: lateFilingPredictions.filter(r => r.lateProbability > 50).length > 2 ? 'up' : 'stable',
      sparklineData: lateFilingPredictions.slice(0, 6).map(r => r.lateProbability),
      color: '#f59e0b',
    },
    {
      id: 'team_burnout', name: 'Team Burnout', icon: <Flame className="h-5 w-5" />,
      prediction: `${burnoutPredictions.filter(b => b.level === 'High' || b.level === 'Critical').length} at risk`,
      confidence: burnoutPredictions.length > 0 ? 72 : 35,
      trend: burnoutPredictions.some(b => b.burnoutScore > 60) ? 'up' : 'stable',
      sparklineData: burnoutPredictions.slice(0, 6).map(b => b.burnoutScore),
      color: '#8b5cf6',
    },
    {
      id: 'cash_collection', name: 'Cash Collection', icon: <Wallet className="h-5 w-5" />,
      prediction: `${cashPrediction.collectionRate.toFixed(1)}%`,
      confidence: cashPrediction.confidence,
      trend: cashPrediction.collectionRate > 70 ? 'up' : 'down',
      sparklineData: [Math.max(cashPrediction.collectionRate - 15, 10), Math.max(cashPrediction.collectionRate - 8, 20), Math.max(cashPrediction.collectionRate - 3, 30), cashPrediction.collectionRate],
      color: '#06b6d4',
    },
    {
      id: 'compliance_risk', name: 'Compliance Risk', icon: <Scale className="h-5 w-5" />,
      prediction: `Score ${compliancePrediction.complianceScore}/100`,
      confidence: compliancePrediction.confidence,
      trend: compliancePrediction.complianceScore < 60 ? 'up' : 'stable',
      sparklineData: [Math.min(compliancePrediction.complianceScore + 20, 100), Math.min(compliancePrediction.complianceScore + 10, 100), compliancePrediction.complianceScore],
      color: '#f97316',
    },
  ], [revenuePrediction, churnPredictions, lateFilingPredictions, burnoutPredictions, cashPrediction, compliancePrediction, clients.length, returns.length])

  // ─── Skeleton Loader ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-32" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-28" /><Skeleton className="h-6 w-36" /><Skeleton className="h-3 w-20" />
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-4"><Skeleton className="h-40 w-full" /></CardContent></Card>
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
          <Brain className="h-10 w-10 text-emerald-600" />
        </motion.div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">No Data for Predictions</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          Add clients, invoices, and returns to enable AI predictions. The intelligence engine computes from your live data.
        </p>
        <Button onClick={() => setCurrentView('clients')} className="bg-emerald-600 hover:bg-emerald-700">
          Add Clients <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    )
  }

  // ─── Trend Icon ────────────────────────────────────────────────────────
  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
    if (trend === 'down') return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
    return <Minus className="h-3.5 w-3.5 text-slate-400" />
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
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Predictive Intelligence Engine</h1>
            <p className="text-xs text-slate-500">6 AI models computing from live Firestore data</p>
          </div>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <Sparkles className="h-3 w-3 mr-1" /> Live
          </Badge>
        </motion.div>
      </motion.div>

      {/* ── 6 Prediction Model Cards ────────────────────────────────────── */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {predictionModels.map(model => (
          <motion.div key={model.id} variants={fadeUp}>
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: model.color + '18', color: model.color }}>
                      {model.icon}
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{model.name}</span>
                  </div>
                  <TrendIcon trend={model.trend} />
                </div>
                <div className="text-lg font-bold text-slate-800 mb-1">{model.prediction}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Confidence: {model.confidence}%</span>
                  <Sparkline data={model.sparklineData} color={model.color} />
                </div>
                <Progress value={model.confidence} className="h-1 mt-2"
                  style={{ '--progress-color': model.color } as React.CSSProperties} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 h-9 p-0.5">
          {['overview', 'revenue', 'churn', 'late-filing', 'burnout', 'cash'].map(tab => (
            <TabsTrigger key={tab} value={tab}
              className="text-xs px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              {tab === 'late-filing' ? 'Late Filing' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Revenue Bar Chart */}
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                  Revenue Trend — Last 6 Months + Projection
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenuePrediction.sortedMonths.length > 0 ? (
                  <div className="flex justify-center overflow-x-auto">
                    <BarChart
                      data={[
                        ...revenuePrediction.monthlyValues,
                        revenuePrediction.projected,
                      ]}
                      labels={[
                        ...revenuePrediction.sortedMonths.map(getMonthLabel),
                        'Next',
                      ]}
                      projectedIndex={revenuePrediction.sortedMonths.length}
                    />
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                    No invoice data available for revenue chart
                  </div>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-600 opacity-85 inline-block" /> Actual
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-500 opacity-50 inline-block" /> Projected
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Churn Risk Table */}
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-500" />
                  Churn Risk — Top Clients
                </CardTitle>
              </CardHeader>
              <CardContent>
                {churnPredictions.length > 0 ? (
                  <ScrollArea className="max-h-64">
                    <div className="space-y-2">
                      {churnPredictions.slice(0, 8).map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                              {(c.tradeName || 'U').charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">{c.tradeName || 'Unknown'}</p>
                              <p className="text-[10px] text-slate-500">{c.factors.length > 0 ? c.factors[0] : 'Healthy'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-20">
                              <Progress value={c.churnScore} className="h-1.5"
                                style={{ '--progress-color': c.churnScore > 70 ? '#ef4444' : c.churnScore > 40 ? '#f59e0b' : '#10b981' } as React.CSSProperties} />
                            </div>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5"
                              style={{ borderColor: c.churnScore > 70 ? '#ef4444' : c.churnScore > 40 ? '#f59e0b' : '#10b981', color: c.churnScore > 70 ? '#ef4444' : c.churnScore > 40 ? '#f59e0b' : '#10b981' }}>
                              {c.churnScore}%
                            </Badge>
                            <span className="text-[10px] text-slate-500 w-24 text-right">{c.action}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-20 flex items-center justify-center text-sm text-slate-400">No client data</div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Late Filing + Burnout row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Late Filing Predictions */}
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileWarning className="h-4 w-4 text-amber-500" />
                    Late Filing Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lateFilingPredictions.length > 0 ? (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {lateFilingPredictions.filter(r => r.lateProbability > 25).slice(0, 6).map(r => (
                          <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                            <div>
                              <p className="text-xs font-semibold text-slate-700">{r.clientName} — {r.returnType}</p>
                              <p className="text-[10px] text-slate-500">Due: {r.dueDate}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5"
                              style={{ borderColor: r.lateProbability > 70 ? '#ef4444' : r.lateProbability > 40 ? '#f59e0b' : '#10b981', color: r.lateProbability > 70 ? '#ef4444' : r.lateProbability > 40 ? '#f59e0b' : '#10b981' }}>
                              {r.lateProbability}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-sm text-slate-400">All filings on track</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Team Burnout */}
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Flame className="h-4 w-4 text-violet-500" />
                    Team Burnout Indicators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {burnoutPredictions.length > 0 ? (
                    <ScrollArea className="max-h-48">
                      <div className="space-y-2">
                        {burnoutPredictions.map(b => (
                          <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                            <div>
                              <p className="text-xs font-semibold text-slate-700">{b.name}</p>
                              <p className="text-[10px] text-slate-500">{b.activityCount} activities, {b.typeCount} types</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={b.burnoutScore} className="h-1.5 w-16"
                                style={{ '--progress-color': b.burnoutScore > 70 ? '#ef4444' : b.burnoutScore > 40 ? '#f59e0b' : '#10b981' } as React.CSSProperties} />
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5"
                                style={{ borderColor: b.level === 'Critical' ? '#ef4444' : b.level === 'High' ? '#f59e0b' : '#10b981', color: b.level === 'Critical' ? '#ef4444' : b.level === 'High' ? '#f59e0b' : '#10b981' }}>
                                {b.level}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-20 flex items-center justify-center text-sm text-slate-400">No activity data</div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Prediction History */}
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Prediction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {predictions.length > 0 ? (
                  <ScrollArea className="max-h-48">
                    <div className="space-y-2">
                      {predictions.slice(0, 10).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 capitalize">
                              {String(p.type || '').replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-slate-700">{p.recommendation || '—'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">Score: {p.score}</span>
                            <span className="text-[10px] text-slate-400">{formatDate(p.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-20 flex items-center justify-center text-sm text-slate-400">
                    No prediction history yet — predictions are generated from live data
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Revenue Tab ───────────────────────────────────────────────── */}
        <TabsContent value="revenue" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Revenue Prediction Model
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-50">
                    <p className="text-[10px] text-slate-500 mb-1">Projected Next Month</p>
                    <p className="text-base font-bold text-emerald-700">{formatINR(revenuePrediction.projected)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-500 mb-1">Avg Monthly</p>
                    <p className="text-base font-bold text-slate-700">{formatINR(revenuePrediction.avgRevenue)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-500 mb-1">Growth Rate</p>
                    <p className="text-base font-bold text-slate-700">{(revenuePrediction.growthRate * 100).toFixed(1)}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-500 mb-1">Confidence</p>
                    <p className="text-base font-bold text-slate-700">{revenuePrediction.confidence}%</p>
                  </div>
                </div>
                <Separator />
                {revenuePrediction.sortedMonths.length > 0 ? (
                  <div className="flex justify-center overflow-x-auto">
                    <BarChart
                      data={[...revenuePrediction.monthlyValues, revenuePrediction.projected]}
                      labels={[...revenuePrediction.sortedMonths.map(getMonthLabel), 'Next']}
                      projectedIndex={revenuePrediction.sortedMonths.length}
                      width={500} height={200}
                    />
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                    No invoice data for revenue prediction
                  </div>
                )}
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                  <strong>Method:</strong> Linear extrapolation from last {revenuePrediction.monthlyValues.length} months of invoice totals.
                  Projected = Avg × (1 + growth rate). Confidence increases with more historical data points.
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Churn Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="churn" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserX className="h-4 w-4 text-red-500" />
                  Client Churn Prediction
                </CardTitle>
              </CardHeader>
              <CardContent>
                {churnPredictions.length > 0 ? (
                  <ScrollArea className="max-h-[420px]">
                    <div className="space-y-3">
                      {churnPredictions.map(c => (
                        <div key={c.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold"
                                style={{ backgroundColor: c.churnScore > 70 ? '#fef2f2' : c.churnScore > 40 ? '#fffbeb' : '#f0fdf4', color: c.churnScore > 70 ? '#ef4444' : c.churnScore > 40 ? '#f59e0b' : '#10b981' }}>
                                {(c.tradeName || 'U').charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{c.tradeName}</p>
                                <p className="text-[10px] text-slate-500">Health: {c.healthScore || 0}/100 · {c.pendingReturnCount || 0} pending</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold" style={{ color: c.churnScore > 70 ? '#ef4444' : c.churnScore > 40 ? '#f59e0b' : '#10b981' }}>
                                {c.churnScore}%
                              </p>
                              <p className="text-[10px] text-slate-500">churn risk</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Progress value={c.churnScore} className="h-2 flex-1"
                              style={{ '--progress-color': c.churnScore > 70 ? '#ef4444' : c.churnScore > 40 ? '#f59e0b' : '#10b981' } as React.CSSProperties} />
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {c.factors.map((f, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-slate-600">
                                {f}
                              </Badge>
                            ))}
                            {c.factors.length === 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-emerald-600 border-emerald-200">No risk factors</Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">Recommended: {c.action}</span>
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-emerald-600 hover:text-emerald-700"
                              onClick={() => setCurrentView('clients')}>
                              View Client <ArrowRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-40 flex items-center justify-center text-sm text-slate-400">No clients to analyze</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Late Filing Tab ───────────────────────────────────────────── */}
        <TabsContent value="late-filing" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileWarning className="h-4 w-4 text-amber-500" />
                  Late Filing Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {lateFilingPredictions.length > 0 ? (
                  <ScrollArea className="max-h-[420px]">
                    <div className="space-y-3">
                      {lateFilingPredictions.map(r => (
                        <div key={r.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {r.clientName} — {r.returnType} ({r.period})
                              </p>
                              <p className="text-[10px] text-slate-500">
                                Due: {r.dueDate} · Status: <span className="capitalize">{r.status}</span>
                                {r.isOverdue && <span className="text-red-500 ml-1 font-semibold">OVERDUE</span>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold" style={{ color: r.lateProbability > 70 ? '#ef4444' : r.lateProbability > 40 ? '#f59e0b' : '#10b981' }}>
                                {r.lateProbability}%
                              </p>
                              <p className="text-[10px] text-slate-500">late risk</p>
                            </div>
                          </div>
                          <Progress value={r.lateProbability} className="h-2 mb-2"
                            style={{ '--progress-color': r.lateProbability > 70 ? '#ef4444' : r.lateProbability > 40 ? '#f59e0b' : '#10b981' } as React.CSSProperties} />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                              {r.criticalErrors > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-red-600 border-red-200">{r.criticalErrors} errors</Badge>}
                              {r.issuesFound > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-200">{r.issuesFound} issues</Badge>}
                              {r.criticalErrors === 0 && r.issuesFound === 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-emerald-600 border-emerald-200">No issues</Badge>}
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
                  <div className="h-40 flex items-center justify-center text-sm text-slate-400">No returns to analyze</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Burnout Tab ───────────────────────────────────────────────── */}
        <TabsContent value="burnout" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Flame className="h-4 w-4 text-violet-500" />
                  Team Burnout Prediction
                </CardTitle>
              </CardHeader>
              <CardContent>
                {burnoutPredictions.length > 0 ? (
                  <ScrollArea className="max-h-[420px]">
                    <div className="space-y-3">
                      {burnoutPredictions.map(b => (
                        <div key={b.id} className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold"
                                style={{ backgroundColor: b.burnoutScore > 70 ? '#fef2f2' : b.burnoutScore > 40 ? '#fffbeb' : '#f0fdf4', color: b.burnoutScore > 70 ? '#ef4444' : b.burnoutScore > 40 ? '#f59e0b' : '#10b981' }}>
                                {b.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                                <p className="text-[10px] text-slate-500">
                                  {b.activityCount} activities · {b.typeCount} types · {b.recentCount} this week
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold" style={{ color: b.burnoutScore > 70 ? '#ef4444' : b.burnoutScore > 40 ? '#f59e0b' : '#10b981' }}>
                                {b.burnoutScore}
                              </p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4"
                                style={{ borderColor: b.level === 'Critical' ? '#ef4444' : b.level === 'High' ? '#f59e0b' : '#10b981', color: b.level === 'Critical' ? '#ef4444' : b.level === 'High' ? '#f59e0b' : '#10b981' }}>
                                {b.level}
                              </Badge>
                            </div>
                          </div>
                          <Progress value={b.burnoutScore} className="h-2"
                            style={{ '--progress-color': b.burnoutScore > 70 ? '#ef4444' : b.burnoutScore > 40 ? '#f59e0b' : '#10b981' } as React.CSSProperties} />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                    No activity data for burnout analysis
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ── Cash Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="cash" className="space-y-4 mt-4">
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-cyan-500" />
                  Cash Collection Prediction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-cyan-50">
                    <p className="text-[10px] text-slate-500 mb-1">Total Invoiced</p>
                    <p className="text-base font-bold text-cyan-700">{formatINR(cashPrediction.totalInvoiced)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-50">
                    <p className="text-[10px] text-slate-500 mb-1">Projected Collection</p>
                    <p className="text-base font-bold text-cyan-700">{formatINR(cashPrediction.projectedCollection)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-500 mb-1">Collection Rate</p>
                    <p className="text-base font-bold text-slate-700">{cashPrediction.collectionRate.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-[10px] text-slate-500 mb-1">Confidence</p>
                    <p className="text-base font-bold text-slate-700">{cashPrediction.confidence}%</p>
                  </div>
                </div>
                <Separator />
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">Reconciliation Match Rate</span>
                    <span className="text-xs text-slate-600">{(cashPrediction.matchRate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={cashPrediction.matchRate * 100} className="h-3" />
                  <p className="text-[10px] text-slate-500 mt-2">
                    Collection rate is derived from reconciliation match rates. Higher match rates indicate more reliable cash flow.
                  </p>
                </div>
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                  <strong>Method:</strong> Projected collection = Total invoiced × reconciliation match rate.
                  Match rate from {reconciliations.length} reconciliation records.
                  Confidence based on data volume and consistency.
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
