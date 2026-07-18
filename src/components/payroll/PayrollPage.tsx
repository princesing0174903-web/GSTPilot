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
  Wallet, TrendingUp, TrendingDown, Users, IndianRupee,
  FileText, Clock, CheckCircle2, AlertCircle, Download,
  Search, Filter, ChevronRight, Building2, ShieldCheck,
  Receipt, Banknote, PiggyBank, Calendar, UserCheck,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatINR(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return d }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const statCards = [
  { label: 'Total Payroll', value: '₹24,56,780', change: '+5.2%', up: true, icon: IndianRupee, color: 'emerald' },
  { label: 'Employees Processed', value: '42', change: '+2', up: true, icon: Users, color: 'emerald' },
  { label: 'PF Deposited', value: '₹2,94,814', change: '+5.2%', up: true, icon: Building2, color: 'emerald' },
  { label: 'ESI Deposited', value: '₹73,703', change: '+3.1%', up: true, icon: ShieldCheck, color: 'emerald' },
  { label: 'TDS Deducted', value: '₹4,12,340', change: '+8.7%', up: true, icon: Receipt, color: 'amber' },
]

const employees = [
  { id: 'EMP001', name: 'Rajesh Sharma', dept: 'Accounts', designation: 'Senior Accountant', gross: 85000, deductions: 18500, net: 66500, pf: 10200, esi: 1575, tds: 8500, status: 'Processed' },
  { id: 'EMP002', name: 'Priya Patel', dept: 'Tax', designation: 'Tax Consultant', gross: 72000, deductions: 15200, net: 56800, pf: 8640, esi: 1330, tds: 6200, status: 'Processed' },
  { id: 'EMP003', name: 'Amit Kumar', dept: 'Audit', designation: 'Audit Manager', gross: 95000, deductions: 22300, net: 72700, pf: 11400, esi: 1755, tds: 10500, status: 'Processed' },
  { id: 'EMP004', name: 'Sunita Reddy', dept: 'HR', designation: 'HR Executive', gross: 55000, deductions: 10800, net: 44200, pf: 6600, esi: 1015, tds: 3200, status: 'Pending' },
  { id: 'EMP005', name: 'Vikram Singh', dept: 'IT', designation: 'System Admin', gross: 68000, deductions: 14500, net: 53500, pf: 8160, esi: 1255, tds: 5600, status: 'Processed' },
  { id: 'EMP006', name: 'Meera Joshi', dept: 'Accounts', designation: 'Junior Accountant', gross: 42000, deductions: 7800, net: 34200, pf: 5040, esi: 775, tds: 1800, status: 'Processed' },
  { id: 'EMP007', name: 'Arjun Gupta', dept: 'Tax', designation: 'GST Specialist', gross: 78000, deductions: 16800, net: 61200, pf: 9360, esi: 1440, tds: 7200, status: 'Pending' },
  { id: 'EMP008', name: 'Kavita Iyer', dept: 'Compliance', designation: 'Compliance Officer', gross: 65000, deductions: 13500, net: 51500, pf: 7800, esi: 1200, tds: 4800, status: 'Processed' },
  { id: 'EMP009', name: 'Rohan Das', dept: 'Audit', designation: 'Audit Assistant', gross: 38000, deductions: 6500, net: 31500, pf: 4560, esi: 700, tds: 1200, status: 'Processed' },
  { id: 'EMP010', name: 'Nisha Agarwal', dept: 'Finance', designation: 'Finance Manager', gross: 92000, deductions: 21500, net: 70500, pf: 11040, esi: 1698, tds: 9800, status: 'Processed' },
]

const complianceItems = [
  { type: 'PF', month: '02/2026', dueDate: '15/03/2026', amount: '₹2,94,814', status: 'Deposited', challan: 'PF/2026/03/4521' },
  { type: 'ESI', month: '02/2026', dueDate: '15/03/2026', amount: '₹73,703', status: 'Deposited', challan: 'ESI/2026/03/7890' },
  { type: 'TDS', quarter: 'Q4 FY25', dueDate: '31/05/2026', amount: '₹4,12,340', status: 'Pending', challan: '—' },
  { type: 'PF', month: '01/2026', dueDate: '15/02/2026', amount: '₹2,80,500', status: 'Deposited', challan: 'PF/2026/02/3890' },
  { type: 'ESI', month: '01/2026', dueDate: '15/02/2026', amount: '₹71,200', status: 'Deposited', challan: 'ESI/2026/02/6543' },
  { type: 'TDS', quarter: 'Q3 FY25', dueDate: '31/01/2026', amount: '₹3,85,600', status: 'Deposited', challan: 'TDS/2026/01/2345' },
  { type: 'Professional Tax', month: '02/2026', dueDate: '28/02/2026', amount: '₹12,500', status: 'Deposited', challan: 'PT/2026/02/1122' },
  { type: 'Labour Welfare', quarter: 'Q4 FY25', dueDate: '15/04/2026', amount: '₹6,300', status: 'Pending', challan: '—' },
]

