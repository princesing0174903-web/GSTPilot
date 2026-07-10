// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — MockGmailProvider (SERVER-ONLY)
//
// The default Gmail provider. Produces DETERMINISTIC, realistic-looking email
// data seeded by the connected email address — the same mailbox always returns
// the same messages. This lets the UI feel real without ever touching the
// Gmail API.
//
// This file is SERVER-ONLY (uses node:crypto for deterministic seeding). API
// routes are the only consumers.
//
// When you're ready to go live: set `COMMUNICATION_GMAIL_PROVIDER=google` in
// env, configure GOOGLE_CLIENT_ID / SECRET, and the registry will swap to
// FutureGoogleProvider → real Gmail API calls.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { IGmailProvider, GmailSession } from '../provider';
import type {
  ConnectGmailResult,
  EmailAttachment,
  EmailCategory,
  GmailMessage,
  SendEmailResult,
  SyncEmailsResult,
} from '../types';
import { classifyEmail, summarizeEmail, detectEmailSentiment } from '../communication-analysis';
import { ValidationError } from '../errors';

// ─── Deterministic PRNG (seeded by email) ─────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(input: string): number {
  return crypto.createHash('sha1').update(input).digest().readUInt32LE(0);
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─── In-memory connection store ───────────────────────────────────────────────
// In production, Google tracks OAuth state. The mock keeps it locally.

interface MockGmailConnectionEntry {
  connectionRef: string;
  email: string;
  displayName: string | null;
  createdAt: number;
}

const connectionStore = new Map<string, MockGmailConnectionEntry>();

// ─── Realistic data pools ─────────────────────────────────────────────────────

const GST_NOTICE_SENDERS = [
  'gst.notice@gst.gov.in',
  'drc.gst@gst.gov.in',
  'scrutiny.gst@cpc.gst.gov.in',
  'asn.gst@cbic.gov.in',
];

const VENDOR_INVOICE_SENDERS = [
  'billing@reliancejio.com',
  'accounts@tatapower.com',
  'invoices@airtelbusiness.in',
  'finance@mahindralogistics.com',
  'ap@bluedart.com',
];

const CUSTOMER_INVOICE_SENDERS = [
  'accounts@bharattech.in',
  'finance@industraders.com',
  'ap@vedicindustries.com',
];

const BANK_ALERT_SENDERS = [
  'alerts@hdfcbank.com',
  'no-reply@icicibank.com',
  'alerts@sbicard.com',
  'transaction@axisbank.com',
];

const TAX_COMMUNICATION_SENDERS = [
  'donotreply@incometax.gov.in',
  'tds.cpc@incometax.gov.in',
  'intimations@tdscpc.gov.in',
];

const STATEMENT_SENDERS = [
  'statements@hdfcbank.com',
  'monthly@icicibank.com',
  'vendor.statement@tatapower.com',
];

const GENERAL_SENDERS = [
  'team@tallysolutions.com',
  'no-reply@zerodha.com',
  'newsletter@startupindia.gov.in',
  'support@razorpay.com',
  'notifications@linkedin.com',
];

const GST_NOTICE_SUBJECTS = [
  'Notice under Section 61 — GST Scrutiny for FY 2024-25',
  'DRC-01A: Show Cause Notice for short payment of tax',
  'ASN generated for GSTR-1 vs 2A mismatch',
  'Intimation u/s 62 — Assessment of non-filer of returns',
  'DRC-07: Order for demand of tax',
];

const VENDOR_INVOICE_SUBJECTS = [
  'Invoice INV-{num} from Tata Power — Due in 30 days',
  'Tax Invoice {num} — Airtel Business Corporate Plan',
  'Invoice {num} — Mahindra Logistics monthly billing',
  'Invoice {num} from Blue Dart — Freight charges',
];

const CUSTOMER_INVOICE_SUBJECTS = [
  'Invoice {num} — Sales invoice copy',
  'Tax Invoice {num} from Bharat Tech Solutions',
  'Invoice {num} sent via GSTPilot',
];

