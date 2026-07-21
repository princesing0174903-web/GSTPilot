import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/activities — List activities with optional filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const firmId = searchParams.get('firmId')
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const where: Record<string, unknown> = {}
    if (clientId) where.clientId = clientId
    if (firmId) where.firmId = firmId
    if (type) where.type = type

    const [activities, total] = await Promise.all([
      db.activity.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.activity.count({ where: Object.keys(where).length > 0 ? where : undefined }),
    ])

    return NextResponse.json({
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('GET /api/activities error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

// POST /api/activities — Create a new activity
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firmId, clientId, userId, type, description, metadata } = body

    if (!firmId || !type || !description) {
      return NextResponse.json(
        { error: 'firmId, type, and description are required' },
        { status: 400 }
      )
    }

    const activity = await db.activity.create({
      data: {
        firmId,
        clientId: clientId ?? null,
        userId: userId ?? null,
        type,
        description,
        metadata: metadata ?? null,
      },
    })

    return NextResponse.json({ activity }, { status: 201 })
  } catch (error) {
    console.error('POST /api/activities error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create activity' },
      { status: 500 }
    )
  }
}
