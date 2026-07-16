'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Receipt, ArrowUpRight, ArrowDownRight, TrendingUp,
  IndianRupee, FileText, CheckCircle2, Clock,
  AlertCircle, Download, Plus, Search, Filter,
  ChevronRight, Link2, CreditCard, Building2,
  Wallet, RefreshCw, Send, ArrowRightLeft,
  Smartphone, Monitor, BadgeCheck, XCircle,
  CircleDot, Banknote, Calendar, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { EmptyState, ProfessionalEmptyState } from '@/components/shared'
import { useApp } from '@/contexts/AppContext'
import { toast } from 'sonner'
import { useFirePayments, useFireExpenses } from '@/hooks/use-firestore'
import { createPayment, updatePayment } from '@/lib/firestore-service'
import type { FirestorePayment, FirestoreExpense } from '@/lib/firestore-schema'

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
// TYPES — derived from real API responses
// ═══════════════════════════════════════════════════════════════════════════════

interface Receivable {
  id: string
  client: string
  invoice: string
  amount: number
  dueDate: string
  status: 'pending' | 'received' | 'overdue'
  method: string | null
}

interface Payable {
  id: string
  vendor: string
  category: string
  amount: number
  dueDate: string
  status: 'scheduled' | 'pending' | 'paid'
}

interface PaymentLink {
  id: string
  client: string
  amount: number
  createdDate: string
  expiry: string
  status: 'active' | 'expired' | 'paid'
  visits: number
}

interface ReconciliationItem {
  id: string
  date: string
  bankRef: string
  amount: number
  invoice: string | null
  status: 'matched' | 'unmatched' | 'disputed'
}

interface CollectionMethod {
  method: string
  amount: number
  color: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — color maps (UI styling only, no fake data)
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS — derive display strings from raw Firestore rows
// ═══════════════════════════════════════════════════════════════════════════════

function formatTxnDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function titleCaseMode(mode: string): string {
  if (!mode) return 'Bank'
  const lower = mode.toLowerCase()
  if (lower === 'upi') return 'UPI'
  if (lower === 'bank') return 'Net Banking'
  if (lower === 'card') return 'Card'
  if (lower === 'cheque') return 'Cheque'
  if (lower === 'cash') return 'Cash'
  return mode.charAt(0).toUpperCase() + mode.slice(1)
}

const METHOD_COLOR: Record<string, string> = {
  UPI: '#10b981',
  'Net Banking': '#64748b',
  Card: '#f59e0b',
  Cheque: '#8b5cf6',
  Cash: '#0ea5e9',
}

export default function PaymentsPage() {
  const { setCurrentView } = useApp()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQ, setSearchQ] = useState('')
  // Retry key — increments to force re-mount of the data layer when the user clicks Retry.
  const [retryKey, setRetryKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)

  // ── Record Payment dialog state ────────────────────────────────────────────
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [paymentPartyName, setPaymentPartyName] = useState('')
  const [paymentPartyType, setPaymentPartyType] = useState<'vendor' | 'customer'>('customer')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('upi')
  const [paymentSaving, setPaymentSaving] = useState(false)

  // ── Firestore hooks (real-time, firm-scoped) ───────────────────────────────
  const paymentsHook = useFirePayments()
  const expensesHook = useFireExpenses()

  const loading = paymentsHook.loading || expensesHook.loading
  const error = paymentsHook.error || expensesHook.error

  // ── Derived arrays (memoized) — feed existing UI unchanged ─────────────────

  const receivables = useMemo<Receivable[]>(() => {
    const rawPayments = paymentsHook.data || []
    return rawPayments
      .filter((p) => (p.partyType || 'customer') !== 'vendor')
      .map((p) => {
        const status = (p.status || 'completed') as string
        const isReconciled = Boolean(p.reconciled ?? false)
        let recStatus: Receivable['status'] = 'pending'
        if (isReconciled || status === 'completed') recStatus = 'received'
        if (status === 'failed') recStatus = 'overdue'
        return {
          id: p.id,
          client: p.partyName || 'Unknown',
          invoice: p.invoiceId ? p.invoiceId : '—',
          amount: Number(p.amount ?? 0),
          dueDate: formatTxnDate(p.paymentDate || ''),
          status: recStatus,
          method: p.paymentMode ? titleCaseMode(p.paymentMode) : null,
        }
      })
  }, [paymentsHook.data])

