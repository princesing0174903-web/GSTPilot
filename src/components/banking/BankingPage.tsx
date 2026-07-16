'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Landmark, ArrowUpRight, ArrowDownRight, TrendingUp,
  IndianRupee, FileText, CheckCircle2, Clock,
  AlertCircle, Download, Plus, Search, Filter,
  ChevronRight, Building2, RefreshCw, ArrowRightLeft,
  CreditCard, Wallet, BadgeCheck, CircleDot,
  BarChart3, Calendar, Shield, CircleCheck,
  CircleX, Banknote, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { EmptyState, ProfessionalEmptyState } from '@/components/shared'
import { TrustBar } from '@/components/shared/TrustBar'
import { IntegrationComingSoonModal } from '@/components/dashboard/home/IntegrationComingSoonModal'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import {
  useFireBankAccounts,
  useFireBankTransactions,
  useFirePayments,
  useFireExpenses,
  useFireInvoices,
  useFireActivities,
} from '@/hooks/use-firestore'
import {
  createBankAccount,
  updateBankAccount,
  updatePayment,
  updateBankTransaction,
} from '@/lib/firestore-service'
import type {
  FirestoreBankAccount,
  FirestoreBankTransaction,
  FirestorePayment,
  FirestoreExpense,
  FirestoreInvoice,
} from '@/lib/firestore-schema'
import type {
  BankTransaction as ReconBankTransaction,
  TransactionCategory,
} from '@/lib/banking-provider/types'
import type { ReconcileInvoiceRef } from '@/lib/banking/reconcile'

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
// TYPES — derived from real API responses
// ═══════════════════════════════════════════════════════════════════════════════

interface BankAccount {
  id: string
  bank: string
  account: string
  type: string
  balance: number
  lastSync: string
  status: string
}

interface BankTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'credit' | 'debit'
  balance: number | null
  account: string
  category: string
}

interface ReconciliationEntry {
  id: string
  date: string
  bankTxn: string
  bookEntry: string | null
  amount: number
  status: 'matched' | 'unmatched' | 'disputed'
  account: string
}

