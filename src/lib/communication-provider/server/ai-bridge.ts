// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — AI Communication Bridge
//
// Connects the Communication Provider to the AI Oracle:
//   1. Reads recent Gmail + WhatsApp messages from Firestore (org-scoped).
//   2. Writes AI summaries to `ai_memory` so Oracle can answer questions like
//      "What GST notices have I received?" or "Which clients haven't replied?".
//   3. Generates communication-derived insights:
//       • Unread GST notices (critical, needs attention)
//       • Pending client replies (collection risk)
//       • Vendor invoices awaiting processing (expense risk)
//       • Bank alerts (liquidity risk)
//       • Sentiment trends (customer satisfaction)
//
// This module is SERVER-ONLY — it reads Firestore via the firebase/firestore
// server SDK and writes to ai_memory via the AI service.
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
import type { AIMemory, AIMemorySource } from '@/lib/ai-provider/types';
import { saveMemory, clearMemoriesByType, hashSummary } from '@/lib/ai-provider/service';
import type {
  EmailCategory,
  GmailMessage,
  ScheduledMessage,
  WhatsAppCategory,
  WhatsAppMessage,
} from './types';

// ─── Communication Context Snapshot ──────────────────────────────────────────

/**
 * A snapshot of the organization's communication state, used by the AI Oracle
 * to enrich its business context. Built from real Firestore data.
 */
export interface CommunicationSnapshot {
  /** True if any Gmail connection exists with status='connected'. */
  gmailConnected: boolean;
  /** Connected Gmail address. */
  gmailEmail: string | null;
  /** True if any WhatsApp connection exists with status='connected'. */
  whatsappConnected: boolean;
  /** Connected WhatsApp phone number. */
  whatsappPhoneNumber: string | null;
  /** Last 50 emails (newest first). */
  recentEmails: GmailMessage[];
  /** Last 50 WhatsApp messages (newest first). */
  recentWhatsAppMessages: WhatsAppMessage[];
  /** Count of unread GST notices. */
  unreadGstNotices: number;
  /** Count of unread vendor invoices. */
  unreadVendorInvoices: number;
  /** Count of pending client replies (outbound emails >24h without reply). */
  pendingClientReplies: number;
  /** Count of unread WhatsApp messages from customers. */
  unreadWhatsAppMessages: number;
  /** Count of pending scheduled reminders. */
  pendingReminders: number;
  /** Count of failed scheduled messages. */
  failedMessages: number;
  /** Sentiment breakdown of recent communications. */
  sentimentBreakdown: {
    urgent: number;
    negative: number;
    positive: number;
    neutral: number;
  };
}

// ─── Snapshot builder ────────────────────────────────────────────────────────

/**
 * Build the communication snapshot from real Firestore data.
 * Returns null if the org has no communications connected.
 */
export async function gatherCommunicationContext(
  organizationId: string,
): Promise<CommunicationSnapshot | null> {
  if (!organizationId) return null;

  // Read connections.
  const [gmailConns, waConns] = await Promise.all([
    readConnections(organizationId, 'gmail_connections'),
    readConnections(organizationId, 'whatsapp_connections'),
  ]);
  const gmailConn = gmailConns.find((c) => c.authStatus === 'connected') ?? null;
  const waConn = waConns.find((c) => c.authStatus === 'connected') ?? null;

  if (!gmailConn && !waConn) return null;

  // Read recent messages + scheduled messages in parallel.
  const [recentEmails, recentWhatsAppMessages, scheduled] = await Promise.all([
    gmailConn ? readGmailMessages(organizationId, 50) : Promise.resolve([] as GmailMessage[]),
    waConn ? readWhatsAppMessages(organizationId, 50) : Promise.resolve([] as WhatsAppMessage[]),
    readScheduledMessages(organizationId, 100),
  ]);

  // Compute aggregated metrics.
  const unreadGstNotices = recentEmails.filter(
    (m) => m.category === 'gst_notice' && m.readStatus === 'unread',
  ).length;
  const unreadVendorInvoices = recentEmails.filter(
    (m) => m.category === 'vendor_invoice' && m.readStatus === 'unread',
  ).length;

  // Pending client replies: outbound emails in the last 7 days.
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const pendingClientReplies = recentEmails.filter((m) => {
    if (m.direction !== 'outbound') return false;
    return new Date(m.receivedAt).getTime() >= sevenDaysAgo;
  }).length;

  const unreadWhatsAppMessages = recentWhatsAppMessages.filter(
    (m) => m.direction === 'inbound' && m.status !== 'read',
  ).length;

  const now = Date.now();
  const pendingReminders = scheduled.filter(
    (s) => (s.status === 'pending' || s.status === 'processing') && new Date(s.scheduledFor).getTime() <= now,
  ).length;
  const failedMessages = scheduled.filter((s) => s.status === 'failed').length;

  // Sentiment breakdown — count across all messages.
  const sentimentBreakdown = { urgent: 0, negative: 0, positive: 0, neutral: 0 };
  for (const m of recentEmails) {
    if (m.sentiment === 'urgent') sentimentBreakdown.urgent++;
    else if (m.sentiment === 'negative') sentimentBreakdown.negative++;
    else if (m.sentiment === 'positive') sentimentBreakdown.positive++;
    else if (m.sentiment === 'neutral') sentimentBreakdown.neutral++;
  }
  for (const m of recentWhatsAppMessages) {
    if (m.sentiment === 'urgent') sentimentBreakdown.urgent++;
    else if (m.sentiment === 'negative') sentimentBreakdown.negative++;
    else if (m.sentiment === 'positive') sentimentBreakdown.positive++;
    else if (m.sentiment === 'neutral') sentimentBreakdown.neutral++;
  }

  return {
    gmailConnected: !!gmailConn,
    gmailEmail: gmailConn?.email ?? null,
    whatsappConnected: !!waConn,
    whatsappPhoneNumber: waConn?.phoneNumber ?? null,
    recentEmails,
    recentWhatsAppMessages,
    unreadGstNotices,
    unreadVendorInvoices,
    pendingClientReplies,
    unreadWhatsAppMessages,
    pendingReminders,
    failedMessages,
    sentimentBreakdown,
  };
}

