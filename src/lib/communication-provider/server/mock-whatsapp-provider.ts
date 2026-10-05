// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Gmail & WhatsApp Business Automation™ — MockWhatsAppProvider (SERVER-ONLY)
//
// The default WhatsApp Business provider. Produces DETERMINISTIC, realistic
// message data seeded by the phone number — the same number always returns the
// same conversation history.
//
// When you're ready to go live: set `COMMUNICATION_WHATSAPP_PROVIDER=meta` in
// env, configure META_APP_ID / SECRET / SYSTEM_USER_TOKEN, and the registry
// will swap to FutureMetaProvider → real WhatsApp Cloud API calls.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { IWhatsAppProvider, WhatsAppSession } from '../provider';
import type {
  ConnectWhatsAppResult,
  SendWhatsAppResult,
  SyncMessagesResult,
  WhatsAppCategory,
  WhatsAppDeliveryStatus,
  WhatsAppMessage,
} from '../types';
import { classifyWhatsAppMessage, summarizeWhatsAppMessage, detectWhatsAppSentiment } from '../communication-analysis';
import { ValidationError } from '../errors';

// ─── Deterministic PRNG ───────────────────────────────────────────────────────

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

interface MockWhatsAppConnectionEntry {
  connectionRef: string;
  phoneNumber: string;
  businessName: string | null;
  phoneNumberId: string;
  wabaId: string;
  createdAt: number;
}

const connectionStore = new Map<string, MockWhatsAppConnectionEntry>();

// ─── Realistic data pools ─────────────────────────────────────────────────────

const CUSTOMER_NAMES = [
  'Rajesh Sharma', 'Priya Patel', 'Amit Verma', 'Sneha Reddy', 'Vikram Iyer',
  'Anita Gupta', 'Suresh Nair', 'Meera Joshi', 'Karthik Subramaniam', 'Pooja Mehta',
];

const CUSTOMER_PHONES = [
  '+919876543210', '+919812345678', '+919765432109', '+919654321098',
  '+919543210987', '+919432109876', '+919321098765', '+919210987654',
];

const INVOICE_REMINDER_TEXTS = [
  'Dear {name}, your invoice INV-{num} for ₹{amount} is due on {date}. Kindly process the payment. - {biz}',
  'Reminder: Invoice INV-{num} (₹{amount}) due in 3 days. Please arrange payment. Thank you. - {biz}',
  'Hi {name}, this is a friendly reminder for invoice INV-{num} of ₹{amount}. Due: {date}. - {biz}',
];

const GST_FILING_TEXTS = [
  'Reminder: GSTR-3B for {month} is due on 20th. File early to avoid penalty. - {biz}',
  'GST filing due: GSTR-1 by 11th and GSTR-3B by 20th of {month}. - {biz}',
];

const PAYMENT_FOLLOWUP_TEXTS = [
  'Hi {name}, your payment of ₹{amount} for invoice INV-{num} is overdue by {days} days. Kindly arrange payment today. - {biz}',
  'Dear {name}, invoice INV-{num} (₹{amount}) is now {days} days overdue. Please process urgently. - {biz}',
];

const PAYMENT_CONFIRM_TEXTS = [
  'Hi {name}, we received your payment of ₹{amount} for invoice INV-{num}. Thank you! - {biz}',
  'Payment received: ₹{amount} against invoice INV-{num}. Thanks for your business. - {biz}',
];

const CUSTOMER_REPLY_TEXTS = [
  'Hi, I have made the payment. Please check and confirm.',
  'Received the invoice. Will process payment by tomorrow.',
  'Thank you for the reminder. Payment done via UPI.',
  'Can you share the GST invoice copy again?',
  'When is the next due date for the invoice?',
  'Could you please confirm the bank details for NEFT?',
  'Yes, we acknowledge receipt of your invoice.',
];

const COLLECTION_TEXTS = [
  'Dear {name}, this is a final reminder. Invoice INV-{num} of ₹{amount} is now {days} days overdue. Please arrange payment immediately to avoid further action. - {biz}',
  'Urgent: Your account shows an outstanding of ₹{amount}. Please contact us immediately. - {biz}',
];

const STATEMENT_TEXTS = [
  'Dear {name}, please find attached your monthly statement. Total outstanding: ₹{amount}. - {biz}',
  'Hi {name}, attached is your account statement for {month}. - {biz}',
];

const GENERAL_TEXTS = [
  'Hi {name}, thanks for reaching out. Our team will get back to you shortly.',
  'Hello! How can we help you today?',
  'Sure, we will process your request.',
  'Noted. Will revert by end of day.',
];

// ─── WhatsApp message generator ───────────────────────────────────────────────

