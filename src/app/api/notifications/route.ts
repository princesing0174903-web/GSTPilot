import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/notifications — Fetch notifications with filters
// Query params: userId, isRead, category, limit(20), offset
// Returns { notifications: [...], unreadCount: number }
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const isRead = searchParams.get('isRead')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // Build where clause using Prisma
    const where: any = {
      dismissed: false,
    }

    if (userId) {
      where.userId = userId
    }
    if (category) {
      where.category = category
    }
    if (isRead !== null && isRead !== undefined && isRead !== '') {
      where.isRead = isRead === 'true'
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })

    // Count unread notifications
    const unreadWhere: any = {
      isRead: false,
      dismissed: false,
    }
    if (userId) {
      unreadWhere.userId = userId
    }

    const unreadCount = await db.notification.count({
      where: unreadWhere,
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('GET /api/notifications error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

// POST /api/notifications — Create a notification
// Body: { userId?, clientId?, type, category, title, message, actionUrl?, priority? }
// Returns { notification }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      userId,
      clientId,
      type,
      category,
      title,
      message,
      actionUrl,
      priority,
    } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'title and message are required' },
        { status: 400 }
      )
    }

    const notification = await db.notification.create({
      data: {
        userId: userId ?? null,
        clientId: clientId ?? null,
        type: type ?? 'info',
        category: category ?? 'general',
        title,
        message,
        actionUrl: actionUrl ?? null,
        priority: priority ?? 'medium',
        isRead: false,
        dismissed: false,
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        clientId: clientId ?? null,
        userId: userId ?? null,
        action: 'Notification Created',
        entity: 'notification',
        entityId: notification.id,
        details: `Notification created: "${title}"`,
      },
    })

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('POST /api/notifications error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create notification' },
      { status: 500 }
    )
  }
}

// PATCH /api/notifications — Mark read/dismissed
// Body: { id, isRead?, dismissed? }
// Returns { notification }
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, isRead, dismissed } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Notification id is required' },
        { status: 400 }
      )
    }

    if (isRead === undefined && dismissed === undefined) {
      return NextResponse.json(
        { error: 'At least one of isRead or dismissed must be provided' },
        { status: 400 }
      )
    }

    const updateData: any = {}

    if (isRead !== undefined) {
      updateData.isRead = isRead
      if (isRead) {
        updateData.readAt = new Date()
      }
    }
    if (dismissed !== undefined) {
      updateData.dismissed = dismissed
    }

    const notification = await db.notification.update({
      where: { id },
      data: updateData,
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        action: 'Notification Updated',
        entity: 'notification',
        entityId: id,
        details: `Notification updated — isRead: ${isRead}, dismissed: ${dismissed}`,
      },
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('PATCH /api/notifications error:', error)
    // Prisma throws P2025 when record not found
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notification' },
      { status: 500 }
    )
  }
}
