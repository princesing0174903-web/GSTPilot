import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAuth, requireOrgMembership } from '@/lib/auth/session'
import { isOverdue, getFilingDueDate } from '@/lib/gst-utils'

// Helper: get last N month periods in "YYYY-MM" format
function getLastNMonths(n: number, referencePeriod?: string): string[] {
  const months: string[] = []
  let refDate: Date
  if (referencePeriod) {
    const [y, m] = referencePeriod.split('-').map(Number)
    refDate = new Date(y, m - 1, 1)
  } else {
    refDate = new Date()
  }
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push(period)
  }
  return months
}

// GET /api/analytics — Fetch analytics data for charts
// Query params: period (e.g., "2025-06"), clientId, organizationId (required)
// Tenant-scoped via client.firmId = organizationId.
export async function GET(request: Request) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    const orgResult = await requireOrgMembership(uid, organizationId)
    if (orgResult instanceof NextResponse) return orgResult
    const period = searchParams.get('period')
    const clientId = searchParams.get('clientId')
    // Tenant scope applied to every query below via client.firmId.
    const tenantWhere = { client: { firmId: organizationId! } }

    // Generate last 6 months of periods for consistent chart data
    const last6Months = getLastNMonths(6, period ?? undefined)

    // ── 1. Monthly Filing Volume ──────────────────────────────────────────
    // Array of { period, filed, pending, overdue } - last 6 months from GSTRFiling
    const allFilings = await db.gSTRFiling.findMany({
      where: { ...tenantWhere, ...(clientId ? { clientId } : {}) },
      select: { period: true, status: true },
    })

    const filingMap = new Map<string, { filed: number; pending: number; overdue: number }>()
    // Initialize all 6 months with zeros
    for (const p of last6Months) {
      filingMap.set(p, { filed: 0, pending: 0, overdue: 0 })
    }

    for (const f of allFilings) {
      const existing = filingMap.get(f.period)
      if (!existing) continue // skip filings outside the 6-month window
      if (f.status === 'filed') {
        existing.filed++
      } else if (isOverdue(f.period)) {
        existing.overdue++
      } else {
        existing.pending++
      }
    }

    const monthlyFilingVolume = last6Months.map((p) => ({
      period: p,
      ...filingMap.get(p)!,
    }))

    // ── 2. Tax Collected ──────────────────────────────────────────────────
    // Array of { period, cgst, sgst, igst, cess, total } - from Invoice sums
    const allInvoices = await db.invoice.findMany({
      where: {
        ...tenantWhere,
        ...(clientId ? { clientId } : {}),
        ...(period ? { period } : {}),
      },
      select: {
        period: true,
        cgst: true,
        sgst: true,
        igst: true,
        cess: true,
      },
    })

    const taxMap = new Map<string, { cgst: number; sgst: number; igst: number; cess: number; total: number }>()
    for (const inv of allInvoices) {
      const p = inv.period ?? 'unknown'
      const existing = taxMap.get(p) ?? { cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0 }
      existing.cgst += inv.cgst
      existing.sgst += inv.sgst
      existing.igst += inv.igst
      existing.cess += inv.cess
      existing.total += inv.cgst + inv.sgst + inv.igst + inv.cess
      taxMap.set(p, existing)
    }

    const taxCollected = Array.from(taxMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, data]) => ({ period: p, ...data }))

    // ── 3. Compliance Trend ──────────────────────────────────────────────
    // Array of { period, score } - from HealthScore or Client.healthScore averages
    const healthScores = await db.healthScore.findMany({
      where: { ...tenantWhere, ...(clientId ? { clientId } : {}) },
      select: { period: true, score: true },
    })

    const complianceMap = new Map<string, { totalScore: number; count: number }>()
    for (const hs of healthScores) {
      const p = hs.period ?? 'unknown'
      const existing = complianceMap.get(p) ?? { totalScore: 0, count: 0 }
      existing.totalScore += hs.score
      existing.count++
      complianceMap.set(p, existing)
    }

    let complianceTrend = Array.from(complianceMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, data]) => ({
        period: p,
        score: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
      }))

    // If no health scores recorded yet, compute from current client health scores
    if (complianceTrend.length === 0) {
      const clients = await db.client.findMany({
        where: { firmId: organizationId! },
        select: { healthScore: true },
      })
      const avgScore = clients.length > 0
        ? Math.round(clients.reduce((sum, c) => sum + c.healthScore, 0) / clients.length)
        : 0
      const currentPeriod = period ?? new Date().toISOString().slice(0, 7)
      complianceTrend = [{ period: currentPeriod, score: avgScore }]
    }

    // ── 4. Client Health Distribution ────────────────────────────────────
    // Array of { range, count } - bucket clients by healthScore ranges
    const clients = await db.client.findMany({
      where: { firmId: organizationId! },
      select: { healthScore: true },
    })

    const ranges = [
      { range: '0-20', min: 0, max: 20 },
      { range: '21-40', min: 21, max: 40 },
      { range: '41-60', min: 41, max: 60 },
      { range: '61-80', min: 61, max: 80 },
      { range: '81-100', min: 81, max: 100 },
    ]

    const clientHealthDistribution = ranges.map((r) => ({
      range: r.range,
      count: clients.filter((c) => c.healthScore >= r.min && c.healthScore <= r.max).length,
    }))

    // ── 5. Invoice Processing Volume ─────────────────────────────────────
    // Array of { period, total, validated, errors } - from Invoice counts
    const invoiceStats = await db.invoice.findMany({
      where: {
        ...tenantWhere,
        ...(clientId ? { clientId } : {}),
        ...(period ? { period } : {}),
      },
      select: {
        period: true,
        status: true,
        riskLevel: true,
      },
    })

    const invoiceVolumeMap = new Map<string, { total: number; validated: number; errors: number }>()
    for (const inv of invoiceStats) {
      const p = inv.period ?? 'unknown'
      const existing = invoiceVolumeMap.get(p) ?? { total: 0, validated: 0, errors: 0 }
      existing.total++
      if (inv.status === 'validated' || inv.status === 'approved') {
        existing.validated++
      }
      if (inv.riskLevel === 'high' || inv.riskLevel === 'critical') {
        existing.errors++
      }
      invoiceVolumeMap.set(p, existing)
    }

    const invoiceProcessingVolume = Array.from(invoiceVolumeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, data]) => ({ period: p, ...data }))

    // ── 6. Late Fee Exposure ─────────────────────────────────────────────
    // Array of { period, amount } - estimated from overdue filings
    const overdueFilings = await db.gSTRFiling.findMany({
      where: {
        ...tenantWhere,
        status: { not: 'filed' },
        ...(clientId ? { clientId } : {}),
      },
      select: {
        period: true,
        returnType: true,
      },
    })

    const lateFeeMap = new Map<string, { amount: number }>()
    const now = new Date()

    for (const f of overdueFilings) {
      if (!isOverdue(f.period)) continue

      const dueDate = new Date(getFilingDueDate(f.returnType, f.period))
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

      // Late fee calculation: ₹50/day for GSTR-1, ₹200/day for GSTR-3B, max ₹5,000
      const dailyRate = f.returnType === 'GSTR-3B' ? 200 : 50
      const maxFee = 5000
      const fee = Math.min(maxFee, daysOverdue * dailyRate)

      const existing = lateFeeMap.get(f.period) ?? { amount: 0 }
      existing.amount += fee
      lateFeeMap.set(f.period, existing)
    }

    const lateFeeExposure = Array.from(lateFeeMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([p, data]) => ({ period: p, ...data }))

    // ── Build response ───────────────────────────────────────────────────
    return NextResponse.json({
      monthlyFilingVolume,
      taxCollected,
      complianceTrend,
      clientHealthDistribution,
      invoiceProcessingVolume,
      lateFeeExposure,
    })
  } catch (error) {
    console.error('GET /api/analytics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}