const PAYMENT_CONFIRM_SUBJECTS = [
  'Payment of ₹{amount} received — Thank you',
  'Payment Confirmation — UTR{num}',
  'NEFT Credit Confirmation — ₹{amount}',
  'Payment Receipt — Invoice {num}',
];

const BANK_ALERT_SUBJECTS = [
  'Debit of ₹{amount} from your account',
  'Credit of ₹{amount} to your account',
  'Low balance alert — Available balance ₹{amount}',
  'ATM withdrawal of ₹{amount}',
];

const TAX_COMM_SUBJECTS = [
  'Intimation u/s 143(1) — Income Tax Return processed',
  'TDS Demand Notice — Quarter {num}',
  'Notice u/s 133(6) — Call for information',
  'Refund initiated — ₹{amount}',
];

const STATEMENT_SUBJECTS = [
  'Monthly Bank Statement — {month}',
  'Vendor Statement — Tata Power — {month}',
  'Account Statement April 2026',
];

const GENERAL_SUBJECTS = [
  'Welcome to Tally Prime 2026 — New features',
  'Your monthly portfolio statement',
  'GSTPilot: Weekly digest',
  'Important: Verify your business details',
];

const EMAIL_BODIES: Record<EmailCategory, (subject: string) => string> = {
  gst_notice: (s) =>
    `Dear Taxpayer,\n\n${s}. Please log in to the GST portal to view the complete notice and file your response within the prescribed time limit.\n\nRegards,\nGST Network`,
  vendor_invoice: (s) =>
    `Dear Customer,\n\nPlease find attached the invoice mentioned in the subject. Kindly process the payment before the due date.\n\nInvoice: ${s}\n\nRegards,\nFinance Team`,
  customer_invoice: (s) =>
    `Dear Customer,\n\nPlease find attached the sales invoice. We request you to process the payment at the earliest.\n\nInvoice: ${s}\n\nRegards,\nBharat Tech Solutions`,
  payment_confirmation: (s) =>
    `Dear Sir/Madam,\n\nWe confirm receipt of payment as per the details below.\n\n${s}\n\nThank you for your business.\n\nRegards,\nAccounts Team`,
  bank_alert: (s) =>
    `Dear Customer,\n\n${s}. This is a system-generated alert. If you did not authorize this transaction, please contact customer care immediately.\n\nRegards,\nBank Alerts`,
  tax_communication: (s) =>
    `Dear Taxpayer,\n\n${s}. Please refer to the attachment for detailed calculations.\n\nRegards,\nIncome Tax Department`,
  statement: (s) =>
    `Dear Customer,\n\nPlease find attached the statement for your reference.\n\n${s}\n\nRegards,\nBank Statements`,
  general: (s) =>
    `Hello,\n\n${s}.\n\nRegards,\nTeam`,
};

// ─── Email generator ──────────────────────────────────────────────────────────

