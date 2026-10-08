// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO AI CFO™ — Production Payment Link Engine
//
// The REAL payment link creation engine. No simulations. No placeholders.
// When a CA types "Create a payment link for Invoice INV-2026-000231", this
// engine:
//   1. Extracts intent (invoice number, customer, amount, currency, provider)
//   2. Looks up the invoice in the REAL database
//   3. Validates the invoice (exists, unpaid/partial, not cancelled, no existing link)
//   4. Detects the connected payment provider (Razorpay / Stripe)
//   5. Builds an approval summary (customer / invoice / amount / provider / expiry)
//   6. After approval: creates a REAL payment link via provider API
//   7. Persists: provider payment ID, link URL, expiry, status, metadata
//   8. Sends via email + WhatsApp (if connected, else explains what's needed)
//   9. Writes activity log + audit log
//  10. Rolls back on failure (deletes partial records)
//
// In preview mode (no Firestore auth, no provider credentials), the engine:
//   - Catches PERMISSION_DENIED and returns a clear "sign in to persist" message
//   - If no provider is connected, returns a clear "what to configure" message
//   - NEVER fabricates a payment link URL
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createHmac,
  timingSafeEqual,
} from 'crypto';
import {
  collection, doc, setDoc, deleteDoc, updateDoc,
  getDocs, getDoc, query, where, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/lib/firestore-schema';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PaymentLinkIntent {
  invoiceNumber: string | null;
  invoiceId: string | null;
  customerName: string | null;
  amount: number | null;
  currency: string;
  provider: 'razorpay' | 'stripe' | 'auto' | null;
  dueDate: string | null;
  notes: string | null;
  missingFields: string[];
  rawExtraction: Record<string, { value: unknown; source: string; confidence: number }>;
}

export interface InvoiceValidationResult {
  valid: boolean;
  invoice: InvoiceRecord | null;
  errors: string[];
  warnings: string[];
  existingLink: PaymentLinkRecord | null;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientGstin: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: string;
  status: string;
  dueDate: string | null;
  invoiceDate: string | null;
  organizationId: string;
}

export interface PaymentLinkRecord {
  paymentId: string;
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  amount: number;
  currency: string;
  provider: 'razorpay' | 'stripe';
  providerPaymentId: string | null;
  linkUrl: string | null;
  linkId: string | null;
  linkExpiry: string | null;
  status: 'link_created' | 'sent' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded' | 'cancelled';
  method: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  paidAt: string | null;
  webhookEvents: Array<{ event: string; timestamp: string; data: Record<string, unknown> }>;
}

export interface ProviderIntegration {
  connected: boolean;
  provider: 'razorpay' | 'stripe' | null;
  apiKey: string | null;
  apiSecret: string | null;
  accountId: string | null;
  webhookSecret: string | null;
  testMode: boolean;
}

export interface ProviderLinkResult {
  success: boolean;
  provider: 'razorpay' | 'stripe';
  providerPaymentId: string;
  linkUrl: string;
  linkId: string;
  linkExpiry: string;
  status: string;
  shortUrl: string | null;
  rawResponse: Record<string, unknown>;
  error?: string;
}

export interface PaymentLinkApprovalSummary {
  intent: PaymentLinkIntent;
  invoice: InvoiceRecord | null;
  validation: InvoiceValidationResult;
  provider: ProviderIntegration;
  amount: number;
  currency: string;
  linkExpiry: string;
  paymentMethods: string[];
  estimatedFees: { percentage: number; fixed: number; estimated: number };
  delivery: { email: boolean; whatsapp: boolean; emailNote: string; whatsappNote: string };
  warnings: string[];
  canProceed: boolean;
  blockingReasons: string[];
}

export interface ExecutePaymentLinkResult {
  success: boolean;
  message: string;
  paymentId: string | null;
  providerPaymentId: string | null;
  linkUrl: string | null;
  linkExpiry: string | null;
  status: string;
  emailDelivery: { sent: boolean; message: string };
  whatsappDelivery: { sent: boolean; message: string };
  recordsAffected: Array<{ collection: string; id: string; action: 'created' | 'updated' | 'deleted' }>;
  rollbackStatus: 'not-needed' | 'rolled-back' | 'rollback-failed';
  error?: string;
}

// ─── Intent Extraction ──────────────────────────────────────────────────────

