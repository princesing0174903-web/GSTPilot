'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  IndianRupee, FileText, BarChart3, Scale, CreditCard,
  Wallet, Building2, ChevronRight, Plus, Search,
  ArrowRight, CheckCircle2, Clock, AlertCircle,
  PieChart, RefreshCw, Download, Filter,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN')
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

// ═══════════════════════════════════════════════════════════════════════════════
// SVG CHARTS
// ═══════════════════════════════════════════════════════════════════════════════

function SparklineChart({ data, color = '#10b981', height = 40 }: { data: number[]; color?: string; height?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 120
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - ((v - min) / range) * (height - 4) - 2}`)
  return (
    <svg width={w} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${pts.join(' ')} ${w},${height}`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BarChartMini({ data, labels, color = '#10b981' }: { data: number[]; labels: string[]; color?: string }) {
  const max = Math.max(...data)
  const barW = 28
  const gap = 8
  const h = 80
  return (
    <svg width={data.length * (barW + gap)} height={h + 20} className="overflow-visible">
      {data.map((v, i) => {
        const barH = (v / max) * (h - 10)
        return (
          <g key={i}>
            <rect x={i * (barW + gap)} y={h - barH} width={barW} height={barH} rx={4} fill={color} opacity={0.8} />
            <text x={i * (barW + gap) + barW / 2} y={h + 14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{labels[i]}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const statCards = [
  { label: 'Total Revenue', value: 8745000, change: 12.4, icon: TrendingUp, color: 'emerald' },
  { label: 'Total Expenses', value: 5234000, change: -3.2, icon: TrendingDown, color: 'rose' },
  { label: 'Net Profit', value: 3511000, change: 28.6, icon: ArrowUpRight, color: 'emerald' },
  { label: 'Retained Earnings', value: 2890000, change: 8.1, icon: Wallet, color: 'slate' },
]

const chartOfAccounts = [
  { code: '1000', name: 'Cash & Bank', type: 'Asset', balance: 2345000, change: 5.2 },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', balance: 1890000, change: -2.1 },
  { code: '1200', name: 'Inventory', type: 'Asset', balance: 567000, change: 1.8 },
  { code: '1300', name: 'Fixed Assets', type: 'Asset', balance: 4500000, change: 0.5 },
  { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: -1234000, change: -4.3 },
  { code: '2100', name: 'GST Payable', type: 'Liability', balance: -456000, change: 12.1 },
  { code: '2200', name: 'TDS Payable', type: 'Liability', balance: -189000, change: 6.7 },
  { code: '2300', name: 'Loans & Borrowings', type: 'Liability', balance: -2000000, change: 0 },
  { code: '3000', name: 'Share Capital', type: 'Equity', balance: -5000000, change: 0 },
  { code: '3100', name: 'Retained Earnings', type: 'Equity', balance: -2890000, change: 8.1 },
  { code: '4000', name: 'Sales Revenue', type: 'Revenue', balance: -8745000, change: 12.4 },
  { code: '4100', name: 'Service Income', type: 'Revenue', balance: -3210000, change: 15.2 },
  { code: '5000', name: 'Cost of Goods Sold', type: 'Expense', balance: 3245000, change: -1.5 },
  { code: '5100', name: 'Salaries & Wages', type: 'Expense', balance: 1456000, change: 3.2 },
  { code: '5200', name: 'Rent & Utilities', type: 'Expense', balance: 345000, change: 0 },
  { code: '5300', name: 'Depreciation', type: 'Expense', balance: 188000, change: 2.1 },
]

const journalEntries = [
  { id: 'JE-2026-0345', date: '15/03/2026', description: 'Sales Invoice - Sharma & Associates Pvt Ltd', debit: 450000, credit: 0, status: 'posted' },
  { id: 'JE-2026-0344', date: '14/03/2026', description: 'Rent Payment - Patel Properties', debit: 85000, credit: 85000, status: 'posted' },
  { id: 'JE-2026-0343', date: '14/03/2026', description: 'Salary Disbursement - March 2026', debit: 485000, credit: 485000, status: 'posted' },
  { id: 'JE-2026-0342', date: '13/03/2026', description: 'GST Payment - Feb 2026', debit: 156000, credit: 156000, status: 'posted' },
  { id: 'JE-2026-0341', date: '13/03/2026', description: 'Purchase - Mehta Suppliers Pvt Ltd', debit: 234000, credit: 0, status: 'posted' },
  { id: 'JE-2026-0340', date: '12/03/2026', description: 'Bank Charges - HDFC Bank', debit: 2500, credit: 2500, status: 'posted' },
  { id: 'JE-2026-0339', date: '12/03/2026', description: 'TDS Deposit - Kumar Enterprises', debit: 0, credit: 45000, status: 'pending' },
  { id: 'JE-2026-0338', date: '11/03/2026', description: 'Service Fee - Singh Consultants', debit: 125000, credit: 125000, status: 'posted' },
  { id: 'JE-2026-0337', date: '11/03/2026', description: 'Customer Payment - Reddy Traders', debit: 0, credit: 320000, status: 'posted' },
  { id: 'JE-2026-0336', date: '10/03/2026', description: 'Utility Bill - Agarwal Infra Pvt Ltd', debit: 18000, credit: 18000, status: 'draft' },
]

const revenueData = [45, 52, 48, 61, 55, 67, 72, 68, 78, 82, 87, 94]
const expenseData = [32, 38, 35, 40, 36, 42, 45, 43, 48, 50, 52, 56]
const monthLabels = ['A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D', 'J', 'F', 'M']

const typeColors: Record<string, string> = {
  Asset: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Liability: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  Equity: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Revenue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  Expense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQ, setSearchQ] = useState('')

  const filteredCOA = chartOfAccounts.filter(a =>
    a.name.toLowerCase().includes(searchQ.toLowerCase()) || a.code.includes(searchQ) || a.type.toLowerCase().includes(searchQ.toLowerCase())
  )

  const totalAssets = chartOfAccounts.filter(a => a.type === 'Asset').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = chartOfAccounts.filter(a => a.type === 'Liability').reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalEquity = chartOfAccounts.filter(a => a.type === 'Equity').reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalRevenue = chartOfAccounts.filter(a => a.type === 'Revenue').reduce((s, a) => s + Math.abs(a.balance), 0)
  const totalExpenses = chartOfAccounts.filter(a => a.type === 'Expense').reduce((s, a) => s + a.balance, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b dark:bg-slate-900/80">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Accounting</h1>
              <p className="text-xs text-muted-foreground">Sharma & Associates Pvt Ltd &middot; FY 2025-26</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />New Entry</Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
          <TabsList className="bg-transparent h-9 p-0 gap-1 border-b-0">
            {['overview', 'journal-entries', 'chart-of-accounts', 'reports'].map(t => (
              <TabsTrigger key={t} value={t} className="rounded-t-lg rounded-b-none data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/20 dark:data-[state=active]:text-emerald-400 text-xs px-3 h-8 capitalize">
                {t.replace(/-/g, ' ')}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            {/* Stat Cards */}
            <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => {
                const Icon = s.icon
                const positive = s.change >= 0
                return (
                  <motion.div key={s.label} variants={item}>
                    <Card className="hover:shadow-md transition-shadow border-slate-200/60 dark:border-slate-800/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : s.color === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {fmtPct(s.change)}
                          </div>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{fmtINR(s.value)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* P&L + Balance Sheet */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <PieChart className="h-4 w-4 text-emerald-600" /> Profit & Loss Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-6 items-end">
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Revenue</span><span className="font-semibold text-emerald-600">{fmtINR(totalRevenue)}</span></div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-emerald-500" style={{ width: '100%' }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Expenses</span><span className="font-semibold text-rose-500">{fmtINR(totalExpenses)}</span></div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-rose-400" style={{ width: `${(totalExpenses / totalRevenue) * 100}%` }} /></div>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-sm font-bold"><span>Net Profit</span><span className="text-emerald-600">{fmtINR(totalRevenue - totalExpenses)}</span></div>
                      </div>
                      <div className="hidden sm:block">
                        <SparklineChart data={revenueData.slice(-6)} color="#10b981" height={60} />
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t dark:border-slate-800">
                      <p className="text-[10px] text-muted-foreground mb-2">Monthly Trend (FY 2025-26)</p>
                      <div className="flex gap-1 items-end">
                        <BarChartMini data={revenueData} labels={monthLabels} color="#10b981" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Scale className="h-4 w-4 text-emerald-600" /> Balance Sheet Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 mb-2 uppercase tracking-wider">Assets</p>
                      {chartOfAccounts.filter(a => a.type === 'Asset').map(a => (
                        <div key={a.code} className="flex justify-between py-1.5 text-xs">
                          <span className="text-muted-foreground">{a.name}</span>
                          <span className="font-medium">{fmtINR(a.balance)}</span>
                        </div>
                      ))}
                      <Separator className="my-1" />
                      <div className="flex justify-between py-1 text-xs font-bold"><span>Total Assets</span><span>{fmtINR(totalAssets)}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-rose-500 mb-2 uppercase tracking-wider">Liabilities</p>
                        {chartOfAccounts.filter(a => a.type === 'Liability').map(a => (
                          <div key={a.code} className="flex justify-between py-1 text-xs">
                            <span className="text-muted-foreground">{a.name}</span>
                            <span className="font-medium">{fmtINR(Math.abs(a.balance))}</span>
                          </div>
                        ))}
                        <Separator className="my-1" />
                        <div className="flex justify-between py-1 text-xs font-bold"><span>Total</span><span>{fmtINR(totalLiabilities)}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-violet-500 mb-2 uppercase tracking-wider">Equity</p>
                        {chartOfAccounts.filter(a => a.type === 'Equity').map(a => (
                          <div key={a.code} className="flex justify-between py-1 text-xs">
                            <span className="text-muted-foreground">{a.name}</span>
                            <span className="font-medium">{fmtINR(Math.abs(a.balance))}</span>
                          </div>
                        ))}
                        <Separator className="my-1" />
                        <div className="flex justify-between py-1 text-xs font-bold"><span>Total</span><span>{fmtINR(totalEquity)}</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Trial Balance + Recent Journal Entries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-600" /> Trial Balance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(type => {
                        const accounts = chartOfAccounts.filter(a => a.type === type)
                        const debitTotal = accounts.reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0)
                        const creditTotal = accounts.reduce((s, a) => s + (a.balance < 0 ? Math.abs(a.balance) : 0), 0)
                        return (
                          <div key={type} className="flex items-center justify-between py-2 border-b last:border-b-0 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={`text-[10px] ${typeColors[type]}`}>{type}</Badge>
                              <span className="text-xs">{accounts.length} accounts</span>
                            </div>
                            <div className="flex gap-6 text-xs">
                              <div><span className="text-muted-foreground">Dr: </span><span className="font-semibold">{fmtINR(debitTotal)}</span></div>
                              <div><span className="text-muted-foreground">Cr: </span><span className="font-semibold">{fmtINR(creditTotal)}</span></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between text-xs font-bold text-emerald-600">
                      <span>Trial Balance Check</span>
                      <span>Balanced</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" /> Recent Journal Entries
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-72">
                      <div className="px-4 pb-4 space-y-2">
                        {journalEntries.slice(0, 7).map(je => (
                          <div key={je.id} className="flex items-center justify-between py-2 border-b last:border-b-0 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded px-2 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground">{je.id}</span>
                                <Badge variant={je.status === 'posted' ? 'default' : je.status === 'pending' ? 'secondary' : 'outline'} className={`text-[9px] h-4 ${je.status === 'posted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : je.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500'}`}>
                                  {je.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-0.5">{je.description}</p>
                              <p className="text-[10px] text-muted-foreground">{je.date}</p>
                            </div>
                            <div className="text-right ml-3">
                              <p className="text-xs font-semibold">{fmtINR(je.debit)}</p>
                              {je.credit > 0 && <p className="text-[10px] text-muted-foreground">Cr: {fmtINR(je.credit)}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* ─── JOURNAL ENTRIES TAB ─── */}
          <TabsContent value="journal-entries" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search entries..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  <Button variant="outline" size="sm" className="gap-1.5 h-8"><Filter className="h-3 w-3" />Filter</Button>
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />New Entry</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="divide-y dark:divide-slate-800/60">
                      {journalEntries.map((je, i) => (
                        <motion.div
                          key={je.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <FileText className="h-4 w-4 text-slate-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{je.id}</span>
                                <Badge variant={je.status === 'posted' ? 'default' : je.status === 'pending' ? 'secondary' : 'outline'} className={`text-[9px] h-4 ${je.status === 'posted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : je.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-500'}`}>
                                  {je.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{je.description}</p>
                              <p className="text-[10px] text-muted-foreground">{je.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-900 dark:text-white">Dr: {fmtINR(je.debit)}</p>
                            {je.credit > 0 && <p className="text-[10px] text-muted-foreground">Cr: {fmtINR(je.credit)}</p>}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground ml-3" />
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── CHART OF ACCOUNTS TAB ─── */}
          <TabsContent value="chart-of-accounts" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search accounts..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  <div className="flex gap-1">
                    {['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(t => (
                      <Button key={t} variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => setSearchQ(t === 'All' ? '' : t)}>{t}</Button>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />New Account</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <div className="divide-y dark:divide-slate-800/60">
                    {filteredCOA.map((acc, i) => (
                      <motion.div
                        key={acc.code}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xs font-mono font-semibold text-slate-500 w-12">{acc.code}</span>
                          <div>
                            <p className="text-xs font-medium text-slate-900 dark:text-white">{acc.name}</p>
                            <Badge variant="secondary" className={`text-[9px] h-4 mt-0.5 ${typeColors[acc.type]}`}>{acc.type}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1 text-[10px]">
                            {acc.change >= 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                            <span className={acc.change >= 0 ? 'text-emerald-600' : 'text-rose-500'}>{fmtPct(acc.change)}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white min-w-[100px] text-right">{fmtINR(Math.abs(acc.balance))}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── REPORTS TAB ─── */}
          <TabsContent value="reports" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Profit & Loss Statement', desc: 'Revenue, expenses, and net profit for FY 2025-26', icon: PieChart, period: 'As of 15/03/2026' },
                { title: 'Balance Sheet', desc: 'Assets, liabilities, and equity position', icon: Scale, period: 'As of 15/03/2026' },
                { title: 'Trial Balance', desc: 'Debit and credit balances for all accounts', icon: BarChart3, period: 'As of 15/03/2026' },
                { title: 'Cash Flow Statement', desc: 'Operating, investing, and financing activities', icon: IndianRupee, period: 'FY 2025-26' },
                { title: 'General Ledger', desc: 'Complete transaction history by account', icon: BookOpen, period: 'FY 2025-26' },
                { title: 'Aging Report', desc: 'Receivables and payables aging analysis', icon: Clock, period: 'As of 15/03/2026' },
              ].map((r, i) => {
                const Icon = r.icon
                return (
                  <motion.div key={r.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="hover:shadow-md transition-all border-slate-200/60 dark:border-slate-800/60 cursor-pointer group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{r.title}</h3>
                        <p className="text-xs text-muted-foreground mb-2">{r.desc}</p>
                        <p className="text-[10px] text-muted-foreground">{r.period}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
