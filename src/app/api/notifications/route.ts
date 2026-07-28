import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications'
import { safeAudit } from '@/lib/audit/safe-write'
import { requireAuth, friendlyApiError } from '@/lib/auth/session'

// GET /api/notifications — Fetch notifications with filters
// Query params: userId, clientId, isRead, category, limit(20), offset
// Returns { notifications: [...], unreadCount: number }
export async function GET(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const clientId = searchParams.get('clientId')
    const isRead = searchParams.get('isRead')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    // Build where clause using Prisma
    const where: Record<string, unknown> = {
      dismissed: false,
    }

    if (userId) {
      where.userId = userId
    }
    if (clientId) {
      where.clientId = clientId
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
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
            status: true,
          },
        },
      },
    })

    // Count unread notifications
    const unreadWhere: Record<string, unknown> = {
      isRead: false,
      dismissed: false,
    }
    if (userId) {
      unreadWhere.userId = userId
    }
    if (clientId) {
      unreadWhere.clientId = clientId
    }

    const unreadCount = await db.notification.count({
      where: unreadWhere,
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    console.error('GET /api/notifications error:', error)
    return friendlyApiError(error, 'We could not load your notifications right now. Please try again.')
  }
}

// POST /api/notifications — Create a notification
// Body: { userId?, clientId?, type, category, title, message, actionUrl?, priority? }
// Returns { notification }
export async function POST(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

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

    // Use the safe helper (retries without userId/clientId on P2003 FK violation,
    // and delegates the audit row to safeAudit). Never throws on FK mismatch.
    const notification = await createNotification({
      userId,
      clientId,
      type,
      category,
      title,
      message,
      actionUrl,
      priority,
    })

    if (!notification) {
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({ notification }, { status: 201 })
  } catch (error) {
    console.error('POST /api/notifications error:', error)
    return friendlyApiError(error, 'We could not create the notification right now. Please try again.')
  }
}

// PATCH /api/notifications — Update a notification (mark read, dismiss)
// Body: { id, isRead?, read?, dismissed?, readAt? }
// Accepts both `isRead` and `read` fields for frontend compatibility
// Returns { notification }
export async function PATCH(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const body = await request.json()
    const { id, isRead, read, dismissed, readAt } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Notification id is required' },
        { status: 400 }
      )
    }

    // Normalize: accept both `isRead` and `read` from frontend
    const effectiveIsRead = isRead ?? read

    if (effectiveIsRead === undefined && dismissed === undefined && readAt === undefined) {
      return NextResponse.json(
        { error: 'At least one of isRead, read, dismissed, or readAt must be provided' },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}

    if (effectiveIsRead !== undefined) {
      updateData.isRead = effectiveIsRead
      if (effectiveIsRead) {
        updateData.readAt = new Date()
      }
    }

    if (dismissed !== undefined) {
      updateData.dismissed = dismissed
    }

    if (readAt !== undefined) {
      updateData.readAt = readAt ? new Date(readAt) : null
    }

    const notification = await db.notification.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            tradeName: true,
            gstin: true,
            status: true,
          },
        },
      },
    })

    // Best-effort audit log (safe-write: retries without userId on P2003).
    await safeAudit({
      action: 'Notification Updated',
      entity: 'notification',
      entityId: id,
      details: `Notification updated — isRead: ${effectiveIsRead}, dismissed: ${dismissed}`,
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('PATCH /api/notifications error:', error)
    // Prisma throws P2025 when record not found
    const prismaError = error as { code?: string }
    if (
      prismaError.code === 'P2025' ||
      (error instanceof Error && error.message.includes('Record to update not found'))
    ) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    return friendlyApiError(error, 'We could not update the notification right now. Please try again.')
  }
}

// DELETE /api/notifications?id=xxx — Delete a notification
export async function DELETE(request: Request) {
  try {
    // ── 1. AUTHENTICATION ──────────────────────────────────────────────────
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { uid } = authResult

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Notification id is required (query param ?id=xxx)' },
        { status: 400 }
      )
    }

    const notification = await db.notification.delete({
      where: { id },
    })

    // Best-effort audit log (safe-write: retries without userId on P2003).
    await safeAudit({
      action: 'Notification Deleted',
      entity: 'notification',
      entityId: id,
      details: `Notification deleted: "${notification.title}"`,
    })

    return NextResponse.json({ notification })
  } catch (error) {
    console.error('DELETE /api/notifications error:', error)
    const prismaError = error as { code?: string }
    if (
      prismaError.code === 'P2025' ||
      (error instanceof Error && error.message.includes('Record to delete not found'))
    ) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    return friendlyApiError(error, 'We could not delete the notification right now. Please try again.')
  }
}
