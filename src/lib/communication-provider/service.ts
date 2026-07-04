// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — Client-Safe Firestore Service
//
// The single entry point for all communication Firestore operations on the
// CLIENT side. Mirrors the banking-provider / ai-provider service pattern:
//   • Real-time subscriptions via onSnapshot (org-scoped)
//   • CRUD writes via the Firebase client SDK (rules enforce org isolation)
//   • Multi-tenant — every function filters on `organizationId`
//
// This module is CLIENT-SAFE — it only imports from `firebase/firestore` and
// `@/lib/firebase` (the client SDK). It NEVER imports the provider, crypto, or
// any server-only code.
//
// Collections managed:
//   • gmail_connections        — Gmail OAuth sessions (encrypted)
//   • whatsapp_connections     — WhatsApp Cloud API tokens (encrypted)
//   • gmail_messages           — Inbound + outbound emails
//   • whatsapp_messages        — Inbound + outbound WhatsApp messages
//   • scheduled_messages       — Automation engine queue
//   • communication_sync_jobs  — Sync observability
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as limitFn,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  CommunicationSummary,
  CommunicationSyncJob,
  CommunicationSyncStatus,
  CommunicationSyncTrigger,
  EmailAttachment,
  EmailCategory,
  EmailReadStatus,
  GmailAuthStatus,
  GmailConnection,
  GmailMessage,
  ScheduledMessage,
  ScheduledMessageChannel,
  ScheduledMessageStatus,
  WhatsAppAuthStatus,
  WhatsAppCategory,
  WhatsAppConnection,
  WhatsAppDeliveryStatus,
  WhatsAppMessage,
  WhatsAppMessageType,
} from './types';
import { CommunicationError } from './errors';
import { hasPendingReply } from './communication-analysis';

// ─── Collection names ────────────────────────────────────────────────────────

export const COMMUNICATION_COLLECTIONS = {
  GMAIL_CONNECTIONS: 'gmail_connections',
  WHATSAPP_CONNECTIONS: 'whatsapp_connections',
  GMAIL_MESSAGES: 'gmail_messages',
  WHATSAPP_MESSAGES: 'whatsapp_messages',
  SCHEDULED_MESSAGES: 'scheduled_messages',
  SYNC_JOBS: 'communication_sync_jobs',
} as const;

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new CommunicationError(
      'You must belong to an organization to manage communications.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

// ─── Timestamp conversion ────────────────────────────────────────────────────

function ts(value: unknown): string {
  if (!value) return '';
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  try {
    return new Date(value as string).toISOString();
  } catch {
    return '';
  }
}

function toAttachmentArray(raw: unknown): EmailAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    const a = r as Record<string, unknown>;
    return {
      id: String(a.id ?? `att-${i}`),
      filename: String(a.filename ?? 'unknown'),
      mimeType: String(a.mimeType ?? 'application/octet-stream'),
      size: Number(a.size ?? 0),
      storageUrl: a.storageUrl ? String(a.storageUrl) : null,
    };
  });
}

// ─── Gmail Connection ────────────────────────────────────────────────────────

export function toGmailConnection(id: string, raw: Record<string, unknown>): GmailConnection {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    email: String(raw.email ?? ''),
    displayName: raw.displayName ? String(raw.displayName) : null,
    provider: (raw.provider as GmailConnection['provider']) ?? 'mock',
    authStatus: (raw.authStatus as GmailAuthStatus) ?? 'disconnected',
    lastSync: raw.lastSync ? ts(raw.lastSync) : null,
    sessionExpiry: raw.sessionExpiry ? ts(raw.sessionExpiry) : null,
    encryptedConnection: raw.encryptedConnection ? String(raw.encryptedConnection) : null,
    scopes: Array.isArray(raw.scopes) ? (raw.scopes as string[]) : [],
    lastError: raw.lastError ? String(raw.lastError) : null,
    createdBy: (raw.createdBy as GmailConnection['createdBy']) ?? { uid: '', name: '', email: '' },
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToGmailConnections(
  organizationId: string,
  callback: (connections: GmailConnection[]) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, COMMUNICATION_COLLECTIONS.GMAIL_CONNECTIONS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toGmailConnection(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err),
  );
}

