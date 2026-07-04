// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — Provider Interfaces
//
// IGmailProvider     — the SINGLE contract every Gmail backend implements.
// IWhatsAppProvider  — the SINGLE contract every WhatsApp backend implements.
//
// Today we ship:
//   • MockGmailProvider     — deterministic simulated responses (default)
//   • FutureGoogleProvider  — Gmail API placeholder (throws NotImplementedError)
//   • MockWhatsAppProvider  — deterministic simulated responses (default)
//   • FutureMetaProvider    — WhatsApp Cloud API placeholder
//
// All existing pages communicate ONLY through these interfaces (via the service
// layer). Switching to production later means changing exactly ONE env var in
// registry.ts — no UI or service code changes.
//
// IMPORTANT: These interfaces are PURE (no Firebase, no Node `crypto` imports)
// so they are safe to import from both client and server code. The
// implementations live in `server/` and are only ever imported by API routes.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  CompleteGmailConnectionResult,
  CompleteWhatsAppConnectionResult,
  ConnectGmailResult,
  ConnectWhatsAppResult,
  EmailAttachment,
  EmailCategory,
  GmailAuthStatus,
  GmailMessage,
  GmailProviderName,
  SendEmailResult,
  SendWhatsAppResult,
  SyncEmailsResult,
  SyncMessagesResult,
  WhatsAppAuthStatus,
  WhatsAppConnection,
  WhatsAppMessage,
  WhatsAppProviderName,
} from './types';

// ─── Gmail Session (decrypted, server-only) ───────────────────────────────────

/**
 * The decrypted Gmail OAuth session passed between the provider and the service
 * layer. The service encrypts this with AES-256-GCM before persisting to
 * Firestore. This type is intentionally NOT exported to client code — only the
 * server sees decrypted sessions.
 */
export interface GmailSession {
  /** OAuth access token (1-hour lifetime). */
  accessToken: string;
  /** OAuth refresh token (long-lived, used to renew accessToken). */
  refreshToken: string;
  /** The Gmail address this session belongs to. */
  email: string;
  /** The provider this session belongs to. */
  provider: GmailProviderName;
  /** ISO timestamp when the access token expires. */
  expiresAt: string;
  /** OAuth scopes granted. */
  scopes: string[];
  /** Provider-specific metadata. */
  metadata?: Record<string, unknown>;
}

// ─── WhatsApp Session (decrypted, server-only) ────────────────────────────────

/**
 * The decrypted WhatsApp Cloud API session.
 */
export interface WhatsAppSession {
  /** System user access token (long-lived). */
  accessToken: string;
  /** The phone number this session belongs to (E.164). */
  phoneNumber: string;
  /** Meta phone_number_id. */
  phoneNumberId: string;
  /** Meta WhatsApp Business account id. */
  wabaId: string;
  /** The provider this session belongs to. */
  provider: WhatsAppProviderName;
  /** ISO timestamp when the access token expires. */
  expiresAt: string;
  /** Provider-specific metadata. */
  metadata?: Record<string, unknown>;
}

// ─── IGmailProvider ───────────────────────────────────────────────────────────

/**
 * The contract every Gmail backend implements.
 *
 * Every method (except connect / healthCheck) receives a `GmailSession` and
 * returns plain data — never Firestore documents. The SERVICE layer is
 * responsible for persisting results to Firestore and encrypting sessions.
 */
export interface IGmailProvider {
  /** Human-readable provider name. */
  readonly name: string;
  /** The provider identifier. */
  readonly provider: GmailProviderName;
  /** Whether this provider makes real network calls to Gmail. */
  readonly isLive: boolean;

  /**
   * Initiate a Gmail connection — kicks off the OAuth flow (or returns
   * immediately for the mock provider).
   * Throws: ValidationError, RateLimitError, ProviderUnavailableError.
   */
  connect(input: { email: string; displayName?: string }): Promise<ConnectGmailResult>;

