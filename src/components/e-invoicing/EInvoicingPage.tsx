'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FileOutput, ArrowUpRight, ArrowDownRight, TrendingUp,
  IndianRupee, FileText, CheckCircle2, Clock,
  AlertCircle, AlertTriangle, Download, Plus,
  Search, Filter, ChevronRight, ShieldCheck,
  Zap, RefreshCw, Send, Truck, Hash,
  BarChart3, Settings2, Eye, Copy, Loader2, Inbox,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFireInvoices } from '@/hooks/use-firestore'
import type { FirestoreInvoice } from '@/lib/firestore-schema'

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
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface EInvoiceRow {
  irn: string
  date: string
  gstin: string
  buyer: string
  amount: number
  tax: number
  status: 'valid' | 'expired' | 'cancelled'
}

// A Firestore invoice doc (already with id and timestamps converted to ISO strings by the hook).
type FireInvoice = FirestoreInvoice & { id: string }

// Maps a Firestore invoice row to the EInvoiceRow shape used by the UI.
// The Invoice model has no dedicated IRN column, so we treat the invoice number
// as the IRN identifier (e-invoices are invoices that have been pushed through
// the IRN generation flow).
function mapInvoiceToEInvoice(inv: FireInvoice): EInvoiceRow {
  const tax = (inv.cgst || 0) + (inv.sgst || 0) + (inv.igst || 0) + (inv.cess || 0)
  const status: EInvoiceRow['status'] =
    inv.status === 'cancelled' ? 'cancelled' :
    inv.status === 'expired' ? 'expired' : 'valid'
  const dateStr = inv.invoiceDate
    ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
  return {
    irn: inv.invoiceNumber || '—',
    date: dateStr,
    gstin: inv.buyerGstin || inv.sellerGstin || '—',
    buyer: inv.buyerName || '—',
    amount: inv.totalAmount || 0,
    tax,
    status,
  }
}

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
  const { data: invoiceDocs, loading: isLoading, error } = useFireInvoices()

  // E-Way Bills, Bulk Jobs, and Daily IRN history have no backing collection yet —
  // keep them as empty arrays so the UI renders real empty states.
  const eWayBills: { ewbNo: string; date: string; from: string; to: string; goods: string; value: number; validTill: string; status: string }[] = []
  const bulkJobs: { id: string; date: string; totalInvoices: number; processed: number; failed: number; status: string }[] = []
  const dailyIRNData: { day: string; count: number }[] = []

  const eInvoices = useMemo<EInvoiceRow[]>(
    () => (invoiceDocs as unknown as FireInvoice[]).map(mapInvoiceToEInvoice),
    [invoiceDocs],
  )

  // ── Derived stats from real invoices ──
  const totalEInvoices = eInvoices.filter(i => i.status === 'valid').length
  const totalEWBActive = eWayBills.filter(w => w.status === 'active' || w.status === 'expiring').length

  const validCount = eInvoices.filter(i => i.status === 'valid').length
  const expiredCount = eInvoices.filter(i => i.status === 'expired').length
  const cancelledCount = eInvoices.filter(i => i.status === 'cancelled').length
  const validationPassPct = eInvoices.length > 0 ? Math.round((validCount / eInvoices.length) * 1000) / 10 : 0

  const filteredEInvoices = useMemo(() => {
    if (!searchQ.trim()) return eInvoices
    const q = searchQ.toLowerCase()
    return eInvoices.filter(i =>
      i.irn.toLowerCase().includes(q) ||
      i.buyer.toLowerCase().includes(q) ||
      i.gstin.toLowerCase().includes(q)
    )
  }, [eInvoices, searchQ])

  const statCards = [
    { label: 'IRNs Generated', value: eInvoices.length, change: 0, icon: Hash, color: 'emerald' },
    { label: 'E-Way Bills Active', value: totalEWBActive, change: 0, icon: Truck, color: 'emerald' },
    { label: 'Validation Pass %', value: validationPassPct, change: 0, icon: ShieldCheck, color: 'emerald' },
    { label: 'Bulk Jobs', value: bulkJobs.length, change: 0, icon: Zap, color: 'amber' },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 flex items-center justify-center">
        <div className="flex items-center gap-3 text-emerald-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Loading e-invoices…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      {error && (
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Failed to load e-invoices: {error}</span>
            </div>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => window.location.reload()}>
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </div>
        </div>
      )}
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
                // When there is no underlying data we render "—" so users
                // never see fake numbers (₹0 / 0% would still be misleading).
                const hasData = eInvoices.length > 0 || s.label === 'Bulk Jobs' || s.label === 'E-Way Bills Active'
                const displayValue = hasData
                  ? (typeof s.value === 'number' && s.value > 1000 ? fmtINR(s.value) : s.value)
                  : '—'
                const displaySuffix = hasData && typeof s.value === 'number' && s.value < 100
                  ? (s.value % 1 !== 0 ? '%' : '')
                  : ''
                return (
                  <motion.div key={s.label} variants={item}>
                    <Card className="hover:shadow-md transition-shadow border-slate-200/60 dark:border-slate-800/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground">
                            <span>—</span>
                          </div>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white">{displayValue}{displaySuffix}</p>
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
                      <ValidationGauge percent={validationPassPct} />
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{eInvoices.length > 0 ? `${validCount} Passed` : '—'}</p>
                            <p className="text-[10px] text-muted-foreground">Valid IRN generated</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{eInvoices.length > 0 ? `${expiredCount} Warnings` : '—'}</p>
                            <p className="text-[10px] text-muted-foreground">GSTIN mismatch</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-rose-500" />
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">{eInvoices.length > 0 ? `${cancelledCount} Failed` : '—'}</p>
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
                    {dailyIRNData.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="No IRN history yet"
                        description="Daily IRN generation counts will appear here once e-invoices are generated."
                        compact
                      />
                    ) : (
                      <>
                        <div className="flex justify-center pb-2">
                          <DailyIRNChart data={dailyIRNData} />
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{dailyIRNData.reduce((s, d) => s + d.count, 0)}</p>
                            <p className="text-[10px] text-muted-foreground">This Week</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{eInvoices.length}</p>
                            <p className="text-[10px] text-muted-foreground">This Month</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{dailyIRNData.length > 0 ? (dailyIRNData.reduce((s, d) => s + d.count, 0) / dailyIRNData.length).toFixed(1) : '—'}</p>
                            <p className="text-[10px] text-muted-foreground">Avg / Day</p>
                          </div>
                        </div>
                      </>
                    )}
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
                  {eInvoices.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No e-invoices yet"
                      description="Upload sales invoices to generate IRNs."
                      compact
                    />
                  ) : (
                    <ScrollArea className="max-h-72">
                      <div className="divide-y dark:divide-slate-800/60">
                        {eInvoices.slice(0, 6).map((inv, i) => (
                          <motion.div key={inv.irn + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${inv.status === 'valid' ? 'bg-emerald-100 dark:bg-emerald-900/30' : inv.status === 'expired' ? 'bg-slate-100 dark:bg-slate-800' : 'bg-rose-100 dark:bg-rose-900/30'}`}>
                                <FileText className={`h-4 w-4 ${inv.status === 'valid' ? 'text-emerald-600 dark:text-emerald-400' : inv.status === 'expired' ? 'text-slate-400' : 'text-rose-500 dark:text-rose-400'}`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-muted-foreground">{inv.irn.slice(0, 12)}{inv.irn.length > 12 ? '…' : ''}</span>
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
                  )}
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
                  {filteredEInvoices.length === 0 ? (
                    <EmptyState
                      icon={Hash}
                      title={eInvoices.length === 0 ? 'No e-invoices yet' : 'No matching e-invoices'}
                      description={eInvoices.length === 0 ? 'Upload sales invoices to generate IRNs.' : 'Try a different search term.'}
                      compact
                    />
                  ) : (
                    <ScrollArea className="max-h-[600px]">
                      <div className="divide-y dark:divide-slate-800/60">
                        {filteredEInvoices.map((inv, i) => (
                          <motion.div key={inv.irn + i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
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
                  )}
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
                  {eWayBills.length === 0 ? (
                    <EmptyState
                      icon={Truck}
                      title="No e-way bills generated"
                      description="Create your first e-way bill to track movement of goods across state lines."
                      compact
                    />
                  ) : (
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
                  )}
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
              {bulkJobs.length === 0 ? (
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardContent className="p-0">
                    <EmptyState
                      icon={Zap}
                      title="No bulk jobs yet"
                      description="Bulk IRN generation jobs will appear here once you queue a batch of invoices for processing."
                      compact
                    />
                  </CardContent>
                </Card>
              ) : (
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
              )}
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
