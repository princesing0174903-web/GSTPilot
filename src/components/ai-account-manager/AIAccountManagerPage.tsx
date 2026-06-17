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
import {
  UserCheck,
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
  Bell,
  Mail,
  Phone,
  MessageSquare,
  Shield,
  ArrowRight,
  Heart,
  BarChart3,
  Send,
  FileWarning,
  CircleAlert,
  Star,
  Target,
  Eye,
} from 'lucide-react'

// ─── Animation Variants ───────────────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// ─── Sample Data ───────────────────────────────────────────────────────────
const clients = [
  { name: 'ABC Traders', gstin: '27AABCT1234F1ZH', health: 42, risk: 78, communication: 35, revenue: 65, retention: 40 },
  { name: 'XYZ Industries', gstin: '27AABCX5678G2ZK', health: 85, risk: 22, communication: 90, revenue: 88, retention: 92 },
  { name: 'Sharma Enterprises', gstin: '27AABCS9012H3ZL', health: 68, risk: 45, communication: 55, revenue: 72, retention: 60 },
  { name: 'Patel & Sons', gstin: '27AABCP3456J4ZM', health: 55, risk: 62, communication: 48, revenue: 58, retention: 45 },
  { name: 'Kumar Associates', gstin: '27AABCK7890K5ZN', health: 51, risk: 68, communication: 42, revenue: 55, retention: 38 },
  { name: 'Singh Trading', gstin: '27AABCS2345L6ZO', health: 38, risk: 82, communication: 30, revenue: 45, retention: 32 },
  { name: 'Mehta Corp', gstin: '27AABCM6789M7ZP', health: 92, risk: 12, communication: 95, revenue: 90, retention: 96 },
  { name: 'Joshi Infra', gstin: '27AABCJ0123N8ZQ', health: 75, risk: 35, communication: 70, revenue: 78, retention: 72 },
]

const automatedActions = [
  { time: '11:20 AM', action: 'Sent reminder to ABC Traders for pending GSTR-3B', type: 'reminder' },
  { time: '11:05 AM', action: 'Requested Purchase Register from Sharma Enterprises', type: 'document' },
  { time: '10:48 AM', action: 'Followed up on GST notice response for Patel & Sons', type: 'followup' },
  { time: '10:30 AM', action: 'Escalated Singh Trading — 3 overdue filings', type: 'escalate' },
  { time: '10:15 AM', action: 'Sent payment receipt reminder to Kumar Associates', type: 'reminder' },
  { time: '09:52 AM', action: 'Requested bank statements from ABC Traders', type: 'document' },
  { time: '09:35 AM', action: 'Followed up on TDS certificates from Patel & Sons', type: 'followup' },
  { time: '09:18 AM', action: 'Escalated Kumar Associates — fee payment overdue 30 days', type: 'escalate' },
  { time: '09:00 AM', action: 'Sent onboarding completion reminder to Singh Trading', type: 'reminder' },
  { time: '08:40 AM', action: 'Requested sales register from Sharma Enterprises', type: 'document' },
]

const reminders = [
  { client: 'ABC Traders', type: 'Filing Reminder', sentDate: '04/03/2026', status: 'sent' },
  { client: 'Singh Trading', type: 'Document Request', sentDate: '04/03/2026', status: 'delivered' },
  { client: 'Sharma Enterprises', type: 'Payment Reminder', sentDate: '03/03/2026', status: 'read' },
  { client: 'Patel & Sons', type: 'GST Notice Response', sentDate: '03/03/2026', status: 'sent' },
  { client: 'Kumar Associates', type: 'Fee Payment', sentDate: '02/03/2026', status: 'delivered' },
  { client: 'ABC Traders', type: 'Document Request', sentDate: '02/03/2026', status: 'read' },
  { client: 'Singh Trading', type: 'Filing Reminder', sentDate: '01/03/2026', status: 'ignored' },
  { client: 'Patel & Sons', type: 'Onboarding', sentDate: '01/03/2026', status: 'sent' },
]

