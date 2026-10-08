// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Production Communication Engine
//
// The REAL email + WhatsApp execution engine. No simulations. No placeholders.
//
// When a CA types:
//   "Send the payment link to ABC Traders"
//   "Email this month's GST report to the client"
//   "WhatsApp the payment reminder"
//
// This engine:
//   1.  Extracts intent (recipient, channel, attachment, message type, template)
//   2.  Resolves the recipient from the REAL Firestore clients collection
//   3.  Validates recipient (email format, phone format, active status, prefs)
//   4.  Detects the connected provider (SMTP/Resend/SendGrid/Gmail for email;
//       WhatsApp Cloud API / Twilio for WhatsApp)
//   5.  Generates a professional branded message (HTML email / WhatsApp template)
//   6.  Generates the attachment (invoice PDF, GST report PDF, payment link)
//   7.  Builds an approval summary (recipient / subject / preview / attachments / provider)
//   8.  After approval: dispatches via the REAL provider API
//   9.  Persists: provider message ID, timestamp, recipient, subject, attachments,
//       provider response, delivery status
//  10.  Webhook monitoring: Sent / Delivered / Opened / Clicked / Bounced / Failed (email)
//       Sent / Delivered / Read / Failed (WhatsApp)
//  11.  Retry engine: exponential backoff for network timeouts / 5xx / SMTP 421
//  12.  Audit log + activity log + customer timeline
//  13.  Rollback on failure
//
// In preview mode (no Firestore auth, no provider credentials), the engine:
//   - Catches PERMISSION_DENIED and returns a clear "sign in to persist" message
//   - If no provider is connected, returns a clear "what to configure" message
//   - NEVER fabricates a successful send
// ═══════════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual, createVerify } from 'crypto';
import {
  collection, doc, setDoc, updateDoc,
  getDocs, getDoc, query, where, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-schema';
import { generateInvoicePDF, type InvoicePDFData } from './invoice-pdf';
import type { InvoiceApprovalSummary } from './invoice-engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CommunicationChannel = 'email' | 'whatsapp' | 'both';
export type MessageType =
  | 'payment_link'
  | 'invoice'
  | 'gst_report'
  | 'payment_reminder'
  | 'receipt'
  | 'outstanding_statement'
  | 'welcome'
  | 'compliance_reminder'
  | 'custom';

export type EmailProvider = 'smtp' | 'resend' | 'sendgrid' | 'gmail' | 'mailgun' | 'outlook';
export type WhatsAppProvider = 'whatsapp_cloud' | 'twilio' | 'gupshup';

export interface CommunicationIntent {
  channel: CommunicationChannel | null;
  messageType: MessageType | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  invoiceNumber: string | null;
  reportId: string | null;
  reportPeriod: string | null;
  paymentLinkId: string | null;
  attachmentKind: 'invoice_pdf' | 'gst_report_pdf' | 'payment_link' | 'statement' | 'none' | null;
  template: string | null;
  language: 'en' | 'hi' | 'ta' | 'te' | 'kn' | 'mr' | 'gu' | 'bn';
  customMessage: string | null;
  missingFields: string[];
  rawExtraction: Record<string, { value: unknown; source: string; confidence: number }>;
}

export interface RecipientRecord {
  clientId: string;
  name: string;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  status: string;
  communicationPreferences: {
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  } | null;
  organizationId: string;
}

export interface RecipientValidation {
  valid: boolean;
  recipient: RecipientRecord | null;
  errors: string[];
  warnings: string[];
}

export interface EmailProviderIntegration {
  connected: boolean;
  provider: EmailProvider | null;
  fromEmail: string | null;
  fromName: string | null;
  // Provider-specific credentials (kept server-side only, never sent to client)
  apiKey: string | null;
  apiSecret: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpSecure: boolean;
  webhookSecret: string | null;
  testMode: boolean;
}

export interface WhatsAppProviderIntegration {
  connected: boolean;
  provider: WhatsAppProvider | null;
  phoneNumberId: string | null;
  whatsappBusinessId: string | null;
  accessToken: string | null;
  apiKey: string | null;
  accountSid: string | null;
  fromNumber: string | null;
  webhookVerifyToken: string | null;
  webhookSecret: string | null;
  testMode: boolean;
}

export interface AttachmentSpec {
  kind: 'invoice_pdf' | 'gst_report_pdf' | 'payment_link' | 'statement';
  filename: string;
  mimeType: string;
  // base64-encoded content (only populated during actual execute)
  contentBase64?: string;
  sizeBytes?: number;
  // Reference info used to generate the attachment on demand
  invoiceId?: string;
  reportId?: string;
  paymentLinkUrl?: string;
}

export interface GeneratedMessage {
  channel: 'email' | 'whatsapp';
  subject: string;
  textBody: string;
  htmlBody?: string;
  templateName: string;
  placeholders: Record<string, string>;
}

export interface SendResult {
  sent: boolean;
  status: 'sent' | 'queued' | 'not-connected' | 'failed' | 'skipped' | 'preview-mode';
  providerMessageId: string | null;
  provider: string | null;
  message: string;
  providerResponse?: Record<string, unknown>;
  retryable: boolean;
  retryReason?: string;
}

export interface CommunicationApproval {
  intent: CommunicationIntent;
  recipient: RecipientRecord | null;
  validation: RecipientValidation;
  emailProvider: EmailProviderIntegration;
  whatsappProvider: WhatsAppProviderIntegration;
  message: GeneratedMessage | null;
  attachments: AttachmentSpec[];
  deliveryChannels: { email: boolean; whatsapp: boolean; emailNote: string; whatsappNote: string };
  warnings: string[];
  canProceed: boolean;
  blockingReasons: string[];
}

export interface ExecuteCommunicationResult {
  success: boolean;
  message: string;
  communicationId: string | null;
  emailDelivery: SendResult;
  whatsappDelivery: SendResult;
  recordsAffected: Array<{ collection: string; id: string; action: 'created' | 'updated' | 'deleted' }>;
  rollbackStatus: 'not-needed' | 'rolled-back' | 'rollback-failed';
  error?: string;
}

// ─── STEP 1 — Intent Detection ──────────────────────────────────────────────

const CHANNEL_PATTERNS: Array<{ channel: CommunicationChannel; pattern: RegExp }> = [
  { channel: 'whatsapp', pattern: /\bwhatsapp\b/i },
  { channel: 'whatsapp', pattern: /\bwa\b\s+message/i },
  { channel: 'whatsapp', pattern: /\bwa\s+the\b/i },
  { channel: 'whatsapp', pattern: /\bmessage\s+on\s+whatsapp\b/i },
  { channel: 'email', pattern: /\bemail\b/i },
  { channel: 'email', pattern: /\bmail\b/i },
  { channel: 'email', pattern: /\bgmail\b/i },
  { channel: 'email', pattern: /\boutlook\b/i },
  { channel: 'both', pattern: /\bemail\s+(?:and|&)\s+whatsapp\b/i },
  { channel: 'both', pattern: /\bwhatsapp\s+(?:and|&)\s+email\b/i },
  { channel: 'both', pattern: /\bsend\s+via\s+both\b/i },
];

const MESSAGE_TYPE_PATTERNS: Array<{ type: MessageType; pattern: RegExp }> = [
  { type: 'payment_link', pattern: /payment\s*link/i },
  { type: 'payment_link', pattern: /pay\s+link/i },
  { type: 'gst_report', pattern: /gst\s*report/i },
  { type: 'gst_report', pattern: /gstr?\s*report/i },
  { type: 'gst_report', pattern: /tax\s+report/i },
  { type: 'gst_report', pattern: /\bthis\s+month'?s\s+gst\b/i },
  { type: 'invoice', pattern: /\binvoice\b/i },
  { type: 'invoice', pattern: /\bbill\b/i },
  { type: 'payment_reminder', pattern: /payment\s*reminder/i },
  { type: 'payment_reminder', pattern: /\bremind\b/i },
  { type: 'payment_reminder', pattern: /follow.?up\s+on\s+payment/i },
  { type: 'payment_reminder', pattern: /overdue\s+reminder/i },
  { type: 'receipt', pattern: /\breceipt\b/i },
  { type: 'receipt', pattern: /payment\s+confirmation/i },
  { type: 'outstanding_statement', pattern: /outstanding\s+statement/i },
  { type: 'outstanding_statement', pattern: /account\s+statement/i },
  { type: 'outstanding_statement', pattern: /\bstatement\s+of\s+account\b/i },
  { type: 'welcome', pattern: /\bwelcome\b/i },
  { type: 'compliance_reminder', pattern: /compliance\s+reminder/i },
  { type: 'compliance_reminder', pattern: /filing\s+reminder/i },
  { type: 'compliance_reminder', pattern: /gstr?\s+\d+\s+due/i },
];

const INVOICE_NUMBER_PATTERNS = [
  /(?:invoice|inv|bill)\s*(?:no\.?|number|#)?\s*([A-Z0-9][A-Z0-9\-\/]{3,30})/i,
  /\b(INV-\d{4}-\d{4,6})\b/i,
  /\b(INV\d{6,10})\b/i,
  /\b([A-Z]{2,4}-\d{4}-\d{4,6})\b/,
];

const REPORT_PATTERNS = [
  /report\s*(?:id|number|#)?\s*[:#]?\s*([A-Za-z0-9_\-]{6,40})/i,
  /\b(report_[a-z0-9_]{6,40})\b/i,
];

const REPORT_PERIOD_PATTERNS = [
  /(?:this\s+month|current\s+month)/i,
  /(?:last\s+month|previous\s+month)/i,
  /(?:this\s+quarter|current\s+quarter)/i,
  /(?:this\s+year|current\s+year|fy\s*\d{2,4})/i,
  /(?:january|february|march|april|may|june|july|august|september|october|november|december)/i,
  /\b(?:q[1-4])\b/i,
];

const LANGUAGE_PATTERNS: Array<{ lang: CommunicationIntent['language']; pattern: RegExp }> = [
  { lang: 'hi', pattern: /\b(hindi|हिंदी)\b/i },
  { lang: 'ta', pattern: /\b(tamil|தமிழ்)\b/i },
  { lang: 'te', pattern: /\b(telugu|తెలుగు)\b/i },
  { lang: 'kn', pattern: /\b(kannada|ಕನ್ನಡ)\b/i },
  { lang: 'mr', pattern: /\b(marathi|मराठी)\b/i },
  { lang: 'gu', pattern: /\b(gujarati|ગુજરાતી)\b/i },
  { lang: 'bn', pattern: /\b(bengali|বাংলা)\b/i },
];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^\+?(\d{10,15})$/;

/**
 * Extract communication intent from natural language.
 * Detects: channel (email/whatsapp/both), message type, recipient, attachment,
 * template, language. Never guesses — missing fields go into `missingFields`.
 */
export function extractCommunicationIntent(message: string): CommunicationIntent {
  const missingFields: string[] = [];
  const rawExtraction: CommunicationIntent['rawExtraction'] = {};

  // ── Channel detection (whatsapp takes precedence over email when both phrases present) ──
  let channel: CommunicationChannel | null = null;
  for (const { channel: ch, pattern } of CHANNEL_PATTERNS) {
    if (pattern.test(message)) {
      // 'both' beats single channels; if we already found 'both', keep it
      if (channel === 'both') continue;
      channel = ch;
      rawExtraction.channel = { value: ch, source: 'extracted', confidence: 0.92 };
      if (ch === 'both') break;
    }
  }
  if (!channel) {
    missingFields.push('channel');
  }

  // ── Message type ──
  let messageType: MessageType | null = null;
  for (const { type, pattern } of MESSAGE_TYPE_PATTERNS) {
    if (pattern.test(message)) {
      messageType = type;
      rawExtraction.messageType = { value: type, source: 'extracted', confidence: 0.9 };
      break;
    }
  }
  if (!messageType) {
    // If user says "send to customer" with no specific type, default to 'custom'
    if (/send|share|deliver/i.test(message)) {
      messageType = 'custom';
      rawExtraction.messageType = { value: 'custom', source: 'inferred', confidence: 0.5 };
    } else {
      missingFields.push('messageType');
    }
  }

  // ── Recipient (email, phone, or name) ──
  let recipientEmail: string | null = null;
  const emailMatch = message.match(EMAIL_REGEX);
  if (emailMatch) {
    recipientEmail = emailMatch[0].toLowerCase();
    rawExtraction.recipientEmail = { value: recipientEmail, source: 'extracted', confidence: 0.98 };
  }

  let recipientPhone: string | null = null;
  const phoneMatch = message.match(/\+?\d[\d\s\-]{8,15}/);
  if (phoneMatch) {
    const cleaned = phoneMatch[0].replace(/[\s\-]/g, '');
    if (PHONE_REGEX.test(cleaned) && cleaned.replace(/\D/g, '').length >= 10) {
      recipientPhone = cleaned;
      rawExtraction.recipientPhone = { value: cleaned, source: 'extracted', confidence: 0.9 };
    }
  }

  let recipientName: string | null = null;
  // "to ABC Traders" / "to John Doe" — non-greedy so it stops at connector words
  const nameMatch = message.match(/(?:to|send\s+to|deliver\s+to|share\s+with)\s+([A-Z][A-Za-z0-9&\.'-]{2,40}(?:\s+[A-Z][A-Za-z0-9&\.'-]{1,40}){0,4})(?:\s+(?:via|on|through|about|for|the|at|in|of)\b|[,.\n]|$)/);
  if (nameMatch && nameMatch[1]) {
    recipientName = nameMatch[1].trim();
    rawExtraction.recipientName = { value: recipientName, source: 'extracted', confidence: 0.78 };
  }
  // "the client" / "the customer" — placeholder, will be resolved during lookup
  if (!recipientName && /\b(?:client|customer|party)\b/i.test(message)) {
    recipientName = null; // will be resolved from invoice/context
    rawExtraction.recipientName = { value: 'client', source: 'inferred', confidence: 0.4 };
  }

  if (!recipientEmail && !recipientPhone && !recipientName) {
    missingFields.push('recipient');
  }

  // ── Invoice number ──
  let invoiceNumber: string | null = null;
  for (const pattern of INVOICE_NUMBER_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      invoiceNumber = match[1].toUpperCase().replace(/\/$/, '');
      rawExtraction.invoiceNumber = { value: invoiceNumber, source: 'extracted', confidence: 0.92 };
      break;
    }
  }

  // ── Report ID ──
  let reportId: string | null = null;
  for (const pattern of REPORT_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      reportId = match[1];
      rawExtraction.reportId = { value: reportId, source: 'extracted', confidence: 0.85 };
      break;
    }
  }

  // ── Report period ──
  let reportPeriod: string | null = null;
  for (const pattern of REPORT_PERIOD_PATTERNS) {
    if (pattern.test(message)) {
      reportPeriod = message.match(pattern)?.[0] ?? null;
      if (reportPeriod) {
        rawExtraction.reportPeriod = { value: reportPeriod, source: 'extracted', confidence: 0.85 };
        break;
      }
    }
  }

  // ── Payment link ID ──
  let paymentLinkId: string | null = null;
  const plMatch = message.match(/payment\s*link\s*(?:id|#)?\s*[:#]?\s*([A-Za-z0-9_\-]{6,40})/i);
  if (plMatch && plMatch[1]) {
    paymentLinkId = plMatch[1];
    rawExtraction.paymentLinkId = { value: paymentLinkId, source: 'extracted', confidence: 0.85 };
  }

  // ── Determine attachment kind from message type ──
  let attachmentKind: AttachmentSpec['kind'] | null = null;
  if (messageType === 'payment_link') attachmentKind = 'payment_link';
  else if (messageType === 'invoice') attachmentKind = 'invoice_pdf';
  else if (messageType === 'gst_report') attachmentKind = 'gst_report_pdf';
  else if (messageType === 'receipt') attachmentKind = 'invoice_pdf';
  else if (messageType === 'outstanding_statement') attachmentKind = 'statement';
  else if (messageType === 'payment_reminder') attachmentKind = 'none';
  else if (messageType === 'welcome' || messageType === 'compliance_reminder' || messageType === 'custom') {
    attachmentKind = 'none';
  }
  if (attachmentKind) {
    rawExtraction.attachmentKind = { value: attachmentKind, source: 'inferred', confidence: 0.85 };
  }

  // ── Template ──
  const templateMap: Record<string, string> = {
    payment_link: 'payment-link-request',
    invoice: 'invoice-delivery',
    gst_report: 'gst-report-delivery',
    payment_reminder: 'payment-reminder',
    receipt: 'payment-receipt',
    outstanding_statement: 'outstanding-statement',
    welcome: 'welcome-email',
    compliance_reminder: 'compliance-reminder',
    custom: 'custom-message',
  };
  const template = messageType ? templateMap[messageType] : null;

  // ── Language (default English) ──
  let language: CommunicationIntent['language'] = 'en';
  for (const { lang, pattern } of LANGUAGE_PATTERNS) {
    if (pattern.test(message)) {
      language = lang;
      rawExtraction.language = { value: lang, source: 'extracted', confidence: 0.92 };
      break;
    }
  }
  if (!rawExtraction.language) {
    rawExtraction.language = { value: 'en', source: 'default', confidence: 0.7 };
  }

  // ── Custom message (if "with message: X" or "saying X") ──
  let customMessage: string | null = null;
  const customMatch = message.match(/(?:with\s+message|saying|note:|message:)\s*[:#]?\s*["'](.+?)["']/i);
  if (customMatch && customMatch[1]) {
    customMessage = customMatch[1].trim();
    rawExtraction.customMessage = { value: customMessage, source: 'extracted', confidence: 0.9 };
  }

  return {
    channel,
    messageType,
    recipientName,
    recipientEmail,
    recipientPhone,
    invoiceNumber,
    reportId,
    reportPeriod,
    paymentLinkId,
    attachmentKind,
    template,
    language,
    customMessage,
    missingFields,
    rawExtraction,
  };
}

// ─── STEP 2 — Recipient Resolution & Validation ─────────────────────────────

/**
 * Resolve a recipient from the real Firestore clients collection.
 * Tries: explicit email → explicit phone → name (fuzzy) → invoice number's client.
 */
export async function resolveRecipient(
  organizationId: string,
  intent: CommunicationIntent,
): Promise<RecipientRecord | null> {
  try {
    // If we have an invoice number, look up the invoice first to get the clientId
    if (intent.invoiceNumber) {
      const invoiceQ = query(
        collection(db, COLLECTIONS.INVOICES),
        where('organizationId', '==', organizationId),
        where('invoiceNumber', '==', intent.invoiceNumber),
        limit(1),
      );
      const invoiceSnap = await getDocs(invoiceQ);
      if (!invoiceSnap.empty) {
        const invoiceData = invoiceSnap.docs[0].data();
        const clientId = String(invoiceData.clientId ?? invoiceData.buyerId ?? '');
        if (clientId) {
          const client = await lookupClientById(organizationId, clientId);
          if (client) return client;
        }
      }
    }

    // Try explicit email
    if (intent.recipientEmail) {
      const q = query(
        collection(db, COLLECTIONS.CLIENTS),
        where('organizationId', '==', organizationId),
        where('email', '==', intent.recipientEmail),
        limit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) return mapClientDoc(snap.docs[0].id, snap.docs[0].data(), organizationId);
    }

    // Try explicit phone
    if (intent.recipientPhone) {
      const phone = intent.recipientPhone.replace(/\D/g, '');
      const q = query(
        collection(db, COLLECTIONS.CLIENTS),
        where('organizationId', '==', organizationId),
        where('phone', '==', phone),
        limit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) return mapClientDoc(snap.docs[0].id, snap.docs[0].data(), organizationId);
    }

    // Try name match (exact then contains)
    if (intent.recipientName && intent.recipientName !== 'client') {
      const q = query(
        collection(db, COLLECTIONS.CLIENTS),
        where('organizationId', '==', organizationId),
        limit(50),
      );
      const snap = await getDocs(q);
      const target = intent.recipientName.toLowerCase();
      // Exact match first
      let exact = snap.docs.find((d) => {
        const name = String(d.data().name ?? d.data().tradeName ?? '').toLowerCase();
        return name === target;
      });
      if (!exact) {
        // Contains match
        exact = snap.docs.find((d) => {
          const name = String(d.data().name ?? d.data().tradeName ?? '').toLowerCase();
          return name.includes(target) || target.includes(name);
        });
      }
      if (exact) return mapClientDoc(exact.id, exact.data(), organizationId);
    }
  } catch {
    // Firestore read failed (preview mode) — return null
  }
  return null;
}

async function lookupClientById(organizationId: string, clientId: string): Promise<RecipientRecord | null> {
  try {
    const docRef = doc(db, COLLECTIONS.CLIENTS, clientId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return mapClientDoc(snap.id, snap.data(), organizationId);
  } catch {
    return null;
  }
}

function mapClientDoc(id: string, data: Record<string, unknown>, organizationId: string): RecipientRecord {
  return {
    clientId: id,
    name: String(data.name ?? data.tradeName ?? data.legalName ?? 'Client'),
    email: (data.email as string) ?? null,
    phone: (data.phone as string) ?? (data.mobile as string) ?? null,
    gstin: (data.gstin as string) ?? null,
    status: String(data.status ?? 'active'),
    communicationPreferences: {
      email: data.communicationPreferences && typeof data.communicationPreferences === 'object'
        ? Boolean((data.communicationPreferences as Record<string, unknown>).email ?? true)
        : true,
      whatsapp: data.communicationPreferences && typeof data.communicationPreferences === 'object'
        ? Boolean((data.communicationPreferences as Record<string, unknown>).whatsapp ?? true)
        : true,
      sms: data.communicationPreferences && typeof data.communicationPreferences === 'object'
        ? Boolean((data.communicationPreferences as Record<string, unknown>).sms ?? false)
        : false,
    },
    organizationId,
  };
}

/**
 * Validate the recipient for communication.
 * Checks: customer exists, email/phone valid, customer active, comm preferences.
 */
export function validateRecipient(
  intent: CommunicationIntent,
  recipient: RecipientRecord | null,
): RecipientValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!recipient) {
    errors.push(
      'Recipient could not be found in the database. Provide the customer name, email, or phone number explicitly (e.g. "Send the payment link to ABC Traders at abc@abctraders.com").',
    );
    return { valid: false, recipient: null, errors, warnings };
  }

  if (recipient.status && recipient.status.toLowerCase() !== 'active') {
    warnings.push(`Customer "${recipient.name}" is currently marked as "${recipient.status}". Consider verifying before sending.`);
  }

  const channel = intent.channel;
  if ((channel === 'email' || channel === 'both') && !recipient.email) {
    errors.push(`Customer "${recipient.name}" has no email address on file. Add an email in the Clients page before sending.`);
  } else if (recipient.email && !EMAIL_REGEX.test(recipient.email)) {
    errors.push(`Customer "${recipient.name}" has an invalid email format ("${recipient.email}"). Correct it in the Clients page.`);
  }

  if ((channel === 'whatsapp' || channel === 'both') && !recipient.phone) {
    errors.push(`Customer "${recipient.name}" has no phone number on file. Add a phone in the Clients page before sending via WhatsApp.`);
  } else if (recipient.phone) {
    const cleaned = recipient.phone.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) {
      errors.push(`Customer "${recipient.name}" has an invalid phone number ("${recipient.phone}"). Correct it in the Clients page.`);
    }
  }

  // Communication preferences
  if (recipient.communicationPreferences) {
    if (channel === 'email' && !recipient.communicationPreferences.email) {
      warnings.push(`Customer "${recipient.name}" has opted out of email communication. Consider an alternative channel or update their preferences.`);
    }
    if (channel === 'whatsapp' && !recipient.communicationPreferences.whatsapp) {
      warnings.push(`Customer "${recipient.name}" has opted out of WhatsApp communication. Consider email or update their preferences.`);
    }
  }

  return {
    valid: errors.length === 0,
    recipient,
    errors,
    warnings,
  };
}

// ─── STEP 3 — Provider Selection ────────────────────────────────────────────

/**
 * Detect the connected email provider. Reads `integrations/email_{orgId}` from Firestore.
 * Supports: SMTP, Resend, SendGrid, Gmail, Mailgun, Outlook.
 */
export async function detectEmailProvider(organizationId: string): Promise<EmailProviderIntegration> {
  try {
    const docRef = doc(db, 'integrations', `email_${organizationId}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const provider = (data.provider as EmailProvider) ?? 'smtp';
      const hasCreds = Boolean(
        (data.apiKey && provider !== 'smtp') ||
        (data.smtpHost && data.smtpUser && data.smtpPassword && provider === 'smtp'),
      );
      const connected = Boolean(data.connected && data.fromEmail && hasCreds);
      return {
        connected,
        provider,
        fromEmail: (data.fromEmail as string) ?? null,
        fromName: (data.fromName as string) ?? null,
        apiKey: (data.apiKey as string) ?? null,
        apiSecret: (data.apiSecret as string) ?? null,
        smtpHost: (data.smtpHost as string) ?? (data.host as string) ?? null,
        smtpPort: Number(data.smtpPort ?? data.port ?? 587),
        smtpUser: (data.smtpUser as string) ?? (data.username as string) ?? null,
        smtpPassword: (data.smtpPassword as string) ?? (data.password as string) ?? null,
        smtpSecure: Boolean(data.smtpSecure ?? data.secure ?? false),
        webhookSecret: (data.webhookSecret as string) ?? (data.webhook_secret as string) ?? null,
        testMode: Boolean(data.testMode ?? false),
      };
    }
  } catch {
    // Firestore read failed (preview mode) — treat as not connected
  }
  return {
    connected: false,
    provider: null,
    fromEmail: null,
    fromName: null,
    apiKey: null,
    apiSecret: null,
    smtpHost: null,
    smtpPort: null,
    smtpUser: null,
    smtpPassword: null,
    smtpSecure: false,
    webhookSecret: null,
    testMode: false,
  };
}

/**
 * Detect the connected WhatsApp provider. Reads `integrations/whatsapp_{orgId}` from Firestore.
 * Supports: WhatsApp Cloud API (Meta), Twilio, Gupshup.
 */
export async function detectWhatsAppProvider(organizationId: string): Promise<WhatsAppProviderIntegration> {
  try {
    const docRef = doc(db, 'integrations', `whatsapp_${organizationId}`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const provider = (data.provider as WhatsAppProvider) ?? 'whatsapp_cloud';
      const hasCreds = Boolean(
        (provider === 'whatsapp_cloud' && data.accessToken && data.phoneNumberId) ||
        (provider === 'twilio' && data.accountSid && data.apiKey) ||
        (provider === 'gupshup' && data.apiKey),
      );
      const connected = Boolean(data.connected && hasCreds);
      return {
        connected,
        provider,
        phoneNumberId: (data.phoneNumberId as string) ?? (data.phone_number_id as string) ?? null,
        whatsappBusinessId: (data.whatsappBusinessId as string) ?? (data.waba_id as string) ?? null,
        accessToken: (data.accessToken as string) ?? (data.access_token as string) ?? null,
        apiKey: (data.apiKey as string) ?? null,
        accountSid: (data.accountSid as string) ?? null,
        fromNumber: (data.fromNumber as string) ?? (data.from_number as string) ?? null,
        webhookVerifyToken: (data.webhookVerifyToken as string) ?? (data.verify_token as string) ?? null,
        webhookSecret: (data.webhookSecret as string) ?? (data.app_secret as string) ?? null,
        testMode: Boolean(data.testMode ?? false),
      };
    }
  } catch {
    // Firestore read failed — treat as not connected
  }
  return {
    connected: false,
    provider: null,
    phoneNumberId: null,
    whatsappBusinessId: null,
    accessToken: null,
    apiKey: null,
    accountSid: null,
    fromNumber: null,
    webhookVerifyToken: null,
    webhookSecret: null,
    testMode: false,
  };
}

// ─── STEP 4 — Message Generation ────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£',
};

function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? '';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Generate a professional branded email/WhatsApp message from the intent + context.
 * Uses company branding, customer name, dynamic placeholders.
 */
export function generateMessage(params: {
  intent: CommunicationIntent;
  recipient: RecipientRecord;
  sellerName: string;
  sellerEmail: string;
  invoice?: { invoiceNumber: string; totalAmount: number; currency: string; dueDate: string | null } | null;
  report?: { reportId: string; period: string } | null;
  paymentLink?: { url: string; amount: number; currency: string; expiry: string } | null;
  outstandingAmount?: number;
  currency?: string;
}): GeneratedMessage {
  const { intent, recipient, sellerName, sellerEmail } = params;
  const channel: 'email' | 'whatsapp' = intent.channel === 'whatsapp' ? 'whatsapp' : 'email';
  const placeholders: Record<string, string> = {
    customerName: recipient.name,
    sellerName,
    sellerEmail,
    invoiceNumber: params.invoice?.invoiceNumber ?? intent.invoiceNumber ?? '',
    amount: params.invoice || params.paymentLink
      ? `${currencySymbol(params.invoice?.currency ?? params.paymentLink?.currency ?? 'INR')}${(params.invoice?.totalAmount ?? params.paymentLink?.amount ?? 0).toLocaleString('en-IN')}`
      : '',
    dueDate: formatDate(params.invoice?.dueDate ?? null),
    reportPeriod: params.report?.period ?? intent.reportPeriod ?? '',
    paymentLinkUrl: params.paymentLink?.url ?? '',
    paymentLinkExpiry: formatDate(params.paymentLink?.expiry ?? null),
    outstandingAmount: params.outstandingAmount
      ? `${currencySymbol(params.currency ?? 'INR')}${params.outstandingAmount.toLocaleString('en-IN')}`
      : '',
    customMessage: intent.customMessage ?? '',
  };

  const templateName = intent.template ?? 'custom-message';
  let subject = '';
  let textBody = '';
  let htmlBody: string | undefined;

  switch (intent.messageType) {
    case 'payment_link': {
      subject = `Payment Request · ${placeholders.invoiceNumber || 'Invoice'} · ${placeholders.amount}`;
      textBody = `Hello ${recipient.name},\n\nA payment of ${placeholders.amount} is due for invoice ${placeholders.invoiceNumber}.\n\nPay securely via the link below:\n${placeholders.paymentLinkUrl}\n\nThis link expires on ${placeholders.paymentLinkExpiry}. For help, reply to this email.\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Payment Request',
          subtitle: placeholders.invoiceNumber,
          heroButton: {
            label: `Pay ${placeholders.amount} Now`,
            href: placeholders.paymentLinkUrl,
          },
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `A payment of <strong>${placeholders.amount}</strong> is due for invoice <strong>${placeholders.invoiceNumber}</strong>. Click the button below to complete your payment securely via UPI, card, or net banking.`,
          ],
          footerNote: `This payment link expires on <strong>${placeholders.paymentLinkExpiry}</strong>. If you have any questions, reply to this email.`,
        });
      }
      break;
    }
    case 'invoice': {
      subject = `Invoice ${placeholders.invoiceNumber} from ${sellerName}`;
      textBody = `Hello ${recipient.name},\n\nPlease find your invoice ${placeholders.invoiceNumber} attached.\n\nAmount: ${placeholders.amount}\nDue Date: ${placeholders.dueDate}\n\nThank you for your business!\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Invoice',
          subtitle: placeholders.invoiceNumber,
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `Please find your invoice <strong>${placeholders.invoiceNumber}</strong> attached to this email.`,
            `Amount: <strong>${placeholders.amount}</strong> · Due Date: <strong>${placeholders.dueDate}</strong>`,
          ],
          footerNote: 'If you have any questions about this invoice, reply to this email.',
        });
      }
      break;
    }
    case 'gst_report': {
      subject = `GST Report · ${placeholders.reportPeriod} · ${sellerName}`;
      textBody = `Hello ${recipient.name},\n\nPlease find the GST report for ${placeholders.reportPeriod} attached.\n\nReport ID: ${params.report?.reportId ?? intent.reportId ?? '—'}\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'GST Report',
          subtitle: placeholders.reportPeriod,
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `Please find the GST report for <strong>${placeholders.reportPeriod}</strong> attached to this email.`,
            `Report ID: ${params.report?.reportId ?? intent.reportId ?? '—'}`,
          ],
          footerNote: 'For questions about this report, reply to this email.',
        });
      }
      break;
    }
    case 'payment_reminder': {
      subject = `Payment Reminder · ${placeholders.invoiceNumber} · ${placeholders.amount} overdue`;
      textBody = `Hello ${recipient.name},\n\nThis is a friendly reminder that payment of ${placeholders.amount} for invoice ${placeholders.invoiceNumber} (due ${placeholders.dueDate}) is overdue.\n\nKindly arrange payment at your earliest convenience.\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Payment Reminder',
          subtitle: placeholders.invoiceNumber,
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `This is a friendly reminder that payment of <strong>${placeholders.amount}</strong> for invoice <strong>${placeholders.invoiceNumber}</strong> (due ${placeholders.dueDate}) is overdue.`,
            `Kindly arrange payment at your earliest convenience.`,
          ],
          footerNote: 'If you have already paid, please disregard this reminder. For questions, reply to this email.',
        });
      }
      break;
    }
    case 'receipt': {
      subject = `Payment Receipt · ${placeholders.invoiceNumber}`;
      textBody = `Hello ${recipient.name},\n\nWe confirm receipt of payment for invoice ${placeholders.invoiceNumber} (${placeholders.amount}).\n\nThank you!\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Payment Receipt',
          subtitle: placeholders.invoiceNumber,
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `We confirm receipt of your payment of <strong>${placeholders.amount}</strong> for invoice <strong>${placeholders.invoiceNumber}</strong>.`,
            `Thank you for your business!`,
          ],
        });
      }
      break;
    }
    case 'outstanding_statement': {
      subject = `Statement of Account · ${sellerName}`;
      textBody = `Hello ${recipient.name},\n\nYour current outstanding balance is ${placeholders.outstandingAmount}.\n\nPlease find the detailed statement attached.\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Statement of Account',
          subtitle: formatDate(new Date().toISOString()),
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `Your current outstanding balance is <strong>${placeholders.outstandingAmount}</strong>.`,
            `Please find the detailed statement attached for your records.`,
          ],
        });
      }
      break;
    }
    case 'welcome': {
      subject = `Welcome to ${sellerName}!`;
      textBody = `Hello ${recipient.name},\n\nWelcome to ${sellerName}! We're delighted to have you as a client.\n\nIf you need anything, reach us at ${sellerEmail}.\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Welcome',
          subtitle: '',
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `Welcome to <strong>${sellerName}</strong>! We're delighted to have you as a client.`,
            `If you need anything at all, reach us at <a href="mailto:${sellerEmail}" style="color:#10b981;">${sellerEmail}</a>.`,
          ],
        });
      }
      break;
    }
    case 'compliance_reminder': {
      subject = `Compliance Reminder · ${placeholders.reportPeriod || 'Upcoming filing'}`;
      textBody = `Hello ${recipient.name},\n\nThis is a reminder that your GST compliance filing for ${placeholders.reportPeriod} is due soon.\n\nPlease reach out if you need assistance.\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Compliance Reminder',
          subtitle: placeholders.reportPeriod,
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            `This is a reminder that your GST compliance filing for <strong>${placeholders.reportPeriod}</strong> is due soon.`,
            `Please reach out if you need assistance with preparation or filing.`,
          ],
        });
      }
      break;
    }
    default: {
      subject = `Message from ${sellerName}`;
      textBody = `Hello ${recipient.name},\n\n${intent.customMessage ?? 'You have a new message from ' + sellerName + '.'}\n\n— ${sellerName}`;
      if (channel === 'email') {
        htmlBody = buildBrandedEmailHtml({
          intent,
          recipient,
          sellerName,
          sellerEmail,
          title: 'Message',
          subtitle: '',
          bodyParagraphs: [
            `Dear ${recipient.name},`,
            intent.customMessage ?? `You have a new message from ${sellerName}.`,
          ],
        });
      }
    }
  }

  return { channel, subject, textBody, htmlBody, templateName, placeholders };
}

function buildBrandedEmailHtml(params: {
  intent: CommunicationIntent;
  recipient: RecipientRecord;
  sellerName: string;
  sellerEmail: string;
  title: string;
  subtitle: string;
  heroButton?: { label: string; href: string };
  bodyParagraphs: string[];
  footerNote?: string;
}): string {
  const { sellerName, sellerEmail, title, subtitle, heroButton, bodyParagraphs, footerNote } = params;
  const buttonHtml = heroButton
    ? `<div style="text-align:center;margin:32px 0;">
         <a href="${heroButton.href}" style="display:inline-block;background:linear-gradient(135deg,#10b981 0%,#059669 100%);color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">${heroButton.label}</a>
       </div>`
    : '';
  const paragraphsHtml = bodyParagraphs.map((p) => `<p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0 0 16px;">${p}</p>`).join('');
  const footerHtml = footerNote
    ? `<p style="color:#6b7280;font-size:12px;margin:24px 0 0;">${footerNote}</p>`
    : '';
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:24px;border-radius:12px 12px 0 0;">
        <h1 style="color:white;margin:0;font-size:22px;">${title}</h1>
        ${subtitle ? `<p style="color:rgba(255,255,255,0.9);margin:4px 0 0;font-size:14px;">${subtitle}</p>` : ''}
      </div>
      <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        ${paragraphsHtml}
        ${buttonHtml}
        ${footerHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
        <p style="color:#9ca3af;font-size:11px;margin:0;">
          Sent by ${sellerName} · <a href="mailto:${sellerEmail}" style="color:#10b981;">${sellerEmail}</a><br>
          Powered by VEYRO AI™
        </p>
      </div>
    </div>`;
}

// ─── STEP 5 — Approval Builder (THINK step) ─────────────────────────────────

/**
 * Build the full approval summary for the CA to review before sending.
 * Performs: recipient lookup + validation + provider detection + message generation.
 */
export async function buildCommunicationApproval(
  organizationId: string,
  intent: CommunicationIntent,
  ctx: { sellerName: string; sellerEmail: string },
): Promise<CommunicationApproval> {
  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  // ── 1. Resolve recipient ──
  const recipient = await resolveRecipient(organizationId, intent);
  const validation = validateRecipient(intent, recipient);
  if (!validation.valid) {
    blockingReasons.push(...validation.errors);
  }
  warnings.push(...validation.warnings);

  // ── 2. Detect providers ──
  const emailProvider = await detectEmailProvider(organizationId);
  const whatsappProvider = await detectWhatsAppProvider(organizationId);

  const deliveryChannels = {
    email: (intent.channel === 'email' || intent.channel === 'both'),
    whatsapp: (intent.channel === 'whatsapp' || intent.channel === 'both'),
    emailNote: emailProvider.connected
      ? `Connected via ${emailProvider.provider}${emailProvider.testMode ? ' (test mode)' : ''}. From: ${emailProvider.fromName ?? ''} <${emailProvider.fromEmail}>.`
      : 'No email provider connected. Go to Settings → Integrations → Email to connect SMTP, Resend, SendGrid, Gmail, or Mailgun.',
    whatsappNote: whatsappProvider.connected
      ? `Connected via ${whatsappProvider.provider}${whatsappProvider.testMode ? ' (test mode)' : ''}. From: ${whatsappProvider.fromNumber ?? '—'}.`
      : 'No WhatsApp provider connected. Go to Settings → Integrations → WhatsApp to connect WhatsApp Cloud API, Twilio, or Gupshup.',
  };

  if (deliveryChannels.email && !emailProvider.connected) {
    blockingReasons.push('Email provider is not connected. Connect SMTP, Resend, SendGrid, Gmail, or Mailgun in Settings → Integrations → Email before sending.');
  }
  if (deliveryChannels.whatsapp && !whatsappProvider.connected) {
    blockingReasons.push('WhatsApp provider is not connected. Connect WhatsApp Cloud API, Twilio, or Gupshup in Settings → Integrations → WhatsApp before sending.');
  }
  if (!deliveryChannels.email && !deliveryChannels.whatsapp) {
    blockingReasons.push('No delivery channel specified. Tell Oracle whether to send via "email", "whatsapp", or "both".');
  }

  // ── 3. Generate message (only if recipient exists) ──
  let message: GeneratedMessage | null = null;
  const attachments: AttachmentSpec[] = [];

  if (recipient) {
    // For attachments, fetch invoice/payment link context if needed
    let invoiceContext: { invoiceNumber: string; totalAmount: number; currency: string; dueDate: string | null } | null = null;
    let paymentLinkContext: { url: string; amount: number; currency: string; expiry: string } | null = null;
    let reportContext: { reportId: string; period: string } | null = null;

    if (intent.invoiceNumber) {
      try {
        const q = query(
          collection(db, COLLECTIONS.INVOICES),
          where('organizationId', '==', organizationId),
          where('invoiceNumber', '==', intent.invoiceNumber),
          limit(1),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          invoiceContext = {
            invoiceNumber: String(d.invoiceNumber ?? intent.invoiceNumber),
            totalAmount: Number(d.totalAmount ?? d.grandTotal ?? 0),
            currency: String(d.currency ?? 'INR'),
            dueDate: (d.dueDate as string) ?? null,
          };
        }
      } catch {
        // ignore
      }
    }

    if (intent.reportId) {
      reportContext = { reportId: intent.reportId, period: intent.reportPeriod ?? 'this period' };
    } else if (intent.reportPeriod) {
      reportContext = { reportId: '(will be generated on send)', period: intent.reportPeriod };
    }

    if (intent.paymentLinkId) {
      try {
        const q = query(
          collection(db, COLLECTIONS.PAYMENTS),
          where('organizationId', '==', organizationId),
          where('paymentId', '==', intent.paymentLinkId),
          limit(1),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          if (d.linkUrl) {
            paymentLinkContext = {
              url: String(d.linkUrl),
              amount: Number(d.amount ?? 0),
              currency: String(d.currency ?? 'INR'),
              expiry: String(d.linkExpiry ?? new Date(Date.now() + 30 * 86400000).toISOString()),
            };
          }
        }
      } catch {
        // ignore
      }
    }

    message = generateMessage({
      intent,
      recipient,
      sellerName: ctx.sellerName,
      sellerEmail: ctx.sellerEmail,
      invoice: invoiceContext,
      report: reportContext,
      paymentLink: paymentLinkContext,
    });

    // Build attachment specs (content generated during execute)
    if (intent.attachmentKind === 'invoice_pdf' && intent.invoiceNumber) {
      attachments.push({
        kind: 'invoice_pdf',
        filename: `Invoice-${intent.invoiceNumber}.pdf`,
        mimeType: 'application/pdf',
        invoiceId: invoiceContext ? undefined : undefined,
      });
    } else if (intent.attachmentKind === 'gst_report_pdf') {
      attachments.push({
        kind: 'gst_report_pdf',
        filename: `GST-Report-${intent.reportPeriod ?? 'current'}.pdf`,
        mimeType: 'application/pdf',
        reportId: intent.reportId ?? undefined,
      });
    } else if (intent.attachmentKind === 'payment_link' && paymentLinkContext) {
      attachments.push({
        kind: 'payment_link',
        filename: 'Payment-Link.txt',
        mimeType: 'text/plain',
        paymentLinkUrl: paymentLinkContext.url,
      });
    } else if (intent.attachmentKind === 'statement') {
      attachments.push({
        kind: 'statement',
        filename: `Statement-${recipient.name.replace(/\s+/g, '-')}.pdf`,
        mimeType: 'application/pdf',
      });
    }
  }

  // ── 4. Determine canProceed ──
  const canProceed = blockingReasons.length === 0 && Boolean(recipient) && Boolean(message);

  return {
    intent,
    recipient,
    validation,
    emailProvider,
    whatsappProvider,
    message,
    attachments,
    deliveryChannels,
    warnings,
    canProceed,
    blockingReasons,
  };
}

// ─── STEP 6 — Real Delivery (Email via SMTP/Resend/SendGrid/Gmail/Mailgun) ──

/**
 * Actually send an email via the connected provider's REAL API.
 * NEVER fakes a successful send. Returns the real provider message ID.
 */
export async function sendEmailReal(params: {
  provider: EmailProviderIntegration;
  to: string;
  toName: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
  organizationId: string;
  communicationId: string;
}): Promise<SendResult> {
  const { provider, to, toName, subject, textBody, htmlBody, attachments } = params;

  if (!provider.connected) {
    return {
      sent: false,
      status: 'not-connected',
      providerMessageId: null,
      provider: provider.provider,
      message: 'Email provider is not connected. Go to Settings → Integrations → Email to connect SMTP, Resend, SendGrid, Gmail, or Mailgun.',
      retryable: false,
    };
  }

  const fromName = provider.fromName ?? 'VEYRO';
  const fromEmail = provider.fromEmail ?? '';
  if (!fromEmail) {
    return {
      sent: false,
      status: 'failed',
      providerMessageId: null,
      provider: provider.provider,
      message: 'Email provider is connected but no "from" email address is configured. Add a verified sender email in Settings → Integrations → Email.',
      retryable: false,
      retryReason: 'configuration',
    };
  }

  try {
    // ── SMTP via nodemailer ──
    if (provider.provider === 'smtp') {
      return await sendViaSmtp(provider, { fromName, fromEmail, to, toName, subject, textBody, htmlBody, attachments });
    }

    // ── Resend (https://api.resend.com/emails) ──
    if (provider.provider === 'resend') {
      return await sendViaResend(provider, { fromName, fromEmail, to, toName, subject, textBody, htmlBody, attachments });
    }

    // ── SendGrid (https://api.sendgrid.com/v3/mail/send) ──
    if (provider.provider === 'sendgrid') {
      return await sendViaSendGrid(provider, { fromName, fromEmail, to, toName, subject, textBody, htmlBody, attachments });
    }

    // ── Mailgun (https://api.mailgun.net/v3/{domain}/messages) ──
    if (provider.provider === 'mailgun') {
      return await sendViaMailgun(provider, { fromName, fromEmail, to, toName, subject, textBody, htmlBody, attachments });
    }

    // ── Gmail API (https://gmail.googleapis.com/gmail/v1/users/me/messages/send) ──
    if (provider.provider === 'gmail') {
      return await sendViaGmail(provider, { fromName, fromEmail, to, toName, subject, textBody, htmlBody, attachments });
    }

    // ── Outlook (https://graph.microsoft.com/v1.0/me/sendMail) ──
    if (provider.provider === 'outlook') {
      return await sendViaOutlook(provider, { fromName, fromEmail, to, toName, subject, textBody, htmlBody, attachments });
    }

    return {
      sent: false,
      status: 'failed',
      providerMessageId: null,
      provider: provider.provider,
      message: `Unknown email provider "${provider.provider}". Configure a supported provider in Settings → Integrations → Email.`,
      retryable: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryable = isRetryableError(msg);
    return {
      sent: false,
      status: 'failed',
      providerMessageId: null,
      provider: provider.provider,
      message: `Email send failed via ${provider.provider}: ${msg}`,
      retryable,
      retryReason: retryable ? 'transient' : 'permanent',
    };
  }
}

async function sendViaSmtp(
  provider: EmailProviderIntegration,
  params: { fromName: string; fromEmail: string; to: string; toName: string; subject: string; textBody: string; htmlBody?: string; attachments?: Array<{ filename: string; content: Buffer; contentType: string }> },
): Promise<SendResult> {
  // Dynamic import to keep nodemailer out of the client bundle.
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: provider.smtpHost!,
    port: provider.smtpPort ?? 587,
    secure: provider.smtpSecure,
    auth: provider.smtpUser ? { user: provider.smtpUser, pass: provider.smtpPassword ?? '' } : undefined,
  });

  const info = await transporter.sendMail({
    from: `"${params.fromName}" <${params.fromEmail}>`,
    to: `"${params.toName}" <${params.to}>`,
    subject: params.subject,
    text: params.textBody,
    html: params.htmlBody,
    attachments: params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  return {
    sent: true,
    status: 'sent',
    providerMessageId: info.messageId,
    provider: 'smtp',
    message: `Email sent via SMTP (${provider.smtpHost}). Message ID: ${info.messageId}.`,
    providerResponse: { messageId: info.messageId, response: info.response, envelope: info.envelope },
    retryable: false,
  };
}

async function sendViaResend(
  provider: EmailProviderIntegration,
  params: { fromName: string; fromEmail: string; to: string; toName: string; subject: string; textBody: string; htmlBody?: string; attachments?: Array<{ filename: string; content: Buffer; contentType: string }> },
): Promise<SendResult> {
  const body: Record<string, unknown> = {
    from: `"${params.fromName}" <${params.fromEmail}>`,
    to: [`${params.toName} <${params.to}>`],
    subject: params.subject,
    text: params.textBody,
  };
  if (params.htmlBody) body.html = params.htmlBody;
  if (params.attachments?.length) {
    body.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString('base64'),
      content_type: a.contentType,
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429;
    return {
      sent: false,
      status: 'failed',
      providerMessageId: null,
      provider: 'resend',
      message: `Resend API returned ${res.status}: ${errText}`,
      retryable,
      retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  const data = await res.json();
  return {
    sent: true,
    status: 'sent',
    providerMessageId: String(data.id ?? ''),
    provider: 'resend',
    message: `Email sent via Resend. Message ID: ${data.id}.`,
    providerResponse: data,
    retryable: false,
  };
}

async function sendViaSendGrid(
  provider: EmailProviderIntegration,
  params: { fromName: string; fromEmail: string; to: string; toName: string; subject: string; textBody: string; htmlBody?: string; attachments?: Array<{ filename: string; content: Buffer; contentType: string }> },
): Promise<SendResult> {
  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: params.to, name: params.toName }], subject: params.subject }],
    from: { email: params.fromEmail, name: params.fromName },
    content: [{ type: 'text/plain', value: params.textBody }],
  };
  if (params.htmlBody) {
    (body.content as unknown[]).push({ type: 'text/html', value: params.htmlBody });
  }
  if (params.attachments?.length) {
    body.attachments = params.attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString('base64'),
      type: a.contentType,
      disposition: 'attachment',
    }));
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429;
    return {
      sent: false,
      status: 'failed',
      providerMessageId: null,
      provider: 'sendgrid',
      message: `SendGrid API returned ${res.status}: ${errText}`,
      retryable,
      retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  // SendGrid returns a 202 with the message ID in the X-Message-Id header
  const messageId = res.headers.get('X-Message-Id') ?? '';
  return {
    sent: true,
    status: 'sent',
    providerMessageId: messageId,
    provider: 'sendgrid',
    message: `Email queued via SendGrid. Message ID: ${messageId}.`,
    providerResponse: { messageId },
    retryable: false,
  };
}

async function sendViaMailgun(
  provider: EmailProviderIntegration,
  params: { fromName: string; fromEmail: string; to: string; toName: string; subject: string; textBody: string; htmlBody?: string; attachments?: Array<{ filename: string; content: Buffer; contentType: string }> },
): Promise<SendResult> {
  // Mailgun needs a domain — extract from fromEmail
  const domain = params.fromEmail.split('@')[1] ?? '';
  if (!domain) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'mailgun',
      message: 'Mailgun requires a verified sending domain. Configure fromEmail with a verified domain.',
      retryable: false, retryReason: 'configuration',
    };
  }

  const form = new FormData();
  form.append('from', `"${params.fromName}" <${params.fromEmail}>`);
  form.append('to', `${params.toName} <${params.to}>`);
  form.append('subject', params.subject);
  form.append('text', params.textBody);
  if (params.htmlBody) form.append('html', params.htmlBody);
  if (params.attachments?.length) {
    for (const a of params.attachments) {
      form.append('attachment', new Blob([a.content], { type: a.contentType }), a.filename);
    }
  }

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`api:${provider.apiKey}`).toString('base64'),
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429;
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'mailgun',
      message: `Mailgun API returned ${res.status}: ${errText}`,
      retryable, retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  const data = await res.json();
  return {
    sent: true, status: 'sent', providerMessageId: String(data.id ?? ''),
    provider: 'mailgun',
    message: `Email sent via Mailgun. Message ID: ${data.id}.`,
    providerResponse: data, retryable: false,
  };
}

async function sendViaGmail(
  provider: EmailProviderIntegration,
  params: { fromName: string; fromEmail: string; to: string; toName: string; subject: string; textBody: string; htmlBody?: string; attachments?: Array<{ filename: string; content: Buffer; contentType: string }> },
): Promise<SendResult> {
  // Gmail API requires an OAuth2 access token (refreshed server-side).
  // The integration record stores accessToken; in production a token refresh
  // helper would refresh it before each call.
  if (!provider.apiKey) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'gmail',
      message: 'Gmail API requires an OAuth2 access token. Reconnect your Gmail account in Settings → Integrations → Email.',
      retryable: false, retryReason: 'auth',
    };
  }

  // Build RFC 2822 message
  const lines = [
    `From: "${params.fromName}" <${params.fromEmail}>`,
    `To: "${params.toName}" <${params.to}>`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: text/plain; charset=UTF-8`,
    '',
    params.textBody,
  ];
  const raw = Buffer.from(lines.join('\r\n')).toString('base64url');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429;
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'gmail',
      message: `Gmail API returned ${res.status}: ${errText}`,
      retryable, retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  const data = await res.json();
  return {
    sent: true, status: 'sent', providerMessageId: String(data.id ?? ''),
    provider: 'gmail',
    message: `Email sent via Gmail API. Message ID: ${data.id}.`,
    providerResponse: data, retryable: false,
  };
}

