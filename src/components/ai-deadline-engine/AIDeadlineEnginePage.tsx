'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import {
  CalendarClock,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  Users,
  FileText,
  Zap,
  Activity,
  AlertCircle,
  IndianRupee,
  Timer,
  BarChart3,
  CalendarDays,
  Shield,
  ArrowRight,
  Bell,
  Target,
  CircleDot,
  Gauge,
  ListChecks,
  Calendar,
  TimerReset,
} from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Inbox, CalendarClock as CalendarClockIcon } from 'lucide-react'

// ─── Animation Variants ───────────────────────────────────────────────────
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
}

// ─── Types ────────────────────────────────────────────────────────────────
interface DeadlineEntry {
  date: number;
  type: string;
  client: string;
  status: string;
  fee: number;
}
interface TomorrowFiling {
  client: string;
  type: string;
  due: string;
  status: string;
}
interface LateFeeEntry {
  client: string;
  type: string;
  overdueDays: number;
  dailyFee: number;
  totalFee: number;
}
interface WorkloadEntry {
  day: string;
  filings: number;
}
interface RiskForecastEntry {
  client: string;
  deadline: string;
  probability: number;
  reason: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth()
const currentDay = now.getDate()

const fmtINR = (n: number) =>
  '₹' + Math.round(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
const firstDayOffset = new Date(currentYear, currentMonth, 1).getDay()

const filingStatusBadge = (s: string) => {
  switch (s) {
    case 'data-ready': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Data Ready</Badge>
    case 'data-partial': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Partial Data</Badge>
    case 'in-progress': return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">In Progress</Badge>
    case 'due-soon': return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Due Soon</Badge>
    default: return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">Pending</Badge>
  }
}

const riskProbabilityColor = (p: number) => {
  if (p >= 70) return '#ef4444'
  if (p >= 40) return '#f59e0b'
  return '#10b981'
}

// ─── Calendar SVG Grid ────────────────────────────────────────────────────
function DeadlineCalendar({ deadlines }: { deadlines: DeadlineEntry[] }) {
  const cellSize = 36
  const gap = 4
  const cols = 7
  const rows = Math.ceil((daysInMonth + firstDayOffset) / cols)
  const totalW = cols * (cellSize + gap) - gap
  const totalH = rows * (cellSize + gap) - gap + 24

  const getDeadlineForDay = (day: number) => deadlines.filter(d => d.date === day)

  return (
    <svg viewBox={`0 0 ${totalW + 16} ${totalH + 16}`} className="w-full" style={{ maxHeight: 320 }}>
      {/* Day Headers */}
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
        <text key={d} x={8 + i * (cellSize + gap) + cellSize / 2} y={14} textAnchor="middle" className="text-[9px] fill-slate-400 font-medium">
          {d}
        </text>
      ))}
      {/* Day Cells */}
      {Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1
        const pos = i + firstDayOffset
        const col = pos % cols
        const row = Math.floor(pos / cols)
        const x = 8 + col * (cellSize + gap)
        const y = 22 + row * (cellSize + gap)
        const dl = getDeadlineForDay(day)
        const isToday = day === currentDay
        const isPast = day < currentDay

        return (
          <g key={day}>
            <motion.rect
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.01, duration: 0.2 }}
              x={x} y={y} width={cellSize} height={cellSize} rx={6}
              fill={isToday ? '#10b981' : isPast ? '#f8fafc' : dl.length > 0 ? '#f0fdf4' : '#ffffff'}
              stroke={isToday ? '#10b981' : dl.length > 0 ? '#bbf7d0' : '#e2e8f0'}
              strokeWidth={isToday ? 2 : 1}
            />
            <text
              x={x + cellSize / 2} y={y + 14}
              textAnchor="middle"
              className="text-[11px] font-medium"
              fill={isToday ? '#ffffff' : isPast ? '#cbd5e1' : '#475569'}
            >
              {day}
            </text>
            {dl.length > 0 && (
              <>
                {/* Filing dot indicators */}
                {dl.slice(0, 3).map((d, j) => (
                  <circle
                    key={j}
                    cx={x + 10 + j * 8}
                    cy={y + cellSize - 7}
                    r={3}
                    fill={d.status === 'due-soon' ? '#ef4444' : d.status === 'pending' ? '#f59e0b' : '#10b981'}
                  />
                ))}
                {dl.length > 3 && (
                  <text x={x + 34} y={y + cellSize - 4} className="text-[7px] fill-slate-400">+{dl.length - 3}</text>
                )}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── 7-Day Workload SVG Chart ─────────────────────────────────────────────
function WorkloadChart({ weeklyWorkload }: { weeklyWorkload: WorkloadEntry[] }) {
  const maxFilings = Math.max(...weeklyWorkload.map(d => d.filings), 1)
  const h = 120
  const barW = 40
  const gap = 16
  const totalW = weeklyWorkload.length * (barW + gap) - gap

  return (
    <svg viewBox={`0 0 ${totalW + 20} ${h + 30}`} className="w-full" style={{ maxHeight: 180 }}>
      {weeklyWorkload.map((d, i) => {
        const x = 10 + i * (barW + gap)
        const barH = maxFilings > 0 ? (d.filings / maxFilings) * h : 0
        const isHigh = d.filings >= 5
        return (
          <g key={d.day}>
            <motion.rect
              initial={{ height: 0, y: h }}
              animate={{ height: barH, y: h - barH }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              x={x} width={barW} rx={5}
              fill={isHigh ? '#f59e0b' : '#10b981'}
              opacity={0.8}
            />
            <text x={x + barW / 2} y={h + 18} textAnchor="middle" className="text-[10px] fill-slate-400">{d.day}</text>
            {d.filings > 0 && (
              <text x={x + barW / 2} y={h - barH - 6} textAnchor="middle" className="text-[10px] fill-slate-600 font-semibold">
                {d.filings}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Late Fee Sparkline SVG ────────────────────────────────────────────────
function LateFeeSparkline({ lateFeeData }: { lateFeeData: LateFeeEntry[] }) {
  const cumulativeData = lateFeeData.map((_, i) =>
    lateFeeData.slice(0, i + 1).reduce((s, d) => s + d.totalFee, 0)
  )
  const maxVal = Math.max(...cumulativeData, 1)
  const w = 200
  const h = 50
  const stepX = w / Math.max(cumulativeData.length - 1, 1)

  const points = cumulativeData.map((v, i) => `${i * stepX},${h - (v / maxVal) * h}`).join(' ')
  const areaPoints = `0,${h} ${points} ${w},${h}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ maxHeight: 60 }}>
      <motion.polygon
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        points={areaPoints}
        fill="#fef2f2"
        stroke="none"
      />
      <motion.polyline
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
        points={points}
        fill="none"
        stroke="#ef4444"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
export default function AIDeadlineEnginePage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [deadlines, setDeadlines] = useState<DeadlineEntry[]>([])
  const [tomorrowFilings, setTomorrowFilings] = useState<TomorrowFiling[]>([])
  const [lateFeeData, setLateFeeData] = useState<LateFeeEntry[]>([])
  const [weeklyWorkload, setWeeklyWorkload] = useState<WorkloadEntry[]>([])
  const [riskForecasts, setRiskForecasts] = useState<RiskForecastEntry[]>([])

  // ── Fetch data ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ai-deadline-engine')
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        if (Array.isArray(json.deadlines)) setDeadlines(json.deadlines)
        if (Array.isArray(json.tomorrowFilings)) setTomorrowFilings(json.tomorrowFilings)
        if (Array.isArray(json.lateFeeData)) setLateFeeData(json.lateFeeData)
        if (Array.isArray(json.weeklyWorkload)) setWeeklyWorkload(json.weeklyWorkload)
        if (Array.isArray(json.riskForecasts)) setRiskForecasts(json.riskForecasts)
      } catch {
        // Leave empty arrays in place — UI will render empty states.
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const totalLateFee = lateFeeData.reduce((s, d) => s + d.totalFee, 0)
  const totalOverdue = lateFeeData.length

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
              <CalendarClock className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-800">AI Deadline Engine</h1>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Running
                </Badge>
              </div>
              <p className="text-xs text-slate-400">The AI that predicts all deadlines and generates calendar</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              <span>Last scan: —</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 font-medium">{deadlines.length} deadlines tracked</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white border border-slate-200/60 h-9 p-0.5">
            <TabsTrigger value="dashboard" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Dashboard</TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Calendar</TabsTrigger>
            <TabsTrigger value="workload" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Workload</TabsTrigger>
            <TabsTrigger value="late-fees" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Late Fees</TabsTrigger>
            <TabsTrigger value="forecasts" className="text-xs h-8 px-3 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">Forecasts</TabsTrigger>
          </TabsList>

          {/* ── Dashboard Tab ── */}
          <TabsContent value="dashboard">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricCard icon={CalendarDays} label="Upcoming" value={String(deadlines.length)} sub="This month" color="bg-emerald-500" />
                <MetricCard icon={IndianRupee} label="Late Fee Exposure" value={lateFeeData.length > 0 ? fmtINR(totalLateFee) : '—'} sub={`${totalOverdue} overdue returns`} color="bg-red-500" />
                <MetricCard icon={AlertCircle} label="Overdue Returns" value={String(totalOverdue)} sub="Need attention" color="bg-amber-500" />
                <MetricCard icon={Target} label="At-Risk Clients" value={String(riskForecasts.length)} sub="May miss deadlines" color="bg-red-600" />
                <MetricCard icon={Gauge} label="Workload Score" value={weeklyWorkload.length > 0 ? `${weeklyWorkload.reduce((s, d) => s + d.filings, 0)}/100` : '—'} sub="This week" color="bg-emerald-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Deadline Calendar */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-emerald-500" />
                          Deadline Calendar — {monthNames[currentMonth]} {currentYear}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />Due Soon</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Pending</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Upcoming</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <DeadlineCalendar deadlines={deadlines} />
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Tomorrow's Filings */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-red-500" />
                          Tomorrow&apos;s Filings
                        </CardTitle>
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">{tomorrowFilings.length} due</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {tomorrowFilings.length === 0 ? (
                        <EmptyState
                          icon={Inbox}
                          title="No upcoming deadlines"
                          description="Filings due tomorrow will appear here once scheduled."
                          compact
                        />
                      ) : (
                        <div className="space-y-2.5">
                          {tomorrowFilings.map((f, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="flex items-center justify-between p-3 rounded-lg bg-slate-50/80 hover:bg-red-50/50 transition-colors border border-slate-200/60"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700">{f.client}</p>
                                <p className="text-[10px] text-slate-400">{f.type} · Due: {f.due}</p>
                              </div>
                              {filingStatusBadge(f.status)}
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Late Fee Exposure */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Late Fee Exposure
                        </CardTitle>
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">{fmtINR(totalLateFee)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <LateFeeSparkline lateFeeData={lateFeeData} />
                      <div className="mt-3 space-y-2">
                        {lateFeeData.length === 0 ? (
                          <EmptyState
                            icon={Inbox}
                            title="No overdue deadlines"
                            description="Overdue filings and late fees will appear here."
                            compact
                          />
                        ) : (
                          lateFeeData.map((d, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 transition-colors"
                            >
                              <div className="min-w-0">
                                <span className="text-xs text-slate-700 font-medium">{d.client}</span>
                                <span className="text-[10px] text-slate-400 ml-2">{d.type}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-slate-400">{d.overdueDays}d × ₹{d.dailyFee}/day</span>
                                <span className="text-xs font-semibold text-red-600">{fmtINR(d.totalFee)}</span>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-medium text-slate-600">Total Exposure</span>
                        <span className="text-sm font-bold text-red-600">{fmtINR(totalLateFee)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* 7-Day Workload */}
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60 h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-emerald-500" />
                          7-Day Workload
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">
                          {weeklyWorkload.reduce((s, d) => s + d.filings, 0)} filings
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <WorkloadChart weeklyWorkload={weeklyWorkload} />
                      <div className="mt-3 flex items-center justify-between px-1 text-[10px]">
                        <span className="text-slate-400">Filings per day</span>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" />Normal</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-500" />High</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Risk Forecasts */}
                <motion.div variants={fadeUp} className="lg:col-span-2">
                  <Card className="border-slate-200/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Target className="h-4 w-4 text-amber-500" />
                          Risk Forecasts
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-slate-400">{riskForecasts.length} predictions</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {riskForecasts.length === 0 ? (
                        <EmptyState
                          icon={Target}
                          title="No risk forecasts yet"
                          description="Risk forecasts will appear here once the AI engine has analysed filing history."
                        />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {riskForecasts.map((r, i) => (
                            <motion.div
                              key={r.client}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.06 }}
                              className="p-3 rounded-lg border border-slate-200/60 hover:border-amber-200 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-700">{r.client}</span>
                                <span
                                  className="text-[11px] font-bold"
                                  style={{ color: riskProbabilityColor(r.probability) }}
                                >
                                  {r.probability}%
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mb-2">{r.deadline}</p>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mb-1.5">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${r.probability}%` }}
                                  transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
                                  className="h-full rounded-full"
                                  style={{ backgroundColor: riskProbabilityColor(r.probability) }}
                                />
                              </div>
                              <p className="text-[10px] text-slate-400">{r.reason}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          </TabsContent>

          {/* ── Calendar Tab ── */}
          <TabsContent value="calendar">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              <motion.div variants={fadeUp}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-500" />
                      {monthNames[currentMonth]} {currentYear} — Filing Calendar
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <DeadlineCalendar deadlines={deadlines} />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Deadline List for this month */}
              <motion.div variants={fadeUp}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-emerald-500" />
                        All Deadlines This Month
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] text-slate-400">{deadlines.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-96">
                      <div className="space-y-2">
                        {deadlines.length === 0 ? (
                          <EmptyState
                            icon={Inbox}
                            title="No deadlines yet"
                            description="Deadlines scheduled this month will appear here."
                            compact
                          />
                        ) : (
                          deadlines.map((d, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-center justify-between p-3 rounded-lg bg-slate-50/80 hover:bg-slate-100/80 transition-colors border border-slate-200/40"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-emerald-700">{d.date}</span>
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-slate-700">{d.client}</p>
                                  <p className="text-[10px] text-slate-400">{d.type}</p>
                                </div>
                              </div>
                              {filingStatusBadge(d.status)}
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

          {/* ── Workload Tab ── */}
          <TabsContent value="workload">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              <motion.div variants={fadeUp}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-500" />
                      7-Day Workload Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <WorkloadChart weeklyWorkload={weeklyWorkload} />
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeUp}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-emerald-500" />
                      Day-by-Day Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {weeklyWorkload.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="No workload data yet"
                        description="Daily workload will appear here once filings are scheduled."
                        compact
                      />
                    ) : (
                      <div className="space-y-3">
                        {weeklyWorkload.map((d, i) => {
                          const dayDeadlines = deadlines.filter(dl => (dl.date - currentDay) === i && dl.date >= currentDay)
                          return (
                            <motion.div
                              key={d.day}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="p-3 rounded-lg border border-slate-200/60"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-700">{d.day}</span>
                                  <Badge className={`text-[10px] ${d.filings >= 5 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                    {d.filings} filing{d.filings !== 1 ? 's' : ''}
                                  </Badge>
                                </div>
                                {i === 0 && <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">Today</Badge>}
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(d.filings / Math.max(...weeklyWorkload.map(w => w.filings))) * 100}%` }}
                                  transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
                                  className={`h-full rounded-full ${d.filings >= 5 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                />
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>

          {/* ── Late Fees Tab ── */}
          <TabsContent value="late-fees">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              {/* Summary */}
              <motion.div variants={fadeUp}>
                <Card className="border-red-200/60 bg-red-50/30">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                        <IndianRupee className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm text-red-600 font-medium">Total Late Fee Exposure</p>
                        <p className="text-3xl font-bold text-red-700">{fmtINR(totalLateFee)}</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-slate-500">{lateFeeData.length} overdue returns</p>
                        <p className="text-xs text-slate-400">—</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <LateFeeSparkline lateFeeData={lateFeeData} />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Detail List */}
              {lateFeeData.length === 0 ? (
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60">
                    <CardContent className="pt-6">
                      <EmptyState
                        icon={Inbox}
                        title="No overdue deadlines"
                        description="Overdue filings and late fees will appear here once they exist."
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                lateFeeData.map((d, i) => (
                  <motion.div key={i} variants={fadeUp}>
                    <Card className="border-slate-200/60 hover:shadow-md transition-shadow border-l-4 border-l-red-400">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                              <TimerReset className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{d.client}</p>
                              <p className="text-xs text-slate-400">{d.type}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-red-600">{fmtINR(d.totalFee)}</p>
                            <p className="text-[10px] text-slate-400">{d.overdueDays} days × ₹{d.dailyFee}/day</p>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((d.overdueDays / 15) * 100, 100)}%` }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                            className="h-full rounded-full bg-red-400"
                          />
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-slate-400">Overdue by {d.overdueDays} days</span>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                            <Zap className="h-3 w-3 mr-1" />File Now
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>

          {/* ── Forecasts Tab ── */}
          <TabsContent value="forecasts">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
              {/* Risk Forecast Cards */}
              {riskForecasts.length === 0 ? (
                <motion.div variants={fadeUp}>
                  <Card className="border-slate-200/60">
                    <CardContent className="pt-6">
                      <EmptyState
                        icon={Target}
                        title="No risk forecasts yet"
                        description="Risk forecasts will appear here once the AI engine has analysed filing history."
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                riskForecasts.map((r, i) => (
                  <motion.div key={r.client} variants={fadeUp}>
                    <Card className={`border-slate-200/60 hover:shadow-md transition-shadow ${r.probability >= 70 ? 'border-l-4 border-l-red-400' : r.probability >= 40 ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-400'}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: riskProbabilityColor(r.probability) + '18' }}>
                              <Target className="h-4 w-4" style={{ color: riskProbabilityColor(r.probability) }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{r.client}</p>
                              <p className="text-xs text-slate-400">{r.deadline}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-2xl font-bold" style={{ color: riskProbabilityColor(r.probability) }}>
                                {r.probability}%
                              </p>
                              <p className="text-[10px] text-slate-400">miss probability</p>
                            </div>
                          </div>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-2">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${r.probability}%` }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: riskProbabilityColor(r.probability) }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-500">{r.reason}</p>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]">
                            <Shield className="h-3 w-3 mr-1" />Prevent
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}

              <Separator className="my-4" />

              {/* Compliance Calendar Preview */}
              <motion.div variants={fadeUp}>
                <Card className="border-slate-200/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-emerald-500" />
                      Compliance Calendar — FY {currentYear}-{(currentYear + 1) % 100}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <EmptyState
                      icon={CalendarClockIcon}
                      title="No compliance calendar yet"
                      description="Statutory compliance deadlines will appear here once configured."
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
