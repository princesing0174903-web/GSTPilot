// ═══════════════════════════════════════════════════════════════════════════════
// AuditLog + Notification safe-write helpers
// ═══════════════════════════════════════════════════════════════════════════════
//
// Both AuditLog and Notification have an optional `userId` FK → User.id. If a
// caller passes a userId that doesn't have a matching User row (e.g., during
// smoke tests or for system-generated events), Prisma throws a P2003 foreign-
// key violation.
//
// These helpers write the row, retrying with userId=null if the FK check fails.
// They never throw — best-effort audit + notification logging.

import { db } from '@/lib/db';

interface SafeAuditInput {
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  details?: string | null;
}

export async function safeAudit(input: SafeAuditInput): Promise<void> {
  const payload = {
    action: input.action,
    entity: input.entity ?? null,
    entityId: input.entityId ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    details: input.details ?? null,
  };

  // Try with userId first (most useful — links the action to a user).
  if (input.userId) {
    try {
      await db.auditLog.create({
        data: { ...payload, userId: input.userId },
      });
      return;
    } catch (err: unknown) {
      // P2003 = foreign-key violation — User row missing. Retry without userId.
      const code = (err as { code?: string })?.code;
      if (code !== 'P2003') {
        console.warn(`[audit] ${input.action} write failed:`, err);
      }
    }
  }

  // Fallback — write without userId (the AuditLog row is still useful).
  try {
    await db.auditLog.create({ data: payload });
  } catch (err) {
    console.warn(`[audit] ${input.action} write failed (no-user fallback):`, err);
  }
}

interface SafeNotifyInput {
  userId?: string | null;
  type?: string;
  category?: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  priority?: string;
  sentAt?: Date;
}

export async function safeNotify(input: SafeNotifyInput): Promise<void> {
  const payload = {
    type: input.type ?? 'info',
    category: input.category ?? 'general',
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? null,
    priority: input.priority ?? 'medium',
    sentAt: input.sentAt ?? new Date(),
  };

  if (input.userId) {
    try {
      await db.notification.create({
        data: { ...payload, userId: input.userId },
      });
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== 'P2003') {
        console.warn(`[notify] ${input.title} write failed:`, err);
      }
    }
  }

  try {
    await db.notification.create({ data: payload });
  } catch (err) {
    console.warn(`[notify] ${input.title} write failed (no-user fallback):`, err);
  }
}
