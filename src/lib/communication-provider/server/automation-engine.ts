// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Gmail & WhatsApp Business Automation™ — Automation Engine (SERVER-ONLY)
//
// The Automation Engine generates + dispatches scheduled reminders:
//   • Invoice reminders   — sent X days before an invoice's due date
//   • GST filing reminders — sent before GSTR-1 / GSTR-3B due dates
//   • Payment follow-ups  — sent when an invoice is overdue
//   • Recurring reminders — daily / weekly / monthly / quarterly
//
// The engine also:
//   • Retries failed messages (up to maxRetries)
//   • Advances recurring schedules (computes nextRunAt)
//   • Surfaces pending reminders to the dashboard via scheduled_messages
//
// This file is SERVER-ONLY — it reads from Firestore (via firebase/firestore
// server SDK and the client-safe service for writes). API routes are the only
// legitimate consumers.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as limitFn,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  ScheduledMessage,
  ScheduledMessageChannel,
  ScheduledMessageStatus,
  ScheduleRecurrence,
  WhatsAppCategory,
  EmailCategory,
} from '../types';
import {
  createScheduledMessage,
  getDueScheduledMessages,
  updateScheduledMessage,
  nextRunForRecurrence,
} from '../service';
import { sendEmail, sendWhatsAppMessage } from './orchestrator';
import { CommunicationError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new CommunicationError(
      'You must belong to an organization to run automations.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

// ─── Reminder templates ──────────────────────────────────────────────────────

/**
 * Generate the message body for an invoice reminder.
 */
export function invoiceReminderBody(
  clientName: string,
  invoiceNumber: string,
  amount: number,
  dueDate: string,
  businessName: string,
  channel: ScheduledMessageChannel,
): { subject: string | null; body: string } {
  const subject = `Reminder: Invoice ${invoiceNumber} due on ${dueDate}`;
  const bodyText =
    channel === 'whatsapp'
      ? `Dear ${clientName}, this is a friendly reminder that invoice ${invoiceNumber} for ₹${amount.toLocaleString(
          'en-IN',
        )} is due on ${dueDate}. Kindly process the payment. - ${businessName}`
      : `Dear ${clientName},\n\nThis is a friendly reminder that invoice ${invoiceNumber} for ₹${amount.toLocaleString(
          'en-IN',
        )} is due on ${dueDate}. Kindly process the payment at your earliest convenience.\n\nIf you have already paid, please disregard this message.\n\nRegards,\n${businessName}`;
  return { subject: channel === 'gmail' ? subject : null, body: bodyText };
}

/**
 * Generate the message body for a payment follow-up (overdue).
 */
export function paymentFollowupBody(
  clientName: string,
  invoiceNumber: string,
  amount: number,
  daysOverdue: number,
  businessName: string,
  channel: ScheduledMessageChannel,
): { subject: string | null; body: string } {
  const subject = `OVERDUE: Invoice ${invoiceNumber} — ${daysOverdue} days past due`;
  const bodyText =
    channel === 'whatsapp'
      ? `Dear ${clientName}, your payment of ₹${amount.toLocaleString(
          'en-IN',
        )} for invoice ${invoiceNumber} is overdue by ${daysOverdue} days. Kindly arrange payment today. - ${businessName}`
      : `Dear ${clientName},\n\nYour payment of ₹${amount.toLocaleString(
          'en-IN',
        )} for invoice ${invoiceNumber} is now ${daysOverdue} days overdue.\n\nPlease process the payment urgently to avoid any disruption in services. If you have already paid, please share the payment details so we can update our records.\n\nRegards,\n${businessName}`;
  return { subject: channel === 'gmail' ? subject : null, body: bodyText };
}

/**
 * Generate the message body for a GST filing reminder.
 */
export function gstFilingReminderBody(
  returnType: string,
  period: string,
  dueDate: string,
  businessName: string,
  channel: ScheduledMessageChannel,
): { subject: string | null; body: string } {
  const subject = `Reminder: ${returnType} for ${period} due on ${dueDate}`;
  const bodyText =
    channel === 'whatsapp'
      ? `Reminder: ${returnType} for ${period} is due on ${dueDate}. File early to avoid penalty. - ${businessName}`
      : `Hello,\n\nThis is a reminder that ${returnType} for the period ${period} is due on ${dueDate}.\n\nPlease file your return early to avoid late fees and penalties.\n\nRegards,\n${businessName}`;
  return { subject: channel === 'gmail' ? subject : null, body: bodyText };
}

// ─── Schedule Creation ───────────────────────────────────────────────────────

export interface CreateScheduleInput {
  organizationId: string;
  channel: ScheduledMessageChannel;
  connectionId: string;
  recipient: string;
  recipientName: string | null;
  subject: string | null;
  body: string;
  category: WhatsAppCategory | EmailCategory;
  trigger: ScheduledMessage['trigger'];
  linkedEntityId: string | null;
  linkedEntityType: ScheduledMessage['linkedEntityType'];
  scheduledFor: string;
  recurrence?: ScheduleRecurrence;
  createdBy: { uid: string; name: string; email: string };
}

/**
 * Create a scheduled message. Returns the scheduleId.
 */
export async function scheduleMessage(input: CreateScheduleInput): Promise<string> {
  assertOrg(input.organizationId);
  const recurrence = input.recurrence ?? 'once';
  const nextRunAt = recurrence !== 'once' ? nextRunForRecurrence(recurrence, new Date(input.scheduledFor)) : null;
  return createScheduledMessage(input.organizationId, {
    organizationId: input.organizationId,
    channel: input.channel,
    connectionId: input.connectionId,
    recipient: input.recipient,
    recipientName: input.recipientName,
    subject: input.subject,
    body: input.body,
    category: input.category,
    trigger: input.trigger,
    linkedEntityId: input.linkedEntityId,
    linkedEntityType: input.linkedEntityType,
    scheduledFor: input.scheduledFor,
    recurrence,
    nextRunAt,
    status: 'pending',
    maxRetries: 3,
    createdBy: input.createdBy,
  });
}

/**
 * Cancel a scheduled message. Idempotent — does not throw if already sent.
 */
export async function cancelScheduledMessage(
  organizationId: string,
  scheduleId: string,
): Promise<void> {
  assertOrg(organizationId);
  await updateScheduledMessage(organizationId, scheduleId, {
    status: 'cancelled',
  });
}

// ─── Auto-Generation of Reminders ────────────────────────────────────────────

interface InvoiceForReminders {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientId: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  grandTotal: number;
  balanceDue: number;
  dueDate: string | null;
  status: string;
}

interface ReturnForReminders {
  id: string;
  returnType: string;
  period: string;
  status: string;
  dueDate: string | null;
}

/**
 * Auto-generate reminders for overdue invoices and upcoming GST filings.
 * Skips schedules that already exist for the same entity + trigger + day.
 *
 * This is the heart of the Automation Engine — it runs on a periodic schedule
 * (cron-style) and ensures every overdue invoice / upcoming GST filing has a
 * reminder queued.
 */
export async function autoGenerateReminders(
  organizationId: string,
  options: {
    gmailConnectionId?: string | null;
    whatsappConnectionId?: string | null;
    businessName: string;
    preferredChannel: ScheduledMessageChannel;
    createdBy: { uid: string; name: string; email: string };
  },
): Promise<{ invoicesProcessed: number; returnsProcessed: number; schedulesCreated: number }> {
  assertOrg(organizationId);
  const connectionId =
    options.preferredChannel === 'gmail' ? options.gmailConnectionId : options.whatsappConnectionId;
  if (!connectionId) {
    // No connection on the preferred channel — fall back to the other.
    const fallback = options.preferredChannel === 'gmail' ? options.whatsappConnectionId : options.gmailConnectionId;
    if (!fallback) return { invoicesProcessed: 0, returnsProcessed: 0, schedulesCreated: 0 };
    options.preferredChannel = options.preferredChannel === 'gmail' ? 'whatsapp' : 'gmail';
  }

  // 1. Read overdue + upcoming invoices from Firestore.
  const invoices = await readInvoicesForReminders(organizationId);
  // 2. Read upcoming GST returns from Firestore.
  const returns = await readReturnsForReminders(organizationId);

  let schedulesCreated = 0;

  // Dedupe against already-scheduled reminders (avoid duplicate reminders for
  // the same invoice on the same day).
  const existingSchedules = await readExistingSchedules(organizationId);
  const dedupeKey = (entityId: string, trigger: string) => `${entityId}:${trigger}:${new Date().toISOString().slice(0, 10)}`;
  const existingKeys = new Set(
    existingSchedules.map((s) => dedupeKey(s.linkedEntityId ?? '', s.trigger)),
  );

  // 3. For each overdue invoice, schedule a payment follow-up.
  const now = new Date();
  for (const inv of invoices) {
    if (!inv.dueDate) continue;
    const due = new Date(inv.dueDate);
    if (due > now) continue; // not overdue yet

    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    // Only schedule if overdue by at least 1 day.
    if (daysOverdue < 1) continue;

    const key = dedupeKey(inv.id, 'payment_followup');
    if (existingKeys.has(key)) continue;

    const recipient = options.preferredChannel === 'gmail' ? inv.clientEmail : inv.clientPhone;
    if (!recipient) continue;

    const { subject, body } = paymentFollowupBody(
      inv.clientName,
      inv.invoiceNumber,
      inv.balanceDue,
      daysOverdue,
      options.businessName,
      options.preferredChannel,
    );

    await scheduleMessage({
      organizationId,
      channel: options.preferredChannel,
      connectionId: options.preferredChannel === 'gmail' ? options.gmailConnectionId! : options.whatsappConnectionId!,
      recipient,
      recipientName: inv.clientName,
      subject,
      body,
      category: 'payment_followup',
      trigger: 'payment_followup',
      linkedEntityId: inv.id,
      linkedEntityType: 'invoice',
      scheduledFor: new Date(now.getTime() + 60_000).toISOString(), // send in 1 minute
      createdBy: options.createdBy,
    });
    schedulesCreated++;
  }

  // 4. For each upcoming GST return (not filed, due in next 7 days), schedule a reminder.
  for (const ret of returns) {
    if (ret.status === 'filed' || !ret.dueDate) continue;
    const due = new Date(ret.dueDate);
    const daysUntil = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0 || daysUntil > 7) continue;

    const key = dedupeKey(ret.id, 'gst_filing');
    if (existingKeys.has(key)) continue;

    // GST filing reminders go to the org's internal team — send via the
    // business's own Gmail (so it lands in the inbox the team monitors).
    if (!options.gmailConnectionId) continue;

    const { subject, body } = gstFilingReminderBody(
      ret.returnType,
      ret.period,
      ret.dueDate,
      options.businessName,
      'gmail',
    );

    // Send to the connected Gmail's own address (internal reminder).
    // We don't know the connected email here — the orchestrator will fill it
    // from the connection when dispatching. For now, set recipient to "" and
    // let the dispatcher resolve.
    await scheduleMessage({
      organizationId,
      channel: 'gmail',
      connectionId: options.gmailConnectionId,
      recipient: 'self',
      recipientName: options.businessName,
      subject,
      body,
      category: 'gst_notice',
      trigger: 'gst_filing',
      linkedEntityId: ret.id,
      linkedEntityType: 'return',
      scheduledFor: new Date(now.getTime() + 60_000).toISOString(),
      createdBy: options.createdBy,
    });
    schedulesCreated++;
  }

  return {
    invoicesProcessed: invoices.length,
    returnsProcessed: returns.length,
    schedulesCreated,
  };
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Dispatch all due scheduled messages for an organization. This is the
 * run-loop entry point — call it periodically (cron).
 *
 * For each due schedule:
 *   1. Look up the connection (Gmail / WhatsApp) + decrypt the session.
 *   2. Call the provider's send method.
 *   3. On success: mark as sent (or advance nextRunAt for recurring).
 *   4. On failure: increment retryCount; if exceeded maxRetries, mark as failed.
 */
export async function dispatchDueScheduledMessages(
  organizationId: string,
): Promise<{ dispatched: number; succeeded: number; failed: number; advanced: number }> {
  assertOrg(organizationId);
  const due = await getDueScheduledMessages(organizationId);
  let succeeded = 0;
  let failed = 0;
  let advanced = 0;

  for (const schedule of due) {
    // Mark as processing.
    await updateScheduledMessage(organizationId, schedule.id, {
      status: 'processing',
      lastAttemptAt: new Date().toISOString(),
    });

    try {
      // Look up the connection.
      const conn = await lookupConnection(organizationId, schedule.channel, schedule.connectionId);
      if (!conn) {
        throw new CommunicationError('Connection not found.', {
          code: 'NOT_CONNECTED',
          statusCode: 409,
        });
      }

      const encryptedConnection = conn.encryptedConnection;
      if (!encryptedConnection) {
        throw new CommunicationError('Connection has no encrypted session.', {
          code: 'SESSION_EXPIRED',
          statusCode: 401,
        });
      }

      // Resolve "self" recipient (for internal GST reminders).
      let recipient = schedule.recipient;
      if (recipient === 'self' && schedule.channel === 'gmail') {
        recipient = (conn as { email?: string }).email ?? schedule.recipient;
      }

      // Dispatch via the right provider.
      if (schedule.channel === 'gmail') {
        await sendEmail(organizationId, schedule.connectionId, encryptedConnection, {
          to: recipient,
          subject: schedule.subject ?? '(no subject)',
          bodyHtml: schedule.body.replace(/\n/g, '<br>'),
          bodyText: schedule.body,
        });
      } else {
        await sendWhatsAppMessage(organizationId, schedule.connectionId, encryptedConnection, {
          to: recipient,
          messageType: 'text',
          body: schedule.body,
          category: schedule.category as WhatsAppCategory,
        });
      }

      // Success — mark as sent or advance recurring.
      if (schedule.recurrence !== 'once' && schedule.nextRunAt) {
        const nextRun = nextRunForRecurrence(schedule.recurrence, new Date(schedule.nextRunAt));
        await updateScheduledMessage(organizationId, schedule.id, {
          status: 'pending',
          lastSentAt: new Date().toISOString(),
          sendCount: schedule.sendCount + 1,
          scheduledFor: schedule.nextRunAt,
          nextRunAt: nextRun,
          errorMessage: null,
        });
        advanced++;
      } else {
        await updateScheduledMessage(organizationId, schedule.id, {
          status: 'sent',
          lastSentAt: new Date().toISOString(),
          sendCount: schedule.sendCount + 1,
          errorMessage: null,
        });
      }
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      const newRetry = schedule.retryCount + 1;
      if (newRetry >= schedule.maxRetries) {
        await updateScheduledMessage(organizationId, schedule.id, {
          status: 'failed',
          retryCount: newRetry,
          errorMessage: msg,
        });
        failed++;
      } else {
        // Re-queue with exponential backoff.
        const backoffMs = Math.pow(2, newRetry) * 60 * 1000; // 2 min, 4 min, 8 min...
        const nextAttempt = new Date(Date.now() + backoffMs).toISOString();
        await updateScheduledMessage(organizationId, schedule.id, {
          status: 'pending',
          retryCount: newRetry,
          errorMessage: msg,
          scheduledFor: nextAttempt,
        });
        failed++;
      }
    }
  }

  return {
    dispatched: due.length,
    succeeded,
    failed,
    advanced,
  };
}

/**
 * Retry all failed scheduled messages (manual "retry all" action).
 */
export async function retryFailedScheduledMessages(
  organizationId: string,
): Promise<{ retried: number }> {
  assertOrg(organizationId);
  const q = query(
    collection(db, 'scheduled_messages'),
    where('organizationId', '==', organizationId),
    where('status', '==', 'failed'),
  );
  const snap = await getDocs(q);
  let retried = 0;
  for (const d of snap.docs) {
    await updateScheduledMessage(organizationId, d.id, {
      status: 'pending',
      retryCount: 0,
      errorMessage: null,
      scheduledFor: new Date(Date.now() + 60_000).toISOString(),
    });
    retried++;
  }
  return { retried };
}

// ─── Firestore helpers (server-side reads) ───────────────────────────────────

async function readInvoicesForReminders(orgId: string): Promise<InvoiceForReminders[]> {
  try {
    const q = query(
      collection(db, 'invoices'),
      where('organizationId', '==', orgId),
      where('invoiceType', '==', 'sales'),
      limitFn(500),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        invoiceNumber: String(raw.invoiceNumber ?? ''),
        clientName: String(raw.customerName ?? raw.clientName ?? 'Customer'),
        clientId: raw.customerId ? String(raw.customerId) : raw.clientId ? String(raw.clientId) : null,
        clientEmail: raw.customerEmail ? String(raw.customerEmail) : null,
        clientPhone: raw.customerPhone ? String(raw.customerPhone) : null,
        grandTotal: Number(raw.grandTotal ?? 0),
        balanceDue: Number(raw.balanceDue ?? 0),
        dueDate: raw.dueDate ? String(raw.dueDate) : null,
        status: String(raw.status ?? 'sent'),
      };
    });
  } catch {
    return [];
  }
}