  /**
   * Complete the connection — exchange the OAuth code for tokens and return
   * the session + profile. For the mock provider this is instant.
   * Throws: AuthRejectedError, AuthenticationError.
   */
  completeConnection(connectionRef: string): Promise<{
    session: GmailSession;
    profile: { email: string; displayName: string | null };
  }>;

  /**
   * Refresh an existing session using the refresh token.
   * Throws: SessionExpiredError (if refresh token also expired).
   */
  refreshSession(session: GmailSession): Promise<{ session: GmailSession }>;

  /**
   * Disconnect — revoke the OAuth grant server-side. Idempotent.
   */
  disconnect(session: GmailSession): Promise<void>;

  /**
   * Sync emails for a date range. Returns provider-side messages that the
   * orchestrator will run through the categorization + AI summary engines.
   * Throws: SessionExpiredError, ProviderUnavailableError.
   */
  syncEmails(
    session: GmailSession,
    options?: { from?: string; to?: string; label?: string; maxResults?: number },
  ): Promise<SyncEmailsResult>;

  /**
   * Send an email. Returns the provider message ID + thread ID.
   * Throws: MessageSendError, SessionExpiredError.
   */
  sendEmail(
    session: GmailSession,
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
  ): Promise<SendEmailResult>;

  /**
   * Mark a message as read / unread.
   */
  markRead(session: GmailSession, messageId: string, read: boolean): Promise<void>;

  /**
   * Health check — used by the scheduler.
   */
  healthCheck(): Promise<boolean>;
}

// ─── IWhatsAppProvider ────────────────────────────────────────────────────────

export interface IWhatsAppProvider {
  readonly name: string;
  readonly provider: WhatsAppProviderName;
  readonly isLive: boolean;

  /**
   * Initiate a WhatsApp Business connection. For the mock provider this is
   * instant; for Meta this would start the embedded signup flow.
   */
  connect(input: { phoneNumber: string; businessName?: string }): Promise<ConnectWhatsAppResult>;

  /**
   * Complete the connection — register the phone number with Meta and return
   * the session + profile.
   */
  completeConnection(connectionRef: string): Promise<{
    session: WhatsAppSession;
    profile: CompleteWhatsAppConnectionResult['profile'];
  }>;

  /**
   * Refresh an existing session.
   */
  refreshSession(session: WhatsAppSession): Promise<{ session: WhatsAppSession }>;

  /**
   * Disconnect — deregister the phone number / revoke the token.
   */
  disconnect(session: WhatsAppSession): Promise<void>;

  /**
   * Sync inbound + outbound messages for a date range.
   */
  syncMessages(
    session: WhatsAppSession,
    options?: { from?: string; to?: string; maxResults?: number },
  ): Promise<SyncMessagesResult>;

  /**
   * Send a WhatsApp message. Returns the provider message ID + delivery status.
   */
  sendMessage(
    session: WhatsAppSession,
    input: {
      to: string;
      messageType: 'text' | 'template' | 'document' | 'image';
      body: string;
      mediaUrl?: string;
      caption?: string;
      templateName?: string;
      templateParams?: string[];
    },
  ): Promise<SendWhatsAppResult>;

  /**
   * Mark a message as read (sends read receipt to Meta).
   */
  markRead(session: WhatsAppSession, messageId: string): Promise<void>;

  /**
   * Health check.
   */
  healthCheck(): Promise<boolean>;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type {
  CompleteGmailConnectionResult,
  CompleteWhatsAppConnectionResult,
  ConnectGmailResult,
  ConnectWhatsAppResult,
  EmailAttachment,
  EmailCategory,
  GmailAuthStatus,
  GmailMessage,
  GmailProviderName,
  SendEmailResult,
  SendWhatsAppResult,
  SyncEmailsResult,
  SyncMessagesResult,
  WhatsAppAuthStatus,
  WhatsAppConnection,
  WhatsAppMessage,
  WhatsAppProviderName,
} from './types';
