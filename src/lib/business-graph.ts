import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════════════════════
// Business Graph™ — shared assembler (Phase 3)
//
// Builds a living graph of the entire business from REAL database records.
// Used by /api/business-graph (GET) and /api/business-graph/ai (POST).
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

export type GraphNodeType =
  | 'business'
  | 'client'
  | 'invoice'
  | 'payment'
  | 'gst'
  | 'employee'
  | 'task'
  | 'document'
  | 'bank'
  | 'notice'
  | 'email'
  | 'whatsapp'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  sublabel?: string
  risk?: 'low' | 'medium' | 'high'
  weight?: number
  detail: NodeDetail
}

export interface NodeDetail {
  kind: string
  revenue?: number
  outstanding?: number
  invoiceCount?: number
  gstStatus?: string
  risk?: string
  riskScore?: number
  amount?: number
  status?: string
  period?: string
  method?: string
  source?: string
  date?: string
  dueDate?: string
  overdueDays?: number
  accountHolder?: string
  bankName?: string
  balance?: number
  role?: string
  department?: string
  priority?: string
  subject?: string
  fromAddress?: string
  fileType?: string
  relations: {
    clients?: number
    invoices?: number
    payments?: number
    overduePayments?: number
    employees?: number
    tasks?: number
    emails?: number
    whatsapp?: number
    documents?: number
    notices?: number
    returns?: number
    bankAccounts?: number
  }
  aiInsight: string
  recommendedActions: string[]
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type:
    | 'OWNS' | 'WORKS_FOR' | 'SERVES' | 'ISSUED_TO' | 'PAID_FOR' | 'RECEIVED_FROM'
    | 'FILES' | 'ASSIGNED_TO' | 'RELATED_TO' | 'RECEIVED' | 'BELONGS_TO'
    | 'OVERDUE' | 'HAS_RISK' | 'CONNECTED_WITH' | 'CREATED_BY'
}

export interface HealthMetric {
  key: string
  label: string
  score: number
  level: 'low' | 'medium' | 'high'
  detail: string
}

