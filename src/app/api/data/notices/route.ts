import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/data/notices — list notices (gstn/email/manual)
//
//   Query params:
//     ?clientId=...&status=...(open/closed/...) &source=...
//     ?limit=50&offset=0
//
//   Returns { notices: [], total: 0 } on empty DB. NO fake data.
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

    const [notices, total] = await Promise.all([
      db.notice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          client: { select: { id: true, tradeName: true, gstin: true } },
        },
      }),
      db.notice.count({ where }),
    ])

    return NextResponse.json({ notices, total })
  } catch (error) {
    console.error('[/api/data/notices] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load notices.' },
      { status: 500 },
    )
  }
}
