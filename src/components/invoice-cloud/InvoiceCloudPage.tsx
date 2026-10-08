'use client'

// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Real Invoice Engine™ — InvoiceCloudPage
// The flagship financial operations UI. 10 tabs (Overview + 9 modules).
// Premium dark cinematic theme. Oracle proactive integration.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Receipt, Plus, Upload, Send, Search, TrendingUp, TrendingDown,
  Wallet, ArrowUpRight, ArrowDownRight, Brain, Clock, AlertTriangle,
  CheckCircle2, FileText, Users, Calculator, IndianRupee, Calendar,
  RefreshCw, Eye, Trash2, Zap, Sparkles, X,
  Building2, Plane, Briefcase, Megaphone, Code2, Package,
} from 'lucide-react'

// ── Engine libs (imported from -utils files to keep Prisma out of client bundle) ─
import {
  formatInvoiceCurrency, getInvoiceStats,
  generateInvoiceNumber, calculateInvoiceTotals,
  daysOverdue,
} from '@/lib/invoices/invoices-utils'
import {
  seedPurchaseBills, getPurchaseStats,
} from '@/lib/invoices/purchases-utils'
import {
  seedExpenses, getExpenseStats, autoCategorize,
} from '@/lib/invoices/expenses-utils'
import {
  computeAging, getReceivablesSummary, scheduleReminders,
  forecastCollections,
} from '@/lib/invoices/receivables-utils'
import {
  getPayablesSummary, prioritizePayments, cashAllocationPlan,
} from '@/lib/invoices/payables-utils'
import {
  seedPayments, getPaymentStats,
} from '@/lib/invoices/payments-utils'
import {
  seedTDSRecords, getTDSStats, TDS_SECTIONS, detectSection, calculateTDS,
  quarterForDate,
} from '@/lib/invoices/tds-utils'
import {
  seedEmployees, seedPayroll, getPayrollStats,
  calculateSalaryBreakdown,
} from '@/lib/invoices/payroll-utils'
import {
  generateCashFlowForecast, identifyDelayedCollections, predictSurplusOrDeficit,
} from '@/lib/invoices/forecast'
import type {
  InvoiceCloudInvoice, PurchaseBill, Expense, ExpenseCategory,
  Payment, TDSRecord, Employee, Payroll,
} from '@/lib/invoices/types'

// ── Real Invoice Engine™ — Firestore-backed, org-scoped, real-time ─────────────
import { useInvoices } from '@/hooks/useInvoices'
import type {
  Invoice as EngineInvoice,
  CreateInvoiceInput,
} from '@/lib/invoice-engine'

// ── UI primitives ──────────────────────────────────────────────────────────────
import {
  ProButton, ProBadge, ProStatusDot, ProSkeleton, ProSpinner,
  springModalTransition, modalEnterVariants, backdropVariants,
} from '@/components/ui-pro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabKey =
  | 'overview' | 'sales' | 'purchase' | 'expenses'
  | 'receivables' | 'payables' | 'payments' | 'tds'
  | 'payroll' | 'forecast'

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Overview', icon: Sparkles },
  { key: 'sales', label: 'Sales', icon: Receipt },
  { key: 'purchase', label: 'Purchase', icon: FileText },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
  { key: 'receivables', label: 'Receivables', icon: TrendingUp },
  { key: 'payables', label: 'Payables', icon: TrendingDown },
  { key: 'payments', label: 'Payments', icon: IndianRupee },
  { key: 'tds', label: 'TDS', icon: Calculator },
  { key: 'payroll', label: 'Payroll', icon: Users },
  { key: 'forecast', label: 'Cash Forecast', icon: Brain },
]

const containerStagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const itemReveal = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

const fmtDate = (iso?: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

const fmtMonth = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

const todayIso = () => new Date().toISOString().split('T')[0]
const plusDaysIso = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Real Invoice Engine™ → Invoice Cloud™ shape adapter
//
// The new Firestore-backed engine (`@/lib/invoice-engine`) uses a richer data
// model than the legacy `InvoiceCloudInvoice` shape that the rest of this UI
// was built against. We map every engine invoice into the legacy shape so the
// Overview / Sales / Receivables / Forecast tabs keep working untouched.
//
// Field mappings:
//   grandTotal      → totalAmount
//   balanceDue      → balanceAmount
//   customerName    → buyerName
//   customerGstin   → buyerGstin
//   cgst+sgst+igst  → gstAmount
//   partially_paid  → partial  (legacy status enum)
// ═══════════════════════════════════════════════════════════════════════════════

function toCloudInvoice(inv: EngineInvoice): InvoiceCloudInvoice {
  // The new engine uses `partially_paid`; the legacy UI was built around
  // `partial`. Translate so StatusPill / filters keep working.
  const legacyStatus: string =
    inv.status === 'partially_paid' ? 'partial' : inv.status

  return {
    id: inv.id,
    clientId: inv.customerId ?? '',
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    sellerGstin: inv.sellerGstin,
    buyerGstin: inv.customerGstin ?? null,
    buyerName: inv.customerName,
    invoiceType: inv.customerGstin ? 'B2B' : 'B2C',
    gstr1Section: inv.customerGstin ? 'B2B' : 'B2C',
    taxableValue: inv.taxableValue,
    cgst: inv.cgst,
    sgst: inv.sgst,
    igst: inv.igst,
    cess: inv.cess,
    totalAmount: inv.grandTotal,
    hsnCode: inv.items[0]?.hsnSac ?? null,
    reverseCharge: false,
    status: legacyStatus,
    matchStatus: 'matched',
    riskLevel: 'low',
    riskScore: 0,
    aiExplanation: null,
    notes: inv.notes ?? null,
    period: inv.invoiceDate.slice(0, 7),
    assignedTo: inv.createdBy?.name ?? null,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,

    // Invoice Cloud™ financial fields
    dueDate: inv.dueDate,
    gstAmount: inv.cgst + inv.sgst + inv.igst,
    paidAmount: inv.paidAmount,
    balanceAmount: inv.balanceDue,
    paymentStatus: inv.paymentStatus,
    paymentMode: null,
    paymentDate: null,
    recurring: inv.recurring,
    recurringCycle: inv.recurringCycle ?? null,
    notesFinance: null,
    sentToCustomer: inv.status === 'sent' || inv.status === 'partially_paid' || inv.status === 'paid',
    sentAt: null,
  }
}

/** Type of the create() function exposed by the useInvoices() hook. */
type EngineCreateFn = (
  input: Omit<CreateInvoiceInput, 'organizationId' | 'createdBy'>,
) => Promise<EngineInvoice | null>

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Glass KPI card with icon, value, optional delta + tone. */
function KpiCard({
  label, value, delta, icon: Icon, tone = 'neutral', hint,
}: {
  label: string
  value: string
  delta?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'neutral' | 'bull' | 'bear' | 'accent'
  hint?: string
}) {
  const toneText =
    tone === 'bull' ? 'text-emerald-400'
      : tone === 'bear' ? 'text-rose-400'
        : tone === 'accent' ? 'accent-blue-text'
          : 'text-white'
  const iconBg =
    tone === 'bull' ? 'bg-emerald-500/15 text-emerald-300'
      : tone === 'bear' ? 'bg-rose-500/15 text-rose-300'
        : tone === 'accent' ? 'bg-[#3B82F6]/15 text-[#60A5FA]'
          : 'bg-white/5 text-white/70'
  return (
    <motion.div variants={itemReveal}>
      <div className="glass-surface rounded-2xl p-5 hover-lift border border-white/[0.06]">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className="h-4 w-4" />
          </div>
          {delta && (
            <span className={`text-[11px] ${tone === 'bull' ? 'text-emerald-400' : tone === 'bear' ? 'text-rose-400' : 'text-white/55'}`}>
              {delta}
            </span>
          )}
        </div>
        <div className={`text-2xl font-semibold tabular-nums ${toneText}`}>{value}</div>
        <div className="text-xs text-white/55 mt-0.5">{label}</div>
        {hint && <div className="text-[10px] text-white/40 mt-1">{hint}</div>}
      </div>
    </motion.div>
  )
}

/** Reusable glass modal with premium backdrop + spring transition. */
function GlassModal({
  open, onClose, title, subtitle, children, footer, maxWidth = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 premium-backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={`relative w-full ${maxWidth} glass-surface-strong rounded-2xl shadow-premium overflow-hidden border border-white/[0.08]`}
            variants={modalEnterVariants}
            transition={springModalTransition}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                {subtitle && <p className="text-xs text-white/55 mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/55 hover:text-white hover:bg-white/10 press-scale"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
            {footer && (
              <div className="p-5 border-t border-white/[0.06] flex justify-end gap-2">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Colored status pill. */
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    sent: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    draft: 'bg-white/5 text-white/55 border-white/10',
    partial: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    overdue: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
    cancelled: 'bg-white/5 text-white/40 border-white/10',
    unpaid: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    recorded: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    matched: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    unmatched: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
    completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    failed: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
    reconciled: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    deducted: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    filed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    inactive: 'bg-white/5 text-white/55 border-white/10',
    resigned: 'bg-rose-500/15 text-rose-300 border-rose-500/20',
    generated: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
    held: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    claimed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    reimbursed: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  }
  const cls = map[status] || 'bg-white/5 text-white/55 border-white/10'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      <span className="capitalize">{status}</span>
    </span>
  )
}

/** Section heading with icon + label + optional action. */
function SectionHead({
  title, icon: Icon, action,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#60A5FA]" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {action}
    </div>
  )
}

/** Empty state placeholder. */
function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-12 text-white/40 text-sm">{label}</div>
  )
}

// ── SVG charts ─────────────────────────────────────────────────────────────────

function CashFlowAreaChart({
  data,
}: {
  data: Array<{ month: string; inflow: number; outflow: number }>
}) {
  const w = 480, h = 160, pad = 10
  const max = Math.max(...data.flatMap((d) => [d.inflow, d.outflow]), 1)
  const xStep = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0
  const yScale = (v: number) => h - pad - (v / max) * (h - pad * 2 - 16)
  const inflowPts = data.map((d, i) => `${pad + i * xStep},${yScale(d.inflow)}`)
  const outflowPts = data.map((d, i) => `${pad + i * xStep},${yScale(d.outflow)}`)
  const lastX = pad + (data.length - 1) * xStep
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="cfInflow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="cfOutflow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`${pad},${h - pad - 12} ${inflowPts.join(' ')} ${lastX},${h - pad - 12}`}
        fill="url(#cfInflow)"
      />
      <polyline
        points={inflowPts.join(' ')}
        fill="none" stroke="#2563EB" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />
      <polygon
        points={`${pad},${h - pad - 12} ${outflowPts.join(' ')} ${lastX},${h - pad - 12}`}
        fill="url(#cfOutflow)"
      />
      <polyline
        points={outflowPts.join(' ')}
        fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 3"
        strokeLinecap="round" strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <text
          key={i} x={pad + i * xStep} y={h - 1} textAnchor="middle"
          className="fill-white/40"
          style={{ fontSize: 9 }}
        >
          {d.month}
        </text>
      ))}
    </svg>
  )
}

