import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/firm-metrics — Return latest FirmMetrics
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')

    if (period) {
      const metrics = await db.firmMetrics.findUnique({ where: { period } })
      if (!metrics) {
        return NextResponse.json(
          { error: 'No metrics found for the specified period' },
          { status: 404 }
        )
      }
      return NextResponse.json({ metrics })
    }

    // Return latest metrics
    const metrics = await db.firmMetrics.findFirst({
      orderBy: { period: 'desc' },
    })

    if (!metrics) {
      return NextResponse.json({ metrics: null })
    }

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('GET /api/firm-metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch firm metrics' },
      { status: 500 }
    )
  }
}

// POST /api/firm-metrics — Create/update FirmMetrics for a period (upsert)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      period,
      totalRevenue,
      mrr,
      arr,
      clientsOnboarded,
      activeClients,
      inactiveClients,
      teamUtilization,
      avgProcessingTime,
      avgFilingTime,
      gstProcessed,
      profitability,
      clientGrowth,
    } = body

    if (!period) {
      return NextResponse.json(
        { error: 'period is required' },
        { status: 400 }
      )
    }

    const metrics = await db.firmMetrics.upsert({
      where: { period },
      update: {
        ...(totalRevenue !== undefined && { totalRevenue }),
        ...(mrr !== undefined && { mrr }),
        ...(arr !== undefined && { arr }),
        ...(clientsOnboarded !== undefined && { clientsOnboarded }),
        ...(activeClients !== undefined && { activeClients }),
        ...(inactiveClients !== undefined && { inactiveClients }),
        ...(teamUtilization !== undefined && { teamUtilization }),
        ...(avgProcessingTime !== undefined && { avgProcessingTime }),
        ...(avgFilingTime !== undefined && { avgFilingTime }),
        ...(gstProcessed !== undefined && { gstProcessed }),
        ...(profitability !== undefined && { profitability }),
        ...(clientGrowth !== undefined && { clientGrowth }),
      },
      create: {
        period,
        totalRevenue: totalRevenue ?? 0,
        mrr: mrr ?? 0,
        arr: arr ?? 0,
        clientsOnboarded: clientsOnboarded ?? 0,
        activeClients: activeClients ?? 0,
        inactiveClients: inactiveClients ?? 0,
        teamUtilization: teamUtilization ?? 0,
        avgProcessingTime: avgProcessingTime ?? 0,
        avgFilingTime: avgFilingTime ?? 0,
        gstProcessed: gstProcessed ?? 0,
        profitability: profitability ?? 0,
        clientGrowth: clientGrowth ?? 0,
      },
    })

    return NextResponse.json({ metrics })
  } catch (error) {
    console.error('POST /api/firm-metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create/update firm metrics' },
      { status: 500 }
    )
  }
}
