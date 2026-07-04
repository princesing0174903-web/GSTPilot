// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — Communication Analysis Engine
//
// PURE functions — safe to import from both client and server. Used by:
//   • MockGmailProvider / MockWhatsAppProvider (to stamp categories on generated
//     messages)
//   • The server orchestrator (to classify REAL messages from production
//     providers — Google / Meta — before writing to Firestore)
//   • The AI Communication Engine (to extract summaries written to ai_memory)
//
// The classifier is rule-based (keyword + sender-domain matching) — fast,
// deterministic, no external API call. When the production LLM is plugged in
// (Phase 7's IAIProvider), Oracle can RE-FINE the classification with full
// semantic understanding.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  EmailCategory,
  WhatsAppCategory,
  WhatsAppDirection,
} from './types';

// ─── Email Classifier ─────────────────────────────────────────────────────────

const GST_NOTICE_KEYWORDS = [
  'gst notice', 'show cause', 'scrutiny', 'drc-01', 'drc-07', 'drc-01a',
  'asn', 'assessment', 'intimation u/s', 'section 61', 'section 62',
  'section 73', 'section 74', 'demand of tax', 'gst portal',
  'cbic', 'cpc gst',
];

const VENDOR_INVOICE_KEYWORDS = [
  'vendor invoice', 'invoice from', 'tax invoice', 'please find attached the invoice',
  'kindly process the payment', 'due in 30 days', 'due in 15 days',
  'freight charges', 'monthly billing',
];

const CUSTOMER_INVOICE_KEYWORDS = [
  'sales invoice', 'invoice copy', 'invoice sent', 'gstpilot',
  'we request you to process', 'invoice for the services',
];

const PAYMENT_CONFIRM_KEYWORDS = [
  'payment received', 'payment confirmation', 'we confirm receipt of payment',
  'neft credit', 'rtgs credit', 'upi credit', 'payment of ₹',
  'utr', 'payment done', 'thanks for your payment',
];

const BANK_ALERT_KEYWORDS = [
  'debit of', 'credit of', 'low balance', 'atm withdrawal',
  'account has been debited', 'account has been credited',
  'transaction alert', 'mini statement', 'insufficient balance',
];

const TAX_COMMUNICATION_KEYWORDS = [
  'income tax', 'tds', 'section 143', 'section 133', 'section 142',
  'demand notice', 'refund initiated', 'itr processed',
  'intimation u/s 143(1)', 'cpc tds', 'tin-nsdl',
];

const STATEMENT_KEYWORDS = [
  'monthly statement', 'bank statement', 'account statement',
  'vendor statement', 'transaction history',
];

const GST_NOTICE_DOMAINS = ['gst.gov.in', 'cbic.gov.in'];
const TAX_COMM_DOMAINS = ['incometax.gov.in', 'tdscpc.gov.in', 'tin-nsdl.com'];
const BANK_ALERT_DOMAINS = ['hdfcbank.com', 'icicibank.com', 'sbicard.com', 'axisbank.com', 'kotak.com', 'yesbank.in', 'idfcfirstbank.com'];

function senderDomain(from: string): string {
  const m = from.match(/@([\w.-]+)/);
  return m ? m[1].toLowerCase() : '';
}

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/**
 * Classify an email into one of the EmailCategory buckets based on subject,
 * body, and sender domain. Returns 'general' if no rule matches.
 */