function ForecastBarChart({
  data,
}: {
  data: Array<{ month: string; inflow: number; outflow: number }>
}) {
  const w = 560, h = 220, padX = 24, padY = 28
  const max = Math.max(...data.flatMap((d) => [d.inflow, d.outflow]), 1)
  const groupW = (w - padX * 2) / Math.max(data.length, 1)
  const barW = Math.min(22, groupW * 0.32)
  const yScale = (v: number) => h - padY - (v / max) * (h - padY * 2)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      <defs>
        <linearGradient id="fcBarIn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="fcBarOut" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <line
          key={i} x1={padX} x2={w - padX}
          y1={padY + (h - padY * 2) * (1 - f)} y2={padY + (h - padY * 2) * (1 - f)}
          stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4"
        />
      ))}
      {data.map((d, i) => {
        const cx = padX + i * groupW + groupW / 2
        const yIn = yScale(d.inflow)
        const yOut = yScale(d.outflow)
        return (
          <g key={i}>
            <rect x={cx - barW - 2} y={yIn} width={barW} height={h - padY - yIn} rx={3} fill="url(#fcBarIn)" />
            <rect x={cx + 2} y={yOut} width={barW} height={h - padY - yOut} rx={3} fill="url(#fcBarOut)" />
            <text x={cx} y={h - 8} textAnchor="middle" className="fill-white/50" style={{ fontSize: 10 }}>{d.month}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB CONTENT COMPONENTS — defined after the main component for readability.
// (See file bottom: OverviewTab, SalesTab, PurchaseTab, ExpensesTab,
//  ReceivablesTab, PayablesTab, PaymentsTab, TDSTab, PayrollTab, ForecastTab)
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function InvoiceCloudPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // ── Real Invoice Engine™ — real-time, org-scoped invoices from Firestore ────
  // The hook owns the invoices state. We never call setInvoices manually — the
  // onSnapshot subscription surfaces every create/update/delete automatically.
  const {
    invoices: engineInvoices,
    loading: invoicesLoading,
    error: invoicesError,
    create: createInvoice,
    retry: retryInvoices,
  } = useInvoices()

  // Adapt engine invoices → legacy InvoiceCloudInvoice shape (read-only memo).
  const invoices = useMemo<InvoiceCloudInvoice[]>(
    () => engineInvoices.map(toCloudInvoice),
    [engineInvoices],
  )

  // ── Data state — non-invoice tabs still load via their legacy APIs ──────────
  const [bills, setBills] = useState<PurchaseBill[]>([])
  const [expensesArr, setExpensesArr] = useState<Expense[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tdsRecords, setTdsRecords] = useState<TDSRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payrolls, setPayrolls] = useState<Payroll[]>([])

  // ── Load non-invoice entities on mount (parallel, with seed fallback) ───────
  // Invoices are NOT loaded here — they come from the useInvoices() hook above.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const results = await Promise.allSettled([
        fetch('/api/purchases').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch('/api/expenses').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch('/api/payments').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch('/api/tds').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch('/api/payroll').then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ])
      if (cancelled) return

      const [bilR, expR, payR, tdsR, empR] = results
      const bil = bilR.status === 'fulfilled' && bilR.value?.purchases?.length
        ? bilR.value.purchases
        : seedPurchaseBills()
      const exp = expR.status === 'fulfilled' && expR.value?.expenses?.length
        ? expR.value.expenses
        : seedExpenses()
      const pay = payR.status === 'fulfilled' && payR.value?.payments?.length
        ? payR.value.payments
        : seedPayments()
      const tds = tdsR.status === 'fulfilled' && tdsR.value?.records?.length
        ? tdsR.value.records
        : seedTDSRecords()
      const emp = empR.status === 'fulfilled' && empR.value?.employees?.length
        ? empR.value.employees
        : seedEmployees()
      // Payrolls: derive from employees via seedPayroll when not provided.
      const payrollsInit = empR.status === 'fulfilled' && empR.value?.payrolls?.length
        ? empR.value.payrolls
        : seedPayroll(emp)

      setBills(bil)
      setExpensesArr(exp)
      setPayments(pay)
      setTdsRecords(tds)
      setEmployees(emp)
      setPayrolls(payrollsInit)
      setLoaded(true)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Combined loading — skeleton shows until BOTH engine + legacy tabs ready
  const pageLoading = loading || invoicesLoading

  // ── Oracle proactive integration — fires ONCE per session ────────────────────
  // Wait for both legacy-tab load AND the invoice engine's first snapshot so
  // the proactive prompt reflects real data instead of an empty book.
  useEffect(() => {
    if (!loaded) return
    if (invoicesLoading) return
    if (typeof window === 'undefined') return
    if (localStorage.getItem('invoice-cloud-oracle-fired')) return
    localStorage.setItem('invoice-cloud-oracle-fired', '1')
    const summary = getReceivablesSummary(invoices)
    const forecast = generateCashFlowForecast({
      invoices, bills, expenses: expensesArr, payrolls,
      historicalCollectionRate: 0.78, period: '2026-02',
    })
    const delayed = identifyDelayedCollections(invoices)
    const t = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('oracle-ask', {
        detail: {
          prompt:
            `Invoice Cloud summary: ${formatInvoiceCurrency(summary.totalOutstanding)} outstanding, ` +
            `${formatInvoiceCurrency(summary.totalOverdue)} overdue, ${delayed.length} delayed collections. ` +
            `Cash forecast: ${forecast.aiSummary} ` +
            `Provide proactive recommendations on collections and cash positioning.`,
        },
      }))
    }, 1500)
    return () => clearTimeout(t)
  }, [loaded, invoicesLoading, invoices, bills, expensesArr, payrolls])

  // ── Refresh handler — re-subscribes to the real-time invoice engine ──────────
  // Previously this reloaded the whole page. Now it just re-triggers the
  // Firestore onSnapshot subscription via the hook's retry() — the legacy
  // tab data (bills/expenses/etc.) is already loaded and unaffected.
  const handleSync = useCallback(() => {
    localStorage.removeItem('invoice-cloud-oracle-fired')
    retryInvoices()
    if (invoicesError) {
      toast.error(invoicesError)
    } else {
      toast.success('Re-syncing invoices from cloud…')
    }
  }, [retryInvoices, invoicesError])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black">
      {/* ── Sticky glass header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 glass-surface border-b border-white/[0.06]">
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl glass-surface-strong border border-white/[0.08] flex items-center justify-center">
              <Receipt className="h-5 w-5 text-[#60A5FA]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-white truncate flex items-center gap-2">
                Invoice Cloud
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-white/40 border border-white/10 rounded-full px-2 py-0.5">
                  VEYRO Engine™
                </span>
              </h1>
              <p className="text-[11px] text-white/55 truncate">Create. Track. Collect. Automate.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProButton variant="glass" size="sm" onClick={handleSync}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sync</span>
            </ProButton>
            <ProButton
              variant="primary"
              size="sm"
              onClick={() => setActiveTab('sales')}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Invoice</span>
            </ProButton>
          </div>
        </div>

        {/* ── Tabs bar ───────────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max pb-px">
            {TABS.map((t) => {
              const isActive = activeTab === t.key
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors rounded-t-lg ${
                    isActive
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{t.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="invoice-cloud-tab-underline"
                      className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#3B82F6] rounded-full"
                      transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as const }}
          >
            {pageLoading ? (
              <div className="space-y-4">
                <ProSkeleton lines={1} className="h-7 w-64" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <ProSkeleton key={i} lines={3} className="h-24" />
                  ))}
                </div>
                <ProSkeleton lines={6} className="h-64" />
              </div>
            ) : activeTab === 'overview' ? (
              <OverviewTab
                invoices={invoices}
                bills={bills}
                expenses={expensesArr}
                payments={payments}
                payrolls={payrolls}
                onNavigate={setActiveTab}
              />
            ) : activeTab === 'sales' ? (
              <SalesTab
                invoices={invoices}
                createInvoice={createInvoice}
              />
            ) : activeTab === 'purchase' ? (
              <PurchaseTab bills={bills} setBills={setBills} />
            ) : activeTab === 'expenses' ? (
              <ExpensesTab expenses={expensesArr} setExpenses={setExpensesArr} />
            ) : activeTab === 'receivables' ? (
              <ReceivablesTab invoices={invoices} />
            ) : activeTab === 'payables' ? (
              <PayablesTab bills={bills} />
            ) : activeTab === 'payments' ? (
              <PaymentsTab
                payments={payments}
                setPayments={setPayments}
                invoices={invoices}
                bills={bills}
              />
            ) : activeTab === 'tds' ? (
              <TDSTab records={tdsRecords} setRecords={setTdsRecords} />
            ) : activeTab === 'payroll' ? (
              <PayrollTab
                employees={employees}
                setEmployees={setEmployees}
                payrolls={payrolls}
                setPayrolls={setPayrolls}
              />
            ) : activeTab === 'forecast' ? (
              <ForecastTab
                invoices={invoices}
                bills={bills}
                expenses={expensesArr}
                payrolls={payrolls}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. OVERVIEW TAB — Command-center view
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab({
  invoices, bills, expenses, payments, payrolls, onNavigate,
}: {
  invoices: InvoiceCloudInvoice[]
  bills: PurchaseBill[]
  expenses: Expense[]
  payments: Payment[]
  payrolls: Payroll[]
  onNavigate: (t: TabKey) => void
}) {
  const invStats = useMemo(() => getInvoiceStats(invoices), [invoices])
  const billStats = useMemo(() => getPurchaseStats(bills), [bills])
  const expStats = useMemo(() => getExpenseStats(expenses), [expenses])
  const recvSummary = useMemo(() => getReceivablesSummary(invoices), [invoices])
  const paySummary = useMemo(() => getPayablesSummary(bills), [bills])
  const netCash = invStats.total - billStats.total - expStats.total

  // 6-month forecast chart data
  const forecastData = useMemo(() => {
    const arr: Array<{ month: string; inflow: number; outflow: number }> = []
    for (let i = 0; i < 6; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      const period = d.toISOString().split('T')[0].slice(0, 7)
      const fc = generateCashFlowForecast({
        invoices, bills, expenses, payrolls,
        historicalCollectionRate: 0.78, period,
      })
      arr.push({
        month: d.toLocaleDateString('en-IN', { month: 'short' }),
        inflow: fc.projectedInflow,
        outflow: fc.projectedOutflow,
      })
    }
    return arr
  }, [invoices, bills, expenses, payrolls])

  const currentForecast = forecastData[0]
    ? generateCashFlowForecast({
        invoices, bills, expenses, payrolls,
        historicalCollectionRate: 0.78,
        period: new Date().toISOString().split('T')[0].slice(0, 7),
      })
    : null

  // Oracle insights — depend only on raw props so manual memoization is preserved.
  const insights = useMemo(() => {
    const out: Array<{ icon: React.ComponentType<{ className?: string }>; tone: 'bull' | 'bear' | 'accent' | 'neutral'; text: string }> = []
    const recv = getReceivablesSummary(invoices)
    const pay = getPayablesSummary(bills)
    const delayed = identifyDelayedCollections(invoices)
    const fc = generateCashFlowForecast({
      invoices, bills, expenses, payrolls,
      historicalCollectionRate: 0.78,
      period: new Date().toISOString().split('T')[0].slice(0, 7),
    })
    const surplus = predictSurplusOrDeficit(fc)
    out.push({
      icon: TrendingUp,
      tone: recv.totalOutstanding > 0 ? 'accent' : 'neutral',
      text: `I've detected ${formatInvoiceCurrency(recv.totalOutstanding)} in outstanding receivables across your books.`,
    })
    if (delayed.length > 0) {
      out.push({
        icon: AlertTriangle,
        tone: 'bear',
        text: `I've identified ${delayed.length} delayed collection${delayed.length === 1 ? '' : 's'} totalling ${formatInvoiceCurrency(delayed.reduce((s, d) => s + d.amount, 0))}.`,
      })
    }
    out.push({
      icon: Brain,
      tone: surplus.type === 'surplus' ? 'bull' : surplus.type === 'deficit' ? 'bear' : 'neutral',
      text: `I've predicted a ${formatInvoiceCurrency(Math.abs(surplus.amount))} cash ${surplus.type} for the current period.`,
    })
    out.push({
      icon: CheckCircle2,
      tone: 'neutral',
      text: `Your collection rate is ${recv.collectionRate.toFixed(1)}% with an average ${recv.avgDaysToPay}-day payment cycle.`,
    })
    if (pay.totalOverdue > 0) {
      out.push({
        icon: TrendingDown,
        tone: 'bear',
        text: `Vendor payables overdue: ${formatInvoiceCurrency(pay.totalOverdue)} — prioritise settlement to preserve terms.`,
      })
    }
    return out
  }, [invoices, bills, expenses, payrolls])

  // Recent activity (last 5 across invoices + payments + expenses)
  const recentActivity = useMemo(() => {
    type Row = { id: string; date: string; type: 'Invoice' | 'Payment' | 'Expense'; party: string; amount: number; tone: 'bull' | 'bear' | 'neutral' }
    const rows: Row[] = []
    for (const inv of invoices) {
      rows.push({
        id: inv.id, date: inv.invoiceDate, type: 'Invoice',
        party: inv.buyerName ?? 'Customer', amount: inv.totalAmount, tone: 'bull',
      })
    }
    for (const p of payments) {
      rows.push({
        id: p.id, date: p.paymentDate, type: 'Payment',
        party: p.partyName,
        amount: p.partyType === 'customer' ? p.amount : -p.amount,
        tone: p.partyType === 'customer' ? 'bull' : 'bear',
      })
    }
    for (const e of expenses) {
      rows.push({
        id: e.id, date: e.date, type: 'Expense',
        party: e.vendor ?? e.category, amount: -e.amount, tone: 'bear',
      })
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  }, [invoices, payments, expenses])

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* ── 6 KPI cards ────────────────────────────────────────────────────── */}
      <motion.div
        variants={containerStagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        <KpiCard label="Total Sales" value={formatInvoiceCurrency(invStats.total)} icon={Receipt} tone="bull" delta="FY 2025-26" />
        <KpiCard label="Total Purchases" value={formatInvoiceCurrency(billStats.total)} icon={FileText} tone="neutral" delta="FY 2025-26" />
        <KpiCard label="Total Expenses" value={formatInvoiceCurrency(expStats.total)} icon={Wallet} tone="bear" delta={`${expenses.length} entries`} />
        <KpiCard label="Outstanding Receivables" value={formatInvoiceCurrency(recvSummary.totalOutstanding)} icon={TrendingUp} tone="accent" delta={`${invoices.length - invStats.draftCount} invoices`} />
        <KpiCard label="Total Payables" value={formatInvoiceCurrency(paySummary.totalPayable)} icon={TrendingDown} tone="bear" delta={`${bills.length} bills`} />
        <KpiCard
          label="Net Cash Flow"
          value={formatInvoiceCurrency(netCash)}
          icon={IndianRupee}
          tone={netCash >= 0 ? 'bull' : 'bear'}
          delta={netCash >= 0 ? 'surplus' : 'deficit'}
        />
      </motion.div>

      {/* ── Cash Flow Health + Oracle Insights ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
          <SectionHead title="Cash Flow Health" icon={TrendingUp} action={
            <ProBadge className="text-[10px]">
              <ProStatusDot status="live" /> 6-mo projection
            </ProBadge>
          } />
          <div className="mb-3 flex items-baseline gap-3">
            <div className="text-3xl font-semibold tabular-nums text-white">
              {currentForecast ? formatInvoiceCurrency(currentForecast.projectedNet) : '—'}
            </div>
            <div className={`text-xs ${currentForecast && currentForecast.projectedNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              projected net
            </div>
          </div>
          <CashFlowAreaChart data={forecastData} />
          <div className="mt-4 flex items-center gap-5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-white/55">Projected Inflow</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="text-white/55">Projected Outflow</span>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
          <SectionHead title="Oracle Proactive Insights" icon={Brain} action={
            <button
              onClick={() => onNavigate('forecast')}
              className="text-[11px] text-[#60A5FA] hover:text-[#93C5FD] flex items-center gap-1"
            >
              View forecast <ArrowUpRight className="h-3 w-3" />
            </button>
          } />
          <div className="space-y-3">
            {insights.map((ins, i) => {
              const Icon = ins.icon
              const toneCls =
                ins.tone === 'bull' ? 'bg-emerald-500/15 text-emerald-300'
                  : ins.tone === 'bear' ? 'bg-rose-500/15 text-rose-300'
                    : ins.tone === 'accent' ? 'bg-[#3B82F6]/15 text-[#60A5FA]'
                      : 'bg-white/5 text-white/60'
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${toneCls}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-xs text-white/75 leading-relaxed pt-1">{ins.text}</p>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* ── Recent Activity ────────────────────────────────────────────────── */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-5 pb-3">
          <SectionHead title="Recent Activity" icon={Clock} />
        </div>
        <div className="overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Party</th><th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((r) => (
                <tr key={r.id + r.type}>
                  <td className="text-white/60">{fmtDate(r.date)}</td>
                  <td><StatusPill status={r.type.toLowerCase()} /></td>
                  <td className="font-medium text-white/90">{r.party}</td>
                  <td className={`text-right font-semibold tabular-nums ${r.tone === 'bull' ? 'text-emerald-400' : r.tone === 'bear' ? 'text-rose-400' : 'text-white'}`}>
                    {r.amount < 0 ? '-' : ''}{formatInvoiceCurrency(Math.abs(r.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SALES TAB — Sales Invoice Cloud
// ═══════════════════════════════════════════════════════════════════════════════

function SalesTab({
  invoices, createInvoice,
}: {
  invoices: InvoiceCloudInvoice[]
  /** create() from the useInvoices() hook — Firestore-backed, server-calculated totals. */
  createInvoice: EngineCreateFn
}) {
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)

  const stats = useMemo(() => getInvoiceStats(invoices), [invoices])

  const filtered = useMemo(() => {
    let arr = [...invoices].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
    if (filter !== 'all') {
      arr = arr.filter((i) => {
        if (filter === 'overdue') return i.paymentStatus === 'overdue' || daysOverdue(i.dueDate ?? '') > 0
        return i.status === filter || i.paymentStatus === filter
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter((i) =>
        i.invoiceNumber.toLowerCase().includes(q) ||
        (i.buyerName ?? '').toLowerCase().includes(q)
      )
    }
    return arr
  }, [invoices, filter, search])

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* KPIs */}
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Billed" value={formatInvoiceCurrency(stats.total)} icon={Receipt} tone="bull" />
        <KpiCard label="Collected" value={formatInvoiceCurrency(stats.paid)} icon={CheckCircle2} tone="bull" />
        <KpiCard label="Outstanding" value={formatInvoiceCurrency(stats.outstanding)} icon={Clock} tone="accent" />
        <KpiCard label="Overdue" value={formatInvoiceCurrency(stats.overdue)} icon={AlertTriangle} tone="bear" />
      </motion.div>

      {/* Action bar */}
      <motion.div variants={itemReveal} className="flex flex-wrap items-center gap-2">
        <ProButton variant="primary" size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> New Invoice
        </ProButton>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice / customer"
              className="pl-8 h-9 w-56 bg-white/[0.04] border-white/[0.08] text-white text-xs placeholder:text-white/40"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-36 bg-white/[0.04] border-white/[0.08] text-white text-xs">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/[0.08]">
              {['all', 'draft', 'sent', 'paid', 'partial', 'overdue'].map((f) => (
                <SelectItem key={f} value={f} className="text-xs capitalize text-white/80 focus:bg-white/10">{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Invoice No</th><th>Customer</th><th>Date</th><th>Due</th>
                <th className="text-right">Total</th><th className="text-right">Paid</th>
                <th className="text-right">Balance</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9}><EmptyState label="No invoices match this filter" /></td></tr>
              ) : filtered.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-medium text-white">{inv.invoiceNumber}</td>
                  <td className="text-white/85">{inv.buyerName ?? '—'}</td>
                  <td className="text-white/60">{fmtDate(inv.invoiceDate)}</td>
                  <td className="text-white/60">{fmtDate(inv.dueDate)}</td>
                  <td className="text-right tabular-nums text-white">{formatInvoiceCurrency(inv.totalAmount)}</td>
                  <td className="text-right tabular-nums text-emerald-400">{formatInvoiceCurrency(inv.paidAmount)}</td>
                  <td className="text-right tabular-nums text-white/85">{formatInvoiceCurrency(inv.balanceAmount)}</td>
                  <td><StatusPill status={inv.paymentStatus} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-white/55 hover:text-white hover:bg-white/10" title="View"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="size-7 text-white/55 hover:text-[#60A5FA] hover:bg-white/10" title="Send"><Send className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <NewInvoiceModal
        open={showNew}
        onClose={() => setShowNew(false)}
        existing={invoices.map((i) => i.invoiceNumber)}
        onCreate={async (payload) => {
          // Hand off to the Real Invoice Engine™ — server computes all totals
          // (subtotal, CGST/SGST/IGST, round-off, grand total, balance due)
          // and assigns an atomic invoice number via Firestore transaction.
          // The hook's onSnapshot subscription surfaces the new invoice in the
          // table automatically — no manual setInvoices prepend needed.
          try {
            const result = await createInvoice({
              customerId: null, // ad-hoc invoice — no client linked yet
              customerName: payload.customerName,
              invoiceNumber: payload.invoiceNumber || undefined, // engine auto-generates if empty
              sellerName: 'VEYRO', // default seller — can be improved later
              sellerGstin: '',
              invoiceDate: payload.invoiceDate,
              dueDate: payload.dueDate,
              items: payload.items.map((it) => ({
                description: it.description,
                hsnSac: '', // modal doesn't collect HSN — empty is fine
                quantity: it.quantity,
                unit: 'NOS',
                unitPrice: it.unitPrice,
                gstRate: it.gstRate,
              })),
            })
            if (result) {
              toast.success(`Invoice ${result.invoiceNumber} saved.`)
              // Oracle confirmation
              window.dispatchEvent(new CustomEvent('oracle-ask', {
                detail: { prompt: `I've created Invoice ${result.invoiceNumber} for ${payload.customerName} totalling ${formatInvoiceCurrency(payload.totals.totalAmount)}. Tracking payment.` },
              }))
              setShowNew(false)
            } else {
              toast.error('Failed to create invoice.')
            }
          } catch {
            toast.error('Network error — invoice not saved.')
          }
        }}
      />
    </motion.div>
  )
}

/** New Invoice modal — line items + live total preview. */
function NewInvoiceModal({
  open, onClose, existing, onCreate,
}: {
  open: boolean
  onClose: () => void
  existing: string[]
  onCreate: (payload: {
    customerName: string
    invoiceDate: string
    dueDate: string
    invoiceNumber: string
    items: Array<{ description: string; quantity: number; unitPrice: number; gstRate: number }>
    totals: { taxableValue: number; gstAmount: number; totalAmount: number }
  }) => Promise<void>
}) {
  const [customerName, setCustomerName] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState(plusDaysIso(30))
  const [items, setItems] = useState<Array<{ description: string; quantity: number; unitPrice: number; gstRate: number }>>([
    { description: '', quantity: 1, unitPrice: 0, gstRate: 18 },
  ])
  const [saving, setSaving] = useState(false)

  const totals = useMemo(() => {
    const lineItems = items.map((it) => ({
      taxableValue: it.quantity * it.unitPrice,
      cgstRate: 0, sgstRate: 0, igstRate: it.gstRate,
    }))
    const t = calculateInvoiceTotals(lineItems)
    return {
      taxableValue: t.taxableValue,
      gstAmount: t.gstAmount,
      totalAmount: t.totalAmount,
    }
  }, [items])

  const addItem = () => setItems((p) => [...p, { description: '', quantity: 1, unitPrice: 0, gstRate: 18 }])
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i))
  const updateItem = (i: number, patch: Partial<typeof items[number]>) =>
    setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast.error('Customer name is required.'); return }
    if (items.every((it) => !it.description.trim() || it.unitPrice <= 0)) {
      toast.error('Add at least one line item.'); return
    }
    setSaving(true)
    const invoiceNumber = generateInvoiceNumber(existing)
    await onCreate({ customerName, invoiceDate, dueDate, invoiceNumber, items, totals })
    setSaving(false)
    // reset
    setCustomerName(''); setItems([{ description: '', quantity: 1, unitPrice: 0, gstRate: 18 }])
    setInvoiceDate(todayIso()); setDueDate(plusDaysIso(30))
  }

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="New Sales Invoice"
      subtitle="Create a B2B invoice with auto GST split + numbering"
      maxWidth="max-w-3xl"
      footer={
        <>
          <ProButton variant="ghost" size="sm" onClick={onClose}>Cancel</ProButton>
          <ProButton variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <ProSpinner size={14} /> : <Plus className="h-3.5 w-3.5" />}
            Create Invoice
          </ProButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Label className="text-xs text-white/55">Customer Name</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Infosys Limited"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-white/55">Invoice Date</Label>
            <Input
              type="date" value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-white/55">Due Date</Label>
            <Input
              type="date" value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-white/55">Line Items</Label>
            <button onClick={addItem} className="text-[11px] text-[#60A5FA] hover:text-[#93C5FD] flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input
                  value={it.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="Description"
                  className="col-span-5 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs"
                />
                <Input
                  type="number" min={0} value={it.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  placeholder="Qty"
                  className="col-span-2 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs"
                />
                <Input
                  type="number" min={0} value={it.unitPrice}
                  onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
                  placeholder="Unit price"
                  className="col-span-2 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs"
                />
                <Select
                  value={String(it.gstRate)}
                  onValueChange={(v) => updateItem(i, { gstRate: Number(v) })}
                >
                  <SelectTrigger className="col-span-2 h-9 bg-white/[0.04] border-white/[0.08] text-white text-xs">
                    <SelectValue placeholder="GST" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/[0.08]">
                    {[0, 5, 12, 18, 28].map((r) => (
                      <SelectItem key={r} value={String(r)} className="text-xs text-white/80 focus:bg-white/10">{r}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  onClick={() => removeItem(i)}
                  className="col-span-1 p-1.5 rounded-lg text-white/55 hover:text-rose-300 hover:bg-rose-500/10 flex justify-center"
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live total preview */}
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/55">Taxable Value</span>
            <span className="tabular-nums text-white/85">{formatInvoiceCurrency(totals.taxableValue)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/55">GST</span>
            <span className="tabular-nums text-white/85">{formatInvoiceCurrency(totals.gstAmount)}</span>
          </div>
          <div className="h-px bg-white/[0.06] my-2" />
          <div className="flex justify-between">
            <span className="text-sm font-medium text-white/80">Total</span>
            <span className="text-lg font-semibold tabular-nums accent-blue-text">{formatInvoiceCurrency(totals.totalAmount)}</span>
          </div>
        </div>
      </div>
    </GlassModal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PURCHASE TAB — Purchase Bill Engine
// ═══════════════════════════════════════════════════════════════════════════════

function PurchaseTab({
  bills, setBills,
}: {
  bills: PurchaseBill[]
  setBills: React.Dispatch<React.SetStateAction<PurchaseBill[]>>
}) {
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const stats = useMemo(() => getPurchaseStats(bills), [bills])
  const totalGstClaimable = useMemo(
    () => bills.reduce((s, b) => s + b.gstAmount, 0),
    [bills],
  )

  const filtered = useMemo(() => {
    let arr = [...bills].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate))
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter((b) =>
        b.invoiceNo.toLowerCase().includes(q) ||
        b.vendorName.toLowerCase().includes(q)
      )
    }
    return arr
  }, [bills, search])

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Bills" value={formatInvoiceCurrency(stats.total)} icon={FileText} tone="neutral" delta={`${bills.length} bills`} />
        <KpiCard label="Paid" value={formatInvoiceCurrency(stats.paid)} icon={CheckCircle2} tone="bull" />
        <KpiCard label="Outstanding" value={formatInvoiceCurrency(stats.outstanding)} icon={Clock} tone="accent" />
        <KpiCard label="GST Claimable" value={formatInvoiceCurrency(totalGstClaimable)} icon={Calculator} tone="bull" hint="ITC available" />
      </motion.div>

      <motion.div variants={itemReveal} className="flex flex-wrap items-center gap-2">
        <ProButton variant="primary" size="sm" onClick={() => toast.info('Record Bill — opens a form soon')}>
          <Plus className="h-3.5 w-3.5" /> Record Bill
        </ProButton>
        <ProButton variant="glass" size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="h-3.5 w-3.5" /> Upload Bill (OCR)
        </ProButton>
        <div className="ml-auto relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill / vendor"
            className="pl-8 h-9 w-56 bg-white/[0.04] border-white/[0.08] text-white text-xs placeholder:text-white/40"
          />
        </div>
      </motion.div>

      <motion.div variants={itemReveal} className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Bill No</th><th>Vendor</th><th>Date</th><th>Due</th>
                <th className="text-right">Taxable</th><th className="text-right">GST</th>
                <th className="text-right">Total</th><th>Status</th><th>GSTR-2B</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10}><EmptyState label="No purchase bills found" /></td></tr>
              ) : filtered.map((b) => (
                <tr key={b.id}>
                  <td className="font-medium text-white">{b.invoiceNo}</td>
                  <td className="text-white/85">{b.vendorName}</td>
                  <td className="text-white/60">{fmtDate(b.invoiceDate)}</td>
                  <td className="text-white/60">{fmtDate(b.dueDate)}</td>
                  <td className="text-right tabular-nums text-white/85">{formatInvoiceCurrency(b.taxableValue)}</td>
                  <td className="text-right tabular-nums text-white/60">{formatInvoiceCurrency(b.gstAmount)}</td>
                  <td className="text-right tabular-nums text-white">{formatInvoiceCurrency(b.totalAmount)}</td>
                  <td><StatusPill status={b.paymentStatus} /></td>
                  <td><StatusPill status={b.status === 'matched' ? 'matched' : 'unmatched'} /></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-white/55 hover:text-white hover:bg-white/10" title="View"><Eye className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <UploadOcrModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Bill — OCR Extraction"
        subtitle="Drop a vendor invoice image; we'll extract the fields"
        endpoint="/api/purchases/upload"
        onConfirm={async (extracted) => {
          // Create a bill from extracted data
          try {
            const res = await fetch('/api/purchases', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vendorName: extracted.vendorName ?? 'Unknown Vendor',
                invoiceNo: extracted.invoiceNo ?? `PB-${Date.now()}`,
                invoiceDate: extracted.date ?? todayIso(),
                taxableValue: extracted.taxableValue ?? 0,
                gstAmount: extracted.gstAmount ?? 0,
                totalAmount: extracted.totalAmount ?? 0,
              }),
            })
            if (res.ok) {
              const data = await res.json()
              if (data?.purchase) {
                setBills((prev) => [data.purchase, ...prev])
              }
              toast.success('Bill recorded from OCR.')
              setShowUpload(false)
            } else {
              toast.error('Failed to record bill.')
            }
          } catch {
            toast.error('Network error — bill not saved.')
          }
        }}
      />
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. EXPENSES TAB — Expense Cloud
// ═══════════════════════════════════════════════════════════════════════════════

const EXPENSE_ICON_MAP: Record<ExpenseCategory, React.ComponentType<{ className?: string }>> = {
  Office: Briefcase, Travel: Plane, Salary: Users, Marketing: Megaphone,
  Rent: Building2, Utilities: Zap, Software: Code2, Miscellaneous: Package,
}

function ExpensesTab({
  expenses, setExpenses,
}: {
  expenses: Expense[]
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const stats = useMemo(() => getExpenseStats(expenses), [expenses])
  const thisMonth = useMemo(() => {
    const now = new Date()
    const ym = now.toISOString().slice(0, 7)
    return expenses.filter((e) => e.date.startsWith(ym)).reduce((s, e) => s + e.amount, 0)
  }, [expenses])
  const avgPerDay = thisMonth > 0 ? thisMonth / Math.max(1, new Date().getDate()) : 0

  const recent = useMemo(
    () => [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    [expenses],
  )

  const maxCat = Math.max(...Object.values(stats.byCategory), 1)

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Expenses" value={formatInvoiceCurrency(stats.total)} icon={Wallet} tone="bear" />
        <KpiCard label="GST Claimable" value={formatInvoiceCurrency(stats.claimableGst)} icon={Calculator} tone="bull" hint="ITC available" />
        <KpiCard label="This Month" value={formatInvoiceCurrency(thisMonth)} icon={Calendar} tone="neutral" />
        <KpiCard label="Avg / Day" value={formatInvoiceCurrency(avgPerDay)} icon={TrendingDown} tone="bear" />
      </motion.div>

      <motion.div variants={itemReveal} className="flex items-center gap-2">
        <ProButton variant="primary" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Expense
        </ProButton>
        <ProButton variant="glass" size="sm" onClick={() => toast.info('Receipt OCR — drop a receipt image')}>
          <Upload className="h-3.5 w-3.5" /> Upload Receipt (OCR)
        </ProButton>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Category breakdown */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
          <SectionHead title="Category Breakdown" icon={Wallet} />
          <div className="space-y-3">
            {(Object.keys(stats.byCategory) as ExpenseCategory[]).map((cat) => {
              const amt = stats.byCategory[cat]
              const Icon = EXPENSE_ICON_MAP[cat]
              const pct = (amt / maxCat) * 100
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center">
                        <Icon className="h-3.5 w-3.5 text-white/70" />
                      </div>
                      <span className="text-xs text-white/75">{cat}</span>
                    </div>
                    <span className="text-xs tabular-nums text-white/85">{formatInvoiceCurrency(amt)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Recent expenses */}
        <motion.div variants={itemReveal} className="lg:col-span-2 glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-5 pb-3"><SectionHead title="Recent Expenses" icon={Clock} /></div>
          <div className="overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Date</th><th>Category</th><th>Vendor</th><th>Description</th>
                  <th className="text-right">Amount</th><th className="text-right">GST</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState label="No expenses recorded" /></td></tr>
                ) : recent.map((e) => (
                  <tr key={e.id}>
                    <td className="text-white/60">{fmtDate(e.date)}</td>
                    <td><StatusPill status={e.category.toLowerCase()} /></td>
                    <td className="text-white/85">{e.vendor ?? '—'}</td>
                    <td className="text-white/70 max-w-[200px] truncate">{e.description ?? '—'}</td>
                    <td className="text-right tabular-nums text-white">{formatInvoiceCurrency(e.amount)}</td>
                    <td className="text-right tabular-nums text-emerald-400">{e.gstClaimable ? formatInvoiceCurrency(e.gst) : '—'}</td>
                    <td><StatusPill status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <AddExpenseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={async (payload) => {
          try {
            const res = await fetch('/api/expenses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (res.ok) {
              const data = await res.json()
              if (data?.expense) setExpenses((prev) => [data.expense, ...prev])
              toast.success('Expense recorded.')
              setShowAdd(false)
            } else {
              toast.error('Failed to record expense.')
            }
          } catch {
            toast.error('Network error — expense not saved.')
          }
        }}
      />
    </motion.div>
  )
}

function AddExpenseModal({
  open, onClose, onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (payload: {
    category: string
    description: string
    vendor: string
    amount: number
    date: string
  }) => Promise<void>
}) {
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)

  const detectedCat = useMemo(
    () => autoCategorize(description, vendor),
    [description, vendor],
  )

  const handleSubmit = async () => {
    if (!description.trim() || amount <= 0) {
      toast.error('Description and amount are required.'); return
    }
    setSaving(true)
    await onCreate({ category: detectedCat, description, vendor, amount, date })
    setSaving(false)
    setDescription(''); setVendor(''); setAmount(0); setDate(todayIso())
  }

  return (
    <GlassModal
      open={open} onClose={onClose}
      title="Add Expense" subtitle="Auto-categorised via keyword detection"
      footer={
        <>
          <ProButton variant="ghost" size="sm" onClick={onClose}>Cancel</ProButton>
          <ProButton variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <ProSpinner size={14} /> : <Plus className="h-3.5 w-3.5" />}
            Save Expense
          </ProButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label className="text-xs text-white/55">Description</Label>
          <Input
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. AWS India cloud subscription"
            className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-white/55">Vendor</Label>
            <Input
              value={vendor} onChange={(e) => setVendor(e.target.value)}
              placeholder="Vendor name"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-white/55">Date</Label>
            <Input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-white/55">Amount (₹)</Label>
          <Input
            type="number" min={0} value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="0"
            className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
          />
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3 flex items-center justify-between">
          <span className="text-xs text-white/55">Auto-detected category</span>
          <StatusPill status={detectedCat.toLowerCase()} />
        </div>
      </div>
    </GlassModal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RECEIVABLES TAB — Receivables Cloud
// ═══════════════════════════════════════════════════════════════════════════════

const AGING_TONE: Array<'bull' | 'accent' | 'neutral' | 'bear'> = ['bull', 'bull', 'accent', 'bear', 'bear']
const AGING_BAR_COLOR = [
  'from-emerald-500 to-emerald-400',
  'from-emerald-500 to-emerald-400',
  'from-amber-500 to-amber-400',
  'from-orange-500 to-rose-400',
  'from-rose-500 to-rose-400',
]

function ReceivablesTab({ invoices }: { invoices: InvoiceCloudInvoice[] }) {
  const summary = useMemo(() => getReceivablesSummary(invoices), [invoices])
  const aging = useMemo(() => computeAging(invoices), [invoices])
  const reminders = useMemo(() => scheduleReminders(invoices), [invoices])
  const forecast = useMemo(() => forecastCollections(invoices, 0.78), [invoices])
  const maxBucket = Math.max(...aging.map((b) => b.amount), 1)

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Outstanding" value={formatInvoiceCurrency(summary.totalOutstanding)} icon={TrendingUp} tone="accent" />
        <KpiCard label="Overdue" value={formatInvoiceCurrency(summary.totalOverdue)} icon={AlertTriangle} tone="bear" />
        <KpiCard label="Collection Rate" value={`${summary.collectionRate.toFixed(1)}%`} icon={CheckCircle2} tone="bull" delta={`${summary.avgDaysToPay}d avg`} />
        <KpiCard label="Forecast Next Month" value={formatInvoiceCurrency(forecast.nextMonth)} icon={Brain} tone="bull" hint="78% historical rate" />
      </motion.div>

      {/* Aging buckets */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
        <SectionHead title="Aging Buckets" icon={Clock} />
        <div className="space-y-3">
          {aging.map((b, i) => (
            <div key={b.label}>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-white/75 font-medium">{b.label}</span>
                  <span className="text-white/40">{b.count} invoice{b.count === 1 ? '' : 's'}</span>
                </div>
                <span className="tabular-nums text-white/85">{formatInvoiceCurrency(b.amount)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${AGING_BAR_COLOR[i]} rounded-full`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(b.amount / maxBucket) * 100}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Scheduled reminders */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
        <SectionHead title="Scheduled Reminders" icon={Send} action={
          <ProBadge className="text-[10px]">{reminders.length} queued</ProBadge>
        } />
        {reminders.length === 0 ? (
          <EmptyState label="No overdue invoices — all caught up!" />
        ) : (
          <div className="space-y-2">
            {reminders.slice(0, 10).map((r) => {
              const tone = r.reminderType === 'gentle' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                : r.reminderType === 'firm' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/20'
              return (
                <div key={r.invoiceId} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${tone}`}>
                      {r.reminderType}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">{r.invoiceNumber}</div>
                      <div className="text-[10px] text-white/45">{r.daysOverdue} day{r.daysOverdue === 1 ? '' : 's'} overdue · scheduled {fmtDate(r.scheduledDate)}</div>
                    </div>
                  </div>
                  <ProButton variant="ghost" size="sm" onClick={() => toast.success(`Reminder queued for ${r.invoiceNumber}`)}>
                    <Send className="h-3 w-3" /> Send
                  </ProButton>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. PAYABLES TAB — Payables Cloud
// ═══════════════════════════════════════════════════════════════════════════════

function PayablesTab({ bills }: { bills: PurchaseBill[] }) {
  const summary = useMemo(() => getPayablesSummary(bills), [bills])
  const priorities = useMemo(() => prioritizePayments(bills), [bills])
  const [availableCash, setAvailableCash] = useState(500000)
  const allocation = useMemo(
    () => cashAllocationPlan(bills, availableCash),
    [bills, availableCash],
  )

  const priorityMap = useMemo(() => {
    const m = new Map<string, 'high' | 'medium' | 'low'>()
    priorities.forEach((p) => m.set(p.billId, p.priority))
    return m
  }, [priorities])

  const priorityReason = useMemo(() => {
    const m = new Map<string, string>()
    priorities.forEach((p) => m.set(p.billId, p.reason))
    return m
  }, [priorities])

  const priorityDot = (p?: 'high' | 'medium' | 'low') =>
    p === 'high' ? 'bg-rose-400' : p === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Payable" value={formatInvoiceCurrency(summary.totalPayable)} icon={TrendingDown} tone="bear" />
        <KpiCard label="Overdue" value={formatInvoiceCurrency(summary.totalOverdue)} icon={AlertTriangle} tone="bear" />
        <KpiCard label="Due This Week" value={formatInvoiceCurrency(summary.dueThisWeek)} icon={Clock} tone="accent" />
        <KpiCard label="Due Next Week" value={formatInvoiceCurrency(summary.dueNextWeek)} icon={Calendar} tone="neutral" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payment priority */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
          <SectionHead title="Payment Priority" icon={Zap} />
          {priorities.length === 0 ? (
            <EmptyState label="No unpaid bills — all clear!" />
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {priorities.slice(0, 10).map((p) => {
                const bill = bills.find((b) => b.id === p.billId)
                if (!bill) return null
                return (
                  <div key={p.billId} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot(p.priority)}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{bill.vendorName}</div>
                        <div className="text-[10px] text-white/45 truncate">{bill.invoiceNo} · {p.reason}</div>
                      </div>
                    </div>
                    <div className="text-xs tabular-nums text-white/85 shrink-0">
                      {formatInvoiceCurrency(bill.balanceAmount)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

        {/* Cash allocation plan */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
          <SectionHead title="Cash Allocation Plan" icon={Wallet} />
          <div className="mb-4">
            <Label className="text-xs text-white/55">Available Cash (₹)</Label>
            <Input
              type="number" min={0} value={availableCash}
              onChange={(e) => setAvailableCash(Math.max(0, Number(e.target.value)))}
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm tabular-nums"
            />
          </div>
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {allocation.slice(0, 10).map((a) => {
              const bill = bills.find((b) => b.id === a.billId)
              if (!bill) return null
              const statusCls = a.status === 'full'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
                : a.status === 'partial'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/20'
              return (
                <div key={a.billId} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot(priorityMap.get(a.billId))}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">{bill.vendorName}</div>
                      <div className="text-[10px] text-white/45 truncate">
                        {formatInvoiceCurrency(bill.balanceAmount)} due
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs tabular-nums text-white/85">{formatInvoiceCurrency(a.allocated)}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] uppercase border ${statusCls}`}>{a.status}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PAYMENTS TAB — Payment Execution Engine
// ═══════════════════════════════════════════════════════════════════════════════

function PaymentsTab({
  payments, setPayments, invoices, bills,
}: {
  payments: Payment[]
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>
  invoices: InvoiceCloudInvoice[]
  bills: PurchaseBill[]
}) {
  const [showNew, setShowNew] = useState(false)
  const stats = useMemo(() => getPaymentStats(payments), [payments])
  const reconciledPct = payments.length > 0
    ? (payments.filter((p) => p.reconciled).length / payments.length) * 100
    : 0

  const inflows = useMemo(
    () => payments.filter((p) => p.partyType === 'customer').sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)),
    [payments],
  )
  const outflows = useMemo(
    () => payments.filter((p) => p.partyType === 'vendor').sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)),
    [payments],
  )

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Inflow" value={formatInvoiceCurrency(stats.totalInflow)} icon={ArrowDownRight} tone="bull" />
        <KpiCard label="Total Outflow" value={formatInvoiceCurrency(stats.totalOutflow)} icon={ArrowUpRight} tone="bear" />
        <KpiCard
          label="Net Flow"
          value={formatInvoiceCurrency(stats.netFlow)}
          icon={IndianRupee}
          tone={stats.netFlow >= 0 ? 'bull' : 'bear'}
        />
        <KpiCard label="Reconciled" value={`${reconciledPct.toFixed(0)}%`} icon={CheckCircle2} tone={reconciledPct >= 80 ? 'bull' : 'accent'} />
      </motion.div>

      <motion.div variants={itemReveal}>
        <ProButton variant="primary" size="sm" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> Record Payment
        </ProButton>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Customer payments */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-5 pb-3">
            <SectionHead title="Customer Payments" icon={ArrowDownRight} action={<ProBadge className="text-[10px] text-emerald-300 border-emerald-500/20">Inflow</ProBadge>} />
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="table-premium">
              <thead>
                <tr><th>Date</th><th>Party</th><th>Mode</th><th className="text-right">Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {inflows.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState label="No customer payments" /></td></tr>
                ) : inflows.slice(0, 20).map((p) => (
                  <tr key={p.id}>
                    <td className="text-white/60">{fmtDate(p.paymentDate)}</td>
                    <td className="text-white/85">{p.partyName}</td>
                    <td className="text-white/60 capitalize">{p.paymentMode}</td>
                    <td className="text-right tabular-nums text-emerald-400">+{formatInvoiceCurrency(p.amount)}</td>
                    <td><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Vendor payments */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-5 pb-3">
            <SectionHead title="Vendor Payments" icon={ArrowUpRight} action={<ProBadge className="text-[10px] text-rose-300 border-rose-500/20">Outflow</ProBadge>} />
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="table-premium">
              <thead>
                <tr><th>Date</th><th>Party</th><th>Mode</th><th className="text-right">Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {outflows.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState label="No vendor payments" /></td></tr>
                ) : outflows.slice(0, 20).map((p) => (
                  <tr key={p.id}>
                    <td className="text-white/60">{fmtDate(p.paymentDate)}</td>
                    <td className="text-white/85">{p.partyName}</td>
                    <td className="text-white/60 capitalize">{p.paymentMode}</td>
                    <td className="text-right tabular-nums text-rose-400">-{formatInvoiceCurrency(p.amount)}</td>
                    <td><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <RecordPaymentModal
        open={showNew}
        onClose={() => setShowNew(false)}
        invoices={invoices}
        bills={bills}
        onCreate={async (payload) => {
          try {
            const res = await fetch('/api/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (res.ok) {
              const data = await res.json()
              if (data?.payment) setPayments((prev) => [data.payment, ...prev])
              toast.success(`Payment of ${formatInvoiceCurrency(payload.amount)} recorded.`)
              window.dispatchEvent(new CustomEvent('oracle-ask', {
                detail: { prompt: `I've recorded a ${payload.paymentMode} payment of ${formatInvoiceCurrency(payload.amount)} from ${payload.partyName}. Reconciling against open ${payload.partyType === 'customer' ? 'invoices' : 'bills'}.` },
              }))
              setShowNew(false)
            } else {
              toast.error('Failed to record payment.')
            }
          } catch {
            toast.error('Network error — payment not saved.')
          }
        }}
      />
    </motion.div>
  )
}

function RecordPaymentModal({
  open, onClose, invoices, bills, onCreate,
}: {
  open: boolean
  onClose: () => void
  invoices: InvoiceCloudInvoice[]
  bills: PurchaseBill[]
  onCreate: (payload: {
    partyName: string
    partyType: 'customer' | 'vendor'
    amount: number
    paymentMode: string
    referenceNo?: string
    invoiceId?: string
    purchaseBillId?: string
  }) => Promise<void>
}) {
  const [partyName, setPartyName] = useState('')
  const [partyType, setPartyType] = useState<'customer' | 'vendor'>('customer')
  const [amount, setAmount] = useState(0)
  const [mode, setMode] = useState('bank')
  const [referenceNo, setReferenceNo] = useState('')
  const [linkId, setLinkId] = useState('')
  const [saving, setSaving] = useState(false)

  const linkOptions = partyType === 'customer' ? invoices : bills

  const handleSubmit = async () => {
    if (!partyName.trim() || amount <= 0) {
      toast.error('Party name and amount are required.'); return
    }
    setSaving(true)
    await onCreate({
      partyName, partyType, amount, paymentMode: mode,
      referenceNo: referenceNo || undefined,
      invoiceId: partyType === 'customer' && linkId ? linkId : undefined,
      purchaseBillId: partyType === 'vendor' && linkId ? linkId : undefined,
    })
    setSaving(false)
    setPartyName(''); setAmount(0); setMode('bank'); setReferenceNo(''); setLinkId('')
  }

  return (
    <GlassModal
      open={open} onClose={onClose}
      title="Record Payment" subtitle="Customer inflow or vendor outflow"
      maxWidth="max-w-xl"
      footer={
        <>
          <ProButton variant="ghost" size="sm" onClick={onClose}>Cancel</ProButton>
          <ProButton variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <ProSpinner size={14} /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Save Payment
          </ProButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-white/55">Party Type</Label>
            <Select value={partyType} onValueChange={(v) => { setPartyType(v as 'customer' | 'vendor'); setLinkId('') }}>
              <SelectTrigger className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/[0.08]">
                <SelectItem value="customer" className="text-xs text-white/80 focus:bg-white/10">Customer (Inflow)</SelectItem>
                <SelectItem value="vendor" className="text-xs text-white/80 focus:bg-white/10">Vendor (Outflow)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-white/55">Payment Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/90 border-white/[0.08]">
                {['upi', 'bank', 'card', 'cheque', 'cash'].map((m) => (
                  <SelectItem key={m} value={m} className="text-xs capitalize text-white/80 focus:bg-white/10">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs text-white/55">Party Name</Label>
          <Input
            value={partyName} onChange={(e) => setPartyName(e.target.value)}
            placeholder={partyType === 'customer' ? 'Customer name' : 'Vendor name'}
            className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-white/55">Amount (₹)</Label>
            <Input
              type="number" min={0} value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm tabular-nums"
            />
          </div>
          <div>
            <Label className="text-xs text-white/55">Reference No</Label>
            <Input
              value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="UTR / cheque no"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-white/55">Link to {partyType === 'customer' ? 'Invoice' : 'Bill'} (optional)</Label>
          <Select value={linkId} onValueChange={setLinkId}>
            <SelectTrigger className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm">
              <SelectValue placeholder="Select to auto-reconcile" />
            </SelectTrigger>
            <SelectContent className="bg-black/90 border-white/[0.08] max-h-60">
              {linkOptions.slice(0, 30).map((o) => {
                const num = partyType === 'customer'
                  ? (o as InvoiceCloudInvoice).invoiceNumber
                  : (o as PurchaseBill).invoiceNo
                const bal = partyType === 'customer'
                  ? (o as InvoiceCloudInvoice).balanceAmount
                  : (o as PurchaseBill).balanceAmount
                return (
                  <SelectItem key={o.id} value={o.id} className="text-xs text-white/80 focus:bg-white/10">
                    {num} · {formatInvoiceCurrency(bal)}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    </GlassModal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. TDS TAB — TDS Cloud
// ═══════════════════════════════════════════════════════════════════════════════

function TDSTab({
  records, setRecords,
}: {
  records: TDSRecord[]
  setRecords: React.Dispatch<React.SetStateAction<TDSRecord[]>>
}) {
  const [showCalc, setShowCalc] = useState(false)
  const stats = useMemo(() => getTDSStats(records), [records])
  const thisQuarter = useMemo(() => {
    const q = quarterForDate(todayIso())
    return records.filter((r) => r.quarter === q).reduce((s, r) => s + r.tdsAmount, 0)
  }, [records])

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Liability" value={formatInvoiceCurrency(stats.totalLiability)} icon={Calculator} tone="bear" />
        <KpiCard label="Total Paid" value={formatInvoiceCurrency(stats.totalPaid)} icon={CheckCircle2} tone="bull" />
        <KpiCard label="Total Pending" value={formatInvoiceCurrency(stats.totalPending)} icon={Clock} tone="accent" />
        <KpiCard label="This Quarter" value={formatInvoiceCurrency(thisQuarter)} icon={Calendar} tone="neutral" delta={quarterForDate(todayIso())} />
      </motion.div>

      {/* TDS by section */}
      <motion.div variants={itemReveal} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Object.entries(TDS_SECTIONS).map(([code, meta]) => (
          <div key={code} className="glass-surface rounded-2xl p-4 border border-white/[0.06]">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-white">{code}</span>
              <span className="text-[10px] text-[#60A5FA]">{meta.rate}%</span>
            </div>
            <div className="text-[10px] text-white/55 mt-0.5">{meta.description}</div>
            <div className="h-px bg-white/[0.06] my-2" />
            <div className="text-xs text-white/45">Deducted</div>
            <div className="text-base font-semibold tabular-nums text-white">
              {formatInvoiceCurrency(stats.bySection[code] ?? 0)}
            </div>
          </div>
        ))}
      </motion.div>

      <motion.div variants={itemReveal}>
        <ProButton variant="primary" size="sm" onClick={() => setShowCalc(true)}>
          <Calculator className="h-3.5 w-3.5" /> Calculate TDS
        </ProButton>
      </motion.div>

      {/* Records table */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Date</th><th>Section</th><th>Deductee</th><th>PAN</th>
                <th className="text-right">Payment</th><th className="text-right">TDS</th>
                <th>Quarter</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr><td colSpan={8}><EmptyState label="No TDS records" /></td></tr>
              ) : [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((r) => (
                <tr key={r.id}>
                  <td className="text-white/60">{fmtDate(r.date)}</td>
                  <td className="font-medium text-[#60A5FA]">{r.section}</td>
                  <td className="text-white/85">{r.deducteeName}</td>
                  <td className="text-white/60">{r.deducteePan ?? '—'}</td>
                  <td className="text-right tabular-nums text-white/85">{formatInvoiceCurrency(r.paymentAmount)}</td>
                  <td className="text-right tabular-nums text-rose-300">{formatInvoiceCurrency(r.tdsAmount)}</td>
                  <td className="text-white/55">{r.quarter ?? '—'}</td>
                  <td><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <CalculateTdsModal
        open={showCalc}
        onClose={() => setShowCalc(false)}
        onSave={async (payload) => {
          try {
            const res = await fetch('/api/tds', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (res.ok) {
              const data = await res.json()
              if (data?.record) setRecords((prev) => [data.record, ...prev])
              toast.success(`TDS ${formatInvoiceCurrency(payload.tdsAmount)} under ${payload.section} recorded.`)
              setShowCalc(false)
            } else {
              toast.error('Failed to record TDS.')
            }
          } catch {
            toast.error('Network error — TDS not saved.')
          }
        }}
      />
    </motion.div>
  )
}

function CalculateTdsModal({
  open, onClose, onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (payload: {
    section: string
    deducteeName: string
    paymentAmount: number
    tdsRate: number
    tdsAmount: number
    date: string
  }) => Promise<void>
}) {
  const [paymentNature, setPaymentNature] = useState('')
  const [amount, setAmount] = useState(0)
  const [deducteeName, setDeducteeName] = useState('')
  const [date, setDate] = useState(todayIso())
  const [saving, setSaving] = useState(false)

  const detectedSection = useMemo(() => detectSection(paymentNature), [paymentNature])
  const calc = useMemo(() => calculateTDS(amount, detectedSection), [amount, detectedSection])

  const handleSubmit = async () => {
    if (!deducteeName.trim() || amount <= 0) {
      toast.error('Deductee name and amount are required.'); return
    }
    setSaving(true)
    await onSave({
      section: detectedSection,
      deducteeName,
      paymentAmount: amount,
      tdsRate: calc.rate,
      tdsAmount: calc.tdsAmount,
      date,
    })
    setSaving(false)
    setPaymentNature(''); setAmount(0); setDeducteeName(''); setDate(todayIso())
  }

  return (
    <GlassModal
      open={open} onClose={onClose}
      title="Calculate TDS" subtitle="Auto-detects section from payment nature"
      maxWidth="max-w-xl"
      footer={
        <>
          <ProButton variant="ghost" size="sm" onClick={onClose}>Cancel</ProButton>
          <ProButton variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <ProSpinner size={14} /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Record TDS
          </ProButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label className="text-xs text-white/55">Deductee Name</Label>
          <Input
            value={deducteeName} onChange={(e) => setDeducteeName(e.target.value)}
            placeholder="e.g. Sundaram Legal Associates"
            className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-white/55">Payment Nature</Label>
          <Input
            value={paymentNature} onChange={(e) => setPaymentNature(e.target.value)}
            placeholder="e.g. professional fees, rent, contractor"
            className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-white/55">Payment Amount (₹)</Label>
            <Input
              type="number" min={0} value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="0"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm tabular-nums"
            />
          </div>
          <div>
            <Label className="text-xs text-white/55">Date</Label>
            <Input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/55">Detected section</span>
            <span className="font-medium text-[#60A5FA]">{detectedSection} · {TDS_SECTIONS[detectedSection]?.description}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/55">Rate</span>
            <span className="text-white/85">{calc.rate}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/55">Threshold applicable</span>
            <span className={calc.thresholdApplicable ? 'text-emerald-400' : 'text-amber-400'}>
              {calc.thresholdApplicable ? 'Yes' : 'No (below threshold)'}
            </span>
          </div>
          <div className="h-px bg-white/[0.06] my-1" />
          <div className="flex justify-between">
            <span className="text-sm font-medium text-white/80">TDS Amount</span>
            <span className="text-lg font-semibold tabular-nums text-rose-300">{formatInvoiceCurrency(calc.tdsAmount)}</span>
          </div>
        </div>
      </div>
    </GlassModal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 9. PAYROLL TAB — Payroll Cloud
// ═══════════════════════════════════════════════════════════════════════════════

function PayrollTab({
  employees, setEmployees, payrolls, setPayrolls,
}: {
  employees: Employee[]
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>
  payrolls: Payroll[]
  setPayrolls: React.Dispatch<React.SetStateAction<Payroll[]>>
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [generating, setGenerating] = useState(false)
  const stats = useMemo(() => getPayrollStats(employees, payrolls), [employees, payrolls])
  const totalStatutory = stats.totalPF + stats.totalESI + stats.totalTDS + stats.totalPT

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: '2026-01' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.payrolls) setPayrolls((prev) => [...data.payrolls, ...prev])
        toast.success(`Generated ${data?.generated ?? 0} payslips for 2026-01.`)
        window.dispatchEvent(new CustomEvent('oracle-ask', {
          detail: { prompt: `I've generated payroll for 2026-01 — ${data?.generated ?? 0} payslips totalling ${formatInvoiceCurrency((data?.payrolls ?? []).reduce((s: number, p: Payroll) => s + p.netSalary, 0))} in net disbursements. Statutory deductions booked.` },
        }))
      } else {
        toast.error('Failed to generate payroll.')
      }
    } catch {
      toast.error('Network error — payroll not generated.')
    }
    setGenerating(false)
  }

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Employees" value={String(stats.totalEmployees)} icon={Users} tone="neutral" />
        <KpiCard label="Total Gross" value={formatInvoiceCurrency(stats.totalGross)} icon={IndianRupee} tone="accent" />
        <KpiCard label="Total Net" value={formatInvoiceCurrency(stats.totalNet)} icon={Wallet} tone="bull" />
        <KpiCard label="Statutory Deductions" value={formatInvoiceCurrency(totalStatutory)} icon={Calculator} tone="bear" hint="PF + ESI + TDS + PT" />
      </motion.div>

      <motion.div variants={itemReveal} className="flex flex-wrap items-center gap-2">
        <ProButton variant="primary" size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? <ProSpinner size={14} /> : <Sparkles className="h-3.5 w-3.5" />}
          Generate Payslips
        </ProButton>
        <ProButton variant="glass" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Employee
        </ProButton>
      </motion.div>

      {/* Employee roster */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Name</th><th>Designation</th><th>Department</th>
                <th className="text-right">Gross</th><th className="text-right">PF</th>
                <th className="text-right">ESI</th><th className="text-right">TDS</th>
                <th className="text-right">PT</th><th className="text-right">Net</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr><td colSpan={11}><EmptyState label="No employees on roster" /></td></tr>
              ) : employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium text-white">{e.name}</td>
                  <td className="text-white/85">{e.designation ?? '—'}</td>
                  <td className="text-white/60">{e.department ?? '—'}</td>
                  <td className="text-right tabular-nums text-white/85">{formatInvoiceCurrency(e.salary)}</td>
                  <td className="text-right tabular-nums text-white/60">{formatInvoiceCurrency(e.pf)}</td>
                  <td className="text-right tabular-nums text-white/60">{formatInvoiceCurrency(e.esi)}</td>
                  <td className="text-right tabular-nums text-white/60">{formatInvoiceCurrency(e.tds)}</td>
                  <td className="text-right tabular-nums text-white/60">{formatInvoiceCurrency(e.professionalTax)}</td>
                  <td className="text-right tabular-nums text-emerald-400">{formatInvoiceCurrency(e.netSalary)}</td>
                  <td><StatusPill status={e.status} /></td>
                  <td>
                    <Button variant="ghost" size="icon" className="size-7 text-white/55 hover:text-white hover:bg-white/10" title="View"><Eye className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AddEmployeeModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={async (payload) => {
          try {
            const res = await fetch('/api/payroll', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (res.ok) {
              const data = await res.json()
              if (data?.employees?.[0]) setEmployees((prev) => [data.employees[0], ...prev])
              toast.success(`Employee ${payload.name} added.`)
              setShowAdd(false)
            } else {
              toast.error('Failed to add employee.')
            }
          } catch {
            toast.error('Network error — employee not saved.')
          }
        }}
      />
    </motion.div>
  )
}

function AddEmployeeModal({
  open, onClose, onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (payload: { name: string; designation: string; salary: number; department?: string }) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [designation, setDesignation] = useState('')
  const [department, setDepartment] = useState('')
  const [salary, setSalary] = useState(0)
  const [saving, setSaving] = useState(false)

  const breakdown = useMemo(() => calculateSalaryBreakdown(salary || 0), [salary])

  const handleSubmit = async () => {
    if (!name.trim() || !designation.trim() || salary <= 0) {
      toast.error('Name, designation and salary are required.'); return
    }
    setSaving(true)
    await onCreate({ name, designation, salary, department: department || undefined })
    setSaving(false)
    setName(''); setDesignation(''); setDepartment(''); setSalary(0)
  }

  return (
    <GlassModal
      open={open} onClose={onClose}
      title="Add Employee" subtitle="Auto-computes salary breakdown (PF, ESI, TDS, PT)"
      maxWidth="max-w-xl"
      footer={
        <>
          <ProButton variant="ghost" size="sm" onClick={onClose}>Cancel</ProButton>
          <ProButton variant="primary" size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <ProSpinner size={14} /> : <Plus className="h-3.5 w-3.5" />}
            Add Employee
          </ProButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-white/55">Name</Label>
            <Input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-white/55">Designation</Label>
            <Input
              value={designation} onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Accountant"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-white/55">Department</Label>
            <Input
              value={department} onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Finance"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-white/55">Gross Salary (₹/mo)</Label>
            <Input
              type="number" min={0} value={salary}
              onChange={(e) => setSalary(Number(e.target.value))}
              placeholder="0"
              className="mt-1 h-9 bg-white/[0.04] border-white/[0.08] text-white text-sm tabular-nums"
            />
          </div>
        </div>
        {salary > 0 && (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-1.5">
            <div className="flex justify-between text-xs"><span className="text-white/55">Basic (50%)</span><span className="tabular-nums text-white/85">{formatInvoiceCurrency(breakdown.basic)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/55">HRA (40% of basic)</span><span className="tabular-nums text-white/85">{formatInvoiceCurrency(breakdown.hra)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/55">PF (12% of basic)</span><span className="tabular-nums text-white/85">{formatInvoiceCurrency(breakdown.pf)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/55">ESI (0.75%)</span><span className="tabular-nums text-white/85">{formatInvoiceCurrency(breakdown.esi)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/55">TDS (monthly)</span><span className="tabular-nums text-white/85">{formatInvoiceCurrency(breakdown.tds)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/55">Professional Tax</span><span className="tabular-nums text-white/85">{formatInvoiceCurrency(breakdown.professionalTax)}</span></div>
            <div className="h-px bg-white/[0.06] my-1" />
            <div className="flex justify-between">
              <span className="text-sm font-medium text-white/80">Net Salary</span>
              <span className="text-lg font-semibold tabular-nums text-emerald-400">{formatInvoiceCurrency(breakdown.netSalary)}</span>
            </div>
          </div>
        )}
      </div>
    </GlassModal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 10. FORECAST TAB — AI Cash Conversion Engine
// ═══════════════════════════════════════════════════════════════════════════════

function ForecastTab({
  invoices, bills, expenses, payrolls,
}: {
  invoices: InvoiceCloudInvoice[]
  bills: PurchaseBill[]
  expenses: Expense[]
  payrolls: Payroll[]
}) {
  const currentPeriod = new Date().toISOString().split('T')[0].slice(0, 7)
  const forecast = useMemo(() => generateCashFlowForecast({
    invoices, bills, expenses, payrolls,
    historicalCollectionRate: 0.78, period: currentPeriod,
  }), [invoices, bills, expenses, payrolls, currentPeriod])

  const prediction = useMemo(() => predictSurplusOrDeficit(forecast), [forecast])
  const delayed = useMemo(() => identifyDelayedCollections(invoices), [invoices])

  // 6-month projection
  const monthly = useMemo(() => {
    const arr: Array<{ month: string; inflow: number; outflow: number; net: number }> = []
    for (let i = 0; i < 6; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      const period = d.toISOString().split('T')[0].slice(0, 7)
      const fc = generateCashFlowForecast({
        invoices, bills, expenses, payrolls,
        historicalCollectionRate: 0.78, period,
      })
      arr.push({
        month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
        inflow: fc.projectedInflow,
        outflow: fc.projectedOutflow,
        net: fc.projectedNet,
      })
    }
    return arr
  }, [invoices, bills, expenses, payrolls])

  const tone = prediction.type === 'surplus' ? 'bull' : prediction.type === 'deficit' ? 'bear' : 'neutral'
  const heroToneCls =
    tone === 'bull' ? 'text-emerald-400'
      : tone === 'bear' ? 'text-rose-400'
        : 'text-white'

  return (
    <motion.div
      variants={containerStagger}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* Hero */}
      <motion.div variants={itemReveal} className="glass-surface-strong rounded-2xl p-6 border border-white/[0.08] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-[#3B82F6]/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-[#60A5FA]" />
            <span className="text-xs uppercase tracking-wider text-white/55">AI Cash Conversion Engine</span>
            <ProBadge className="ml-auto">
              <ProStatusDot status="live" /> {Math.round(forecast.confidence * 100)}% confidence
            </ProBadge>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] text-white/55">Projected Net Cash Flow · {currentPeriod}</span>
          </div>
          <div className={`text-4xl sm:text-5xl font-semibold tabular-nums mt-1 ${heroToneCls}`}>
            {prediction.type === 'deficit' ? '-' : ''}{formatInvoiceCurrency(Math.abs(forecast.projectedNet))}
          </div>
          <p className="text-sm text-white/70 mt-3 max-w-2xl leading-relaxed">{forecast.aiSummary}</p>
          <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[#60A5FA] mt-0.5 shrink-0" />
              <p className="text-xs text-white/70 leading-relaxed">{prediction.recommendation}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 6-month projection bar chart */}
      <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
        <SectionHead title="6-Month Projection" icon={TrendingUp} action={
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-white/55"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Inflow</span>
            <span className="flex items-center gap-1.5 text-white/55"><span className="h-2 w-2 rounded-full bg-rose-400" /> Outflow</span>
          </div>
        } />
        <ForecastBarChart data={monthly} />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {monthly.map((m) => (
            <div key={m.month} className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2.5">
              <div className="text-[10px] text-white/55">{m.month}</div>
              <div className={`text-xs font-semibold tabular-nums ${m.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {m.net < 0 ? '-' : ''}{formatInvoiceCurrency(Math.abs(m.net))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Delayed collections */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
          <SectionHead title="Delayed Collections" icon={AlertTriangle} action={
            <ProBadge className="text-[10px] text-rose-300 border-rose-500/20">{delayed.length} overdue</ProBadge>
          } />
          {delayed.length === 0 ? (
            <EmptyState label="No delayed collections — excellent!" />
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {delayed.slice(0, 10).map((d) => (
                <div key={d.invoiceId} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div>
                    <div className="text-xs font-medium text-white">{d.invoiceNumber}</div>
                    <div className="text-[10px] text-white/45">{d.daysLate} day{d.daysLate === 1 ? '' : 's'} late</div>
                  </div>
                  <div className="text-xs tabular-nums text-rose-300">{formatInvoiceCurrency(d.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Cash flow drivers */}
        <motion.div variants={itemReveal} className="glass-surface rounded-2xl p-6 border border-white/[0.06]">
          <SectionHead title="Cash Flow Drivers" icon={Zap} />
          <div className="space-y-2">
            {forecast.factors.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="h-6 w-6 rounded-lg bg-[#3B82F6]/15 text-[#60A5FA] flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold">{i + 1}</span>
                </div>
                <p className="text-xs text-white/75 leading-relaxed pt-1">{f}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: OCR Upload Modal (used by Purchase + Expense tabs)
// ═══════════════════════════════════════════════════════════════════════════════

function UploadOcrModal({
  open, onClose, title, subtitle, endpoint, onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle: string
  endpoint: string
  onConfirm: (extracted: {
    vendorName?: string; invoiceNo?: string; date?: string;
    taxableValue?: number; gstAmount?: number; totalAmount?: number;
    amount?: number; gst?: number; category?: string;
  }) => Promise<void>
}) {
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null)

  const handleExtract = async () => {
    setExtracting(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'sample.png' }),
      })
      if (res.ok) {
        const data = await res.json()
        setExtracted(data?.extracted ?? data)
        toast.success('OCR extraction complete.')
      } else {
        toast.error('OCR extraction failed.')
      }
    } catch {
      toast.error('Network error during OCR.')
    }
    setExtracting(false)
  }

  const handleConfirm = async () => {
    if (!extracted) return
    await onConfirm(extracted as Parameters<typeof onConfirm>[0])
    setExtracted(null)
    onClose()
  }

  return (
    <GlassModal
      open={open}
      onClose={() => { onClose(); setExtracted(null) }}
      title={title}
      subtitle={subtitle}
      maxWidth="max-w-xl"
      footer={
        <>
          <ProButton variant="ghost" size="sm" onClick={() => { onClose(); setExtracted(null) }}>Cancel</ProButton>
          {!extracted ? (
            <ProButton variant="primary" size="sm" onClick={handleExtract} disabled={extracting}>
              {extracting ? <ProSpinner size={14} /> : <Sparkles className="h-3.5 w-3.5" />}
              Extract
            </ProButton>
          ) : (
            <ProButton variant="primary" size="sm" onClick={handleConfirm}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Confirm & Save
            </ProButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!extracted ? (
          <div className="border-2 border-dashed border-white/[0.1] rounded-2xl p-10 text-center">
            <Upload className="h-8 w-8 text-white/40 mx-auto mb-2" />
            <p className="text-sm text-white/70">Drop your bill image here</p>
            <p className="text-xs text-white/45 mt-1">PNG, JPG, or PDF · up to 10MB</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4 space-y-2">
            <div className="text-xs text-white/55 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Extracted fields (review before saving):
            </div>
            {Object.entries(extracted).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-white/55 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-white/85 tabular-nums">{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassModal>
  )
}
