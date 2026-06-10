import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

function generateInsights(data: {
  revenue: { period: string; totalRevenue: number }[]
  clientGrowth: { month: string; count: number }[]
  gstProcessed: number
  teamUtilization: number
  profitability: number
  activeClients: number
}): string[] {
  const insights: string[] = []

  // Revenue trend insight
  if (data.revenue.length >= 2) {
    const latest = data.revenue[data.revenue.length - 1]?.totalRevenue ?? 0
    const previous = data.revenue[data.revenue.length - 2]?.totalRevenue ?? 0
    if (previous > 0) {
      const change = ((latest - previous) / previous) * 100
      if (change > 10) {
        insights.push(`Revenue is trending up by ${change.toFixed(1)}% compared to the previous period. Consider scaling operations to maintain momentum.`)
      } else if (change < -10) {
        insights.push(`Revenue declined by ${Math.abs(change).toFixed(1)}% compared to the previous period. Review client retention and new acquisition strategies.`)
      } else {
        insights.push(`Revenue is stable with a ${change >= 0 ? '+' : ''}${change.toFixed(1)}% change. Focus on identifying growth opportunities.`)
      }
    }
  }

  // Client growth insight
  if (data.clientGrowth.length >= 2) {
    const latestCount = data.clientGrowth[data.clientGrowth.length - 1]?.count ?? 0
    const prevCount = data.clientGrowth[data.clientGrowth.length - 2]?.count ?? 0
    if (latestCount > prevCount) {
      insights.push(`Client base grew by ${latestCount - prevCount} new clients. Ensure onboarding processes can handle increased volume.`)
    } else if (latestCount <= prevCount && data.activeClients > 0) {
      insights.push(`Client growth has plateaued. Consider proactive outreach campaigns to attract new business.`)
    }
  }

  // GST processing insight
  if (data.gstProcessed > 0) {
    insights.push(`Total GST processed: ₹${data.gstProcessed.toLocaleString()}. Monitor for compliance accuracy as volume scales.`)
  }

  // Team utilization insight
  if (data.teamUtilization > 0) {
    if (data.teamUtilization > 85) {
      insights.push(`Team utilization at ${data.teamUtilization.toFixed(1)}% — approaching burnout risk. Consider redistributing workload or hiring additional staff.`)
    } else if (data.teamUtilization < 50) {
      insights.push(`Team utilization is low at ${data.teamUtilization.toFixed(1)}%. Explore automation opportunities to better allocate resources.`)
    } else {
      insights.push(`Team utilization is healthy at ${data.teamUtilization.toFixed(1)}%. Maintain current workload balance.`)
    }
  }

  // Profitability insight
  if (data.profitability > 0) {
    if (data.profitability > 30) {
      insights.push(`Profitability is strong at ${data.profitability.toFixed(1)}%. Reinvest in technology and training to sustain margins.`)
    } else if (data.profitability < 15) {
      insights.push(`Profitability at ${data.profitability.toFixed(1)}% is below optimal. Review pricing strategy and operational costs.`)
    }
  }

  // Ensure at least 3 insights
  if (insights.length < 3) {
    insights.push('Set up regular FirmMetrics tracking to unlock deeper AI-driven insights for your practice.')
  }

  return insights.slice(0, 5)
}

