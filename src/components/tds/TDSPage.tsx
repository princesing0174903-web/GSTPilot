'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileCheck, ArrowUpRight, ArrowDownRight, TrendingUp,
  IndianRupee, FileText, ShieldCheck, Clock,
  AlertCircle, CheckCircle2, Download, Plus,
  Search, Filter, ChevronRight, Calendar,
  Building2, Users, Receipt, RotateCw, Send,
  CircleDot, Banknote,
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

function QuarterlyBarChart({ data }: { data: { quarter: string; deducted: number; deposited: number }[] }) {
  const max = Math.max(...data.map(d => Math.max(d.deducted, d.deposited)))
  const barW = 32
  const gap = 20
  const h = 100
  const totalW = data.length * (barW * 2 + gap + 8)
  return (
    <svg width={totalW} height={h + 24} className="overflow-visible">
      {data.map((d, i) => {
        const x = i * (barW * 2 + gap + 8)
        const hD = (d.deducted / max) * (h - 10)
        const hP = (d.deposited / max) * (h - 10)
        return (
          <g key={d.quarter}>
            <rect x={x} y={h - hD} width={barW} height={hD} rx={4} fill="#10b981" opacity={0.7} />
            <rect x={x + barW + 4} y={h - hP} width={barW} height={hP} rx={4} fill="#64748b" opacity={0.5} />
            <text x={x + barW + 2} y={h + 16} textAnchor="middle" className="text-[10px] fill-muted-foreground">{d.quarter}</text>
          </g>
        )
      })}
      <g transform={`translate(${totalW - 120}, 0)`}>
        <rect x="0" y="0" width="10" height="10" rx="2" fill="#10b981" opacity={0.7} />
        <text x="14" y="9" className="text-[9px] fill-muted-foreground">Deducted</text>
        <rect x="70" y="0" width="10" height="10" rx="2" fill="#64748b" opacity={0.5} />
        <text x="84" y="9" className="text-[9px] fill-muted-foreground">Deposited</text>
      </g>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════════

const statCards = [
  { label: 'Total TDS Deducted', value: 1845000, change: 14.2, icon: IndianRupee, color: 'emerald' },
  { label: 'TDS Deposited', value: 1690000, change: 12.8, icon: Banknote, color: 'emerald' },
  { label: 'Pending Challans', value: 3, change: -25, icon: AlertCircle, color: 'amber' },
  { label: 'Returns Filed', value: 4, change: 0, icon: CheckCircle2, color: 'slate' },
]

const tdsSections = [
  { section: '192', name: 'TDS on Salary', rate: 'Slab', deducted: 456000, deposited: 456000, deductees: 12, status: 'filed' },
  { section: '194A', name: 'TDS on Interest', rate: '10%', deducted: 123000, deposited: 123000, deductees: 5, status: 'filed' },
  { section: '194C', name: 'TDS on Contractor', rate: '1% / 2%', deducted: 567000, deposited: 445000, deductees: 18, status: 'partial' },
  { section: '194H', name: 'TDS on Commission', rate: '5%', deducted: 89000, deposited: 89000, deductees: 4, status: 'filed' },
  { section: '194I', name: 'TDS on Rent', rate: '10%', deducted: 234000, deposited: 234000, deductees: 6, status: 'filed' },
  { section: '194J', name: 'TDS on Professional Fees', rate: '10%', deducted: 378000, deposited: 345000, deductees: 9, status: 'partial' },
]

const challans = [
  { id: 'CHL-2026-089', date: '07/03/2026', amount: 156000, section: '192', bank: 'HDFC Bank', status: 'paid', bsrCode: '0001234' },
  { id: 'CHL-2026-088', date: '07/03/2026', amount: 89000, section: '194H', bank: 'SBI', status: 'paid', bsrCode: '0002345' },
  { id: 'CHL-2026-087', date: '07/03/2026', amount: 234000, section: '194I', bank: 'HDFC Bank', status: 'paid', bsrCode: '0001234' },
  { id: 'CHL-2026-086', date: '28/02/2026', amount: 345000, section: '194J', bank: 'ICICI Bank', status: 'paid', bsrCode: '0003456' },
  { id: 'CHL-2026-085', date: '28/02/2026', amount: 122000, section: '194C', bank: 'SBI', status: 'paid', bsrCode: '0002345' },
  { id: 'CHL-2026-084', date: '07/02/2026', amount: 456000, section: '192', bank: 'HDFC Bank', status: 'paid', bsrCode: '0001234' },
  { id: 'CHL-2026-083', date: '07/02/2026', amount: 67000, section: '194A', bank: 'ICICI Bank', status: 'paid', bsrCode: '0003456' },
  { id: 'CHL-2026-082', date: '07/02/2026', amount: 178000, section: '194C', bank: 'SBI', status: 'pending', bsrCode: '—' },
  { id: 'CHL-2026-081', date: '07/02/2026', amount: 33000, section: '194J', bank: 'HDFC Bank', status: 'pending', bsrCode: '—' },
  { id: 'CHL-2026-080', date: '06/01/2026', amount: 450000, section: '192', bank: 'HDFC Bank', status: 'paid', bsrCode: '0001234' },
]

const quarterlyReturns = [
  { quarter: 'Q1', period: 'Apr-Jun 2025', dueDate: '15/07/2025', filedDate: '12/07/2025', status: 'filed', forms: '24Q, 26Q, 27Q' },
  { quarter: 'Q2', period: 'Jul-Sep 2025', dueDate: '15/10/2025', filedDate: '10/10/2025', status: 'filed', forms: '24Q, 26Q, 27Q' },
  { quarter: 'Q3', period: 'Oct-Dec 2025', dueDate: '15/01/2026', filedDate: '14/01/2026', status: 'filed', forms: '24Q, 26Q, 27Q' },
  { quarter: 'Q4', period: 'Jan-Mar 2026', dueDate: '31/05/2026', filedDate: null, status: 'upcoming', forms: '24Q, 26Q, 27Q' },
]

const certificates = [
  { id: 'CERT-001', deductee: 'Sharma & Associates Pvt Ltd', section: '194J', amount: 145000, quarter: 'Q3', issued: true, issuedDate: '20/01/2026' },
  { id: 'CERT-002', deductee: 'Patel Constructions', section: '194C', amount: 234000, quarter: 'Q3', issued: true, issuedDate: '22/01/2026' },
  { id: 'CERT-003', deductee: 'Mehta Consulting Pvt Ltd', section: '194J', amount: 89000, quarter: 'Q3', issued: true, issuedDate: '25/01/2026' },
  { id: 'CERT-004', deductee: 'Kumar Logistics', section: '194C', amount: 167000, quarter: 'Q3', issued: false, issuedDate: null },
  { id: 'CERT-005', deductee: 'Singh Properties', section: '194I', amount: 234000, quarter: 'Q3', issued: true, issuedDate: '28/01/2026' },
  { id: 'CERT-006', deductee: 'Reddy Marketing Solutions', section: '194H', amount: 56000, quarter: 'Q3', issued: false, issuedDate: null },
  { id: 'CERT-007', deductee: 'Agarwal & Sons Pvt Ltd', section: '194C', amount: 189000, quarter: 'Q3', issued: true, issuedDate: '30/01/2026' },
  { id: 'CERT-008', deductee: 'Joshi Financial Services', section: '194A', amount: 67000, quarter: 'Q3', issued: true, issuedDate: '01/02/2026' },
]

const quarterlyData = [
  { quarter: 'Q1', deducted: 456000, deposited: 456000 },
  { quarter: 'Q2', deducted: 412000, deposited: 412000 },
  { quarter: 'Q3', deducted: 534000, deposited: 489000 },
  { quarter: 'Q4', deducted: 443000, deposited: 333000 },
]

const statusColors: Record<string, string> = {
  filed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  upcoming: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function TDSPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQ, setSearchQ] = useState('')

  const deductorDetails = {
    tan: 'MUMS12345A',
    name: 'Sharma & Associates Pvt Ltd',
    address: '12, MG Road, Fort, Mumbai 400001',
    type: 'Company',
    aoCode: 'MUM/C/123/4',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b dark:bg-slate-900/80">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
              <FileCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">TDS Management</h1>
              <p className="text-xs text-muted-foreground">TAN: {deductorDetails.tan} &middot; FY 2025-26</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Send className="h-3.5 w-3.5" />File Return</Button>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4 sm:px-6">
          <TabsList className="bg-transparent h-9 p-0 gap-1 border-b-0">
            {['overview', 'deductions', 'challans', 'returns', 'certificates'].map(t => (
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
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : s.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
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

            {/* Deductor Details + Quarterly Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-emerald-600" /> Deductor Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: 'TAN', value: deductorDetails.tan },
                        { label: 'Name', value: deductorDetails.name },
                        { label: 'Address', value: deductorDetails.address },
                        { label: 'Type', value: deductorDetails.type },
                        { label: 'AO Code', value: deductorDetails.aoCode },
                      ].map(row => (
                        <div key={row.label} className="flex justify-between py-1.5 border-b last:border-b-0 dark:border-slate-800/60">
                          <span className="text-xs text-muted-foreground">{row.label}</span>
                          <span className="text-xs font-medium text-slate-900 dark:text-white">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" /> Quarterly TDS Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center pb-2">
                      <QuarterlyBarChart data={quarterlyData} />
                    </div>
                    <Separator className="my-3" />
                    <div className="grid grid-cols-4 gap-2">
                      {quarterlyReturns.map(q => (
                        <div key={q.quarter} className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                          <Badge className={`text-[9px] ${statusColors[q.status]}`}>{q.quarter}</Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">{q.period}</p>
                          <Badge variant="secondary" className={`text-[9px] mt-1 ${statusColors[q.status]}`}>{q.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* TDS Sections Summary */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-emerald-600" /> TDS Section Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y dark:divide-slate-800/60">
                    {tdsSections.map((s, i) => (
                      <motion.div key={s.section} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{s.section}</span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-900 dark:text-white">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">Rate: {s.rate} &middot; {s.deductees} deductees</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs font-semibold">{fmtINR(s.deducted)}</p>
                            <p className="text-[10px] text-muted-foreground">Deposited: {fmtINR(s.deposited)}</p>
                          </div>
                          <Badge variant="secondary" className={`text-[9px] ${statusColors[s.status]}`}>{s.status}</Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── DEDUCTIONS TAB ─── */}
          <TabsContent value="deductions" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search deductions..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  <Button variant="outline" size="sm" className="gap-1.5 h-8"><Filter className="h-3 w-3" />Filter</Button>
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />New Deduction</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="divide-y dark:divide-slate-800/60">
                      {tdsSections.map((s, i) => (
                        <motion.div key={s.section} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{s.section}</span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground">Rate: {s.rate}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-xs font-semibold">Deducted: {fmtINR(s.deducted)}</p>
                              <p className="text-[10px] text-muted-foreground">Deposited: {fmtINR(s.deposited)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">{s.deductees} deductees</p>
                              <Badge variant="secondary" className={`text-[9px] ${statusColors[s.status]}`}>{s.status}</Badge>
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

          {/* ─── CHALLANS TAB ─── */}
          <TabsContent value="challans" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search challans..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-3.5 w-3.5" />Create Challan</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[600px]">
                    <div className="divide-y dark:divide-slate-800/60">
                      {challans.map((c, i) => (
                        <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${c.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                              <Receipt className={`h-4 w-4 ${c.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{c.id}</span>
                                <Badge variant="secondary" className={`text-[9px] ${statusColors[c.status]}`}>{c.status}</Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">Section {c.section} &middot; {c.bank} &middot; BSR: {c.bsrCode}</p>
                              <p className="text-[10px] text-muted-foreground">{c.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(c.amount)}</span>
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

          {/* ─── RETURNS TAB ─── */}
          <TabsContent value="returns" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {quarterlyReturns.map((q, i) => (
                  <motion.div key={q.quarter} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                    <Card className={`border-slate-200/60 dark:border-slate-800/60 ${q.status === 'upcoming' ? 'ring-2 ring-amber-200 dark:ring-amber-800' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className={`text-[10px] ${statusColors[q.status]}`}>{q.quarter}</Badge>
                          <Badge variant="secondary" className={`text-[9px] ${statusColors[q.status]}`}>{q.status}</Badge>
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{q.period}</h3>
                        <p className="text-[10px] text-muted-foreground mt-1">Due: {q.dueDate}</p>
                        <p className="text-[10px] text-muted-foreground">Forms: {q.forms}</p>
                        {q.filedDate && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">Filed: {q.filedDate}</p>}
                        {q.status === 'upcoming' && (
                          <Button size="sm" className="w-full mt-3 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"><Send className="h-3 w-3" />File Now</Button>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── CERTIFICATES TAB ─── */}
          <TabsContent value="certificates" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search certificates..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                </div>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Send className="h-3.5 w-3.5" />Issue Certificates</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  <div className="divide-y dark:divide-slate-800/60">
                    {certificates.map((c, i) => (
                      <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${c.issued ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                            {c.issued ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{c.id}</span>
                              <Badge variant="secondary" className={`text-[9px] ${c.issued ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                {c.issued ? 'Issued' : 'Pending'}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{c.deductee}</p>
                            <p className="text-[10px] text-muted-foreground">Section {c.section} &middot; {c.quarter} {c.issuedDate ? `&middot; Issued: ${c.issuedDate}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(c.amount)}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
