'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import {
  ShieldCheck, TrendingUp, TrendingDown, Search,
  ChevronRight, Download, Plus, AlertTriangle,
  Building2, Users, Calendar, Clock, CheckCircle2,
  FileText, XCircle, Landmark,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const statCards = [
  { label: 'Annual Filings', value: '0', change: '0', up: true, icon: FileText, color: 'emerald' },
  { label: 'Pending Filings', value: '0', change: '0', up: true, icon: Clock, color: 'amber' },
  { label: 'Overdue', value: '0', change: '0', up: true, icon: AlertTriangle, color: 'red' },
  { label: 'Directors', value: '0', change: '0', up: true, icon: Users, color: 'emerald' },
  { label: 'Companies', value: '0', change: '0', up: true, icon: Building2, color: 'emerald' },
]

const filings: { id: string; form: string; company: string; cin: string; dueDate: string; filedDate: string | null; status: string; period: string }[] = []

const companies: { name: string; cin: string; roc: string; type: string; authCapital: string; paidUp: string; directors: number; status: string; address: string }[] = []

const directors: { name: string; din: string; companies: string[]; designation: string; dob: string; nationality: string; kycStatus: string }[] = []

const calendarEvents = [
  { form: 'AOC-4', description: 'Financial Statement Filing', dueDate: '29/10/2026', category: 'Annual', companies: 'All' },
  { form: 'MGT-7', description: 'Annual Return Filing', dueDate: '28/11/2026', category: 'Annual', companies: 'All' },
  { form: 'ADT-1', description: 'Auditor Appointment', dueDate: '14/10/2026', category: 'Annual', companies: 'All' },
  { form: 'DIR-3 KYC', description: 'Director KYC Verification', dueDate: '30/09/2026', category: 'Annual', companies: 'All Directors' },
  { form: 'Form 11', description: 'LLP Annual Return', dueDate: '30/05/2026', category: 'Annual', companies: 'LLPs' },
  { form: 'MSME-1', description: 'MSME Outstanding Return', dueDate: '30/04/2026', category: 'Half-Yearly', companies: 'All' },
  { form: 'DPT-3', description: 'Return of Deposits', dueDate: '30/06/2026', category: 'Annual', companies: 'All' },
  { form: 'CSR-1', description: 'CSR Registration', dueDate: '30/04/2026', category: 'One-time', companies: 'Applicable' },
  { form: 'PAS-6', description: 'Reconciliation of Share Capital', dueDate: '30/04/2026', category: 'Half-Yearly', companies: 'Listed' },
  { form: 'FLA Return', description: 'Foreign Liability & Assets', dueDate: '15/07/2026', category: 'Annual', companies: 'With FDI' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function FilingStatusChart() {
  const data = [
    { label: 'Filed', value: 0, color: '#2563EB' },
    { label: 'Pending', value: 0, color: '#f59e0b' },
    { label: 'Overdue', value: 0, color: '#ef4444' },
  ]
  const cx = 80
  const cy = 80
  const r = 60
  const innerR = 40
  const total = data.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div className="h-36 flex flex-col items-center justify-center text-slate-400">
        <ShieldCheck className="h-10 w-10 mb-3 text-slate-200" />
        <p className="text-sm font-medium">No ROC compliance data yet</p>
        <p className="text-xs text-slate-400 mt-1 text-center">Add your companies to track ROC filings</p>
      </div>
    )
  }

  let startAngle = -90
  const slices = data.map(d => {
    const angle = (d.value / total) * 360
    const endAngle = startAngle + angle
    const midAngle = startAngle + angle / 2
    const slice = { ...d, startAngle, endAngle, midAngle }
    startAngle = endAngle
    return slice
  })

  const describeArc = (cx: number, cy: number, r: number, startA: number, endA: number) => {
    const rad = (a: number) => (a * Math.PI) / 180
    const x1 = cx + r * Math.cos(rad(startA))
    const y1 = cy + r * Math.sin(rad(startA))
    const x2 = cx + r * Math.cos(rad(endA))
    const y2 = cy + r * Math.sin(rad(endA))
    const largeArc = endA - startA > 180 ? 1 : 0
    return `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}`
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={describeArc(cx, cy, r, s.startAngle, s.endAngle)} fill="none" stroke={s.color} strokeWidth="20" />
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="white" />
        <text x={cx} y={cy - 6} className="text-[18px] font-bold fill-slate-900" textAnchor="middle">{total}</text>
        <text x={cx} y={cy + 10} className="text-[8px] fill-slate-500" textAnchor="middle">Total</text>
      </svg>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[11px] text-slate-600">{d.label}</span>
            <span className="text-[11px] font-semibold text-slate-800 ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComplianceTimelineChart() {
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
  const filed: number[] = []
  if (filed.length === 0) {
    return (
      <div className="h-40 flex flex-col items-center justify-center text-slate-400">
        <Calendar className="h-10 w-10 mb-3 text-slate-200" />
        <p className="text-xs font-medium">No filing history yet</p>
        <p className="text-[10px] text-slate-400 mt-1 text-center">Monthly filings trend will appear once you file returns</p>
      </div>
    )
  }
  const maxVal = Math.max(...filed)
  const w = 360
  const h = 160
  const padL = 30
  const padB = 25
  const padT = 10
  const chartW = w - padL - 10
  const chartH = h - padB - padT
  const barW = chartW / months.length * 0.5
  const gapX = chartW / months.length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 1, 2, 3, 4].map(i => {
        const y = padT + (i / 4) * chartH
        return <line key={i} x1={padL} y1={y} x2={w - 10} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
      })}
      {months.map((m, i) => {
        const x = padL + i * gapX + (gapX - barW) / 2
        const barH = (filed[i] / maxVal) * chartH
        return (
          <g key={m}>
            <rect x={x} y={padT + chartH - barH} width={barW} height={barH} rx="3" fill="#2563EB" opacity="0.8">
              <animate attributeName="height" from="0" to={barH} dur="0.5s" fill="freeze" />
              <animate attributeName="y" from={padT + chartH} to={padT + chartH - barH} dur="0.5s" fill="freeze" />
            </rect>
            <text x={x + barW / 2} y={padT + chartH - barH - 5} className="text-[8px] fill-slate-600" textAnchor="middle">{filed[i]}</text>
            <text x={x + barW / 2} y={h - 6} className="text-[9px] fill-slate-400" textAnchor="middle">{m}</text>
          </g>
        )
      })}
      <text x={padL - 5} y={padT + 4} className="text-[8px] fill-slate-400" textAnchor="end">{maxVal}</text>
      <text x={padL - 5} y={padT + chartH + 4} className="text-[8px] fill-slate-400" textAnchor="end">0</text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const stagger = {
  container: { transition: { staggerChildren: 0.06 } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } },
}

