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

const statCards = [
  { label: 'Active Notices', value: '8', change: '+2', up: false, icon: Scale, color: 'emerald' },
  { label: 'Pending Response', value: '5', change: '+1', up: false, icon: Clock, color: 'amber' },
  { label: 'Overdue', value: '2', change: '+1', up: false, icon: AlertTriangle, color: 'red' },
  { label: 'Resolved', value: '23', change: '+4', up: true, icon: CheckCircle2, color: 'emerald' },
  { label: 'Avg Response Time', value: '6.2 days', change: '-1.3', up: true, icon: TrendingDown, color: 'emerald' },
]

type NoticeCategory = 'GST' | 'Income Tax' | 'ROC' | 'Labour' | 'Custom'
type NoticeStatus = 'Active' | 'Pending Response' | 'Responded' | 'Overdue' | 'Resolved' | 'Closed'

const notices = [
  { id: 'NTC001', type: 'GST SCN' as const, category: 'GST' as NoticeCategory, authority: 'GST Commissioner, Mumbai', subject: 'Show Cause Notice for ITC mismatch FY 2023-24', client: 'Sharma Enterprises Pvt Ltd', date: '15/02/2026', dueDate: '15/03/2026', amount: '₹4,56,780', status: 'Active' as NoticeStatus, priority: 'High' },
  { id: 'NTC002', type: 'IT Assessment' as const, category: 'Income Tax' as NoticeCategory, authority: 'AO Ward 2(3), Delhi', subject: 'Scrutiny Assessment u/s 143(2) for AY 2024-25', client: 'Mehta Consulting Pvt Ltd', date: '28/01/2026', dueDate: '10/03/2026', amount: '—', status: 'Pending Response' as NoticeStatus, priority: 'High' },
  { id: 'NTC003', type: 'ROC Notice' as const, category: 'ROC' as NoticeCategory, authority: 'ROC Jaipur', subject: 'Non-filing of ADT-1 for FY 2023-24', client: 'Kumar Textiles Pvt Ltd', date: '10/02/2026', dueDate: '10/03/2026', amount: '₹12,000', status: 'Overdue' as NoticeStatus, priority: 'Medium' },
  { id: 'NTC004', type: 'GST Assessment' as const, category: 'GST' as NoticeCategory, authority: 'ACST, Ahmedabad', subject: 'Best Judgment Assessment u/s 62 for GSTR-3B non-filing', client: 'Patel Industries LLP', date: '05/02/2026', dueDate: '05/04/2026', amount: '₹2,34,500', status: 'Active' as NoticeStatus, priority: 'Medium' },
  { id: 'NTC005', type: 'Labour Notice' as const, category: 'Labour' as NoticeCategory, authority: 'Labour Commissioner, Mumbai', subject: 'PF compliance inspection for Q3 FY25', client: 'Sharma Enterprises Pvt Ltd', date: '20/02/2026', dueDate: '20/03/2026', amount: '—', status: 'Pending Response' as NoticeStatus, priority: 'Medium' },
  { id: 'NTC006', type: 'IT Demand' as const, category: 'Income Tax' as NoticeCategory, authority: 'CIT(A), Mumbai', subject: 'Demand notice u/s 156 for AY 2022-23', client: 'Reddy Infra Pvt Ltd', date: '01/02/2026', dueDate: '01/03/2026', amount: '₹8,90,000', status: 'Overdue' as NoticeStatus, priority: 'Critical' },
  { id: 'NTC007', type: 'GST Summons' as const, category: 'GST' as NoticeCategory, authority: 'DGGI, Hyderabad', subject: 'Summons u/s 70 for records verification', client: 'Reddy Infra Pvt Ltd', date: '12/02/2026', dueDate: '12/04/2026', amount: '—', status: 'Active' as NoticeStatus, priority: 'High' },
  { id: 'NTC008', type: 'Custom Notice' as const, category: 'Custom' as NoticeCategory, authority: 'DGFT, New Delhi', subject: 'EPCG export obligation shortfall', client: 'Singh Logistics LLP', date: '18/02/2026', dueDate: '18/04/2026', amount: '₹1,45,600', status: 'Active' as NoticeStatus, priority: 'Low' },
]