export function classifyEmail(
  subject: string,
  body: string,
  from: string,
): EmailCategory {
  const text = `${subject}\n${body}`;
  const domain = senderDomain(from);

  // Domain-first matching — official GST / IT / bank domains are authoritative.
  if (GST_NOTICE_DOMAINS.some((d) => domain.endsWith(d))) return 'gst_notice';
  if (TAX_COMM_DOMAINS.some((d) => domain.endsWith(d))) {
    return matchesAny(text, STATEMENT_KEYWORDS) ? 'statement' : 'tax_communication';
  }
  if (BANK_ALERT_DOMAINS.some((d) => domain.endsWith(d))) {
    if (matchesAny(text, ['statement', 'monthly statement'])) return 'statement';
    if (matchesAny(text, PAYMENT_CONFIRM_KEYWORDS)) return 'payment_confirmation';
    return 'bank_alert';
  }

  // Keyword matching — order matters (more specific → less specific).
  if (matchesAny(text, GST_NOTICE_KEYWORDS)) return 'gst_notice';
  if (matchesAny(text, TAX_COMMUNICATION_KEYWORDS)) return 'tax_communication';
  if (matchesAny(text, PAYMENT_CONFIRM_KEYWORDS)) return 'payment_confirmation';
  if (matchesAny(text, BANK_ALERT_KEYWORDS)) return 'bank_alert';
  if (matchesAny(text, STATEMENT_KEYWORDS)) return 'statement';
  if (matchesAny(text, VENDOR_INVOICE_KEYWORDS)) return 'vendor_invoice';
  if (matchesAny(text, CUSTOMER_INVOICE_KEYWORDS)) return 'customer_invoice';
  return 'general';
}

// ─── WhatsApp Classifier ──────────────────────────────────────────────────────

const INVOICE_REMINDER_KW = [
  'invoice inv-', 'invoice is due', 'due in 3 days', 'due in 7 days',
  'friendly reminder for invoice', 'invoice for ₹', 'kindly process the payment',
];

const GST_FILING_KW = [
  'gstr-3b', 'gstr-1', 'gstr-2b', 'gst filing due', 'file early to avoid penalty',
  'gst portal', 'filing deadline',
];

const PAYMENT_FOLLOWUP_KW = [
  'overdue by', 'payment of ₹', 'overdue', 'arrange payment',
  'final reminder', 'urgent: your account', 'immediately',
];

const PAYMENT_CONFIRM_KW = [
  'we received your payment', 'payment received', 'payment done',
  'thanks for your business', 'payment confirmed',
];

const COLLECTION_KW = [
  'final reminder', 'collection', 'outstanding', 'further action',
  'legal action', 'will be escalated',
];

const STATEMENT_KW = [
  'monthly statement', 'account statement', 'attached your statement',
];

/**
 * Classify a WhatsApp message. For outbound messages, the category is usually
 * known (we sent it). For inbound, we infer from keywords.
 */
export function classifyWhatsAppMessage(
  body: string,
  direction: WhatsAppDirection,
): WhatsAppCategory {
  if (direction === 'inbound') {
    return 'customer_reply';
  }
  const text = body.toLowerCase();
  if (matchesAny(text, GST_FILING_KW)) return 'gst_filing_reminder';
  if (matchesAny(text, COLLECTION_KW)) return 'collection';
  if (matchesAny(text, PAYMENT_CONFIRM_KW)) return 'payment_confirmation';
  if (matchesAny(text, PAYMENT_FOLLOWUP_KW)) return 'payment_followup';
  if (matchesAny(text, INVOICE_REMINDER_KW)) return 'invoice_reminder';
  if (matchesAny(text, STATEMENT_KW)) return 'statement';
  return 'general';
}

// ─── Sentiment Detection ──────────────────────────────────────────────────────

const URGENT_KEYWORDS = [
  'urgent', 'immediately', 'asap', 'overdue', 'final reminder',
  'legal action', 'show cause', 'demand', 'penalty', 'failed',
  'insufficient', 'rejected', 'disconnected', 'suspend',
];

const NEGATIVE_KEYWORDS = [
  'not received', 'delay', 'problem', 'issue', 'complaint', 'wrong',
  'incorrect', 'disappointed', 'unhappy', 'refund', 'cancel',
];

const POSITIVE_KEYWORDS = [
  'thank you', 'thanks', 'received', 'confirmed', 'appreciate',
  'great', 'excellent', 'happy', 'satisfied', 'good service',
];

export type CommunicationSentiment = 'positive' | 'neutral' | 'negative' | 'urgent' | 'unknown';

export function detectEmailSentiment(subject: string, body: string): CommunicationSentiment {
  const text = `${subject}\n${body}`.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => text.includes(k))) return 'urgent';
  if (NEGATIVE_KEYWORDS.some((k) => text.includes(k))) return 'negative';
  if (POSITIVE_KEYWORDS.some((k) => text.includes(k))) return 'positive';
  return 'neutral';
}