export default function ROCCompliancePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFilings = filings.filter(f =>
    f.form.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filingStatusColor = (s: string) => {
    switch (s) {
      case 'Filed': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Overdue': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const kycStatusColor = (s: string) => {
    switch (s) {
      case 'Verified': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Overdue': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const categoryColor = (c: string) => {
    switch (c) {
      case 'Annual': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Half-Yearly': return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'One-time': return 'bg-violet-100 text-violet-700 border-violet-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">ROC Compliance</h1>
              <p className="text-xs text-slate-500">Companies Act Filing & Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" /> Add Filing
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stat Cards */}
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" variants={stagger.container} initial="initial" animate="animate">
          {statCards.map((s) => (
            <motion.div key={s.label} variants={stagger.item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      s.label === 'Overdue' ? 'bg-red-100' : s.label === 'Pending Filings' ? 'bg-amber-100' : 'bg-emerald-100'
                    }`}>
                      <s.icon className={`h-4 w-4 ${
                        s.label === 'Overdue' ? 'text-red-600' : s.label === 'Pending Filings' ? 'text-amber-600' : 'text-emerald-600'
                      }`} />
                    </div>
                    <div className={`flex items-center gap-0.5 text-[11px] font-medium ${s.up ? 'text-emerald-600' : 'text-red-500'}`}>
                      {s.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {s.change}
                    </div>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{s.value}</p>
                  <p className="text-[11px] text-slate-500">{s.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100 h-9 p-0.5">
            <TabsTrigger value="overview" className="text-xs px-3 h-8">Overview</TabsTrigger>
            <TabsTrigger value="filings" className="text-xs px-3 h-8">Filings</TabsTrigger>
            <TabsTrigger value="companies" className="text-xs px-3 h-8">Companies</TabsTrigger>
            <TabsTrigger value="directors" className="text-xs px-3 h-8">Directors</TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs px-3 h-8">Calendar</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Filing Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <FilingStatusChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Monthly Filings Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ComplianceTimelineChart />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Overdue Filings</CardTitle>
              </CardHeader>
              <CardContent>
                {filings.filter(f => f.status === 'Overdue').length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400">
                    <CheckCircle2 className="h-10 w-10 mb-3 text-slate-200" />
                    <p className="text-sm font-medium">No overdue filings</p>
                    <p className="text-xs text-slate-300 mt-1">Overdue ROC filings will appear here</p>
                  </div>
                ) : filings.filter(f => f.status === 'Overdue').map((f, i) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50/50 mb-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900">{f.form}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1">{f.company}</Badge>
                      </div>
                      <span className="text-[11px] text-red-600">Due: {f.dueDate} · {f.period}</span>
                    </div>
                    <Button size="sm" className="h-7 text-[10px] bg-red-600 hover:bg-red-700 gap-1">
                      <FileText className="h-3 w-3" /> File Now
                    </Button>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Filings Tab */}
          <TabsContent value="filings" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">All Filings</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search filings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-56 pl-8 text-xs"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {filteredFilings.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                        <FileText className="h-10 w-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">No ROC compliance data yet</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">Add your companies to track ROC filings</p>
                      </div>
                    ) : filteredFilings.map((f, i) => (
                      <motion.div
                        key={f.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          f.status === 'Filed' ? 'bg-emerald-100' : f.status === 'Pending' ? 'bg-amber-100' : 'bg-red-100'
                        }`}>
                          {f.status === 'Filed' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> :
                           f.status === 'Pending' ? <Clock className="h-4 w-4 text-amber-600" /> :
                           <XCircle className="h-4 w-4 text-red-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{f.form}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{f.period}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">{f.company} · CIN: {f.cin}</span>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-[11px] text-slate-700">Due: {f.dueDate}</p>
                          <p className="text-[10px] text-slate-500">Filed: {f.filedDate || '—'}</p>
                        </div>
                        <Badge className={`text-[10px] ${filingStatusColor(f.status)}`}>{f.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="mt-4 space-y-4">
            {companies.length === 0 ? (
              <Card>
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Building2 className="h-12 w-12 mb-4 text-slate-200" />
                    <p className="text-sm font-medium">No companies added yet</p>
                    <p className="text-xs text-slate-400 mt-1 text-center max-w-sm">Add your companies to track ROC filings, directors, and compliance status</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {companies.map((c, i) => (
                <motion.div
                  key={c.cin}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                          <Landmark className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-900 truncate block">{c.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{c.type}</Badge>
                            <span className="text-[10px] text-slate-500">ROC: {c.roc}</span>
                          </div>
                        </div>
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">{c.status}</Badge>
                      </div>
                      <Separator className="mb-3" />
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">CIN</span>
                          <span className="font-mono font-medium text-slate-700 text-[10px]">{c.cin}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Authorised Capital</span>
                          <span className="font-medium text-slate-700">{c.authCapital}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Paid-up Capital</span>
                          <span className="font-medium text-slate-700">{c.paidUp}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-500">Directors</span>
                          <span className="font-medium text-slate-700">{c.directors}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          <span className="font-medium">Address:</span> {c.address}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
            )}
          </TabsContent>

          {/* Directors Tab */}
          <TabsContent value="directors" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Director Details</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {directors.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                        <Users className="h-10 w-10 mb-3 text-slate-200" />
                        <p className="text-sm font-medium">No directors added yet</p>
                        <p className="text-xs text-slate-400 mt-1 text-center">Directors will appear here once you add your companies</p>
                      </div>
                    ) : directors.map((d, i) => (
                      <motion.div
                        key={d.din}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          {d.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{d.name}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{d.designation}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">DIN: {d.din} · {d.companies.join(', ')}</span>
                        </div>
                        <div className="hidden sm:block text-right">
                          <p className="text-[11px] text-slate-600">DOB: {d.dob}</p>
                          <p className="text-[10px] text-slate-500">{d.nationality}</p>
                        </div>
                        <Badge className={`text-[10px] ${kycStatusColor(d.kycStatus)}`}>
                          {d.kycStatus === 'Verified' && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                          KYC: {d.kycStatus}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Filing Calendar — FY 2026-27</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {calendarEvents.map((ev, i) => (
                      <motion.div
                        key={ev.form}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                          <Calendar className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{ev.form}</span>
                            <Badge className={`text-[9px] ${categoryColor(ev.category)}`}>{ev.category}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">{ev.description} · Applicable: {ev.companies}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-900">Due: {ev.dueDate}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