// ─── Communication Insights → AI Memory ──────────────────────────────────────

/**
 * Analyze the communication snapshot and write AI memory entries to ai_memory.
 * These summaries let Oracle answer questions like:
 *   - "What GST notices have I received?"
 *   - "Which clients haven't replied to my emails?"
 *   - "Are there any urgent customer messages?"
 *
 * Returns the count of memory entries written.
 */
export async function persistCommunicationInsightsToMemory(
  organizationId: string,
  snapshot: CommunicationSnapshot,
): Promise<number> {
  if (!organizationId) return 0;

  // Clear stale communication-sourced memories first.
  await clearMemoriesByType(organizationId, 'fact').catch(() => 0);

  const memories: Array<{ summary: string; metadata: Record<string, unknown> }> = [];

  // 1. Unread GST notices — list each with subject + sender.
  if (snapshot.unreadGstNotices > 0) {
    const notices = snapshot.recentEmails.filter(
      (m) => m.category === 'gst_notice' && m.readStatus === 'unread',
    );
    for (const n of notices.slice(0, 5)) {
      memories.push({
        summary: `Unread GST notice: "${n.subject}" from ${n.from}`,
        metadata: {
          category: 'gst_notice',
          messageId: n.id,
          from: n.from,
          subject: n.subject,
          receivedAt: n.receivedAt,
          aiSummary: n.aiSummary,
        },
      });
    }
  }

  // 2. Pending client replies — outbound emails waiting for response.
  if (snapshot.pendingClientReplies > 0) {
    memories.push({
      summary: `${snapshot.pendingClientReplies} email${snapshot.pendingClientReplies > 1 ? 's' : ''} sent to clients awaiting a reply (over 24 hours).`,
      metadata: {
        category: 'pending_client_replies',
        count: snapshot.pendingClientReplies,
      },
    });
  }

  // 3. Unread WhatsApp messages from customers.
  if (snapshot.unreadWhatsAppMessages > 0) {
    memories.push({
      summary: `${snapshot.unreadWhatsAppMessages} unread WhatsApp message${snapshot.unreadWhatsAppMessages > 1 ? 's' : ''} from customers awaiting a response.`,
      metadata: {
        category: 'unread_whatsapp',
        count: snapshot.unreadWhatsAppMessages,
      },
    });
  }

  // 4. Vendor invoices awaiting processing.
  if (snapshot.unreadVendorInvoices > 0) {
    memories.push({
      summary: `${snapshot.unreadVendorInvoices} unread vendor invoice${snapshot.unreadVendorInvoices > 1 ? 's' : ''} received — review and process for ITC.`,
      metadata: {
        category: 'vendor_invoices',
        count: snapshot.unreadVendorInvoices,
      },
    });
  }

  // 5. Pending reminders in the automation queue.
  if (snapshot.pendingReminders > 0) {
    memories.push({
      summary: `${snapshot.pendingReminders} scheduled reminder${snapshot.pendingReminders > 1 ? 's are' : ' is'} due to be sent.`,
      metadata: {
        category: 'pending_reminders',
        count: snapshot.pendingReminders,
      },
    });
  }

  // 6. Failed messages needing retry.
  if (snapshot.failedMessages > 0) {
    memories.push({
      summary: `${snapshot.failedMessages} scheduled message${snapshot.failedMessages > 1 ? 's have' : ' has'} failed delivery — retry needed.`,
      metadata: {
        category: 'failed_messages',
        count: snapshot.failedMessages,
      },
    });
  }

  // 7. Sentiment summary.
  if (snapshot.sentimentBreakdown.urgent > 0) {
    memories.push({
      summary: `${snapshot.sentimentBreakdown.urgent} recent communication${snapshot.sentimentBreakdown.urgent > 1 ? 's are' : ' is'} flagged as urgent.`,
      metadata: {
        category: 'sentiment_urgent',
        count: snapshot.sentimentBreakdown.urgent,
      },
    });
  }

  // Persist each memory entry.
  await Promise.all(
    memories.map((mem) =>
      saveMemory(organizationId, {
        type: 'fact',
        source: 'communication' as AIMemorySource,
        summary: mem.summary,
        embeddingPlaceholder: hashSummary(`comm|${organizationId}|${mem.summary.slice(0, 80)}`),
        metadata: mem.metadata,
      }).catch(() => null),
    ),
  );

  return memories.length;
}

