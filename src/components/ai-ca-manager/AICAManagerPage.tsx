'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import { EmptyState } from '@/components/shared'
import {
  MonitorSmartphone,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  Users,
  FileText,
  CalendarClock,
  Zap,
  Activity,
  AlertCircle,
  IndianRupee,
  Timer,
  Target,
  BarChart3,
  Shield,
  ArrowRight,
  Bell,
  UserCheck,
  FileCheck,
  CircleDot,
  TimerReset,
} from 'lucide-react'

// ─── Animation Variants ───────────────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

// ─── Sample Data (empty — populated by real APIs when available) ──────────
const priorities: { id: number; action: string; priority: 'urgent' | 'high' | 'normal'; due: string; client: string }[] = []
const urgentFilings: { client: string; type: string; due: string; status: 'in-progress' | 'pending' | 'data-ready' }[] = []
const atRiskClients: { name: string; health: number; factors: string[] }[] = []
const pendingDocs: { client: string; doc: string; followUps: number; days: number }[] = []
const teamMembers: { name: string; role: string; completed: number; inProgress: number; overdue: number; utilization: number }[] = []
const revenueData: { month: string; actual: number; predicted: number }[] = []
const aiActions: { time: string; action: string; type: string }[] = []
const autoRules: { rule: string; active: boolean; triggers: number }[] = []


// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtINR = (n: number) =>
  '₹' +
  Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const priorityBadge = (p: string) => {
  switch (p) {
    case 'urgent': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Urgent</Badge>
    case 'high': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">High</Badge>
    default: return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Normal</Badge>
  }
}

const filingStatusBadge = (s: string) => {
  switch (s) {
    case 'in-progress': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">In Progress</Badge>
    case 'data-ready': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Data Ready</Badge>
    default: return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">Pending</Badge>
  }
}

const actionIcon = (t: string) => {
  switch (t) {
    case 'assign': return <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
    case 'reminder': return <Bell className="h-3.5 w-3.5 text-amber-500" />
    case 'escalate': return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
    case 'file': return <FileCheck className="h-3.5 w-3.5 text-blue-500" />
    case 'report': return <BarChart3 className="h-3.5 w-3.5 text-purple-500" />
    case 'automate': return <Zap className="h-3.5 w-3.5 text-emerald-500" />
    case 'alert': return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
    case 'schedule': return <CalendarClock className="h-3.5 w-3.5 text-blue-500" />
    default: return <Activity className="h-3.5 w-3.5 text-slate-500" />
  }
}

