import { db } from '@/lib/db'

/**
 * Notification creation helper — can be called from any API route or server-side
 * function to create a notification record in the database.
 *
 * Usage:
 *   import { createNotification } from '@/lib/notifications'
 *   await createNotification({
 *     type: 'warning',
 *     category: 'filing',
 *     title: 'GSTR-1 Due Tomorrow',
 *     message: 'Filing for client ABC Traders is due tomorrow.',
 *     clientId: 'cm3x...',
 *     actionUrl: '/returns?client=cm3x...',
 *     priority: 'high',
 *   })
 */

export interface CreateNotificationInput {
  /** Notification type: 'info' | 'warning' | 'error' | 'success' */
  type?: string
  /** Notification category: 'general' | 'filing' | 'reconciliation' | 'compliance' | 'system' */
  category?: string
  /** Short title of the notification */
  title: string
  /** Detailed message body */
  message: string
  /** Optional client ID to associate the notification with a client */
  clientId?: string
  /** Optional user ID to target a specific user */
  userId?: string
  /** Optional URL for the notification action (e.g., link to the relevant page) */
  actionUrl?: string
  /** Priority level: 'low' | 'medium' | 'high' | 'critical' */
  priority?: string
}

/**
 * Create a notification record in the database.
 * Returns the created notification with the client relation included.
 */
export async function createNotification(input: CreateNotificationInput) {
  const {
    type = 'info',
    category = 'general',
    title,
    message,
    clientId,
    userId,
    actionUrl,
    priority = 'medium',
  } = input

  const notification = await db.notification.create({
    data: {
      type,
      category,
      title,
      message,
      clientId: clientId ?? null,
      userId: userId ?? null,
      actionUrl: actionUrl ?? null,
      priority,
      isRead: false,
      dismissed: false,
    },
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

  // Create audit log entry
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

  return notification
}

/**
 * Convenience helpers for common notification types.
 * These wrap createNotification with sensible defaults.
 */

/** Create a filing-related notification */
export async function createFilingNotification(
  title: string,
  message: string,
  clientId?: string,
  options?: Partial<CreateNotificationInput>
) {
  return createNotification({
    type: 'warning',
    category: 'filing',
    title,
    message,
    clientId,
    actionUrl: clientId ? `/returns?client=${clientId}` : undefined,
    priority: 'high',
    ...options,
  })
}

/** Create a reconciliation-related notification */
export async function createReconNotification(
  title: string,
  message: string,
  clientId?: string,
  options?: Partial<CreateNotificationInput>
) {
  return createNotification({
    type: 'info',
    category: 'reconciliation',
    title,
    message,
    clientId,
    actionUrl: clientId ? `/reconciliation?client=${clientId}` : undefined,
    priority: 'medium',
    ...options,
  })
}

/** Create a compliance-related notification */
export async function createComplianceNotification(
  title: string,
  message: string,
  clientId?: string,
  options?: Partial<CreateNotificationInput>
) {
  return createNotification({
    type: 'error',
    category: 'compliance',
    title,
    message,
    clientId,
    priority: 'high',
    ...options,
  })
}

/** Create a system-level notification */
export async function createSystemNotification(
  title: string,
  message: string,
  options?: Partial<CreateNotificationInput>
) {
  return createNotification({
    type: 'info',
    category: 'system',
    title,
    message,
    priority: 'low',
    ...options,
  })
}
