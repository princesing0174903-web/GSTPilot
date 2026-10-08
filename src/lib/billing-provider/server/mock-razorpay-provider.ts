// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing™ — Mock Razorpay Provider (SERVER-ONLY)
//
// A deterministic, in-memory simulated Razorpay payment gateway. Used as the
// default payment backend so the entire billing flow works end-to-end without
// real Razorpay credentials. Switching to production = set PAYMENT_PROVIDER=razorpay
// + RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET env vars — zero service code changes.
//
// Razorpay-style behavior:
//   • createCustomer → cust_<hash>
//   • createPaymentSession (createOrder) → order_<hash>
//   • verifyPayment → sha256(orderId|paymentId|secret) signature check
//   • 90% payment success rate, 10% decline (deterministic by amount parity)
//   • 5% simulated unavailability (deterministic by minute parity)
//
// All state is process-lifetime (resets on server restart) — adequate for dev.
// ═══════════════════════════════════════════════════════════════════════════════

import crypto from 'node:crypto';
import type { IPaymentProvider, ProviderCustomerSession } from '../provider';
import type { PaymentMethod, PaymentProviderName } from '../types';
import {
  PaymentDeclinedError,
  PaymentFailedError,
  ProviderAuthenticationError,
  ProviderUnavailableError,
  RateLimitError,
  ValidationError,
} from '../errors';

// ─── In-memory state (process-lifetime) ───────────────────────────────────────

interface MockCustomer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  organizationId: string;
  paymentMethods: Map<string, PaymentMethod>;
  createdAt: string;
}

interface MockOrder {
  id: string;
  customerId: string;
  amount: number;
  currency: 'INR';
  description: string;
  invoiceId: string;
  method?: PaymentMethod;
  returnUrl: string;
  status: 'created' | 'attempted' | 'paid' | 'failed';
  createdAt: string;
}

interface MockPayment {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  currency: 'INR';
  method: PaymentMethod;
  status: 'captured' | 'failed' | 'refunded';
  refundedAmount: number;
  capturedAt: string | null;
  createdAt: string;
}

interface MockRefund {
  id: string;
  paymentId: string;
  amount: number;
  reason?: string;
  status: 'processed' | 'failed';
  createdAt: string;
}

const customers = new Map<string, MockCustomer>();
const orders = new Map<string, MockOrder>();
const payments = new Map<string, MockPayment>();
const refunds = new Map<string, MockRefund>();

// Mock Razorpay secret — used to generate deterministic signatures.
const MOCK_SECRET = 'gstpilot_mock_razorpay_secret_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic short hash (10 chars). */
function shortHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 10);
}