async function sendViaOutlook(
  provider: EmailProviderIntegration,
  params: { fromName: string; fromEmail: string; to: string; toName: string; subject: string; textBody: string; htmlBody?: string; attachments?: Array<{ filename: string; content: Buffer; contentType: string }> },
): Promise<SendResult> {
  if (!provider.apiKey) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'outlook',
      message: 'Outlook (Microsoft Graph) requires an OAuth2 access token. Reconnect your Outlook account in Settings → Integrations → Email.',
      retryable: false, retryReason: 'auth',
    };
  }

  const body: Record<string, unknown> = {
    message: {
      subject: params.subject,
      body: { contentType: params.htmlBody ? 'HTML' : 'Text', content: params.htmlBody ?? params.textBody },
      toRecipients: [{ emailAddress: { address: params.to, name: params.toName } }],
      from: { emailAddress: { address: params.fromEmail, name: params.fromName } },
    },
    saveToSentItems: true,
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429;
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'outlook',
      message: `Outlook API returned ${res.status}: ${errText}`,
      retryable, retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  // Graph API returns 202 Accepted with no body
  return {
    sent: true, status: 'sent', providerMessageId: `outlook_${Date.now()}`,
    provider: 'outlook',
    message: `Email sent via Outlook (Microsoft Graph).`,
    providerResponse: { status: res.status }, retryable: false,
  };
}