const missingDocs = [
  { client: 'Sharma Enterprises', doc: 'Purchase Register Feb 2026', days: 12, priority: 'high' },
  { client: 'ABC Traders', doc: 'Bank Statement Q4 2025-26', days: 8, priority: 'urgent' },
  { client: 'Singh Trading', doc: 'GST Notice Copy', days: 18, priority: 'urgent' },
  { client: 'Kumar Associates', doc: 'Sales Register Jan 2026', days: 6, priority: 'high' },
  { client: 'Patel & Sons', doc: 'TDS Certificates FY 2025-26', days: 4, priority: 'normal' },
  { client: 'ABC Traders', doc: 'Profit & Loss Statement', days: 15, priority: 'high' },
]

const escalations = [
  { client: 'Singh Trading', reason: '3 overdue filings — no response to 4 reminders', since: '15/02/2026', severity: 'critical' },
  { client: 'ABC Traders', reason: 'GSTR-3B due in 24 hrs — no data received', since: '03/03/2026', severity: 'critical' },
  { client: 'Kumar Associates', reason: 'Fee payment overdue 30+ days', since: '01/02/2026', severity: 'high' },
  { client: 'Patel & Sons', reason: 'GST notice response deadline approaching', since: '25/02/2026', severity: 'medium' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────
const scoreColor = (score: number) => {
  if (score >= 75) return '#10b981'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

const scoreLabel = (score: number) => {
  if (score >= 75) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Poor'
}

const fmtINR = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

// ─── SVG Gauge Chart ──────────────────────────────────────────────────────
function GaugeChart({ value, size = 80, label }: { value: number; size?: number; label: string }) {
  const r = (size - 12) / 2
  const circ = Math.PI * r
  const offset = circ - (value / 100) * circ
  const color = scoreColor(value)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
        <path
          d={`M 6 ${size / 2} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <motion.path
          d={`M 6 ${size / 2} A ${r} ${r} 0 0 1 ${size - 6} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="text-sm font-bold" fill={color}>
          {value}
        </text>
      </svg>
      <span className="text-[10px] text-slate-400 font-medium">{label}</span>
    </div>
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

// ─── Client Scorecard ─────────────────────────────────────────────────────
function ClientScorecard({ client }: { client: typeof clients[0] }) {
  const avgScore = Math.round((client.health + client.risk + client.communication + client.revenue + client.retention) / 5)
  return (
    <Card className="border-slate-200/60 hover:shadow-md transition-shadow h-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-700">
                {client.name.split(' ').map(w => w[0]).join('')}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">{client.name}</p>
              <p className="text-[10px] text-slate-400">{client.gstin}</p>
            </div>
          </div>
          <Badge
            className="text-[10px]"
            style={{
              backgroundColor: scoreColor(avgScore) + '18',
              color: scoreColor(avgScore),
              borderColor: scoreColor(avgScore) + '30',
            }}
          >
            {scoreLabel(avgScore)}
          </Badge>
        </div>

        {/* Gauge Charts */}
        <div className="grid grid-cols-5 gap-1 mb-3">
          <GaugeChart value={client.health} size={64} label="Health" />
          <GaugeChart value={100 - client.risk} size={64} label="Risk" />
          <GaugeChart value={client.communication} size={64} label="Comm" />
          <GaugeChart value={client.revenue} size={64} label="Revenue" />
          <GaugeChart value={client.retention} size={64} label="Retention" />
        </div>

        {/* Score Bars */}
        <div className="space-y-1.5">
          {[
            { label: 'Health', value: client.health, color: scoreColor(client.health) },
            { label: 'Risk', value: client.risk, color: scoreColor(100 - client.risk) },
            { label: 'Comm', value: client.communication, color: scoreColor(client.communication) },
            { label: 'Revenue', value: client.revenue, color: scoreColor(client.revenue) },
            { label: 'Retention', value: client.retention, color: scoreColor(client.retention) },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-14 text-right">{s.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${s.value}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: s.color }}
                />
              </div>
              <span className="text-[10px] font-medium w-6" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const actionIconMap: Record<string, React.ReactNode> = {
  reminder: <Bell className="h-3.5 w-3.5 text-amber-500" />,
  document: <FileText className="h-3.5 w-3.5 text-blue-500" />,
  followup: <Phone className="h-3.5 w-3.5 text-emerald-500" />,
  escalate: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
}

const reminderStatusBadge = (s: string) => {
  switch (s) {
    case 'delivered': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Delivered</Badge>
    case 'read': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Read</Badge>
    case 'ignored': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Ignored</Badge>
    default: return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">Sent</Badge>
  }
}

const severityBadge = (s: string) => {
  switch (s) {
    case 'critical': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Critical</Badge>
    case 'high': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">High</Badge>
    default: return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Medium</Badge>
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function AIAccountManagerPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const avgHealth = Math.round(clients.reduce((s, c) => s + c.health, 0) / clients.length)
  const atRiskCount = clients.filter(c => c.health < 60).length

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
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">AI Account Manager</h1>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Running
                </Badge>
              </div>
              <p className="text-xs text-slate-400">The AI that manages every client relationship</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Last action: 5 min ago</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 font-medium">Monitoring 8 clients</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white border border-slate-200/60 h-9 p-0.5">
            <TabsTrigger value="dashboard" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Dashboard</TabsTrigger>
            <TabsTrigger value="scorecards" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Scorecards</TabsTrigger>
            <TabsTrigger value="reminders" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Reminders</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Documents</TabsTrigger>
            <TabsTrigger value="escalations" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Escalations</TabsTrigger>
          </TabsList>

          {/* ── Dashboard Tab ── */}
          <TabsContent value="dashboard">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard icon={Users} label="Total Clients" value="8" sub="+1 this month" color="bg-emerald-500" />
                <MetricCard icon={Heart} label="Avg Health" value={`${avgHealth}%`} sub="Across all" color="bg-emerald-600" />
                <MetricCard icon={AlertTriangle} label="At-Risk" value={String(atRiskCount)} sub="Health &lt; 60%" color="bg-red-500" />
                <MetricCard icon={Bell} label="Reminders Sent" value="28" sub="This month" color="bg-amber-500" />
                <MetricCard icon={FileText} label="Docs Pending" value="6" sub="From clients" color="bg-blue-500" />
                <MetricCard icon={CircleAlert} label="Escalations" value="4" sub="Active now" color="bg-red-600" />
              </div>

              {/* Two Column */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Client Scorecards */}
                <motion.div variants={fadeUp} className="lg:col-span-2">
                  <Card className="border-slate-200/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Star className="h-4 w-4 text-emerald-500" />
                          Client Scorecards
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">{clients.length} clients</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {clients.map((c, i) => (
                          <motion.div
                            key={c.name}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-3 rounded-lg border border-slate-200/60 hover:border-emerald-200 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                                  style={{ backgroundColor: scoreColor(c.health) + '18' }}>
                                  <span className="text-[10px] font-bold" style={{ color: scoreColor(c.health) }}>
                                    {c.name.split(' ').map(w => w[0]).join('')}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                                  <p className="text-[9px] text-slate-400">Health: {c.health}%</p>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-5 gap-1">
                              {[
                                { v: c.health, l: 'H' },
                                { v: 100 - c.risk, l: 'R' },
                                { v: c.communication, l: 'C' },
                                { v: c.revenue, l: '$' },
                                { v: c.retention, l: 'Re' },
                              ].map((s, j) => (
                                <div key={j} className="text-center">
                                  <div className="h-8 w-full rounded bg-slate-50 overflow-hidden relative">
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: `${s.v}%` }}
                                      transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                                      className="absolute bottom-0 w-full rounded"
                                      style={{ backgroundColor: scoreColor(s.v) + '40' }}
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                                      style={{ color: scoreColor(s.v) }}>
                                      {s.v}
                                    </span>
                                  </div>
                                  <span className="text-[8px] text-slate-400">{s.l}</span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Automated Actions */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-emerald-500" />
                          Automated Actions
                        </CardTitle>
                        <span className="text-[10px] text-slate-400">Last 10</span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="max-h-72">
                        <div className="space-y-1.5">
                          {automatedActions.map((a, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-start gap-2.5 py-1.5 px-2 rounded hover:bg-slate-50 transition-colors"
                            >
                              {actionIconMap[a.type] || <Activity className="h-3.5 w-3.5 text-slate-500" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-600">{a.action}</p>
                              </div>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">{a.time}</span>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Escalation Queue */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <CircleAlert className="h-4 w-4 text-red-500" />
                          Escalation Queue
                        </CardTitle>
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">{escalations.length} active</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {escalations.map((e, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="p-3 rounded-lg border border-red-100 bg-red-50/50"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-700">{e.client}</span>
                              {severityBadge(e.severity)}
                            </div>
                            <p className="text-[11px] text-slate-500 mb-1.5">{e.reason}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">Since: {e.since}</span>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                                <Eye className="h-3 w-3 mr-1" />View
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Reminders Sent */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Send className="h-4 w-4 text-amber-500" />
                          Reminders Sent
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">{reminders.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <ScrollArea className="max-h-56">
                        <div className="space-y-2">
                          {reminders.map((r, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700">{r.client}</p>
                                <p className="text-[10px] text-slate-400">{r.type} · {r.sentDate}</p>
                              </div>
                              {reminderStatusBadge(r.status)}
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Missing Documents */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <FileWarning className="h-4 w-4 text-blue-500" />
                          Missing Documents
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">{missingDocs.length}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2.5">
                        {missingDocs.map((d, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-2.5 rounded-lg border border-slate-200/60"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium text-slate-700 truncate">{d.doc}</p>
                              <Badge className={`text-[9px] ${d.priority === 'urgent' ? 'bg-red-100 text-red-700 border-red-200' : d.priority === 'high' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {d.priority}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400">{d.client}</span>
                              <span className="text-[10px] text-amber-600 font-medium">{d.days} days waiting</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          </TabsContent>

          {/* ── Scorecards Tab ── */}
          <TabsContent value="scorecards">
            <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {clients.map((c) => (
                <motion.div key={c.name} variants={fadeUp}>
                  <ClientScorecard client={c} />
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>

          {/* ── Reminders Tab ── */}
          <TabsContent value="reminders">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {reminders.map((r, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <Card className="border-slate-200/60 hover:shadow-md transition-shadow">
                    <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <Send className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700">{r.type}</p>
                          <p className="text-xs text-slate-400">{r.client} · Sent: {r.sentDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {reminderStatusBadge(r.status)}
                        <Button size="sm" variant="outline" className="h-7 text-[11px]">
                          <Mail className="h-3 w-3 mr-1" />Resend
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>

          {/* ── Documents Tab ── */}
          <TabsContent value="documents">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3">
              {missingDocs.map((d, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <Card className={`border-slate-200/60 hover:shadow-md transition-shadow ${d.priority === 'urgent' ? 'border-l-4 border-l-red-400' : d.priority === 'high' ? 'border-l-4 border-l-amber-400' : ''}`}>
                    <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${d.priority === 'urgent' ? 'bg-red-100' : d.priority === 'high' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                          <FileWarning className={`h-4 w-4 ${d.priority === 'urgent' ? 'text-red-600' : d.priority === 'high' ? 'text-amber-600' : 'text-blue-600'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700">{d.doc}</p>
                          <p className="text-xs text-slate-400">{d.client} · {d.days} days waiting</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${d.priority === 'urgent' ? 'bg-red-100 text-red-700 border-red-200' : d.priority === 'high' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {d.priority}
                        </Badge>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]">
                          <Phone className="h-3 w-3 mr-1" />Follow Up
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>

          {/* ── Escalations Tab ── */}
          <TabsContent value="escalations">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
              {escalations.map((e, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <Card className="border-slate-200/60 hover:shadow-md transition-shadow border-l-4 border-l-red-400">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{e.client}</p>
                            <p className="text-xs text-slate-400">Escalated since: {e.since}</p>
                          </div>
                        </div>
                        {severityBadge(e.severity)}
                      </div>
                      <p className="text-xs text-slate-600 mb-3">{e.reason}</p>
                      <div className="flex items-center gap-2">
                        <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700">
                          <Shield className="h-3 w-3 mr-1" />Intervene
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]">
                          <MessageSquare className="h-3 w-3 mr-1" />Contact Client
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
