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
  UserCircle, TrendingUp, TrendingDown, Users, Search,
  ChevronRight, Calendar, Clock, UserCheck, UserX,
  Briefcase, Building2, MapPin, Phone, Mail,
  Download, Filter, Plus, ArrowUpRight,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const statCards = [
  { label: 'Total Employees', value: '48', change: '+3', up: true, icon: Users, color: 'emerald' },
  { label: 'Active', value: '42', change: '+2', up: true, icon: UserCheck, color: 'emerald' },
  { label: 'On Leave', value: '4', change: '+1', up: false, icon: Calendar, color: 'amber' },
  { label: 'New Hires', value: '5', change: '+2', up: true, icon: ArrowUpRight, color: 'emerald' },
  { label: 'Attrition Rate', value: '4.2%', change: '-0.8%', up: true, icon: TrendingDown, color: 'emerald' },
]

const employees = [
  { id: 'EMP001', name: 'Rajesh Sharma', dept: 'Accounts', designation: 'Senior Accountant', status: 'Active', doj: '15/03/2021', phone: '9876543210', email: 'rajesh@sharma.com' },
  { id: 'EMP002', name: 'Priya Patel', dept: 'Tax', designation: 'Tax Consultant', status: 'Active', doj: '01/07/2022', phone: '9876543211', email: 'priya@patel.com' },
  { id: 'EMP003', name: 'Amit Kumar', dept: 'Audit', designation: 'Audit Manager', status: 'Active', doj: '22/09/2020', phone: '9876543212', email: 'amit@kumar.com' },
  { id: 'EMP004', name: 'Sunita Reddy', dept: 'HR', designation: 'HR Executive', status: 'On Leave', doj: '10/01/2023', phone: '9876543213', email: 'sunita@reddy.com' },
  { id: 'EMP005', name: 'Vikram Singh', dept: 'IT', designation: 'System Admin', status: 'Active', doj: '05/11/2021', phone: '9876543214', email: 'vikram@singh.com' },
  { id: 'EMP006', name: 'Meera Joshi', dept: 'Accounts', designation: 'Junior Accountant', status: 'Active', doj: '18/06/2023', phone: '9876543215', email: 'meera@joshi.com' },
  { id: 'EMP007', name: 'Arjun Gupta', dept: 'Tax', designation: 'GST Specialist', status: 'Active', doj: '12/04/2022', phone: '9876543216', email: 'arjun@gupta.com' },
  { id: 'EMP008', name: 'Kavita Iyer', dept: 'Compliance', designation: 'Compliance Officer', status: 'Active', doj: '08/08/2022', phone: '9876543217', email: 'kavita@iyer.com' },
  { id: 'EMP009', name: 'Rohan Das', dept: 'Audit', designation: 'Audit Assistant', status: 'Probation', doj: '01/01/2026', phone: '9876543218', email: 'rohan@das.com' },
  { id: 'EMP010', name: 'Nisha Agarwal', dept: 'Finance', designation: 'Finance Manager', status: 'Active', doj: '20/02/2020', phone: '9876543219', email: 'nisha@agarwal.com' },
  { id: 'EMP011', name: 'Sanjay Nair', dept: 'IT', designation: 'Developer', status: 'Active', doj: '14/05/2023', phone: '9876543220', email: 'sanjay@nair.com' },
  { id: 'EMP012', name: 'Deepa Rao', dept: 'Accounts', designation: 'Accounts Manager', status: 'On Leave', doj: '03/10/2019', phone: '9876543221', email: 'deepa@rao.com' },
]

const attendanceData = [
  { date: '03/03/2026', present: 40, absent: 3, leave: 4, wfh: 1, late: 2 },
  { date: '02/03/2026', present: 41, absent: 2, leave: 4, wfh: 1, late: 1 },
  { date: '28/02/2026', present: 38, absent: 5, leave: 3, wfh: 2, late: 3 },
  { date: '27/02/2026', present: 42, absent: 1, leave: 3, wfh: 2, late: 1 },
  { date: '26/02/2026', present: 39, absent: 3, leave: 4, wfh: 2, late: 2 },
]

const leaveRequests = [
  { id: 'LR001', employee: 'Sunita Reddy', type: 'Casual Leave', from: '01/03/2026', to: '05/03/2026', days: 5, status: 'Approved', reason: 'Family function' },
  { id: 'LR002', employee: 'Deepa Rao', type: 'Medical Leave', from: '28/02/2026', to: '04/03/2026', days: 5, status: 'Approved', reason: 'Medical procedure' },
  { id: 'LR003', employee: 'Vikram Singh', type: 'Earned Leave', from: '10/03/2026', to: '14/03/2026', days: 5, status: 'Pending', reason: 'Personal travel' },
  { id: 'LR004', employee: 'Priya Patel', type: 'Casual Leave', from: '15/03/2026', to: '16/03/2026', days: 2, status: 'Pending', reason: 'Personal work' },
  { id: 'LR005', employee: 'Arjun Gupta', type: 'Comp Off', from: '08/03/2026', to: '08/03/2026', days: 1, status: 'Approved', reason: 'Weekend overtime compensation' },
  { id: 'LR006', employee: 'Rohan Das', type: 'Sick Leave', from: '03/03/2026', to: '03/03/2026', days: 1, status: 'Pending', reason: 'Not feeling well' },
]

