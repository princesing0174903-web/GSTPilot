// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Oracle™ — Intelligence Layer
//
// Three roles: CFO · Chartered Accountant (CA) · Operations Manager
// Six functions:
//   1. answer            — general GST / finance / compliance Q&A
//   2. analyze_invoices  — pull real invoices, compute totals, tax, risk
//   3. detect_overdue    — pull invoices + payments, flag overdue
//   4. report            — comprehensive business report across all data
//   5. cashflow          — 30/60/90-day cash flow forecast
//   6. actions           — concrete prioritized action list
//
// Every response is structured as exactly four sections:
//   ## Summary
//   ## Analysis
//   ## Recommendations
//   ## Actions
//
// Hard rules:
//   • NO placeholder text ("I don't have enough data", "connect your data", etc.)
//   • Real DB numbers via Prisma — never invent statistics
//   • Empty DB → honest empty-state answer explaining what the data is + how to start
//   • Currency ₹ with Indian comma grouping (₹1,23,456)
//   • Dates DD/MM/YYYY
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OracleRole = 'cfo' | 'ca' | 'ops'

export type OracleFunction =
  | 'answer'
  | 'analyze_invoices'
  | 'detect_overdue'
  | 'report'
  | 'cashflow'
  | 'actions'

export interface OracleContext {
  role: OracleRole
  fn: OracleFunction
  /** Human-readable label for the detected function */
  fnLabel: string
  /** Live DB snapshot relevant to the function */
  data: OracleDataSnapshot
  /** Whether any real business data exists */
  hasData: boolean
  /** Business Memory™ context block (what Oracle remembers about this user). Empty string for new users. */
  memoryContext?: string
  /** Data sources Oracle read to answer this question (for the Sources Panel™). */
  sources: OracleSource[]
}

/**
 * A data source that Oracle read to answer a question. Shown in the Sources
 * Panel™ under each Oracle answer (Perplexity-style).
 */
export interface OracleSource {
  /** Source key: 'gstn' | 'bank' | 'invoices' | 'gmail' | 'drive' | 'whatsapp' | 'razorpay' | 'accounting' | 'clients' */
  key: string
  /** Display label: 'GSTN' | 'Bank' | 'Invoices' | 'Gmail' | ... */
  label: string
  /** How many records Oracle read from this source (0 if connected but empty). */
  recordCount: number
  /** Is this source connected? (a connector exists for it) */
  connected: boolean
}

export interface OracleDataSnapshot {
  clients: Array<{
    id: string
    gstin: string
    tradeName: string
    status: string
    entityType: string
    returnPeriod: string | null
    healthScore: number
  }>
  invoices: Array<{
    id: string
    invoiceNumber: string
    invoiceDate: string
    sellerGstin: string
    buyerName: string | null
    invoiceType: string
    taxableValue: number
    cgst: number
    sgst: number
    igst: number
    cess: number
    totalAmount: number
    status: string
    matchStatus: string
    riskLevel: string
    hsnCode: string | null
    source: string
    client: { tradeName: string; gstin: string } | null
  }>
  payments: Array<{
    id: string
    direction: 'in' | 'out'
    amount: number
    method: string | null
    status: string
    source: string
    referenceNo: string | null
    description: string | null
    paidAt: string | null
    postedAt: string
    reconciliationStatus: string
    client: { tradeName: string; gstin: string } | null
  }>
  returns: Array<{
    id: string
    returnType: string
    period: string
    financialYear: string | null
    status: string
    filedDate: string | null
    acknowledgmentNumber: string | null
    totalInvoices: number
    totalTaxableValue: number
    totalTax: number
    source: string
    client: { tradeName: string; gstin: string } | null
  }>
  notices: Array<{
    id: string
    noticeType: string
    noticeNumber: string | null
    noticeDate: string | null
    subject: string
    status: string
    priority: string
    dueDate: string | null
    source: string
    client: { tradeName: string; gstin: string } | null
  }>
  reconciliations: Array<{
    id: string
    period: string
    sources: string
    totalRecords: number
    matched: number
    unmatched: number
    partialMatches: number
    highRisk: number
    gstDifference: number
    status: string
    source: string
    client: { tradeName: string; gstin: string } | null
  }>
  // ─── Real Data Connectors™ — additional data sources ───
  bankTransactions: Array<{
    id: string
    date: string
    description: string | null
    amount: number
    direction: string
    balanceAfter: number | null
    counterparty: string | null
    referenceNo: string | null
  }>
  gmailMessages: Array<{
    id: string
    fromAddress: string | null
    subject: string | null
    snippet: string | null
    receivedAt: string | null
    hasAttachment: boolean
  }>
  driveFiles: Array<{
    id: string
    name: string
    mimeType: string | null
    size: number
    webViewLink: string | null
  }>
  whatsappMessages: Array<{
    id: string
    direction: string
    body: string
    status: string | null
    sentAt: string | null
    receivedAt: string | null
  }>
}

// ─── Role & function detection ────────────────────────────────────────────────

const CFO_KEYWORDS = [
  'cash flow', 'cashflow', 'cash-flow', 'p&l', 'profit', 'loss', 'revenue',
  'expense', 'burn rate', 'runway', 'ebitda', 'margin', 'forecast', 'budget',
  'working capital', 'ratio', 'liquidity', 'solvent', 'insolvent', 'cfo',
  'financial', 'finance', 'unit economics', 'breakeven', 'break-even',
  'return on', 'roi', 'irr', 'npv', 'capex', 'opex',
]

const CA_KEYWORDS = [
  'gst', 'gstr', 'gstr-1', 'gstr-3b', 'gstr-2b', 'gstr-9', 'itc', 'input tax',
  'tax credit', 'tds', 'tds return', '26q', '24q', '27q', 'roc', 'mgt-7', 'aoc-4',
  'income tax', 'itr', '44ab', 'tax audit', 'e-invoicing', 'e-way bill', 'irn',
  'qrmp', 'reverse charge', 'place of supply', 'late fee', 'interest on gst',
  'notice', 'scn', 'show cause', 'assessment', 'audit', 'ca', 'chartered accountant',
  'compliance', 'filing', 'return', 'differential', 'cess', 'hsn', 'sac',
  'gstin', 'registration', 'deregistration', 'lut', 'refund', 'export',
]

