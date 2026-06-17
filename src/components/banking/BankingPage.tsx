'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Landmark, ArrowUpRight, ArrowDownRight, TrendingUp,
  IndianRupee, FileText, CheckCircle2, Clock,
  AlertCircle, Download, Plus, Search, Filter,
  ChevronRight, Building2, RefreshCw, ArrowRightLeft,
  CreditCard, Wallet, BadgeCheck, CircleDot,
  BarChart3, Calendar, Shield, CircleCheck,
  CircleX, Banknote,
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

function BalanceTrendChart({ data }: { data: { day: string; balance: number }[] }) {
  const max = Math.max(...data.map(d => d.balance))
  const min = Math.min(...data.map(d => d.balance))
  const range = max - min || 1
  const w = 280
  const h = 60
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d.balance - min) / range) * (h - 8) - 4}`)
  return (
    <svg width={w} height={h + 16} className="overflow-visible">
      <defs>
        <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill="url(#balGrad)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.filter((_, i) => i % 2 === 0).map((d, i) => {
        const x = (data.indexOf(d) / (data.length - 1)) * w
        return <text key={i} x={x} y={h + 12} textAnchor="middle" className="text-[8px] fill-muted-foreground">{d.day}</text>
      })}
    </svg>
  )
}

function ReconcileDonut({ reconciled, unreconciled }: { reconciled: number; unreconciled: number }) {
  const total = reconciled + unreconciled
  const r = 36
  const c = 2 * Math.PI * r
  const reconcilePct = (reconciled / total) * 100
  const dashOffset = c - (reconcilePct / 100) * c
  return (
    <svg width="90" height="90" className="overflow-visible">
      <circle cx="45" cy="45" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
      <circle cx="45" cy="45" r={r} fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={dashOffset} transform="rotate(-90 45 45)" />
      <text x="45" y="42" textAnchor="middle" className="text-sm font-bold fill-emerald-600 dark:fill-emerald-400">{reconcilePct.toFixed(0)}%</text>
      <text x="45" y="54" textAnchor="middle" className="text-[7px] fill-muted-foreground">Reconciled</text>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const statCards = [
  { label: 'Total Balance', value: 8456000, change: 6.8, icon: Landmark, color: 'emerald' },
  { label: 'In Transit', value: 456000, change: -12.3, icon: Clock, color: 'amber' },
  { label: 'Reconciled', value: 789, change: 15.2, icon: CircleCheck, color: 'emerald' },
  { label: 'Unreconciled', value: 23, change: -8.5, icon: CircleX, color: 'rose' },
]

const bankAccounts = [
  { id: 'ACC-001', bank: 'HDFC Bank', account: '0123456789012', type: 'Current', balance: 4567000, lastSync: '15/03/2026 14:30', status: 'connected' },
  { id: 'ACC-002', bank: 'State Bank of India', account: '3456789012345', type: 'Current', balance: 2345000, lastSync: '15/03/2026 13:15', status: 'connected' },
  { id: 'ACC-003', bank: 'ICICI Bank', account: '6789012345678', type: 'Savings', balance: 987000, lastSync: '15/03/2026 12:00', status: 'connected' },
  { id: 'ACC-004', bank: 'Axis Bank', account: '9012345678901', type: 'Current', balance: 456000, lastSync: '14/03/2026 18:45', status: 'syncing' },
  { id: 'ACC-005', bank: 'Kotak Mahindra', account: '2345678901234', type: 'Salary', balance: 101000, lastSync: '15/03/2026 10:00', status: 'connected' },
]

const transactions = [
  { id: 'TXN-001', date: '15/03/2026', description: 'NEFT - Sharma & Associates Pvt Ltd', amount: 450000, type: 'credit', balance: 4567000, account: 'HDFC', category: 'Revenue' },
  { id: 'TXN-002', date: '15/03/2026', description: 'UPI - Patel Traders', amount: 234000, type: 'credit', balance: 4801000, account: 'HDFC', category: 'Revenue' },
  { id: 'TXN-003', date: '15/03/2026', description: 'NEFT - Salary Disbursement March 2026', amount: 485000, type: 'debit', balance: 4316000, account: 'HDFC', category: 'Payroll' },
  { id: 'TXN-004', date: '14/03/2026', description: 'RTGS - GST Payment Feb 2026', amount: 156000, type: 'debit', balance: 2345000, account: 'SBI', category: 'Tax' },
  { id: 'TXN-005', date: '14/03/2026', description: 'NEFT - Mehta Suppliers Pvt Ltd', amount: 89000, type: 'debit', balance: 2256000, account: 'SBI', category: 'Purchase' },
  { id: 'TXN-006', date: '14/03/2026', description: 'UPI - Kumar Logistics', amount: 34000, type: 'debit', balance: 953000, account: 'ICICI', category: 'Logistics' },
  { id: 'TXN-007', date: '13/03/2026', description: 'NEFT - Singh Properties (Rent)', amount: 85000, type: 'debit', balance: 2171000, account: 'SBI', category: 'Rent' },
  { id: 'TXN-008', date: '13/03/2026', description: 'UPI - Reddy Marketing Solutions', amount: 178000, type: 'credit', balance: 4744000, account: 'HDFC', category: 'Revenue' },
  { id: 'TXN-009', date: '13/03/2026', description: 'NEFT - TDS Deposit Q3', amount: 89000, type: 'debit', balance: 2082000, account: 'SBI', category: 'Tax' },
  { id: 'TXN-010', date: '12/03/2026', description: 'RTGS - Agarwal & Sons Pvt Ltd', amount: 345000, type: 'credit', balance: 987000, account: 'ICICI', category: 'Revenue' },
  { id: 'TXN-011', date: '12/03/2026', description: 'UPI - Joshi Financial Services', amount: 67000, type: 'credit', balance: 5022000, account: 'HDFC', category: 'Revenue' },
  { id: 'TXN-012', date: '12/03/2026', description: 'NEFT - Utility Bill Payment', amount: 18000, type: 'debit', balance: 2064000, account: 'SBI', category: 'Utilities' },
]

const reconciliationData = [
  { id: 'REC-001', date: '15/03/2026', bankTxn: 'NEFT-45678', bookEntry: 'INV-2026-0344', amount: 234000, status: 'matched', account: 'HDFC' },
  { id: 'REC-002', date: '15/03/2026', bankTxn: 'UPI-12345', bookEntry: 'INV-2026-0328', amount: 67000, status: 'matched', account: 'HDFC' },
  { id: 'REC-003', date: '14/03/2026', bankTxn: 'NEFT-78901', bookEntry: 'INV-2026-0330', amount: 345000, status: 'matched', account: 'ICICI' },
  { id: 'REC-004', date: '14/03/2026', bankTxn: 'RTGS-23456', bookEntry: null, amount: 156000, status: 'unmatched', account: 'SBI' },
  { id: 'REC-005', date: '13/03/2026', bankTxn: 'NEFT-34567', bookEntry: 'INV-2026-0338', amount: 89000, status: 'disputed', account: 'ICICI' },
  { id: 'REC-006', date: '13/03/2026', bankTxn: 'UPI-67890', bookEntry: null, amount: 45000, status: 'unmatched', account: 'HDFC' },
  { id: 'REC-007', date: '12/03/2026', bankTxn: 'RTGS-45678', bookEntry: 'INV-2026-0335', amount: 1230000, status: 'matched', account: 'HDFC' },
  { id: 'REC-008', date: '12/03/2026', bankTxn: 'NEFT-56789', bookEntry: 'INV-2026-0332', amount: 178000, status: 'matched', account: 'HDFC' },
]

const balanceTrendData = [
  { day: '09/03', balance: 7200000 },
  { day: '10/03', balance: 7450000 },
  { day: '11/03', balance: 7320000 },
  { day: '12/03', balance: 7890000 },
  { day: '13/03', balance: 7650000 },
  { day: '14/03', balance: 7980000 },
  { day: '15/03', balance: 8456000 },
]

const statements = [
  { id: 'STMT-001', account: 'HDFC Bank - Current', period: 'Feb 2026', generated: '01/03/2026', transactions: 87, status: 'downloaded' },
  { id: 'STMT-002', account: 'SBI - Current', period: 'Feb 2026', generated: '01/03/2026', transactions: 45, status: 'downloaded' },
  { id: 'STMT-003', account: 'ICICI Bank - Savings', period: 'Feb 2026', generated: '01/03/2026', transactions: 23, status: 'downloaded' },
  { id: 'STMT-004', account: 'Axis Bank - Current', period: 'Feb 2026', generated: '02/03/2026', transactions: 34, status: 'pending' },
  { id: 'STMT-005', account: 'Kotak - Salary', period: 'Feb 2026', generated: '01/03/2026', transactions: 12, status: 'downloaded' },
]

const statusColors: Record<string, string> = {
  connected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  syncing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  matched: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  unmatched: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  disputed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  downloaded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const categoryColors: Record<string, string> = {
  Revenue: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  Payroll: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  Tax: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  Purchase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Rent: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  Logistics: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  Utilities: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function BankingPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQ, setSearchQ] = useState('')

  const totalBalance = bankAccounts.reduce((s, a) => s + a.balance, 0)
  const matchedCount = reconciliationData.filter(r => r.status === 'matched').length
  const unmatchedCount = reconciliationData.filter(r => r.status !== 'matched').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b dark:bg-slate-900/80">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Banking</h1>
              <p className="text-xs text-muted-foreground">Accounts & Reconciliation &middot; FY 2025-26</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Sync All</Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Add Account</Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
          <TabsList className="bg-transparent h-9 p-0 gap-1 border-b-0">
            {['overview', 'accounts', 'transactions', 'reconciliation', 'statements'].map(t => (
              <TabsTrigger key={t} value={t} className="rounded-t-lg rounded-b-none data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 dark:data-[state=active]:bg-emerald-900/20 dark:data-[state=active]:text-emerald-400 text-xs px-3 h-8 capitalize">
                {t}
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
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : s.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {fmtPct(s.change)}
                          </div>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{typeof s.value === 'number' && s.value > 100 ? fmtINR(s.value) : s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Balance Trend + Account Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" /> Balance Trend (7 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center pb-2">
                      <BalanceTrendChart data={balanceTrendData} />
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(totalBalance)}</p>
                        <p className="text-[10px] text-muted-foreground">Current</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(8456000 - 7200000)}</p>
                        <p className="text-[10px] text-muted-foreground">7-Day Change</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(456000)}</p>
                        <p className="text-[10px] text-muted-foreground">In Transit</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-emerald-600" /> Account Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {bankAccounts.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-900 dark:text-white">{acc.bank}</p>
                            <p className="text-[10px] text-muted-foreground">{acc.type} &middot; ****{acc.account.slice(-4)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{fmtINR(acc.balance)}</p>
                          <Badge variant="secondary" className={`text-[9px] ${statusColors[acc.status]}`}>{acc.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Reconciliation Summary + Latest Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-600" /> Auto-Reconciliation Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-around">
                      <ReconcileDonut reconciled={matchedCount} unreconciled={unmatchedCount} />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CircleCheck className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{matchedCount} Matched</p>
                            <p className="text-[10px] text-muted-foreground">Auto-reconciled</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CircleDot className="h-4 w-4 text-amber-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">2 Unmatched</p>
                            <p className="text-[10px] text-muted-foreground">Needs review</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <CircleX className="h-4 w-4 text-rose-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">1 Disputed</p>
                            <p className="text-[10px] text-muted-foreground">Amount mismatch</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Last auto-reconcile: 15/03/2026 14:30</span>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><RefreshCw className="h-3 w-3" />Run Now</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" /> Latest Transactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-64">
                      <div className="px-4 pb-4 space-y-1">
                        {transactions.slice(0, 6).map(txn => (
                          <div key={txn.id} className="flex items-center justify-between py-2 border-b last:border-b-0 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded px-2 transition-colors">
                            <div className="flex items-center gap-2">
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center ${txn.type === 'credit' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                                {txn.type === 'credit' ? <ArrowDownRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <ArrowUpRight className="h-3 w-3 text-rose-500 dark:text-rose-400" />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{txn.description}</p>
                                <p className="text-[10px] text-muted-foreground">{txn.date} &middot; {txn.account}</p>
                              </div>
                            </div>
                            <div className="text-right ml-2">
                              <p className={`text-xs font-bold ${txn.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                {txn.type === 'credit' ? '+' : '-'}{fmtINR(txn.amount)}
                              </p>
                              <Badge variant="secondary" className={`text-[8px] h-4 ${categoryColors[txn.category] || ''}`}>{txn.category}</Badge>
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

          {/* ─── ACCOUNTS TAB ─── */}
          <TabsContent value="accounts" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {bankAccounts.map((acc, i) => (
                  <motion.div key={acc.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                    <Card className="hover:shadow-md transition-all border-slate-200/60 dark:border-slate-800/60 cursor-pointer group">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                              <Landmark className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white">{acc.bank}</p>
                              <p className="text-[10px] text-muted-foreground">{acc.type}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className={`text-[9px] ${statusColors[acc.status]}`}>{acc.status}</Badge>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{fmtINR(acc.balance)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">A/C: ****{acc.account.slice(-4)}</p>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground">Synced: {acc.lastSync}</span>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1"><RefreshCw className="h-3 w-3" />Sync</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── TRANSACTIONS TAB ─── */}
          <TabsContent value="transactions" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search transactions..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  <Button variant="outline" size="sm" className="gap-1.5 h-8"><Filter className="h-3 w-3" />Filter</Button>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 h-8"><Download className="h-3.5 w-3.5" />Download</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="divide-y dark:divide-slate-800/60">
                      {transactions.map((txn, i) => (
                        <motion.div key={txn.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${txn.type === 'credit' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                              {txn.type === 'credit' ? <ArrowDownRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <ArrowUpRight className="h-4 w-4 text-rose-500 dark:text-rose-400" />}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-900 dark:text-white">{txn.description}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground">{txn.date}</span>
                                <Badge variant="secondary" className={`text-[9px] h-4 ${categoryColors[txn.category] || ''}`}>{txn.category}</Badge>
                                <span className="text-[10px] text-muted-foreground">{txn.account}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                                {txn.type === 'credit' ? '+' : '-'}{fmtINR(txn.amount)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Bal: {fmtINR(txn.balance)}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── RECONCILIATION TAB ─── */}
          <TabsContent value="reconciliation" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 text-xs">
                  <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-emerald-500" />Matched: {matchedCount}</span>
                  <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-amber-500" />Unmatched: {reconciliationData.filter(r => r.status === 'unmatched').length}</span>
                  <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-rose-500" />Disputed: {reconciliationData.filter(r => r.status === 'disputed').length}</span>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Auto-Reconcile</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <div className="divide-y dark:divide-slate-800/60">
                    {reconciliationData.map((rc, i) => (
                      <motion.div key={rc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${rc.status === 'matched' ? 'bg-emerald-100 dark:bg-emerald-900/30' : rc.status === 'disputed' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                            <ArrowRightLeft className={`h-4 w-4 ${rc.status === 'matched' ? 'text-emerald-600 dark:text-emerald-400' : rc.status === 'disputed' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{rc.bankTxn}</span>
                              <Badge variant="secondary" className={`text-[9px] ${statusColors[rc.status]}`}>{rc.status}</Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                              {rc.bookEntry ? `Book: ${rc.bookEntry}` : 'No book entry found'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{rc.date} &middot; {rc.account}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(rc.amount)}</span>
                          {rc.status === 'unmatched' && <Button variant="outline" size="sm" className="h-7 text-[10px]">Match</Button>}
                          {rc.status === 'disputed' && <Button variant="outline" size="sm" className="h-7 text-[10px]">Resolve</Button>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── STATEMENTS TAB ─── */}
          <TabsContent value="statements" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bank Statements</h3>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Download className="h-3.5 w-3.5" />Import Statement</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {statements.map((st, i) => (
                  <motion.div key={st.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="hover:shadow-md transition-shadow border-slate-200/60 dark:border-slate-800/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono text-muted-foreground">{st.id}</span>
                          <Badge variant="secondary" className={`text-[9px] ${statusColors[st.status]}`}>{st.status}</Badge>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{st.account}</h3>
                        <p className="text-xs text-muted-foreground mt-1">Period: {st.period}</p>
                        <p className="text-[10px] text-muted-foreground">{st.transactions} transactions &middot; Generated: {st.generated}</p>
                        <Separator className="my-2" />
                        <div className="flex justify-end">
                          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1"><Download className="h-3 w-3" />Download</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