const departments = [
  { name: 'Accounts', head: 'Nisha Agarwal', count: 10, open: 1, budget: '₹8,50,000' },
  { name: 'Tax', head: 'Priya Patel', count: 8, open: 2, budget: '₹6,40,000' },
  { name: 'Audit', head: 'Amit Kumar', count: 9, open: 0, budget: '₹7,20,000' },
  { name: 'IT', head: 'Vikram Singh', count: 6, open: 1, budget: '₹5,40,000' },
  { name: 'HR', head: 'Sunita Reddy', count: 5, open: 0, budget: '₹3,75,000' },
  { name: 'Compliance', head: 'Kavita Iyer', count: 4, open: 1, budget: '₹3,20,000' },
  { name: 'Finance', head: 'Nisha Agarwal', count: 6, open: 0, budget: '₹5,52,000' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function AttendanceChart() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const present = [40, 41, 39, 42, 38]
  const absent = [3, 2, 4, 1, 5]
  const maxVal = 48
  const w = 320
  const h = 180
  const padL = 35
  const padB = 25
  const padT = 10
  const chartW = w - padL - 10
  const chartH = h - padB - padT
  const groupW = chartW / days.length
  const barW = groupW * 0.3

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 1, 2, 3, 4].map(i => {
        const y = padT + (i / 4) * chartH
        return <line key={i} x1={padL} y1={y} x2={w - 10} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
      })}
      {days.map((day, i) => {
        const x = padL + i * groupW + groupW * 0.15
        const pH = (present[i] / maxVal) * chartH
        const aH = (absent[i] / maxVal) * chartH
        return (
          <g key={day}>
            <rect x={x} y={padT + chartH - pH} width={barW} height={pH} rx="2" fill="#2563EB" opacity="0.85">
              <animate attributeName="height" from="0" to={pH} dur="0.5s" fill="freeze" />
              <animate attributeName="y" from={padT + chartH} to={padT + chartH - pH} dur="0.5s" fill="freeze" />
            </rect>
            <rect x={x + barW + 2} y={padT + chartH - aH} width={barW} height={aH} rx="2" fill="#f59e0b" opacity="0.85">
              <animate attributeName="height" from="0" to={aH} dur="0.5s" fill="freeze" />
              <animate attributeName="y" from={padT + chartH} to={padT + chartH - aH} dur="0.5s" fill="freeze" />
            </rect>
            <text x={x + barW} y={h - 6} className="text-[9px] fill-slate-400" textAnchor="middle">{day}</text>
          </g>
        )
      })}
      <text x={padL - 5} y={padT + 4} className="text-[8px] fill-slate-400" textAnchor="end">48</text>
      <text x={padL - 5} y={padT + chartH / 2 + 4} className="text-[8px] fill-slate-400" textAnchor="end">24</text>
      <text x={padL - 5} y={padT + chartH + 4} className="text-[8px] fill-slate-400" textAnchor="end">0</text>
    </svg>
  )
}