  const payables = useMemo<Payable[]>(() => {
    const rawPayments = paymentsHook.data || []
    const rawExpenses = expensesHook.data || []
    const vendorPayables: Payable[] = rawPayments
      .filter((p) => (p.partyType || 'customer') === 'vendor')
      .map((p) => {
        const status = (p.status || 'completed') as string
        let payStatus: Payable['status'] = 'pending'
        if (status === 'completed') payStatus = 'paid'
        else if (status === 'pending') payStatus = 'scheduled'
        return {
          id: p.id,
          vendor: p.partyName || 'Unknown',
          category: 'Vendor Payment',
          amount: Number(p.amount ?? 0),
          dueDate: formatTxnDate(p.paymentDate || ''),
          status: payStatus,
        }
      })
    const expensePayables: Payable[] = rawExpenses.map((e) => ({
      id: e.id,
      vendor: (e.vendor || e.description || 'Vendor') as string,
      category: (e.category || 'Expense') as string,
      amount: Number(e.amount ?? 0),
      dueDate: formatTxnDate(e.date || ''),
      status: 'paid',
    }))
    return [...vendorPayables, ...expensePayables]
  }, [paymentsHook.data, expensesHook.data])

  const reconciliationItems = useMemo<ReconciliationItem[]>(() => {
    const rawPayments = paymentsHook.data || []
    return rawPayments.map((p) => {
      const status = (p.status || 'completed') as string
      const isReconciled = Boolean(p.reconciled ?? false)
      let recStatus: ReconciliationItem['status'] = 'unmatched'
      if (isReconciled) recStatus = 'matched'
      else if (status === 'failed') recStatus = 'disputed'
      return {
        id: p.id,
        date: formatTxnDate(p.paymentDate || ''),
        bankRef: (p.referenceNo as string) || `${(p.paymentMode || 'BANK').toUpperCase()}-${p.id.slice(-6)}`,
        amount: Number(p.amount ?? 0),
        invoice: (p.invoiceId as string) || null,
        status: recStatus,
      }
    })
  }, [paymentsHook.data])

  const collectionByMethod = useMemo<CollectionMethod[]>(() => {
    const rawPayments = paymentsHook.data || []
    const methodMap = new Map<string, number>()
    for (const p of rawPayments) {
      if ((p.partyType || 'customer') === 'vendor') continue
      const mode = titleCaseMode(p.paymentMode || 'bank')
      methodMap.set(mode, (methodMap.get(mode) ?? 0) + Number(p.amount ?? 0))
    }
    return Array.from(methodMap.entries())
      .map(([method, amount]) => ({ method, amount, color: METHOD_COLOR[method] ?? '#94a3b8' }))
      .sort((a, b) => b.amount - a.amount)
  }, [paymentsHook.data])

  const paymentLinks: PaymentLink[] = []
  const weeklyTrend: { week: string; collected: number; paid: number }[] = []

  // ── Derived stats (existing computations, fed by Firestore data) ───────────
  const totalCollected = receivables.reduce((s, r) => s + r.amount, 0)
  const totalPaid = payables.reduce((s, p) => s + p.amount, 0)
  const outstandingCount = receivables.filter((r) => r.status === 'pending').length
  const overdueCount = receivables.filter((r) => r.status === 'overdue').length

  const statCards = [
    { label: 'Total Collected', value: receivables.length > 0 ? totalCollected : null, icon: TrendingUp, color: 'emerald' as const },
    { label: 'Total Paid', value: payables.length > 0 ? totalPaid : null, icon: Banknote, color: 'amber' as const },
    { label: 'Outstanding', value: receivables.length > 0 ? outstandingCount : null, icon: Clock, color: 'slate' as const },
    { label: 'Overdue', value: receivables.length > 0 ? overdueCount : null, icon: AlertCircle, color: 'rose' as const },
  ]