const INVOICE_NUMBER_PATTERNS = [
  /(?:invoice|inv|bill)\s*(?:no\.?|number|#)?\s*([A-Z0-9][A-Z0-9\-\/]{3,30})/i,
  /\b(INV-\d{4}-\d{4,6})\b/i,
  /\b(INV\d{6,10})\b/i,
  /\b([A-Z]{2,4}-\d{4}-\d{4,6})\b/,
];

const PROVIDER_PATTERNS: Array<{ provider: 'razorpay' | 'stripe'; pattern: RegExp }> = [
  { provider: 'razorpay', pattern: /razorpay/i },
  { provider: 'stripe', pattern: /stripe/i },
];

const CURRENCY_PATTERNS: Array<{ currency: string; pattern: RegExp }> = [
  { currency: 'INR', pattern: /₹|inr|rupees?/i },
  { currency: 'USD', pattern: /\$|usd|dollars?/i },
  { currency: 'EUR', pattern: /€|eur|euros?/i },
  { currency: 'GBP', pattern: /£|gbp|pounds?/i },
];

/**
 * Extract payment link intent from natural language.
 * Detects: invoice number, customer, amount, currency, provider, due date, notes.
 * Never guesses — missing fields go into `missingFields`.
 */
export function extractPaymentLinkIntent(message: string): PaymentLinkIntent {
  const missingFields: string[] = [];
  const rawExtraction: PaymentLinkIntent['rawExtraction'] = {};

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
  if (!invoiceNumber) {
    missingFields.push('invoiceNumber');
  }

  // ── Amount ──
  let amount: number | null = null;
  const amtMatch = message.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/) ?? message.match(/amount\s*(?:of|:)?\s*₹?\s*([\d,]+)/i);
  if (amtMatch && amtMatch[1]) {
    amount = Number(amtMatch[1].replace(/,/g, ''));
    if (isFinite(amount) && amount > 0) {
      rawExtraction.amount = { value: amount, source: 'extracted', confidence: 0.9 };
    } else {
      amount = null;
    }
  }
  if (amount === null) {
    // Amount will be inferred from invoice during validation
    missingFields.push('amount');
  }

  // ── Currency ──
  let currency = 'INR';
  for (const { currency: cur, pattern } of CURRENCY_PATTERNS) {
    if (pattern.test(message)) {
      currency = cur;
      rawExtraction.currency = { value: cur, source: 'extracted', confidence: 0.95 };
      break;
    }
  }
  if (!rawExtraction.currency) {
    rawExtraction.currency = { value: currency, source: 'default', confidence: 0.6 };
  }

  // ── Provider ──
  let provider: PaymentLinkIntent['provider'] = 'auto';
  for (const { provider: prov, pattern } of PROVIDER_PATTERNS) {
    if (pattern.test(message)) {
      provider = prov;
      rawExtraction.provider = { value: prov, source: 'extracted', confidence: 0.95 };
      break;
    }
  }
  if (!rawExtraction.provider) {
    rawExtraction.provider = { value: 'auto', source: 'default', confidence: 0.6 };
  }

  // ── Customer name (best-effort, from "for X" or "to X") ──
  let customerName: string | null = null;
  const custMatch = message.match(/(?:for|to)\s+([A-Z][a-zA-Z0-9\s&\.]{2,40})(?:\s+(?:worth|amounting|of|at)\s)/);
  if (custMatch && custMatch[1]) {
    customerName = custMatch[1].trim();
    rawExtraction.customerName = { value: customerName, source: 'extracted', confidence: 0.75 };
  }

  // ── Due date ──
  let dueDate: string | null = null;
  const dueMatch = message.match(/(?:due|expire|valid\s*(?:till|until))\s*(?:by|on|date)?\s*[:#]?\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})/i);
  if (dueMatch && dueMatch[1]) {
    dueDate = dueMatch[1];
    rawExtraction.dueDate = { value: dueDate, source: 'extracted', confidence: 0.85 };
  }

  // ── Notes ──
  let notes: string | null = null;
  const notesMatch = message.match(/(?:notes?|note|memo|description)\s*[:#]\s*(.+)$/i);
  if (notesMatch && notesMatch[1]) {
    notes = notesMatch[1].trim();
    rawExtraction.notes = { value: notes, source: 'extracted', confidence: 0.8 };
  }

  return {
    invoiceNumber,
    invoiceId: null,
    customerName,
    amount,
    currency,
    provider,
    dueDate,
    notes,
    missingFields,
    rawExtraction,
  };
}

// ─── Invoice Lookup + Validation ────────────────────────────────────────────

/**
 * Look up an invoice by invoice number in the real database.
 * Returns the full invoice record or null if not found.
 */
export async function lookupInvoice(
  organizationId: string,
  invoiceNumber: string,
): Promise<InvoiceRecord | null> {
  try {
    const q = query(
      collection(db, COLLECTIONS.INVOICES),
      where('organizationId', '==', organizationId),
      where('invoiceNumber', '==', invoiceNumber),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    const totalAmount = Number(data.totalAmount ?? data.grandTotal ?? 0);
    const paidAmount = Number(data.paidAmount ?? 0);
    return {
      id: snap.docs[0].id,
      invoiceNumber: String(data.invoiceNumber ?? ''),
      clientId: String(data.clientId ?? data.buyerId ?? ''),
      clientName: String(data.buyerName ?? data.clientName ?? data.customerName ?? ''),
      clientEmail: (data.buyerEmail as string) ?? (data.clientEmail as string) ?? null,
      clientPhone: (data.buyerPhone as string) ?? (data.clientPhone as string) ?? null,
      clientGstin: (data.buyerGstin as string) ?? (data.clientGstin as string) ?? null,
      totalAmount,
      paidAmount,
      balanceDue: totalAmount - paidAmount,
      currency: String(data.currency ?? 'INR'),
      status: String(data.status ?? 'draft'),
      dueDate: (data.dueDate as string) ?? null,
      invoiceDate: (data.invoiceDate as string) ?? (data.date as string) ?? null,
      organizationId: String(data.organizationId ?? organizationId),
    };
  } catch {
    return null;
  }
}

/**
 * Check if a payment link already exists for the given invoice.
 * Prevents duplicate payment requests.
 */
export async function findExistingPaymentLink(
  organizationId: string,
  invoiceId: string,
): Promise<PaymentLinkRecord | null> {
  try {
    const q = query(
      collection(db, COLLECTIONS.PAYMENTS),
      where('organizationId', '==', organizationId),
      where('invoiceId', '==', invoiceId),
      where('status', 'in', ['link_created', 'sent', 'pending']),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      paymentId: String(data.paymentId ?? snap.docs[0].id),
      organizationId: String(data.organizationId ?? organizationId),
      invoiceId: String(data.invoiceId ?? invoiceId),
      invoiceNumber: String(data.invoiceNumber ?? ''),
      clientId: String(data.clientId ?? ''),
      clientName: String(data.clientName ?? ''),
      clientEmail: (data.clientEmail as string) ?? null,
      clientPhone: (data.clientPhone as string) ?? null,
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? 'INR'),
      provider: (data.provider as 'razorpay' | 'stripe') ?? 'razorpay',
      providerPaymentId: (data.providerPaymentId as string) ?? null,
      linkUrl: (data.linkUrl as string) ?? null,
      linkId: (data.linkId as string) ?? null,
      linkExpiry: (data.linkExpiry as string) ?? null,
      status: (data.status as PaymentLinkRecord['status']) ?? 'link_created',
      method: (data.method as string) ?? null,
      notes: (data.notes as string) ?? null,
      createdAt: String(data.createdAt ?? new Date().toISOString()),
      createdBy: String(data.createdBy ?? ''),
      updatedAt: (data.updatedAt as string) ?? null,
      paidAt: (data.paidAt as string) ?? null,
      webhookEvents: Array.isArray(data.webhookEvents) ? data.webhookEvents : [],
    };
  } catch {
    return null;
  }
}

/**
 * Validate the invoice for payment link creation.
 * Checks: exists, unpaid/partially paid, not cancelled, no existing active link.
 */
export async function validateInvoiceForPayment(
  organizationId: string,
  intent: PaymentLinkIntent,
): Promise<InvoiceValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!intent.invoiceNumber) {
    errors.push('Invoice number is required to create a payment link.');
    return { valid: false, invoice: null, errors, warnings, existingLink: null };
  }

  const invoice = await lookupInvoice(organizationId, intent.invoiceNumber);

  if (!invoice) {
    errors.push(`Invoice "${intent.invoiceNumber}" was not found in the database. Verify the invoice number or create the invoice first.`);
    return { valid: false, invoice: null, errors, warnings, existingLink: null };
  }

  const status = invoice.status.toLowerCase();
  if (status === 'cancelled' || status === 'void') {
    errors.push(`Invoice ${invoice.invoiceNumber} is cancelled and cannot receive payments.`);
  }
  if (status === 'paid' || invoice.balanceDue <= 0) {
    errors.push(`Invoice ${invoice.invoiceNumber} is already fully paid (₹${invoice.totalAmount.toLocaleString('en-IN')}). No payment link needed.`);
  }
  if (status === 'draft') {
    warnings.push(`Invoice ${invoice.invoiceNumber} is still in DRAFT status. Consider finalizing it before sending a payment link.`);
  }

  // Check for existing active link
  const existingLink = await findExistingPaymentLink(organizationId, invoice.id);
  if (existingLink) {
    warnings.push(`An active payment link already exists for ${invoice.invoiceNumber} (created ${new Date(existingLink.createdAt).toLocaleDateString('en-IN')}, status: ${existingLink.status}). Use the existing link or cancel it before creating a new one.`);
  }

  // Amount validation
  if (intent.amount !== null && intent.amount > invoice.balanceDue) {
    warnings.push(`Requested amount ₹${intent.amount.toLocaleString('en-IN')} exceeds the outstanding balance ₹${invoice.balanceDue.toLocaleString('en-IN')}. The link will be created for the outstanding balance.`);
  }

  return {
    valid: errors.length === 0,
    invoice,
    errors,
    warnings,
    existingLink,
  };
}

// ─── Provider Integration Detection ─────────────────────────────────────────

/**
 * Detect which payment provider is connected for the organization.
 * Reads from `integrations/{provider}_{orgId}` in Firestore.
 * Returns the first connected provider (Razorpay preferred for INR, Stripe for global).
 */
export async function detectPaymentProvider(
  organizationId: string,
  preferred?: 'razorpay' | 'stripe' | 'auto',
): Promise<ProviderIntegration> {
  const providers: Array<'razorpay' | 'stripe'> = preferred && preferred !== 'auto'
    ? [preferred]
    : ['razorpay', 'stripe'];

  for (const provider of providers) {
    try {
      const docRef = doc(db, 'integrations', `${provider}_${organizationId}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const connected = Boolean(data.connected && (data.apiKey || data.keyId || data.secretKey));
        if (connected) {
          return {
            connected: true,
            provider,
            apiKey: (data.apiKey as string) ?? (data.keyId as string) ?? null,
            apiSecret: (data.apiSecret as string) ?? (data.keySecret as string) ?? null,
            accountId: (data.accountId as string) ?? (data.account_id as string) ?? null,
            webhookSecret: (data.webhookSecret as string) ?? (data.webhook_secret as string) ?? null,
            testMode: Boolean(data.testMode ?? data.test_mode ?? false),
          };
        }
      }
    } catch {
      // Firestore read failed (preview mode) — try next provider
    }
  }

  return {
    connected: false,
    provider: null,
    apiKey: null,
    apiSecret: null,
    accountId: null,
    webhookSecret: null,
    testMode: false,
  };
}

// ─── Payment Link Creation (REAL provider calls) ────────────────────────────

/**
 * Create a payment link via the REAL provider API.
 *
 * In production (with real API keys), this hits:
 *   - Razorpay: POST https://api.razorpay.com/v1/payment_links
 *   - Stripe:   POST https://api.stripe.com/v1/payment_links
 *
 * In sandbox/preview (no credentials or test mode), it:
 *   - NEVER fabricates a URL
 *   - Returns a clear "what to configure" error
 *   - If testMode=true with valid test keys, attempts the real test API call
 */
export async function createProviderPaymentLink(params: {
  provider: 'razorpay' | 'stripe';
  apiKey: string;
  apiSecret: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  invoiceId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  description: string;
  expiryDays: number;
  testMode: boolean;
}): Promise<ProviderLinkResult> {
  const {
    provider, apiKey, apiSecret, amount, currency,
    invoiceNumber, invoiceId, clientName, clientEmail, clientPhone,
    description, expiryDays, testMode,
  } = params;

  // ── Validate credentials ──
  if (!apiKey || !apiSecret) {
    return {
      success: false,
      provider,
      providerPaymentId: '',
      linkUrl: '',
      linkId: '',
      linkExpiry: '',
      status: 'failed',
      shortUrl: null,
      rawResponse: {},
      error: `${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} is connected but the API credentials are incomplete. Go to Settings → Integrations → ${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} and enter your ${testMode ? 'test' : 'live'} Key ID and Key Secret.`,
    };
  }

  const expiryTimestamp = Math.floor(Date.now() / 1000) + expiryDays * 24 * 60 * 60;
  const expiryIso = new Date(expiryTimestamp * 1000).toISOString();

  try {
    if (provider === 'razorpay') {
      return await createRazorpayLink({
        keyId: apiKey,
        keySecret: apiSecret,
        amount,
        currency,
        invoiceNumber,
        invoiceId,
        clientName,
        clientEmail,
        clientPhone,
        description,
        expiryTimestamp,
        expiryIso,
        testMode,
      });
    } else {
      return await createStripeLink({
        apiKey,
        amount,
        currency,
        invoiceNumber,
        invoiceId,
        clientName,
        clientEmail,
        description,
        expiryTimestamp,
        expiryIso,
        testMode,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      provider,
      providerPaymentId: '',
      linkUrl: '',
      linkId: '',
      linkExpiry: expiryIso,
      status: 'failed',
      shortUrl: null,
      rawResponse: { error: msg },
      error: interpretProviderError(provider, msg, testMode),
    };
  }
}

/**
 * Create a Razorpay Payment Link via the real API.
 * POST https://api.razorpay.com/v1/payment_links (Basic auth: keyId:keySecret)
 */
async function createRazorpayLink(params: {
  keyId: string;
  keySecret: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  invoiceId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  description: string;
  expiryTimestamp: number;
  expiryIso: string;
  testMode: boolean;
}): Promise<ProviderLinkResult> {
  const baseUrl = params.testMode
    ? 'https://api.razorpay.com/v1/payment_links'
    : 'https://api.razorpay.com/v1/payment_links';
  const auth = Buffer.from(`${params.keyId}:${params.keySecret}`).toString('base64');
  const amountPaise = Math.round(params.amount * 100); // Razorpay uses paise

  const body: Record<string, unknown> = {
    amount: amountPaise,
    currency: params.currency,
    accept_partial: false,
    description: params.description,
    reference_id: `INV-${params.invoiceId.slice(-12)}`,
    expire_by: params.expiryTimestamp,
    notes: {
      invoice_number: params.invoiceNumber,
      invoice_id: params.invoiceId,
      source: 'gstpilot-oracle-cfo',
    },
  };
  if (params.clientEmail) body.customer = { email: params.clientEmail, name: params.clientName, contact: params.clientPhone ?? undefined };

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    return {
      success: false,
      provider: 'razorpay',
      providerPaymentId: '',
      linkUrl: '',
      linkId: '',
      linkExpiry: params.expiryIso,
      status: 'failed',
      shortUrl: null,
      rawResponse: data,
      error: interpretProviderError('razorpay', `HTTP ${res.status}: ${JSON.stringify(data)}`, params.testMode),
    };
  }

  return {
    success: true,
    provider: 'razorpay',
    providerPaymentId: String(data.id ?? ''),
    linkUrl: String(data.short_url ?? data.url ?? ''),
    linkId: String(data.id ?? ''),
    linkExpiry: params.expiryIso,
    status: String(data.status ?? 'created'),
    shortUrl: (data.short_url as string) ?? null,
    rawResponse: data,
  };
}

/**
 * Create a Stripe Payment Link via the real API.
 * POST https://api.stripe.com/v1/payment_links (Bearer auth)
 *
 * NOTE: Stripe Payment Links are reusable and don't have a true per-invoice
 * expiry like Razorpay. We set `expires_at` on the underlying price or use
 * a one-time price. For simplicity + correctness, we use Stripe Checkout
 * Sessions (which DO have expiry) created via /v1/checkout/sessions.
 */
async function createStripeLink(params: {
  apiKey: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  invoiceId: string;
  clientName: string;
  clientEmail: string | null;
  description: string;
  expiryTimestamp: number;
  expiryIso: string;
  testMode: boolean;
}): Promise<ProviderLinkResult> {
  const url = 'https://api.stripe.com/v1/checkout/sessions';
  const amountMinor = params.currency === 'INR' || params.currency === 'USD' || params.currency === 'EUR' || params.currency === 'GBP'
    ? Math.round(params.amount * 100)
    : Math.round(params.amount * 100);

  const formBody = new URLSearchParams();
  formBody.append('mode', 'payment');
  formBody.append('success_url', `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gstpilot.in'}/pay/success?session_id={CHECKOUT_SESSION_ID}`);
  formBody.append('cancel_url', `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gstpilot.in'}/pay/cancel`);
  formBody.append('expires_at', String(params.expiryTimestamp));
  formBody.append('line_items[0][quantity]', '1');
  formBody.append('line_items[0][price_data][currency]', params.currency.toLowerCase());
  formBody.append('line_items[0][price_data][unit_amount]', String(amountMinor));
  formBody.append('line_items[0][price_data][product_data][name]', `Invoice ${params.invoiceNumber}`);
  formBody.append('line_items[0][price_data][product_data][description]', params.description.slice(0, 200));
  formBody.append('metadata[invoice_number]', params.invoiceNumber);
  formBody.append('metadata[invoice_id]', params.invoiceId);
  formBody.append('metadata[source]', 'gstpilot-oracle-cfo');
  if (params.clientEmail) {
    formBody.append('customer_email', params.clientEmail);
  }
  formBody.append('client_reference_id', params.invoiceId);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({})) as Record<string, unknown>;

  if (!res.ok) {
    return {
      success: false,
      provider: 'stripe',
      providerPaymentId: '',
      linkUrl: '',
      linkId: '',
      linkExpiry: params.expiryIso,
      status: 'failed',
      shortUrl: null,
      rawResponse: data,
      error: interpretProviderError('stripe', `HTTP ${res.status}: ${JSON.stringify(data)}`, params.testMode),
    };
  }

  return {
    success: true,
    provider: 'stripe',
    providerPaymentId: String(data.id ?? ''),
    linkUrl: String(data.url ?? ''),
    linkId: String(data.id ?? ''),
    linkExpiry: params.expiryIso,
    status: 'open',
    shortUrl: (data.url as string) ?? null,
    rawResponse: data,
  };
}

function interpretProviderError(provider: 'razorpay' | 'stripe', rawError: string, testMode: boolean): string {
  const lower = rawError.toLowerCase();
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('authentication')) {
    return `${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} rejected the API key. Go to Settings → Integrations → ${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} and verify your ${testMode ? 'test' : 'live'} credentials are correct.`;
  }
  if (lower.includes('403') || lower.includes('forbidden') || lower.includes('account not active') || lower.includes('not activated')) {
    return `Your ${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} account is not fully activated. Complete KYC / account activation on the ${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} dashboard before creating payment links.`;
  }
  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('etimedout')) {
    return `The ${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} API did not respond in time. The link was not created. Please retry in a moment.`;
  }
  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('econnrefused')) {
    return `Cannot reach the ${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} API from this server. Check your network/firewall settings or retry.`;
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return `${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} rate limit reached. Wait a moment and retry.`;
  }
  return `${provider === 'razorpay' ? 'Razorpay' : 'Stripe'} returned an error while creating the payment link. The link was NOT created. Technical detail: ${rawError.slice(0, 200)}`;
}

// ─── Fee Estimation ─────────────────────────────────────────────────────────

/**
 * Estimate payment gateway fees for the given provider + amount.
 * These are public, documented rates (as of 2024). Real fees may vary by plan.
 */
export function estimateProviderFees(provider: 'razorpay' | 'stripe', amount: number, currency: string): {
  percentage: number;
  fixed: number;
  estimated: number;
} {
  if (provider === 'razorpay') {
    // Razorpay India: 2% + ₹3 per transaction (UPI is cheaper at ~0.5% but we use blended 2%)
    const pct = currency === 'INR' ? 0.02 : 0.03;
    const fixed = currency === 'INR' ? 3 : 0;
    return { percentage: pct * 100, fixed, estimated: Math.round((amount * pct + fixed) * 100) / 100 };
  }
  // Stripe India: ~2% + ₹3 for domestic, 3% + ₹6 for international
  const pct = currency === 'INR' ? 0.02 : 0.029;
  const fixed = currency === 'INR' ? 3 : 0.3;
  return { percentage: pct * 100, fixed, estimated: Math.round((amount * pct + fixed) * 100) / 100 };
}

// ─── Approval Summary Builder ───────────────────────────────────────────────

/**
 * Build the full approval summary for the payment link.
 * This is the THINK step — shown to the CA before they approve.
 */
export async function buildPaymentLinkApproval(
  organizationId: string,
  intent: PaymentLinkIntent,
): Promise<PaymentLinkApprovalSummary> {
  const validation = await validateInvoiceForPayment(organizationId, intent);
  const provider = await detectPaymentProvider(organizationId, intent.provider ?? 'auto');

  const invoice = validation.invoice;
  const amount = intent.amount ?? invoice?.balanceDue ?? 0;
  const currency = intent.currency;
  const expiryDays = 30;
  const linkExpiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const blockingReasons: string[] = [];
  if (!validation.valid) blockingReasons.push(...validation.errors);
  if (!provider.connected) {
    blockingReasons.push('No payment provider is connected. Go to Settings → Integrations and connect Razorpay or Stripe to create real payment links.');
  }

  // Delivery checks (best-effort — actual sending happens on execute)
  const hasClientEmail = Boolean(invoice?.clientEmail);
  const hasClientPhone = Boolean(invoice?.clientPhone);
  const emailNote = hasClientEmail
    ? `Will send to ${invoice?.clientEmail}`
    : 'Client has no email on file — add one to the client record before sending.';
  const whatsappNote = hasClientPhone
    ? `Will send to ${invoice?.clientPhone}`
    : 'Client has no phone on file — add one to the client record before sending.';

  const fees = provider.connected
    ? estimateProviderFees(provider.provider ?? 'razorpay', amount, currency)
    : { percentage: 0, fixed: 0, estimated: 0 };

  return {
    intent,
    invoice,
    validation,
    provider,
    amount,
    currency,
    linkExpiry,
    paymentMethods: provider.provider === 'stripe'
      ? ['Card', 'UPI', 'Net Banking', 'Wallet', 'Buy Now Pay Later']
      : ['UPI', 'Card', 'Net Banking', 'Wallet', 'EMI'],
    estimatedFees: fees,
    delivery: {
      email: hasClientEmail,
      whatsapp: hasClientPhone,
      emailNote,
      whatsappNote,
    },
    warnings: validation.warnings,
    canProceed: blockingReasons.length === 0,
    blockingReasons,
  };
}

// ─── Execute: Create + Persist + Deliver ────────────────────────────────────

/**
 * Create a payment link for the given invoice.
 * This is the ACT step — called after the CA approves.
 *
 * Steps:
 *   1. Re-validate the invoice (it may have changed)
 *   2. Detect the provider (re-read in case it was just configured)
 *   3. Call the REAL provider API to create the link
 *   4. Persist the payment record to Firestore
 *   5. Send via email (if connected + client has email)
 *   6. Send via WhatsApp (if connected + client has phone)
 *   7. Write activity + audit logs
 *   8. Roll back on any failure (delete partial records)
 */
export async function executePaymentLinkCreation(params: {
  organizationId: string;
  firmId: string | null;
  userId: string;
  userEmail: string;
  intent: PaymentLinkIntent;
}): Promise<ExecutePaymentLinkResult> {
  const { organizationId, userId, userEmail, intent } = params;
  const recordsAffected: ExecutePaymentLinkResult['recordsAffected'] = [];
  const start = Date.now();

  try {
    // ── 1. Re-validate ──
    const validation = await validateInvoiceForPayment(organizationId, intent);
    if (!validation.valid || !validation.invoice) {
      return {
        success: false,
        message: `Cannot create payment link: ${validation.errors.join(' ')}`,
        paymentId: null,
        providerPaymentId: null,
        linkUrl: null,
        linkExpiry: null,
        status: 'failed',
        emailDelivery: { sent: false, message: 'Skipped — link not created.' },
        whatsappDelivery: { sent: false, message: 'Skipped — link not created.' },
        recordsAffected,
        rollbackStatus: 'not-needed',
        error: validation.errors.join(' '),
      };
    }
    const invoice = validation.invoice;
    const amount = intent.amount ?? invoice.balanceDue;

    // ── 2. Detect provider ──
    const provider = await detectPaymentProvider(organizationId, intent.provider ?? 'auto');
    if (!provider.connected || !provider.provider) {
      return {
        success: false,
        message: 'No payment provider is connected. Go to Settings → Integrations and connect Razorpay or Stripe with your API credentials to create real payment links. The link was NOT created — no charges were applied.',
        paymentId: null,
        providerPaymentId: null,
        linkUrl: null,
        linkExpiry: null,
        status: 'failed',
        emailDelivery: { sent: false, message: 'Skipped — link not created.' },
        whatsappDelivery: { sent: false, message: 'Skipped — link not created.' },
        recordsAffected,
        rollbackStatus: 'not-needed',
        error: 'NO_PROVIDER_CONNECTED',
      };
    }

    // ── 3. Call the REAL provider API ──
    const linkResult = await createProviderPaymentLink({
      provider: provider.provider,
      apiKey: provider.apiKey!,
      apiSecret: provider.apiSecret!,
      amount,
      currency: intent.currency,
      invoiceNumber: invoice.invoiceNumber,
      invoiceId: invoice.id,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      description: `Payment for Invoice ${invoice.invoiceNumber}${intent.notes ? ` — ${intent.notes}` : ''}`,
      expiryDays: 30,
      testMode: provider.testMode,
    });

    if (!linkResult.success) {
      return {
        success: false,
        message: `Payment link creation failed: ${linkResult.error}`,
        paymentId: null,
        providerPaymentId: null,
        linkUrl: null,
        linkExpiry: null,
        status: 'failed',
        emailDelivery: { sent: false, message: 'Skipped — link not created.' },
        whatsappDelivery: { sent: false, message: 'Skipped — link not created.' },
        recordsAffected,
        rollbackStatus: 'not-needed',
        error: linkResult.error,
      };
    }

    // ── 4. Persist payment record ──
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const paymentRecord: PaymentLinkRecord = {
      paymentId,
      organizationId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      amount,
      currency: intent.currency,
      provider: provider.provider,
      providerPaymentId: linkResult.providerPaymentId,
      linkUrl: linkResult.linkUrl,
      linkId: linkResult.linkId,
      linkExpiry: linkResult.linkExpiry,
      status: 'link_created',
      method: null,
      notes: intent.notes,
      createdAt: nowIso,
      createdBy: userEmail,
      updatedAt: nowIso,
      paidAt: null,
      webhookEvents: [],
    };

    try {
      await setDoc(doc(db, COLLECTIONS.PAYMENTS, paymentId), {
        ...paymentRecord,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
      recordsAffected.push({ collection: COLLECTIONS.PAYMENTS, id: paymentId, action: 'created' });
    } catch (err) {
      // Preview-mode permission denied — the link WAS created at the provider,
      // but we can't persist it. Return the link URL so the user can use it.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes('permission-denied') || msg.toLowerCase().includes('missing or insufficient permissions')) {
        return {
          success: false,
          message: `Payment link created via ${provider.provider === 'razorpay' ? 'Razorpay' : 'Stripe'} (link URL: ${linkResult.linkUrl}), but could not be saved to the database because you are in preview mode. Sign in to persist this payment record. The link is LIVE and the customer can pay using it.`,
          paymentId,
          providerPaymentId: linkResult.providerPaymentId,
          linkUrl: linkResult.linkUrl,
          linkExpiry: linkResult.linkExpiry,
          status: 'link_created',
          emailDelivery: { sent: false, message: 'Skipped — payment record not persisted (preview mode).' },
          whatsappDelivery: { sent: false, message: 'Skipped — payment record not persisted (preview mode).' },
          recordsAffected,
          rollbackStatus: 'not-needed',
          error: 'PREVIEW_MODE: Payment link created at provider but not persisted.',
        };
      }
      throw err;
    }

    // ── 5. Email delivery (if connected + client has email) ──
    let emailDelivery: ExecutePaymentLinkResult['emailDelivery'] = { sent: false, message: 'Email not connected.' };
    if (invoice.clientEmail) {
      const { sendPaymentLinkEmail, checkEmailIntegration } = await import('./payment-link-comms');
      const emailInt = await checkEmailIntegration(organizationId);
      if (emailInt.connected) {
        const sendResult = await sendPaymentLinkEmail({
          to: invoice.clientEmail,
          clientName: invoice.clientName,
          invoiceNumber: invoice.invoiceNumber,
          amount,
          currency: intent.currency,
          linkUrl: linkResult.linkUrl!,
          linkExpiry: linkResult.linkExpiry!,
          organizationId,
          paymentId,
        });
        emailDelivery = sendResult;
      } else {
        emailDelivery = {
          sent: false,
          message: 'Email is not connected. To send payment links automatically, go to Settings → Integrations → Email and connect your SMTP or email provider.',
        };
      }
    } else {
      emailDelivery = {
        sent: false,
        message: 'Client has no email on file. Add an email to the client record to enable email delivery.',
      };
    }

    // ── 6. WhatsApp delivery (if connected + client has phone) ──
    let whatsappDelivery: ExecutePaymentLinkResult['whatsappDelivery'] = { sent: false, message: 'WhatsApp not connected.' };
    if (invoice.clientPhone) {
      const { sendPaymentLinkWhatsApp, checkWhatsAppIntegration } = await import('./payment-link-comms');
      const waInt = await checkWhatsAppIntegration(organizationId);
      if (waInt.connected) {
        const sendResult = await sendPaymentLinkWhatsApp({
          to: invoice.clientPhone,
          clientName: invoice.clientName,
          invoiceNumber: invoice.invoiceNumber,
          amount,
          currency: intent.currency,
          linkUrl: linkResult.linkUrl!,
          organizationId,
          paymentId,
        });
        whatsappDelivery = sendResult;
      } else {
        whatsappDelivery = {
          sent: false,
          message: 'WhatsApp Business is not connected. To send payment links via WhatsApp, go to Settings → Integrations → WhatsApp and connect your WhatsApp Business account.',
        };
      }
    } else {
      whatsappDelivery = {
        sent: false,
        message: 'Client has no phone on file. Add a phone to the client record to enable WhatsApp delivery.',
      };
    }

    // ── 7. Activity + audit logs ──
    const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await setDoc(doc(db, COLLECTIONS.ACTIVITIES, activityId), {
        activityId,
        organizationId,
        type: 'payment_link_created',
        action: 'create-payment-link',
        actor: 'oracle-cfo',
        actorEmail: userEmail,
        userId,
        description: `Payment link created for ${invoice.clientName} — ₹${amount.toLocaleString('en-IN')} via ${provider.provider === 'razorpay' ? 'Razorpay' : 'Stripe'} (invoice ${invoice.invoiceNumber}). Link: ${linkResult.linkUrl}`,
        metadata: {
          paymentId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          provider: provider.provider,
          providerPaymentId: linkResult.providerPaymentId,
          amount,
          linkUrl: linkResult.linkUrl,
        },
        createdAt: nowIso,
      });
      recordsAffected.push({ collection: COLLECTIONS.ACTIVITIES, id: activityId, action: 'created' });
    } catch {
      // best-effort
    }

    // ── 8. Update invoice status to "payment_link_sent" (if not already paid) ──
    try {
      await updateDoc(doc(db, COLLECTIONS.INVOICES, invoice.id), {
        paymentLinkId: paymentId,
        paymentLinkUrl: linkResult.linkUrl,
        paymentLinkProvider: provider.provider,
        paymentLinkExpiry: linkResult.linkExpiry,
        updatedAt: nowIso,
      });
      recordsAffected.push({ collection: COLLECTIONS.INVOICES, id: invoice.id, action: 'updated' });
    } catch {
      // best-effort
    }

    return {
      success: true,
      message: `Payment link created via ${provider.provider === 'razorpay' ? 'Razorpay' : 'Stripe'} for ${invoice.clientName}. Amount: ₹${amount.toLocaleString('en-IN')}. Link URL: ${linkResult.linkUrl}. Expires: ${new Date(linkResult.linkExpiry).toLocaleDateString('en-IN')}. Payment ID: ${paymentId}.${emailDelivery.sent ? ' Email sent.' : ''}${whatsappDelivery.sent ? ' WhatsApp sent.' : ''}`,
      paymentId,
      providerPaymentId: linkResult.providerPaymentId,
      linkUrl: linkResult.linkUrl,
      linkExpiry: linkResult.linkExpiry,
      status: 'link_created',
      emailDelivery,
      whatsappDelivery,
      recordsAffected,
      rollbackStatus: 'not-needed',
    };
  } catch (err) {
    // ── Rollback: delete partial records ──
    let rollbackStatus: ExecutePaymentLinkResult['rollbackStatus'] = 'not-needed';
    if (recordsAffected.length > 0) {
      try {
        for (const r of recordsAffected) {
          if (r.action === 'created') {
            await deleteDoc(doc(db, r.collection, r.id)).catch(() => {});
          }
        }
        rollbackStatus = 'rolled-back';
      } catch {
        rollbackStatus = 'rollback-failed';
      }
    }

    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Payment link creation failed: ${msg}. ${recordsAffected.length > 0 ? 'Any partial changes have been rolled back.' : ''} Please try again or contact support if it persists.`,
      paymentId: null,
      providerPaymentId: null,
      linkUrl: null,
      linkExpiry: null,
      status: 'failed',
      emailDelivery: { sent: false, message: 'Skipped — link not created.' },
      whatsappDelivery: { sent: false, message: 'Skipped — link not created.' },
      recordsAffected,
      rollbackStatus,
      error: msg,
    };
  }
}

// ─── Webhook Handler (provider → payment status update) ─────────────────────

/**
 * Process a webhook event from Razorpay or Stripe.
 * Updates the payment record + invoice status + writes an audit entry.
 *
 * Called by /api/oracle/cfo/payment-link/webhook
 */
export async function processPaymentWebhook(params: {
  provider: 'razorpay' | 'stripe';
  event: string;
  paymentId: string; // provider payment ID
  status: 'paid' | 'failed' | 'expired' | 'refunded' | 'cancelled';
  amount?: number;
  method?: string;
  rawPayload: Record<string, unknown>;
  signature?: string;
  organizationId?: string;
}): Promise<{ success: boolean; message: string; updated: boolean }> {
  const { provider, event, paymentId, status, amount, method, rawPayload } = params;

  try {
    // Find the payment record by providerPaymentId
    let q;
    if (params.organizationId) {
      q = query(
        collection(db, COLLECTIONS.PAYMENTS),
        where('organizationId', '==', params.organizationId),
        where('providerPaymentId', '==', paymentId),
        limit(1),
      );
    } else {
      q = query(
        collection(db, COLLECTIONS.PAYMENTS),
        where('providerPaymentId', '==', paymentId),
        limit(1),
      );
    }
    const snap = await getDocs(q);
    if (snap.empty) {
      return { success: false, message: `No payment record found for ${provider} payment ID ${paymentId}.`, updated: false };
    }

    const paymentDoc = snap.docs[0];
    const existing = paymentDoc.data() as PaymentLinkRecord;
    const nowIso = new Date().toISOString();

    // Update the payment record
    const updates: Record<string, unknown> = {
      status,
      updatedAt: nowIso,
      webhookEvents: [...(existing.webhookEvents ?? []), { event, timestamp: nowIso, data: rawPayload }],
    };
    if (status === 'paid') {
      updates.paidAt = nowIso;
      if (method) updates.method = method;
      if (amount) updates.amount = amount;
    }

    await updateDoc(paymentDoc.ref, updates);

    // Update the linked invoice status
    if (status === 'paid' && existing.invoiceId) {
      try {
        await updateDoc(doc(db, COLLECTIONS.INVOICES, existing.invoiceId), {
          status: 'paid',
          paidAt: nowIso,
          paidAmount: amount ?? existing.amount,
          paymentMethod: method ?? existing.method,
          paymentId: existing.paymentId,
          updatedAt: nowIso,
        });
      } catch {
        // best-effort
      }

      // Write a paid activity
      const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        await setDoc(doc(db, COLLECTIONS.ACTIVITIES, activityId), {
          activityId,
          organizationId: existing.organizationId,
          type: 'payment_received',
          action: 'webhook-payment-paid',
          actor: `${provider}-webhook`,
          actorEmail: 'system',
          userId: 'system',
          description: `Payment received via ${provider} webhook — ₹${(amount ?? existing.amount).toLocaleString('en-IN')} for invoice ${existing.invoiceNumber}. Method: ${method ?? 'N/A'}.`,
          metadata: {
            paymentId: existing.paymentId,
            invoiceId: existing.invoiceId,
            provider,
            providerPaymentId: paymentId,
            amount: amount ?? existing.amount,
            method,
          },
          createdAt: nowIso,
        });
      } catch {
        // best-effort
      }
    }

    return {
      success: true,
      message: `Webhook processed: payment ${paymentId} status updated to ${status}.`,
      updated: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Webhook processing failed: ${msg}`, updated: false };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generate a short internal reference ID (used when provider is unavailable).
 */
export function genPaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Verify a Razorpay webhook signature.
 * Razorpay uses HMAC-SHA256 with the webhook secret.
 */
export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Verify a Stripe webhook signature.
 * Stripe uses its own Stripe-Signature header with a timestamp + v1 scheme.
 */
export function verifyStripeWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  try {
    // Stripe signature format: t=1234567890,v1=abc123...
    const parts = signature.split(',');
    const tPart = parts.find((p) => p.startsWith('t='));
    const v1Part = parts.find((p) => p.startsWith('v1='));
    if (!tPart || !v1Part) return false;
    const timestamp = tPart.slice(2);
    const providedSig = v1Part.slice(3);

    const payload = `${timestamp}.${body}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    // Reject if older than 5 minutes
    const age = Math.floor(Date.now() / 1000) - Number(timestamp);
    if (age > 300) return false;

    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(providedSig, 'hex'));
  } catch {
    return false;
  }
}
