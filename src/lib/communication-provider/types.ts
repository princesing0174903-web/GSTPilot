// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — Type Definitions
//
// The single source of truth for the communication data model. Every field maps
// 1:1 to a Firestore collection. All types are PURE (no Firebase imports) so
// they are safe to import from both client and server code.
//
// Provider pattern:
//   • IGmailProvider     (see provider.ts) — contract every Gmail backend implements
//   • MockGmailProvider  — deterministic simulated responses (default)
//   • FutureGoogleProvider — Gmail API (placeholder, throws NotImplementedError)
//
//   • IWhatsAppProvider  (see provider.ts) — contract every WhatsApp backend implements
//   • MockWhatsAppProvider — deterministic simulated responses (default)
//   • FutureMetaProvider — WhatsApp Business Cloud API (placeholder)
//
// Switch to production later by changing ONE provider in registry.ts.
//
// Multi-tenant: every document carries `organizationId`. Every query filters on
// it. Users can never access another organization's communications.
//
// Security: OAuth tokens / sessions are encrypted with AES-256-GCM (server-only
// key) before being stored in Firestore. The client reads the encrypted blob and
// passes it back to the server during sync operations — the client can NEVER
// decrypt it.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Provider Identifiers ─────────────────────────────────────────────────────

/**
 * Supported Gmail provider backends. Today only 'mock' is live; 'google' is a
 * placeholder that throws NotImplementedError until the real OAuth flow is wired.
 */
export type GmailProviderName = 'mock' | 'google';

/**
 * Supported WhatsApp provider backends. Today only 'mock' is live; 'meta' is a
 * placeholder that throws NotImplementedError until the WhatsApp Cloud API is wired.
 */
export type WhatsAppProviderName = 'mock' | 'meta';

// ─── Connection Status ────────────────────────────────────────────────────────

export type GmailAuthStatus =
  | 'disconnected'     // no connection exists
  | 'auth_pending'     // OAuth started, awaiting callback
  | 'connected'        // connection active — sync enabled
  | 'expired'          // refresh token expired — re-auth required
  | 'error';           // last operation failed — see lastError

export type WhatsAppAuthStatus =
  | 'disconnected'
  | 'auth_pending'
  | 'connected'
  | 'expired'
  | 'error';

// ─── Gmail Connection (gmail_connections collection) ──────────────────────────

/**
 * The Gmail connection document — one per organization.
 * Stored in Firestore `gmail_connections/{connectionId}`.
 */
