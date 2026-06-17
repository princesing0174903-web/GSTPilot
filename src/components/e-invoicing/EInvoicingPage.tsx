'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileOutput, ArrowUpRight, ArrowDownRight, TrendingUp,
  IndianRupee, FileText, CheckCircle2, Clock,
  AlertCircle, AlertTriangle, Download, Plus,
  Search, Filter, ChevronRight, ShieldCheck,
  Zap, RefreshCw, Send, Truck, Hash,
  BarChart3, Settings2, Eye, Copy,
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

function ValidationGauge({ percent }: { percent: number }) {
  const r = 38
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <svg width="100" height="100" className="overflow-visible">
      <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-800" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#10b981" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 50 50)" />
      <text x="50" y="46" textAnchor="middle" className="text-lg font-bold fill-emerald-600 dark:fill-emerald-400">{percent}%</text>
      <text x="50" y="60" textAnchor="middle" className="text-[8px] fill-muted-foreground">Pass Rate</text>
    </svg>
  )
}

function DailyIRNChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count))
  const barW = 24
  const gap = 6
  const h = 70
  return (
    <svg width={data.length * (barW + gap)} height={h + 20} className="overflow-visible">
      {data.map((d, i) => {
        const barH = (d.count / max) * (h - 10)
        return (
          <g key={d.day}>
            <rect x={i * (barW + gap)} y={h - barH} width={barW} height={barH} rx={3} fill="#10b981" opacity={0.6 + (d.count / max) * 0.4} />
            <text x={i * (barW + gap) + barW / 2} y={h + 14} textAnchor="middle" className="text-[9px] fill-muted-foreground">{d.day}</text>
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
  { label: 'IRNs Generated', value: 847, change: 18.3, icon: Hash, color: 'emerald' },
  { label: 'E-Way Bills Active', value: 124, change: 5.7, icon: Truck, color: 'emerald' },
  { label: 'Validation Pass %', value: 96.4, change: 1.2, icon: ShieldCheck, color: 'emerald' },
  { label: 'Bulk Jobs', value: 12, change: 33, icon: Zap, color: 'amber' },
]

const eInvoices = [
  { irn: '4F8A2C1D5E9B7A3F', date: '15/03/2026', gstin: '27AABCS1234F1ZH', buyer: 'Sharma & Associates Pvt Ltd', amount: 450000, tax: 81000, status: 'valid' },
  { irn: '7B3E9F2A6D1C8E4G', date: '15/03/2026', gstin: '27AABCT5678G2ZK', buyer: 'Patel Traders', amount: 234000, tax: 42120, status: 'valid' },
  { irn: '2D5A8C3F1E7B9G6H', date: '14/03/2026', gstin: '27AABCU9012H3ZL', buyer: 'Mehta Suppliers Pvt Ltd', amount: 567000, tax: 102060, status: 'valid' },
  { irn: '9F1B4D6A2E8C3G7I', date: '14/03/2026', gstin: '27AABCV3456I4ZM', buyer: 'Kumar Logistics', amount: 89000, tax: 16020, status: 'expired' },
  { irn: '6C2E8A4F3B1D5G9J', date: '13/03/2026', gstin: '27AABCW7890J5ZN', buyer: 'Singh Properties', amount: 1230000, tax: 221400, status: 'valid' },
  { irn: '1A3F7C9E5B2D8G4K', date: '13/03/2026', gstin: '27AABCX1234K6ZO', buyer: 'Reddy Marketing Solutions', amount: 178000, tax: 32040, status: 'valid' },
  { irn: '8D4B1E6A9C3F7G2L', date: '12/03/2026', gstin: '27AABCY5678L7ZP', buyer: 'Agarwal & Sons Pvt Ltd', amount: 345000, tax: 62100, status: 'cancelled' },
  { irn: '5E7A2B9D4F6C1G8M', date: '12/03/2026', gstin: '27AABCZ9012M8ZQ', buyer: 'Joshi Financial Services', amount: 67000, tax: 12060, status: 'valid' },
  { irn: '3B9D6F1A8E4C7G5N', date: '11/03/2026', gstin: '27AABDA3456N9ZR', buyer: 'Sharma & Associates Pvt Ltd', amount: 890000, tax: 160200, status: 'valid' },
  { irn: '7G2C5A8F1D9B3E6O', date: '11/03/2026', gstin: '27AABDB7890O0ZS', buyer: 'Patel Constructions', amount: 156000, tax: 28080, status: 'valid' },
]

const eWayBills = [
  { ewbNo: '361008923456', date: '15/03/2026', from: 'Mumbai', to: 'Pune', goods: 'Electronics', value: 450000, validTill: '17/03/2026', status: 'active' },
  { ewbNo: '361008923457', date: '15/03/2026', from: 'Mumbai', to: 'Delhi', goods: 'Textiles', value: 234000, validTill: '19/03/2026', status: 'active' },
  { ewbNo: '361008923458', date: '14/03/2026', from: 'Pune', to: 'Bangalore', goods: 'Machinery', value: 567000, validTill: '18/03/2026', status: 'active' },
  { ewbNo: '361008923459', date: '13/03/2026', from: 'Delhi', to: 'Mumbai', goods: 'Raw Materials', value: 89000, validTill: '16/03/2026', status: 'expiring' },
  { ewbNo: '361008923460', date: '12/03/2026', from: 'Bangalore', to: 'Chennai', goods: 'Chemicals', value: 345000, validTill: '15/03/2026', status: 'expired' },
  { ewbNo: '361008923461', date: '12/03/2026', from: 'Mumbai', to: 'Hyderabad', goods: 'FMCG Products', value: 178000, validTill: '15/03/2026', status: 'expired' },
  { ewbNo: '361008923462', date: '11/03/2026', from: 'Chennai', to: 'Mumbai', goods: 'Auto Parts', value: 890000, validTill: '14/03/2026', status: 'cancelled' },
]

const bulkJobs = [
  { id: 'BLK-2026-045', date: '15/03/2026', totalInvoices: 25, processed: 23, failed: 2, status: 'completed' },
  { id: 'BLK-2026-044', date: '14/03/2026', totalInvoices: 50, processed: 50, failed: 0, status: 'completed' },
  { id: 'BLK-2026-043', date: '14/03/2026', totalInvoices: 15, processed: 12, failed: 0, status: 'processing' },
  { id: 'BLK-2026-042', date: '13/03/2026', totalInvoices: 30, processed: 30, failed: 0, status: 'completed' },
  { id: 'BLK-2026-041', date: '12/03/2026', totalInvoices: 20, processed: 18, failed: 2, status: 'completed' },
  { id: 'BLK-2026-040', date: '11/03/2026', totalInvoices: 40, processed: 40, failed: 0, status: 'completed' },
]

const dailyIRNData = [
  { day: '09', count: 28 }, { day: '10', count: 42 }, { day: '11', count: 35 },
  { day: '12', count: 51 }, { day: '13', count: 38 }, { day: '14', count: 45 },
  { day: '15', count: 56 },
]

const statusColors: Record<string, string> = {
  valid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  expired: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  expiring: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  processing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EInvoicingPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQ, setSearchQ] = useState('')

  const totalEInvoices = eInvoices.filter(i => i.status === 'valid').length
  const totalEWBActive = eWayBills.filter(w => w.status === 'active' || w.status === 'expiring').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b dark:bg-slate-900/80">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileOutput className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">E-Invoicing</h1>
              <p className="text-xs text-muted-foreground">IRN & E-Way Bill Management &middot; FY 2025-26</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Generate IRN</Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
          <TabsList className="bg-transparent h-9 p-0 gap-1 border-b-0">
            {['overview', 'e-invoices', 'e-way-bills', 'bulk', 'settings'].map(t => (
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
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            {fmtPct(s.change)}
                          </div>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{typeof s.value === 'number' && s.value > 1000 ? fmtINR(s.value) : s.value}{typeof s.value === 'number' && s.value < 100 ? (s.value % 1 !== 0 ? '%' : '') : ''}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Validation Gauge + Daily IRN Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" /> Validation Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-around">
                      <ValidationGauge percent={96.4} />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">816 Passed</p>
                            <p className="text-[10px] text-muted-foreground">Valid IRN generated</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">23 Warnings</p>
                            <p className="text-[10px] text-muted-foreground">GSTIN mismatch</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">8 Failed</p>
                            <p className="text-[10px] text-muted-foreground">Invalid data</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-600" /> Daily IRN Generation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center pb-2">
                      <DailyIRNChart data={dailyIRNData} />
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">295</p>
                        <p className="text-[10px] text-muted-foreground">This Week</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">847</p>
                        <p className="text-[10px] text-muted-foreground">This Month</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">42.1</p>
                        <p className="text-[10px] text-muted-foreground">Avg / Day</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Recent E-Invoices */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-600" /> Recent E-Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-72">
                    <div className="divide-y dark:divide-slate-800/60">
                      {eInvoices.slice(0, 6).map((inv, i) => (
                        <motion.div key={inv.irn} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${inv.status === 'valid' ? 'bg-emerald-100 dark:bg-emerald-900/30' : inv.status === 'expired' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                              <FileText className={`h-4 w-4 ${inv.status === 'valid' ? 'text-emerald-600 dark:text-emerald-400' : inv.status === 'expired' ? 'text-slate-400' : 'text-rose-500 dark:text-rose-400'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground">{inv.irn.slice(0, 12)}...</span>
                                <Badge variant="secondary" className={`text-[9px] ${statusColors[inv.status]}`}>{inv.status}</Badge>
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300">{inv.buyer}</p>
                              <p className="text-[10px] text-muted-foreground">{inv.date} &middot; {inv.gstin}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold">{fmtINR(inv.amount)}</p>
                            <p className="text-[10px] text-muted-foreground">Tax: {fmtINR(inv.tax)}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── E-INVOICES TAB ─── */}
          <TabsContent value="e-invoices" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search by IRN, buyer, GSTIN..." className="w-72 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  <Button variant="outline" size="sm" className="gap-1.5 h-8"><Filter className="h-3 w-3" />Filter</Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 h-8"><RefreshCw className="h-3 w-3" />Sync</Button>
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Generate IRN</Button>
                </div>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="divide-y dark:divide-slate-800/60">
                      {eInvoices.map((inv, i) => (
                        <motion.div key={inv.irn} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${inv.status === 'valid' ? 'bg-emerald-100 dark:bg-emerald-900/30' : inv.status === 'expired' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                              <Hash className={`h-4 w-4 ${inv.status === 'valid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{inv.irn.slice(0, 16)}</span>
                                <Badge variant="secondary" className={`text-[9px] ${statusColors[inv.status]}`}>{inv.status}</Badge>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{inv.buyer}</p>
                              <p className="text-[10px] text-muted-foreground">{inv.date} &middot; GSTIN: {inv.gstin}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs font-bold">{fmtINR(inv.amount)}</p>
                              <p className="text-[10px] text-muted-foreground">Tax: {fmtINR(inv.tax)}</p>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Copy className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── E-WAY BILLS TAB ─── */}
          <TabsContent value="e-way-bills" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search E-Way Bills..." className="w-64 h-8 text-xs" />
                  <div className="flex gap-1">
                    {['All', 'Active', 'Expiring', 'Expired'].map(f => (
                      <Button key={f} variant="outline" size="sm" className="h-7 text-[10px] px-2">{f}</Button>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Truck className="h-3.5 w-3.5" />Create E-Way Bill</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <div className="divide-y dark:divide-slate-800/60">
                    {eWayBills.map((ewb, i) => (
                      <motion.div key={ewb.ewbNo} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${ewb.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30' : ewb.status === 'expiring' ? 'bg-amber-100 dark:bg-amber-900/30' : ewb.status === 'expired' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                            <Truck className={`h-4 w-4 ${ewb.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : ewb.status === 'expiring' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{ewb.ewbNo}</span>
                              <Badge variant="secondary" className={`text-[9px] ${statusColors[ewb.status]}`}>{ewb.status}</Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">{ewb.goods} &middot; {fmtINR(ewb.value)}</p>
                            <p className="text-[10px] text-muted-foreground">{ewb.from} → {ewb.to} &middot; Valid till: {ewb.validTill}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── BULK TAB ─── */}
          <TabsContent value="bulk" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bulk Generation Jobs</h3>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Zap className="h-3.5 w-3.5" />New Bulk Job</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {bulkJobs.map((job, i) => (
                  <motion.div key={job.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="hover:shadow-md transition-shadow border-slate-200/60 dark:border-slate-800/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{job.id}</span>
                          <Badge variant="secondary" className={`text-[9px] ${statusColors[job.status]}`}>{job.status}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-3">{job.date} &middot; {job.totalInvoices} invoices</p>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{job.processed}/{job.totalInvoices}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                              <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(job.processed / job.totalInvoices) * 100}%` }} />
                            </div>
                          </div>
                          {job.failed > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-rose-500">
                              <AlertCircle className="h-3 w-3" />{job.failed} failed
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── SETTINGS TAB ─── */}
          <TabsContent value="settings" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'GSTIN Configuration', desc: 'Manage your GSTIN and seller details for IRN generation', icon: Hash },
                { title: 'Auto-Generation Rules', desc: 'Configure automatic IRN generation on invoice creation', icon: Zap },
                { title: 'E-Way Bill Defaults', desc: 'Set default transporter, vehicle type, and validity period', icon: Truck },
                { title: 'Validation Rules', desc: 'Customize GSTIN validation and data quality checks', icon: ShieldCheck },
                { title: 'API Integration', desc: 'Configure NIC API credentials and webhook endpoints', icon: Settings2 },
                { title: 'Bulk Processing', desc: 'Set batch size, retry rules, and error handling for bulk jobs', icon: RefreshCw },
              ].map((s, i) => {
                const Icon = s.icon
                return (
                  <motion.div key={s.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="hover:shadow-md transition-all border-slate-200/60 dark:border-slate-800/60 cursor-pointer group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{s.title}</h3>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
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