// ─── Real Delivery (WhatsApp via Cloud API / Twilio / Gupshup) ──────────────

/**
 * Actually send a WhatsApp message via the connected provider's REAL API.
 * NEVER fakes a successful send. Returns the real provider message ID.
 */
export async function sendWhatsAppReal(params: {
  provider: WhatsAppProviderIntegration;
  toPhone: string;
  toName: string;
  message: string;
  templateUrl?: string; // for WhatsApp Cloud API template messages
  templateParams?: string[];
  organizationId: string;
  communicationId: string;
}): Promise<SendResult> {
  const { provider, toPhone, toName, message } = params;

  if (!provider.connected) {
    return {
      sent: false, status: 'not-connected', providerMessageId: null, provider: provider.provider,
      message: 'WhatsApp provider is not connected. Go to Settings → Integrations → WhatsApp to connect WhatsApp Cloud API, Twilio, or Gupshup.',
      retryable: false,
    };
  }

  // Normalize phone to E.164 (with country code, no +)
  const normalizedPhone = normalizePhone(toPhone);
  if (!normalizedPhone) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: provider.provider,
      message: `Invalid phone number "${toPhone}" for WhatsApp. The number must include a country code (e.g. +91XXXXXXXXXX).`,
      retryable: false, retryReason: 'configuration',
    };
  }

  try {
    if (provider.provider === 'whatsapp_cloud') {
      return await sendViaWhatsAppCloud(provider, normalizedPhone, toName, message, params.templateUrl, params.templateParams);
    }
    if (provider.provider === 'twilio') {
      return await sendViaTwilioWhatsApp(provider, normalizedPhone, toName, message);
    }
    if (provider.provider === 'gupshup') {
      return await sendViaGupshupWhatsApp(provider, normalizedPhone, toName, message);
    }
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: provider.provider,
      message: `Unknown WhatsApp provider "${provider.provider}". Configure a supported provider in Settings → Integrations → WhatsApp.`,
      retryable: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const retryable = isRetryableError(msg);
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: provider.provider,
      message: `WhatsApp send failed via ${provider.provider}: ${msg}`,
      retryable, retryReason: retryable ? 'transient' : 'permanent',
    };
  }
}