// GET /api/executive-analytics — Return comprehensive analytics
export async function GET() {
  try {
    // Try to get FirmMetrics data first
    const firmMetrics = await db.firmMetrics.findMany({
      orderBy: { period: 'desc' },
      take: 12,
    })

    let monthlyRevenue: { period: string; totalRevenue: number }[] = []
    let clientGrowth: { month: string; count: number }[] = []
    let gstProcessed = 0
    let teamUtilization = 0
    let profitability = 0
    let activeClients = 0
    let employeeProductivity: {
      id: string
      name: string
      period: string
      invoicesProcessed: number
      reviewsCompleted: number
      approvalsCompleted: number
      averageAccuracy: number
      averageTurnaround: number
      totalActions: number
      score: number
    }[] = []

    if (firmMetrics.length > 0) {
      // Use FirmMetrics data
      monthlyRevenue = firmMetrics
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((m) => ({
          period: m.period,
          totalRevenue: m.totalRevenue,
        }))

      gstProcessed = firmMetrics.reduce((sum, m) => sum + m.gstProcessed, 0)
      teamUtilization = firmMetrics[0]?.teamUtilization ?? 0
      profitability = firmMetrics[0]?.profitability ?? 0
      activeClients = firmMetrics[0]?.activeClients ?? 0

      // Client growth from FirmMetrics
      clientGrowth = firmMetrics
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((m) => ({
          month: m.period,
          count: m.activeClients,
        }))
    } else {
      // Calculate from raw data when no FirmMetrics exist

      // Revenue from Invoices - group by period
      const invoices = await db.invoice.findMany({
        select: { period: true, totalAmount: true, createdAt: true },
      })

      const revenueByPeriod: Record<string, number> = {}
      for (const inv of invoices) {
        const periodKey = inv.period || inv.createdAt.toISOString().slice(0, 7)
        revenueByPeriod[periodKey] = (revenueByPeriod[periodKey] || 0) + inv.totalAmount
      }

      monthlyRevenue = Object.entries(revenueByPeriod)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([period, totalRevenue]) => ({ period, totalRevenue }))

      // Client growth - count by month
      const clients = await db.client.findMany({
        select: { createdAt: true, status: true },
      })

      const clientsByMonth: Record<string, number> = {}
      let runningCount = 0
      const sortedClients = [...clients].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )
      for (const c of sortedClients) {
        const month = c.createdAt.toISOString().slice(0, 7)
        runningCount++
        clientsByMonth[month] = runningCount
      }

      clientGrowth = Object.entries(clientsByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, count]) => ({ month, count }))

      activeClients = clients.filter((c) => c.status === 'active').length
      gstProcessed = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
    }

    // Employee productivity from TeamPerformance
    const teamPerformances = await db.teamPerformance.findMany({
      include: {
        teamMember: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    employeeProductivity = teamPerformances.map((tp) => ({
      id: tp.id,
      name: tp.teamMember.name,
      period: tp.period,
      invoicesProcessed: tp.invoicesProcessed,
      reviewsCompleted: tp.reviewsCompleted,
      approvalsCompleted: tp.approvalsCompleted,
      averageAccuracy: tp.averageAccuracy,
      averageTurnaround: tp.averageTurnaround,
      totalActions: tp.totalActions,
      score: tp.score,
    }))

    // Calculate team utilization from performance data if not from FirmMetrics
    if (teamUtilization === 0 && teamPerformances.length > 0) {
      const avgScore = teamPerformances.reduce((sum, tp) => sum + tp.score, 0) / teamPerformances.length
      teamUtilization = Math.min(avgScore, 100)
    }

    // Profitability metrics
    const profitabilityMetrics = firmMetrics.length > 0
      ? firmMetrics
          .sort((a, b) => a.period.localeCompare(b.period))
          .slice(-12)
          .map((m) => ({
            period: m.period,
            profitability: m.profitability,
            totalRevenue: m.totalRevenue,
            mrr: m.mrr,
            arr: m.arr,
          }))
      : monthlyRevenue.map((r) => ({
          period: r.period,
          profitability: 0,
          totalRevenue: r.totalRevenue,
          mrr: r.totalRevenue,
          arr: r.totalRevenue * 12,
        }))

    // Generate AI insights
    const aiInsights = generateInsights({
      revenue: monthlyRevenue,
      clientGrowth,
      gstProcessed,
      teamUtilization,
      profitability,
      activeClients,
    })

    return NextResponse.json({
      monthlyRevenue,
      clientGrowth,
      gstProcessed,
      teamUtilization,
      profitability,
      activeClients,
      employeeProductivity,
      profitabilityMetrics,
      aiInsights,
    })
  } catch (error) {
    console.error('GET /api/executive-analytics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch executive analytics' },
      { status: 500 }
    )
  }
}