const responseTracker = [
  { noticeId: 'NTC001', stage: 'Notice Received', date: '15/02/2026', action: 'Reviewed notice details and gathered documents', assignee: 'Rajesh Sharma' },
  { noticeId: 'NTC001', stage: 'Draft Response', date: '22/02/2026', action: 'Prepared detailed reply with ITC reconciliation', assignee: 'Priya Patel' },
  { noticeId: 'NTC001', stage: 'Review', date: '28/02/2026', action: 'Senior review of draft response', assignee: 'Amit Kumar' },
  { noticeId: 'NTC002', stage: 'Notice Received', date: '28/01/2026', action: 'Scrutiny notice received, initiated document collection', assignee: 'Arjun Gupta' },
  { noticeId: 'NTC002', stage: 'Document Collection', date: '10/02/2026', action: 'Gathering bank statements, invoices, and proofs', assignee: 'Meera Joshi' },
  { noticeId: 'NTC006', stage: 'Notice Received', date: '01/02/2026', action: 'Demand notice received, appeal under consideration', assignee: 'Vikram Singh' },
  { noticeId: 'NTC006', stage: 'Appeal Filed', date: '15/02/2026', action: 'Filed appeal with CIT(A) for stay of demand', assignee: 'Nisha Agarwal' },
]

const templates = [
  { name: 'GST SCN Reply Template', category: 'GST', lastUsed: '22/02/2026', uses: 15, description: 'Standard reply format for GST Show Cause Notices covering ITC mismatch, short payment, and wrong availing of credit' },
  { name: 'IT Scrutiny Response', category: 'Income Tax', lastUsed: '10/02/2026', uses: 12, description: 'Comprehensive response template for scrutiny assessment u/s 143(2) and 143(3)' },
  { name: 'ROC Filing Reply', category: 'ROC', lastUsed: '05/01/2026', uses: 8, description: 'Reply template for ROC notices related to non-filing of annual returns and financial statements' },
  { name: 'PF Inspection Response', category: 'Labour', lastUsed: '20/12/2025', uses: 5, description: 'Response template for PF inspection notices and compliance verification requests' },
  { name: 'GST Assessment Reply', category: 'GST', lastUsed: '28/01/2026', uses: 10, description: 'Reply template for best judgment assessment u/s 62 and ex-parte assessment orders' },
  { name: 'IT Demand Appeal', category: 'Income Tax', lastUsed: '15/02/2026', uses: 7, description: 'Template for filing appeal against demand notice u/s 156 with stay application' },
]

const archiveNotices = [
  { id: 'NTC-A01', type: 'GST SCN', client: 'Sharma Enterprises Pvt Ltd', subject: 'ITC mismatch Q2 FY23', resolvedDate: '15/12/2025', outcome: 'Resolved - ITC allowed', amount: '₹2,34,500' },
  { id: 'NTC-A02', type: 'IT Assessment', client: 'Mehta Consulting Pvt Ltd', subject: 'Scrutiny AY 2022-23', resolvedDate: '20/11/2025', outcome: 'No adjustment required', amount: '—' },
  { id: 'NTC-A03', type: 'ROC Notice', client: 'Patel Industries LLP', subject: 'DIR-3 KYC pending', resolvedDate: '05/10/2025', outcome: 'KYC completed', amount: '₹5,000' },
  { id: 'NTC-A04', type: 'GST Summons', client: 'Kumar Textiles Pvt Ltd', subject: 'Records verification', resolvedDate: '30/09/2025', outcome: 'Documents submitted', amount: '—' },
  { id: 'NTC-A05', type: 'IT Demand', client: 'Singh Logistics LLP', subject: 'Demand AY 2021-22', resolvedDate: '18/08/2025', outcome: 'Appeal allowed', amount: '₹3,45,000' },
  { id: 'NTC-A06', type: 'Labour Notice', client: 'Reddy Infra Pvt Ltd', subject: 'ESI compliance check', resolvedDate: '25/07/2025', outcome: 'Compliance confirmed', amount: '—' },
  { id: 'NTC-A07', type: 'GST SCN', client: 'Sharma Enterprises Pvt Ltd', subject: 'E-way bill mismatch', resolvedDate: '12/06/2025', outcome: 'Penalty waived', amount: '₹50,000' },
  { id: 'NTC-A08', type: 'Custom Notice', client: 'Patel Industries LLP', subject: 'Import duty classification', resolvedDate: '28/05/2025', outcome: 'Classification corrected', amount: '₹78,900' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function NoticeCategoryChart() {
  const data = [
    { label: 'GST', value: 3, color: '#10b981' },
    { label: 'Income Tax', value: 2, color: '#f59e0b' },
    { label: 'ROC', value: 1, color: '#6ee7b7' },
    { label: 'Labour', value: 1, color: '#94a3b8' },
    { label: 'Custom', value: 1, color: '#a7f3d0' },
  ]
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
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredNotices = notices.filter(n =>
    n.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.type.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
                  <NoticeCategoryChart />
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
                {notices.filter(n => n.status === 'Overdue').map((n, i) => (
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
                ))}
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