interface StatementEntry {
  id: string
  account: string
  period: string
  generated: string
  transactions: number
  status: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — color maps (UI styling only, no fake data)
// ═══════════════════════════════════════════════════════════════════════════════

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

// ── Helpers: derive display strings from raw Firestore rows ─────────────────

function formatSyncDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function formatTxnDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function upperMode(mode: string): string {
  return (mode || 'bank').toUpperCase()
}

// Map Firestore BankAccount → BankAccount shape used by this page.
function mapBankAccount(acc: FirestoreBankAccount & { id: string }): BankAccount {
  const accountType = (acc.accountType || 'current') as string
  return {
    id: acc.id,
    bank: acc.bankName || 'Bank Account',
    account: acc.accountNumberMasked || '****',
    type: accountType.charAt(0).toUpperCase() + accountType.slice(1),
    balance: Number(acc.currentBalance ?? acc.availableBalance ?? 0) || 0,
    lastSync: formatSyncDate((acc.lastSyncAt as string | null) ?? null),
    status: (acc.status as string) || 'connected',
  }
}

// Map Firestore BankTransaction → BankTransaction shape used by this page.
function mapBankTxnToTxn(t: FirestoreBankTransaction & { id: string }): BankTransaction {
  const type = t.type === 'credit' ? 'credit' : 'debit'
  return {
    id: t.id,
    date: formatTxnDate(t.date || ''),
    description: t.description || 'Bank Transaction',
    amount: Math.abs(Number(t.amount) || 0),
    type,
    balance: t.balanceAfter == null ? null : Number(t.balanceAfter),
    account: t.referenceNo ? t.referenceNo.toUpperCase() : 'BANK',
    category: (t.category as string) || (type === 'credit' ? 'Revenue' : 'Purchase'),
  }
}

// Map Firestore Payment row → BankTransaction shape used by this page.
function mapPaymentToTxn(p: FirestorePayment & { id: string }): BankTransaction {
  const isVendor = (p.partyType || 'customer') === 'vendor'
  return {
    id: p.id,
    date: formatTxnDate(p.paymentDate || ''),
    description: `${upperMode(p.paymentMode || 'bank')} - ${p.partyName || 'Unknown'}`,
    amount: Number(p.amount) || 0,
    type: isVendor ? 'debit' : 'credit',
    balance: null,
    account: upperMode(p.paymentMode || 'bank'),
    category: isVendor ? 'Purchase' : 'Revenue',
  }
}

// Map Firestore Payment row → ReconciliationEntry shape used by this page.
function mapPaymentToRecon(p: FirestorePayment & { id: string }): ReconciliationEntry {
  let status: ReconciliationEntry['status'] = 'unmatched'
  if (p.reconciled) status = 'matched'
  else if (p.status === 'failed') status = 'disputed'
  return {
    id: p.id,
    date: formatTxnDate(p.paymentDate || ''),
    bankTxn: p.referenceNo || `${upperMode(p.paymentMode || 'bank')}-${p.id.slice(-6)}`,
    bookEntry: p.invoiceId || null,
    amount: Number(p.amount) || 0,
    status,
    account: upperMode(p.paymentMode || 'bank'),
  }
}

// Map Firestore Expense → BankTransaction (always a debit) shape used by this page.
function mapExpenseToTxn(e: FirestoreExpense & { id: string }): BankTransaction {
  const mode = (e.paymentMode || 'bank') as string
  return {
    id: e.id,
    date: formatTxnDate(e.date || ''),
    description: `${upperMode(mode)} - ${e.vendor || e.description || 'Expense'}`,
    amount: Number(e.amount) || 0,
    type: 'debit',
    balance: null,
    account: upperMode(mode),
    category: (e.category as string) || 'Purchase',
  }
}

// Map Firestore BankTransaction → banking-provider BankTransaction shape for
// the /api/banking/reconcile endpoint. The engine is pure + deterministic
// (amount + counterparty + reference matching) — no LLM, no fake data.
function mapBankTxnForRecon(
  t: FirestoreBankTransaction & { id: string },
  organizationId: string,
): ReconBankTransaction {
  const type = t.type === 'credit' ? 'credit' : 'debit'
  return {
    id: t.id,
    organizationId,
    connectionId: t.bankAccountId || 'legacy',
    accountId: t.bankAccountId || 'legacy',
    date: t.date || new Date().toISOString(),
    description: t.description || 'Bank Transaction',
    amount: Math.abs(Number(t.amount) || 0),
    type,
    balance: t.balanceAfter == null ? null : Number(t.balanceAfter),
    category: ((t.category as TransactionCategory | null) ?? 'other'),
    counterparty: null,
    referenceNumber: t.referenceNo,
    invoiceId: t.reconciledWith,
    reconciled: t.reconciled ? 'matched' : 'unmatched',
    matchConfidence: 0,
    syncedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Map Firestore Invoice → ReconcileInvoiceRef for the reconcile engine.
// FirestoreInvoice rows are GSTR-1 outward supplies (gstr1Section is one of
// b2b/b2cl/b2cs/cdnr/cdnur/exp), so we map them all to invoiceType:'sales'
// — the engine then matches them against credit (incoming) bank transactions.
function mapInvoiceForRecon(
  inv: FirestoreInvoice & { id: string },
): ReconcileInvoiceRef {
  const total = Number(inv.totalAmount) || 0
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber || '',
    clientName: inv.buyerName || '',
    grandTotal: total,
    balanceDue: total, // FirestoreInvoice does not track balance separately yet
    invoiceType: 'sales',
    issueDate: inv.invoiceDate,
    referenceNumber: null,
  }
}

// Extract a human-readable error message from a failed fetch JSON body.
function extractApiError(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error: unknown }).error
    if (typeof err === 'string' && err.length > 0) return err
  }
  return fallback
}

