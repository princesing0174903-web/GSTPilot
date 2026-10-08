// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Gmail & WhatsApp Business Automation™ — Future Provider Placeholders
// (SERVER-ONLY)
//
// Two placeholder providers for production integrations. Every method throws
// `NotImplementedError` so the system fails LOUDLY if you switch to one of
// these providers before implementing the real HTTP calls.
//
// WHEN YOU'RE READY TO GO LIVE:
//   1. Set env: COMMUNICATION_GMAIL_PROVIDER=google or
//      COMMUNICATION_WHATSAPP_PROVIDER=meta
//   2. Configure the provider-specific credentials.
//   3. Implement each method below to call the real provider endpoints.
//   4. The service layer, hooks, and UI DO NOT CHANGE — they only talk to
//      IGmailProvider / IWhatsAppProvider.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IGmailProvider, GmailSession, IWhatsAppProvider, WhatsAppSession } from '../provider';
import type {
  ConnectGmailResult,
  ConnectWhatsAppResult,
  EmailAttachment,
  GmailProviderName,
  SendEmailResult,
  SendWhatsAppResult,
  SyncEmailsResult,
  SyncMessagesResult,
  WhatsAppConnection,
  WhatsAppProviderName,
} from '../types';
import { NotImplementedError, ValidationError } from '../errors';
import { MockGmailProvider } from './mock-gmail-provider';
import { MockWhatsAppProvider } from './mock-whatsapp-provider';

// ─── FutureGoogleProvider — Gmail API via Google OAuth ────────────────────────
//
// Real flow:
//   1. connect() → build the OAuth consent URL (gmail.readonly + gmail.send scopes)
//      and redirect the user to accounts.google.com.
//   2. User grants consent → Google redirects back with `?code=...`
//   3. completeConnection(code) → exchange code for tokens via
//      POST https://oauth2.googleapis.com/token
//   4. syncEmails() → GET https://gmail.googleapis.com/gmail/v1/users/me/messages
//   5. sendEmail() → POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
//
// Env vars:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI,
//   COMMUNICATION_GMAIL_PROVIDER=google

class FutureGoogleProvider implements IGmailProvider {
  readonly name = 'Google Gmail API (not yet implemented)';
  readonly provider = 'google' as const;
  readonly isLive = true;

  async connect(input: { email: string; displayName?: string }): Promise<ConnectGmailResult> {
    void input;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} connect`);
  }

  async completeConnection(_connectionRef: string): Promise<{
    session: GmailSession;
    profile: { email: string; displayName: string | null };
  }> {
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} completeConnection`);
  }

  async refreshSession(session: GmailSession): Promise<{ session: GmailSession }> {
    void session;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} refreshSession`);
  }

  async disconnect(session: GmailSession): Promise<void> {
    void session;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} disconnect`);
  }

  async syncEmails(
    session: GmailSession,
    options?: { from?: string; to?: string; label?: string; maxResults?: number },
  ): Promise<SyncEmailsResult> {
    void session;
    void options;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} syncEmails`);
  }

  async sendEmail(
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
  ): Promise<SendEmailResult> {
    void session;
    void input;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} sendEmail`);
  }

  async markRead(_session: GmailSession, _messageId: string, _read: boolean): Promise<void> {
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} markRead`);
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }

  private requireConfig(): void {
    const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
    const missing = keys.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.warn(
        `[communication-provider] FutureGoogleProvider missing env vars: ${missing.join(', ')}`,
      );
    }
  }
}

// ─── FutureMetaProvider — WhatsApp Business Cloud API ─────────────────────────
//
// Real flow:
//   1. connect() → render Meta embedded signup (Firebase Auth-style popup)
//   2. completeConnection() → exchange the code for a system user access token,
//      register the phone number with /v21.0/{phone_number_id}/register
//   3. syncMessages() → webhook-driven; the Cloud API sends inbound messages
//      via webhook. We expose a /api/communication/whatsapp/webhook route.
//   4. sendMessage() → POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
//
// Env vars:
//   META_APP_ID, META_APP_SECRET, META_SYSTEM_USER_TOKEN, META_WEBHOOK_VERIFY_TOKEN,
//   COMMUNICATION_WHATSAPP_PROVIDER=meta

class FutureMetaProvider implements IWhatsAppProvider {
  readonly name = 'WhatsApp Business Cloud API (not yet implemented)';
  readonly provider = 'meta' as const;
  readonly isLive = true;

  async connect(input: { phoneNumber: string; businessName?: string }): Promise<ConnectWhatsAppResult> {
    void input;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} connect`);
  }

  async completeConnection(_connectionRef: string): Promise<{
    session: WhatsAppSession;
    profile: {
      phoneNumber: string;
      displayPhoneNumber: string | null;
      businessName: string | null;
      qualityRating: WhatsAppConnection['qualityRating'];
      messagingLimitTier: string | null;
    };
  }> {
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} completeConnection`);
  }

  async refreshSession(session: WhatsAppSession): Promise<{ session: WhatsAppSession }> {
    void session;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} refreshSession`);
  }

  async disconnect(session: WhatsAppSession): Promise<void> {
    void session;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} disconnect`);
  }

  async syncMessages(
    session: WhatsAppSession,
    options?: { from?: string; to?: string; maxResults?: number },
  ): Promise<SyncMessagesResult> {
    void session;
    void options;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} syncMessages`);
  }

  async sendMessage(
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
  ): Promise<SendWhatsAppResult> {
    void session;
    void input;
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} sendMessage`);
  }

  async markRead(_session: WhatsAppSession, _messageId: string): Promise<void> {
    void this.requireConfig();
    throw new NotImplementedError(`${this.name} markRead`);
  }

  async healthCheck(): Promise<boolean> {
    return false;
  }

  private requireConfig(): void {
    const keys = ['META_APP_ID', 'META_APP_SECRET', META_TOKEN_ENV, META_VERIFY_ENV];
    const missing = keys.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.warn(
        `[communication-provider] FutureMetaProvider missing env vars: ${missing.join(', ')}`,
      );
    }
  }
}

const META_TOKEN_ENV = 'META_SYSTEM_USER_TOKEN';
const META_VERIFY_ENV = 'META_WEBHOOK_VERIFY_TOKEN';

// ─── Provider factories ───────────────────────────────────────────────────────

export function createGmailProvider(name: GmailProviderName): IGmailProvider {
  switch (name) {
    case 'google':
      return new FutureGoogleProvider();
    case 'mock':
      return new MockGmailProvider();
    default:
      throw new ValidationError(`Unknown Gmail provider: ${name}`);
  }
}

export function createWhatsAppProvider(name: WhatsAppProviderName): IWhatsAppProvider {
  switch (name) {
    case 'meta':
      return new FutureMetaProvider();
    case 'mock':
      return new MockWhatsAppProvider();
    default:
      throw new ValidationError(`Unknown WhatsApp provider: ${name}`);
  }
}

// Re-export the classes so consumers can import them directly if needed.
export { FutureGoogleProvider, FutureMetaProvider };
