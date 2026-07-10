import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { isOverdue, getFilingDueDate } from '@/lib/gst-utils'

// ─── Multi-tenant scoping ───────────────────────────────────────────────────
// LEGACY NOTE: The Prisma models here (Client / Invoice / GSTRFiling / Issue /
// AuditLog) are scoped by `Client.firmId` (a nullable String?). The modern
// org model uses `organizationId` (Firestore). There is no firmId↔organizationId
// mapping yet — for THIS sprint, the pragmatic defensive fix is to accept
// either `?organizationId=` or `?firmId=` as a query param and treat the value
// as the tenant id (the orgId IS the firmId in this app's current state).
// If neither param is provided, we return ZERO/EMPTY metrics instead of
// leaking platform-wide aggregates.
//
// Invoices / GSTRFilings / Issues / AuditLogs do NOT carry `firmId` directly —
// they all relate through `clientId`. So scoping by tenant means filtering on
// `client: { firmId: <tenantId> }`.

function emptyDashboard() {
  return {
    totalClients: 0,
    totalInvoices: 0,
    filedReturns: 0,
    pendingReturns: 0,
    overdueReturns: 0,
    averageHealthScore: 0,
    criticalIssues: 0,
    warnings: 0,
    matchPercentage: 0,
    riskPercentage: 0,
    recentAuditLogs: [],
    filingCalendar: [],
    monthlyFilingStatus: [],
  }
}

// GET /api/dashboard — Fetch dashboard metrics (tenant-scoped)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    // Accept either organizationId (modern) or firmId (legacy) — they are the
    // same tenant identifier in this app's current state.
    const tenantId = searchParams.get('organizationId') || searchParams.get('firmId')

    // ── Defensive empty-state: no tenant scope → no data ──
    if (!tenantId) {
      return NextResponse.json(emptyDashboard())
    }

    // Prisma where-clause scoping by tenant. Client has firmId directly; the
    // other models reach it through the client relation.
    const clientWhere = { firmId: tenantId }
    const viaClient = { client: clientWhere }

    // ── Core counts (all scoped by tenant) ────────────────────────────────
    const [
      totalClients,
      totalInvoices,
      filedReturns,
      pendingReturns,
      allFilings,
      allClients,
      criticalIssues,
      warnings,
      matchedInvoices,
      perfectMatchInvoices,
      highRiskInvoices,
    ] = await Promise.all([
      db.client.count({ where: clientWhere }),
      db.invoice.count({ where: viaClient }),
      db.gSTRFiling.count({ where: { ...viaClient, status: 'filed' } }),
      db.gSTRFiling.count({ where: { ...viaClient, status: { not: 'filed' } } }),
      db.gSTRFiling.findMany({
        where: { ...viaClient, status: { not: 'filed' } },
        select: { id: true, period: true, returnType: true, clientId: true },
      }),
      db.client.findMany({
        where: clientWhere,
        select: { id: true, healthScore: true },
      }),
      db.issue.count({ where: { ...viaClient, severity: 'critical', status: 'open' } }),
      db.issue.count({ where: { ...viaClient, severity: 'warning', status: 'open' } }),
      db.invoice.count({
        where: {
          ...viaClient,
          matchStatus: { in: ['perfect_match', 'partial_match', 'mismatch'] },
        },
      }),
      db.invoice.count({ where: { ...viaClient, matchStatus: 'perfect_match' } }),
      db.invoice.count({
        where: { ...viaClient, riskLevel: { in: ['high', 'critical'] } },
      }),
    ])

    // ── Derived metrics ────────────────────────────────────────────────────
    const averageHealthScore =
      allClients.length > 0
        ? Math.round(
            allClients.reduce((sum, c) => sum + c.healthScore, 0) / allClients.length
          )
        : 0

    const matchPercentage =
      matchedInvoices > 0
        ? Math.round((perfectMatchInvoices / matchedInvoices) * 100)
        : 0

    const riskPercentage =
      totalInvoices > 0
        ? Math.round((highRiskInvoices / totalInvoices) * 100)
        : 0

    // Overdue returns
    const overdueReturns = allFilings.filter((f) => isOverdue(f.period)).length

    // ── Recent audit logs (last 10, tenant-scoped) ───────────────────────
    const recentAuditLogs = await db.auditLog.findMany({
      where: viaClient,
      take: 10,
      orderBy: { timestamp: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
          },
        },
      },
    })

    // ── Filing calendar items (upcoming due dates) ─────────────────────────
    const filingsWithClients = await db.gSTRFiling.findMany({
      where: { ...viaClient, status: { not: 'filed' } },
      select: {
        id: true,
        returnType: true,
        period: true,
        status: true,
        clientId: true,
        client: {
          select: { tradeName: true },
        },
      },
      orderBy: { period: 'asc' },
    })

    const filingCalendar = filingsWithClients.map((f) => {
      const dueDate = getFilingDueDate(f.returnType, f.period)
      const overdue = isOverdue(f.period)
      let calendarStatus: 'filed' | 'pending' | 'overdue' | 'upcoming'

      if (f.status === 'filed') {
        calendarStatus = 'filed'
      } else if (overdue) {
        calendarStatus = 'overdue'
      } else {
        calendarStatus = 'pending'
      }

      return {
        id: f.id,
        returnType: f.returnType,
        period: f.period,
        dueDate,
        status: calendarStatus,
        clientId: f.clientId,
        clientName: f.client.tradeName,
      }
    })

    // ── Monthly filing status for chart (tenant-scoped) ────────────────────
    const allFilingsForChart = await db.gSTRFiling.findMany({
      where: viaClient,
      select: {
        period: true,
        status: true,
      },
    })

    // Group by period
    const periodMap = new Map<
      string,
      { filed: number; pending: number; overdue: number }
    >()

    for (const f of allFilingsForChart) {
      const existing = periodMap.get(f.period) ?? { filed: 0, pending: 0, overdue: 0 }
      if (f.status === 'filed') {
        existing.filed++
      } else if (isOverdue(f.period)) {
        existing.overdue++
      } else {
        existing.pending++
      }
      periodMap.set(f.period, existing)
    }

    const monthlyFilingStatus = Array.from(periodMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => ({
        period,
        ...counts,
      }))

    // ── Build response ─────────────────────────────────────────────────────
    const dashboard = {
      totalClients,
      totalInvoices,
      filedReturns,
      pendingReturns,
      overdueReturns,
      averageHealthScore,
      criticalIssues,
      warnings,
      matchPercentage,
      riskPercentage,
      recentAuditLogs,
      filingCalendar,
      monthlyFilingStatus,
    }

    return NextResponse.json(dashboard)
  } catch (error) {
    console.error('GET /api/dashboard error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch dashboard metrics' },
      { status: 500 }
    )
  }
}
