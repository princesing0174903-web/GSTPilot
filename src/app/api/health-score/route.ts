import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { calculateHealthScore } from '@/lib/gst-utils'

// GET /api/health-score — Fetch health scores
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (clientId) {
      // Return latest score + trend for specific client
      const scores = await db.healthScore.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      })

      const latestScore = scores[0] ?? null

      // Calculate trend (comparing last 3 scores)
      const trend =
        scores.length >= 2
          ? scores.slice(0, Math.min(3, scores.length)).map((s) => ({
              score: s.score,
              period: s.period,
              createdAt: s.createdAt,
            }))
          : []

      // Dashboard aggregate metrics across all clients
      const allClients = await db.client.findMany({
        select: { id: true, healthScore: true },
      })
      const averageHealthScore =
        allClients.length > 0
          ? Math.round(allClients.reduce((sum, c) => sum + c.healthScore, 0) / allClients.length)
          : 0

      return NextResponse.json({
        clientId,
        latestScore,
        trend,
        aggregateMetrics: {
          totalClients: allClients.length,
          averageHealthScore,
        },
      })
    }

    // Return all health scores with client info
    const healthScores = await db.healthScore.findMany({
      orderBy: { createdAt: 'desc' },
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

    // Dashboard aggregate metrics
    const allClients = await db.client.findMany({
      select: { id: true, healthScore: true },
    })
    const averageHealthScore =
      allClients.length > 0
        ? Math.round(allClients.reduce((sum, c) => sum + c.healthScore, 0) / allClients.length)
        : 0

    return NextResponse.json({
      healthScores,
      aggregateMetrics: {
        totalClients: allClients.length,
        averageHealthScore,
      },
    })
  } catch (error) {
    console.error('GET /api/health-score error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch health scores' },
      { status: 500 }
    )
  }
}

// POST /api/health-score — Calculate and save health score for a client
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientId, period } = body

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      )
    }

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Fetch client's invoices
    const invoices = await db.invoice.findMany({
      where: { clientId },
    })

    // Calculate health score metrics
    const totalInvoices = invoices.length
    const missingGstin = invoices.filter((inv) => !inv.buyerGstin).length
    const invalidGstin = invoices.filter((inv) => {
      if (!inv.buyerGstin) return false
      const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
      return !regex.test(inv.buyerGstin.toUpperCase())
    }).length

    // Detect duplicate invoices (same invoiceNumber + sellerGstin)
    const seen = new Map<string, number>()
    let duplicateInvoices = 0
    for (const inv of invoices) {
      const key = `${inv.invoiceNumber}-${inv.sellerGstin}`
      const count = seen.get(key) ?? 0
      if (count > 0) duplicateInvoices++
      seen.set(key, count + 1)
    }

    // Check for filing delays
    const filings = await db.gSTRFiling.findMany({
      where: { clientId, status: { not: 'filed' } },
    })
    const filingDelays = filings.filter((f) => {
      const [year, month] = f.period.split('-').map(Number)
      const dueDate = new Date(year, month, 11)
      return new Date() > dueDate
    }).length

    // Count validation errors from issues
    const validationErrors = await db.issue.count({
      where: {
        clientId,
        status: 'open',
        category: { in: ['Invalid GSTIN', 'Tax Mismatch', 'GST Mismatch'] },
      },
    })

    // Calculate score using the utility function
    const score = calculateHealthScore({
      totalInvoices,
      missingGstin,
      invalidGstin,
      duplicateInvoices,
      filingDelays,
      validationErrors,
    })

    // Save health score record
    const healthScore = await db.healthScore.create({
      data: {
        clientId,
        score,
        missingGstin,
        invalidGstin,
        duplicateInvoices,
        filingDelays,
        validationErrors,
        period: period ?? new Date().toISOString().slice(0, 7),
      },
    })

    // Update client's health score
    await db.client.update({
      where: { id: clientId },
      data: { healthScore: score },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId,
        action: 'Health Score Calculated',
        entity: 'health_score',
        entityId: healthScore.id,
        details: `Health score calculated: ${score}/100 for ${client.tradeName}`,
      },
    })

    return NextResponse.json({ healthScore }, { status: 201 })
  } catch (error) {
    console.error('POST /api/health-score error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate health score' },
      { status: 500 }
    )
  }
}
