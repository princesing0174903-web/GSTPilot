import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/reconciliation — Fetch reconciliation results with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const matchStatus = searchParams.get('matchStatus')
    const resolved = searchParams.get('resolved')

    const where: Record<string, unknown> = {}

    if (clientId) where.clientId = clientId
    if (matchStatus) where.matchStatus = matchStatus
    if (resolved !== null && resolved !== undefined && resolved !== '') {
      where.resolved = resolved === 'true'
    }

    const results = await db.reconciliationResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: {
          include: {
            client: {
              select: {
                id: true,
                tradeName: true,
                gstin: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error('GET /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reconciliation results' },
      { status: 500 }
    )
  }
}

// POST /api/reconciliation — Create reconciliation result or run reconciliation for a client
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // If clientId is provided with action=run, run reconciliation for the client
    if (body.action === 'run' && body.clientId) {
      const { clientId } = body

      // Verify client exists
      const client = await db.client.findUnique({ where: { id: clientId } })
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      // Fetch all invoices for this client that are not already reconciled
      const invoices = await db.invoice.findMany({
        where: { clientId },
      })

      if (invoices.length === 0) {
        return NextResponse.json(
          { error: 'No invoices found for this client' },
          { status: 400 }
        )
      }

      const results: Awaited<ReturnType<typeof db.reconciliationResult.create>>[] = []

      // Compare invoices against each other to find potential matches
      // In a real system, this would compare books vs GSTR data
      // Here we compare invoices with the same buyerGstin and period
      for (let i = 0; i < invoices.length; i++) {
        const inv = invoices[i]

        // Skip invoices that already have a reconciliation result
        const existingResult = await db.reconciliationResult.findFirst({
          where: { invoiceId: inv.id },
        })
        if (existingResult) continue

        // Look for potential matching invoices (same buyer, same period)
        const potentialMatches = invoices.filter(
          (other, idx) =>
            idx !== i &&
            other.buyerGstin === inv.buyerGstin &&
            other.period === inv.period &&
            other.invoiceType === inv.invoiceType
        )

        let matchStatus: string
        let matchScore: number
        let mismatches: string | null = null
        let aiExplanation: string | null = null

        if (potentialMatches.length > 0) {
          const match = potentialMatches[0]
          const amountDiff = Math.abs(inv.totalAmount - match.totalAmount)
          const taxDiff = Math.abs((inv.cgst + inv.sgst + inv.igst) - (match.cgst + match.sgst + match.igst))

          if (amountDiff === 0 && taxDiff === 0) {
            matchStatus = 'perfect_match'
            matchScore = 100
          } else if (amountDiff <= inv.totalAmount * 0.1 && taxDiff <= (inv.cgst + inv.sgst + inv.igst) * 0.1) {
            matchStatus = 'partial_match'
            matchScore = 70
            const mismatchFields: { field: string; books: number; gstr: number }[] = []
            if (amountDiff > 0) mismatchFields.push({ field: 'totalAmount', books: inv.totalAmount, gstr: match.totalAmount })
            if (taxDiff > 0) mismatchFields.push({ field: 'tax', books: inv.cgst + inv.sgst + inv.igst, gstr: match.cgst + match.sgst + match.igst })
            mismatches = JSON.stringify(mismatchFields)
            aiExplanation = `Partial match detected — amount difference: ₹${amountDiff.toFixed(2)}, tax difference: ₹${taxDiff.toFixed(2)}. Review recommended.`
          } else {
            matchStatus = 'mismatch'
            matchScore = 30
            const mismatchFields = [
              { field: 'totalAmount', books: inv.totalAmount, gstr: match.totalAmount },
              { field: 'tax', books: inv.cgst + inv.sgst + inv.igst, gstr: match.cgst + match.sgst + match.igst },
            ]
            mismatches = JSON.stringify(mismatchFields)
            aiExplanation = `Significant mismatch — amount difference: ₹${amountDiff.toFixed(2)}, tax difference: ₹${taxDiff.toFixed(2)}. Manual review required.`
          }
        } else {
          // No matching invoice found
          matchStatus = 'missing_in_gstr'
          matchScore = 0
          aiExplanation = `No matching entry found for this invoice in the comparison data. May require reporting or verification.`
        }

        // Update invoice match status
        await db.invoice.update({
          where: { id: inv.id },
          data: { matchStatus },
        })

        const result = await db.reconciliationResult.create({
          data: {
            clientId,
            invoiceId: inv.id,
            sourceType: 'books',
            sourceGstin: inv.sellerGstin,
            matchedGstin: inv.buyerGstin,
            matchStatus,
            matchScore,
            mismatches,
            aiExplanation,
          },
        })

        results.push(result)
      }

      // Create audit log
      await db.auditLog.create({
        data: {
          clientId,
          action: 'Reconciliation Run',
          entity: 'reconciliation',
          details: `Reconciliation run completed for ${client.tradeName} — ${results.length} results generated`,
        },
      })

      return NextResponse.json({
        message: `Reconciliation completed — ${results.length} results generated`,
        results,
      })
    }

    // Otherwise, create a single reconciliation result
    const {
      clientId,
      invoiceId,
      sourceType,
      sourceGstin,
      matchedGstin,
      matchStatus,
      matchScore,
      mismatches,
      aiExplanation,
    } = body

    if (!clientId || !invoiceId) {
      return NextResponse.json(
        { error: 'clientId and invoiceId are required' },
        { status: 400 }
      )
    }

    const result = await db.reconciliationResult.create({
      data: {
        clientId,
        invoiceId,
        sourceType: sourceType ?? 'books',
        sourceGstin: sourceGstin ?? null,
        matchedGstin: matchedGstin ?? null,
        matchStatus: matchStatus ?? 'unmatched',
        matchScore: matchScore ?? 0,
        mismatches: mismatches ?? null,
        aiExplanation: aiExplanation ?? null,
      },
    })

    return NextResponse.json({ result }, { status: 201 })
  } catch (error) {
    console.error('POST /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process reconciliation' },
      { status: 500 }
    )
  }
}

// PUT /api/reconciliation — Resolve a reconciliation result
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, resolvedBy } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.reconciliationResult.findUnique({
      where: { id },
      include: { invoice: { include: { client: true } } },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Reconciliation result not found' },
        { status: 404 }
      )
    }

    const result = await db.reconciliationResult.update({
      where: { id },
      data: {
        resolved: true,
        resolvedBy: resolvedBy ?? null,
        resolvedAt: new Date().toISOString().split('T')[0],
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'Reconciliation Resolved',
        entity: 'reconciliation',
        entityId: id,
        details: `Reconciliation result resolved for invoice ${existing.invoice?.invoiceNumber ?? id}`,
      },
    })

    return NextResponse.json({ result })
  } catch (error) {
    console.error('PUT /api/reconciliation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve reconciliation' },
      { status: 500 }
    )
  }
}
