// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Communication Cloud™ — SMS Cloud™ Engine
// OTP, GST alerts, payment reminders, due-date alerts, collection reminders.
// Pure TypeScript — importable from both client and server.
// ═══════════════════════════════════════════════════════════════════════════════

import type { SMSMessage, SMSStats, SMSCategory } from './types';
import { getTemplate, renderTemplate, type TemplateDef } from './templates';

// ─── Seed data (no-op) ─────────────────────────────────────────────────────────
// Previously this function emitted 14 hardcoded SMS messages attributed to
// fake Indian recipients and fabricated invoice numbers. The export name is
// preserved so existing callers continue to compile, but it now returns `[]`
// so the UI renders a proper empty state. Real SMS messages come from
// `db.sMSMessage.findMany()` via the API routes.

export function seedSMSMessages(): SMSMessage[] {
  return [];
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
    message: `VEYRO: ${data.message ?? 'You have a new notification.'} Reply STOP to opt out.`,
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
