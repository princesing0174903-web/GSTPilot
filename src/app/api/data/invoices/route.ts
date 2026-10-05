import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/data/invoices — read invoices with optional filters
//
//   Query params:
//     ?clientId=...      → filter by client
//     ?status=...        → filter by status (draft/sent/paid/...)
//     ?source=...        → filter by source (manual/gstn/gmail/drive/excel/ocr)
//     ?limit=50&offset=0 → pagination (max 200)
//
//   Returns { invoices: [], total: 0 } on empty DB. NO fake data.
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

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          client: { select: { id: true, tradeName: true, gstin: true } },
        },
      }),
      db.invoice.count({ where }),
    ])

    return NextResponse.json({ invoices, total })
  } catch (error) {
    console.error('[/api/data/invoices] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load invoices.' },
      { status: 500 },
    )
  }
}