function generateEmails(
  rng: () => number,
  connectionId: string,
  organizationId: string,
  email: string,
  from?: string,
  to?: string,
): GmailMessage[] {
  const messages: GmailMessage[] = [];
  const now = new Date();

  const startDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to) : now;
  if (startDate > endDate) return [];

  // Generate 12-30 messages across the period.
  const count = randInt(rng, 12, 30);
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor((i / count) * totalDays) + randInt(rng, 0, 1);
    const msgDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    if (msgDate > endDate) continue;

    // 80% inbound, 20% outbound.
    const direction = rng() < 0.8 ? 'inbound' : 'outbound';

    // Pick a category — weighted toward realistic GST/business mix.
    const catRoll = rng();
    let category: EmailCategory;
    let sender: string;
    let subject: string;
    if (catRoll < 0.18) {
      category = 'gst_notice';
      sender = pick(rng, GST_NOTICE_SENDERS);
      subject = pick(rng, GST_NOTICE_SUBJECTS);
    } else if (catRoll < 0.35) {
      category = 'vendor_invoice';
      sender = pick(rng, VENDOR_INVOICE_SENDERS);
      subject = pick(rng, VENDOR_INVOICE_SUBJECTS).replace('{num}', String(randInt(rng, 1000, 9999)));
    } else if (catRoll < 0.5) {
      category = 'customer_invoice';
      sender = pick(rng, CUSTOMER_INVOICE_SENDERS);
      subject = pick(rng, CUSTOMER_INVOICE_SUBJECTS).replace('{num}', String(randInt(rng, 1000, 9999)));
    } else if (catRoll < 0.62) {
      category = 'payment_confirmation';
      sender = rng() < 0.5 ? pick(rng, CUSTOMER_INVOICE_SENDERS) : pick(rng, BANK_ALERT_SENDERS);
      subject = pick(rng, PAYMENT_CONFIRM_SUBJECTS)
        .replace('{amount}', String(randInt(rng, 5, 500) * 1000))
        .replace('{num}', String(randInt(rng, 10_000_000, 99_999_999)));
    } else if (catRoll < 0.74) {
      category = 'bank_alert';
      sender = pick(rng, BANK_ALERT_SENDERS);
      subject = pick(rng, BANK_ALERT_SUBJECTS)
        .replace('{amount}', String(randInt(rng, 1, 200) * 1000));
    } else if (catRoll < 0.85) {
      category = 'tax_communication';
      sender = pick(rng, TAX_COMMUNICATION_SENDERS);
      subject = pick(rng, TAX_COMM_SUBJECTS)
        .replace('{num}', String(randInt(rng, 1, 4)))
        .replace('{amount}', String(randInt(rng, 5, 500) * 1000));
    } else if (catRoll < 0.93) {
      category = 'statement';
      sender = pick(rng, STATEMENT_SENDERS);
      subject = pick(rng, STATEMENT_SUBJECTS).replace('{month}', msgDate.toLocaleString('en-IN', { month: 'long' }));
    } else {
      category = 'general';
      sender = pick(rng, GENERAL_SENDERS);
      subject = pick(rng, GENERAL_SUBJECTS).replace('{num}', String(randInt(rng, 1000, 9999)));
    }

    // For outbound, swap sender/recipient.
    const fromAddr = direction === 'inbound' ? sender : email;
    const toAddr = direction === 'inbound' ? email : sender;

    const bodyText = EMAIL_BODIES[category](subject);
    const preview = bodyText.slice(0, 500);
    const bodyHtml = `<html><body><pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${escapeHtml(bodyText)}</pre></body></html>`;

    const attachments: EmailAttachment[] = [];
    if (
      category === 'gst_notice' ||
      category === 'vendor_invoice' ||
      category === 'customer_invoice' ||
      category === 'tax_communication' ||
      category === 'statement'
    ) {
      if (rng() < 0.85) {
        const fileName = `${category}_${randInt(rng, 1000, 9999)}.pdf`;
        attachments.push({
          id: crypto.randomBytes(8).toString('hex'),
          filename: fileName,
          mimeType: 'application/pdf',
          size: randInt(rng, 20_000, 500_000),
          storageUrl: null,
        });
      }
    }

    const messageId = `<${crypto.randomBytes(12).toString('hex')}@gstpilot-mock.gmail.com>`;
    const threadId = crypto.createHash('sha1').update(messageId).digest('hex').slice(0, 16);

    const readStatus = rng() < 0.4 ? 'unread' : 'read';

    // Re-run classifier + sentiment on the message so the orchestrator can
    // trust the category. (In production the classifier runs once at sync time.)
    void classifyEmail(subject, bodyText, fromAddr);
    const sentiment = detectEmailSentiment(subject, bodyText);
    const aiSummary = summarizeEmail(subject, bodyText, category);

    messages.push({
      id: `gmail-${connectionId}-${i}-${Math.floor(rng() * 1e6)}`,
      organizationId,
      connectionId,
      messageId,
      threadId,
      direction,
      from: fromAddr,
      to: toAddr,
      cc: rng() < 0.15 ? 'accounts@bharattech.in' : null,
      bcc: null,
      replyTo: direction === 'inbound' ? fromAddr : null,
      subject,
      preview,
      bodyHtml,
      bodyText,
      category,
      aiSummary,
      sentiment,
      attachments,
      readStatus,
      receivedAt: msgDate.toISOString(),
      syncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Sort newest first.
  messages.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  return messages;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── MockGmailProvider ────────────────────────────────────────────────────────

export class MockGmailProvider implements IGmailProvider {
  readonly name = 'Mock Gmail Provider';
  readonly provider = 'mock' as const;
  readonly isLive = false;

  async connect(input: { email: string; displayName?: string }): Promise<ConnectGmailResult> {
    if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      throw new ValidationError('A valid email address is required.');
    }
    const connectionRef = `MOCK-GMAIL-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    connectionStore.set(connectionRef, {
      connectionRef,
      email: input.email.toLowerCase(),
      displayName: input.displayName ?? null,
      createdAt: Date.now(),
    });
    return {
      connectionRef,
      email: input.email.toLowerCase(),
      labels: ['INBOX', 'SENT', 'DRAFT', 'IMPORTANT'],
      message:
        'Mock Gmail connection initiated. In production, this would start the Google OAuth flow. The connection is immediately ready (no real consent needed).',
    };
  }

  async completeConnection(connectionRef: string): Promise<{
    session: GmailSession;
    profile: { email: string; displayName: string | null };
  }> {
    const entry = connectionStore.get(connectionRef);
    if (!entry) {
      throw new ValidationError('Connection reference not found. Please restart the connect flow.');
    }
    const now = Date.now();
    const expiresAt = new Date(now + 60 * 60 * 1000).toISOString(); // access token: 1 hour
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');

    const session: GmailSession = {
      accessToken,
      refreshToken,
      email: entry.email,
      provider: 'mock',
      expiresAt,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      metadata: { connectionRef },
    };
    return {
      session,
      profile: { email: entry.email, displayName: entry.displayName },
    };
  }

  async refreshSession(session: GmailSession): Promise<{ session: GmailSession }> {
    if (!session.refreshToken) {
      throw new ValidationError('No refresh token available. Please reconnect.');
    }
    return {
      session: {
        ...session,
        accessToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    };
  }

  async disconnect(session: GmailSession): Promise<void> {
    const ref = session.metadata?.connectionRef as string | undefined;
    if (ref) connectionStore.delete(ref);
  }

  async syncEmails(
    session: GmailSession,
    options?: { from?: string; to?: string; label?: string; maxResults?: number },
  ): Promise<SyncEmailsResult> {
    const rng = mulberry32(hashSeed(session.email + (options?.from ?? '') + (options?.to ?? '')));
    // connectionId / organizationId are filled in by the orchestrator.
    const all = generateEmails(rng, '', '', session.email, options?.from, options?.to);

    // Apply maxResults cap.
    const capped = options?.maxResults ? all.slice(0, options.maxResults) : all;

    return {
      success: true,
      syncedCount: capped.length,
      newCount: capped.length,
      errors: [],
      messages: capped,
    };
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
    if (!input.to || !input.subject) {
      throw new ValidationError('Recipient and subject are required.');
    }
    const messageId = `<${crypto.randomBytes(12).toString('hex')}@gstpilot-mock.gmail.com>`;
    const threadId = input.replyToMessageId
      ? crypto.createHash('sha1').update(input.replyToMessageId).digest('hex').slice(0, 16)
      : crypto.createHash('sha1').update(messageId).digest('hex').slice(0, 16);
    return {
      success: true,
      messageId,
      threadId,
      sentAt: new Date().toISOString(),
    };
  }

  async markRead(_session: GmailSession, _messageId: string, _read: boolean): Promise<void> {
    // Mock — no-op. Real provider would call gmail.users.messages.modify.
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