const OPS_KEYWORDS = [
  'operations', 'workflow', 'process', 'team', 'staff', 'assign', 'follow up',
  'followup', 'follow-up', 'deadline', 'overdue', 'pending', 'status', 'track',
  'client status', 'task', 'tasks', 'todo', 'to-do', 'action item', 'priority',
  'pipeline', 'queue', 'backlog', 'operations manager', 'ops', 'who is',
  'who should', 'when is', 'when should', 'next step', 'next steps',
]

const FN_KEYWORDS: Record<Exclude<OracleFunction, 'answer'>, string[]> = {
  analyze_invoices: [
    'analyze invoice', 'analyse invoice', 'invoice analysis', 'analyze bills',
    'invoice summary', 'invoice breakdown', 'tax breakdown', 'gst breakdown',
    'invoice report', 'show invoices', 'list invoices', 'my invoices',
    'invoice status', 'invoice risk',
  ],
  detect_overdue: [
    'overdue', 'late payment', 'unpaid', 'not paid', 'pending payment',
    'outstanding', 'receivable', 'payable', 'due date', 'past due',
    'collection', 'follow up on payment', 'payment follow', 'aged',
    'ar aging', 'ap aging', 'debtors', 'creditors',
  ],
  report: [
    'report', 'summary report', 'monthly report', 'weekly report',
    'business report', 'compliance report', 'gst report', 'finance report',
    'executive summary', 'board report', 'md report', 'overview',
    'state of', 'health of', 'comprehensive',
  ],
  cashflow: [
    'cash flow', 'cashflow', 'cash-flow', 'forecast', 'project cash',
    'liquidity', 'runway', 'burn rate', 'working capital forecast',
    'next 30 days', 'next 60 days', 'next 90 days', 'projected',
    'inflow', 'outflow', 'net cash',
  ],
  actions: [
    'what should i do', 'what to do', 'next step', 'next steps', 'action',
    'actions', 'action item', 'action items', 'recommend', 'recommendation',
    'recommendations', 'suggest', 'suggestion', 'priorities', 'prioritize',
    'to do', 'todo', 'task list', 'this week', 'this month',
  ],
}

/**
 * Detect the most appropriate role for the message.
 * Falls back to 'ca' (most GSTPilot questions are GST/compliance) when no signal.
 */
export function detectRole(message: string): OracleRole {
  const lower = message.toLowerCase()
  const score = (keywords: string[]): number =>
    keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0)

  const cfo = score(CFO_KEYWORDS)
  const ca = score(CA_KEYWORDS)
  const ops = score(OPS_KEYWORDS)

  if (cfo >= ca && cfo >= ops && cfo > 0) return 'cfo'
  if (ops >= ca && ops > 0) return 'ops'
  if (ca > 0) return 'ca'
  // Default — GSTPilot's primary domain is GST/CA work
  return 'ca'
}

/**
 * Detect the user's intent (which of the 6 functions).
 * Falls back to 'answer' (general Q&A).
 */
export function detectFunction(message: string): OracleFunction {
  const lower = message.toLowerCase()
  let best: { fn: OracleFunction; score: number } = { fn: 'answer', score: 0 }

  for (const [fn, keywords] of Object.entries(FN_KEYWORDS) as Array<
    [Exclude<OracleFunction, 'answer'>, string[]]
  >) {
    const score = keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0)
    if (score > best.score) best = { fn, score }
  }

  return best.fn
}

const FN_LABELS: Record<OracleFunction, string> = {
  answer: 'General Q&A',
  analyze_invoices: 'Invoice Analysis',
  detect_overdue: 'Overdue Detection',
  report: 'Business Report',
  cashflow: 'Cash Flow Forecast',
  actions: 'Action Recommendations',
}

// ─── DB context gathering ─────────────────────────────────────────────────────

const MAX_ROWS = 50

/**
 * Pull a focused snapshot of business data from the DB.
 * All queries are bounded (MAX_ROWS) and include the client relation for joins.
 * Returns empty arrays (never null) when tables are empty — the prompt builder
 * handles the empty state explicitly.
 */
