/**
 * Subscription Engine™ + Billing Engine™ + Usage Metering™
 * Plans, subscriptions, invoices/credit notes/refunds, and metered usage.
 */
import { db } from '@/lib/db'
import { PLAN_DEFINITIONS, getPlan, USAGE_METRICS } from './types'

// ── Subscription ────────────────────────────────────────────────────────────────
export async function getSubscription(tenantId: string) {
  const sub = await db.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { billingInvoices: true } } },
  })
  if (!sub) return null
  return {
    id: sub.id,
    plan: sub.plan,
    status: sub.status,
    billingCycle: sub.billingCycle,
    seatCount: sub.seatCount,
    companyCount: sub.companyCount,
    amount: sub.amount,
    startedAt: sub.startedAt.toISOString(),
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelledAt: sub.cancelledAt?.toISOString() ?? null,
    paymentMethod: sub.paymentMethod,
    invoiceCount: sub._count.billingInvoices,
  }
}

export async function changePlan(tenantId: string, planKey: string, billingCycle: 'monthly' | 'yearly') {
  const plan = getPlan(planKey)
  const existing = await db.subscription.findFirst({ where: { tenantId } })
  const now = new Date()
  const end = new Date(now)
  if (billingCycle === 'yearly') end.setFullYear(end.getFullYear() + 1)
  else end.setMonth(end.getMonth() + 1)
  const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly
  if (existing) {
    return db.subscription.update({
      where: { id: existing.id },
      data: { plan: planKey, billingCycle, seatCount: plan.seats, companyCount: plan.companies, amount, currentPeriodStart: now, currentPeriodEnd: end },
    })
  }
  return db.subscription.create({
    data: { tenantId, plan: planKey, billingCycle, seatCount: plan.seats, companyCount: plan.companies, amount, currentPeriodStart: now, currentPeriodEnd: end },
  })
}

// ── Billing ────────────────────────────────────────────────────────────────────
export async function listBillingInvoices(tenantId: string, take = 50) {
  const rows = await db.billingInvoice.findMany({
    where: { tenantId },
    orderBy: { issuedAt: 'desc' },
    take,
  })
  return rows.map((b) => ({
    id: b.id, number: b.number, type: b.type, status: b.status,
    subtotal: b.subtotal, tax: b.tax, total: b.total, currency: b.currency,
    items: safeParse(b.items),
    issuedAt: b.issuedAt.toISOString(),
    dueAt: b.dueAt?.toISOString() ?? null,
    paidAt: b.paidAt?.toISOString() ?? null,
  }))
}

export async function createBillingInvoice(tenantId: string, data: {
  type?: 'invoice' | 'credit_note' | 'refund'
  subtotal: number
  tax: number
  total: number
  items: { description: string; quantity: number; amount: number }[]
  dueAt?: Date
}) {
  const seq = await db.billingInvoice.count({ where: { tenantId } }) + 1
  const year = new Date().getFullYear()
  const number = `GTP-INV-${year}-${String(seq).padStart(4, '0')}`
  const sub = await db.subscription.findFirst({ where: { tenantId } })
  return db.billingInvoice.create({
    data: {
      tenantId,
      subscriptionId: sub?.id,
      number,
      type: data.type ?? 'invoice',
      status: 'issued',
      subtotal: data.subtotal,
      tax: data.tax,
      total: data.total,
      currency: 'INR',
      items: JSON.stringify(data.items),
      issuedAt: new Date(),
      dueAt: data.dueAt ?? null,
    },
  })
}

export function listPlans() {
  return PLAN_DEFINITIONS
}

// ── Usage metering ─────────────────────────────────────────────────────────────
export async function recordUsage(tenantId: string, metric: string, count = 1, metadata?: Record<string, unknown>) {
  const bucket = new Date().toISOString().slice(0, 10)
  return db.usageEvent.create({
    data: { tenantId, metric, count, bucket, metadata: metadata ? JSON.stringify(metadata) : null },
  })
}

export async function getUsageSummary(tenantId: string, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const rows = await db.usageEvent.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: { metric: true, count: true },
  })
  const sub = await db.subscription.findFirst({ where: { tenantId } })
  const plan = getPlan(sub?.plan ?? 'free')
  const totals = new Map<string, number>()
  for (const r of rows) totals.set(r.metric, (totals.get(r.metric) ?? 0) + r.count)
  return USAGE_METRICS.map((m) => {
    const used = totals.get(m.key) ?? 0
    const limit = m.key === 'ai_requests' ? plan.aiRequestsPerMonth
      : m.key === 'api_calls' ? plan.apiCallsPerMonth
      : m.key === 'automation_runs' ? plan.automationRunsPerMonth
      : m.key === 'storage_mb' ? plan.storageMb
      : 0
    return { metric: m.key, label: m.label, unit: m.unit, used, limit, pct: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0 }
  })
}

export async function getUsageTimeseries(tenantId: string, days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const rows = await db.usageEvent.findMany({
    where: { tenantId, createdAt: { gte: since } },
    select: { metric: true, count: true, bucket: true },
    orderBy: { bucket: 'asc' },
  })
  // group by bucket → { date, ai_requests, api_calls, ... }
  const byBucket = new Map<string, Record<string, number>>()
  for (const r of rows) {
    const entry = byBucket.get(r.bucket) ?? { date: r.bucket }
    entry[r.metric] = (entry[r.metric] ?? 0) + r.count
    byBucket.set(r.bucket, entry)
  }
  return [...byBucket.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function safeParse(s: string | null | undefined): unknown[] {
  if (!s) return []
  try { return JSON.parse(s) as unknown[] } catch { return [] }
}