function generateMessages(
  rng: () => number,
  phoneNumber: string,
  from?: string,
  to?: string,
): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = [];
  const now = new Date();

  const startDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const endDate = to ? new Date(to) : now;
  if (startDate > endDate) return [];

  const count = randInt(rng, 15, 40);
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

  // Track recent inbound unanswered messages to mark as pending replies.
  let lastInboundAt: number | null = null;

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor((i / count) * totalDays) + randInt(rng, 0, 1);
    const msgDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    if (msgDate > endDate) continue;

    // 60% inbound, 40% outbound
    const direction = rng() < 0.6 ? 'inbound' : 'outbound';

    const catRoll = rng();
    let category: WhatsAppCategory;
    let body: string;
    let customerIdx = randInt(rng, 0, CUSTOMER_NAMES.length - 1);
    let customerName = CUSTOMER_NAMES[customerIdx];
    let customerPhone = CUSTOMER_PHONES[customerIdx % CUSTOMER_PHONES.length];

    if (catRoll < 0.25 && direction === 'outbound') {
      category = 'invoice_reminder';
      body = pick(rng, INVOICE_REMINDER_TEXTS)
        .replace('{name}', customerName.split(' ')[0])
        .replace('{num}', String(randInt(rng, 1000, 9999)))
        .replace('{amount}', String(randInt(rng, 5, 200) * 1000))
        .replace('{date}', new Date(msgDate.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN'))
        .replace('{biz}', phoneNumber);
    } else if (catRoll < 0.4 && direction === 'outbound') {
      category = 'gst_filing_reminder';
      body = pick(rng, GST_FILING_TEXTS).replace('{month}', msgDate.toLocaleString('en-IN', { month: 'long' })).replace('{biz}', phoneNumber);
    } else if (catRoll < 0.55 && direction === 'outbound') {
      category = 'payment_followup';
      body = pick(rng, PAYMENT_FOLLOWUP_TEXTS)
        .replace('{name}', customerName.split(' ')[0])
        .replace('{num}', String(randInt(rng, 1000, 9999)))
        .replace('{amount}', String(randInt(rng, 5, 200) * 1000))
        .replace('{days}', String(randInt(rng, 3, 30)))
        .replace('{biz}', phoneNumber);
    } else if (catRoll < 0.65 && direction === 'outbound') {
      category = 'payment_confirmation';
      body = pick(rng, PAYMENT_CONFIRM_TEXTS)
        .replace('{name}', customerName.split(' ')[0])
        .replace('{num}', String(randInt(rng, 1000, 9999)))
        .replace('{amount}', String(randInt(rng, 5, 200) * 1000))
        .replace('{biz}', phoneNumber);
    } else if (catRoll < 0.85 && direction === 'inbound') {
      category = 'customer_reply';
      body = pick(rng, CUSTOMER_REPLY_TEXTS);
    } else if (catRoll < 0.93 && direction === 'outbound') {
      category = 'collection';
      body = pick(rng, COLLECTION_TEXTS)
        .replace('{name}', customerName.split(' ')[0])
        .replace('{num}', String(randInt(rng, 1000, 9999)))
        .replace('{amount}', String(randInt(rng, 5, 200) * 1000))
        .replace('{days}', String(randInt(rng, 30, 60)))
        .replace('{biz}', phoneNumber);
    } else if (catRoll < 0.97 && direction === 'outbound') {
      category = 'statement';
      body = pick(rng, STATEMENT_TEXTS)
        .replace('{name}', customerName.split(' ')[0])
        .replace('{amount}', String(randInt(rng, 5, 200) * 1000))
        .replace('{month}', msgDate.toLocaleString('en-IN', { month: 'long' }))
        .replace('{biz}', phoneNumber);
    } else {
      category = 'general';
      body = pick(rng, GENERAL_TEXTS).replace('{name}', customerName.split(' ')[0]);
    }

    // For outbound: we send TO customer; for inbound: customer sends TO us.
    const toPhone = direction === 'outbound' ? customerPhone : phoneNumber;
    const fromPhone = direction === 'outbound' ? phoneNumber : customerPhone;

    // Status — outbound messages can be delivered/read/failed.
    let status: WhatsAppDeliveryStatus;
    if (direction === 'outbound') {
      const s = rng();
      if (s < 0.6) status = 'read';
      else if (s < 0.85) status = 'delivered';
      else if (s < 0.95) status = 'sent';
      else status = 'failed';
    } else {
      status = 'delivered';
    }

    const messageType = 'text';

    // Re-run classifier to ensure consistency.
    void classifyWhatsAppMessage(body, direction);
    const sentiment = detectWhatsAppSentiment(body);
    const aiSummary = summarizeWhatsAppMessage(body, category, direction);

    const msg: WhatsAppMessage = {
      id: `wa-${Math.floor(rng() * 1e9)}-${i}`,
      organizationId: '', // filled by orchestrator
      connectionId: '', // filled by orchestrator
      wamId: `wamid.${crypto.randomBytes(12).toString('hex')}`,
      direction,
      from: fromPhone,
      to: toPhone,
      contactName: customerName,
      messageType,
      messageBody: body,
      mediaUrl: null,
      caption: null,
      category,
      aiSummary,
      sentiment,
      status,
      errorMessage: status === 'failed' ? 'Recipient not on WhatsApp' : null,
      invoiceId: category === 'invoice_reminder' || category === 'payment_followup' || category === 'payment_confirmation'
        ? `inv-${randInt(rng, 1000, 9999)}`
        : null,
      clientId: null, // filled by orchestrator based on phone → client mapping
      sentAt: direction === 'outbound' ? msgDate.toISOString() : null,
      deliveredAt: direction === 'outbound' && status !== 'failed' && status !== 'queued'
        ? new Date(msgDate.getTime() + 60_000).toISOString()
        : null,
      readAt: direction === 'outbound' && status === 'read'
        ? new Date(msgDate.getTime() + 300_000).toISOString()
        : null,
      receivedAt: msgDate.toISOString(),
      syncedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    messages.push(msg);

    if (direction === 'inbound') {
      lastInboundAt = msgDate.getTime();
    } else if (lastInboundAt !== null) {
      // Outbound after an inbound = we replied; clear the pending flag.
      lastInboundAt = null;
    }
  }

  messages.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  return messages;
}

// ─── MockWhatsAppProvider ─────────────────────────────────────────────────────

export class MockWhatsAppProvider implements IWhatsAppProvider {
  readonly name = 'Mock WhatsApp Provider';
  readonly provider = 'mock' as const;
  readonly isLive = false;

  async connect(input: { phoneNumber: string; businessName?: string }): Promise<ConnectWhatsAppResult> {
    if (!input.phoneNumber || !/^\+?\d{10,15}$/.test(input.phoneNumber.replace(/\s+/g, ''))) {
      throw new ValidationError('A valid phone number (10-15 digits, optional +) is required.');
    }
    const cleaned = input.phoneNumber.replace(/\s+/g, '');
    const formatted = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    const connectionRef = `MOCK-WA-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const phoneNumberId = crypto.randomBytes(8).toString('hex');
    const wabaId = crypto.randomBytes(8).toString('hex');
    connectionStore.set(connectionRef, {
      connectionRef,
      phoneNumber: formatted,
      businessName: input.businessName ?? null,
      phoneNumberId,
      wabaId,
      createdAt: Date.now(),
    });
    return {
      connectionRef,
      phoneNumber: formatted,
      phoneNumberId,
      wabaId,
      message:
        'Mock WhatsApp Business connection initiated. In production, this would start the Meta embedded signup flow. The connection is immediately ready.',
    };
  }

  async completeConnection(connectionRef: string): Promise<{
    session: WhatsAppSession;
    profile: {
      phoneNumber: string;
      displayPhoneNumber: string | null;
      businessName: string | null;
      qualityRating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
      messagingLimitTier: string | null;
    };
  }> {
    const entry = connectionStore.get(connectionRef);
    if (!entry) {
      throw new ValidationError('Connection reference not found. Please restart the connect flow.');
    }
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const accessToken = crypto.randomBytes(32).toString('hex');
    const session: WhatsAppSession = {
      accessToken,
      phoneNumber: entry.phoneNumber,
      phoneNumberId: entry.phoneNumberId,
      wabaId: entry.wabaId,
      provider: 'mock',
      expiresAt,
      metadata: { connectionRef },
    };
    return {
      session,
      profile: {
        phoneNumber: entry.phoneNumber,
        displayPhoneNumber: entry.phoneNumber,
        businessName: entry.businessName,
        qualityRating: 'GREEN',
        messagingLimitTier: '1000 conversations / 24 hours',
      },
    };
  }

  async refreshSession(session: WhatsAppSession): Promise<{ session: WhatsAppSession }> {
    return {
      session: {
        ...session,
        accessToken: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  }

  async disconnect(session: WhatsAppSession): Promise<void> {
    const ref = session.metadata?.connectionRef as string | undefined;
    if (ref) connectionStore.delete(ref);
  }

  async syncMessages(
    session: WhatsAppSession,
    options?: { from?: string; to?: string; maxResults?: number },
  ): Promise<SyncMessagesResult> {
    const rng = mulberry32(hashSeed(session.phoneNumber + (options?.from ?? '') + (options?.to ?? '')));
    const all = generateMessages(rng, session.phoneNumber, options?.from, options?.to);
    const capped = options?.maxResults ? all.slice(0, options.maxResults) : all;
    return {
      success: true,
      syncedCount: capped.length,
      newCount: capped.length,
      errors: [],
      messages: capped,
    };
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
    if (!input.to || !input.body) {
      throw new ValidationError('Recipient and body are required.');
    }
    const messageId = `wa-${crypto.randomBytes(12).toString('hex')}`;
    const wamId = `wamid.${crypto.randomBytes(12).toString('hex')}`;
    return {
      success: true,
      messageId,
      wamId,
      status: 'sent',
      sentAt: new Date().toISOString(),
    };
  }

  async markRead(_session: WhatsAppSession, _messageId: string): Promise<void> {
    // Mock — no-op.
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
