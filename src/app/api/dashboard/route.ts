import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { isOverdue, getFilingDueDate } from '@/lib/gst-utils'

// GET /api/dashboard — Fetch dashboard metrics
export async function GET() {
  try {
    // ── Core counts ────────────────────────────────────────────────────────
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
      db.client.count(),
      db.invoice.count(),
      db.gSTRFiling.count({ where: { status: 'filed' } }),
      db.gSTRFiling.count({ where: { status: { not: 'filed' } } }),
      db.gSTRFiling.findMany({
        where: { status: { not: 'filed' } },
        select: { id: true, period: true, returnType: true, clientId: true },
      }),
      db.client.findMany({
        select: { id: true, healthScore: true },
      }),
      db.issue.count({ where: { severity: 'critical', status: 'open' } }),
      db.issue.count({ where: { severity: 'warning', status: 'open' } }),
      db.invoice.count({
        where: {
          matchStatus: { in: ['perfect_match', 'partial_match', 'mismatch'] },
        },
      }),
      db.invoice.count({ where: { matchStatus: 'perfect_match' } }),
      db.invoice.count({
        where: { riskLevel: { in: ['high', 'critical'] } },
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

    // ── Recent audit logs (last 10) ───────────────────────────────────────
    const recentAuditLogs = await db.auditLog.findMany({
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
    // Get all filings with their client info for calendar display
    const filingsWithClients = await db.gSTRFiling.findMany({
      where: { status: { not: 'filed' } },
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

    // ── Monthly filing status for chart ────────────────────────────────────
    // Get all filings grouped by period
    const allFilingsForChart = await db.gSTRFiling.findMany({
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
