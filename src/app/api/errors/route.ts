import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/errors — Fetch issues with filters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const severity = searchParams.get('severity')
    const status = searchParams.get('status')
    const category = searchParams.get('category')

    const where: Record<string, unknown> = {}

    if (clientId) where.clientId = clientId
    if (severity) where.severity = severity
    if (status) where.status = status
    if (category) where.category = category

    const issues = await db.issue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
          },
        },
      },
    })

    return NextResponse.json({ issues })
  } catch (error) {
    console.error('GET /api/errors error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch issues' },
      { status: 500 }
    )
  }
}

// PUT /api/errors — Update an issue
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, status, assignedTo, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      )
    }

    const existing = await db.issue.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (status !== undefined) updateData.status = status
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (notes !== undefined) updateData.notes = notes

    // If resolving, set resolvedAt
    if (status === 'resolved') {
      updateData.resolvedAt = new Date().toISOString().split('T')[0]
    }

    const issue = await db.issue.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: existing.clientId,
        action: 'Issue Updated',
        entity: 'issue',
        entityId: id,
        details: `Issue "${existing.title}" updated — status: ${status ?? existing.status}`,
      },
    })

    return NextResponse.json({ issue })
  } catch (error) {
    console.error('PUT /api/errors error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update issue' },
      { status: 500 }
    )
  }
}

// POST /api/errors — Create a new issue
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      clientId,
      invoiceId,
      filingId,
      severity,
      category,
      title,
      description,
      status,
      assignedTo,
      notes,
    } = body

    if (!clientId || !category || !title) {
      return NextResponse.json(
        { error: 'clientId, category, and title are required' },
        { status: 400 }
      )
    }

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const issue = await db.issue.create({
      data: {
        clientId,
        invoiceId: invoiceId ?? null,
        filingId: filingId ?? null,
        severity: severity ?? 'info',
        category,
        title,
        description: description ?? null,
        status: status ?? 'open',
        assignedTo: assignedTo ?? null,
        notes: notes ?? null,
      },
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId,
        action: 'Issue Created',
        entity: 'issue',
        entityId: issue.id,
        details: `Issue "${title}" created for ${client.tradeName}`,
      },
    })

    return NextResponse.json({ issue }, { status: 201 })
  } catch (error) {
    console.error('POST /api/errors error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create issue' },
      { status: 500 }
    )
  }
}