export interface BusinessGraph {
  hasData: boolean
  nodes: GraphNode[]
  edges: GraphEdge[]
  health: HealthMetric[]
  stats: {
    totalClients: number
    totalInvoices: number
    totalPayments: number
    totalReturns: number
    totalEmployees: number
    totalTasks: number
    totalDocuments: number
    totalNotices: number
    totalBankAccounts: number
    totalEmails: number
    totalWhatsapp: number
    totalRevenue: number
    totalOutstanding: number
    overdueCount: number
  }
  connections: {
    gstn: boolean
    banks: boolean
    gmail: boolean
    drive: boolean
    clients: boolean
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatINR(n: number): string {
  const s = Math.abs(Math.round(n)).toString()
  let result = ''
  let count = 0
  for (let i = s.length - 1; i >= 0; i--) {
    result = s[i] + result
    count++
    if (count === 3 && i > 0) { result = ',' + result; count = 0 }
    else if (count > 3 && count % 2 === 1 && i > 0) { result = ',' + result }
  }
  return '₹' + (n < 0 ? '-' : '') + result
}

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
}

function riskFromScore(score: number): 'low' | 'medium' | 'high' {
  if (score >= 66) return 'high'
  if (score >= 33) return 'medium'
  return 'low'
}

function underCapPerClient(
  clientId: string,
  all: { id: string; clientId: string }[],
  shown: Set<string>,
  cap: number,
): boolean {
  let count = 0
  for (const inv of all) {
    if (inv.clientId === clientId && shown.has(inv.id)) count++
  }
  return count < cap
}

// ─── Main assembler ───────────────────────────────────────────────────────────

export async function buildBusinessGraph(): Promise<BusinessGraph> {
  const [
    firms,
    clients,
    invoices,
    payments,
    returns,
    teamMembers,
    tasks,
    documents,
    bankAccounts,
    notices,
    emails,
    whatsapp,
    connections,
  ] = await Promise.all([
    db.firm.findMany({ take: 1, orderBy: { createdAt: 'asc' } }),
    db.client.findMany({ take: 12, orderBy: { createdAt: 'desc' } }),
    db.invoice.findMany({
      take: 60,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, tradeName: true, gstin: true } } },
    }),
    db.payment.findMany({
      take: 40,
      orderBy: { createdAt: 'desc' },
    }),
    db.gSTRFiling.findMany({ take: 12, orderBy: { createdAt: 'desc' } }),
    db.teamMember.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
    db.workloadAssignment.findMany({ take: 12, orderBy: { assignedAt: 'desc' } }),
    db.document.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
    db.bankAccount.findMany({ take: 6, orderBy: { createdAt: 'desc' } }),
    db.notice.findMany({ take: 8, orderBy: { createdAt: 'desc' } }),
    db.gmailMessage.findMany({ take: 8, orderBy: { createdAt: 'desc' } }),
    db.whatsAppMessage.findMany({ take: 8, orderBy: { createdAt: 'desc' } }),
    db.connection.findMany({ select: { provider: true, status: true } }),
  ])

  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const edgeSet = new Set<string>()
  const addEdge = (source: string, target: string, type: GraphEdge['type']) => {
    const id = `${source}-${type}-${target}`
    if (edgeSet.has(id)) return
    edgeSet.add(id)
    edges.push({ id, source, target, type })
  }

  const hasData =
    clients.length > 0 ||
    invoices.length > 0 ||
    payments.length > 0 ||
    returns.length > 0 ||
    teamMembers.length > 0 ||
    bankAccounts.length > 0

  // ── Central Business node ──
  const firm = firms[0]
  const businessId = firm?.id ?? 'business-root'
  const businessName = firm?.name ?? 'Your Business'
  nodes.push({
    id: businessId,
    type: 'business',
    label: businessName,
    sublabel: firm?.gstin ?? 'GSTPilot Firm',
    weight: 10,
    detail: {
      kind: 'Business',
      revenue: invoices.reduce((s, i) => s + i.totalAmount, 0),
      outstanding: invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.totalAmount, 0),
      invoiceCount: invoices.length,
      gstStatus: returns.some((r) => r.status === 'filed') ? 'Active' : 'Pending',
      risk: clients.length === 0 ? 'low' : 'medium',
      relations: {
        clients: clients.length,
        invoices: invoices.length,
        payments: payments.length,
        employees: teamMembers.length,
        returns: returns.length,
        bankAccounts: bankAccounts.length,
        documents: documents.length,
        notices: notices.length,
      },
      aiInsight:
        clients.length === 0
          ? 'No connected clients yet. Connect GSTN and import clients to activate the graph.'
          : `${clients.length} clients connected generating ${formatINR(
              invoices.reduce((s, i) => s + i.totalAmount, 0),
            )} in invoiced revenue. ${invoices.filter((i) => i.status !== 'paid').length} invoices currently outstanding.`,
      recommendedActions:
        clients.length === 0
          ? ['Connect GSTN', 'Import clients', 'Connect bank account']
          : ['Review outstanding invoices', 'Check GST filing status', 'Sync latest data'],
    },
  })

  // ── Per-client aggregates ──
  const clientAgg = new Map<string, {
    revenue: number; outstanding: number; invoiceCount: number; overdueCount: number
    returnCount: number; noticeCount: number; emailCount: number; whatsappCount: number
    docCount: number; taskCount: number; paymentCount: number
  }>()
  for (const c of clients) {
    clientAgg.set(c.id, {
      revenue: 0, outstanding: 0, invoiceCount: 0, overdueCount: 0, returnCount: 0,
      noticeCount: 0, emailCount: 0, whatsappCount: 0, docCount: 0, taskCount: 0, paymentCount: 0,
    })
  }
  for (const inv of invoices) {
    const a = clientAgg.get(inv.clientId)
    if (!a) continue
    a.revenue += inv.totalAmount
    a.invoiceCount += 1
    if (inv.status !== 'paid') {
      a.outstanding += inv.totalAmount
      const days = daysSince(inv.invoiceDate)
      if (days !== null && days > 30) a.overdueCount += 1
    }
  }
  for (const r of returns) { const a = clientAgg.get(r.clientId); if (a) a.returnCount += 1 }
  for (const n of notices) { const a = clientAgg.get(n.clientId); if (a) a.noticeCount += 1 }
  for (const e of emails) { if (!e.clientId) continue; const a = clientAgg.get(e.clientId); if (a) a.emailCount += 1 }
  for (const w of whatsapp) { if (!w.clientId) continue; const a = clientAgg.get(w.clientId); if (a) a.whatsappCount += 1 }
  for (const d of documents) { if (!d.clientId) continue; const a = clientAgg.get(d.clientId); if (a) a.docCount += 1 }
  for (const t of tasks) { if (!t.clientId) continue; const a = clientAgg.get(t.clientId); if (a) a.taskCount += 1 }
  for (const p of payments) { if (!p.clientId) continue; const a = clientAgg.get(p.clientId); if (a) a.paymentCount += 1 }

  // ── Client nodes ──
  for (const c of clients) {
    const a = clientAgg.get(c.id)!
    const overdueRatio = a.invoiceCount > 0 ? a.overdueCount / a.invoiceCount : 0
    const riskScore = Math.min(100, Math.round(overdueRatio * 60 + a.noticeCount * 12 + (c.healthScore < 50 ? 20 : 0)))
    const risk = riskFromScore(riskScore)
    const insightParts: string[] = []
    if (a.overdueCount > 0) insightParts.push(`${a.overdueCount} invoice${a.overdueCount > 1 ? 's' : ''} overdue`)
    if (a.noticeCount > 0) insightParts.push(`${a.noticeCount} notice${a.noticeCount > 1 ? 's' : ''} received`)
    if (a.outstanding > 0) insightParts.push(`${formatINR(a.outstanding)} outstanding`)
    const insight = insightParts.length > 0
      ? `${insightParts.join(', ')}. Risk score ${riskScore}/100.`
      : `Healthy. ${a.invoiceCount} invoices, ${formatINR(a.revenue)} revenue. Risk score ${riskScore}/100.`
    nodes.push({
      id: c.id, type: 'client', label: c.tradeName, sublabel: c.gstin, risk,
      weight: 4 + Math.min(6, a.invoiceCount / 2),
      detail: {
        kind: 'Client', revenue: a.revenue, outstanding: a.outstanding, invoiceCount: a.invoiceCount,
        gstStatus: a.returnCount > 0 ? 'Compliant' : 'No returns', risk, riskScore,
        relations: {
          invoices: a.invoiceCount, overduePayments: a.overdueCount, returns: a.returnCount,
          notices: a.noticeCount, emails: a.emailCount, whatsapp: a.whatsappCount,
          documents: a.docCount, tasks: a.taskCount, payments: a.paymentCount,
        },
        aiInsight: insight,
        recommendedActions: a.overdueCount > 0
          ? ['Send reminder', 'Call client', 'Generate statement', 'Create task']
          : ['Generate statement', 'Schedule review', 'Sync latest data'],
      },
    })
    addEdge(businessId, c.id, 'SERVES')
  }

  // ── Invoice nodes ──
  const shownInvoices = new Set<string>()
  for (const inv of invoices) {
    if (!underCapPerClient(inv.clientId, invoices, shownInvoices, 4)) continue
    shownInvoices.add(inv.id)
    const days = daysSince(inv.invoiceDate)
    const overdue = inv.status !== 'paid' && days !== null && days > 30
    const risk: 'low' | 'medium' | 'high' = overdue ? 'high'
      : inv.riskLevel === 'high' ? 'high' : inv.riskLevel === 'medium' ? 'medium' : 'low'
    nodes.push({
      id: inv.id, type: 'invoice', label: `#${inv.invoiceNumber}`, sublabel: formatINR(inv.totalAmount),
      risk, weight: 2 + Math.min(4, inv.totalAmount / 100000),
      detail: {
        kind: 'Invoice', amount: inv.totalAmount, status: inv.status, period: inv.period ?? undefined,
        date: inv.invoiceDate, overdueDays: overdue && days !== null ? days : undefined, source: inv.source,
        relations: { clients: 1, payments: payments.filter((p) => p.invoiceId === inv.id).length },
        aiInsight: overdue
          ? `Overdue by ${days} days. Outstanding ${formatINR(inv.totalAmount)}. Affects cash flow.`
          : `Invoice ${inv.invoiceNumber} for ${formatINR(inv.totalAmount)}. Status: ${inv.status}.`,
        recommendedActions: overdue
          ? ['Send reminder', 'Mark as paid', 'Create follow-up task']
          : ['Mark as paid', 'View details'],
      },
    })
    addEdge(inv.id, inv.clientId, 'ISSUED_TO')
    if (overdue) addEdge(inv.id, inv.clientId, 'OVERDUE')
  }

  // ── Payment nodes ──
  for (const p of payments) {
    nodes.push({
      id: p.id, type: 'payment', label: formatINR(p.amount),
      sublabel: p.direction === 'in' ? 'Received' : 'Paid',
      risk: p.status === 'failed' ? 'high' : 'low', weight: 2 + Math.min(3, p.amount / 100000),
      detail: {
        kind: 'Payment', amount: p.amount, status: p.status, method: p.method ?? undefined,
        source: p.source, date: p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : undefined,
        relations: {},
        aiInsight: p.direction === 'in'
          ? `Payment received ${formatINR(p.amount)} via ${p.method ?? p.source}. Status: ${p.status}.`
          : `Payment sent ${formatINR(p.amount)} via ${p.method ?? p.source}. Status: ${p.status}.`,
        recommendedActions: ['Match to invoice', 'View details'],
      },
    })
    if (p.invoiceId) addEdge(p.id, p.invoiceId, 'PAID_FOR')
    if (p.clientId) addEdge(p.id, p.clientId, 'RECEIVED_FROM')
  }

  // ── GST Return nodes ──
  for (const r of returns) {
    const risk: 'low' | 'medium' | 'high' = r.status === 'filed' ? 'low' : r.status === 'draft' ? 'medium' : 'high'
    nodes.push({
      id: r.id, type: 'gst', label: r.returnType, sublabel: r.period, risk, weight: 3,
      detail: {
        kind: 'GST Return', status: r.status, period: r.period, amount: r.totalTax,
        relations: { invoices: r.totalInvoices },
        aiInsight: r.status === 'filed'
          ? `${r.returnType} for ${r.period} filed. ${r.totalInvoices} invoices.`
          : `${r.returnType} for ${r.period} is ${r.status}. ${r.criticalErrors} critical errors.`,
        recommendedActions: r.status === 'filed' ? ['View filing'] : ['Prepare return', 'Resolve errors', 'File now'],
      },
    })
    addEdge(r.id, r.clientId, 'FILES')
  }

  // ── Employee nodes ──
  for (const e of teamMembers) {
    const taskCount = tasks.filter((t) => t.teamMemberId === e.id).length
    nodes.push({
      id: e.id, type: 'employee', label: e.name, sublabel: e.role, risk: 'low', weight: 3,
      detail: {
        kind: 'Employee', role: e.role, department: e.department ?? undefined,
        relations: { tasks: taskCount },
        aiInsight: `${e.name} (${e.role}) handling ${taskCount} task${taskCount !== 1 ? 's' : ''}.`,
        recommendedActions: ['Assign task', 'View workload'],
      },
    })
    addEdge(e.id, businessId, 'WORKS_FOR')
  }

  // ── Task nodes ──
  for (const t of tasks) {
    nodes.push({
      id: t.id, type: 'task',
      label: t.title.length > 22 ? t.title.slice(0, 22) + '…' : t.title, sublabel: t.status,
      risk: t.priority === 'high' ? 'high' : t.priority === 'medium' ? 'medium' : 'low', weight: 2,
      detail: {
        kind: 'Task', status: t.status, priority: t.priority, date: t.dueDate ?? undefined, relations: {},
        aiInsight: `Task "${t.title}" — ${t.status}, ${t.priority} priority.`,
        recommendedActions: ['Complete task', 'Reassign'],
      },
    })
    addEdge(t.id, t.teamMemberId, 'ASSIGNED_TO')
    if (t.clientId) addEdge(t.id, t.clientId, 'RELATED_TO')
  }

  // ── Document nodes ──
  for (const d of documents) {
    nodes.push({
      id: d.id, type: 'document',
      label: d.name.length > 20 ? d.name.slice(0, 20) + '…' : d.name, sublabel: d.fileType.toUpperCase(),
      risk: 'low', weight: 1.5,
      detail: {
        kind: 'Document', fileType: d.fileType, status: d.folder,
        date: new Date(d.createdAt).toISOString().slice(0, 10), relations: {},
        aiInsight: `Document "${d.name}" (${d.fileType}) in ${d.folder}.`,
        recommendedActions: ['Open', 'Share'],
      },
    })
    if (d.clientId) addEdge(d.id, d.clientId, 'BELONGS_TO')
  }

  // ── Bank Account nodes ──
  for (const b of bankAccounts) {
    nodes.push({
      id: b.id, type: 'bank', label: b.bankName,
      sublabel: b.accountNumberMasked ?? `••${b.accountNumber.slice(-4)}`, risk: 'low', weight: 3,
      detail: {
        kind: 'Bank Account', bankName: b.bankName, accountHolder: b.accountHolder ?? undefined,
        balance: b.currentBalance, status: b.isActive ? 'Active' : 'Inactive', relations: {},
        aiInsight: `${b.bankName} account ••${b.accountNumber.slice(-4)}. Balance ${formatINR(b.currentBalance)}.`,
        recommendedActions: ['Sync transactions', 'View statement'],
      },
    })
    addEdge(businessId, b.id, 'OWNS')
    if (b.clientId) addEdge(b.id, b.clientId, 'CONNECTED_WITH')
  }

  // ── Notice nodes ──
  for (const n of notices) {
    const risk: 'low' | 'medium' | 'high' = n.priority === 'high' ? 'high' : n.priority === 'medium' ? 'medium' : 'low'
    nodes.push({
      id: n.id, type: 'notice',
      label: n.subject.length > 22 ? n.subject.slice(0, 22) + '…' : n.subject, sublabel: n.noticeType,
      risk, weight: 2.5,
      detail: {
        kind: 'Notice', status: n.status, priority: n.priority, subject: n.subject,
        date: n.noticeDate ?? undefined, source: n.source, relations: {},
        aiInsight: `${n.noticeType} — ${n.subject}. Status: ${n.status}, ${n.priority} priority.`,
        recommendedActions: ['Draft response', 'Assign', 'View details'],
      },
    })
    addEdge(n.id, n.clientId, 'RECEIVED')
  }

  // ── Email nodes ──
  for (const e of emails) {
    nodes.push({
      id: e.id, type: 'email',
      label: e.subject ? (e.subject.length > 22 ? e.subject.slice(0, 22) + '…' : e.subject) : 'Email',
      sublabel: 'Gmail', risk: 'low', weight: 1.5,
      detail: {
        kind: 'Email', status: e.isParsed ? 'Parsed' : 'Unparsed', fromAddress: e.fromAddress ?? undefined,
        date: e.receivedAt ? new Date(e.receivedAt).toISOString().slice(0, 10) : undefined,
        source: 'gmail', relations: {},
        aiInsight: e.subject ? `Email: "${e.subject}" from ${e.fromAddress ?? 'unknown'}.` : 'Email synced from Gmail.',
        recommendedActions: ['Parse invoice', 'View'],
      },
    })
    if (e.clientId) addEdge(e.id, e.clientId, 'RELATED_TO')
  }

  // ── WhatsApp nodes ──
  for (const w of whatsapp) {
    nodes.push({
      id: w.id, type: 'whatsapp',
      label: w.body.length > 22 ? w.body.slice(0, 22) + '…' : w.body,
      sublabel: w.direction === 'in' ? 'Received' : 'Sent',
      risk: w.status === 'failed' ? 'high' : 'low', weight: 1.5,
      detail: {
        kind: 'WhatsApp Message', status: w.status, source: 'whatsapp',
        date: w.sentAt ? new Date(w.sentAt).toISOString().slice(0, 10) : undefined, relations: {},
        aiInsight: `WhatsApp ${w.direction}: "${w.body.slice(0, 60)}${w.body.length > 60 ? '…' : ''}" — ${w.status}.`,
        recommendedActions: ['Reply', 'View'],
      },
    })
    if (w.clientId) addEdge(w.id, w.clientId, 'RELATED_TO')
  }

  // ── Business Health Engine ──
  const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0)
  const totalOutstanding = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.totalAmount, 0)
  const overdueCount = invoices.filter((i) => {
    if (i.status === 'paid') return false
    const d = daysSince(i.invoiceDate)
    return d !== null && d > 30
  }).length

  const collectionScore = totalRevenue > 0 ? Math.min(100, Math.round((totalOutstanding / totalRevenue) * 100)) : 0
  const filedReturns = returns.filter((r) => r.status === 'filed').length
  const complianceScore = returns.length > 0 ? Math.min(100, Math.round(((returns.length - filedReturns) / returns.length) * 100)) : 0
  let topClientShare = 0
  if (totalRevenue > 0) {
    const maxRev = Math.max(0, ...Array.from(clientAgg.values()).map((a) => a.revenue))
    topClientShare = Math.round((maxRev / totalRevenue) * 100)
  }
  const concentrationScore = Math.min(100, topClientShare)
  let topEmployeeShare = 0
  if (teamMembers.length > 0 && tasks.length > 0) {
    const counts = new Map<string, number>()
    for (const t of tasks) counts.set(t.teamMemberId, (counts.get(t.teamMemberId) ?? 0) + 1)
    const maxTasks = Math.max(0, ...counts.values())
    topEmployeeShare = Math.round((maxTasks / tasks.length) * 100)
  }
  const employeeScore = Math.min(100, topEmployeeShare)
  const paymentsIn = payments.filter((p) => p.direction === 'in').reduce((s, p) => s + p.amount, 0)
  const cashFlowScore = totalOutstanding > 0 ? Math.min(100, Math.round(((totalOutstanding - paymentsIn) / Math.max(1, totalOutstanding)) * 100)) : 0
  const revenueDependencyScore = concentrationScore

  const health: HealthMetric[] = [
    { key: 'collection', label: 'Collection Risk', score: collectionScore, level: riskFromScore(collectionScore),
      detail: `${formatINR(totalOutstanding)} outstanding across ${overdueCount} overdue invoice${overdueCount !== 1 ? 's' : ''}.` },
    { key: 'compliance', label: 'Compliance Risk', score: complianceScore, level: riskFromScore(complianceScore),
      detail: `${returns.length - filedReturns} of ${returns.length} GST returns not yet filed.` },
    { key: 'concentration', label: 'Customer Concentration', score: concentrationScore, level: riskFromScore(concentrationScore),
      detail: `Top client contributes ${topClientShare}% of total invoiced revenue.` },
    { key: 'revenue', label: 'Revenue Dependency', score: revenueDependencyScore, level: riskFromScore(revenueDependencyScore),
      detail: topClientShare > 40 ? `High dependency on a single client (${topClientShare}%). Diversify to reduce risk.` : `Revenue is well-distributed across clients.` },
    { key: 'employee', label: 'Employee Dependency', score: employeeScore, level: riskFromScore(employeeScore),
      detail: tasks.length > 0 ? `Top employee handles ${topEmployeeShare}% of all tasks.` : 'No tasks assigned yet.' },
    { key: 'cashflow', label: 'Cash Flow Risk', score: cashFlowScore, level: riskFromScore(cashFlowScore),
      detail: `${formatINR(paymentsIn)} received vs ${formatINR(totalOutstanding)} outstanding.` },
  ]

  const isConnected = (provider: string) =>
    connections.some((c) => c.provider === provider && c.status === 'connected')

  return {
    hasData,
    nodes,
    edges,
    health,
    stats: {
      totalClients: clients.length, totalInvoices: invoices.length, totalPayments: payments.length,
      totalReturns: returns.length, totalEmployees: teamMembers.length, totalTasks: tasks.length,
      totalDocuments: documents.length, totalNotices: notices.length, totalBankAccounts: bankAccounts.length,
      totalEmails: emails.length, totalWhatsapp: whatsapp.length, totalRevenue, totalOutstanding, overdueCount,
    },
    connections: {
      gstn: isConnected('gstn'), banks: isConnected('banks'), gmail: isConnected('gmail'),
      drive: isConnected('drive'), clients: isConnected('clients'),
    },
  }
}

