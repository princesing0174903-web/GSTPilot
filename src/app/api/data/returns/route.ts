import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/data/returns — list GSTR filings
//
//   Query params:
//     ?clientId=...&status=...&source=...(manual/gstn)
//     ?limit=50&offset=0
//
//   Maps GSTRFiling → a return-shaped response. Returns { returns: [], total: 0 }
//   on empty DB. NO fake data.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const source = url.searchParams.get('source') ?? undefined
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    const where: {
      clientId?: string
      status?: string
      source?: string
    } = {}
    if (clientId) where.clientId = clientId
    if (status) where.status = status
    if (source) where.source = source

    const [filings, total] = await Promise.all([
      db.gSTRFiling.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          client: { select: { id: true, tradeName: true, gstin: true } },
        },
      }),
      db.gSTRFiling.count({ where }),
    ])

    // Map GSTRFiling → return shape
    const returns = filings.map((f) => ({
      id: f.id,
      clientId: f.clientId,
      client: f.client,
      returnType: f.returnType,
      period: f.period,
      financialYear: f.financialYear,
      status: f.status,
      filedDate: f.filedDate,
      acknowledgmentNumber: f.acknowledgmentNumber,
      totalInvoices: f.totalInvoices,
      readyForFiling: f.readyForFiling,
      issuesFound: f.issuesFound,
      criticalErrors: f.criticalErrors,
      warnings: f.warnings,
      totalTaxableValue: f.totalTaxableValue,
      totalTax: f.totalTax,
      source: f.source,
      sourceRef: f.sourceRef,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }))

    return NextResponse.json({ returns, total })
  } catch (error) {
    console.error('[/api/data/returns] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load returns.' },
      { status: 500 },
    )
  }
}
