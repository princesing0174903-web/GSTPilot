import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/notices — List notices with client and assignee info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const noticeType = searchParams.get('noticeType')
    const clientId = searchParams.get('clientId')
    const assignedTo = searchParams.get('assignedTo')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (noticeType) where.noticeType = noticeType
    if (clientId) where.clientId = clientId
    if (assignedTo) where.assignedTo = assignedTo

    const notices = await db.notice.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
            state: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const enriched = notices.map((notice) => ({
      id: notice.id,
      clientId: notice.clientId,
      clientTradeName: notice.client.tradeName,
      clientGstin: notice.client.gstin,
      noticeType: notice.noticeType,
      noticeNumber: notice.noticeNumber,
      noticeDate: notice.noticeDate,
      subject: notice.subject,
      description: notice.description,
      status: notice.status,
      assignedTo: notice.assignedTo,
      assigneeName: notice.assignee?.name ?? null,
      assigneeEmail: notice.assignee?.email ?? null,
      priority: notice.priority,
      dueDate: notice.dueDate,
      responseDate: notice.responseDate,
      resolution: notice.resolution,
      attachments: notice.attachments,
      createdAt: notice.createdAt,
      updatedAt: notice.updatedAt,
    }))

    return NextResponse.json({ notices: enriched })
  } catch (error) {
    console.error('GET /api/notices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notices' },
      { status: 500 }
    )
  }
}

// POST /api/notices — Create new notice
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      clientId,
      noticeType,
      noticeNumber,
      noticeDate,
      subject,
      description,
      priority,
      dueDate,
      assignedTo,
    } = body

    if (!clientId || !subject) {
      return NextResponse.json(
        { error: 'clientId and subject are required' },
        { status: 400 }
      )
    }

    // Verify client exists
    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }

    // Verify assignee exists if provided
    if (assignedTo) {
      const member = await db.teamMember.findUnique({ where: { id: assignedTo } })
      if (!member) {
        return NextResponse.json(
          { error: 'Assigned team member not found' },
          { status: 404 }
        )
      }
    }

    const notice = await db.notice.create({
      data: {
        clientId,
        noticeType: noticeType ?? 'gst_notice',
        noticeNumber: noticeNumber ?? null,
        noticeDate: noticeDate ?? null,
        subject,
        description: description ?? null,
        priority: priority ?? 'medium',
        dueDate: dueDate ?? null,
        assignedTo: assignedTo ?? null,
      },
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ notice }, { status: 201 })
  } catch (error) {
    console.error('POST /api/notices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create notice' },
      { status: 500 }
    )
  }
}

// PATCH /api/notices — Update notice
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status, assignedTo, responseDate, resolution, notes } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Notice id is required' },
        { status: 400 }
      )
    }

    const existing = await db.notice.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Notice not found' },
        { status: 404 }
      )
    }

    // Verify assignee exists if being changed
    if (assignedTo !== undefined && assignedTo !== null) {
      const member = await db.teamMember.findUnique({ where: { id: assignedTo } })
      if (!member) {
        return NextResponse.json(
          { error: 'Assigned team member not found' },
          { status: 404 }
        )
      }
    }

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (responseDate !== undefined) updateData.responseDate = responseDate
    if (resolution !== undefined) updateData.resolution = resolution
    if (notes !== undefined) updateData.description = notes

    // Auto-set response date if status is being set to resolved
    if (status === 'resolved' && !responseDate) {
      updateData.responseDate = new Date().toISOString().split('T')[0]
    }

    const notice = await db.notice.update({
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
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ notice })
  } catch (error) {
    console.error('PATCH /api/notices error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notice' },
      { status: 500 }
    )
  }
}