  const matchedReconCount = reconciliationItems.filter((r) => r.status === 'matched').length
  const unmatchedReconCount = reconciliationItems.filter((r) => r.status === 'unmatched').length
  const disputedReconCount = reconciliationItems.filter((r) => r.status === 'disputed').length

  // ── Write handlers (Firestore service functions) ───────────────────────────

  const openRecordPaymentDialog = useCallback((partyType: 'vendor' | 'customer') => {
    setPaymentPartyType(partyType)
    setPaymentPartyName('')
    setPaymentAmount('')
    setPaymentMode('upi')
    setRecordPaymentOpen(true)
  }, [])

  const handleRecordPayment = useCallback(async () => {
    const trimmedName = paymentPartyName.trim()
    if (!trimmedName) {
      toast.error('Party name is required', {
        description: paymentPartyType === 'vendor'
          ? 'Enter the vendor name you paid.'
          : 'Enter the client or customer name who paid you.',
      })
      return
    }
    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount greater than ₹0')
      return
    }
    const mode = (paymentMode || 'upi').toLowerCase()
    setPaymentSaving(true)
    setBusyId('new-payment')
    try {
      await createPayment({
        clientId: null,
        invoiceId: null,
        purchaseBillId: null,
        partyName: trimmedName,
        partyType: paymentPartyType,
        amount,
        paymentDate: new Date().toISOString(),
        paymentMode: mode,
        referenceNo: null,
        status: 'completed',
        reconciled: false,
        notes: null,
      })
      toast.success(paymentPartyType === 'vendor' ? 'Vendor payment recorded' : 'Receipt recorded')
      setRecordPaymentOpen(false)
      setPaymentPartyName('')
      setPaymentAmount('')
      setPaymentMode('upi')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment')
    } finally {
      setPaymentSaving(false)
      setBusyId(null)
    }
  }, [paymentPartyName, paymentAmount, paymentMode, paymentPartyType])

  const handleAutoReconcile = useCallback(async () => {
    const unmatched = reconciliationItems.filter((r) => r.status !== 'matched')
    if (unmatched.length === 0) {
      toast.success('All payments are already reconciled')
      return
    }
    setBusyId('auto-reconcile')
    try {
      await Promise.all(
        unmatched.map((r) => updatePayment(r.id, { reconciled: true })),
      )
      toast.success(`Reconciled ${unmatched.length} payment${unmatched.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to auto-reconcile')
    } finally {
      setBusyId(null)
    }
  }, [reconciliationItems])

  const handleMatchRow = useCallback(async (id: string) => {
    setBusyId(id)
    try {
      await updatePayment(id, { reconciled: true })
      toast.success('Payment marked as reconciled')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to match payment')
    } finally {
      setBusyId(null)
    }
  }, [])

  return (
    <div
      key={retryKey}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20"
    >
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
            <Button variant="outline" size="sm" className="gap-1.5" disabled title="Export coming soon"><Download className="h-3.5 w-3.5" />Export</Button>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => openRecordPaymentDialog('customer')}
              disabled={busyId === 'new-payment'}
            >
              {busyId === 'new-payment' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Record Payment
            </Button>
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
        {/* ── Error banner ── */}
        {error && !loading && (
          <Card className="mb-6 border-rose-200 dark:border-rose-900/60">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <AlertCircle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Failed to load payments data</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setRetryKey((k) => k + 1)}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ─── OVERVIEW TAB ─── */}
          <TabsContent value="overview" className="mt-0 space-y-6">
            {/* Stat Cards */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              </div>
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((s) => {
                  const Icon = s.icon
                  const hasValue = s.value !== null && s.value !== undefined
                  return (
                    <motion.div key={s.label} variants={item}>
                      <Card className="hover:shadow-md transition-shadow border-slate-200/60 dark:border-slate-800/60">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : s.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : s.color === 'rose' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                              <Icon className="h-4.5 w-4.5" />
                            </div>
                          </div>
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {hasValue ? (typeof s.value === 'number' && s.value > 100 ? fmtINR(s.value) : s.value) : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}

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
                    {collectionByMethod.length === 0 ? (
                      <EmptyState
                        icon={CreditCard}
                        title="No collections yet"
                        description="Collection breakdown by payment method will appear here once payments are recorded."
                        compact
                      />
                    ) : (
                      <>
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
                      </>
                    )}
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
                    {weeklyTrend.length === 0 ? (
                      <EmptyState
                        icon={TrendingUp}
                        title="No payment trend yet"
                        description="Weekly collected vs paid trend will appear here once you have payment history."
                        compact
                      />
                    ) : (
                      <>
                        <div className="flex justify-center pb-2">
                          <PaymentTrendChart data={weeklyTrend} />
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{receivables.length > 0 ? fmtINR(totalCollected) : '—'}</p>
                            <p className="text-[10px] text-muted-foreground">Total Collected</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{payables.length > 0 ? fmtINR(totalPaid) : '—'}</p>
                            <p className="text-[10px] text-muted-foreground">Total Paid</p>
                          </div>
                        </div>
                      </>
                    )}
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
                  {receivables.length === 0 ? (
                    <EmptyState
                      icon={IndianRupee}
                      title="No receivables yet"
                      description="Customer payments will appear here once you record a receipt or sync an invoice."
                      compact
                    />
                  ) : (
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
                  )}
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
                      <Button key={f} variant="outline" size="sm" className="h-7 text-[10px] px-2" disabled title="Status filters coming soon">{f}</Button>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => openRecordPaymentDialog('customer')}
                  disabled={busyId === 'new-payment'}
                >
                  {busyId === 'new-payment' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Record Receipt
                </Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  {receivables.length === 0 ? (
                    <ProfessionalEmptyState
                      icon={IndianRupee}
                      title="No receivables yet"
                      description="Record a customer receipt or sync an invoice to start collecting payments. Each receipt can be auto-matched to an open invoice."
                      accent="emerald"
                      action={{
                        label: 'Record Receipt',
                        onClick: () => openRecordPaymentDialog('customer'),
                        icon: Plus,
                      }}
                      secondaryAction={{
                        label: 'Open invoice workspace',
                        onClick: () => setCurrentView('invoices'),
                      }}
                    />
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── PAYABLES TAB ─── */}
          <TabsContent value="payables" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <Input placeholder="Search payables..." className="w-64 h-8 text-xs" />
                <Button
                  size="sm"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => openRecordPaymentDialog('vendor')}
                  disabled={busyId === 'new-payment'}
                >
                  {busyId === 'new-payment' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Schedule Payment
                </Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  {payables.length === 0 ? (
                    <ProfessionalEmptyState
                      icon={Send}
                      title="No payables yet"
                      description="Schedule a vendor payment or record an expense to start tracking your outflows. Scheduled payments can be auto-reconciled once cleared."
                      accent="amber"
                      action={{
                        label: 'Schedule Payment',
                        onClick: () => openRecordPaymentDialog('vendor'),
                        icon: Plus,
                      }}
                      secondaryAction={{
                        label: 'Open banking',
                        onClick: () => setCurrentView('banking'),
                      }}
                    />
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ─── PAYMENT LINKS TAB ─── */}
          <TabsContent value="payment-links" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Payment Links</h3>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled title="Payment links coming soon"><Link2 className="h-3.5 w-3.5" />Create Link</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paymentLinks.length === 0 ? (
                  <div className="col-span-full">
                    <Card className="border-slate-200/60 dark:border-slate-800/60">
                      <CardContent>
                        <ProfessionalEmptyState
                          icon={Link2}
                          title="No payment links yet"
                          description="Create a payment link to share with clients and start collecting online. Links can be tracked, expired, and auto-reconciled."
                          accent="cyan"
                          action={{
                            label: 'Create Link',
                            onClick: () => setCurrentView('clients'),
                            icon: Plus,
                          }}
                        />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  paymentLinks.map((pl, i) => (
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
                            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" disabled title="No link to copy"><Link2 className="h-3 w-3" />Copy Link</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* ─── RECONCILIATION TAB ─── */}
          <TabsContent value="reconciliation" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-emerald-500" />Matched: {matchedReconCount}</span>
                    <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-amber-500" />Unmatched: {unmatchedReconCount}</span>
                    <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-rose-500" />Disputed: {disputedReconCount}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleAutoReconcile}
                  disabled={busyId === 'auto-reconcile'}
                >
                  {busyId === 'auto-reconcile' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Auto-Reconcile
                </Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  {reconciliationItems.length === 0 ? (
                    <ProfessionalEmptyState
                      icon={ArrowRightLeft}
                      title="No reconciliations yet"
                      description="Open the reconciliation workspace to auto-match bank transactions against invoices, expenses, and payments."
                      accent="teal"
                      action={{
                        label: 'Start reconciliation',
                        onClick: () => setCurrentView('reconcile'),
                        icon: ArrowRightLeft,
                      }}
                    />
                  ) : (
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
                              <p className="text-[10px] text-muted-foreground">{rc.date}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtINR(rc.amount)}</span>
                            {rc.status === 'unmatched' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1"
                                onClick={() => handleMatchRow(rc.id)}
                                disabled={busyId === rc.id}
                              >
                                {busyId === rc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Match'}
                              </Button>
                            )}
                            {rc.status === 'disputed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1"
                                onClick={() => handleMatchRow(rc.id)}
                                disabled={busyId === rc.id}
                              >
                                {busyId === rc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Resolve'}
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Record Payment Dialog (replaces window.prompt chain) ──────────── */}
      <Dialog
        open={recordPaymentOpen}
        onOpenChange={(open) => {
          if (!paymentSaving) setRecordPaymentOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-md bg-emerald-600 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-white" />
              </span>
              Record Payment
            </DialogTitle>
            <DialogDescription>
              Capture a receipt (money in) or a vendor payment (money out). All fields are required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Payment type */}
            <div className="space-y-2">
              <Label>Payment type</Label>
              <RadioGroup
                value={paymentPartyType}
                onValueChange={(v) => setPaymentPartyType(v as 'vendor' | 'customer')}
                className="grid grid-cols-2 gap-2"
              >
                <label
                  htmlFor="pt-customer"
                  className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors ${
                    paymentPartyType === 'customer'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <RadioGroupItem value="customer" id="pt-customer" disabled={paymentSaving} />
                  <span className="text-xs font-medium">Receipt (In)</span>
                </label>
                <label
                  htmlFor="pt-vendor"
                  className={`flex items-center gap-2 rounded-md border p-2.5 cursor-pointer transition-colors ${
                    paymentPartyType === 'vendor'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <RadioGroupItem value="vendor" id="pt-vendor" disabled={paymentSaving} />
                  <span className="text-xs font-medium">Vendor Payment (Out)</span>
                </label>
              </RadioGroup>
            </div>

            {/* Party name */}
            <div className="space-y-2">
              <Label htmlFor="payment-party-name">
                {paymentPartyType === 'vendor' ? 'Vendor name' : 'Client / customer name'}
              </Label>
              <Input
                id="payment-party-name"
                value={paymentPartyName}
                onChange={(e) => setPaymentPartyName(e.target.value)}
                placeholder={paymentPartyType === 'vendor'
                  ? 'e.g. Acme Suppliers Pvt Ltd'
                  : 'e.g. Globex Industries'}
                disabled={paymentSaving}
                autoFocus
              />
            </div>

            {/* Amount + Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                  <Input
                    id="payment-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                    disabled={paymentSaving}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-mode">Payment mode</Label>
                <Select
                  value={paymentMode}
                  onValueChange={setPaymentMode}
                  disabled={paymentSaving}
                >
                  <SelectTrigger id="payment-mode" className="w-full">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRecordPaymentOpen(false)}
              disabled={paymentSaving}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              onClick={handleRecordPayment}
              disabled={paymentSaving || busyId === 'new-payment'}
            >
              {paymentSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Save Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