const payslipStatus = [
  { month: 'February 2026', generated: 42, sent: 38, pending: 4, date: '01/03/2026' },
  { month: 'January 2026', generated: 40, sent: 40, pending: 0, date: '01/02/2026' },
  { month: 'December 2025', generated: 40, sent: 40, pending: 0, date: '01/01/2026' },
  { month: 'November 2025', generated: 39, sent: 39, pending: 0, date: '01/12/2025' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function PayrollBreakdownChart() {
  const data = [
    { label: 'Basic', value: 1240000, color: '#2563EB' },
    { label: 'HRA', value: 496000, color: '#34d399' },
    { label: 'DA', value: 248000, color: '#6ee7b7' },
    { label: 'Allowances', value: 312780, color: '#a7f3d0' },
    { label: 'PF', value: 163980, color: '#f59e0b' },
    { label: 'ESI', value: 44220, color: '#fbbf24' },
    { label: 'TDS', value: 412340, color: '#ef4444' },
  ]
  const total = data.reduce((s, d) => s + d.value, 0)
  const maxVal = Math.max(...data.map(d => d.value))
  const barH = 28
  const gap = 8
  const h = data.length * (barH + gap) + 40
  const chartW = 320

  return (
    <svg viewBox={`0 0 ${chartW + 100} ${h}`} className="w-full h-auto">
      {data.map((d, i) => {
        const w = (d.value / maxVal) * chartW
        return (
          <g key={d.label} transform={`translate(0, ${i * (barH + gap) + 20})`}>
            <text x="0" y={barH / 2 + 4} className="text-[10px] fill-slate-600" textAnchor="start">{d.label}</text>
            <rect x="80" y="0" width={w} height={barH} rx="4" fill={d.color} opacity="0.85">
              <animate attributeName="width" from="0" to={w} dur="0.6s" fill="freeze" />
            </rect>
            <text x={80 + w + 6} y={barH / 2 + 4} className="text-[9px] fill-slate-500">
              {formatINR(d.value)}
            </text>
          </g>
        )
      })}
      <text x={(chartW + 100) / 2} y={h - 4} className="text-[10px] fill-slate-400" textAnchor="middle">
        Total Payroll: {formatINR(total)}
      </text>
    </svg>
  )
}

function MonthlyPayrollTrend() {
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb']
  const values = [21.5, 22.1, 22.8, 23.2, 23.8, 24.6]
  const maxVal = Math.max(...values)
  const minVal = Math.min(...values) - 1
  const w = 340
  const h = 160
  const padL = 40
  const padB = 30
  const padT = 10
  const chartW = w - padL - 10
  const chartH = h - padB - padT

  const points = values.map((v, i) => {
    const x = padL + (i / (values.length - 1)) * chartW
    const y = padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH
    return { x, y, v }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = pathD + ` L${points[points.length - 1].x},${h - padB} L${points[0].x},${h - padB} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 1, 2, 3].map(i => {
        const y = padT + (i / 3) * chartH
        return <line key={i} x1={padL} y1={y} x2={w - 10} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
      })}
      <path d={areaD} fill="url(#payrollGrad)" opacity="0.3" />
      <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#2563EB" stroke="white" strokeWidth="1.5" />
          <text x={p.x} y={p.y - 8} className="text-[8px] fill-slate-500" textAnchor="middle">₹{p.v}L</text>
        </g>
      ))}
      {months.map((m, i) => (
        <text key={m} x={padL + (i / (months.length - 1)) * chartW} y={h - 8} className="text-[9px] fill-slate-400" textAnchor="middle">{m}</text>
      ))}
      <defs>
        <linearGradient id="payrollGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
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

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.dept.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const statusColor = (s: string) => {
    switch (s) {
      case 'Processed': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200'
      case 'Deposited': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
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
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Payroll</h1>
              <p className="text-xs text-slate-500">Salary Processing & Compliance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <FileText className="h-3.5 w-3.5" /> Process Payroll
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
            <TabsTrigger value="process" className="text-xs px-3 h-8">Process Payroll</TabsTrigger>
            <TabsTrigger value="employees" className="text-xs px-3 h-8">Employees</TabsTrigger>
            <TabsTrigger value="compliance" className="text-xs px-3 h-8">Compliance</TabsTrigger>
            <TabsTrigger value="payslips" className="text-xs px-3 h-8">Payslips</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Monthly Payroll Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonthlyPayrollTrend />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Salary Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <PayrollBreakdownChart />
                </CardContent>
              </Card>
            </div>

            {/* Payroll Summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Monthly Summary — February 2026</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-700">Gross Pay</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-800">₹24,56,780</p>
                    <p className="text-[11px] text-emerald-600">42 employees</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <PiggyBank className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">Total Deductions</span>
                    </div>
                    <p className="text-xl font-bold text-amber-800">₹6,21,540</p>
                    <p className="text-[11px] text-amber-600">PF + ESI + TDS + PT</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <IndianRupee className="h-4 w-4 text-slate-600" />
                      <span className="text-xs font-medium text-slate-700">Net Pay</span>
                    </div>
                    <p className="text-xl font-bold text-slate-800">₹18,35,240</p>
                    <p className="text-[11px] text-slate-600">Bank transfer ready</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Process Payroll Tab */}
          <TabsContent value="process" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Process Monthly Payroll</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Payroll Month</label>
                    <Input type="month" defaultValue="2026-02" className="h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Payment Date</label>
                    <Input type="date" defaultValue="2026-03-01" className="h-9 text-sm" />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-9 gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Run Payroll
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-700">Processing Steps</p>
                  {[
                    { step: 'Verify attendance data', done: true, icon: CheckCircle2 },
                    { step: 'Calculate overtime & bonuses', done: true, icon: CheckCircle2 },
                    { step: 'Compute PF & ESI deductions', done: true, icon: CheckCircle2 },
                    { step: 'Calculate TDS as per Section 192', done: false, icon: Clock },
                    { step: 'Generate bank payment file', done: false, icon: Clock },
                    { step: 'Issue payslips to employees', done: false, icon: Clock },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50">
                      <s.icon className={`h-4 w-4 ${s.done ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span className={`text-xs ${s.done ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>{s.step}</span>
                      <Badge variant="outline" className={`ml-auto text-[10px] ${s.done ? 'border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                        {s.done ? 'Complete' : 'Pending'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Employee Salary Breakdown</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search employee..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-48 pl-8 text-xs"
                    />
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">{emp.name}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{emp.dept}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">{emp.designation} · {emp.id}</span>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-semibold text-slate-900">{formatINR(emp.net)}</p>
                          <p className="text-[10px] text-slate-500">Net Pay</p>
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

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">PF / ESI / TDS Compliance Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {complianceItems.map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          c.type === 'PF' ? 'bg-emerald-100' : c.type === 'ESI' ? 'bg-amber-100' : c.type === 'TDS' ? 'bg-red-100' : 'bg-slate-100'
                        }`}>
                          {c.type === 'PF' ? <Building2 className="h-4 w-4 text-emerald-600" /> :
                           c.type === 'ESI' ? <ShieldCheck className="h-4 w-4 text-amber-600" /> :
                           c.type === 'TDS' ? <Receipt className="h-4 w-4 text-red-600" /> :
                           <FileText className="h-4 w-4 text-slate-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{c.type}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{c.month || c.quarter}</Badge>
                          </div>
                          <span className="text-[11px] text-slate-500">Due: {c.dueDate} · Challan: {c.challan}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{c.amount}</span>
                        <Badge className={`text-[10px] ${statusColor(c.status)}`}>{c.status}</Badge>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payslips Tab */}
          <TabsContent value="payslips" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Payslip Generation Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payslipStatus.map((p, i) => (
                    <motion.div
                      key={p.month}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                        <Calendar className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-900">{p.month}</span>
                        <p className="text-[11px] text-slate-500">Generated on {p.date}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="text-emerald-600 font-medium">{p.generated} generated</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-emerald-700 font-medium">{p.sent} sent</span>
                        {p.pending > 0 && (
                          <>
                            <span className="text-slate-400">|</span>
                            <span className="text-amber-600 font-medium">{p.pending} pending</span>
                          </>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                        <Download className="h-3 w-3" /> Download All
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Quick Payslip Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button variant="outline" className="h-16 flex flex-col gap-1 text-xs">
                    <FileText className="h-5 w-5 text-emerald-600" />
                    Generate Payslips
                  </Button>
                  <Button variant="outline" className="h-16 flex flex-col gap-1 text-xs">
                    <UserCheck className="h-5 w-5 text-emerald-600" />
                    Send via Email
                  </Button>
                  <Button variant="outline" className="h-16 flex flex-col gap-1 text-xs">
                    <Download className="h-5 w-5 text-emerald-600" />
                    Bulk Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
