import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { calculateGSTDataQualityScore, validateGSTIN } from '@/lib/gst-utils'

// GET /api/health-score?clientId=X              — Calculate and return health score for a client
// GET /api/health-score?clientId=X& trend=1     — Also return historical trend (HealthScore records)
// GET /api/health-score?trends=1                — Return trend sparkline data for ALL clients (bulk)
// GET /api/health-score                         — Return list of all clients with current health scores
//
// Returns { score, breakdown: {...} } for single client
// Returns { score, breakdown, trend: [{score,period,createdAt}] } when trend=1
// Returns { trends: { [clientId]: [{score,period}] } } when trends=1 (bulk)
// Returns { clients: [{id, tradeName, gstin, healthScore, state}] } when no params
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const wantTrend = searchParams.get('trend') === '1'
    const bulkTrends = searchParams.get('trends') === '1'

    // ── Bulk trend endpoint: sparkline data for every client ──
    // Returns the last 6 HealthScore records (oldest → newest) per client.
    // Used by ClientHealthPage to render real sparklines instead of Math.random().
    if (bulkTrends) {
      const allScores = await db.healthScore.findMany({
        orderBy: { createdAt: 'desc' },
        take: 600, // cap: ~6 months × 100 clients
        select: {
          clientId: true,
          score: true,
          period: true,
          createdAt: true,
        },
      });
      // Group by clientId, keep last 6, reverse to chronological order
      const byClient = new Map<string, { score: number; period: string | null; createdAt: string }[]>();
      for (const s of allScores) {
        let arr = byClient.get(s.clientId);
        if (!arr) { arr = []; byClient.set(s.clientId, arr); }
        if (arr.length < 6) arr.push({ score: s.score, period: s.period, createdAt: s.createdAt.toISOString() });
      }
      const trends: Record<string, { score: number; period: string | null; createdAt: string }[]> = {};
      for (const [cid, arr] of byClient.entries()) {
        trends[cid] = arr.reverse();
      }
      return NextResponse.json({ trends });
    }

    // ── List endpoint: all clients with current health scores ──
    if (!clientId) {
      const clients = await db.client.findMany({
        select: {
          id: true,
          tradeName: true,
          gstin: true,
          healthScore: true,
          state: true,
          status: true,
        },
        orderBy: { healthScore: 'asc' },
      });
      return NextResponse.json({ clients });
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

    // If trend requested, fetch historical HealthScore records (last 6, chronological)
    if (wantTrend) {
      const history = await db.healthScore.findMany({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          score: true,
          period: true,
          createdAt: true,
        },
      });
      const trend = history.reverse().map((h) => ({
        score: h.score,
        period: h.period,
        createdAt: h.createdAt.toISOString(),
      }));
      return NextResponse.json({
        score,
        breakdown: {
          missingGstin,
          invalidGstin,
          duplicateInvoices,
          filingDelays,
          validationErrors,
        },
        trend,
      });
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
