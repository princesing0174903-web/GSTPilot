'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt, ArrowUpRight, ArrowDownRight, TrendingUp,
  IndianRupee, FileText, CheckCircle2, Clock,
  AlertCircle, Download, Plus, Search, Filter,
  ChevronRight, Link2, CreditCard, Building2,
  Wallet, RefreshCw, Send, ArrowRightLeft,
  Smartphone, Monitor, BadgeCheck, XCircle,
  CircleDot, Banknote, Calendar,
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

function CollectionMethodChart({ data }: { data: { method: string; amount: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  const barH = 16
  return (
    <div className="space-y-2">
      {data.map(d => {
        const pct = (d.amount / total) * 100
        return (
          <div key={d.method}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{d.method}</span>
              <span className="font-medium">{fmtINR(d.amount)} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: d.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PaymentTrendChart({ data }: { data: { week: string; collected: number; paid: number }[] }) {
  const max = Math.max(...data.map(d => Math.max(d.collected, d.paid)))
  const barW = 20
  const gap = 12
  const h = 70
  return (
    <svg width={data.length * (barW * 2 + gap)} height={h + 20} className="overflow-visible">
      {data.map((d, i) => {
        const x = i * (barW * 2 + gap)
        const hC = (d.collected / max) * (h - 8)
        const hP = (d.paid / max) * (h - 8)
        return (
          <g key={d.week}>
            <rect x={x} y={h - hC} width={barW} height={hC} rx={3} fill="#10b981" opacity={0.7} />
            <rect x={x + barW + 2} y={h - hP} width={barW} height={hP} rx={3} fill="#f59e0b" opacity={0.6} />
            <text x={x + barW + 1} y={h + 14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{d.week}</text>
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
  { label: 'Total Collected', value: 4567000, change: 15.3, icon: TrendingUp, color: 'emerald' },
  { label: 'Total Paid', value: 2834000, change: 8.7, icon: Banknote, color: 'amber' },
  { label: 'Outstanding', value: 1890000, change: -5.2, icon: Clock, color: 'slate' },
  { label: 'Overdue', value: 456000, change: -12.4, icon: AlertCircle, color: 'rose' },
]

const receivables = [
  { id: 'REC-001', client: 'Sharma & Associates Pvt Ltd', invoice: 'INV-2026-0345', amount: 450000, dueDate: '20/03/2026', status: 'pending', method: null },
  { id: 'REC-002', client: 'Patel Traders', invoice: 'INV-2026-0344', amount: 234000, dueDate: '18/03/2026', status: 'received', method: 'UPI' },
  { id: 'REC-003', client: 'Mehta Suppliers Pvt Ltd', invoice: 'INV-2026-0340', amount: 567000, dueDate: '25/03/2026', status: 'pending', method: null },
  { id: 'REC-004', client: 'Kumar Logistics', invoice: 'INV-2026-0338', amount: 89000, dueDate: '10/03/2026', status: 'overdue', method: null },
  { id: 'REC-005', client: 'Singh Properties', invoice: 'INV-2026-0335', amount: 1230000, dueDate: '30/03/2026', status: 'pending', method: null },
  { id: 'REC-006', client: 'Reddy Marketing Solutions', invoice: 'INV-2026-0332', amount: 178000, dueDate: '05/03/2026', status: 'overdue', method: null },
  { id: 'REC-007', client: 'Agarwal & Sons Pvt Ltd', invoice: 'INV-2026-0330', amount: 345000, dueDate: '15/03/2026', status: 'received', method: 'Net Banking' },
  { id: 'REC-008', client: 'Joshi Financial Services', invoice: 'INV-2026-0328', amount: 67000, dueDate: '12/03/2026', status: 'received', method: 'Card' },
]

const payables = [
  { id: 'PAY-001', vendor: 'Patel Properties', category: 'Rent', amount: 85000, dueDate: '01/04/2026', status: 'scheduled' },
  { id: 'PAY-002', vendor: 'Mehta Suppliers Pvt Ltd', category: 'Purchase', amount: 234000, dueDate: '20/03/2026', status: 'pending' },
  { id: 'PAY-003', vendor: 'Kumar IT Solutions', category: 'IT Services', amount: 45000, dueDate: '25/03/2026', status: 'pending' },
  { id: 'PAY-004', vendor: 'Singh Legal Associates', category: 'Legal', amount: 125000, dueDate: '15/03/2026', status: 'paid' },
  { id: 'PAY-005', vendor: 'GST Department', category: 'GST Payment', amount: 156000, dueDate: '20/03/2026', status: 'scheduled' },
  { id: 'PAY-006', vendor: 'TDS Department', category: 'TDS Payment', amount: 89000, dueDate: '07/04/2026', status: 'pending' },
  { id: 'PAY-007', vendor: 'Reddy Transport', category: 'Logistics', amount: 34000, dueDate: '18/03/2026', status: 'paid' },
]

const paymentLinks = [
  { id: 'PL-001', client: 'Sharma & Associates Pvt Ltd', amount: 450000, createdDate: '10/03/2026', expiry: '25/03/2026', status: 'active', visits: 3 },
  { id: 'PL-002', client: 'Kumar Logistics', amount: 89000, createdDate: '08/03/2026', expiry: '22/03/2026', status: 'active', visits: 5 },
  { id: 'PL-003', client: 'Reddy Marketing Solutions', amount: 178000, createdDate: '05/03/2026', expiry: '19/03/2026', status: 'expired', visits: 2 },
  { id: 'PL-004', client: 'Mehta Suppliers Pvt Ltd', amount: 567000, createdDate: '12/03/2026', expiry: '26/03/2026', status: 'active', visits: 1 },
  { id: 'PL-005', client: 'Joshi Financial Services', amount: 67000, createdDate: '11/03/2026', expiry: '25/03/2026', status: 'paid', visits: 4 },
]

const reconciliationItems = [
  { id: 'RECON-001', date: '15/03/2026', bankRef: 'HDFC-NEFT-45678', amount: 234000, invoice: 'INV-2026-0344', status: 'matched' },
  { id: 'RECON-002', date: '15/03/2026', bankRef: 'HDFC-UPI-12345', amount: 67000, invoice: 'INV-2026-0328', status: 'matched' },
  { id: 'RECON-003', date: '14/03/2026', bankRef: 'ICICI-NEFT-78901', amount: 345000, invoice: 'INV-2026-0330', status: 'matched' },
  { id: 'RECON-004', date: '14/03/2026', bankRef: 'SBI-RTGS-23456', amount: 156000, invoice: null, status: 'unmatched' },
  { id: 'RECON-005', date: '13/03/2026', bankRef: 'HDFC-NEFT-34567', amount: 89000, invoice: 'INV-2026-0338', status: 'disputed' },
  { id: 'RECON-006', date: '13/03/2026', bankRef: 'ICICI-UPI-67890', amount: 45000, invoice: null, status: 'unmatched' },
]

const collectionByMethod = [
  { method: 'UPI', amount: 2345000, color: '#10b981' },
  { method: 'Net Banking', amount: 1567000, color: '#64748b' },
  { method: 'Card', amount: 456000, color: '#f59e0b' },
  { method: 'Cheque', amount: 199000, color: '#8b5cf6' },
]

const weeklyTrend = [
  { week: 'W1', collected: 890000, paid: 567000 },
  { week: 'W2', collected: 1234000, paid: 789000 },
  { week: 'W3', collected: 1123000, paid: 654000 },
  { week: 'W4', collected: 1316000, paid: 824000 },
]

const statusColors: Record<string, string> = {
  received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  overdue: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  scheduled: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  expired: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  matched: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  unmatched: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  disputed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

const methodIcons: Record<string, React.ElementType> = {
  'UPI': Smartphone,
  'Net Banking': Monitor,
  'Card': CreditCard,
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQ, setSearchQ] = useState('')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b dark:bg-slate-900/80">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Receipt className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Payments</h1>
              <p className="text-xs text-muted-foreground">Collect & Disburse &middot; FY 2025-26</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Record Payment</Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
          <TabsList className="bg-transparent h-9 p-0 gap-1 border-b-0">
            {['overview', 'receivables', 'payables', 'payment-links', 'reconciliation'].map(t => (
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
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : s.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : s.color === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
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

            {/* Collection Method + Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" /> Collection by Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CollectionMethodChart data={collectionByMethod} />
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 gap-3">
                      {collectionByMethod.map(m => {
                        const Icon = methodIcons[m.method] || Building2
                        return (
                          <div key={m.method} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                            <Icon className="h-4 w-4 text-slate-500" />
                            <div>
                              <p className="text-xs font-medium">{m.method}</p>
                              <p className="text-[10px] text-muted-foreground">{fmtINR(m.amount)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" /> Weekly Payment Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center pb-2">
                      <PaymentTrendChart data={weeklyTrend} />
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(4563000)}</p>
                        <p className="text-[10px] text-muted-foreground">Total Collected (Mar)</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{fmtINR(2834000)}</p>
                        <p className="text-[10px] text-muted-foreground">Total Paid (Mar)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent Activity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-emerald-600" /> Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-72">
                    <div className="divide-y dark:divide-slate-800/60">
                      {receivables.slice(0, 5).map((r, i) => (
                        <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${r.status === 'received' ? 'bg-emerald-100 dark:bg-emerald-900/30' : r.status === 'overdue' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                              <IndianRupee className={`h-4 w-4 ${r.status === 'received' ? 'text-emerald-600 dark:text-emerald-400' : r.status === 'overdue' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-900 dark:text-white">{r.client}</p>
                              <p className="text-[10px] text-muted-foreground">{r.invoice} &middot; Due: {r.dueDate}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold">{fmtINR(r.amount)}</span>
                            <Badge variant="secondary" className={`text-[9px] ${statusColors[r.status]}`}>{r.status}</Badge>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── RECEIVABLES TAB ─── */}
          <TabsContent value="receivables" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search receivables..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  <div className="flex gap-1">
                    {['All', 'Pending', 'Received', 'Overdue'].map(f => (
                      <Button key={f} variant="outline" size="sm" className="h-7 text-[10px] px-2">{f}</Button>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Record Receipt</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="divide-y dark:divide-slate-800/60">
                      {receivables.map((r, i) => (
                        <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${r.status === 'received' ? 'bg-emerald-100 dark:bg-emerald-900/30' : r.status === 'overdue' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                              <ArrowDownRight className={`h-4 w-4 ${r.status === 'received' ? 'text-emerald-600 dark:text-emerald-400' : r.status === 'overdue' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{r.id}</span>
                                <Badge variant="secondary" className={`text-[9px] ${statusColors[r.status]}`}>{r.status}</Badge>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{r.client}</p>
                              <p className="text-[10px] text-muted-foreground">{r.invoice} &middot; Due: {r.dueDate}{r.method ? ` &middot; Via: ${r.method}` : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(r.amount)}</span>
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

          {/* ─── PAYABLES TAB ─── */}
          <TabsContent value="payables" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <Input placeholder="Search payables..." className="w-64 h-8 text-xs" />
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Send className="h-3.5 w-3.5" />Schedule Payment</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <div className="divide-y dark:divide-slate-800/60">
                    {payables.map((p, i) => (
                      <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${p.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30' : p.status === 'scheduled' ? 'bg-sky-100 dark:bg-sky-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                            <ArrowUpRight className={`h-4 w-4 ${p.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : p.status === 'scheduled' ? 'text-sky-600 dark:text-sky-400' : 'text-amber-600 dark:text-amber-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{p.id}</span>
                              <Badge variant="secondary" className={`text-[9px] ${statusColors[p.status]}`}>{p.status}</Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{p.vendor}</p>
                            <p className="text-[10px] text-muted-foreground">{p.category} &middot; Due: {p.dueDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(p.amount)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── PAYMENT LINKS TAB ─── */}
          <TabsContent value="payment-links" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payment Links</h3>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Link2 className="h-3.5 w-3.5" />Create Link</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paymentLinks.map((pl, i) => (
                  <motion.div key={pl.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="hover:shadow-md transition-shadow border-slate-200/60 dark:border-slate-800/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{pl.id}</span>
                          <Badge variant="secondary" className={`text-[9px] ${statusColors[pl.status]}`}>{pl.status}</Badge>
                        </div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(pl.amount)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{pl.client}</p>
                        <Separator className="my-2" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Created: {pl.createdDate}</span>
                          <span>Expiry: {pl.expiry}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">{pl.visits} visits</span>
                          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1"><Link2 className="h-3 w-3" />Copy Link</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── RECONCILIATION TAB ─── */}
          <TabsContent value="reconciliation" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-emerald-500" />Matched: 3</span>
                    <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-amber-500" />Unmatched: 2</span>
                    <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-rose-500" />Disputed: 1</span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Auto-Reconcile</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <div className="divide-y dark:divide-slate-800/60">
                    {reconciliationItems.map((rc, i) => (
                      <motion.div key={rc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${rc.status === 'matched' ? 'bg-emerald-100 dark:bg-emerald-900/30' : rc.status === 'disputed' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                            <ArrowRightLeft className={`h-4 w-4 ${rc.status === 'matched' ? 'text-emerald-600 dark:text-emerald-400' : rc.status === 'disputed' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{rc.bankRef}</span>
                              <Badge variant="secondary" className={`text-[9px] ${statusColors[rc.status]}`}>{rc.status}</Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{rc.invoice || 'No invoice linked'}</p>
                            <p className="text-[10px] text-muted-foreground">{rc.date} &middot; {rc.amount}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(rc.amount)}</span>
                          {rc.status === 'unmatched' && <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">Match</Button>}
                          {rc.status === 'disputed' && <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">Resolve</Button>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