// ─── Communication Context for Oracle Chat ───────────────────────────────────

/**
 * Build a concise text summary of the communication state for the Oracle chat
 * engine. This is appended to the business context so Oracle can answer
 * communication-related questions.
 */
export function buildCommunicationContextText(snapshot: CommunicationSnapshot): string {
  const lines: string[] = [];

  if (snapshot.gmailConnected) {
    lines.push(`Gmail connected: ${snapshot.gmailEmail}`);
    lines.push(`- ${snapshot.unreadGstNotices} unread GST notice(s)`);
    lines.push(`- ${snapshot.unreadVendorInvoices} unread vendor invoice(s)`);
    lines.push(`- ${snapshot.pendingClientReplies} pending client reply/replies`);
  } else {
    lines.push('Gmail: not connected');
  }

  if (snapshot.whatsappConnected) {
    lines.push(`WhatsApp connected: ${snapshot.whatsappPhoneNumber}`);
    lines.push(`- ${snapshot.unreadWhatsAppMessages} unread customer message(s)`);
  } else {
    lines.push('WhatsApp: not connected');
  }

  if (snapshot.pendingReminders > 0 || snapshot.failedMessages > 0) {
    lines.push(`Automation: ${snapshot.pendingReminders} pending reminder(s), ${snapshot.failedMessages} failed message(s)`);
  }

  if (snapshot.sentimentBreakdown.urgent > 0) {
    lines.push(`Sentiment: ${snapshot.sentimentBreakdown.urgent} urgent communication(s) detected`);
  }

  return lines.join('\n');
}

// ─── Firestore helpers (server-side reads) ───────────────────────────────────

async function readConnections(
  orgId: string,
  coll: 'gmail_connections' | 'whatsapp_connections',
): Promise<Array<{ id: string; authStatus: string; email?: string; phoneNumber?: string }>> {
  try {
    const q = query(
      collection(db, coll),
      where('organizationId', '==', orgId),
      limitFn(10),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        authStatus: String(raw.authStatus ?? 'disconnected'),
        email: raw.email ? String(raw.email) : undefined,
        phoneNumber: raw.phoneNumber ? String(raw.phoneNumber) : undefined,
      };
    });
  } catch {
    return [];
  }
}