export async function getGmailConnections(organizationId: string): Promise<GmailConnection[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, COMMUNICATION_COLLECTIONS.GMAIL_CONNECTIONS),
    where('organizationId', '==', organizationId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toGmailConnection(d.id, d.data() as Record<string, unknown>));
}

export async function saveGmailConnection(
  organizationId: string,
  data: Omit<GmailConnection, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, COMMUNICATION_COLLECTIONS.GMAIL_CONNECTIONS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGmailConnection(
  organizationId: string,
  connectionId: string,
  patch: Partial<GmailConnection>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, COMMUNICATION_COLLECTIONS.GMAIL_CONNECTIONS, connectionId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteGmailConnection(organizationId: string, connectionId: string): Promise<void> {
  assertOrg(organizationId);
  await deleteDoc(doc(db, COMMUNICATION_COLLECTIONS.GMAIL_CONNECTIONS, connectionId));
}

// ─── WhatsApp Connection ─────────────────────────────────────────────────────

export function toWhatsAppConnection(id: string, raw: Record<string, unknown>): WhatsAppConnection {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    phoneNumber: String(raw.phoneNumber ?? ''),
    businessName: raw.businessName ? String(raw.businessName) : null,
    displayPhoneNumber: raw.displayPhoneNumber ? String(raw.displayPhoneNumber) : null,
    provider: (raw.provider as WhatsAppConnection['provider']) ?? 'mock',
    authStatus: (raw.authStatus as WhatsAppAuthStatus) ?? 'disconnected',
    lastSync: raw.lastSync ? ts(raw.lastSync) : null,
    sessionExpiry: raw.sessionExpiry ? ts(raw.sessionExpiry) : null,
    encryptedConnection: raw.encryptedConnection ? String(raw.encryptedConnection) : null,
    phoneNumberId: raw.phoneNumberId ? String(raw.phoneNumberId) : null,
    wabaId: raw.wabaId ? String(raw.wabaId) : null,
    qualityRating: (raw.qualityRating as WhatsAppConnection['qualityRating']) ?? 'UNKNOWN',
    messagingLimitTier: raw.messagingLimitTier ? String(raw.messagingLimitTier) : null,
    lastError: raw.lastError ? String(raw.lastError) : null,
    createdBy: (raw.createdBy as WhatsAppConnection['createdBy']) ?? { uid: '', name: '', email: '' },
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToWhatsAppConnections(
  organizationId: string,
  callback: (connections: WhatsAppConnection[]) => void,
  options?: { onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const q = query(
    collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_CONNECTIONS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toWhatsAppConnection(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err),
  );
}

export async function getWhatsAppConnections(organizationId: string): Promise<WhatsAppConnection[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_CONNECTIONS),
    where('organizationId', '==', organizationId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toWhatsAppConnection(d.id, d.data() as Record<string, unknown>));
}

export async function saveWhatsAppConnection(
  organizationId: string,
  data: Omit<WhatsAppConnection, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_CONNECTIONS), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateWhatsAppConnection(
  organizationId: string,
  connectionId: string,
  patch: Partial<WhatsAppConnection>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, COMMUNICATION_COLLECTIONS.WHATSAPP_CONNECTIONS, connectionId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteWhatsAppConnection(organizationId: string, connectionId: string): Promise<void> {
  assertOrg(organizationId);
  await deleteDoc(doc(db, COMMUNICATION_COLLECTIONS.WHATSAPP_CONNECTIONS, connectionId));
}

// ─── Gmail Messages ──────────────────────────────────────────────────────────

export function toGmailMessage(id: string, raw: Record<string, unknown>): GmailMessage {
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
    attachments: toAttachmentArray(raw.attachments),
    readStatus: (raw.readStatus as EmailReadStatus) ?? 'unread',
    receivedAt: ts(raw.receivedAt),
    syncedAt: ts(raw.syncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToGmailMessages(
  organizationId: string,
  callback: (messages: GmailMessage[]) => void,
  options?: { limitCount?: number; category?: EmailCategory; onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('receivedAt', 'desc'),
  ];
  if (options?.category) {
    constraints.unshift(where('category', '==', options.category));
  }
  if (options?.limitCount) {
    constraints.push(limitFn(options.limitCount));
  }
  const q = query(collection(db, COMMUNICATION_COLLECTIONS.GMAIL_MESSAGES), ...constraints);
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toGmailMessage(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err),
  );
}

export async function getGmailMessages(
  organizationId: string,
  options?: { limitCount?: number; category?: EmailCategory },
): Promise<GmailMessage[]> {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('receivedAt', 'desc'),
  ];
  if (options?.category) {
    constraints.unshift(where('category', '==', options.category));
  }
  if (options?.limitCount) {
    constraints.push(limitFn(options.limitCount));
  }
  const q = query(collection(db, COMMUNICATION_COLLECTIONS.GMAIL_MESSAGES), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => toGmailMessage(d.id, d.data() as Record<string, unknown>));
}

/**
 * Bulk save synced emails. Existing messages (same messageId) are skipped.
 * Returns the number actually written.
 */
export async function saveGmailMessages(
  organizationId: string,
  messages: GmailMessage[],
): Promise<number> {
  assertOrg(organizationId);
  if (messages.length === 0) return 0;

  // Check which messageIds already exist (dedupe by messageId).
  const existingQ = query(
    collection(db, COMMUNICATION_COLLECTIONS.GMAIL_MESSAGES),
    where('organizationId', '==', organizationId),
    where('messageId', 'in', messages.slice(0, 30).map((m) => m.messageId)),
  );
  const existingSnap = await getDocs(existingQ);
  const existingIds = new Set(existingSnap.docs.map((d) => (d.data() as { messageId: string }).messageId));

  const batch = writeBatch(db);
  let count = 0;
  for (const msg of messages) {
    if (existingIds.has(msg.messageId)) continue;
    const ref = doc(collection(db, COMMUNICATION_COLLECTIONS.GMAIL_MESSAGES));
    batch.set(ref, {
      ...msg,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
  }
  if (count > 0) await batch.commit();
  return count;
}

export async function updateGmailMessage(
  organizationId: string,
  messageId: string,
  patch: Partial<GmailMessage>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, COMMUNICATION_COLLECTIONS.GMAIL_MESSAGES, messageId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteGmailMessagesForConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  const q = query(
    collection(db, COMMUNICATION_COLLECTIONS.GMAIL_MESSAGES),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.docs.length > 0) await batch.commit();
}

// ─── WhatsApp Messages ───────────────────────────────────────────────────────

export function toWhatsAppMessage(id: string, raw: Record<string, unknown>): WhatsAppMessage {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    wamId: raw.wamId ? String(raw.wamId) : null,
    direction: (raw.direction as WhatsAppMessage['direction']) ?? 'inbound',
    from: String(raw.from ?? ''),
    to: String(raw.to ?? ''),
    contactName: raw.contactName ? String(raw.contactName) : null,
    messageType: (raw.messageType as WhatsAppMessageType) ?? 'text',
    messageBody: String(raw.messageBody ?? ''),
    mediaUrl: raw.mediaUrl ? String(raw.mediaUrl) : null,
    caption: raw.caption ? String(raw.caption) : null,
    category: (raw.category as WhatsAppCategory) ?? 'general',
    aiSummary: raw.aiSummary ? String(raw.aiSummary) : null,
    sentiment: (raw.sentiment as WhatsAppMessage['sentiment']) ?? 'unknown',
    status: (raw.status as WhatsAppDeliveryStatus) ?? 'queued',
    errorMessage: raw.errorMessage ? String(raw.errorMessage) : null,
    invoiceId: raw.invoiceId ? String(raw.invoiceId) : null,
    clientId: raw.clientId ? String(raw.clientId) : null,
    sentAt: raw.sentAt ? ts(raw.sentAt) : null,
    deliveredAt: raw.deliveredAt ? ts(raw.deliveredAt) : null,
    readAt: raw.readAt ? ts(raw.readAt) : null,
    receivedAt: ts(raw.receivedAt),
    syncedAt: ts(raw.syncedAt),
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToWhatsAppMessages(
  organizationId: string,
  callback: (messages: WhatsAppMessage[]) => void,
  options?: { limitCount?: number; category?: WhatsAppCategory; onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('receivedAt', 'desc'),
  ];
  if (options?.category) {
    constraints.unshift(where('category', '==', options.category));
  }
  if (options?.limitCount) {
    constraints.push(limitFn(options.limitCount));
  }
  const q = query(collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_MESSAGES), ...constraints);
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toWhatsAppMessage(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err),
  );
}

export async function getWhatsAppMessages(
  organizationId: string,
  options?: { limitCount?: number; category?: WhatsAppCategory },
): Promise<WhatsAppMessage[]> {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('receivedAt', 'desc'),
  ];
  if (options?.category) {
    constraints.unshift(where('category', '==', options.category));
  }
  if (options?.limitCount) {
    constraints.push(limitFn(options.limitCount));
  }
  const q = query(collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_MESSAGES), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => toWhatsAppMessage(d.id, d.data() as Record<string, unknown>));
}

export async function saveWhatsAppMessages(
  organizationId: string,
  messages: WhatsAppMessage[],
): Promise<number> {
  assertOrg(organizationId);
  if (messages.length === 0) return 0;

  // Dedupe by wamId (or body+recipient+timestamp for messages without wamId).
  const wamIds = messages.filter((m) => m.wamId).slice(0, 30).map((m) => m.wamId as string);
  const existingIds = new Set<string>();
  if (wamIds.length > 0) {
    const existingQ = query(
      collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_MESSAGES),
      where('organizationId', '==', organizationId),
      where('wamId', 'in', wamIds),
    );
    const existingSnap = await getDocs(existingQ);
    existingSnap.docs.forEach((d) => existingIds.add((d.data() as { wamId: string }).wamId));
  }

  const batch = writeBatch(db);
  let count = 0;
  for (const msg of messages) {
    if (msg.wamId && existingIds.has(msg.wamId)) continue;
    const ref = doc(collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_MESSAGES));
    batch.set(ref, {
      ...msg,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
  }
  if (count > 0) await batch.commit();
  return count;
}

export async function updateWhatsAppMessage(
  organizationId: string,
  messageId: string,
  patch: Partial<WhatsAppMessage>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, COMMUNICATION_COLLECTIONS.WHATSAPP_MESSAGES, messageId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteWhatsAppMessagesForConnection(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  const q = query(
    collection(db, COMMUNICATION_COLLECTIONS.WHATSAPP_MESSAGES),
    where('organizationId', '==', organizationId),
    where('connectionId', '==', connectionId),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  if (snap.docs.length > 0) await batch.commit();
}

// ─── Scheduled Messages ──────────────────────────────────────────────────────

export function toScheduledMessage(id: string, raw: Record<string, unknown>): ScheduledMessage {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
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
    scheduledFor: ts(raw.scheduledFor),
    recurrence: (raw.recurrence as ScheduledMessage['recurrence']) ?? 'once',
    nextRunAt: raw.nextRunAt ? ts(raw.nextRunAt) : null,
    status: (raw.status as ScheduledMessageStatus) ?? 'pending',
    sendCount: Number(raw.sendCount ?? 0),
    retryCount: Number(raw.retryCount ?? 0),
    maxRetries: Number(raw.maxRetries ?? 3),
    errorMessage: raw.errorMessage ? String(raw.errorMessage) : null,
    lastAttemptAt: raw.lastAttemptAt ? ts(raw.lastAttemptAt) : null,
    lastSentAt: raw.lastSentAt ? ts(raw.lastSentAt) : null,
    createdBy: (raw.createdBy as ScheduledMessage['createdBy']) ?? { uid: '', name: '', email: '' },
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export function subscribeToScheduledMessages(
  organizationId: string,
  callback: (messages: ScheduledMessage[]) => void,
  options?: { limitCount?: number; status?: ScheduledMessageStatus; onError?: (err: Error) => void },
): Unsubscribe {
  assertOrg(organizationId);
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
    orderBy('scheduledFor', 'desc'),
  ];
  if (options?.status) {
    constraints.unshift(where('status', '==', options.status));
  }
  if (options?.limitCount) {
    constraints.push(limitFn(options.limitCount));
  }
  const q = query(collection(db, COMMUNICATION_COLLECTIONS.SCHEDULED_MESSAGES), ...constraints);
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => toScheduledMessage(d.id, d.data() as Record<string, unknown>))),
    (err) => options?.onError?.(err),
  );
}

export async function createScheduledMessage(
  organizationId: string,
  data: Omit<ScheduledMessage, 'id' | 'createdAt' | 'updatedAt' | 'sendCount' | 'retryCount' | 'lastAttemptAt' | 'lastSentAt' | 'errorMessage'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, COMMUNICATION_COLLECTIONS.SCHEDULED_MESSAGES), {
    ...data,
    sendCount: 0,
    retryCount: 0,
    errorMessage: null,
    lastAttemptAt: null,
    lastSentAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateScheduledMessage(
  organizationId: string,
  scheduleId: string,
  patch: Partial<ScheduledMessage>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, COMMUNICATION_COLLECTIONS.SCHEDULED_MESSAGES, scheduleId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteScheduledMessage(
  organizationId: string,
  scheduleId: string,
): Promise<void> {
  assertOrg(organizationId);
  await deleteDoc(doc(db, COMMUNICATION_COLLECTIONS.SCHEDULED_MESSAGES, scheduleId));
}

/**
 * Find scheduled messages that are due to fire now.
 * Used by the Automation Engine to know what to send.
 */
export async function getDueScheduledMessages(
  organizationId: string,
  now: Date = new Date(),
): Promise<ScheduledMessage[]> {
  assertOrg(organizationId);
  const q = query(
    collection(db, COMMUNICATION_COLLECTIONS.SCHEDULED_MESSAGES),
    where('organizationId', '==', organizationId),
    where('status', '==', 'pending'),
    where('scheduledFor', '<=', now.toISOString()),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => toScheduledMessage(d.id, d.data() as Record<string, unknown>));
}

// ─── Sync Jobs ───────────────────────────────────────────────────────────────

export function toSyncJob(id: string, raw: Record<string, unknown>): CommunicationSyncJob {
  return {
    id,
    organizationId: String(raw.organizationId ?? ''),
    connectionId: String(raw.connectionId ?? ''),
    channel: (raw.channel as 'gmail' | 'whatsapp') ?? 'gmail',
    trigger: (raw.trigger as CommunicationSyncTrigger) ?? 'manual',
    status: (raw.status as CommunicationSyncStatus) ?? 'pending',
    startedAt: raw.startedAt ? ts(raw.startedAt) : null,
    completedAt: raw.completedAt ? ts(raw.completedAt) : null,
    retryCount: Number(raw.retryCount ?? 0),
    maxRetries: Number(raw.maxRetries ?? 3),
    error: raw.error ? String(raw.error) : null,
    result: (raw.result as CommunicationSyncJob['result']) ?? null,
    createdAt: ts(raw.createdAt),
    updatedAt: ts(raw.updatedAt),
  };
}

export async function createSyncJob(
  organizationId: string,
  data: Pick<CommunicationSyncJob, 'connectionId' | 'channel' | 'trigger' | 'maxRetries'>,
): Promise<string> {
  assertOrg(organizationId);
  const ref = await addDoc(collection(db, COMMUNICATION_COLLECTIONS.SYNC_JOBS), {
    organizationId,
    ...data,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    error: null,
    result: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSyncJob(
  organizationId: string,
  jobId: string,
  patch: Partial<CommunicationSyncJob>,
): Promise<void> {
  assertOrg(organizationId);
  const ref = doc(db, COMMUNICATION_COLLECTIONS.SYNC_JOBS, jobId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

// ─── Cascade Disconnect ──────────────────────────────────────────────────────

/**
 * Delete a Gmail connection + all its messages (used when disconnecting).
 */
export async function cascadeDisconnectGmail(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await deleteGmailMessagesForConnection(organizationId, connectionId);
  await deleteGmailConnection(organizationId, connectionId);
}

export async function cascadeDisconnectWhatsApp(
  organizationId: string,
  connectionId: string,
): Promise<void> {
  assertOrg(organizationId);
  await deleteWhatsAppMessagesForConnection(organizationId, connectionId);
  await deleteWhatsAppConnection(organizationId, connectionId);
}

// ─── Summary Computation ─────────────────────────────────────────────────────

/**
 * Compute the dashboard communication summary from real-time Firestore data.
 * Pure function — given the current connections + messages + schedules,
 * return the summary the dashboard displays.
 */
export function computeCommunicationSummary(
  gmailConnections: GmailConnection[],
  whatsappConnections: WhatsAppConnection[],
  gmailMessages: GmailMessage[],
  whatsappMessages: WhatsAppMessage[],
  scheduledMessages: ScheduledMessage[],
): CommunicationSummary {
  const gmailConn = gmailConnections.find((c) => c.authStatus === 'connected') ?? null;
  const waConn = whatsappConnections.find((c) => c.authStatus === 'connected') ?? null;

  const unreadEmails = gmailMessages.filter((m) => m.readStatus === 'unread' && m.direction === 'inbound').length;
  const unreadGstNotices = gmailMessages.filter(
    (m) => m.category === 'gst_notice' && m.readStatus === 'unread',
  ).length;
  const pendingVendorInvoices = gmailMessages.filter(
    (m) => m.category === 'vendor_invoice' && m.readStatus === 'unread',
  ).length;

  // Pending client replies — outbound emails in the last 7 days with no inbound reply.
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const pendingClientReplies = gmailMessages.filter((m) => {
    if (m.direction !== 'outbound') return false;
    return new Date(m.receivedAt).getTime() >= sevenDaysAgo;
  }).length;

  const unreadWhatsAppMessages = whatsappMessages.filter(
    (m) => m.direction === 'inbound' && m.status !== 'read',
  ).length;

  // Pending WhatsApp replies — group by contact, check if the most recent
  // message in each conversation is inbound (unanswered).
  const byContact = new Map<string, WhatsAppMessage[]>();
  for (const m of whatsappMessages) {
    const contactKey = m.direction === 'inbound' ? m.from : m.to;
    const list = byContact.get(contactKey) ?? [];
    list.push(m);
    byContact.set(contactKey, list);
  }
  let pendingWhatsAppReplies = 0;
  for (const convo of byContact.values()) {
    if (hasPendingReply(convo)) pendingWhatsAppReplies++;
  }

  // Pending reminders — scheduled messages with status='pending' or 'processing'
  // that are due.
  const now = Date.now();
  const pendingReminders = scheduledMessages.filter(
    (s) => (s.status === 'pending' || s.status === 'processing') && new Date(s.scheduledFor).getTime() <= now,
  ).length;

  const failedMessagesCount = scheduledMessages.filter((s) => s.status === 'failed').length;
  const sentTodayCount = scheduledMessages.filter((s) => {
    if (s.status !== 'sent' || !s.lastSentAt) return false;
    const sentAt = new Date(s.lastSentAt).getTime();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return sentAt >= startOfDay.getTime();
  }).length;

  return {
    gmailConnected: !!gmailConn,
    gmailConnectionEmail: gmailConn?.email ?? null,
    gmailLastSync: gmailConn?.lastSync ?? null,
    unreadEmails,
    unreadGstNotices,
    pendingVendorInvoices,
    pendingClientReplies,
    whatsappConnected: !!waConn,
    whatsappPhoneNumber: waConn?.phoneNumber ?? null,
    whatsappLastSync: waConn?.lastSync ?? null,
    unreadWhatsAppMessages,
    pendingWhatsAppReplies,
    pendingReminders,
    scheduledMessagesCount: scheduledMessages.length,
    failedMessagesCount,
    sentTodayCount,
    recentEmails: gmailMessages.slice(0, 10),
    recentWhatsAppMessages: whatsappMessages.slice(0, 10),
    recentScheduledMessages: scheduledMessages.slice(0, 10),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build an ISO timestamp `seconds` from now — used by schedulers.
 */
export function isoFromNow(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * Compute the next-run timestamp for a recurring schedule.
 */
export function nextRunForRecurrence(
  recurrence: ScheduledMessage['recurrence'],
  from: Date = new Date(),
): string {
  const d = new Date(from);
  switch (recurrence) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'once':
    default:
      // No next run.
      return new Date(0).toISOString();
  }
  return d.toISOString();
}