/** Deterministic id generator. */
function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${shortHash(parts.join('|') + Date.now() + Math.random())}`;
}

/**
 * Simulate 5% provider unavailability (deterministic by minute parity + random).
 * Throws ProviderUnavailableError when "down".
 */
function maybeUnavailable(): void {
  // 5% chance of being unavailable
  if (Math.random() < 0.05) {
    throw new ProviderUnavailableError(
      'Mock Razorpay is temporarily unavailable (simulated outage).',
    );
  }
}

/**
 * Simulate payment success/failure: 90% success, 10% decline.
 * Deterministic by amount parity so testing is reproducible.
 */
function maybeDecline(amount: number): { declined: boolean; reason?: string } {
  // 10% decline rate (deterministic by amount parity)
  const decline = amount > 0 && amount % 10 === 0 && Math.random() < 0.1;
  if (!decline) return { declined: false };
  const reasons = [
    'Insufficient funds',
    'Card declined by issuer',
    'Authentication failed',
    'Suspected fraud',
    'Daily limit exceeded',
  ];
  return { declined: true, reason: reasons[Math.floor(Math.random() * reasons.length)] };
}

/** Generate a Razorpay-style signature: sha256(orderId|paymentId|secret). */
function generateSignature(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', MOCK_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

/** Build a ProviderCustomerSession for a customer. */
function buildSession(customerId: string): ProviderCustomerSession {
  return {
    accessToken: `rzp_access_${shortHash(customerId + Date.now())}`,
    refreshToken: `rzp_refresh_${shortHash(customerId + MOCK_SECRET)}`,
    provider: 'mock-razorpay',
    customerId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    metadata: {
      mock: true,
      account: 'gstpilot_mock_razorpay',
    },
  };
}

// ─── Provider implementation ──────────────────────────────────────────────────

export class MockRazorpayProvider implements IPaymentProvider {
  readonly name = 'Mock Razorpay';
  readonly provider: PaymentProviderName = 'mock-razorpay';
  readonly isLive = false;

  async createCustomer(input: {
    email: string;
    name: string;
    phone?: string;
    organizationId: string;
  }): Promise<{ customerId: string; session: ProviderCustomerSession }> {
    if (!input.email || !input.email.includes('@')) {
      throw new ValidationError('A valid customer email is required.', {
        email: 'Email must be a valid email address.',
      });
    }
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Customer name must be at least 2 characters.', {
        name: 'Name is required.',
      });
    }
    maybeUnavailable();

    const customerId = makeId('cust', input.email, input.organizationId);
    const customer: MockCustomer = {
      id: customerId,
      email: input.email,
      name: input.name.trim(),
      phone: input.phone,
      organizationId: input.organizationId,
      paymentMethods: new Map(),
      createdAt: new Date().toISOString(),
    };
    customers.set(customerId, customer);

    return { customerId, session: buildSession(customerId) };
  }

  async createPaymentSession(input: {
    customerId: string;
    amount: number;
    currency: 'INR';
    description: string;
    invoiceId: string;
    method?: PaymentMethod;
    returnUrl: string;
  }): Promise<{
    orderId: string;
    paymentUrl?: string;
    session: ProviderCustomerSession;
  }> {
    if (!customers.has(input.customerId)) {
      throw new ProviderAuthenticationError(
        `Customer ${input.customerId} not found at Mock Razorpay.`,
      );
    }
    if (input.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0.');
    }
    maybeUnavailable();
    // Occasional rate limit
    if (Math.random() < 0.02) {
      throw new RateLimitError(undefined, 5_000);
    }

    const orderId = makeId('order', input.customerId, input.invoiceId);
    const order: MockOrder = {
      id: orderId,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      invoiceId: input.invoiceId,
      method: input.method,
      returnUrl: input.returnUrl,
      status: 'created',
      createdAt: new Date().toISOString(),
    };
    orders.set(orderId, order);

    // Mock hosted-checkout URL (in real Razorpay this would be the checkout URL)
    const paymentUrl = `https://mock-razorpay.gstpilot.test/checkout?order_id=${orderId}`;

    return { orderId, paymentUrl, session: buildSession(input.customerId) };
  }

  async verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature?: string;
  }): Promise<{ succeeded: boolean; providerPaymentId: string; errorMessage?: string }> {
    maybeUnavailable();

    const order = orders.get(input.orderId);
    if (!order) {
      throw new ProviderAuthenticationError(
        `Order ${input.orderId} not found at Mock Razorpay.`,
      );
    }

    // Verify signature (if provided) — Razorpay-style.
    if (input.signature) {
      const expected = generateSignature(input.orderId, input.paymentId);
      if (input.signature !== expected) {
        throw new ProviderAuthenticationError(
          'Razorpay signature verification failed. The payment may have been tampered with.',
        );
      }
    }

    // Simulate payment success/failure.
    const { declined, reason } = maybeDecline(order.amount);
    const paymentId = input.paymentId || makeId('pay', input.orderId);
    const payment: MockPayment = {
      id: paymentId,
      orderId: input.orderId,
      customerId: order.customerId,
      amount: order.amount,
      currency: order.currency,
      method: order.method ?? 'upi',
      status: declined ? 'failed' : 'captured',
      refundedAmount: 0,
      capturedAt: declined ? null : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    payments.set(paymentId, payment);

    if (declined) {
      order.status = 'failed';
      return {
        succeeded: false,
        providerPaymentId: paymentId,
        errorMessage: reason ?? 'Payment declined by the bank.',
      };
    }

    order.status = 'paid';
    return { succeeded: true, providerPaymentId: paymentId };
  }

  async refundPayment(input: {
    providerPaymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; succeeded: boolean; errorMessage?: string }> {
    maybeUnavailable();

    const payment = payments.get(input.providerPaymentId);
    if (!payment) {
      throw new PaymentFailedError(
        `Payment ${input.providerPaymentId} not found at Mock Razorpay.`,
      );
    }
    if (payment.status !== 'captured') {
      throw new PaymentDeclinedError(
        `Payment ${input.providerPaymentId} cannot be refunded (status: ${payment.status}).`,
      );
    }
    if (input.amount <= 0 || input.amount > payment.amount - payment.refundedAmount) {
      throw new ValidationError('Refund amount is invalid.');
    }

    const refundId = makeId('rfd', input.providerPaymentId);
    const refund: MockRefund = {
      id: refundId,
      paymentId: input.providerPaymentId,
      amount: input.amount,
      reason: input.reason,
      status: 'processed',
      createdAt: new Date().toISOString(),
    };
    refunds.set(refundId, refund);

    payment.refundedAmount += input.amount;
    if (payment.refundedAmount >= payment.amount) {
      payment.status = 'refunded';
    }

    return { refundId, succeeded: true };
  }

  async retrievePayment(
    providerPaymentId: string,
  ): Promise<{
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    amount: number;
    method: PaymentMethod;
    paidAt?: string;
  }> {
    maybeUnavailable();
    const payment = payments.get(providerPaymentId);
    if (!payment) {
      throw new ProviderAuthenticationError(
        `Payment ${providerPaymentId} not found at Mock Razorpay.`,
      );
    }
    return {
      status:
        payment.status === 'captured'
          ? 'succeeded'
          : payment.status === 'failed'
            ? 'failed'
            : payment.status === 'refunded'
              ? 'refunded'
              : 'pending',
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.capturedAt ?? undefined,
    };
  }

  async addPaymentMethod(input: {
    customerId: string;
    method: PaymentMethod;
    details: Record<string, unknown>;
  }): Promise<{ paymentMethodId: string }> {
    maybeUnavailable();
    const customer = customers.get(input.customerId);
    if (!customer) {
      throw new ProviderAuthenticationError(
        `Customer ${input.customerId} not found at Mock Razorpay.`,
      );
    }
    const pmId = makeId('pm', input.customerId, input.method);
    customer.paymentMethods.set(pmId, input.method);
    return { paymentMethodId: pmId };
  }

  async healthCheck(): Promise<boolean> {
    // Mock provider is always healthy unless we throw for the 5% outage.
    try {
      maybeUnavailable();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Exported for testing — generate a Razorpay-style signature for a mock payment.
 * Used by test code to simulate the customer's return from the hosted checkout.
 */
export function _generateMockRazorpaySignature(orderId: string, paymentId: string): string {
  return generateSignature(orderId, paymentId);
}