async function readGmailMessages(orgId: string, max: number): Promise<GmailMessage[]> {
  try {
    const q = query(
      collection(db, 'gmail_messages'),
      where('organizationId', '==', orgId),
      orderBy('receivedAt', 'desc'),
      limitFn(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => gmailMessageFromRaw(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

async function readWhatsAppMessages(orgId: string, max: number): Promise<WhatsAppMessage[]> {
  try {
    const q = query(
      collection(db, 'whatsapp_messages'),
      where('organizationId', '==', orgId),
      orderBy('receivedAt', 'desc'),
      limitFn(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => whatsAppMessageFromRaw(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

async function readScheduledMessages(orgId: string, max: number): Promise<ScheduledMessage[]> {
  try {
    const q = query(
      collection(db, 'scheduled_messages'),
      where('organizationId', '==', orgId),
      orderBy('scheduledFor', 'desc'),
      limitFn(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => scheduledMessageFromRaw(d.id, d.data() as Record<string, unknown>));
  } catch {
    return [];
  }
}

function tsToString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  try {
    return new Date(value as string).toISOString();
  } catch {
    return '';
  }
}

function gmailMessageFromRaw(id: string, raw: Record<string, unknown>): GmailMessage {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    messageId: String(raw.messageId ?? ''),
    threadId: raw.threadId ? String(raw.threadId) : null,
    direction: (raw.direction as GmailMessage['direction']) ?? 'inbound',
    from: String(raw.from ?? ''),
    to: String(raw.to ?? ''),
    cc: raw.cc ? String(raw.cc) : null,
    bcc: raw.bcc ? String(raw.bcc) : null,
    replyTo: raw.replyTo ? String(raw.replyTo) : null,
    subject: String(raw.subject ?? ''),
    preview: String(raw.preview ?? ''),
    bodyHtml: raw.bodyHtml ? String(raw.bodyHtml) : null,
    bodyText: raw.bodyText ? String(raw.bodyText) : null,
    category: (raw.category as EmailCategory) ?? 'general',
    aiSummary: raw.aiSummary ? String(raw.aiSummary) : null,
    sentiment: (raw.sentiment as GmailMessage['sentiment']) ?? 'unknown',
    attachments: Array.isArray(raw.attachments) ? (raw.attachments as GmailMessage['attachments']) : [],
    readStatus: (raw.readStatus as GmailMessage['readStatus']) ?? 'unread',
    receivedAt: tsToString(raw.receivedAt),
    syncedAt: tsToString(raw.syncedAt),
    createdAt: tsToString(raw.createdAt),
    updatedAt: tsToString(raw.updatedAt),
  };
}

function whatsAppMessageFromRaw(id: string, raw: Record<string, unknown>): WhatsAppMessage {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    wamId: raw.wamId ? String(raw.wamId) : null,
    direction: (raw.direction as WhatsAppMessage['direction']) ?? 'inbound',
    from: String(raw.from ?? ''),
    to: String(raw.to ?? ''),
    contactName: raw.contactName ? String(raw.contactName) : null,
    messageType: (raw.messageType as WhatsAppMessage['messageType']) ?? 'text',
    messageBody: String(raw.messageBody ?? ''),
    mediaUrl: raw.mediaUrl ? String(raw.mediaUrl) : null,
    caption: raw.caption ? String(raw.caption) : null,
    category: (raw.category as WhatsAppCategory) ?? 'general',
    aiSummary: raw.aiSummary ? String(raw.aiSummary) : null,
    sentiment: (raw.sentiment as WhatsAppMessage['sentiment']) ?? 'unknown',
    status: (raw.status as WhatsAppMessage['status']) ?? 'queued',
    errorMessage: raw.errorMessage ? String(raw.errorMessage) : null,
    invoiceId: raw.invoiceId ? String(raw.invoiceId) : null,
    clientId: raw.clientId ? String(raw.clientId) : null,
    sentAt: raw.sentAt ? tsToString(raw.sentAt) : null,
    deliveredAt: raw.deliveredAt ? tsToString(raw.deliveredAt) : null,
    readAt: raw.readAt ? tsToString(raw.readAt) : null,
    receivedAt: tsToString(raw.receivedAt),
    syncedAt: tsToString(raw.syncedAt),
    createdAt: tsToString(raw.createdAt),
    updatedAt: tsToString(raw.updatedAt),
  };
}

function scheduledMessageFromRaw(id: string, raw: Record<string, unknown>): ScheduledMessage {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    channel: (raw.channel as ScheduledMessage['channel']) ?? 'whatsapp',
    connectionId: String(raw.connectionId ?? ''),
    recipient: String(raw.recipient ?? ''),
    recipientName: raw.recipientName ? String(raw.recipientName) : null,
    subject: raw.subject ? String(raw.subject) : null,
    body: String(raw.body ?? ''),
    category: (raw.category as ScheduledMessage['category']) ?? 'general',
    trigger: (raw.trigger as ScheduledMessage['trigger']) ?? 'manual',
    linkedEntityId: raw.linkedEntityId ? String(raw.linkedEntityId) : null,
    linkedEntityType: (raw.linkedEntityType as ScheduledMessage['linkedEntityType']) ?? null,
    scheduledFor: tsToString(raw.scheduledFor),
    recurrence: (raw.recurrence as ScheduledMessage['recurrence']) ?? 'once',
    nextRunAt: raw.nextRunAt ? tsToString(raw.nextRunAt) : null,
    status: (raw.status as ScheduledMessage['status']) ?? 'pending',
    sendCount: Number(raw.sendCount ?? 0),
    retryCount: Number(raw.retryCount ?? 0),
    maxRetries: Number(raw.maxRetries ?? 3),
    errorMessage: raw.errorMessage ? String(raw.errorMessage) : null,
    lastAttemptAt: raw.lastAttemptAt ? tsToString(raw.lastAttemptAt) : null,
    lastSentAt: raw.lastSentAt ? tsToString(raw.lastSentAt) : null,
    createdBy: (raw.createdBy as ScheduledMessage['createdBy']) ?? { uid: '', name: '', email: '' },
    createdAt: tsToString(raw.createdAt),
    updatedAt: tsToString(raw.updatedAt),
  };
}

// Re-export for type-only consumers.
export type { AIMemory };
