import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/data/reconciliations — list reconciliation runs (with their result counts)
//
//   Query params:
//     ?clientId=...&status=...&source=...(manual/gstn/excel/api)
//     ?limit=50&offset=0
//
//   Returns { reconciliations: [], total: 0 } on empty DB. NO fake data.
//
//   Note: ReconciliationRun does not have a direct relation to Client (the
//   clientId is just a String FK without a Prisma relation). We hydrate the
//   client trade name in a second pass so the consumer gets a friendly label.
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

    const [runs, total] = await Promise.all([
      db.reconciliationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          _count: { select: { results: true } },
        },
      }),
      db.reconciliationRun.count({ where }),
    ])

    // Hydrate client trade names in a single batched lookup (only the
    // distinct clientIds that appear in this page of results).
    const distinctClientIds = Array.from(
      new Set(runs.map((r) => r.clientId).filter((id): id is string => !!id)),
    )
    const clients =
      distinctClientIds.length > 0
        ? await db.client.findMany({
            where: { id: { in: distinctClientIds } },
            select: { id: true, tradeName: true, gstin: true },
          })
        : []
    const clientById = new Map(clients.map((c) => [c.id, c]))

    const reconciliations = runs.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      client: r.clientId ? clientById.get(r.clientId) ?? null : null,
      period: r.period,
      sources: r.sources,
      totalRecords: r.totalRecords,
      matched: r.matched,
      unmatched: r.unmatched,
      partialMatches: r.partialMatches,
      highRisk: r.highRisk,
      gstDifference: r.gstDifference,
      status: r.status,
      runBy: r.runBy,
      source: r.source,
      resultsCount: r._count.results,
      createdAt: r.createdAt,
    }))

    return NextResponse.json({ reconciliations, total })
  } catch (error) {
    console.error('[/api/data/reconciliations] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load reconciliations.' },
      { status: 500 },
    )
  }
}