export default function BankingPage() {
  const { setCurrentView } = useApp()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQ, setSearchQ] = useState('')
  // Retry key — increments to force re-mount of the data layer when the user clicks Retry.
  const [retryKey, setRetryKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Transient per-account sync state — 'syncing' while we are briefly indicating
  // to the user that a sync request was acknowledged, 'idle' otherwise. NOT
  // persisted to Firestore (would be misleading — there is no live bank API
  // behind this button yet; see handleSyncAccount for the honest message).
  const [syncStatusMap, setSyncStatusMap] = useState<Record<string, 'syncing' | 'idle'>>({})
  // Banking integration is Coming Soon — open this modal whenever the user
  // clicks "Connect Bank" / "Add Account" / "Import Statement" instead of
  // routing to google-workspace or showing a fake window.prompt flow.
  const [comingSoonOpen, setComingSoonOpen] = useState(false)

  // ── Firestore hooks (real-time, firm-scoped) ───────────────────────────────
  const bankAcctsHook = useFireBankAccounts()
  const bankTxnsHook = useFireBankTransactions()
  const paymentsHook = useFirePayments()
  const expensesHook = useFireExpenses()
  // Invoices are only needed for the reconciliation engine — they are NOT part
  // of the global loading/error state so the page renders even if invoices are
  // still loading (reconcile will simply return 0 matches in that case).
  const invoicesHook = useFireInvoices()
  // Activities feed the TrustBar's "recent activity" count.
  const activitiesHook = useFireActivities()

  const loading =
    bankAcctsHook.loading ||
    bankTxnsHook.loading ||
    paymentsHook.loading ||
    expensesHook.loading
  const error =
    bankAcctsHook.error ||
    bankTxnsHook.error ||
    paymentsHook.error ||
    expensesHook.error

  // ── Trust indicator: last sync time ──
  // Stamp a Date whenever real (non-loading) data lands. onSnapshot delivers a
  // fresh snapshot on every backend write, so this reflects the true last
  // update from Firestore.
  const [lastSync, setLastSync] = useState<Date | null>(null)
  useEffect(() => {
    if (loading) return
    setLastSync(new Date())
  }, [
    loading,
    bankAcctsHook.data,
    bankTxnsHook.data,
    paymentsHook.data,
    expensesHook.data,
  ])

  // ── Derived arrays (memoized) — feed existing UI unchanged ─────────────────
  const bankAccounts = useMemo(
    () => (bankAcctsHook.data || []).map(mapBankAccount),
    [bankAcctsHook.data],
  )

  const transactions = useMemo<BankTransaction[]>(() => {
    const bankTxns = (bankTxnsHook.data || []).map(mapBankTxnToTxn)
    const paymentTxns = (paymentsHook.data || []).map(mapPaymentToTxn)
    const expenseTxns = (expensesHook.data || []).map(mapExpenseToTxn)
    return [...bankTxns, ...paymentTxns, ...expenseTxns].sort((a, b) =>
      b.date.localeCompare(a.date),
    )
  }, [bankTxnsHook.data, paymentsHook.data, expensesHook.data])

  const reconciliationData = useMemo<ReconciliationEntry[]>(
    () => (paymentsHook.data || []).map(mapPaymentToRecon),
    [paymentsHook.data],
  )

  // ── Balance trend: derive last 7 days from bank_transactions.balanceAfter ──
  const balanceTrendData = useMemo<{ day: string; balance: number }[]>(() => {
    const txns = bankTxnsHook.data || []
    if (txns.length === 0) return []
    const byDay = new Map<string, number>()
    for (const t of txns) {
      if (t.balanceAfter == null) continue
      const dayKey = (t.date || '').slice(0, 10) // YYYY-MM-DD
      if (!dayKey) continue
      byDay.set(dayKey, Number(t.balanceAfter))
    }
    const sorted = Array.from(byDay.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
    return sorted.slice(-7).map(([dayKey, balance]) => ({
      day: dayKey.slice(5), // MM-DD
      balance,
    }))
  }, [bankTxnsHook.data])

  const statements: StatementEntry[] = []

  // ── Derived stats (existing computations, fed by Firestore data) ───────────
  const totalBalance = bankAccounts.reduce((s, a) => s + a.balance, 0)
  const matchedCount = reconciliationData.filter(r => r.status === 'matched').length
  const unmatchedCount = reconciliationData.filter(r => r.status !== 'matched').length
  const disputedCount = reconciliationData.filter(r => r.status === 'disputed').length
  const unmatchedOnlyCount = reconciliationData.filter(r => r.status === 'unmatched').length
  const inTransitAmount = transactions
    .filter((t) => t.category === 'Purchase' && t.balance === null)
    .reduce((s, t) => s + t.amount, 0)

  const statCards = [
    { label: 'Total Balance', value: bankAccounts.length > 0 ? totalBalance : null, change: 0, icon: Landmark, color: 'emerald' as const },
    { label: 'In Transit', value: transactions.length > 0 ? inTransitAmount : null, change: 0, icon: Clock, color: 'amber' as const },
    { label: 'Reconciled', value: reconciliationData.length > 0 ? matchedCount : null, change: 0, icon: CircleCheck, color: 'emerald' as const },
    { label: 'Unreconciled', value: reconciliationData.length > 0 ? unmatchedCount : null, change: 0, icon: CircleX, color: 'rose' as const },
  ]

  // ── Write handlers (Firestore service functions) ───────────────────────────

  const handleAddAccount = () => {
    setComingSoonOpen(true)
  }

  const handleSyncAccount = useCallback(async (acc: BankAccount) => {
    setBusyId(acc.id)
    setSyncStatusMap((m) => ({ ...m, [acc.id]: 'syncing' }))
    try {
      // NOTE: This page uses the legacy Firestore bank-accounts collection (a
      // manual ledger). Real automated sync from a live bank requires the
      // Phase 6 Banking provider (encrypted sessions + provider sync). Until
      // that provider is wired, we can only refresh the last-sync marker so
      // the UI reflects a manual review — we do NOT fetch live transactions.
      // The brief 'syncing' affordance below is honest UI feedback that the
      // request was acknowledged; it transitions to 'idle' after 2s.
      await updateBankAccount(acc.id, {
        status: 'connected',
        lastSyncAt: new Date().toISOString(),
      })
      toast.info(
        `${acc.bank} — sync queued. Real bank API integration required for live transaction sync.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync account')
    } finally {
      // Hold the 'syncing' affordance for 2 seconds so the user sees the
      // feedback, then revert to 'idle' and clear the busy flag.
      setTimeout(() => {
        setSyncStatusMap((m) => ({ ...m, [acc.id]: 'idle' }))
        setBusyId(null)
      }, 2000)
    }
  }, [])

  const handleSyncAll = useCallback(async () => {
    if (bankAccounts.length === 0) {
      toast.error('No bank accounts to sync')
      return
    }
    setBusyId('sync-all')
    setSyncStatusMap((m) => {
      const next = { ...m }
      for (const acc of bankAccounts) next[acc.id] = 'syncing'
      return next
    })
    try {
      // NOTE: see handleSyncAccount — no live bank API is called here. We only
      // refresh the last-sync markers and surface an honest message.
      const now = new Date().toISOString()
      await Promise.all(
        bankAccounts.map((acc) =>
          updateBankAccount(acc.id, { status: 'connected', lastSyncAt: now }),
        ),
      )
      toast.info(
        `${bankAccounts.length} account${bankAccounts.length === 1 ? '' : 's'} — sync queued. Real bank API integration required for live transaction sync.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync accounts')
    } finally {
      setTimeout(() => {
        setSyncStatusMap((m) => {
          const next = { ...m }
          for (const acc of bankAccounts) next[acc.id] = 'idle'
          return next
        })
        setBusyId(null)
      }, 2000)
    }
  }, [bankAccounts])

  const handleAutoReconcile = useCallback(async () => {
    if (bankAccounts.length === 0) {
      toast.error('Connect a bank account before reconciling.')
      return
    }
    const rawBankTxns = bankTxnsHook.data || []
    if (rawBankTxns.length === 0) {
      toast.error('No bank transactions to reconcile. Sync a bank account first.')
      return
    }
    setBusyId('auto-reconcile')
    try {
      // Map real Firestore rows → the shapes the reconcile API expects, then
      // run the deterministic matching engine (amount + counterparty +
      // reference + confidence). No fabricated matches — every link returned
      // by the engine is backed by a real numeric + textual similarity score.
      const orgId = user?.id || 'org'
      const transactions = rawBankTxns.map((t) => mapBankTxnForRecon(t, orgId))
      const invoices = (invoicesHook.data || []).map(mapInvoiceForRecon)
      const res = await fetch('/api/banking/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, invoices }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(
          extractApiError(errBody, `Reconcile failed (HTTP ${res.status})`),
        )
      }
      const body = (await res.json()) as {
        ok: true
        result: { transactions: ReconBankTransaction[] }
      }
      const reconciledTxns = body.result.transactions
      // Persist the engine's matches back to Firestore so the link survives
      // refreshes. Only matched / partially_matched transactions are written.
      const matched = reconciledTxns.filter(
        (t) => t.reconciled === 'matched' || t.reconciled === 'partially_matched',
      )
      await Promise.all(
        matched.map((t) =>
          updateBankTransaction(t.id, {
            reconciled: true,
            reconciledWith: t.invoiceId,
          }),
        ),
      )
      const matchedCount = matched.filter((t) => t.reconciled === 'matched').length
      const partialCount = matched.filter((t) => t.reconciled === 'partially_matched').length
      const unmatchedCount = reconciledTxns.length - matched.length
      toast.success(
        `Auto-reconcile complete: ${matchedCount} matched, ${partialCount} partial, ${unmatchedCount} unmatched out of ${reconciledTxns.length} bank transactions.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Auto-reconcile failed')
    } finally {
      setBusyId(null)
    }
  }, [bankAccounts.length, bankTxnsHook.data, invoicesHook.data, user?.id])

  const handleMatchRow = useCallback(async (paymentId: string) => {
    setBusyId(paymentId)
    try {
      const payment = (paymentsHook.data || []).find((p) => p.id === paymentId)
      if (!payment) {
        toast.error('Payment not found — refresh and try again.')
        return
      }
      // Find a candidate bank transaction by amount + direction. This is the
      // real link the audit flagged as missing — previously we flipped a
      // boolean without associating any bank transaction. We require amount
      // within ±2% (matches the engine's amountSimilarity threshold).
      const paymentAmount = Math.abs(Number(payment.amount) || 0)
      const expectedType: 'credit' | 'debit' =
        (payment.partyType || 'customer') === 'vendor' ? 'debit' : 'credit'
      const candidates = (bankTxnsHook.data || [])
        .filter((t) => t.type === expectedType)
        .map((t) => ({
          t,
          diff: Math.abs(Math.abs(Number(t.amount) || 0) - paymentAmount),
        }))
        .filter((x) => paymentAmount === 0 || x.diff / paymentAmount <= 0.02)
        .sort((a, b) => a.diff - b.diff)
      const candidate = candidates[0]
      if (!candidate) {
        toast.error(
          'No matching bank transaction found within ±2% amount tolerance. Import the bank statement or adjust the payment amount first.',
        )
        return
      }
      const matchedTxnId = candidate.t.id
      // Validate the match deterministically by running it through the real
      // reconcile engine. We send the matched bank transaction + all invoices;
      // if the engine returns a match (matched / partially_matched) we also
      // persist the invoice link. If the API is unavailable we still persist
      // the amount-based bank-transaction link so the user's action is not
      // lost — this is the minimum honest fix for audit 1d issue #8.
      const orgId = user?.id || 'org'
      const transactions = [mapBankTxnForRecon(candidate.t, orgId)]
      const invoices = (invoicesHook.data || []).map(mapInvoiceForRecon)
      let engineInvoiceId: string | null = null
      try {
        const res = await fetch('/api/banking/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions, invoices }),
        })
        if (res.ok) {
          const body = (await res.json()) as {
            ok: true
            result: { transactions: ReconBankTransaction[] }
          }
          const reconciled = body.result.transactions[0]
          if (
            reconciled &&
            (reconciled.reconciled === 'matched' ||
              reconciled.reconciled === 'partially_matched')
          ) {
            engineInvoiceId = reconciled.invoiceId
          }
        }
      } catch {
        // API unavailable — fall back to amount-based link below.
      }
      // Persist the link on the payment (audit 1d #8 fix).
      await updatePayment(paymentId, {
        reconciled: true,
        reconciledTransactionId: matchedTxnId,
        invoiceId: engineInvoiceId ?? payment.invoiceId,
      })
      // Persist the reverse link on the bank transaction.
      try {
        await updateBankTransaction(matchedTxnId, {
          reconciled: true,
          reconciledWith: paymentId,
        })
      } catch {
        // Non-fatal — the payment-side link is the primary record.
      }
      const shortTxn = matchedTxnId.slice(-6).toUpperCase()
      if (engineInvoiceId) {
        const shortInv = engineInvoiceId.slice(-6).toUpperCase()
        toast.success(
          `Payment reconciled with bank txn ${shortTxn} and invoice ${shortInv} (engine-verified).`,
        )
      } else {
        toast.success(
          `Payment reconciled with bank txn ${shortTxn} (amount-matched; no invoice match found).`,
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to match payment')
    } finally {
      setBusyId(null)
    }
  }, [paymentsHook.data, bankTxnsHook.data, invoicesHook.data, user?.id])

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
              <Landmark className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Banking</h1>
              <p className="text-xs text-muted-foreground">Accounts & Reconciliation &middot; FY 2025-26</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleSyncAll}
              disabled={busyId === 'sync-all' || bankAccounts.length === 0}
            >
              {(busyId === 'sync-all') ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync All
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAddAccount}
              disabled={busyId === 'new-account'}
            >
              {busyId === 'new-account' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add Account
            </Button>
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
        {/* ── Trust bar: real connection status + last sync + activity count ── */}
        <div className="mb-6">
          <TrustBar
            lastSync={lastSync}
            connected={!loading && !error}
            connecting={loading}
            error={error}
            activityCount={(activitiesHook.data || []).length}
            onRefresh={() => setRetryKey((k) => k + 1)}
          />
        </div>

        {/* ── Error banner ── */}
        {error && !loading && (
          <Card className="mb-6 border-rose-200 dark:border-rose-900/60">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                  <AlertCircle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Failed to load banking data</p>
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
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${s.color === 'emerald' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : s.color === 'amber' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
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
                    {balanceTrendData.length === 0 ? (
                      <EmptyState
                        icon={TrendingUp}
                        title="No balance history yet"
                        description="Bank balance trends will appear here once your bank connection syncs historical data."
                        compact
                      />
                    ) : (
                      <>
                        <div className="flex justify-center pb-2">
                          <BalanceTrendChart data={balanceTrendData} />
                        </div>
                        <Separator className="my-3" />
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{bankAccounts.length > 0 ? fmtINR(totalBalance) : '—'}</p>
                            <p className="text-[10px] text-muted-foreground">Current</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">—</p>
                            <p className="text-[10px] text-muted-foreground">7-Day Change</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{transactions.length > 0 ? fmtINR(inTransitAmount) : '—'}</p>
                            <p className="text-[10px] text-muted-foreground">In Transit</p>
                          </div>
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
                      <Building2 className="h-4 w-4 text-emerald-600" /> Account Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {bankAccounts.length === 0 ? (
                      <ProfessionalEmptyState
                        icon={Landmark}
                        title="No bank connected"
                        description="Link your first bank account to see live balances, transactions, and auto-reconciliation."
                        accent="cyan"
                        compact
                        action={{
                          label: 'Connect Bank',
                          onClick: () => setComingSoonOpen(true),
                          icon: Plus,
                        }}
                      />
                    ) : (
                      bankAccounts.map(acc => {
                        const isSyncing = syncStatusMap[acc.id] === 'syncing'
                        return (
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
                              {isSyncing ? (
                                <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" /> syncing
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className={`text-[9px] ${statusColors[acc.status]}`}>{acc.status}</Badge>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
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
                    {reconciliationData.length === 0 ? (
                      <EmptyState
                        icon={Shield}
                        title="No reconciliations yet"
                        description="Bank-to-book matches will appear here once payments are reconciled."
                        compact
                      />
                    ) : (
                      <>
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
                                <p className="text-xs font-semibold text-slate-900 dark:text-white">{unmatchedOnlyCount} Unmatched</p>
                                <p className="text-[10px] text-muted-foreground">Needs review</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CircleX className="h-4 w-4 text-rose-500" />
                              <div>
                                <p className="text-xs font-semibold text-slate-900 dark:text-white">{disputedCount} Disputed</p>
                                <p className="text-[10px] text-muted-foreground">Amount mismatch</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Separator className="my-3" />
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Last auto-reconcile: {reconciliationData.length > 0 ? reconciliationData[0].date : '—'}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] gap-1"
                            onClick={handleAutoReconcile}
                            disabled={busyId === 'auto-reconcile'}
                          >
                            {busyId === 'auto-reconcile' ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Run Now
                          </Button>
                        </div>
                      </>
                    )}
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
                    {transactions.length === 0 ? (
                      <EmptyState
                        icon={FileText}
                        title="No transactions"
                        description="Bank transactions will appear here once you connect and sync a bank account."
                        compact
                      />
                    ) : (
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
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          {/* ─── ACCOUNTS TAB ─── */}
          <TabsContent value="accounts" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {bankAccounts.length === 0 ? (
                <Card className="border-slate-200/60 dark:border-slate-800/60">
                  <CardContent>
                    <ProfessionalEmptyState
                      icon={Landmark}
                      title="No bank accounts yet"
                      description="Connect your first bank account to unlock live balances, transaction sync, and automatic bank-to-book reconciliation."
                      accent="cyan"
                      action={{
                        label: 'Connect Bank',
                        onClick: () => setComingSoonOpen(true),
                        icon: Plus,
                      }}
                      secondaryAction={{
                        label: 'Open reconciliation instead',
                        onClick: () => setCurrentView('reconcile'),
                      }}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bankAccounts.map((acc, i) => {
                    const isSyncing = syncStatusMap[acc.id] === 'syncing'
                    return (
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
                            {isSyncing ? (
                              <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" /> syncing
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className={`text-[9px] ${statusColors[acc.status]}`}>{acc.status}</Badge>
                            )}
                          </div>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">{fmtINR(acc.balance)}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">A/C: ****{acc.account.slice(-4)}</p>
                          <Separator className="my-2" />
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-muted-foreground">Synced: {acc.lastSync}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] gap-1"
                              onClick={() => handleSyncAccount(acc)}
                              disabled={busyId === acc.id || isSyncing}
                            >
                              {busyId === acc.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                              Sync
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ─── TRANSACTIONS TAB ─── */}
          <TabsContent value="transactions" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Input placeholder="Search transactions..." className="w-64 h-8 text-xs" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                  <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled title="Banking integration coming soon"><Filter className="h-3 w-3" />Filter</Button>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 h-8" disabled title="Banking integration coming soon"><Download className="h-3.5 w-3.5" />Download</Button>
              </div>
              <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardContent className="p-0">
                  {transactions.length === 0 ? (
                    <ProfessionalEmptyState
                      icon={FileText}
                      title="No transactions yet"
                      description="Bank transactions will appear here automatically once you connect and sync a bank account."
                      accent="cyan"
                      action={{
                        label: 'Connect Bank',
                        onClick: () => setComingSoonOpen(true),
                        icon: Plus,
                      }}
                    />
                  ) : (
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
                                <p className="text-[10px] text-muted-foreground">Bal: {txn.balance === null ? '—' : fmtINR(txn.balance)}</p>
                              </div>
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

          {/* ─── RECONCILIATION TAB ─── */}
          <TabsContent value="reconciliation" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 text-xs">
                  <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-emerald-500" />Matched: {matchedCount}</span>
                  <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-amber-500" />Unmatched: {reconciliationData.filter(r => r.status === 'unmatched').length}</span>
                  <span className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-rose-500" />Disputed: {reconciliationData.filter(r => r.status === 'disputed').length}</span>
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
                  {reconciliationData.length === 0 ? (
                    <ProfessionalEmptyState
                      icon={ArrowRightLeft}
                      title="No reconciliations yet"
                      description="Open the reconciliation workspace to match bank transactions against your books and surface mismatches."
                      accent="teal"
                      action={{
                        label: 'Start reconciliation',
                        onClick: () => setCurrentView('reconcile'),
                        icon: ArrowRightLeft,
                      }}
                    />
                  ) : (
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
                            {rc.status === 'unmatched' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px]"
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
                                className="h-7 text-[10px]"
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

          {/* ─── STATEMENTS TAB ─── */}
          <TabsContent value="statements" className="mt-0 space-y-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Bank Statements</h3>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled title="Banking integration coming soon"><Download className="h-3.5 w-3.5" />Import Statement</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {statements.length === 0 ? (
                  <div className="col-span-full">
                    <Card className="border-slate-200/60 dark:border-slate-800/60">
                      <CardContent>
                        <ProfessionalEmptyState
                          icon={FileText}
                          title="No statements imported"
                          description="Imported bank statements will appear here for download and review."
                          accent="cyan"
                          action={{
                            label: 'Import Statement',
                            onClick: () => setComingSoonOpen(true),
                            icon: Download,
                          }}
                        />
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  statements.map((st, i) => (
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
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" disabled title="Banking integration coming soon"><Download className="h-3 w-3" />Download</Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Banking integration Coming Soon modal ── */}
      <IntegrationComingSoonModal
        open={comingSoonOpen}
        onOpenChange={setComingSoonOpen}
        integrationName="Banking"
        description="Live bank feeds (HDFC, ICICI, SBI, Axis, Kotak) are under development. Connect Google or Zoho Books to start syncing real financial data today."
        onConnectGoogle={() => { setComingSoonOpen(false); setCurrentView('google-workspace') }}
        onConnectZoho={() => { setComingSoonOpen(false); setCurrentView('zoho-books') }}
      />
    </div>
  )
}