// ─── Revenue SVG Bar Chart ─────────────────────────────────────────────────
function RevenueChart() {
  if (revenueData.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No revenue data yet"
        description="Predicted revenue trend will appear here once invoice data is available."
        compact
      />
    )
  }
  const maxVal = Math.max(...revenueData.map(d => Math.max(d.actual, d.predicted)))
  const h = 140
  const barW = 32
  const gap = 20
  const totalW = revenueData.length * (barW + gap) - gap

  return (
    <svg viewBox={`0 0 ${totalW + 20} ${h + 30}`} className="w-full" style={{ maxHeight: 180 }}>
      {revenueData.map((d, i) => {
        const x = 10 + i * (barW + gap)
        const actualH = d.actual ? (d.actual / maxVal) * h : 0
        const predictedH = d.predicted && !d.actual ? (d.predicted / maxVal) * h : 0
        return (
          <g key={d.month}>
            {d.actual > 0 && (
              <motion.rect
                initial={{ height: 0, y: h }}
                animate={{ height: actualH, y: h - actualH }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                x={x} width={barW} rx={4}
                fill="#10b981" opacity={0.85}
              />
            )}
            {predictedH > 0 && (
              <motion.rect
                initial={{ height: 0, y: h }}
                animate={{ height: predictedH, y: h - predictedH }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                x={x} width={barW} rx={4}
                fill="#10b981" opacity={0.35} stroke="#10b981" strokeWidth={1} strokeDasharray="4 2"
              />
            )}
            <text x={x + barW / 2} y={h + 18} textAnchor="middle" className="text-[10px] fill-slate-400">{d.month}</text>
            {(d.actual || d.predicted) && (
              <text x={x + barW / 2} y={h - Math.max(actualH, predictedH) - 6} textAnchor="middle" className="text-[9px] fill-slate-500 font-medium">
                {fmtINR(d.actual || d.predicted!)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Metric Card ───────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="relative overflow-hidden border-slate-200/60 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold text-slate-800 mt-1">{value}</p>
              {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
            </div>
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AICAManagerPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-b border-slate-200/60 px-4 sm:px-6 py-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <MonitorSmartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">AI CA Manager</h1>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Active
                </Badge>
              </div>
              <p className="text-xs text-slate-400">The AI that runs your CA firm</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              <span>Last action: 2 min ago</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 font-medium">Running</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white border border-slate-200/60 h-9 p-0.5">
            <TabsTrigger value="dashboard" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Dashboard</TabsTrigger>
            <TabsTrigger value="priorities" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Priorities</TabsTrigger>
            <TabsTrigger value="at-risk" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">At-Risk</TabsTrigger>
            <TabsTrigger value="team" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Team</TabsTrigger>
            <TabsTrigger value="rules" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Rules</TabsTrigger>
          </TabsList>

          {/* ── Dashboard Tab ── */}
          <TabsContent value="dashboard">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              {/* Metrics Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard icon={Users} label="Active Clients" value="0" sub="No clients yet" color="bg-emerald-500" />
                <MetricCard icon={AlertTriangle} label="Urgent Filings" value="0" sub="None pending" color="bg-red-500" />
                <MetricCard icon={AlertCircle} label="At-Risk" value="0" sub="None tracked" color="bg-amber-500" />
                <MetricCard icon={FileText} label="Pending Docs" value="0" sub="None pending" color="bg-blue-500" />
                <MetricCard icon={Target} label="Utilization" value="—" sub="No team data" color="bg-emerald-600" />
                <MetricCard icon={TrendingUp} label="Revenue Forecast" value="₹0" sub="No data yet" color="bg-emerald-500" />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Priorities */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <CircleDot className="h-4 w-4 text-emerald-500" />
                          Today&apos;s Priorities
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">{priorities.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2.5">
                          {priorities.length === 0 ? (
                            <EmptyState
                              icon={CircleDot}
                              title="No priorities yet"
                              description="Today's priorities will appear here once the AI engine has processed your workload."
                              compact
                            />
                          ) : (
                            priorities.map((p, i) => (
                              <motion.div
                                key={p.id}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <span className="text-[10px] font-bold text-emerald-700">{i + 1}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-700 truncate">{p.action}</p>
                                    <p className="text-[10px] text-slate-400">Due: {p.due}</p>
                                  </div>
                                </div>
                                {priorityBadge(p.priority)}
                              </motion.div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Urgent Filings */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-red-500" />
                          Urgent Filings
                        </CardTitle>
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">48 hrs</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="max-h-64">
                        <div className="space-y-2">
                          {urgentFilings.length === 0 ? (
                            <EmptyState
                              icon={Clock}
                              title="No urgent filings yet"
                              description="Filings due within 48 hours will appear here once returns are tracked."
                              compact
                            />
                          ) : (
                            urgentFilings.map((f, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 hover:bg-slate-100/80 transition-colors"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-slate-700">{f.client}</p>
                                  <p className="text-[10px] text-slate-400">{f.type} · Due {f.due}</p>
                                </div>
                                {filingStatusBadge(f.status)}
                              </motion.div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* At-Risk Clients */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          At-Risk Clients
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-red-500 border-red-200 bg-red-50">{atRiskClients.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {atRiskClients.length === 0 ? (
                          <EmptyState
                            icon={AlertTriangle}
                            title="No at-risk clients yet"
                            description="Clients with low health scores will appear here once compliance data is synced."
                            compact
                          />
                        ) : (
                          atRiskClients.map((c, i) => (
                            <motion.div
                              key={c.name}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="p-3 rounded-lg border border-slate-200/60 hover:border-amber-200 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-700">{c.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-red-600 font-bold">{c.health}%</span>
                                  <div className="h-2 w-16 rounded-full bg-slate-200 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${c.health}%` }}
                                      transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                                      className="h-full rounded-full bg-gradient-to-r from-red-400 to-amber-400"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {c.factors.map((f, j) => (
                                  <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Pending Documents */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          Pending Documents
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">{pendingDocs.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2.5">
                        {pendingDocs.length === 0 ? (
                          <EmptyState
                            icon={FileText}
                            title="No pending documents yet"
                            description="Documents awaiting client submission will appear here."
                            compact
                          />
                        ) : (
                          pendingDocs.map((d, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{d.doc}</p>
                                <p className="text-[10px] text-slate-400">{d.client} · {d.days} days waiting</p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400">{d.followUps}x</span>
                                <TimerReset className="h-3 w-3 text-amber-500" />
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Predicted Revenue */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          Predicted Revenue
                        </CardTitle>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500 opacity-85" />Actual</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500 opacity-35 border border-emerald-500" />Forecast</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <RevenueChart />
                      <div className="mt-3 flex items-center justify-between px-1">
                        <span className="text-[11px] text-slate-400">6-Month Trend</span>
                        <div className="flex items-center gap-1 text-emerald-600">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">+12.3%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Team Productivity */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-500" />
                          Team Productivity
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">5 members</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="max-h-64">
                        <div className="space-y-3">
                          {teamMembers.length === 0 ? (
                            <EmptyState
                              icon={Users}
                              title="No team members yet"
                              description="Team productivity will appear here once members are added to the firm."
                              compact
                            />
                          ) : (
                            teamMembers.map((m, i) => (
                              <motion.div
                                key={m.name}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                className="p-3 rounded-lg border border-slate-200/60 hover:border-emerald-200 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="text-xs font-semibold text-slate-700">{m.name}</p>
                                    <p className="text-[10px] text-slate-400">{m.role}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[10px] font-bold ${m.utilization >= 85 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      {m.utilization}%
                                    </span>
                                  </div>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 mb-2 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${m.utilization}%` }}
                                    transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                                    className={`h-full rounded-full ${m.utilization >= 85 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                  />
                                </div>
                                <div className="flex items-center gap-3 text-[10px]">
                                  <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle className="h-3 w-3" />{m.completed}</span>
                                  <span className="text-blue-600 flex items-center gap-0.5"><Clock className="h-3 w-3" />{m.inProgress}</span>
                                  {m.overdue > 0 && (
                                    <span className="text-red-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />{m.overdue}</span>
                                  )}
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* AI Actions Log */}
              <motion.div variants={fadeUp}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" />
                        AI Actions Log
                      </CardTitle>
                      <span className="text-[10px] text-slate-400">Last 10 actions</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-56">
                      <div className="space-y-1.5">
                        {aiActions.length === 0 ? (
                          <EmptyState
                            icon={Zap}
                            title="No AI actions yet"
                            description="Automated actions taken by the AI CA Manager will appear here."
                            compact
                          />
                        ) : (
                          aiActions.map((a, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-start gap-2.5 py-1.5 px-2 rounded hover:bg-slate-50 transition-colors"
                            >
                              {actionIcon(a.type)}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-600">{a.action}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">{a.time}</span>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ── Priorities Tab ── */}
          <TabsContent value="priorities">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
              {priorities.length === 0 ? (
                <Card className="border-slate-200/60">
                  <CardContent className="p-6">
                    <EmptyState
                      icon={CircleDot}
                      title="No priorities yet"
                      description="Priorities will appear here once the AI engine has processed your workload."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {priorities.map((p, i) => (
                    <motion.div key={p.id} variants={fadeUp}>
                      <Card className="border-slate-200/60 hover:shadow-md transition-shadow">
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <span className="text-sm font-bold text-emerald-700">{i + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">{p.action}</p>
                              <p className="text-xs text-slate-400">Client: {p.client} · Due: {p.due}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {priorityBadge(p.priority)}
                            <Button size="sm" variant="outline" className="h-7 text-[11px]">
                              <ArrowRight className="h-3 w-3 mr-1" />Action
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── At-Risk Tab ── */}
          <TabsContent value="at-risk">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
              {atRiskClients.length === 0 ? (
                <Card className="border-slate-200/60">
                  <CardContent className="p-6">
                    <EmptyState
                      icon={AlertTriangle}
                      title="No at-risk clients yet"
                      description="Clients with low health scores will appear here once compliance data is synced."
                    />
                  </CardContent>
                </Card>
              ) : (
                atRiskClients.map((c, i) => (
                  <motion.div key={c.name} variants={fadeUp}>
                    <Card className="border-slate-200/60 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{c.name}</p>
                              <p className="text-xs text-red-500 font-medium">Health Score: {c.health}%</p>
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]">
                            <Shield className="h-3 w-3 mr-1" />Intervene
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Health Progress</span>
                            <span className="text-red-600 font-bold">{c.health}/100</span>
                          </div>
                          <Progress value={c.health} className="h-2" />
                          <Separator className="my-2" />
                          <p className="text-[11px] text-slate-500 font-medium">Risk Factors:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {c.factors.map((f, j) => (
                              <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* ── Team Tab ── */}
          <TabsContent value="team">
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.length === 0 ? (
                <div className="col-span-full">
                  <Card className="border-slate-200/60">
                    <CardContent className="p-6">
                      <EmptyState
                        icon={Users}
                        title="No team members yet"
                        description="Team members will appear here once they are added to the firm."
                      />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                teamMembers.map((m, i) => (
                  <motion.div key={m.name} variants={fadeUp}>
                    <Card className="border-slate-200/60 hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="text-sm font-bold text-emerald-700">
                              {m.name.split(' ').map(w => w[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{m.name}</p>
                            <p className="text-[11px] text-slate-400">{m.role}</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-slate-500">Utilization</span>
                              <span className={`font-bold ${m.utilization >= 85 ? 'text-amber-600' : 'text-emerald-600'}`}>{m.utilization}%</span>
                            </div>
                            <Progress value={m.utilization} className="h-2" />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-2 rounded-lg bg-emerald-50">
                              <p className="text-lg font-bold text-emerald-700">{m.completed}</p>
                              <p className="text-[10px] text-emerald-600">Done</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-blue-50">
                              <p className="text-lg font-bold text-blue-700">{m.inProgress}</p>
                              <p className="text-[10px] text-blue-600">Active</p>
                            </div>
                            <div className="text-center p-2 rounded-lg bg-red-50">
                              <p className="text-lg font-bold text-red-700">{m.overdue}</p>
                              <p className="text-[10px] text-red-600">Overdue</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* ── Rules Tab ── */}
          <TabsContent value="rules">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {autoRules.length === 0 ? (
                <Card className="border-slate-200/60">
                  <CardContent className="p-6">
                    <EmptyState
                      icon={Zap}
                      title="No automation rules yet"
                      description="Automation rules configured for the AI CA Manager will appear here."
                    />
                  </CardContent>
                </Card>
              ) : (
                autoRules.map((r, i) => (
                  <motion.div key={i} variants={fadeUp}>
                    <Card className="border-slate-200/60 hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${r.active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            <Zap className={`h-4 w-4 ${r.active ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-700">{r.rule}</p>
                            <p className="text-[10px] text-slate-400">Triggered {r.triggers} times</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[10px] ${r.active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {r.active ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
