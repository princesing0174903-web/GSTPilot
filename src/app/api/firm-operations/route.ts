import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/firm-operations — Firm operations metrics
export async function GET() {
  try {
    // Try to get the latest FirmMetrics record
    const latestMetrics = await db.firmMetrics.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    if (latestMetrics) {
      // Also get live client counts to supplement metrics
      const activeClients = await db.client.count({ where: { status: 'active' } })
      const inactiveClients = await db.client.count({ where: { status: 'inactive' } })
      const totalClients = await db.client.count()

      return NextResponse.json({
        metrics: {
          totalRevenue: latestMetrics.totalRevenue,
          mrr: latestMetrics.mrr,
          arr: latestMetrics.arr,
          clientsOnboarded: latestMetrics.clientsOnboarded,
          activeClients,
          inactiveClients,
          totalClients,
          teamUtilization: latestMetrics.teamUtilization,
          avgProcessingTime: latestMetrics.avgProcessingTime,
          avgFilingTime: latestMetrics.avgFilingTime,
          gstProcessed: latestMetrics.gstProcessed,
          profitability: latestMetrics.profitability,
          clientGrowth: latestMetrics.clientGrowth,
          period: latestMetrics.period,
          recordedAt: latestMetrics.createdAt,
        },
      })
    }

    // No FirmMetrics exist — calculate from existing data
    const totalRevenueResult = await db.invoice.aggregate({
      _sum: { totalAmount: true },
    })
    const totalRevenue = totalRevenueResult._sum.totalAmount ?? 0

    const activeClients = await db.client.count({ where: { status: 'active' } })
    const inactiveClients = await db.client.count({ where: { status: 'inactive' } })
    const totalClients = await db.client.count()

    // Team utilization: completed assignments / total assignments * 100
    const totalAssignments = await db.workloadAssignment.count()
    const completedAssignments = await db.workloadAssignment.count({
      where: { status: 'completed' },
    })
    const teamUtilization =
      totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 10000) / 100
        : 0

    // Average turnaround from team performance
    const avgTurnaroundResult = await db.teamPerformance.aggregate({
      _avg: { averageTurnaround: true },
    })
    const avgProcessingTime = avgTurnaroundResult._avg.averageTurnaround ?? 0

    // Average filing time: compute from GSTR filings that have been filed
    const filedCount = await db.gSTRFiling.count({ where: { status: 'filed' } })
    const avgFilingTime = filedCount > 0 ? avgProcessingTime : 0

    // MRR/ARR estimates based on revenue
    const clientCount = Math.max(activeClients, 1)
    const mrr = totalRevenue / 12
    const arr = totalRevenue

    return NextResponse.json({
      metrics: {
        totalRevenue,
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(arr * 100) / 100,
        clientsOnboarded: totalClients,
        activeClients,
        inactiveClients,
        totalClients,
        teamUtilization,
        avgProcessingTime,
        avgFilingTime,
        gstProcessed: totalRevenue,
        profitability: 0,
        clientGrowth: 0,
        period: null,
        recordedAt: null,
      },
    })
  } catch (error) {
    console.error('GET /api/firm-operations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch firm operations metrics' },
      { status: 500 }
    )
  }
}