export interface GmailConnection {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  /** The Gmail address that was connected. */
  email: string;
  /** Display name from the Gmail profile (e.g. "Bharat Tech Solutions"). */
  displayName: string | null;
  /** Which provider backend services this connection. */
  provider: GmailProviderName;
  /** Connection lifecycle status. */
  authStatus: GmailAuthStatus;
  /** ISO timestamp of the last successful sync. */
  lastSync: string | null;
  /** ISO timestamp when the OAuth refresh token / session expires. */
  sessionExpiry: string | null;
  /**
   * AES-256-GCM encrypted OAuth blob (access_token + refresh_token + scope).
   * Stored in Firestore — org members can READ this field but CANNOT decrypt it
   * without the server-only master key. The client passes this back to the
   * server during sync operations.
   */
  encryptedConnection: string | null;
  /** Scopes granted by the user (display-only). */
  scopes: string[];
  /** Human-readable last error message. */
  lastError: string | null;
  /** User who created the connection. */
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

// ─── WhatsApp Connection (whatsapp_connections collection) ────────────────────

/**
 * The WhatsApp Business connection document — one per organization per phone number.
 * Stored in Firestore `whatsapp_connections/{connectionId}`.
 */
export interface WhatsAppConnection {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** The WhatsApp Business phone number (E.164 format, e.g. +919876543210). */
  phoneNumber: string;
  /** Display name of the WhatsApp Business account. */
  businessName: string | null;
  /** WhatsApp Business display phone number (formatted). */
  displayPhoneNumber: string | null;
  /** Which provider backend services this connection. */
  provider: WhatsAppProviderName;
  /** Connection lifecycle status. */
  authStatus: WhatsAppAuthStatus;
  /** ISO timestamp of the last successful sync. */
  lastSync: string | null;
  /** ISO timestamp when the access token expires (Cloud API tokens expire in 24h). */
  sessionExpiry: string | null;
  /** AES-256-GCM encrypted access token blob. */
  encryptedConnection: string | null;
  /** WhatsApp Business phone number ID (Meta API identifier). */
  phoneNumberId: string | null;
  /** WhatsApp Business account ID (Meta API identifier). */
  wabaId: string | null;
  /** Quality rating from Meta (GREEN / YELLOW / RED). */
  qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  /** Messaging limit tier (e.g. 1000 / 24h). */
  messagingLimitTier: string | null;
  /** Human-readable last error message. */
  lastError: string | null;
  /** User who created the connection. */
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

// ─── Email Message (gmail_messages collection) ────────────────────────────────

/**
 * Direction of an email relative to the connected Gmail account.
 */
export type EmailDirection = 'inbound' | 'outbound';

/**
 * Auto-detected email categories — drives the AI Communication Engine.
 */
export type EmailCategory =
  | 'gst_notice'        // GST scrutiny / DRC / SCN / ASN / show cause
  | 'vendor_invoice'    // incoming supplier invoice
  | 'customer_invoice'  // outgoing sales invoice copy
  | 'payment_confirmation' // payment made / received
  | 'bank_alert'        // debit / credit / low balance alert
  | 'tax_communication' // IT / GST / TDS department letters
  | 'statement'         // bank / vendor statement
  | 'general';          // everything else

export type EmailReadStatus = 'unread' | 'read' | 'starred';

/**
 * A single Gmail message — inbound or outbound.
 * Stored in Firestore `gmail_messages/{messageId}`.
 */
export interface GmailMessage {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** The connection this message belongs to. */
  connectionId: string;
  /** Gmail message ID (RFC822 Message-ID header). */
  messageId: string;
  /** Gmail thread ID (for grouping replies). */
  threadId: string | null;
  direction: EmailDirection;
  from: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  replyTo: string | null;
  subject: string;
  /** Plain-text body preview (first 500 chars). */
  preview: string;
  /** Full HTML body (sanitized). */
  bodyHtml: string | null;
  /** Full plain-text body. */
  bodyText: string | null;
  /** Auto-detected category. */
  category: EmailCategory;
  /** AI-extracted summary (1-2 sentences) written to ai_memory. */
  aiSummary: string | null;
  /** Sentiment detected by the AI engine. */
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent' | 'unknown';
  /** Attachment files (URLs are stored in attachments[]). */
  attachments: EmailAttachment[];
  readStatus: EmailReadStatus;
  /** ISO timestamp when the message was received / sent. */
  receivedAt: string;
  /** ISO timestamp when the message was synced into Firestore. */
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Storage URL (Firebase Storage path) — null until downloaded. */
  storageUrl: string | null;
}

// ─── WhatsApp Message (whatsapp_messages collection) ──────────────────────────

export type WhatsAppDirection = 'inbound' | 'outbound';
export type WhatsAppMessageType = 'text' | 'template' | 'media' | 'document' | 'interactive' | 'audio' | 'image' | 'video';

export type WhatsAppDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export type WhatsAppCategory =
  | 'invoice_reminder'     // "Your invoice INV-001 is due in 3 days"
  | 'gst_filing_reminder'  // "GSTR-3B due on 20th"
  | 'payment_followup'     // "Your payment of ₹X is overdue"
  | 'payment_confirmation' // "We received your payment of ₹X"
  | 'customer_reply'       // inbound customer conversation
  | 'collection'           // collection recovery message
  | 'statement'            // monthly statement share
  | 'general';

export interface WhatsAppMessage {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** The connection this message belongs to. */
  connectionId: string;
  /** WhatsApp message ID (provider-side). */
  wamId: string | null;
  direction: WhatsAppDirection;
  /** Sender phone number (E.164). For outbound: our number; for inbound: theirs. */
  from: string;
  /** Recipient phone number (E.164). For outbound: theirs; for inbound: ours. */
  to: string;
  /** Contact name (resolved from clients if available). */
  contactName: string | null;
  messageType: WhatsAppMessageType;
  messageBody: string;
  /** Media / document URL (Storage path) if any. */
  mediaUrl: string | null;
  caption: string | null;
  category: WhatsAppCategory;
  /** AI-extracted summary written to ai_memory. */
  aiSummary: string | null;
  /** Sentiment detected by the AI engine. */
  sentiment: 'positive' | 'neutral' | 'negative' | 'urgent' | 'unknown';
  status: WhatsAppDeliveryStatus;
  errorMessage: string | null;
  /** Linked invoice (if this is an invoice-related message). */
  invoiceId: string | null;
  /** Linked client (if the phone matches a client). */
  clientId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  receivedAt: string;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Scheduled Messages (scheduled_messages collection) ───────────────────────

export type ScheduledMessageChannel = 'gmail' | 'whatsapp';
export type ScheduledMessageStatus =
  | 'pending'      // waiting for scheduled time
  | 'processing'   // currently being sent
  | 'sent'         // successfully delivered
  | 'failed'       // delivery failed — see lastError
  | 'cancelled'    // user cancelled before send
  | 'paused';      // recurring schedule paused

export type ScheduleRecurrence =
  | 'once'         // one-time send
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly';

/**
 * A scheduled or recurring message — drives the Automation Engine.
 * Stored in Firestore `scheduled_messages/{scheduleId}`.
 */
export interface ScheduledMessage {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  channel: ScheduledMessageChannel;
  /** The connection to send through. */
  connectionId: string;
  /** Recipient (email or phone depending on channel). */
  recipient: string;
  recipientName: string | null;
  /** Subject (email only). */
  subject: string | null;
  /** Message body (text for WhatsApp, HTML for email). */
  body: string;
  /** Category — used for analytics + AI. */
  category: WhatsAppCategory | EmailCategory;
  /** Trigger reason — what created this schedule. */
  trigger: 'invoice_reminder' | 'gst_filing' | 'payment_followup' | 'recurring' | 'manual';
  /** The entity this schedule relates to (e.g. invoiceId, returnId). */
  linkedEntityId: string | null;
  linkedEntityType: 'invoice' | 'return' | 'client' | 'payment' | null;
  /** ISO timestamp when the message should be sent. */
  scheduledFor: string;
  /** Recurrence pattern (null for one-time sends). */
  recurrence: ScheduleRecurrence;
  /** Next-send timestamp (for recurring). */
  nextRunAt: string | null;
  status: ScheduledMessageStatus;
  /** Number of times this schedule has fired (recurring). */
  sendCount: number;
  /** Number of failed attempts (used for retry logic). */
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  /** Last attempt timestamps. */
  lastAttemptAt: string | null;
  lastSentAt: string | null;
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

// ─── Service Input / Result Types ─────────────────────────────────────────────

export interface ConnectGmailInput {
  organizationId: string;
  email: string;
  displayName?: string;
  createdBy: { uid: string; name: string; email: string };
}

export interface ConnectGmailResult {
  /** Provider connection reference. */
  connectionRef: string;
  /** The Gmail address that was connected. */
  email: string;
  /** Initial label list (just ['INBOX', 'SENT'] for mock). */
  labels: string[];
  message: string;
}

export interface CompleteGmailConnectionResult {
  encryptedConnection: string;
  sessionExpiry: string;
  scopes: string[];
  profile: {
    email: string;
    displayName: string | null;
  };
}

export interface ConnectWhatsAppInput {
  organizationId: string;
  phoneNumber: string;
  businessName?: string;
  createdBy: { uid: string; name: string; email: string };
}

export interface ConnectWhatsAppResult {
  connectionRef: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  message: string;
}

export interface CompleteWhatsAppConnectionResult {
  encryptedConnection: string;
  sessionExpiry: string;
  profile: {
    phoneNumber: string;
    displayPhoneNumber: string | null;
    businessName: string | null;
    qualityRating: WhatsAppConnection['qualityRating'];
    messagingLimitTier: string | null;
  };
}

// ─── Sync Results ─────────────────────────────────────────────────────────────

export interface SyncEmailsResult {
  success: boolean;
  syncedCount: number;
  newCount: number;
  errors: string[];
  messages: GmailMessage[];
}

export interface SyncMessagesResult {
  success: boolean;
  syncedCount: number;
  newCount: number;
  errors: string[];
  messages: WhatsAppMessage[];
}

export interface SendEmailResult {
  success: boolean;
  messageId: string;
  threadId: string | null;
  sentAt: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId: string;
  wamId: string | null;
  status: WhatsAppDeliveryStatus;
  sentAt: string;
}

// ─── Aggregated Communication Summary (for dashboard) ─────────────────────────

/**
 * Aggregated communication state for the dashboard — computed from real-time
 * Firestore data. Returned by `useCommunications()` as `summary`.
 */
export interface CommunicationSummary {
  // Gmail
  gmailConnected: boolean;
  gmailConnectionEmail: string | null;
  gmailLastSync: string | null;
  unreadEmails: number;
  unreadGstNotices: number;
  pendingVendorInvoices: number;
  pendingClientReplies: number;
  // WhatsApp
  whatsappConnected: boolean;
  whatsappPhoneNumber: string | null;
  whatsappLastSync: string | null;
  unreadWhatsAppMessages: number;
  pendingWhatsAppReplies: number;
  pendingReminders: number;
  // Automation
  scheduledMessagesCount: number;
  failedMessagesCount: number;
  sentTodayCount: number;
  // Feeds
  recentEmails: GmailMessage[];
  recentWhatsAppMessages: WhatsAppMessage[];
  recentScheduledMessages: ScheduledMessage[];
}

// ─── Communication Sync Jobs (communication_sync_jobs collection) ─────────────

export type CommunicationSyncTrigger = 'manual' | 'automatic' | 'background' | 'retry' | 'incremental' | 'webhook';
export type CommunicationSyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface CommunicationSyncJob {
  id: string;
  organizationId: string;
  connectionId: string;
  channel: 'gmail' | 'whatsapp';
  trigger: CommunicationSyncTrigger;
  status: CommunicationSyncStatus;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
  error: string | null;
  result: {
    newCount?: number;
    totalCount?: number;
    from?: string;
    to?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}
