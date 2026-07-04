import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { safeAuditWithRow } from '@/lib/audit/safe-write'

// GET /api/audit-logs — Fetch audit logs with filters and pagination
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const action = searchParams.get('action')
    const entity = searchParams.get('entity')
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const where: Record<string, unknown> = {}

    if (clientId) where.clientId = clientId
    if (action) where.action = { contains: action }
    if (entity) where.entity = entity

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          client: {
            select: {
              id: true,
              tradeName: true,
              gstin: true,
            },
          },
        },
      }),
      db.auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    })
  } catch (error) {
    console.error('GET /api/audit-logs error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

// POST /api/audit-logs — Create an audit log entry
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { clientId, userId, action, entity, entityId, details } = body

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      )
    }

    const log = await safeAuditWithRow({
      clientId: clientId ?? null,
      userId: userId ?? null,
      action,
      entity: entity ?? null,
      entityId: entityId ?? null,
      details: details ?? null,
    })

    if (!log) {
      return NextResponse.json(
        { error: 'Failed to create audit log' },
        { status: 500 }
      )
    }

    return NextResponse.json({ log }, { status: 201 })
  } catch (error) {
    console.error('POST /api/audit-logs error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create audit log' },
      { status: 500 }
    )
  }
}
