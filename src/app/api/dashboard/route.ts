import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { isOverdue, getFilingDueDate } from '@/lib/gst-utils'
import { getBusinessSnapshot } from '@/lib/business/snapshot'

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
//
// HEADLINE COUNT METRICS (totalClients / totalInvoices / filedReturns /
// pendingReturns / overdueReturns) are sourced from the canonical Business
// Snapshot — the single source of truth — so every page that displays these
// numbers shows the SAME value. Local Prisma reads remain for the unique
// metrics this endpoint exposes (criticalIssues, warnings, matchPercentage,
// riskPercentage, recentAuditLogs, filingCalendar, monthlyFilingStatus, and
// the per-client averageHealthScore — which is the AVERAGE of per-client GST
// data-quality scores, NOT the canonical org-level Health Score).

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

    // ── 1. Fetch the canonical Business Snapshot ──
    // Provides totalClients (customerCount), totalInvoices (invoiceCount),
    // filedReturns, pendingReturns, overdueReturns — sourced from native AND
    // Zoho-synced tables. The snapshot has a 30-second in-memory cache, so
    // reads are cheap.
    const snapshot = await getBusinessSnapshot(tenantId).catch((err) => {
      console.error('[/api/dashboard] getBusinessSnapshot failed:', err)
      return null
    })

    // ── 2. Headline count metrics from snapshot (fall back to 0 on failure) ──
    const totalClients = snapshot?.customerCount ?? 0
    const totalInvoices = snapshot?.invoiceCount ?? 0
    const filedReturns = snapshot?.filedReturns ?? 0
    const pendingReturns = snapshot?.pendingReturns ?? 0
    const overdueReturns = snapshot?.overdueReturns ?? 0

    // Prisma where-clause scoping by tenant. Client has firmId directly; the
    // other models reach it through the client relation.
    const clientWhere = { firmId: tenantId }
    const viaClient = { client: clientWhere }

    // ── 3. Unique-to-this-endpoint metrics (NOT in the snapshot) ─────────
    // - averageHealthScore: AVERAGE of per-client GST data-quality scores
    //   (different concept from the canonical org-level Health Score).
    // - criticalIssues / warnings: open Issue counts by severity.
    // - matchPercentage / riskPercentage: invoice reconciliation + risk.
    // - recentAuditLogs / filingCalendar / monthlyFilingStatus: detail rows.
    const [
      allClients,
      criticalIssues,
      warnings,
      matchedInvoices,
      perfectMatchInvoices,
      highRiskInvoices,
    ] = await Promise.all([
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
    ]);

    // ── Derived metrics ────────────────────────────────────────────────────
    // NOTE: `averageHealthScore` here is the AVERAGE of per-client GST
    // data-quality scores (set by /api/health-score). It is NOT the canonical
    // org-level Health Score (snapshot.healthScore) — different concept,
    // different scale. Kept as-is for backward compatibility with consumers
    // that display this number alongside the per-client list.
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
