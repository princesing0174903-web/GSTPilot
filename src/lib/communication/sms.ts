// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Communication Cloud™ — SMS Cloud™ Engine
// OTP, GST alerts, payment reminders, due-date alerts, collection reminders.
// Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SMSMessage, SMSStats, SMSCategory } from './types';
import { getTemplate, renderTemplate, type TemplateDef } from './templates';

// ─── Seed data ─────────────────────────────────────────────────────────────────

const daysAgo = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
};

/**
 * Returns 14 realistic Indian business SMS messages covering all categories:
 * otp, gst_alert, payment_reminder, due_date, collection, general.
 */
export function seedSMSMessages(): SMSMessage[] {
  return [
    {
      id: 'sms-seed-001',
      clientId: null,
      recipientName: 'Rajesh Verma',
      recipientPhone: '+91 98765 43210',
      message: 'GSTPilot: Invoice INV-2026-001 for Rs.1,18,000 due 15 Jan 2026. Please process payment. — Verma Industries LLP',
      category: 'payment_reminder',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: 'sms-seed-002',
      clientId: null,
      recipientName: 'Priya Sharma',
      recipientPhone: '+91 98200 11223',
      message: 'GSTpilot: GSTR-1 for Dec 2025 due 11 Jan 2026 (5d left). Reply STOP to opt out.',
      category: 'gst_alert',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'sms-seed-003',
      clientId: null,
      recipientName: 'Amit Mehta',
      recipientPhone: '+91 99300 44556',
      message: 'GSTpilot ALERT: Invoice INV-2026-004 (Rs.84,000) is 7d overdue. Immediate payment needed. — Mehta Traders',
      category: 'due_date',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: daysAgo(1),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'sms-seed-004',
      clientId: null,
      recipientName: 'Sunita Patel',
      recipientPhone: '+91 90040 77889',
      message: '839472 is your GSTPilot verification code. Valid for 10 minutes. Do not share with anyone. — GSTpilot',
      category: 'otp',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(4),
      deliveredAt: daysAgo(4),
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      id: 'sms-seed-005',
      clientId: null,
      recipientName: 'Deepak Agarwal',
      recipientPhone: '+91 98110 33445',
      message: 'GSTpilot ESCALATION: Agarwal Supplies invoice INV-2025-088 (Rs.1,56,000) 22d overdue. Manager notified. Recovery action initiated.',
      category: 'collection',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: 'sms-seed-006',
      clientId: null,
      recipientName: 'Fatima Khan',
      recipientPhone: '+91 98990 55667',
      message: 'GSTpilot: Invoice INV-2026-006 for Rs.92,500 due 20 Jan 2026. Please process payment. — Khan Exports',
      category: 'payment_reminder',
      status: 'failed',
      errorMessage: 'Invalid phone number format',
      sentAt: daysAgo(1),
      deliveredAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'sms-seed-007',
      clientId: null,
      recipientName: 'Vikram Singh',
      recipientPhone: '+91 99888 99001',
      message: 'GSTpilot: GSTR-3B for Dec 2025 due 20 Jan 2026 (14d left). Reply STOP to opt out.',
      category: 'gst_alert',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'sms-seed-008',
      clientId: null,
      recipientName: 'Ananya Reddy',
      recipientPhone: '+91 90010 22334',
      message: '472910 is your GSTpilot verification code. Valid for 10 minutes. Do not share with anyone. — GSTpilot',
      category: 'otp',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(5),
      deliveredAt: daysAgo(5),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      id: 'sms-seed-009',
      clientId: null,
      recipientName: 'Rohan Desai',
      recipientPhone: '+91 98250 66778',
      message: 'GSTpilot ALERT: Invoice INV-2025-091 (Rs.3,40,000) is 30d overdue. Immediate payment needed. — Desai Manufacturing',
      category: 'due_date',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'sms-seed-010',
      clientId: null,
      recipientName: 'Meera Joshi',
      recipientPhone: '+91 99220 88990',
      message: 'GSTpilot: Invoice INV-2026-007 for Rs.47,500 due 25 Jan 2026. Please process payment. — Joshi Consulting',
      category: 'payment_reminder',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(2),
      deliveredAt: daysAgo(2),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      id: 'sms-seed-011',
      clientId: null,
      recipientName: 'Arjun Nair',
      recipientPhone: '+91 94470 11223',
      message: 'GSTpilot: Payment of Rs.1,12,000 received against INV-2026-003. Thank you! — Nair Tech Solutions',
      category: 'payment_reminder',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(1),
      deliveredAt: daysAgo(1),
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'sms-seed-012',
      clientId: null,
      recipientName: 'Pooja Bhat',
      recipientPhone: '+91 98450 33445',
      message: 'GSTpilot: GSTR-1 for Dec 2025 due 11 Jan 2026 (5d left). Reply STOP to opt out.',
      category: 'gst_alert',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(3),
      deliveredAt: daysAgo(3),
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      id: 'sms-seed-013',
      clientId: null,
      recipientName: 'Sai Krishna',
      recipientPhone: '+91 99660 77889',
      message: 'GSTpilot ESCALATION: Krishna Traders invoice INV-2025-094 (Rs.78,000) 35d overdue. Manager notified. Recovery action initiated.',
      category: 'collection',
      status: 'failed',
      errorMessage: 'DND (Do Not Disturb) active on recipient number',
      sentAt: daysAgo(1),
      deliveredAt: null,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: 'sms-seed-014',
      clientId: null,
      recipientName: 'Karthik Iyer',
      recipientPhone: '+91 94440 22110',
      message: 'GSTpilot: Salary slip for Dec 2025 ready. Net pay Rs.78,500. Check your email. — GSTpilot HR',
      category: 'payment_reminder',
      status: 'delivered',
      errorMessage: null,
      sentAt: daysAgo(5),
      deliveredAt: daysAgo(5),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
  ];
}

// ─── Stats ─────────────────────────────────────────────────────────────────────

/** Compute aggregate stats from a list of SMS messages. */
export function getSMSStats(messages: SMSMessage[]): SMSStats {
  const total = messages.length;
  const sent = messages.filter((m) => m.status !== 'queued').length;
  const delivered = messages.filter((m) => m.status === 'delivered').length;
  const failed = messages.filter((m) => m.status === 'failed').length;
  const byCategory: Record<string, number> = {};
  for (const m of messages) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
  }
  return {
    total,
    sent,
    delivered,
    failed,
    deliveryRate: total > 0 ? round2((delivered / total) * 100) : 0,
    byCategory,
  };
}

