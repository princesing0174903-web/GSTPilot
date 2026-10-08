// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO WhatsApp Connector™ — Business API Framework
// ═══════════════════════════════════════════════════════════════════════════════
//
// In production, WhatsApp Business API requires:
//   1. A Meta Business Account with WhatsApp Business Platform access
//   2. A verified phone number
//   3. A WhatsApp Business API token (permanent or temporary)
//   4. Webhook configuration for incoming messages
//
// This module stores the connection + provides the message parsing structure.
// When a real API token is provided, message history is fetched.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WhatsAppMetadata } from './types';

/** Validate an Indian phone number (with or without country code). */
export function validatePhoneNumber(phone: string): { valid: boolean; formatted: string; display: string } {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Indian numbers: +91 followed by 10 digits, or just 10 digits starting with 6-9
  let digits = cleaned;
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  const valid = /^\d{10}$/.test(digits) && /^[6-9]/.test(digits);
  const formatted = `+91${digits}`;
  const display = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return { valid, formatted, display };
}

/** Create WhatsApp connection metadata from user input. */
export function createWhatsAppMetadata(phone: string): WhatsAppMetadata {
  const { formatted, display } = validatePhoneNumber(phone);
  return {
    phoneNumber: formatted,
    displayName: display,
  };
}

/** Categorize a WhatsApp message for collections tracking. */
export type WhatsAppMessageType =
  | 'payment_reminder'
  | 'invoice_sent'
  | 'client_inquiry'
  | 'follow_up'
  | 'confirmation'
  | 'general';

/** A WhatsApp conversation/message relevant to collections. */
export interface WhatsAppMessage {
  messageId: string;
  contactName: string;
  contactPhone: string;
  direction: 'outbound' | 'inbound';
  messageText: string;
  timestamp: string;
  type: WhatsAppMessageType;
  relatedInvoice?: string;
  amountMentioned?: number;
}

/**
 * Classify a message text into a category for collections tracking.
 */
export function classifyMessage(text: string): WhatsAppMessageType {
  const t = text.toLowerCase();
  if (/reminder|due|overdue|payment.*pending|outstanding|please pay|kindly pay/.test(t)) {
    return 'payment_reminder';
  }
  if (/invoice|bill|gst|tax/.test(t)) return 'invoice_sent';
  if (/confirm|received|thank you|acknowledged|noted/.test(t)) return 'confirmation';
  if (/follow.?up|checking in|any update|status/.test(t)) return 'follow_up';
  if (/enquiry|quote|price|interested|question/.test(t)) return 'client_inquiry';
  return 'general';
}

/**
 * Identify clients who are ignoring payment reminders.
 * A client is "ignoring" if they received >= 2 outbound reminders but sent 0 inbound replies.
 */
export function identifyIgnoringClients(messages: WhatsAppMessage[]): Array<{
  contactName: string;
  contactPhone: string;
  remindersSent: number;
  lastReminderDate: string;
  daysSinceLastReminder: number;
}> {
  const byContact = new Map<string, WhatsAppMessage[]>();
  for (const msg of messages) {
    const key = msg.contactPhone;
    if (!byContact.has(key)) byContact.set(key, []);
    byContact.get(key)!.push(msg);
  }

  const ignoring: Array<{
    contactName: string;
    contactPhone: string;
    remindersSent: number;
    lastReminderDate: string;
    daysSinceLastReminder: number;
  }> = [];

  for (const [phone, msgs] of byContact) {
    const reminders = msgs.filter(
      (m) => m.direction === 'outbound' && m.type === 'payment_reminder',
    );
    const replies = msgs.filter((m) => m.direction === 'inbound');
    if (reminders.length >= 2 && replies.length === 0) {
      const lastReminder = reminders[reminders.length - 1];
      const lastDate = new Date(lastReminder.timestamp);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
      ignoring.push({
        contactName: lastReminder.contactName,
        contactPhone: phone,
        remindersSent: reminders.length,
        lastReminderDate: lastReminder.timestamp,
        daysSinceLastReminder: daysSince,
      });
    }
  }

  return ignoring.sort((a, b) => b.remindersSent - a.remindersSent);
}