function DepartmentDonut() {
  const data = [
    { label: 'Accounts', value: 10, color: '#2563EB' },
    { label: 'Tax', value: 8, color: '#3B82F6' },
    { label: 'Audit', value: 9, color: '#60A5FA' },
    { label: 'IT', value: 6, color: '#f59e0b' },
    { label: 'HR', value: 5, color: '#fbbf24' },
    { label: 'Compliance', value: 4, color: '#94a3b8' },
    { label: 'Finance', value: 6, color: '#93C5FD' },
  ]
  const total = data.reduce((s, d) => s + d.value, 0)
  const cx = 80
  const cy = 80
  const r = 55
  const innerR = 35

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
      <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0">
        {slices.map((s, i) => (
          <path
            key={i}
            d={describeArc(cx, cy, r, s.startAngle, s.endAngle)}
            fill="none"
            stroke={s.color}
            strokeWidth="20"
            strokeLinecap="butt"
          />
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="white" />
        <text x={cx} y={cy - 6} className="text-[16px] font-bold fill-slate-900" textAnchor="middle">{total}</text>
        <text x={cx} y={cy + 10} className="text-[8px] fill-slate-500" textAnchor="middle">Total</text>
      </svg>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const stagger = {
  container: { transition: { staggerChildren: 0.06 } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35 } },
}

export default function HRMSPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.dept.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.designation.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const statusColor = (s: string) => {
    switch (s) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'On Leave': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Probation': return 'bg-sky-100 text-sky-700 border-sky-200'
      case 'Inactive': return 'bg-slate-100 text-slate-700 border-slate-200'
      default: return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  const leaveStatusColor = (s: string) => {
    switch (s) {
      case 'Approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-200'
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
              <UserCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">HRMS</h1>
              <p className="text-xs text-slate-500">People Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-3.5 w-3.5" /> Add Employee
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                      <s.icon className="h-4 w-4 text-emerald-600" />
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
            <TabsTrigger value="directory" className="text-xs px-3 h-8">Directory</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs px-3 h-8">Attendance</TabsTrigger>
            <TabsTrigger value="leaves" className="text-xs px-3 h-8">Leaves</TabsTrigger>
            <TabsTrigger value="departments" className="text-xs px-3 h-8">Departments</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Weekly Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <AttendanceChart />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Department Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <DepartmentDonut />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { action: 'Rohan Das joined as Audit Assistant', date: '01/03/2026', type: 'hire' },
                    { action: 'Sunita Reddy started casual leave', date: '01/03/2026', type: 'leave' },
                    { action: 'Annual appraisal cycle initiated', date: '28/02/2026', type: 'event' },
                    { action: 'Deepa Rao on medical leave', date: '28/02/2026', type: 'leave' },
                    { action: 'Vikram Singh completed 4 years', date: '05/11/2025', type: 'milestone' },
                  ].map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        a.type === 'hire' ? 'bg-emerald-100 text-emerald-600' :
                        a.type === 'leave' ? 'bg-amber-100 text-amber-600' :
                        a.type === 'milestone' ? 'bg-violet-100 text-violet-600' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {a.type === 'hire' ? <UserCheck className="h-3.5 w-3.5" /> :
                         a.type === 'leave' ? <Calendar className="h-3.5 w-3.5" /> :
                         a.type === 'milestone' ? <Briefcase className="h-3.5 w-3.5" /> :
                         <Clock className="h-3.5 w-3.5" />}
                      </div>
                      <span className="text-xs text-slate-700 flex-1">{a.action}</span>
                      <span className="text-[10px] text-slate-400">{a.date}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Directory Tab */}
          <TabsContent value="directory" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Employee Directory</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search by name, dept..."
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
                    {filteredEmployees.map((emp) => (
                      <motion.div
                        key={emp.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">{emp.name}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{emp.dept}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">{emp.designation} · DOJ: {emp.doj}</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-4">
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Phone className="h-3 w-3" /> {emp.phone}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Mail className="h-3 w-3" /> {emp.email}
                          </div>
                        </div>
                        <Badge className={`text-[10px] ${statusColor(emp.status)}`}>{emp.status}</Badge>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Daily Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {attendanceData.map((a, i) => (
                      <motion.div
                        key={a.date}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 p-3 rounded-lg border"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                          <Calendar className="h-4 w-4 text-slate-600" />
                        </div>
                        <span className="text-xs font-semibold text-slate-900 w-20">{a.date}</span>
                        <div className="flex-1 flex items-center gap-4 text-[11px]">
                          <span className="text-emerald-700 font-medium">{a.present} Present</span>
                          <span className="text-red-600 font-medium">{a.absent} Absent</span>
                          <span className="text-amber-600 font-medium">{a.leave} Leave</span>
                          <span className="text-violet-600 font-medium">{a.wfh} WFH</span>
                          <span className="text-orange-600 font-medium">{a.late} Late</span>
                        </div>
                        <div className="w-24 bg-slate-100 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(a.present / 48) * 100}%` }} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaves Tab */}
          <TabsContent value="leaves" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {leaveRequests.map((lr, i) => (
                      <motion.div
                        key={lr.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                          {lr.employee.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{lr.employee}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{lr.type}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">{lr.from} — {lr.to} · {lr.days} day(s) · {lr.reason}</span>
                        </div>
                        <Badge className={`text-[10px] ${leaveStatusColor(lr.status)}`}>{lr.status}</Badge>
                        {lr.status === 'Pending' && (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-emerald-600 hover:bg-emerald-50">
                              <UserCheck className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-red-600 hover:bg-red-50">
                              <UserX className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Department Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map((dept, i) => (
                    <motion.div
                      key={dept.name}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="p-4 rounded-lg border hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                          <Building2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-slate-900">{dept.name}</span>
                          <p className="text-[10px] text-slate-500">Head: {dept.head}</p>
                        </div>
                      </div>
                      <Separator className="mb-3" />
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{dept.count}</p>
                          <p className="text-[10px] text-slate-500">Members</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-emerald-600">{dept.open}</p>
                          <p className="text-[10px] text-slate-500">Open Roles</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{dept.budget}</p>
                          <p className="text-[10px] text-slate-500">Budget</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