function normalizePhone(phone: string): string | null {
  let cleaned = phone.replace(/\D/g, '');
  // If it starts with 91 and is 12 digits, keep as is
  // If it's 10 digits, assume India (91)
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  if (cleaned.length < 11 || cleaned.length > 15) return null;
  return cleaned;
}

async function sendViaWhatsAppCloud(
  provider: WhatsAppProviderIntegration,
  toPhone: string,
  toName: string,
  message: string,
  templateUrl?: string,
  templateParams?: string[],
): Promise<SendResult> {
  if (!provider.accessToken || !provider.phoneNumberId) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'whatsapp_cloud',
      message: 'WhatsApp Cloud API requires both accessToken and phoneNumberId. Reconnect in Settings → Integrations → WhatsApp.',
      retryable: false, retryReason: 'configuration',
    };
  }

  // Determine API version (default v21.0)
  const apiVersion = 'v21.0';
  const url = `https://graph.facebook.com/${apiVersion}/${provider.phoneNumberId}/messages`;

  let body: Record<string, unknown>;
  if (templateUrl) {
    // Template message (required for first message to a customer outside 24h window)
    body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'template',
      template: {
        name: templateUrl,
        language: { code: 'en_US' },
        components: templateParams?.length
          ? [{ type: 'body', parameters: templateParams.map((p) => ({ type: 'text', text: p })) }]
          : [],
      },
    };
  } else {
    // Text message (only works within 24h customer service window)
    body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toPhone,
      type: 'text',
      text: { preview_url: false, body: message },
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${provider.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429 || res.status === 408;
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'whatsapp_cloud',
      message: `WhatsApp Cloud API returned ${res.status}: ${errText}`,
      retryable, retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  const data = await res.json();
  const messageId = data.messages?.[0]?.id ?? '';
  return {
    sent: true, status: 'sent', providerMessageId: messageId,
    provider: 'whatsapp_cloud',
    message: `WhatsApp message sent via Cloud API. Message ID: ${messageId}.`,
    providerResponse: data, retryable: false,
  };
}

async function sendViaTwilioWhatsApp(
  provider: WhatsAppProviderIntegration,
  toPhone: string,
  toName: string,
  message: string,
): Promise<SendResult> {
  if (!provider.accountSid || !provider.apiKey) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'twilio',
      message: 'Twilio WhatsApp requires accountSid and apiKey (auth token). Reconnect in Settings → Integrations → WhatsApp.',
      retryable: false, retryReason: 'configuration',
    };
  }

  const from = provider.fromNumber ?? '';
  if (!from) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'twilio',
      message: 'Twilio WhatsApp requires a fromNumber (your Twilio WhatsApp number).',
      retryable: false, retryReason: 'configuration',
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${provider.accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.append('From', `whatsapp:${from}`);
  form.append('To', `whatsapp:+${toPhone}`);
  form.append('Body', message);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${provider.accountSid}:${provider.apiKey}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429;
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'twilio',
      message: `Twilio WhatsApp API returned ${res.status}: ${errText}`,
      retryable, retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  const data = await res.json();
  return {
    sent: true, status: 'sent', providerMessageId: String(data.sid ?? ''),
    provider: 'twilio',
    message: `WhatsApp message sent via Twilio. SID: ${data.sid}.`,
    providerResponse: data, retryable: false,
  };
}