// ─── Message generation ────────────────────────────────────────────────────────

/** Generate a random 6-digit OTP code. */
export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generate an SMS message for the given type using the template registry.
 * Falls back to a simple inline message if no template matches.
 */
export function generateSmsMessage(
  type: SMSCategory | string,
  data: Record<string, string | number>,
): { message: string; templateName: string | null } {
  const templateMap: Record<string, string> = {
    otp: 'otp_sms',
    gst_alert: 'gst_filing_reminder_sms',
    payment_reminder: 'payment_reminder_sms',
    due_date: 'due_date_alert_sms',
    collection: 'collection_escalation_sms',
  };

  const templateName = templateMap[type];
  const template: TemplateDef | undefined = templateName ? getTemplate(templateName) : undefined;

  if (template) {
    return { message: renderTemplate(template, data), templateName: template.name };
  }

  // Fallback inline message
  return {
    message: `GSTPilot: ${data.message ?? 'You have a new notification.'} Reply STOP to opt out.`,
    templateName: null,
  };
}

// ─── SMS segment calculation ───────────────────────────────────────────────────

/**
 * Calculate the number of SMS segments for a message.
 * Standard SMS: 160 chars per segment (GSM-7 encoding).
 * Unicode SMS: 70 chars per segment.
 * We assume GSM-7 (standard for Indian English SMS).
 */
export function segmentCount(message: string): number {
  // Check for non-GSM characters (basic check for Unicode/emoji)
  const isUnicode = /[^\u0000-\u007F]/.test(message);
  const maxChars = isUnicode ? 70 : 160;
  if (message.length <= maxChars) return 1;
  // Multi-segment messages have a 7-char header overhead per segment
  const effectiveMax = isUnicode ? 67 : 153;
  return Math.ceil(message.length / effectiveMax);
}

/** Estimate the cost of an SMS in INR (₹0.18 per segment for transactional SMS in India). */
export function estimateSmsCost(message: string): number {
  const segments = segmentCount(message);
  return round2(segments * 0.18);
}

// ─── helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