export async function gatherContext(fn: OracleFunction): Promise<OracleDataSnapshot> {
  // For pure Q&A we still pull a minimal context (clients + counts) so the
  // Oracle can reference the user's actual business even on general questions.
  const needInvoices = fn === 'analyze_invoices' || fn === 'detect_overdue' || fn === 'report' || fn === 'cashflow' || fn === 'actions'
  const needPayments = fn === 'detect_overdue' || fn === 'report' || fn === 'cashflow' || fn === 'actions'
  const needReturns = fn === 'report' || fn === 'actions' || fn === 'answer'
  const needNotices = fn === 'report' || fn === 'actions' || fn === 'answer'
  const needRecon = fn === 'report' || fn === 'actions'

  // Real Data Connectors™ — always pull a small sample from each connector
  // table so Oracle can cite these sources when relevant.
  const needBankTxns = fn === 'cashflow' || fn === 'report' || fn === 'detect_overdue' || fn === 'actions'
  const needGmail = fn === 'report' || fn === 'actions' || fn === 'answer'
  const needDrive = fn === 'report' || fn === 'actions' || fn === 'answer'
  const needWhatsapp = fn === 'actions' || fn === 'answer'

  const [clients, invoices, payments, returns, notices, reconciliations, bankTxns, gmailMsgs, driveFiles, waMsgs] =
    await Promise.all([
      db.client.findMany({
        take: MAX_ROWS,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, gstin: true, tradeName: true, status: true,
          entityType: true, returnPeriod: true, healthScore: true,
        },
      }),
      needInvoices
        ? db.invoice.findMany({
            take: MAX_ROWS,
            orderBy: { createdAt: 'desc' },
            include: { client: { select: { tradeName: true, gstin: true } } },
          })
        : Promise.resolve([]),
      // NOTE: Payment has no relation to Client (clientId is a plain String FK).
      // We hydrate client names in a second pass below.
      needPayments
        ? db.payment.findMany({
            take: MAX_ROWS,
            orderBy: { paidAt: 'desc' },
          })
        : Promise.resolve([]),
      needReturns
        ? db.gSTRFiling.findMany({
            take: MAX_ROWS,
            orderBy: { createdAt: 'desc' },
            include: { client: { select: { tradeName: true, gstin: true } } },
          })
        : Promise.resolve([]),
      needNotices
        ? db.notice.findMany({
            take: MAX_ROWS,
            orderBy: { createdAt: 'desc' },
            include: { client: { select: { tradeName: true, gstin: true } } },
          })
        : Promise.resolve([]),
      needRecon
        ? db.reconciliationRun.findMany({
            take: MAX_ROWS,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      // ─── Real Data Connectors™ data ───
      needBankTxns
        ? db.bankTransaction.findMany({
            take: MAX_ROWS,
            orderBy: { date: 'desc' },
          })
        : Promise.resolve([]),
      needGmail
        ? db.gmailMessage.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      needDrive
        ? db.driveFile.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      needWhatsapp
        ? db.whatsAppMessage.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

  // Hydrate client names for payments (Payment has no Client relation).
  const paymentsWithClients = await Promise.all(
    payments.map(async (p) => {
      const client = p.clientId
        ? await db.client.findUnique({
            where: { id: p.clientId },
            select: { tradeName: true, gstin: true },
          })
        : null
      return { ...p, client }
    })
  )

  // Hydrate client names for reconciliation runs (clientId is a plain string FK).
  const reconWithClients = await Promise.all(
    reconciliations.map(async (r) => {
      const client = r.clientId
        ? await db.client.findUnique({
            where: { id: r.clientId },
            select: { tradeName: true, gstin: true },
          })
        : null
      return { ...r, client }
    })
  )

  const snapshot: OracleDataSnapshot = {
    clients: clients.map((c) => ({
      id: c.id, gstin: c.gstin, tradeName: c.tradeName,
      status: c.status, entityType: c.entityType,
      returnPeriod: c.returnPeriod, healthScore: c.healthScore,
    })),
    invoices: invoices.map((i) => ({
      id: i.id, invoiceNumber: i.invoiceNumber, invoiceDate: i.invoiceDate,
      sellerGstin: i.sellerGstin, buyerName: i.buyerName,
      invoiceType: i.invoiceType, taxableValue: i.taxableValue,
      cgst: i.cgst, sgst: i.sgst, igst: i.igst, cess: i.cess,
      totalAmount: i.totalAmount, status: i.status,
      matchStatus: i.matchStatus, riskLevel: i.riskLevel,
      hsnCode: i.hsnCode, source: i.source,
      client: i.client ? { tradeName: i.client.tradeName, gstin: i.client.gstin } : null,
    })),
    payments: paymentsWithClients.map((p) => ({
      id: p.id, direction: p.direction as 'in' | 'out',
      amount: p.amount, method: p.method, status: p.status,
      source: p.source, referenceNo: p.referenceNo, description: p.description,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      postedAt: p.postedAt.toISOString(),
      reconciliationStatus: p.reconciliationStatus,
      client: p.client ? { tradeName: p.client.tradeName, gstin: p.client.gstin } : null,
    })),
    returns: returns.map((r) => ({
      id: r.id, returnType: r.returnType, period: r.period,
      financialYear: r.financialYear, status: r.status,
      filedDate: r.filedDate, acknowledgmentNumber: r.acknowledgmentNumber,
      totalInvoices: r.totalInvoices, totalTaxableValue: r.totalTaxableValue,
      totalTax: r.totalTax, source: r.source,
      client: r.client ? { tradeName: r.client.tradeName, gstin: r.client.gstin } : null,
    })),
    notices: notices.map((n) => ({
      id: n.id, noticeType: n.noticeType, noticeNumber: n.noticeNumber,
      noticeDate: n.noticeDate, subject: n.subject, status: n.status,
      priority: n.priority, dueDate: n.dueDate, source: n.source,
      client: n.client ? { tradeName: n.client.tradeName, gstin: n.client.gstin } : null,
    })),
    reconciliations: reconWithClients.map((r) => ({
      id: r.id, period: r.period, sources: r.sources,
      totalRecords: r.totalRecords, matched: r.matched,
      unmatched: r.unmatched, partialMatches: r.partialMatches,
      highRisk: r.highRisk, gstDifference: r.gstDifference,
      status: r.status, source: r.source,
      client: r.client ? { tradeName: r.client.tradeName, gstin: r.client.gstin } : null,
    })),
    bankTransactions: bankTxns.map((t) => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      amount: t.amount,
      direction: t.direction,
      balanceAfter: t.balanceAfter,
      counterparty: t.counterparty,
      referenceNo: t.referenceNo,
    })),
    gmailMessages: gmailMsgs.map((m) => ({
      id: m.id,
      fromAddress: m.fromAddress,
      subject: m.subject,
      snippet: m.snippet,
      receivedAt: m.receivedAt ? m.receivedAt.toISOString() : null,
      hasAttachment: m.hasAttachment,
    })),
    driveFiles: driveFiles.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size,
      webViewLink: f.webViewLink,
    })),
    whatsappMessages: waMsgs.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      status: m.status,
      sentAt: m.sentAt ? m.sentAt.toISOString() : null,
      receivedAt: m.receivedAt ? m.receivedAt.toISOString() : null,
    })),
  }

  return snapshot
}

/**
 * Compute whether ANY real business data exists in the snapshot.
 * Used to choose between data-grounded response vs honest-empty-state response.
 */
export function hasAnyData(snap: OracleDataSnapshot): boolean {
  return (
    snap.invoices.length > 0 ||
    snap.payments.length > 0 ||
    snap.returns.length > 0 ||
    snap.notices.length > 0 ||
    snap.reconciliations.length > 0
  )
  // Note: clients alone don't count as "business data" — a client with no
  // invoices/payments/returns is just a registry entry. The Oracle should
  // still honestly say "no invoices recorded" even if clients exist.
}

// ─── Number / date formatting (Indian style) ──────────────────────────────────