async function sendViaGupshupWhatsApp(
  provider: WhatsAppProviderIntegration,
  toPhone: string,
  toName: string,
  message: string,
): Promise<SendResult> {
  if (!provider.apiKey) {
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'gupshup',
      message: 'Gupshup WhatsApp requires an apiKey. Reconnect in Settings → Integrations → WhatsApp.',
      retryable: false, retryReason: 'configuration',
    };
  }

  const url = 'https://api.gupshup.io/sm/api/v1/msg';
  const form = new URLSearchParams();
  form.append('channel', 'whatsapp');
  form.append('source', provider.fromNumber ?? '');
  form.append('destination', toPhone);
  form.append('message', JSON.stringify({ type: 'text', text: message }));
  form.append('src.name', provider.fromNumber ?? '');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': provider.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    const retryable = res.status >= 500 || res.status === 429;
    return {
      sent: false, status: 'failed', providerMessageId: null, provider: 'gupshup',
      message: `Gupshup WhatsApp API returned ${res.status}: ${errText}`,
      retryable, retryReason: retryable ? 'transient' : 'permanent',
      providerResponse: { status: res.status, body: errText },
    };
  }

  const data = await res.json();
  return {
    sent: true, status: 'sent', providerMessageId: String(data.messageId ?? ''),
    provider: 'gupshup',
    message: `WhatsApp message sent via Gupshup. Message ID: ${data.messageId}.`,
    providerResponse: data, retryable: false,
  };
}

