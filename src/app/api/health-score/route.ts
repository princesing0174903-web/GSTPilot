import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { calculateGSTDataQualityScore, validateGSTIN } from '@/lib/gst-utils'

// GET /api/health-score?clientId=X — Calculate and return health score for a client
// Query param: clientId (required)
// Returns { score, breakdown: { missingGstin, invalidGstin, duplicateInvoices, filingDelays, validationErrors } }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

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

    // Count invoices with missing GSTIN (no buyerGstin)
    const missingGstin = invoices.filter((inv) => !inv.buyerGstin).length

    // Count invoices with invalid GSTIN
    const invalidGstin = invoices.filter((inv) => {
      if (!inv.buyerGstin) return false
      return !validateGSTIN(inv.buyerGstin)
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

    // Check for filing delays (filings that are not filed and past due date)
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

    // Calculate score using the GST data-quality utility (renamed from
    // calculateHealthScore — see AUDIT-DUP-1 + task HEALTH-ENGINE). The
    // CANONICAL business Health Score lives in src/lib/business/snapshot.ts;
    // this route computes a per-client GST data quality score, which is a
    // DIFFERENT concept.
    const score = calculateGSTDataQualityScore({
      totalInvoices: invoices.length,
      missingGstin,
      invalidGstin,
      duplicateInvoices,
      filingDelays,
      validationErrors,
    })

    // Update the client's healthScore field
    await db.client.update({
      where: { id: clientId },
      data: { healthScore: score },
    })

    // Create or update HealthScore record
    const currentPeriod = new Date().toISOString().slice(0, 7)

    // Check if a HealthScore record already exists for this client and period
    const existingScore = await db.healthScore.findFirst({
      where: {
        clientId,
        period: currentPeriod,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existingScore) {
      // Update existing record
      await db.healthScore.update({
        where: { id: existingScore.id },
        data: {
          score,
          missingGstin,
          invalidGstin,
          duplicateInvoices,
          filingDelays,
          validationErrors,
        },
      })
    } else {
      // Create new record
      await db.healthScore.create({
        data: {
          clientId,
          score,
          missingGstin,
          invalidGstin,
          duplicateInvoices,
          filingDelays,
          validationErrors,
          period: currentPeriod,
        },
      })
    }

    return NextResponse.json({
      score,
      breakdown: {
        missingGstin,
        invalidGstin,
        duplicateInvoices,
        filingDelays,
        validationErrors,
      },
    })
  } catch (error) {
    console.error('GET /api/health-score error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate health score' },
      { status: 500 }
    )
  }
}