// ─── Compact text summary for the LLM (used by /api/business-graph/ai) ─────────

/**
 * Builds a compact, LLM-friendly textual snapshot of the graph. This is what
 * the AI reads to answer "AI Explain" and natural-language graph questions.
 * Kept under ~3KB so it fits comfortably in the prompt.
 */
export function buildGraphSummary(graph: BusinessGraph): string {
  const lines: string[] = []
  lines.push(`BUSINESS GRAPH SUMMARY`)
  lines.push(`Nodes: ${graph.nodes.length} | Edges: ${graph.edges.length}`)
  lines.push(`Stats: ${graph.stats.totalClients} clients, ${graph.stats.totalInvoices} invoices, ${graph.stats.totalPayments} payments, ${graph.stats.totalReturns} GST returns, ${graph.stats.totalEmployees} employees, ${graph.stats.totalTasks} tasks, ${graph.stats.totalBankAccounts} bank accounts, ${graph.stats.totalNotices} notices, ${graph.stats.totalEmails} emails, ${graph.stats.totalWhatsapp} WhatsApp messages.`)
  lines.push(`Revenue: ${formatINR(graph.stats.totalRevenue)} | Outstanding: ${formatINR(graph.stats.totalOutstanding)} | Overdue invoices: ${graph.stats.overdueCount}`)
  lines.push(``)
  lines.push(`BUSINESS HEALTH ENGINE:`)
  for (const h of graph.health) {
    lines.push(`- ${h.label}: ${h.score}/100 (${h.level.toUpperCase()}) — ${h.detail}`)
  }
  lines.push(``)
  lines.push(`TOP NODES (by type):`)
  const byType = new Map<string, GraphNode[]>()
  for (const n of graph.nodes) {
    if (!byType.has(n.type)) byType.set(n.type, [])
    byType.get(n.type)!.push(n)
  }
  for (const [type, arr] of byType) {
    const sample = arr.slice(0, 6)
    lines.push(`- ${type.toUpperCase()} (${arr.length}): ${sample.map((n) => `"${n.label}"${n.detail.outstanding ? ` (${formatINR(n.detail.outstanding)} outstanding)` : ''}${n.detail.overdueDays ? ` overdue ${n.detail.overdueDays}d` : ''}${n.risk === 'high' ? ' [HIGH RISK]' : ''}`).join('; ')}`)
  }
  lines.push(``)
  lines.push(`KEY RELATIONSHIPS:`)
  // Summarise edge types
  const edgeCounts = new Map<string, number>()
  for (const e of graph.edges) edgeCounts.set(e.type, (edgeCounts.get(e.type) ?? 0) + 1)
  for (const [type, count] of edgeCounts) lines.push(`- ${type}: ${count}`)
  return lines.join('\n')
}
