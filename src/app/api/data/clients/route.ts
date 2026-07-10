import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════════════════════════════════
// /api/data/clients — list clients (mirror of /api/clients but minimal shape)
//
//   Query params:
//     ?search=...&status=...
//     ?limit=50&offset=0
//
//   Returns { clients: [], total: 0 } on empty DB. NO fake data.
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const search = url.searchParams.get('search') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)
    const offset = Number(url.searchParams.get('offset') ?? 0)

    const where: {
      status?: string
      OR?: Array<Record<string, unknown>>
    } = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { tradeName: { contains: search } },
        { legalName: { contains: search } },
        { gstin: { contains: search } },
      ]
    }

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.client.count({ where }),
    ])

    return NextResponse.json({ clients, total })
  } catch (error) {
    console.error('[/api/data/clients] GET failed:', error)
    return NextResponse.json(
      { error: 'Failed to load clients.' },
      { status: 500 },
    )
  }
}
