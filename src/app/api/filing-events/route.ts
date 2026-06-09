import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/filing-events — Fetch filing events with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filingId = searchParams.get('filingId')
    const clientId = searchParams.get('clientId')

    const where: Record<string, unknown> = {}

    if (filingId) where.filingId = filingId
    if (clientId) where.clientId = clientId

    const events = await db.filingEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      include: {
        filing: {
          select: {
            id: true,
            returnType: true,
            period: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('GET /api/filing-events error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch filing events' },
      { status: 500 }
    )
  }
}

// POST /api/filing-events — Create a new filing event
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { filingId, clientId, eventType, description, userId } = body

    if (!filingId || !clientId || !eventType) {
      return NextResponse.json(
        { error: 'filingId, clientId, and eventType are required' },
        { status: 400 }
      )
    }

    // Verify filing exists
    const filing = await db.gSTRFiling.findUnique({ where: { id: filingId } })
    if (!filing) {
      return NextResponse.json({ error: 'Filing not found' }, { status: 404 })
    }

    const event = await db.filingEvent.create({
      data: {
        filingId,
        clientId,
        eventType,
        description: description ?? null,
        userId: userId ?? null,
      },
      include: {
        filing: {
          select: {
            id: true,
            returnType: true,
            period: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('POST /api/filing-events error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create filing event' },
      { status: 500 }
    )
  }
}