export function detectWhatsAppSentiment(body: string): CommunicationSentiment {
  const text = body.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => text.includes(k))) return 'urgent';
  if (NEGATIVE_KEYWORDS.some((k) => text.includes(k))) return 'negative';
  if (POSITIVE_KEYWORDS.some((k) => text.includes(k))) return 'positive';
  return 'neutral';
}

// ─── Summarization (rule-based, no LLM call) ──────────────────────────────────

/**
 * Generate a concise AI summary for an email — written to `ai_memory` so
 * Oracle can answer questions about communications.
 */
export function summarizeEmail(
  subject: string,
  body: string,
  category: EmailCategory,
): string {
  // Extract first 2 sentences of body for the summary.
  const firstSentences = body
    .split(/\.\s+/)
    .slice(0, 2)
    .join('. ')
    .trim();
  const trimmed = firstSentences.length > 180 ? firstSentences.slice(0, 180) + '…' : firstSentences;

  switch (category) {
    case 'gst_notice':
      return `GST notice received — "${subject}". ${trimmed}`;
    case 'vendor_invoice':
      return `Vendor invoice — "${subject}". ${trimmed}`;
    case 'customer_invoice':
      return `Sales invoice sent — "${subject}". ${trimmed}`;
    case 'payment_confirmation':
      return `Payment confirmation — "${subject}". ${trimmed}`;
    case 'bank_alert':
      return `Bank alert — "${subject}". ${trimmed}`;
    case 'tax_communication':
      return `Tax department communication — "${subject}". ${trimmed}`;
    case 'statement':
      return `Statement received — "${subject}". ${trimmed}`;
    default:
      return `Email — "${subject}". ${trimmed}`;
  }
}

export function summarizeWhatsAppMessage(
  body: string,
  category: WhatsAppCategory,
  direction: WhatsAppDirection,
): string {
  const dir = direction === 'inbound' ? 'Inbound' : 'Outbound';
  const trimmed = body.length > 160 ? body.slice(0, 160) + '…' : body;
  switch (category) {
    case 'invoice_reminder':
      return `${dir} invoice reminder — "${trimmed}"`;
    case 'gst_filing_reminder':
      return `${dir} GST filing reminder — "${trimmed}"`;
    case 'payment_followup':
      return `${dir} payment follow-up — "${trimmed}"`;
    case 'payment_confirmation':
      return `${dir} payment confirmation — "${trimmed}"`;
    case 'customer_reply':
      return `Inbound customer reply — "${trimmed}"`;
    case 'collection':
      return `${dir} collection message — "${trimmed}"`;
    case 'statement':
      return `${dir} statement share — "${trimmed}"`;
    default:
      return `${dir} WhatsApp message — "${trimmed}"`;
  }
}

// ─── Pending Reply Detection ──────────────────────────────────────────────────

/**
 * Determine whether a sequence of messages (sorted newest-first) contains a
 * pending reply — i.e. the most recent message is INBOUND and we have not yet
 * replied.
 *
 * Used by the dashboard to surface "pending WhatsApp replies" and by the AI
 * Communication Engine to prioritize follow-ups.
 */
export function hasPendingReply(messages: { direction: WhatsAppDirection; receivedAt: string }[]): boolean {
  if (messages.length === 0) return false;
  // Sort newest-first (defensive — caller should already do this).
  const sorted = [...messages].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  return sorted[0].direction === 'inbound';
}

// ─── Pending Client Reply Detection (Email) ───────────────────────────────────

/**
 * For emails: a "pending client reply" is an OUTBOUND message we sent where the
 * client hasn't replied yet (i.e. the thread's most recent message is ours and
 * it's been > 24 hours).
 */
export function isPendingClientReply(
  threadMessages: { direction: 'inbound' | 'outbound'; receivedAt: string }[],
  hoursThreshold = 24,
): boolean {
  if (threadMessages.length === 0) return false;
  const sorted = [...threadMessages].sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  if (sorted[0].direction !== 'outbound') return false;
  const sentAt = new Date(sorted[0].receivedAt).getTime();
  const hoursSince = (Date.now() - sentAt) / (1000 * 60 * 60);
  return hoursSince >= hoursThreshold;
}
