import { db } from '@/lib/db'
import { safeAudit } from '@/lib/audit/safe-write'

/**
 * Notification creation helper — can be called from any API route or server-side
 * function to create a notification record in the database.
 *
 * STABILIZATION NOTE: This helper previously called `db.notification.create` and
 * `db.auditLog.create` directly with a `userId` FK → User.id. When the caller
 * passes a Firebase UID (which is NOT present in the Prisma `User` table),
 * Prisma throws a P2003 foreign-key violation that flooded the server logs and
 * surfaced as 500s. It now retries without `userId` on P2003 (mirroring the
 * pattern in `@/lib/audit/safe-write`) and delegates the audit row to `safeAudit`.
 * It never throws — best-effort notification logging.
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

const NOTIF_INCLUDE = {
  client: {
    select: {
      id: true,
      tradeName: true,
      gstin: true,
      status: true,
    },
  },
} as const

/**
 * Create a notification record in the database.
 * Returns the created notification with the client relation included, or `null`
 * if the write failed (e.g. FK violation on both userId and clientId).
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

  const baseData = {
    type,
    category,
    title,
    message,
    actionUrl: actionUrl ?? null,
    priority,
    isRead: false,
    dismissed: false,
  }

  // ── Attempt 1: full row with userId + clientId ──
  if (userId || clientId) {
    try {
      const notification = await db.notification.create({
        data: {
          ...baseData,
          userId: userId ?? null,
          clientId: clientId ?? null,
        },
        include: NOTIF_INCLUDE,
      })
      await safeAudit({
        userId: userId ?? null,
        action: 'Notification Created',
        entity: 'notification',
        entityId: notification.id,
        details: `Notification created: "${title}"`,
      })
      return notification
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      // P2003 = foreign-key violation (User or Client row missing).
      if (code !== 'P2003') {
        console.warn(`[notify] ${title} write failed:`, err)
      }
      // fall through to attempt 2
    }
  }

  // ── Attempt 2: strip BOTH userId + clientId (the row is still useful) ──
  try {
    const notification = await db.notification.create({
      data: { ...baseData, userId: null, clientId: null },
      include: NOTIF_INCLUDE,
    })
    await safeAudit({
      userId: null,
      action: 'Notification Created',
      entity: 'notification',
      entityId: notification.id,
      details: `Notification created: "${title}"`,
    })
    return notification
  } catch (err) {
    console.warn(`[notify] ${title} write failed (no-fk fallback):`, err)
    return null
  }
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