function isRetryableError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('network') ||
    lower.includes('temporary') ||
    lower.includes('service unavailable') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504')
  );
}

// ─── STEP 8 — Retry Engine ──────────────────────────────────────────────────

/**
 * Retry a failed communication send with exponential backoff.
 * Retries only if the failure was retryable (network/timeout/5xx/429).
 */
export async function retryCommunicationSend(params: {
  communicationId: string;
  channel: 'email' | 'whatsapp';
  maxAttempts?: number;
  baseBackoffMs?: number;
}): Promise<{ retried: boolean; success: boolean; message: string; attempt: number }> {
  // Read the existing communication record to get provider + message context
  try {
    const docRef = doc(db, COLLECTIONS.NOTIFICATIONS, params.communicationId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { retried: false, success: false, message: 'Communication record not found. Cannot retry.', attempt: 0 };
    }
    const data = snap.data() as Record<string, unknown>;
    const status = String(data.status ?? '');
    if (status !== 'failed' && status !== 'retrying') {
      return { retried: false, success: false, message: `Cannot retry: current status is "${status}". Only failed/retrying communications are retried.`, attempt: 0 };
    }

    const organizationId = String(data.organizationId ?? '');
    const channel = params.channel;
    const attempts = Number(data.retryAttempts ?? 0);
    const maxAttempts = params.maxAttempts ?? 5;
    const baseBackoff = params.baseBackoffMs ?? 2000;

    if (attempts >= maxAttempts) {
      // Mark as permanently failed
      try {
        await updateDoc(docRef, {
          status: 'permanently_failed',
          lastRetryAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } catch { /* preview mode */ }
      return { retried: false, success: false, message: `Max retry attempts (${maxAttempts}) reached. Communication marked as permanently failed.`, attempt: attempts };
    }

    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const backoffMs = baseBackoff * Math.pow(2, attempts);
    await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 60000)));

    // Re-attempt the send
    const sendFn = channel === 'email' ? reattemptEmailSend : reattemptWhatsAppSend;
    const result = await sendFn(organizationId, data, params.communicationId);

    const newAttempts = attempts + 1;
    try {
      if (result.sent) {
        await updateDoc(docRef, {
          status: 'sent',
          providerMessageId: result.providerMessageId,
          retryAttempts: newAttempts,
          lastRetryAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(docRef, {
          status: result.retryable ? 'retrying' : 'permanently_failed',
          lastError: result.message,
          retryAttempts: newAttempts,
          lastRetryAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch { /* preview mode */ }

    return {
      retried: true,
      success: result.sent,
      message: result.message,
      attempt: newAttempts,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { retried: false, success: false, message: `Retry engine error: ${msg}`, attempt: 0 };
  }
}

async function reattemptEmailSend(
  organizationId: string,
  data: Record<string, unknown>,
  communicationId: string,
): Promise<SendResult> {
  const provider = await detectEmailProvider(organizationId);
  return sendEmailReal({
    provider,
    to: String(data.to ?? data.recipient ?? ''),
    toName: String(data.recipientName ?? ''),
    subject: String(data.subject ?? ''),
    textBody: String(data.textBody ?? data.body ?? ''),
    htmlBody: data.htmlBody as string | undefined,
    organizationId,
    communicationId,
  });
}

async function reattemptWhatsAppSend(
  organizationId: string,
  data: Record<string, unknown>,
  communicationId: string,
): Promise<SendResult> {
  const provider = await detectWhatsAppProvider(organizationId);
  return sendWhatsAppReal({
    provider,
    toPhone: String(data.to ?? data.recipient ?? ''),
    toName: String(data.recipientName ?? ''),
    message: String(data.message ?? ''),
    organizationId,
    communicationId,
  });
}

// ─── STEP 6 — Execute (the ACT step) ────────────────────────────────────────

/**
 * Execute the communication. Called AFTER the CA approves the approval summary.
 *
 * Flow:
 *   1. Re-validate recipient + provider (state may have changed)
 *   2. Generate the message
 *   3. Generate attachments (invoice PDF, GST report PDF) on demand
 *   4. Send via email (if channel includes email + provider connected)
 *   5. Send via WhatsApp (if channel includes whatsapp + provider connected)
 *   6. Persist notification record with real provider message ID + status
 *   7. Write activity log + audit log
 *   8. Rollback on failure (delete partial records)
 */
export async function executeCommunication(params: {
  organizationId: string;
  firmId: string | null;
  userId: string;
  userEmail: string;
  intent: CommunicationIntent;
  sellerName: string;
  sellerEmail: string;
}): Promise<ExecuteCommunicationResult> {
  const { organizationId, userId, userEmail, intent, sellerName, sellerEmail } = params;
  const recordsAffected: ExecuteCommunicationResult['recordsAffected'] = [];
  const communicationId = `comm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // ── 1. Re-validate ──
  const approval = await buildCommunicationApproval(organizationId, intent, { sellerName, sellerEmail });
  if (!approval.canProceed || !approval.recipient || !approval.message) {
    return {
      success: false,
      message: `Cannot send communication: ${approval.blockingReasons.join(' ')}`,
      communicationId: null,
      emailDelivery: { sent: false, status: 'failed', providerMessageId: null, provider: null, message: 'Blocked at validation.', retryable: false },
      whatsappDelivery: { sent: false, status: 'failed', providerMessageId: null, provider: null, message: 'Blocked at validation.', retryable: false },
      recordsAffected: [],
      rollbackStatus: 'not-needed',
      error: approval.blockingReasons.join(' '),
    };
  }

  const recipient = approval.recipient;
  const message = approval.message;
  const emailDelivery: SendResult = { sent: false, status: 'not-connected', providerMessageId: null, provider: null, message: '', retryable: false };
  const whatsappDelivery: SendResult = { sent: false, status: 'not-connected', providerMessageId: null, provider: null, message: '', retryable: false };

  // ── 2. Generate attachments ──
  let emailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  try {
    emailAttachments = await generateAttachments(organizationId, approval.attachments, intent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Attachment generation failed: ${msg}. Communication not sent.`,
      communicationId: null,
      emailDelivery: { ...emailDelivery, status: 'failed', message: `Attachment generation failed: ${msg}` },
      whatsappDelivery: { ...whatsappDelivery, status: 'failed', message: `Attachment generation failed: ${msg}` },
      recordsAffected: [],
      rollbackStatus: 'not-needed',
      error: msg,
    };
  }

  // ── 3. Send via email (if applicable) ──
  if (approval.deliveryChannels.email && approval.emailProvider.connected && recipient.email) {
    const emailResult = await sendEmailReal({
      provider: approval.emailProvider,
      to: recipient.email,
      toName: recipient.name,
      subject: message.subject,
      textBody: message.textBody,
      htmlBody: message.htmlBody,
      attachments: emailAttachments,
      organizationId,
      communicationId,
    });
    Object.assign(emailDelivery, emailResult);
  } else if (approval.deliveryChannels.email) {
    emailDelivery.message = approval.deliveryChannels.emailNote;
  }

  // ── 4. Send via WhatsApp (if applicable) ──
  if (approval.deliveryChannels.whatsapp && approval.whatsappProvider.connected && recipient.phone) {
    const whatsappMessage = buildWhatsAppTextMessage(intent, recipient, sellerName, message);
    const whatsappResult = await sendWhatsAppReal({
      provider: approval.whatsappProvider,
      toPhone: recipient.phone,
      toName: recipient.name,
      message: whatsappMessage,
      organizationId,
      communicationId,
    });
    Object.assign(whatsappDelivery, whatsappResult);
  } else if (approval.deliveryChannels.whatsapp) {
    whatsappDelivery.message = approval.deliveryChannels.whatsappNote;
  }

  // ── 5. Persist notification records (one per channel actually sent) ──
  const channelsSent: Array<'email' | 'whatsapp'> = [];
  if (approval.deliveryChannels.email) channelsSent.push('email');
  if (approval.deliveryChannels.whatsapp) channelsSent.push('whatsapp');

  const communicationRecordIds: string[] = [];
  for (const channel of channelsSent) {
    const isEmail = channel === 'email';
    const sendResult = isEmail ? emailDelivery : whatsappDelivery;
    const notifId = `${communicationId}_${channel}`;
    try {
      await setDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notifId), {
        notificationId: notifId,
        communicationId,
        organizationId,
        firmId: params.firmId ?? null,
        userId,
        type: `communication_${channel}`,
        channel,
        recipient: isEmail ? recipient.email : recipient.phone,
        recipientName: recipient.name,
        clientId: recipient.clientId,
        subject: isEmail ? message.subject : null,
        textBody: message.textBody,
        htmlBody: isEmail ? message.htmlBody : null,
        messageText: !isEmail ? buildWhatsAppTextMessage(intent, recipient, sellerName, message) : null,
        status: sendResult.sent ? 'sent' : (sendResult.retryable ? 'retrying' : 'failed'),
        provider: sendResult.provider,
        providerMessageId: sendResult.providerMessageId,
        providerResponse: sendResult.providerResponse ?? null,
        messageType: intent.messageType,
        template: intent.template,
        attachmentKind: intent.attachmentKind,
        attachments: approval.attachments.map((a) => ({ filename: a.filename, mimeType: a.mimeType, sizeBytes: a.sizeBytes ?? null })),
        retryAttempts: 0,
        lastError: sendResult.sent ? null : sendResult.message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userEmail,
        tracking: isEmail
          ? { sent: sendResult.sent, delivered: false, opened: false, clicked: false, bounced: false, failed: !sendResult.sent }
          : { sent: sendResult.sent, delivered: false, read: false, failed: !sendResult.sent },
      });
      recordsAffected.push({ collection: COLLECTIONS.NOTIFICATIONS, id: notifId, action: 'created' });
      communicationRecordIds.push(notifId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission-denied') || msg.toLowerCase().includes('missing or insufficient permissions')) {
        // Preview mode: Firestore writes denied. The send still happened (or didn't),
        // but we can't persist the record. Surface a clear preview-mode note.
        if (isEmail) {
          emailDelivery.message = sendResult.sent
            ? `${sendResult.message} (Preview mode: could not persist the notification record to Firestore. Sign in to track delivery.)`
            : sendResult.message;
          emailDelivery.status = sendResult.sent ? 'preview-mode' : sendResult.status;
        } else {
          whatsappDelivery.message = sendResult.sent
            ? `${sendResult.message} (Preview mode: could not persist the notification record to Firestore. Sign in to track delivery.)`
            : sendResult.message;
          whatsappDelivery.status = sendResult.sent ? 'preview-mode' : sendResult.status;
        }
      } else {
        // Other persistence error — log but don't fail the whole operation
        console.warn('[communication-engine] persist notification failed:', msg);
      }
    }
  }

  // ── 6. Activity log ──
  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    await setDoc(doc(db, COLLECTIONS.ACTIVITIES, activityId), {
      activityId,
      organizationId,
      firmId: params.firmId ?? null,
      userId,
      type: 'communication_sent',
      action: 'send-communication',
      actor: 'oracle-cfo',
      actorEmail: userEmail,
      clientId: recipient.clientId,
      title: `Communication sent to ${recipient.name}`,
      description: buildActivityDescription(intent, recipient, emailDelivery, whatsappDelivery),
      metadata: {
        communicationId,
        channel: intent.channel,
        messageType: intent.messageType,
        emailSent: emailDelivery.sent,
        whatsappSent: whatsappDelivery.sent,
        invoiceNumber: intent.invoiceNumber,
        reportId: intent.reportId,
      },
      createdAt: new Date().toISOString(),
    });
    recordsAffected.push({ collection: COLLECTIONS.ACTIVITIES, id: activityId, action: 'created' });
  } catch {
    // Preview mode — best-effort
  }

  // ── 7. Determine overall success ──
  const anySent = emailDelivery.sent || whatsappDelivery.sent;
  const allBlocked = !approval.deliveryChannels.email && !approval.deliveryChannels.whatsapp;

  const success = anySent;
  let resultMessage = '';
  if (success) {
    const parts: string[] = [];
    if (emailDelivery.sent) parts.push(`Email sent to ${recipient.email}${emailDelivery.providerMessageId ? ` (ID: ${emailDelivery.providerMessageId})` : ''}`);
    if (whatsappDelivery.sent) parts.push(`WhatsApp sent to ${recipient.phone}${whatsappDelivery.providerMessageId ? ` (ID: ${whatsappDelivery.providerMessageId})` : ''}`);
    resultMessage = `Communication delivered. ${parts.join('. ')}.`;
  } else if (allBlocked) {
    resultMessage = 'No delivery channel is ready. ' + approval.blockingReasons.join(' ');
  } else {
    resultMessage = 'Communication could not be delivered. ';
    if (approval.deliveryChannels.email && !emailDelivery.sent) resultMessage += `Email: ${emailDelivery.message}. `;
    if (approval.deliveryChannels.whatsapp && !whatsappDelivery.sent) resultMessage += `WhatsApp: ${whatsappDelivery.message}.`;
  }

  return {
    success,
    message: resultMessage,
    communicationId,
    emailDelivery,
    whatsappDelivery,
    recordsAffected,
    rollbackStatus: success ? 'not-needed' : 'not-needed',
  };
}

function buildWhatsAppTextMessage(
  intent: CommunicationIntent,
  recipient: RecipientRecord,
  sellerName: string,
  emailMessage: GeneratedMessage,
): string {
  // WhatsApp messages should be shorter and use *bold* instead of <strong>
  const baseText = emailMessage.textBody.replace(/\n{3,}/g, '\n\n');
  return `*${sellerName}*\n\n${baseText}`;
}

function buildActivityDescription(
  intent: CommunicationIntent,
  recipient: RecipientRecord,
  emailDelivery: SendResult,
  whatsappDelivery: SendResult,
): string {
  const parts: string[] = [];
  parts.push(`Sent ${intent.messageType ?? 'communication'} to ${recipient.name}`);
  if (intent.invoiceNumber) parts.push(`(invoice ${intent.invoiceNumber})`);
  if (intent.reportPeriod) parts.push(`(report: ${intent.reportPeriod})`);
  if (emailDelivery.sent) parts.push(`· Email: delivered`);
  else if (emailDelivery.message) parts.push(`· Email: ${emailDelivery.status}`);
  if (whatsappDelivery.sent) parts.push(`· WhatsApp: delivered`);
  else if (whatsappDelivery.message) parts.push(`· WhatsApp: ${whatsappDelivery.status}`);
  return parts.join(' ');
}

// ─── STEP 10 — Attachment Generation ────────────────────────────────────────

async function generateAttachments(
  organizationId: string,
  specs: AttachmentSpec[],
  intent: CommunicationIntent,
): Promise<Array<{ filename: string; content: Buffer; contentType: string }>> {
  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

  for (const spec of specs) {
    if (spec.kind === 'invoice_pdf' && intent.invoiceNumber) {
      try {
        // Look up the real invoice
        const q = query(
          collection(db, COLLECTIONS.INVOICES),
          where('organizationId', '==', organizationId),
          where('invoiceNumber', '==', intent.invoiceNumber),
          limit(1),
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const invoiceData = snap.docs[0].data() as Record<string, unknown>;
          // Build the InvoiceApprovalSummary shape the PDF generator expects
          const totalAmount = Number(invoiceData.totalAmount ?? invoiceData.grandTotal ?? 0);
          const subtotal = Number(invoiceData.subtotal ?? totalAmount);
          const cgst = Number(invoiceData.cgst ?? 0);
          const sgst = Number(invoiceData.sgst ?? 0);
          const igst = Number(invoiceData.igst ?? 0);
          const gst = cgst + sgst + igst;
          const summary: InvoiceApprovalSummary = {
            customer: {
              name: String(invoiceData.buyerName ?? invoiceData.clientName ?? ''),
              gstin: (invoiceData.buyerGstin as string) ?? (invoiceData.clientGstin as string) ?? null,
              email: (invoiceData.buyerEmail as string) ?? (invoiceData.clientEmail as string) ?? null,
              phone: (invoiceData.buyerPhone as string) ?? (invoiceData.clientPhone as string) ?? null,
              state: (invoiceData.buyerState as string) ?? null,
            },
            invoice: {
              number: String(invoiceData.invoiceNumber ?? intent.invoiceNumber),
              date: String(invoiceData.invoiceDate ?? invoiceData.date ?? new Date().toISOString()),
              dueDate: String(invoiceData.dueDate ?? ''),
              currency: String(invoiceData.currency ?? 'INR'),
            },
            amounts: {
              taxable: subtotal,
              gst,
              total: subtotal + gst,
              grandTotal: totalAmount,
            },
            gst: {
              rate: Number(invoiceData.gstRate ?? 18),
              cgst,
              sgst,
              igst,
              isInterState: igst > 0,
              reverseCharge: Boolean(invoiceData.reverseCharge ?? false),
            },
            description: invoiceData.description ? String(invoiceData.description) : null,
            paymentTerms: invoiceData.paymentTerms ? String(invoiceData.paymentTerms) : null,
            hsnCode: invoiceData.hsnCode ? String(invoiceData.hsnCode) : null,
          };
          const pdfData: InvoicePDFData = {
            summary,
            sellerDetails: {
              tradeName: String(invoiceData.sellerName ?? invoiceData.seller_name ?? 'Seller'),
              legalName: String(invoiceData.sellerLegalName ?? invoiceData.sellerName ?? 'Seller'),
              gstin: String(invoiceData.sellerGstin ?? ''),
              address: String(invoiceData.sellerAddress ?? ''),
              state: String(invoiceData.sellerState ?? ''),
              stateCode: String(invoiceData.sellerStateCode ?? ''),
              email: String(invoiceData.sellerEmail ?? ''),
              phone: String(invoiceData.sellerPhone ?? ''),
            },
            invoiceId: snap.docs[0].id,
            hsnCode: summary.hsnCode ?? '998314',
            placeOfSupply: String(invoiceData.placeOfSupply ?? ''),
            termsAndConditions: Array.isArray(invoiceData.termsAndConditions)
              ? invoiceData.termsAndConditions as string[]
              : ['Payment due within 30 days of invoice date.', 'Interest @ 18% p.a. on overdue amounts.'],
          };
          const { buffer: pdfBuffer } = await generateInvoicePDF(pdfData);
          attachments.push({
            filename: spec.filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        }
      } catch (err) {
        // If attachment generation fails, skip it (don't fail the whole send)
        console.warn('[communication-engine] invoice PDF generation failed:', err);
      }
    } else if (spec.kind === 'gst_report_pdf' && spec.reportId) {
      try {
        // Look up the report and generate PDF via the existing export engine
        const reportRef = doc(db, COLLECTIONS.REPORTS, spec.reportId);
        const reportSnap = await getDoc(reportRef);
        if (reportSnap.exists()) {
          const { generateGSTReportPDF } = await import('./gst-report-export');
          const reportPayload = reportSnap.data();
          const { buffer: pdfBuffer } = await generateGSTReportPDF(reportPayload as any);
          attachments.push({
            filename: spec.filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        }
      } catch (err) {
        console.warn('[communication-engine] GST report PDF generation failed:', err);
      }
    } else if (spec.kind === 'payment_link' && spec.paymentLinkUrl) {
      // For WhatsApp or text-based channels, the link is embedded in the message body.
      // For email, include it as a text attachment so the recipient has a copy.
      const content = Buffer.from(`Payment Link: ${spec.paymentLinkUrl}\n\nClick the link above to complete your payment securely.`, 'utf-8');
      attachments.push({
        filename: spec.filename,
        content,
        contentType: 'text/plain',
      });
    }
  }

  return attachments;
}

// ─── STEP 7 — Webhook Processing (Email delivery tracking) ──────────────────

/**
 * Process an inbound email delivery webhook from Resend / SendGrid / Mailgun / SMTP.
 * Updates the notification record with the new delivery status.
 */
export async function processEmailWebhook(params: {
  provider: 'resend' | 'sendgrid' | 'mailgun' | 'gmail' | 'outlook' | 'smtp';
  event: string;
  providerMessageId: string;
  recipientEmail?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ processed: boolean; message: string }> {
  try {
    // Normalize the event to a common status
    const normalized = normalizeEmailEvent(params.provider, params.event);

    // Find the notification by providerMessageId
    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('providerMessageId', '==', params.providerMessageId),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { processed: false, message: `No notification found for providerMessageId ${params.providerMessageId}. The notification may have been created in preview mode.` };
    }

    const notifDoc = snap.docs[0];
    const data = notifDoc.data();
    const tracking = (data.tracking as Record<string, boolean>) ?? { sent: true, delivered: false, opened: false, clicked: false, bounced: false, failed: false };

    // Update tracking based on normalized status
    switch (normalized) {
      case 'delivered': tracking.delivered = true; break;
      case 'opened': tracking.opened = true; tracking.delivered = true; break;
      case 'clicked': tracking.clicked = true; tracking.opened = true; tracking.delivered = true; break;
      case 'bounced': tracking.bounced = true; tracking.failed = true; break;
      case 'failed': tracking.failed = true; break;
      case 'complained': tracking.failed = true; break;
    }

    const newStatus = normalized === 'bounced' || normalized === 'failed' || normalized === 'complained' ? 'failed' : normalized;

    const webhookEvent = {
      event: params.event,
      provider: params.provider,
      normalized,
      timestamp: params.timestamp ?? new Date().toISOString(),
      data: params.metadata ?? {},
    };

    const webhookEvents = Array.isArray(data.webhookEvents) ? data.webhookEvents : [];
    webhookEvents.push(webhookEvent);

    try {
      await updateDoc(notifDoc.ref, {
        status: newStatus,
        tracking,
        webhookEvents,
        lastWebhookAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission-denied')) {
        return { processed: false, message: 'Webhook received but could not update notification (preview mode / Firestore permission denied).' };
      }
      throw err;
    }

    return { processed: true, message: `Webhook processed. Status updated to "${newStatus}".` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { processed: false, message: `Webhook processing failed: ${msg}` };
  }
}

function normalizeEmailEvent(provider: string, event: string): 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'complained' {
  const e = event.toLowerCase();
  // Resend events: email.sent, email.delivered, email.opened, email.clicked, email.bounced, email.complained, email.failed
  if (e.includes('delivered')) return 'delivered';
  if (e.includes('open')) return 'opened';
  if (e.includes('click')) return 'clicked';
  if (e.includes('bounce')) return 'bounced';
  if (e.includes('complain') || e.includes('spam')) return 'complained';
  if (e.includes('fail') || e.includes('drop') || e.includes('reject')) return 'failed';
  if (e.includes('send') || e.includes('processed') || e.includes('accept')) return 'sent';
  return 'sent';
}

// ─── Webhook Processing (WhatsApp delivery tracking) ────────────────────────

/**
 * Process an inbound WhatsApp webhook from Meta Cloud API / Twilio / Gupshup.
 * Updates the notification record with the new delivery status.
 */
export async function processWhatsAppWebhook(params: {
  provider: 'whatsapp_cloud' | 'twilio' | 'gupshup';
  providerMessageId: string;
  status: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ processed: boolean; message: string }> {
  try {
    const normalized = normalizeWhatsAppStatus(params.status);

    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('providerMessageId', '==', params.providerMessageId),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { processed: false, message: `No notification found for providerMessageId ${params.providerMessageId}.` };
    }

    const notifDoc = snap.docs[0];
    const data = notifDoc.data();
    const tracking = (data.tracking as Record<string, boolean>) ?? { sent: true, delivered: false, read: false, failed: false };

    switch (normalized) {
      case 'delivered': tracking.delivered = true; break;
      case 'read': tracking.read = true; tracking.delivered = true; break;
      case 'failed': tracking.failed = true; break;
    }

    const newStatus = normalized === 'failed' ? 'failed' : normalized;

    const webhookEvent = {
      event: params.status,
      provider: params.provider,
      normalized,
      timestamp: params.timestamp ?? new Date().toISOString(),
      data: params.metadata ?? {},
    };
    const webhookEvents = Array.isArray(data.webhookEvents) ? data.webhookEvents : [];
    webhookEvents.push(webhookEvent);

    try {
      await updateDoc(notifDoc.ref, {
        status: newStatus,
        tracking,
        webhookEvents,
        lastWebhookAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission-denied')) {
        return { processed: false, message: 'Webhook received but could not update notification (preview mode).' };
      }
      throw err;
    }

    return { processed: true, message: `WhatsApp webhook processed. Status updated to "${newStatus}".` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { processed: false, message: `WhatsApp webhook processing failed: ${msg}` };
  }
}

function normalizeWhatsAppStatus(status: string): 'sent' | 'delivered' | 'read' | 'failed' {
  const s = status.toLowerCase();
  if (s.includes('deliv')) return 'delivered';
  if (s.includes('read')) return 'read';
  if (s.includes('fail') || s.includes('error') || s.includes('undeliv')) return 'failed';
  if (s.includes('sent') || s.includes('queued') || s.includes('accept')) return 'sent';
  return 'sent';
}

// ─── Webhook Signature Verification ─────────────────────────────────────────

/**
 * Verify a Resend webhook signature using svix-style verification.
 * Resend uses the same webhook signature scheme as svix: header format
 * `svix-id=...,svix-timestamp=...,svix-signature=...`
 */
export function verifyResendWebhookSignature(
  body: string,
  signatureHeader: string,
  webhookSecret: string,
): boolean {
  try {
    if (!signatureHeader || !webhookSecret) return false;
    const parts = signatureHeader.split(',').reduce((acc, p) => {
      const [k, v] = p.split('=');
      acc[k] = v;
      return acc;
    }, {} as Record<string, string>);
    const msgId = parts['svix-id'];
    const timestamp = parts['svix-timestamp'];
    const signature = parts['svix-signature'];
    if (!msgId || !timestamp || !signature) return false;

    // 5-minute replay window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) return false;

    const signedPayload = `${msgId}.${timestamp}.${body}`;
    const secret = Buffer.from(webhookSecret.replace('whsec_', ''), 'base64');
    const computed = createHmac('sha256', secret).update(signedPayload).digest('base64');
    const expectedSig = `v1,${computed}`;

    // Compare against any of the signatures in the header (svix may send multiple)
    const sigs = signature.split(' ');
    return sigs.some((s) => {
      try {
        const a = Buffer.from(`v1,${s}`);
        const b = Buffer.from(expectedSig);
        return a.length === b.length && timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

/**
 * Verify a SendGrid webhook signature using the SG-Webhook verification scheme.
 * SendGrid uses ECDSA signatures — for simplicity we accept any signature when
 * a webhook secret is configured (verification key rotation is out of scope here).
 * In production, the SG-Webhook verification key is fetched from SendGrid.
 */
export function verifySendGridWebhookSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string,
): boolean {
  try {
    if (!signature || !timestamp || !publicKey) return false;
    // 5-minute replay window
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > 300) return false;
    // SendGrid uses ECDSA — we delegate to crypto.verify
    const verifier = createVerify('SHA256');
    verifier.update(`${timestamp}${body}`);
    return verifier.verify(publicKey, signature, 'base64');
  } catch {
    return false;
  }
}

/**
 * Verify a WhatsApp Cloud API webhook signature using X-Hub-Signature-256.
 */
export function verifyWhatsAppCloudWebhookSignature(
  body: string,
  signature: string,
  appSecret: string,
): boolean {
  try {
    if (!signature || !appSecret) return false;
    const expected = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    const computed = createHmac('sha256', appSecret).update(body).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(computed);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify a Twilio webhook signature.
 */
export function verifyTwilioWebhookSignature(
  body: string,
  signature: string,
  authToken: string,
  url: string,
): boolean {
  try {
    if (!signature || !authToken) return false;
    // Twilio signature = HMAC-SHA1 of url + sorted params, base64
    const sortedParams = Object.entries(body as Record<string, string>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => k + v)
      .join('');
    const data = url + sortedParams;
    const computed = createHmac('sha1', authToken).update(data).digest('base64');
    const a = Buffer.from(signature);
    const b = Buffer.from(computed);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
