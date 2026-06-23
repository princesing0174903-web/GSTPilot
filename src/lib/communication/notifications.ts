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

// ─── Seed data ─────────────────────────────────────────────────────────────────

const daysAgo = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
};
const daysAhead = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString();
};

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

/**
 * Returns 16 realistic notifications across all 7 types with varied
 * priorities and read/unread states.
 */
export function seedNotifications(): NotificationItem[] {
  return [
    {
      id: 'ntf-seed-001',
      type: 'gst_due',
      category: 'filing',
      title: 'GSTR-1 Due in 5 Days',
      message: 'GSTR-1 for Dec 2025 is due on 11 Jan 2026 for Mehta Traders. I\'ve prepared the return — pending approval.',
      actionUrl: '/returns',
      isRead: false,
      priority: 'high',
      dismissed: false,
      sentAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
    {
      id: 'ntf-seed-002',
      type: 'collection_risk',
      category: 'collection',
      title: 'Invoice 7 Days Overdue',
      message: 'Invoice INV-2026-001 for ₹1,18,000 (Verma Industries LLP) is 7 days overdue. I\'ve sent a WhatsApp reminder.',
      actionUrl: '/invoice-cloud',
      isRead: false,
      priority: 'high',
      dismissed: false,
      sentAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
    {
      id: 'ntf-seed-003',
      type: 'cash_shortage',
      category: 'cashflow',
      title: 'Cash Shortage Predicted in 18 Days',
      message: 'Based on current receivables and payables, I\'ve projected a ₹2.3 lakh cash deficit by 28 Jan 2026.',
      actionUrl: '/ai-cfo',
      isRead: false,
      priority: 'critical',
      dismissed: false,
      sentAt: daysAgo(2),
      createdAt: daysAgo(2),
    },
    {
      id: 'ntf-seed-004',
      type: 'tds',
      category: 'compliance',
      title: 'TDS Deposit Due — Q3',
      message: 'TDS of ₹84,000 for Q3 FY26 must be deposited by 7 Jan 2026. I\'ve prepared the challan.',
      actionUrl: '/invoice-cloud',
      isRead: true,
      priority: 'high',
      dismissed: false,
      sentAt: daysAgo(3),
      readAt: daysAgo(2),
      createdAt: daysAgo(3),
    },
    {
      id: 'ntf-seed-005',
      type: 'payment_due',
      category: 'payables',
      title: 'Vendor Payment Due Tomorrow',
      message: 'Payment of ₹2,50,000 to Apex Suppliers is due tomorrow. I\'ve queued it for approval.',
      actionUrl: '/invoice-cloud',
      isRead: false,
      priority: 'medium',
      dismissed: false,
      sentAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
    {
      id: 'ntf-seed-006',
      type: 'payroll',
      category: 'payroll',
      title: 'Payroll Processing Due',
      message: 'Payroll for 8 employees for Dec 2025 is ready to process. Net payable: ₹5.2 lakh. I\'ve prepared all payslips.',
      actionUrl: '/invoice-cloud',
      isRead: true,
      priority: 'medium',
      dismissed: false,
      sentAt: daysAgo(4),
      readAt: daysAgo(3),
      createdAt: daysAgo(4),
    },
    {
      id: 'ntf-seed-007',
      type: 'gst_due',
      category: 'filing',
      title: 'GSTR-3B Due in 14 Days',
      message: 'GSTR-3B for Dec 2025 is due on 20 Jan 2026 for Singh Logistics. Net GST payable: ₹1,42,000.',
      actionUrl: '/returns',
      isRead: true,
      priority: 'high',
      dismissed: false,
      sentAt: daysAgo(3),
      readAt: daysAgo(2),
      createdAt: daysAgo(3),
    },
    {
      id: 'ntf-seed-008',
      type: 'collection_risk',
      category: 'collection',
      title: '3 Invoices Escalated',
      message: 'I\'ve escalated 3 overdue invoices (total ₹5,74,000) to final notice stage. Manager has been notified.',
      actionUrl: '/communication-cloud',
      isRead: false,
      priority: 'critical',
      dismissed: false,
      sentAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
    {
      id: 'ntf-seed-009',
      type: 'system_alert',
      category: 'system',
      title: 'GSTN API Maintenance',
      message: 'GSTN portal will be under maintenance on 12 Jan 2026, 10 PM – 2 AM. File returns before or after this window.',
      actionUrl: null,
      isRead: true,
      priority: 'low',
      dismissed: false,
      sentAt: daysAgo(2),
      readAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
    {
      id: 'ntf-seed-010',
      type: 'payment_due',
      category: 'receivables',
      title: '₹84,000 Payment Received',
      message: 'I\'ve received payment of ₹84,000 from Sharma & Sons against invoice INV-2026-004. Auto-reconciled.',
      actionUrl: '/invoice-cloud',
      isRead: true,
      priority: 'low',
      dismissed: false,
      sentAt: daysAgo(2),
      readAt: daysAgo(1),
      createdAt: daysAgo(2),
    },
    {
      id: 'ntf-seed-011',
      type: 'gst_due',
      category: 'filing',
      title: 'GSTR-1 Filed Successfully',
      message: 'GSTR-3B for Nov 2025 has been filed for Bhat & Associates. ARN: AA1234567890123B.',
      actionUrl: '/returns',
      isRead: true,
      priority: 'low',
      dismissed: false,
      sentAt: daysAgo(5),
      readAt: daysAgo(4),
      createdAt: daysAgo(5),
    },
    {
      id: 'ntf-seed-012',
      type: 'tds',
      category: 'compliance',
      title: 'TDS Return Due — Q3',
      message: 'TDS return (Form 26Q) for Q3 FY26 is due on 31 Jan 2026. I\'ve prepared the return with 24 deductee records.',
      actionUrl: '/invoice-cloud',
      isRead: false,
      priority: 'high',
      dismissed: false,
      sentAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
    {
      id: 'ntf-seed-013',
      type: 'cash_shortage',
      category: 'cashflow',
      title: 'Receivables Collection Below Target',
      message: 'Collection rate dropped to 74% (below 85% target). I\'ve dispatched reminders to 7 overdue accounts.',
      actionUrl: '/communication-cloud',
      isRead: false,
      priority: 'high',
      dismissed: false,
      sentAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
    {
      id: 'ntf-seed-014',
      type: 'payroll',
      category: 'payroll',
      title: 'Payslips Distributed',
      message: 'I\'ve distributed salary slips to all 8 employees via WhatsApp and Email for Dec 2025.',
      actionUrl: '/communication-cloud',
      isRead: true,
      priority: 'low',
      dismissed: false,
      sentAt: daysAgo(5),
      readAt: daysAgo(4),
      createdAt: daysAgo(5),
    },
    {
      id: 'ntf-seed-015',
      type: 'system_alert',
      category: 'system',
      title: 'WhatsApp Business API Connected',
      message: 'WhatsApp Business Cloud API is now connected. You can send invoices and reminders directly to customers.',
      actionUrl: '/communication-cloud',
      isRead: true,
      priority: 'low',
      dismissed: false,
      sentAt: daysAgo(7),
      readAt: daysAgo(6),
      createdAt: daysAgo(7),
    },
    {
      id: 'ntf-seed-016',
      type: 'collection_risk',
      category: 'collection',
      title: '₹84,000 Recovered This Week',
      message: 'I\'ve recovered ₹84,000 from overdue invoices this week through automated WhatsApp and email reminders.',
      actionUrl: '/communication-cloud',
      isRead: false,
      priority: 'medium',
      dismissed: false,
      sentAt: daysAgo(1),
      createdAt: daysAgo(1),
    },
  ];
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