export function formatINR(n: number): string {
  const rounded = Math.round(n)
  const abs = Math.abs(rounded)
  const sign = rounded < 0 ? '-' : ''
  // Indian comma grouping: last 3 digits, then groups of 2
  const str = abs.toString()
  let lastThree = str.slice(-3)
  const otherNumbers = str.slice(0, -3)
  if (otherNumbers.length > 0) {
    lastThree = ',' + lastThree
  }
  const formatted =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree
  return `${sign}₹${formatted}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso // already a string like "2024-04-15"
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  } catch {
    return iso
  }
}

/** Days between two dates (positive = future, negative = past). */
export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

// ─── Context block builder (injected into the LLM prompt) ─────────────────────

/**
 * Build a structured text snapshot of the live DB data, formatted for the LLM.
 * This is the ONLY source of numbers the LLM is allowed to cite.
 */
function buildDataContext(snap: OracleDataSnapshot, fn: OracleFunction): string {
  const lines: string[] = []
  lines.push('# LIVE BUSINESS DATA (queried from your database at ' + new Date().toISOString() + ')')
  lines.push('')
  lines.push(`## Clients (${snap.clients.length})`)
  if (snap.clients.length === 0) {
    lines.push('- No clients registered yet.')
  } else {
    for (const c of snap.clients.slice(0, 10)) {
      lines.push(`- ${c.tradeName} — GSTIN ${c.gstin} — ${c.entityType} — ${c.returnPeriod || 'no period'} — status: ${c.status} — health: ${c.healthScore}/100`)
    }
    if (snap.clients.length > 10) lines.push(`- ...and ${snap.clients.length - 10} more`)
  }
  lines.push('')

  if (fn === 'analyze_invoices' || fn === 'report' || fn === 'detect_overdue') {
    lines.push(`## Invoices (${snap.invoices.length})`)
    if (snap.invoices.length === 0) {
      lines.push('- No invoices recorded yet.')
    } else {
      const total = snap.invoices.reduce((s, i) => s + i.totalAmount, 0)
      const taxable = snap.invoices.reduce((s, i) => s + i.taxableValue, 0)
      const totalTax = snap.invoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst + i.cess, 0)
      lines.push(`- Aggregate: ${snap.invoices.length} invoices — taxable value ${formatINR(taxable)} — total tax ${formatINR(totalTax)} — grand total ${formatINR(total)}`)
      const byStatus: Record<string, number> = {}
      for (const i of snap.invoices) byStatus[i.status] = (byStatus[i.status] || 0) + 1
      lines.push(`- By status: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}`)
      const byRisk: Record<string, number> = {}
      for (const i of snap.invoices) byRisk[i.riskLevel] = (byRisk[i.riskLevel] || 0) + 1
      lines.push(`- By risk: ${Object.entries(byRisk).map(([k, v]) => `${k}=${v}`).join(', ')}`)
      lines.push('- Sample (most recent 10):')
      for (const i of snap.invoices.slice(0, 10)) {
        lines.push(`  • ${i.invoiceNumber} dated ${i.invoiceDate} — ${i.invoiceType} — ${i.buyerName || 'no buyer'} — taxable ${formatINR(i.taxableValue)} — tax ${formatINR(i.cgst + i.sgst + i.igst + i.cess)} — total ${formatINR(i.totalAmount)} — status ${i.status} — risk ${i.riskLevel} — source ${i.source}`)
      }
    }
    lines.push('')
  }

  if (fn === 'detect_overdue' || fn === 'report' || fn === 'cashflow' || fn === 'actions') {
    lines.push(`## Payments (${snap.payments.length})`)
    if (snap.payments.length === 0) {
      lines.push('- No payments recorded yet.')
    } else {
      const inflow = snap.payments.filter((p) => p.direction === 'in').reduce((s, p) => s + p.amount, 0)
      const outflow = snap.payments.filter((p) => p.direction === 'out').reduce((s, p) => s + p.amount, 0)
      lines.push(`- Aggregate: ${snap.payments.length} payments — inflow ${formatINR(inflow)} — outflow ${formatINR(outflow)} — net ${formatINR(inflow - outflow)}`)
      const byStatus: Record<string, number> = {}
      for (const p of snap.payments) byStatus[p.status] = (byStatus[p.status] || 0) + 1
      lines.push(`- By status: ${Object.entries(byStatus).map(([k, v]) => `${k}=${v}`).join(', ')}`)
      lines.push('- Sample (most recent 10):')
      for (const p of snap.payments.slice(0, 10)) {
        lines.push(`  • ${p.direction === 'in' ? 'RECEIVED' : 'PAID'} ${formatINR(p.amount)} via ${p.method || 'unknown'} on ${formatDate(p.paidAt)} — status ${p.status} — source ${p.source} — recon ${p.reconciliationStatus} — client ${p.client?.tradeName || 'n/a'}`)
      }
    }
    lines.push('')
  }

  if (fn === 'report' || fn === 'actions' || fn === 'answer') {
    lines.push(`## Returns (${snap.returns.length})`)
    if (snap.returns.length === 0) {
      lines.push('- No GSTR returns recorded yet.')
    } else {
      lines.push('- Recent returns:')
      for (const r of snap.returns.slice(0, 10)) {
        lines.push(`  • ${r.returnType} ${r.period} — status ${r.status} — filed ${r.filedDate || 'not filed'} — ARN ${r.acknowledgmentNumber || 'none'} — ${r.totalInvoices} invoices — taxable ${formatINR(r.totalTaxableValue)} — tax ${formatINR(r.totalTax)} — client ${r.client?.tradeName || 'n/a'}`)
      }
    }
    lines.push('')
  }

  if (fn === 'report' || fn === 'actions' || fn === 'answer') {
    lines.push(`## Notices (${snap.notices.length})`)
    if (snap.notices.length === 0) {
      lines.push('- No notices recorded yet.')
    } else {
      lines.push('- Recent notices:')
      for (const n of snap.notices.slice(0, 10)) {
        lines.push(`  • ${n.noticeType} ${n.noticeNumber || ''} — ${n.subject} — priority ${n.priority} — status ${n.status} — due ${n.dueDate || 'none'} — client ${n.client?.tradeName || 'n/a'}`)
      }
    }
    lines.push('')
  }

  if (fn === 'report' || fn === 'actions') {
    lines.push(`## Reconciliation Runs (${snap.reconciliations.length})`)
    if (snap.reconciliations.length === 0) {
      lines.push('- No reconciliation runs recorded yet.')
    } else {
      lines.push('- Recent runs:')
      for (const r of snap.reconciliations.slice(0, 10)) {
        lines.push(`  • Period ${r.period} — sources ${r.sources} — ${r.totalRecords} records — matched ${r.matched} — unmatched ${r.unmatched} — partial ${r.partialMatches} — high-risk ${r.highRisk} — GST diff ${formatINR(r.gstDifference)} — client ${r.client?.tradeName || 'n/a'}`)
      }
    }
    lines.push('')
  }

  // ─── Real Data Connectors™ data ───
  if (fn === 'cashflow' || fn === 'report' || fn === 'detect_overdue' || fn === 'actions') {
    lines.push(`## Bank Transactions (${snap.bankTransactions.length})`)
    if (snap.bankTransactions.length === 0) {
      lines.push('- No bank transactions synced yet. Connect a bank connector to pull real transactions.')
    } else {
      const credits = snap.bankTransactions.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0)
      const debits = snap.bankTransactions.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0)
      lines.push(`- Aggregate: ${snap.bankTransactions.length} transactions — credits ${formatINR(credits)} — debits ${formatINR(debits)} — net ${formatINR(credits - debits)}`)
      lines.push('- Recent (most recent 10):')
      for (const t of snap.bankTransactions.slice(0, 10)) {
        lines.push(`  • ${formatDate(t.date)} — ${t.direction === 'in' ? 'CREDIT' : 'DEBIT'} ${formatINR(Math.abs(t.amount))} — ${t.description || 'no description'} — counterparty ${t.counterparty || 'n/a'} — ref ${t.referenceNo || 'n/a'}${t.balanceAfter != null ? ` — balance after ${formatINR(t.balanceAfter)}` : ''}`)
      }
    }
    lines.push('')
  }

  if (fn === 'report' || fn === 'actions' || fn === 'answer') {
    lines.push(`## Gmail Messages (${snap.gmailMessages.length})`)
    if (snap.gmailMessages.length === 0) {
      lines.push('- No emails synced yet. Connect Gmail or Outlook to pull invoices and notices from email.')
    } else {
      lines.push('- Recent emails:')
      for (const m of snap.gmailMessages.slice(0, 10)) {
        lines.push(`  • From ${m.fromAddress || 'unknown'} — "${m.subject || 'no subject'}" — received ${formatDate(m.receivedAt)}${m.hasAttachment ? ' — has attachment' : ''}`)
      }
    }
    lines.push('')
  }

  if (fn === 'report' || fn === 'actions' || fn === 'answer') {
    lines.push(`## Drive Files (${snap.driveFiles.length})`)
    if (snap.driveFiles.length === 0) {
      lines.push('- No files synced from Google Drive yet.')
    } else {
      lines.push('- Recent files:')
      for (const f of snap.driveFiles.slice(0, 10)) {
        lines.push(`  • ${f.name} — ${f.mimeType || 'unknown type'} — ${f.size} bytes${f.webViewLink ? ` — link: ${f.webViewLink}` : ''}`)
      }
    }
    lines.push('')
  }

  if (fn === 'actions' || fn === 'answer') {
    lines.push(`## WhatsApp Messages (${snap.whatsappMessages.length})`)
    if (snap.whatsappMessages.length === 0) {
      lines.push('- No WhatsApp messages synced yet.')
    } else {
      lines.push('- Recent messages:')
      for (const m of snap.whatsappMessages.slice(0, 10)) {
        lines.push(`  • ${m.direction === 'in' ? 'IN' : 'OUT'} — "${m.body.slice(0, 80)}" — status ${m.status || 'unknown'} — ${m.sentAt ? `sent ${formatDate(m.sentAt)}` : m.receivedAt ? `received ${formatDate(m.receivedAt)}` : 'no timestamp'}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Role-specific persona blocks ─────────────────────────────────────────────

const CFO_PERSONA = `You are GSTPilot Oracle™ operating in **CFO Mode**.

You are a Chief Financial Officer with 20+ years of experience scaling Indian companies. You think in numbers, ratios, and runways. Your vocabulary: cash flow, working capital, burn rate, unit economics, EBITDA, gross margin, net margin, CAGR, WCAP days, DSO, DPO, inventory turns. You always tie advice back to money in the bank and money owed.

Your lens:
- Cash is king. Every recommendation must consider cash impact.
- Forecasts are probabilities, not certainties — give ranges and scenarios.
- Risk-adjusted thinking: a 90% chance of ₹1L and a 50% chance of ₹2L are not the same.
- Working capital optimization > revenue growth (for SMEs).
- You speak to founders, CEOs, and boards — concise, confident, no hedging.`

const CA_PERSONA = `You are GSTPilot Oracle™ operating in **CA Mode**.

You are a senior Chartered Accountant with deep Indian tax and compliance expertise. You have filed thousands of GSTR-1/3B/9 returns, handled ITC reconciliation, responded to SCN notices, and guided clients through tax audits. Your vocabulary: GSTIN, GSTR-1/3B/2B/9, ITC, reverse charge, place of supply, Section 17(5), Rule 36(4), e-invoicing, IRN, QRMP, TDS 26Q/24Q/27Q, 44AB tax audit, ROC MGT-7/AOC-4, advance tax.

Your lens:
- Compliance first. Every deadline is sacred; every late fee is avoidable.
- ITC is money. Blocked ITC under Section 17(5) is a permanent loss — flag it.
- Reconciliation is non-negotiable: books vs GSTR-2B vs GSTR-3B must tie out.
- When citing law, give the section + a one-line plain-English explanation.
- You speak to business owners and CA firm staff — precise, authoritative, practical.`

const OPS_PERSONA = `You are GSTPilot Oracle™ operating in **Operations Manager Mode**.

You are a senior Operations Manager running the back-office of an Indian CA firm or finance team. You live in deadlines, task lists, follow-ups, and client communications. Your vocabulary: deadline, due date, follow-up, assignment, status, pipeline, queue, priority, SLA, turnaround, owner, blocker, escalation.

Your lens:
- Deadlines drive everything. GSTR-1 by 11th, GSTR-3B by 20th, TDS by quarter-end.
- Every open item needs an owner and a date. No orphan tasks.
- Client communication is proactive: remind before due date, not after.
- Risk-based prioritization: high-risk + near-due first, low-risk + far-due later.
- You speak to team leads and managers — concrete, action-oriented, no theory.`

function rolePersona(role: OracleRole): string {
  if (role === 'cfo') return CFO_PERSONA
  if (role === 'ca') return CA_PERSONA
  return OPS_PERSONA
}

// ─── Function-specific instruction blocks ─────────────────────────────────────

const FN_INSTRUCTIONS: Record<OracleFunction, string> = {
  answer: `## Your task: Answer the user's question
- Use your expert knowledge of GST, finance, and compliance.
- Reference the user's actual business data (from the LIVE BUSINESS DATA block above) where relevant — for example, mention their registered clients by name if asked about a specific client.
- If the question is purely conceptual (e.g. "What is ITC?"), answer from first principles — no DB reference needed.
- Cite the relevant section / rule / due date with a one-line plain-English explanation.`,

  analyze_invoices: `## Your task: Analyze the invoices
- Compute and report: total count, total taxable value, total tax (CGST+SGST+IGST+Cess), grand total.
- Break down by status (draft/final/paid), by risk level (low/medium/high), by invoice type (B2B/B2C/exports).
- Flag anomalies: unusually high tax rates, negative values, missing HSN, mismatched GSTINs.
- Highlight the top 3 invoices by value and the top 3 by risk.
- If no invoices exist, explain what an invoice is in GST terms (B2B/B2C, taxable value, tax components, HSN) and the 3 ways to start recording them (manual entry, GSTN pull, Excel import).`,

  detect_overdue: `## Your task: Detect overdue payments
- For each invoice with status "final" or "issued" (i.e. not "draft"), compute the due date as invoice date + 30 days (standard Indian credit terms) UNLESS the invoice date string contains an explicit due date.
- Compare against today's date. Flag any invoice past due as OVERDUE with days overdue.
- Cross-reference payments: if a payment with matching amount + client exists and is "cleared", mark the invoice PAID.
- Produce an aging bucket: 0-30 / 31-60 / 61-90 / 90+ days overdue, with totals.
- List the top 5 most overdue invoices with client name, amount, days overdue.
- If no invoices exist, explain the credit cycle (invoice → credit period → due date → overdue → collection) and recommend a 30-day standard credit policy.`,

  report: `## Your task: Generate a comprehensive business report
- Cover all 6 dimensions: clients, invoices, payments, returns, notices, reconciliations.
- For each dimension: total count, aggregate value, status breakdown, top 3 items, anomalies.
- Provide a consolidated financial view: revenue (from invoices), collections (from payments), compliance posture (returns filed vs pending, notices open).
- Highlight 3 things going well and 3 things needing attention.
- If the DB is empty (or mostly empty), produce an honest "Initial State Report" explaining what each data category represents, why it matters, and the recommended order to start populating each (clients first → invoices → payments → returns → reconciliation).`,

  cashflow: `## Your task: Predict cash flow for the next 30/60/90 days
- Inflows = payments with direction "in" + outstanding invoices (status final/issued, not yet paid) expected to be collected within the period.
- Outflows = payments with direction "out" + GST liability (total tax from invoices for the current period, due by 20th of next month) + estimated operating expenses (if payment history shows recurring outflows).
- Build 3 scenarios: base (50th percentile), optimistic (75th percentile collection rate), pessimistic (25th percentile).
- Compute ending cash position for each period under each scenario.
- Flag any period where pessimistic ending cash < 0 (cash crunch risk).
- If no payment/invoice data exists, explain the cash flow formula (Inflows - Outflows = Net Cash; beginning cash + net cash = ending cash) and the 3 data sources needed to forecast (bank feed, invoice register, expense ledger).`,

  actions: `## Your task: Suggest concrete prioritized actions
- Build the action list from real DB state:
  1. Compliance deadlines: any GSTR returns with status "draft" approaching the 11th/20th of next month → "File GSTR-X for [client] by [date]".
  2. Overdue invoices (computed as invoice date + 30 days < today) → "Follow up with [client] on invoice [number] — [amount] — [N] days overdue".
  3. Open notices with priority "high" or due date approaching → "Respond to notice [type] for [client] by [date]".
  4. Unmatched reconciliation results → "Resolve [N] unmatched invoices in reconciliation run [period]".
  5. Unreconciled payments → "Match [N] payments to invoices".
- Each action MUST have: title, owner (you / client / team), deadline (specific date), priority (P0/P1/P2), effort estimate (S/M/L).
- Order by priority then deadline.
- If DB is empty, suggest the 5 foundational actions: (1) register first client, (2) record first invoice, (3) connect bank, (4) file first GSTR-1, (5) run first reconciliation — each with the specific step to execute.`,
}

// ─── Master system prompt builder ─────────────────────────────────────────────

/**
 * Compose the full Oracle system prompt for a given role + function + live data.
 * The prompt is strict about the 4-section structure and the no-placeholder rule.
 */
export function buildSystemPrompt(ctx: OracleContext): string {
  const persona = rolePersona(ctx.role)
  const fnInstr = FN_INSTRUCTIONS[ctx.fn]
  const dataBlock = buildDataContext(ctx.data, ctx.fn)

  return `${persona}

# YOUR CAPABILITIES
You operate across six functions:
1. **Answer questions** — GST, finance, compliance, operations Q&A.
2. **Analyze invoices** — totals, tax breakdown, risk, anomalies.
3. **Detect overdue payments** — aging buckets, collection priorities.
4. **Generate reports** — comprehensive business / compliance reports.
5. **Predict cash flow** — 30/60/90-day forecasts with scenarios.
6. **Suggest actions** — prioritized, owner-assigned, deadline-bound task lists.

Right now you are executing: **${FN_LABELS[ctx.fn]}**

# INDIA-FIRST CONTEXT
- GST rates: 0% / 5% / 12% / 18% / 28%
- GSTR-1 due: 11th of next month (13th for QRMP)
- GSTR-3B due: 20th of next month (22nd/24th for QRMP)
- GST late fee: ₹50/day (₹20/day for nil return), capped per return
- TDS quarterly returns: 26Q (non-salary), 24Q (salary), 27Q (non-resident)
- Tax audit threshold (44AB): ₹1 crore turnover (₹10 crore with 95% digital)
- Standard credit period in India: 30 days from invoice date

# FORMATTING RULES (NON-NEGOTIABLE)
- Currency: ₹ with Indian comma grouping (₹1,23,456 — NOT ₹123,456).
- Dates: DD/MM/YYYY.
- Bold key terms, amounts, dates, and section numbers using **double asterisks**.
- Use bullet points (-) for lists, numbered list (1. 2. 3.) for sequences.
- Tables: use markdown pipes (|) when comparing 3+ items.

# RESPONSE STRUCTURE — EXACTLY 4 SECTIONS, ALWAYS
Every response MUST contain exactly these four sections, in this order, with these exact markdown headers:

## Summary
A 2-3 sentence overview. State the key finding or direct answer up front. No preamble ("Sure!", "Great question!"). No hedging.

## Analysis
Detailed breakdown. Use the LIVE BUSINESS DATA below. Use bullets, sub-headings (###), or a markdown table when comparing items. Cite specific numbers, dates, client names from the data block. If data is empty for a category, state the fact ("No invoices recorded yet") and explain what that category means.

## Recommendations
3-5 specific, prioritized recommendations. Each recommendation is one bullet with a bold lead phrase. Tie each back to the analysis above.

## Actions
A numbered list of concrete next steps. Each action has: a verb, a specific target (client name / invoice number / return period), an owner (You / Client / CA team / Operations team), and a deadline (specific date in DD/MM/YYYY format or "this week"). Example: "1. File GSTR-3B for TechCorp Solutions by 20/07/2025 — Owner: CA team — Effort: S".

# BUSINESS MEMORY™ — PERSONALIZATION RULES
${ctx.memoryContext ? `You have stored memory about this user (see the BUSINESS MEMORY block below). Use it to personalize your response:
- **Greet by name** when natural (e.g. "Welcome back, ${'Prince'}.") — but only if the user's name is in memory.
- **Reference their goals** when relevant (e.g. "Your revenue goal is ₹5 Crore — this puts you on track.")
- **Reference past conversations** when the current question relates (e.g. "Last time you asked about cash flow — here's an update.")
- **Respect their preferences** (communication method, report format, reminder frequency).
- **Never re-ask** for information that's already in memory.
- If the user asks "Who am I?" or "What do you know about me?", summarize what's in the BUSINESS MEMORY block.
- If the user asks "What are my goals?", list the goals from memory.
- If the user asks "Who is risky?", use client memory + live data to rank clients by risk.

# BUSINESS MEMORY™
${ctx.memoryContext}
` : 'No stored memory for this user yet. If the user introduces themselves (name, firm, role), acknowledge it naturally. Do NOT ask them to fill out a form — just answer their question and let memory build organically.'}

# THE ABSOLUTE RULES — NEVER BREAK
1. **NEVER say "I don't have enough data."** If data is limited, say instead: "I currently have limited data. Based on what I know, here is my recommendation." Then give the best possible answer using whatever data IS available (memory + live DB + expert knowledge).
2. **NEVER invent numbers.** Use ONLY the numbers in the LIVE BUSINESS DATA block or the BUSINESS MEMORY block. If a category is empty, say so honestly.
3. **NEVER skip a section.** All 4 sections must appear in every response, even if the DB is empty.
4. **NEVER use Lorem Ipsum, "TBD", "TODO", "[placeholder]", or sample text.**
5. **Empty DB is not an excuse for a short answer.** If data is empty, the Analysis section explains what the data category is and why it matters; the Recommendations section suggests how to start populating it; the Actions section lists the concrete first steps.
6. **ALWAYS remember.** Use stored memory automatically. If the user has told you their name, firm, or goals before, reference them. Never make the user repeat themselves.
7. **CITE YOUR SOURCES.** When you reference data, mention which source it came from (Bank, GSTN, Invoices, Gmail, etc.). The user sees a Sources Panel™ under your answer — be consistent with it.

# SOURCES READ
Oracle read the following data sources to answer this question:
${ctx.sources.length > 0 ? ctx.sources.map((s) => `- **${s.label}** — ${s.recordCount} records${s.connected ? '' : ' (not connected)'}${s.recordCount > 0 ? '' : ' — no data yet'}`).join('\n') : '- No data sources matched this question.'}

# LIVE BUSINESS DATA
This is the ONLY source of business transaction numbers you may cite (in addition to the BUSINESS MEMORY block above). Do not invent statistics.

${dataBlock}

# DATA INTERPRETATION RULES
- Use these EXACT numbers in your response. Do not round, estimate, or "approximate".
- If a category shows 0 or empty, state "No X recorded yet" and explain what X is.
- Today's date for due-date calculations: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}.
- When computing overdue, use invoice date + 30 days as the due date (standard Indian credit terms).
- When forecasting cash flow, weight outstanding invoices by a 70% collection probability unless data shows otherwise.

${fnInstr}

Remember: you are GSTPilot Oracle™. You always respond. You always give all 4 sections. You never use placeholder text.`
}

// ─── Sources Panel™ — detect which data sources Oracle read ────────────────────

/**
 * Source keyword groups. When the user's question matches keywords, the
 * corresponding source is included in the Sources Panel™.
 */
const SOURCE_KEYWORDS: Record<string, { keywords: string[]; label: string }> = {
  bank: {
    label: 'Bank',
    keywords: ['money', 'received', 'receive', 'bank', 'transaction', 'balance', 'deposit', 'withdrawal', 'neft', 'rtgs', 'imps', 'upi', 'cash flow', 'cashflow', 'inflow', 'outflow', 'payment', 'paid', 'collection', 'revenue', 'income', 'earnings'],
  },
  razorpay: {
    label: 'Razorpay',
    keywords: ['razorpay', 'payment gateway', 'online payment', 'settlement'],
  },
  invoices: {
    label: 'Invoices',
    keywords: ['invoice', 'bill', 'billed', 'taxable', 'gst amount', 'hsn', 'b2b', 'b2c', 'outstanding', 'due', 'overdue', 'unpaid'],
  },
  gstn: {
    label: 'GSTN',
    keywords: ['gst', 'gstr', 'return', 'filing', 'filed', 'itc', 'notice', 'scn', 'show cause', 'gstr-1', 'gstr-3b', 'liability', 'tax credit', 'compliance'],
  },
  gmail: {
    label: 'Gmail',
    keywords: ['email', 'gmail', 'inbox', 'attachment', 'vendor email', 'reminder email', 'outlook'],
  },
  drive: {
    label: 'Google Drive',
    keywords: ['document', 'file', 'pdf', 'drive', 'folder', 'report file', 'upload'],
  },
  whatsapp: {
    label: 'WhatsApp',
    keywords: ['whatsapp', 'message', 'reminder', 'follow up', 'client message', 'collection message', 'send reminder'],
  },
  accounting: {
    label: 'Accounting',
    keywords: ['ledger', 'p&l', 'profit and loss', 'balance sheet', 'expense', 'accounting', 'tally', 'zoho', 'quickbooks', 'bookkeeping', 'books'],
  },
  clients: {
    label: 'Clients',
    keywords: ['client', 'customer', 'gstin', 'buyer', 'vendor', 'supplier', 'risk', 'who is', 'who should', 'who is risky'],
  },
}

/**
 * Detect which data sources Oracle should cite for this question.
 * Combines keyword matching + actual data presence + connection status.
 */
async function detectSources(
  message: string,
  data: OracleDataSnapshot,
): Promise<OracleSource[]> {
  const lower = message.toLowerCase()
  const sources: OracleSource[] = []

  // Fetch connected connections to know which connectors are live.
  const connections = await db.connection.findMany({
    where: { status: 'connected' },
    select: { provider: true },
  })
  const connectedProviders = new Set(connections.map((c) => c.provider))
  // Also check Integration table (Task 9 catalog connections).
  const connectedIntegrations = await db.integration.findMany({
    where: { connected: true },
    select: { key: true },
  })
  for (const i of connectedIntegrations) connectedProviders.add(i.key)

  // Bank: connected if any bank connector is connected OR bank transactions exist.
  const bankConnected = ['hdfc', 'icici', 'sbi', 'axis', 'kotak', 'indusind', 'banks'].some((k) => connectedProviders.has(k))
  // Razorpay: connected if razorpay is connected OR payments with source=razorpay exist.
  const razorpayConnected = connectedProviders.has('razorpay')
  // GSTN: connected if gstn is connected OR returns/notices exist.
  const gstnConnected = connectedProviders.has('gstn')
  // Gmail: connected if gmail or outlook is connected.
  const gmailConnected = connectedProviders.has('gmail') || connectedProviders.has('outlook')
  // Drive: connected if drive is connected.
  const driveConnected = connectedProviders.has('drive')
  // WhatsApp: connected if whatsapp is connected.
  const whatsappConnected = connectedProviders.has('whatsapp')
  // Accounting: connected if tally/zoho_books/quickbooks is connected.
  const accountingConnected = ['tally', 'zoho_books', 'quickbooks'].some((k) => connectedProviders.has(k))
  // Clients: always "connected" (internal DB).
  const clientsConnected = true
  // Invoices: always "connected" (internal DB).
  const invoicesConnected = true

  for (const [key, meta] of Object.entries(SOURCE_KEYWORDS)) {
    const matched = meta.keywords.some((kw) => lower.includes(kw))
    if (!matched) continue

    let recordCount = 0
    let connected = false

    switch (key) {
      case 'bank':
        recordCount = data.bankTransactions.length
        connected = bankConnected || recordCount > 0
        break
      case 'razorpay':
        recordCount = data.payments.filter((p) => p.source === 'razorpay').length
        connected = razorpayConnected || recordCount > 0
        break
      case 'invoices':
        recordCount = data.invoices.length
        connected = invoicesConnected || recordCount > 0
        break
      case 'gstn':
        recordCount = data.returns.length + data.notices.length
        connected = gstnConnected || recordCount > 0
        break
      case 'gmail':
        recordCount = data.gmailMessages.length
        connected = gmailConnected || recordCount > 0
        break
      case 'drive':
        recordCount = data.driveFiles.length
        connected = driveConnected || recordCount > 0
        break
      case 'whatsapp':
        recordCount = data.whatsappMessages.length
        connected = whatsappConnected || recordCount > 0
        break
      case 'accounting':
        connected = accountingConnected
        recordCount = 0 // we don't have a separate accounting table yet
        break
      case 'clients':
        recordCount = data.clients.length
        connected = clientsConnected
        break
    }

    sources.push({ key, label: meta.label, recordCount, connected })
  }

  // If no sources were matched by keywords (e.g. a general question), include
  // the data sources that actually have records, so the Sources Panel is never
  // empty when data exists.
  if (sources.length === 0) {
    if (data.invoices.length > 0) sources.push({ key: 'invoices', label: 'Invoices', recordCount: data.invoices.length, connected: true })
    if (data.payments.length > 0) sources.push({ key: 'razorpay', label: 'Payments', recordCount: data.payments.length, connected: true })
    if (data.returns.length > 0 || data.notices.length > 0) sources.push({ key: 'gstn', label: 'GSTN', recordCount: data.returns.length + data.notices.length, connected: gstnConnected })
    if (data.bankTransactions.length > 0) sources.push({ key: 'bank', label: 'Bank', recordCount: data.bankTransactions.length, connected: bankConnected })
    if (data.clients.length > 0) sources.push({ key: 'clients', label: 'Clients', recordCount: data.clients.length, connected: true })
  }

  return sources
}

// ─── Orchestrator: detect + gather + build ────────────────────────────────────

/**
 * Run the full intelligence pipeline:
 *  1. Detect role from message
 *  2. Detect function from message
 *  3. Gather DB context for that function
 *  4. Detect which data sources were read
 *  5. Build the role+function-specific system prompt
 *
 * Returns the full context object the route handler needs.
 */
export async function prepareOracleContext(
  message: string
): Promise<OracleContext> {
  const role = detectRole(message)
  const fn = detectFunction(message)
  const data = await gatherContext(fn)
  const hasData = hasAnyData(data)
  const sources = await detectSources(message, data)

  return {
    role,
    fn,
    fnLabel: FN_LABELS[fn],
    data,
    hasData,
    sources,
  }
}
