'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import { EmptyState } from '@/components/shared/EmptyState'
import { useApp } from '@/contexts/AppContext'
import {
  Scale, TrendingUp, TrendingDown, Search,
  ChevronRight, Download, Filter, Plus, AlertTriangle,
  Clock, CheckCircle2, XCircle, FileText,
  Reply, Archive, Calendar, Eye, Send,
  IndianRupee, Building2, UserCircle, Gavel,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

// PT-1-a: Active notices are sourced from /api/notices. Response tracker,
// templates, and archive do not yet have dedicated APIs and render empty states.
type NoticeCategory = 'GST' | 'Income Tax' | 'ROC' | 'Labour' | 'Custom'
type NoticeStatus = 'Active' | 'Pending Response' | 'Responded' | 'Overdue' | 'Resolved' | 'Closed'

type ApiNotice = {
  id: string
  clientId?: string | null
  clientTradeName?: string | null
  clientGstin?: string | null
  noticeType?: string | null
  noticeNumber?: string | null
  noticeDate?: string | null
  subject?: string | null
  description?: string | null
  status?: string | null
  priority?: string | null
  dueDate?: string | null
  responseDate?: string | null
  resolution?: string | null
  attachments?: unknown
  createdAt?: string
}

type Notice = {
  id: string
  type: string
  category: NoticeCategory
  authority: string
  subject: string
  client: string
  date: string
  dueDate: string
  amount: string
  status: NoticeStatus
  priority: string
}

const NoticesResponse = { notices: [] as ApiNotice[] }

function mapNotice(n: ApiNotice): Notice {
  const type = (n.noticeType || 'notice').toUpperCase()
  const category: NoticeCategory =
    type.includes('GST') ? 'GST' :
    type.includes('IT') || type.includes('INCOME') ? 'Income Tax' :
    type.includes('ROC') ? 'ROC' :
    type.includes('LABOUR') || type.includes('PF') || type.includes('ESI') ? 'Labour' :
    'Custom'
  const rawStatus = (n.status || 'open').toLowerCase()
  const status: NoticeStatus =
    rawStatus === 'open' || rawStatus === 'active' ? 'Active' :
    rawStatus === 'pending' ? 'Pending Response' :
    rawStatus === 'responded' ? 'Responded' :
    rawStatus === 'overdue' ? 'Overdue' :
    rawStatus === 'resolved' || rawStatus === 'closed' ? 'Resolved' :
    'Active'
  return {
    id: n.id,
    type,
    category,
    authority: '—',
    subject: n.subject || 'Untitled notice',
    client: n.clientTradeName || '—',
    date: n.noticeDate || (n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-IN') : '—'),
    dueDate: n.dueDate || '—',
    amount: '—',
    status,
    priority: (n.priority || 'medium').charAt(0).toUpperCase() + (n.priority || 'medium').slice(1),
  }
}

// Tabs without dedicated APIs render empty states.
const responseTracker: { noticeId: string; stage: string; date: string; action: string; assignee: string }[] = []
const templates: { name: string; category: string; lastUsed: string; uses: number; description: string }[] = []
const archiveNotices: { id: string; type: string; client: string; subject: string; resolvedDate: string; outcome: string; amount: string }[] = []

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function NoticeCategoryChart({ notices }: { notices: Notice[] }) {
  // Derived from real notices.
  const catCounts: Record<string, number> = {}
  for (const n of notices) catCounts[n.category] = (catCounts[n.category] ?? 0) + 1
  const palette: Record<string, string> = {
    GST: '#10b981', 'Income Tax': '#f59e0b', ROC: '#6ee7b7', Labour: '#94a3b8', Custom: '#a7f3d0',
  }
  const data = Object.entries(catCounts).map(([label, value]) => ({ label, value, color: palette[label] ?? '#94a3b8' }))
  const cx = 75
  const cy = 75
  const r = 55
  const innerR = 35
  const total = data.reduce((s, d) => s + d.value, 0)

  let startAngle = -90
  const slices = data.map(d => {
    const angle = (d.value / total) * 360
    const endAngle = startAngle + angle
    const slice = { ...d, startAngle, endAngle }
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
      <svg viewBox="0 0 150 150" className="w-36 h-36 shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={describeArc(cx, cy, r, s.startAngle, s.endAngle)} fill="none" stroke={s.color} strokeWidth="20" />
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="white" />
        <text x={cx} y={cy - 4} className="text-[16px] font-bold fill-slate-900" textAnchor="middle">{total}</text>
        <text x={cx} y={cy + 10} className="text-[7px] fill-slate-500" textAnchor="middle">Active</text>
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

function ResponseTimeChart() {
  // Static content — response-time trend requires historical notice-response data not yet tracked.
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb']
  const avgDays = [9.5, 8.2, 7.8, 7.1, 6.2]
  const w = 320
  const h = 160
  const padL = 35
  const padB = 25
  const padT = 10
  const chartW = w - padL - 10
  const chartH = h - padB - padT
  const maxVal = 10
  const minVal = 5

  const points = avgDays.map((v, i) => {
    const x = padL + (i / (avgDays.length - 1)) * chartW
    const y = padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH
    return { x, y, v }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = pathD + ` L${points[points.length - 1].x},${h - padB} L${points[0].x},${h - padB} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 1, 2, 3, 4].map(i => {
        const y = padT + (i / 4) * chartH
        return <line key={i} x1={padL} y1={y} x2={w - 10} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
      })}
      <path d={areaD} fill="url(#responseGrad)" opacity="0.3" />
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" stroke="white" strokeWidth="1.5" />
          <text x={p.x} y={p.y - 8} className="text-[8px] fill-slate-500" textAnchor="middle">{p.v}d</text>
        </g>
      ))}
      {months.map((m, i) => (
        <text key={m} x={padL + (i / (months.length - 1)) * chartW} y={h - 6} className="text-[9px] fill-slate-400" textAnchor="middle">{m}</text>
      ))}
      <text x={padL - 5} y={padT + 4} className="text-[8px] fill-slate-400" textAnchor="end">10d</text>
      <text x={padL - 5} y={padT + chartH + 4} className="text-[8px] fill-slate-400" textAnchor="end">5d</text>
      <defs>
        <linearGradient id="responseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
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

export default function LegalNoticesPage() {
  const { setCurrentView } = useApp()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: noticesRes } = useQuery<{ notices: ApiNotice[] }>({
    queryKey: ['notices', 'all'],
    queryFn: () => apiGet<{ notices: ApiNotice[] }>('/api/notices'),
  })
  const notices: Notice[] = (noticesRes?.notices ?? []).map(mapNotice)

  const filteredNotices = notices.filter(n =>
    n.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Derived stat cards from real notices.
  const statCards = [
    { label: 'Active Notices', value: String(notices.filter(n => n.status === 'Active').length), change: '—', up: false, icon: Scale, color: 'emerald' },
    { label: 'Pending Response', value: String(notices.filter(n => n.status === 'Pending Response').length), change: '—', up: false, icon: Clock, color: 'amber' },
    { label: 'Overdue', value: String(notices.filter(n => n.status === 'Overdue').length), change: '—', up: false, icon: AlertTriangle, color: 'red' },
    { label: 'Resolved', value: String(notices.filter(n => n.status === 'Resolved').length), change: '—', up: true, icon: CheckCircle2, color: 'emerald' },
    // Static content — average response time requires historical notice-response data not yet tracked.
    { label: 'Avg Response Time', value: '— days', change: '—', up: true, icon: TrendingDown, color: 'emerald' },
  ]

  const statusColor = (s: NoticeStatus) => {
    switch (s) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Pending Response': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Responded': return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'Overdue': return 'bg-red-100 text-red-700 border-red-200'
      case 'Resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Closed': return 'bg-slate-100 text-slate-700 border-slate-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200'
      case 'High': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Medium': return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'Low': return 'bg-slate-100 text-slate-700 border-slate-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const categoryIcon = (c: NoticeCategory) => {
    switch (c) {
      case 'GST': return <IndianRupee className="h-4 w-4 text-emerald-600" />
      case 'Income Tax': return <Building2 className="h-4 w-4 text-amber-600" />
      case 'ROC': return <Gavel className="h-4 w-4 text-sky-600" />
      case 'Labour': return <UserCircle className="h-4 w-4 text-violet-600" />
      case 'Custom': return <FileText className="h-4 w-4 text-slate-600" />
    }
  }

  const categoryBg = (c: NoticeCategory) => {
    switch (c) {
      case 'GST': return 'bg-emerald-100'
      case 'Income Tax': return 'bg-amber-100'
      case 'ROC': return 'bg-sky-100'
      case 'Labour': return 'bg-violet-100'
      case 'Custom': return 'bg-slate-100'
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-sm border-b px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
              <Scale className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Legal Notices</h1>
              <p className="text-xs text-slate-500">Notice Management & Response Tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" /> Add Notice
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
                      s.label === 'Overdue' ? 'bg-red-100' : s.label === 'Pending Response' ? 'bg-amber-100' : 'bg-emerald-100'
                    }`}>
                      <s.icon className={`h-4 w-4 ${
                        s.label === 'Overdue' ? 'text-red-600' : s.label === 'Pending Response' ? 'text-amber-600' : 'text-emerald-600'
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
            <TabsTrigger value="active" className="text-xs px-3 h-8">Active Notices</TabsTrigger>
            <TabsTrigger value="responses" className="text-xs px-3 h-8">Response Tracker</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs px-3 h-8">Templates</TabsTrigger>
            <TabsTrigger value="archive" className="text-xs px-3 h-8">Archive</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Notices by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <NoticeCategoryChart notices={notices} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Avg Response Time Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponseTimeChart />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Overdue Notices</CardTitle>
              </CardHeader>
              <CardContent>
                {notices.filter(n => n.status === 'Overdue').length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No overdue notices"
                    description="Overdue notices will surface here so you can respond before deadlines pass."
                    action={{ label: 'Add Notice', onClick: () => setCurrentView('legal-notices'), icon: Plus }}
                  />
                ) : (
                notices.filter(n => n.status === 'Overdue').map((n, i) => (
                  <motion.div
                    key={n.id}
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
                        <span className="text-xs font-semibold text-slate-900">{n.type}</span>
                        <Badge className={`text-[9px] ${priorityColor(n.priority)}`}>{n.priority}</Badge>
                      </div>
                      <span className="text-[11px] text-slate-600">{n.subject}</span>
                      <p className="text-[10px] text-red-600">Due: {n.dueDate} · {n.client} · {n.amount}</p>
                    </div>
                    <Button size="sm" className="h-7 text-[10px] bg-red-600 hover:bg-red-700 gap-1">
                      <Reply className="h-3 w-3" /> Respond Now
                    </Button>
                  </motion.div>
                ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Notices Tab */}
          <TabsContent value="active" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">All Active Notices</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search notices..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 w-56 pl-8 text-xs"
                      />
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                      <Filter className="h-3.5 w-3.5" /> Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredNotices.length === 0 ? (
                  <EmptyState
                    icon={Scale}
                    title="No active notices"
                    description="Register a notice received from any authority to start tracking responses and deadlines."
                    action={{ label: 'Add Notice', onClick: () => setCurrentView('legal-notices'), icon: Plus }}
                  />
                ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {filteredNotices.map((n, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${categoryBg(n.category)}`}>
                          {categoryIcon(n.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-900">{n.type}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{n.category}</Badge>
                            <Badge className={`text-[9px] ${priorityColor(n.priority)}`}>{n.priority}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-600 line-clamp-1">{n.subject}</span>
                          <p className="text-[10px] text-slate-500">{n.client} · {n.authority}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-[11px] text-slate-700">Due: {n.dueDate}</p>
                          <p className="text-[10px] text-slate-500">{n.amount}</p>
                        </div>
                        <Badge className={`text-[10px] ${statusColor(n.status)}`}>{n.status}</Badge>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-6 w-6 p-0">
                            <Reply className="h-3 w-3" />
                          </Button>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Response Tracker Tab */}
          <TabsContent value="responses" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Response Progress Tracker</CardTitle>
              </CardHeader>
              <CardContent>
                {responseTracker.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No response activities logged"
                    description="Once you start drafting replies, each stage (received, draft, review, filed) will be tracked here."
                    action={{ label: 'Add Notice', onClick: () => setCurrentView('legal-notices'), icon: Plus }}
                  />
                ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {responseTracker.map((r, i) => (
                      <motion.div
                        key={`${r.noticeId}-${r.stage}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                            r.stage === 'Notice Received' ? 'bg-slate-100' :
                            r.stage === 'Draft Response' ? 'bg-amber-100' :
                            r.stage === 'Review' ? 'bg-sky-100' :
                            r.stage === 'Appeal Filed' ? 'bg-violet-100' :
                            'bg-emerald-100'
                          }`}>
                            {r.stage === 'Notice Received' ? <FileText className="h-3.5 w-3.5 text-slate-600" /> :
                             r.stage === 'Draft Response' ? <Reply className="h-3.5 w-3.5 text-amber-600" /> :
                             r.stage === 'Review' ? <Eye className="h-3.5 w-3.5 text-sky-600" /> :
                             r.stage === 'Appeal Filed' ? <Gavel className="h-3.5 w-3.5 text-violet-600" /> :
                             <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{r.noticeId}</Badge>
                            <span className="text-xs font-semibold text-slate-900">{r.stage}</span>
                          </div>
                          <span className="text-[11px] text-slate-600">{r.action}</span>
                          <p className="text-[10px] text-slate-500">Assignee: {r.assignee} · {r.date}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Response Templates</CardTitle>
                  <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-3.5 w-3.5" /> Create Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {templates.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No response templates yet"
                    description="Save your first reply template to speed up responses to recurring notice types."
                    action={{ label: 'Create Template', onClick: () => setCurrentView('legal-notices'), icon: Plus }}
                  />
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((t, i) => (
                    <motion.div
                      key={t.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-lg border hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-emerald-600" />
                        <span className="text-xs font-semibold text-slate-900 truncate">{t.name}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 mb-2">{t.category}</Badge>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">{t.description}</p>
                      <Separator className="mb-2" />
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Used {t.uses} times</span>
                        <span>Last: {t.lastUsed}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 flex-1">
                          <Eye className="h-3 w-3" /> Preview
                        </Button>
                        <Button size="sm" className="h-6 text-[10px] gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700">
                          <Send className="h-3 w-3" /> Use
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Archive Tab */}
          <TabsContent value="archive" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Resolved & Archived Notices</CardTitle>
              </CardHeader>
              <CardContent>
                {archiveNotices.length === 0 ? (
                  <EmptyState
                    icon={Archive}
                    title="No archived notices"
                    description="Resolved notices will move here automatically, preserving outcomes and amounts for audit."
                    action={{ label: 'View Active', onClick: () => setActiveTab('active'), icon: Eye }}
                  />
                ) : (
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {archiveNotices.map((n, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                          <Archive className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{n.type}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{n.id}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-600">{n.subject}</span>
                          <p className="text-[10px] text-slate-500">{n.client} · Resolved: {n.resolvedDate}</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-[11px] text-emerald-700 font-medium">{n.outcome}</p>
                          <p className="text-[10px] text-slate-500">{n.amount}</p>
                        </div>
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Resolved</Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