async function readReturnsForReminders(orgId: string): Promise<ReturnForReminders[]> {
  try {
    const q = query(
      collection(db, 'gst_returns'),
      where('organizationId', '==', orgId),
      orderBy('period', 'desc'),
      limitFn(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        returnType: String(raw.returnType ?? 'GSTR-3B'),
        period: String(raw.period ?? ''),
        status: String(raw.status ?? 'not_filed'),
        dueDate: raw.dueDate ? String(raw.dueDate) : null,
      };
    });
  } catch {
    return [];
  }
}

async function readExistingSchedules(orgId: string): Promise<ScheduledMessage[]> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const q = query(
      collection(db, 'scheduled_messages'),
      where('organizationId', '==', orgId),
      where('scheduledFor', '>=', today),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        organizationId: orgId,
        channel: (raw.channel as ScheduledMessageChannel) ?? 'whatsapp',
        connectionId: String(raw.connectionId ?? ''),
        recipient: String(raw.recipient ?? ''),
        recipientName: raw.recipientName ? String(raw.recipientName) : null,
        subject: raw.subject ? String(raw.subject) : null,
        body: String(raw.body ?? ''),
        category: (raw.category as ScheduledMessage['category']) ?? 'general',
        trigger: (raw.trigger as ScheduledMessage['trigger']) ?? 'manual',
        linkedEntityId: raw.linkedEntityId ? String(raw.linkedEntityId) : null,
        linkedEntityType: (raw.linkedEntityType as ScheduledMessage['linkedEntityType']) ?? null,
        scheduledFor: raw.scheduledFor instanceof Timestamp ? raw.scheduledFor.toDate().toISOString() : String(raw.scheduledFor ?? ''),
        recurrence: (raw.recurrence as ScheduleRecurrence) ?? 'once',
        nextRunAt: raw.nextRunAt ? (raw.nextRunAt instanceof Timestamp ? raw.nextRunAt.toDate().toISOString() : String(raw.nextRunAt)) : null,
        status: (raw.status as ScheduledMessageStatus) ?? 'pending',
        sendCount: Number(raw.sendCount ?? 0),
        retryCount: Number(raw.retryCount ?? 0),
        maxRetries: Number(raw.maxRetries ?? 3),
        errorMessage: raw.errorMessage ? String(raw.errorMessage) : null,
        lastAttemptAt: raw.lastAttemptAt ? (raw.lastAttemptAt instanceof Timestamp ? raw.lastAttemptAt.toDate().toISOString() : String(raw.lastAttemptAt)) : null,
        lastSentAt: raw.lastSentAt ? (raw.lastSentAt instanceof Timestamp ? raw.lastSentAt.toDate().toISOString() : String(raw.lastSentAt)) : null,
        createdBy: (raw.createdBy as ScheduledMessage['createdBy']) ?? { uid: '', name: '', email: '' },
        createdAt: '',
        updatedAt: '',
      };
    });
  } catch {
    return [];
  }
}

async function lookupConnection(
  orgId: string,
  channel: ScheduledMessageChannel,
  connectionId: string,
): Promise<{ encryptedConnection: string | null; email?: string; phoneNumber?: string } | null> {
  try {
    const collName = channel === 'gmail' ? 'gmail_connections' : 'whatsapp_connections';
    const q = query(
      collection(db, collName),
      where('organizationId', '==', orgId),
      where('__name__', '==', connectionId),
      limitFn(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const raw = snap.docs[0].data() as Record<string, unknown>;
    return {
      encryptedConnection: raw.encryptedConnection ? String(raw.encryptedConnection) : null,
      email: raw.email ? String(raw.email) : undefined,
      phoneNumber: raw.phoneNumber ? String(raw.phoneNumber) : undefined,
    };
  } catch {
    return null;
  }
}
