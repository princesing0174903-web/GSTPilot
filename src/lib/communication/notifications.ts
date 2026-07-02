// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Communication Cloud™ — Notification Center™ Engine
// GST Due, Payment Due, Collection Risk, Cash Shortage, Payroll, TDS, System Alerts.
// Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NotificationType, NotificationStats } from './types';

// ─── Notification type registry ────────────────────────────────────────────────

export interface NotificationTypeDef {
  type: NotificationType;
  label: string;
  icon: string; // emoji for quick visual ID
  color: string; // tailwind text class
  bg: string; // tailwind bg class
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
  {
    type: 'gst_due',
    label: 'GST Due',
    icon: '📅',
    color: 'text-amber-300',
    bg: 'bg-amber-500/15',
    defaultPriority: 'high',
    description: 'GSTR-1, GSTR-3B, or other GST return filing deadline approaching',
  },
  {
    type: 'payment_due',
    label: 'Payment Due',
    icon: '💳',
    color: 'text-sky-300',
    bg: 'bg-sky-500/15',
    defaultPriority: 'medium',
    description: 'Invoice payment due date approaching or passed',
  },
  {
    type: 'collection_risk',
    label: 'Collection Risk',
    icon: '⚠️',
    color: 'text-rose-300',
    bg: 'bg-rose-500/15',
    defaultPriority: 'high',
    description: 'Customer payment delayed, collection recovery needed',
  },
  {
    type: 'cash_shortage',
    label: 'Cash Shortage',
    icon: '🩸',
    color: 'text-red-300',
    bg: 'bg-red-500/15',
    defaultPriority: 'critical',
    description: 'Projected cash deficit within the next 30 days',
  },
  {
    type: 'payroll',
    label: 'Payroll',
    icon: '👥',
    color: 'text-violet-300',
    bg: 'bg-violet-500/15',
    defaultPriority: 'medium',
    description: 'Monthly payroll processing, payslip distribution, or salary disbursement',
  },
  {
    type: 'tds',
    label: 'TDS',
    icon: '🧾',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
    defaultPriority: 'high',
    description: 'TDS deduction, deposit, or quarterly return deadline',
  },
  {
    type: 'system_alert',
    label: 'System Alert',
    icon: '🔧',
    color: 'text-white/60',
    bg: 'bg-white/5',
    defaultPriority: 'low',
    description: 'System maintenance, integration status, or platform updates',
  },
];

/** Get a notification type definition by its type key. */
export function getNotificationTypeDef(type: string): NotificationTypeDef | undefined {
  return NOTIFICATION_TYPES.find((t) => t.type === type);
}

/** Map a notification type to its default priority level. */
export function priorityLevel(type: NotificationType | string): string {
  return getNotificationTypeDef(type)?.defaultPriority ?? 'medium';
}

// ─── Notification item shape ──────────────────────────────────────────────────

export interface NotificationItem {
  id: string;
  userId?: string | null;
  clientId?: string | null;
  type: NotificationType;
  category: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  isRead: boolean;
  priority: string;
  dismissed: boolean;
  scheduledAt?: string | null;
  sentAt?: string | null;
  readAt?: string | null;
  createdAt: string;
}

// ─── Seed data (no-op) ─────────────────────────────────────────────────────────
// Previously this function emitted 16 hardcoded notifications referencing fake
// Indian clients and fabricated amounts. The export name is preserved so
// existing callers continue to compile, but it now returns `[]` so the UI
// renders a proper empty state. Real notifications come from
// `db.notification.findMany()` via the API routes.

export function seedNotifications(): NotificationItem[] {
  return [];
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

/** Compute aggregate stats from a list of notifications. */
export function getNotificationStats(notifications: NotificationItem[]): NotificationStats {
  const total = notifications.length;
  const unread = notifications.filter((n) => !n.isRead && !n.dismissed).length;
  const critical = notifications.filter((n) => n.priority === 'critical' && !n.dismissed).length;
  const byType: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const n of notifications) {
    if (n.dismissed) continue;
    byType[n.type] = (byType[n.type] ?? 0) + 1;
    byPriority[n.priority] = (byPriority[n.priority] ?? 0) + 1;
  }
  return { total, unread, critical, byType, byPriority };
}

// ─── Action URL generation ─────────────────────────────────────────────────────

/** Generate an action URL for a notification based on its type and contextual data. */
export function formatNotificationAction(
  type: NotificationType | string,
  data: Record<string, string> = {},
): string {
  switch (type) {
    case 'gst_due':
      return '/returns';
    case 'payment_due':
      return '/invoice-cloud';
    case 'collection_risk':
      return '/communication-cloud';
    case 'cash_shortage':
      return '/ai-cfo';
    case 'payroll':
      return '/invoice-cloud';
    case 'tds':
      return '/invoice-cloud';
    case 'system_alert':
      return data.url ?? '';
    default:
      return '';
  }
}

// ─── Notification creation helpers (for the AI engine) ─────────────────────────

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  clientId?: string | null;
  actionUrl?: string | null;
  priority?: string;
}

/** Build a notification item object (for in-memory use; DB persistence is via the API). */
export function buildNotification(input: CreateNotificationInput): NotificationItem {
  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId: input.clientId ?? null,
    type: input.type,
    category: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionUrl ?? formatNotificationAction(input.type),
    isRead: false,
    priority: input.priority ?? priorityLevel(input.type),
    dismissed: false,
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}
