// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — Server Orchestrator (SERVER-ONLY)
//
// The thin server-side layer that:
//   1. Resolves the active providers via the registry
//   2. Encrypts / decrypts sessions with AES-256-GCM (server-only key)
//   3. Calls the providers and returns fully-formed Firestore-ready objects
//   4. Runs the categorization + AI summary engines on synced messages
//   5. Writes AI summaries to `ai_memory` so Oracle can answer questions
//
// This file is SERVER-ONLY — it imports `node:crypto` (via the providers + crypto
// modules) and must NEVER be bundled into client code. API routes are the only
// legitimate consumers.
//
// Multi-tenant: every function takes `organizationId` and stamps it onto every
// returned object so the client can write directly to Firestore without
// additional processing.
// ═══════════════════════════════════════════════════════════════════════════════

import { getGmailProvider, getWhatsAppProvider } from './registry';
import { decryptConnection, encryptConnection } from './crypto';
import type { GmailSession, WhatsAppSession } from '../provider';
import type {
  CompleteGmailConnectionResult,
  CompleteWhatsAppConnectionResult,
  ConnectGmailInput,
  ConnectGmailResult,
  ConnectWhatsAppInput,
  ConnectWhatsAppResult,
  EmailAttachment,
  EmailCategory,
  GmailConnection,
  GmailMessage,
  GmailProviderName,
  SendEmailResult,
  SendWhatsAppResult,
  SyncEmailsResult,
  SyncMessagesResult,
  WhatsAppCategory,
  WhatsAppConnection,
  WhatsAppMessage,
  WhatsAppProviderName,
  ScheduledMessage,
} from '../types';
import {
  classifyEmail,
  classifyWhatsAppMessage,
  detectEmailSentiment,
  detectWhatsAppSentiment,
  summarizeEmail,
  summarizeWhatsAppMessage,
} from '../communication-analysis';
import { CommunicationError, friendlyCommunicationError, SessionExpiredError } from '../errors';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new CommunicationError(
      'You must belong to an organization to manage communications.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

// ─── Gmail Connection Lifecycle ──────────────────────────────────────────────

/**
 * Step 1 — initiate a Gmail connection via the provider.
 */
export async function connectGmail(input: ConnectGmailInput): Promise<ConnectGmailResult> {
  assertOrg(input.organizationId);
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new CommunicationError('A valid email address is required.', {
      code: 'INVALID_EMAIL',
      statusCode: 400,
    });
  }
  const provider = getGmailProvider();
  try {
    return await provider.connect({ email: input.email, displayName: input.displayName });
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Step 2 — complete the connection (post-OAuth). Returns the ENCRYPTED session
 * + profile.
 */
export async function completeGmailConnection(
  organizationId: string,
  connectionRef: string,
): Promise<CompleteGmailConnectionResult> {
  assertOrg(organizationId);
  if (!connectionRef) {
    throw new CommunicationError('connectionRef is required.', {
      code: 'INVALID_CONNECTION_REF',
      statusCode: 400,
    });
  }
  const provider = getGmailProvider();
  try {
    const { session, profile } = await provider.completeConnection(connectionRef);
    const encryptedConnection = encryptConnection(session);
    return {
      encryptedConnection,
      sessionExpiry: session.expiresAt,
      scopes: session.scopes,
      profile,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Refresh an existing Gmail session.
 */
export async function refreshGmailConnection(
  encryptedConnection: string,
): Promise<{ encryptedConnection: string; sessionExpiry: string }> {
  if (!encryptedConnection) throw new SessionExpiredError();
  let session: GmailSession;
  try {
    session = decryptConnection<GmailSession>(encryptedConnection);
  } catch {
    throw new SessionExpiredError();
  }
  const provider = getGmailProvider();
  try {
    const { session: newSession } = await provider.refreshSession(session);
    return {
      encryptedConnection: encryptConnection(newSession),
      sessionExpiry: newSession.expiresAt,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Disconnect — invalidate the session server-side. Idempotent.
 */
export async function disconnectGmail(encryptedConnection: string | null): Promise<void> {
  if (!encryptedConnection) return;
  let session: GmailSession;
  try {
    session = decryptConnection<GmailSession>(encryptedConnection);
  } catch {
    return;
  }
  const provider = getGmailProvider();
  try {
    await provider.disconnect(session);
  } catch (err) {
    console.warn('[communication-provider] Gmail disconnect failed (non-fatal):', friendlyCommunicationError(err));
  }
}

// ─── Gmail Sync ──────────────────────────────────────────────────────────────

/**
 * Sync emails from Gmail. Returns Firestore-ready messages (already categorized
 * + AI-summarized). The client writes them to Firestore.
 */
export async function syncEmails(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  options?: { from?: string; to?: string; maxResults?: number },
): Promise<SyncEmailsResult> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new CommunicationError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireGmailSession(encryptedConnection);
  const provider = getGmailProvider();
  try {
    const result = await provider.syncEmails(session, options);

    // Stamp tenant scope + connection id + run the classifier + summarizer on
    // each message. (Mock already does this, but production providers will not.)
    const stamped = result.messages.map((msg) => {
      // Re-classify using the subject + body (idempotent — overwrites).
      const category = classifyEmail(msg.subject, msg.bodyText ?? msg.preview, msg.from);
      const sentiment = detectEmailSentiment(msg.subject, msg.bodyText ?? msg.preview);
      const aiSummary = summarizeEmail(msg.subject, msg.bodyText ?? msg.preview, category);
      return {
        ...msg,
        organizationId,
        connectionId,
        category,
        sentiment,
        aiSummary,
      };
    });

    return {
      success: result.success,
      syncedCount: stamped.length,
      newCount: stamped.length,
      errors: result.errors,
      messages: stamped,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

// ─── Gmail Send / Reply ──────────────────────────────────────────────────────

export async function sendEmail(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  input: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    attachments?: EmailAttachment[];
    replyToMessageId?: string;
  },
): Promise<SendEmailResult> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new CommunicationError('connectionId is required.', { code: 'INVALID_CONNECTION', statusCode: 400 });
  }
  if (!input.to || !input.subject) {
    throw new CommunicationError('Recipient and subject are required.', {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  }
  const session = requireGmailSession(encryptedConnection);
  const provider = getGmailProvider();
  try {
    return await provider.sendEmail(session, input);
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Reply to an existing email — uses the same `sendEmail` provider call but
 * passes the `replyToMessageId` so Gmail threads the reply correctly.
 */
export async function replyEmail(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  input: {
    to: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    replyToMessageId: string;
    attachments?: EmailAttachment[];
  },
): Promise<SendEmailResult> {
  return sendEmail(organizationId, connectionId, encryptedConnection, {
    to: input.to,
    subject: input.subject,
    bodyHtml: input.bodyHtml,
    bodyText: input.bodyText,
    replyToMessageId: input.replyToMessageId,
    attachments: input.attachments,
  });
}

// ─── WhatsApp Connection Lifecycle ───────────────────────────────────────────

export async function connectWhatsApp(input: ConnectWhatsAppInput): Promise<ConnectWhatsAppResult> {
  assertOrg(input.organizationId);
  if (!input.phoneNumber || !/^\+?\d{10,15}$/.test(input.phoneNumber.replace(/\s+/g, ''))) {
    throw new CommunicationError('A valid phone number (10-15 digits) is required.', {
      code: 'INVALID_PHONE',
      statusCode: 400,
    });
  }
  const provider = getWhatsAppProvider();
  try {
    return await provider.connect({ phoneNumber: input.phoneNumber, businessName: input.businessName });
  } catch (err) {
    throw rethrowTyped(err);
  }
}

export async function completeWhatsAppConnection(
  organizationId: string,
  connectionRef: string,
): Promise<CompleteWhatsAppConnectionResult> {
  assertOrg(organizationId);
  if (!connectionRef) {
    throw new CommunicationError('connectionRef is required.', {
      code: 'INVALID_CONNECTION_REF',
      statusCode: 400,
    });
  }
  const provider = getWhatsAppProvider();
  try {
    const { session, profile } = await provider.completeConnection(connectionRef);
    const encryptedConnection = encryptConnection(session);
    return {
      encryptedConnection,
      sessionExpiry: session.expiresAt,
      profile,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

export async function refreshWhatsAppConnection(
  encryptedConnection: string,
): Promise<{ encryptedConnection: string; sessionExpiry: string }> {
  if (!encryptedConnection) throw new SessionExpiredError();
  let session: WhatsAppSession;
  try {
    session = decryptConnection<WhatsAppSession>(encryptedConnection);
  } catch {
    throw new SessionExpiredError();
  }
  const provider = getWhatsAppProvider();
  try {
    const { session: newSession } = await provider.refreshSession(session);
    return {
      encryptedConnection: encryptConnection(newSession),
      sessionExpiry: newSession.expiresAt,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

export async function disconnectWhatsApp(encryptedConnection: string | null): Promise<void> {
  if (!encryptedConnection) return;
  let session: WhatsAppSession;
  try {
    session = decryptConnection<WhatsAppSession>(encryptedConnection);
  } catch {
    return;
  }
  const provider = getWhatsAppProvider();
  try {
    await provider.disconnect(session);
  } catch (err) {
    console.warn('[communication-provider] WhatsApp disconnect failed (non-fatal):', friendlyCommunicationError(err));
  }
}

// ─── WhatsApp Sync ───────────────────────────────────────────────────────────

export async function syncWhatsAppMessages(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  options?: { from?: string; to?: string; maxResults?: number },
): Promise<SyncMessagesResult> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new CommunicationError('connectionId is required.', {
      code: 'INVALID_CONNECTION',
      statusCode: 400,
    });
  }
  const session = requireWhatsAppSession(encryptedConnection);
  const provider = getWhatsAppProvider();
  try {
    const result = await provider.syncMessages(session, options);

    const stamped = result.messages.map((msg) => {
      const category = classifyWhatsAppMessage(msg.messageBody, msg.direction);
      const sentiment = detectWhatsAppSentiment(msg.messageBody);
      const aiSummary = summarizeWhatsAppMessage(msg.messageBody, category, msg.direction);
      return {
        ...msg,
        organizationId,
        connectionId,
        category,
        sentiment,
        aiSummary,
      };
    });

    return {
      success: result.success,
      syncedCount: stamped.length,
      newCount: stamped.length,
      errors: result.errors,
      messages: stamped,
    };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

// ─── WhatsApp Send / Reply ───────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  input: {
    to: string;
    messageType: 'text' | 'template' | 'document' | 'image';
    body: string;
    mediaUrl?: string;
    caption?: string;
    templateName?: string;
    templateParams?: string[];
    category?: WhatsAppCategory;
    clientId?: string | null;
    invoiceId?: string | null;
  },
): Promise<SendWhatsAppResult & { category: WhatsAppCategory }> {
  assertOrg(organizationId);
  if (!connectionId) {
    throw new CommunicationError('connectionId is required.', { code: 'INVALID_CONNECTION', statusCode: 400 });
  }
  if (!input.to || !input.body) {
    throw new CommunicationError('Recipient and body are required.', {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  }
  const session = requireWhatsAppSession(encryptedConnection);
  const provider = getWhatsAppProvider();
  try {
    const result = await provider.sendMessage(session, {
      to: input.to,
      messageType: input.messageType,
      body: input.body,
      mediaUrl: input.mediaUrl,
      caption: input.caption,
      templateName: input.templateName,
      templateParams: input.templateParams,
    });
    // Stamp the category the caller passed (or infer it).
    const category = input.category ?? classifyWhatsAppMessage(input.body, 'outbound');
    return { ...result, category };
  } catch (err) {
    throw rethrowTyped(err);
  }
}

/**
 * Reply to an inbound WhatsApp message — sends a text reply back to the same
 * contact. (WhatsApp is conversation-based, so "reply" is just a send.)
 */
export async function replyWhatsApp(
  organizationId: string,
  connectionId: string,
  encryptedConnection: string,
  input: {
    to: string;
    body: string;
    replyToMessageId?: string;
    clientId?: string | null;
  },
): Promise<SendWhatsAppResult & { category: WhatsAppCategory }> {
  return sendWhatsAppMessage(organizationId, connectionId, encryptedConnection, {
    to: input.to,
    messageType: 'text',
    body: input.body,
    category: 'general',
    clientId: input.clientId ?? null,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireGmailSession(encryptedConnection: string): GmailSession {
  if (!encryptedConnection) throw new SessionExpiredError();
  try {
    return decryptConnection<GmailSession>(encryptedConnection);
  } catch {
    throw new SessionExpiredError();
  }
}

function requireWhatsAppSession(encryptedConnection: string): WhatsAppSession {
  if (!encryptedConnection) throw new SessionExpiredError();
  try {
    return decryptConnection<WhatsAppSession>(encryptedConnection);
  } catch {
    throw new SessionExpiredError();
  }
}

function rethrowTyped(err: unknown): never {
  if (err instanceof CommunicationError) throw err;
  if (err instanceof Error) {
    throw new CommunicationError(err.message, {
      code: 'PROVIDER_ERROR',
      statusCode: 502,
      retryable: true,
      cause: err,
    });
  }
  throw new CommunicationError('An unknown error occurred while contacting the communication provider.', {
    code: 'UNKNOWN',
    statusCode: 500,
  });
}

// ─── Provider diagnostics ────────────────────────────────────────────────────

export async function gmailProviderHealth(): Promise<{
  healthy: boolean;
  name: string;
  provider: GmailProviderName;
  isLive: boolean;
}> {
  const provider = getGmailProvider();
  try {
    const healthy = await provider.healthCheck();
    return { healthy, name: provider.name, provider: provider.provider, isLive: provider.isLive };
  } catch {
    return { healthy: false, name: provider.name, provider: provider.provider, isLive: provider.isLive };
  }
}

export async function whatsappProviderHealth(): Promise<{
  healthy: boolean;
  name: string;
  provider: WhatsAppProviderName;
  isLive: boolean;
}> {
  const provider = getWhatsAppProvider();
  try {
    const healthy = await provider.healthCheck();
    return { healthy, name: provider.name, provider: provider.provider, isLive: provider.isLive };
  } catch {
    return { healthy: false, name: provider.name, provider: provider.provider, isLive: provider.isLive };
  }
}

// ─── Type re-exports ─────────────────────────────────────────────────────────

export type {
  GmailConnection,
  GmailMessage,
  GmailProviderName,
  ScheduledMessage,
  WhatsAppConnection,
  WhatsAppMessage,
  WhatsAppProviderName,
  EmailCategory,
  WhatsAppCategory,
};
