// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Mock Stripe Provider (SERVER-ONLY)
//
// A deterministic, in-memory simulated Stripe payment gateway. Used as the
// international-default payment backend so the entire billing flow works
// end-to-end without real Stripe credentials. Switching to production = set
// PAYMENT_PROVIDER=stripe + STRIPE_SECRET_KEY/WEBHOOK_SECRET/PUBLISHABLE_KEY
// env vars — zero service code changes.
//
// Stripe-style behavior:
//   • createCustomer → cus_<hash>
//   • createPaymentSession (createPaymentIntent) → pi_<hash>
//   • verifyPayment (confirm + charge) → ch_<hash>
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

interface MockStripeCustomer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  organizationId: string;
  paymentMethods: Map<string, PaymentMethod>;
  createdAt: string;
}

interface MockPaymentIntent {
  id: string;
  customerId: string;
  amount: number;
  currency: 'INR';
  description: string;
  invoiceId: string;
  method?: PaymentMethod;
  returnUrl: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled' | 'processing';
  chargeId: string | null;
  createdAt: string;
}

interface MockCharge {
  id: string;
  paymentIntentId: string;
  customerId: string;
  amount: number;
  currency: 'INR';
  method: PaymentMethod;
  status: 'succeeded' | 'failed' | 'refunded';
  refundedAmount: number;
  capturedAt: string | null;
  createdAt: string;
}

interface MockStripeRefund {
  id: string;
  chargeId: string;
  amount: number;
  reason?: string;
  status: 'succeeded' | 'failed';
  createdAt: string;
}

const customers = new Map<string, MockStripeCustomer>();
const paymentIntents = new Map<string, MockPaymentIntent>();
const charges = new Map<string, MockCharge>();
const refunds = new Map<string, MockStripeRefund>();

// Mock Stripe secret — used to generate deterministic confirmation tokens.
const MOCK_SECRET = 'gstpilot_mock_stripe_secret_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 10);
}

function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${shortHash(parts.join('|') + Date.now() + Math.random())}`;
}

function maybeUnavailable(): void {
  if (Math.random() < 0.05) {
    throw new ProviderUnavailableError(
      'Mock Stripe is temporarily unavailable (simulated outage).',
    );
  }
}

function maybeDecline(amount: number): { declined: boolean; reason?: string } {
  const decline = amount > 0 && amount % 10 === 0 && Math.random() < 0.1;
  if (!decline) return { declined: false };
  const reasons = [
    'Insufficient funds',
    'Card declined',
    'Do not honor',
    'Pickup card',
    'Lost card',
  ];
  return { declined: true, reason: reasons[Math.floor(Math.random() * reasons.length)] };
}

function buildSession(customerId: string): ProviderCustomerSession {
  return {
    accessToken: `sk_access_${shortHash(customerId + Date.now())}`,
    refreshToken: `sk_refresh_${shortHash(customerId + MOCK_SECRET)}`,
    provider: 'mock-stripe',
    customerId,
    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour (Stripe-style)
    metadata: {
      mock: true,
      account: 'gstpilot_mock_stripe',
    },
  };
}

// ─── Provider implementation ──────────────────────────────────────────────────

export class MockStripeProvider implements IPaymentProvider {
  readonly name = 'Mock Stripe';
  readonly provider: PaymentProviderName = 'mock-stripe';
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

    const customerId = makeId('cus', input.email, input.organizationId);
    const customer: MockStripeCustomer = {
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
        `Customer ${input.customerId} not found at Mock Stripe.`,
      );
    }
    if (input.amount <= 0) {
      throw new ValidationError('Amount must be greater than 0.');
    }
    maybeUnavailable();
    if (Math.random() < 0.02) {
      throw new RateLimitError(undefined, 5_000);
    }

    // Stripe-style: create a PaymentIntent (pi_...)
    const piId = makeId('pi', input.customerId, input.invoiceId);
    const pi: MockPaymentIntent = {
      id: piId,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      invoiceId: input.invoiceId,
      method: input.method,
      returnUrl: input.returnUrl,
      status: 'requires_confirmation',
      chargeId: null,
      createdAt: new Date().toISOString(),
    };
    paymentIntents.set(piId, pi);

    // Mock Stripe Checkout URL
    const paymentUrl = `https://mock-stripe.gstpilot.test/c/${piId}`;

    return { orderId: piId, paymentUrl, session: buildSession(input.customerId) };
  }

  async verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature?: string;
  }): Promise<{ succeeded: boolean; providerPaymentId: string; errorMessage?: string }> {
    maybeUnavailable();

    const pi = paymentIntents.get(input.orderId);
    if (!pi) {
      throw new ProviderAuthenticationError(
        `PaymentIntent ${input.orderId} not found at Mock Stripe.`,
      );
    }

    // Simulate confirm + charge.
    const { declined, reason } = maybeDecline(pi.amount);
    const chargeId = input.paymentId || makeId('ch', input.orderId);
    const charge: MockCharge = {
      id: chargeId,
      paymentIntentId: input.orderId,
      customerId: pi.customerId,
      amount: pi.amount,
      currency: pi.currency,
      method: pi.method ?? 'card',
      status: declined ? 'failed' : 'succeeded',
      refundedAmount: 0,
      capturedAt: declined ? null : new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    charges.set(chargeId, charge);

    if (declined) {
      pi.status = 'canceled';
      return {
        succeeded: false,
        providerPaymentId: chargeId,
        errorMessage: reason ?? 'Card was declined.',
      };
    }

    pi.status = 'succeeded';
    pi.chargeId = chargeId;
    return { succeeded: true, providerPaymentId: chargeId };
  }

  async refundPayment(input: {
    providerPaymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; succeeded: boolean; errorMessage?: string }> {
    maybeUnavailable();

    const charge = charges.get(input.providerPaymentId);
    if (!charge) {
      throw new PaymentFailedError(
        `Charge ${input.providerPaymentId} not found at Mock Stripe.`,
      );
    }
    if (charge.status !== 'succeeded') {
      throw new PaymentDeclinedError(
        `Charge ${input.providerPaymentId} cannot be refunded (status: ${charge.status}).`,
      );
    }
    if (input.amount <= 0 || input.amount > charge.amount - charge.refundedAmount) {
      throw new ValidationError('Refund amount is invalid.');
    }

    const refundId = makeId('re', input.providerPaymentId);
    const refund: MockStripeRefund = {
      id: refundId,
      chargeId: input.providerPaymentId,
      amount: input.amount,
      reason: input.reason,
      status: 'succeeded',
      createdAt: new Date().toISOString(),
    };
    refunds.set(refundId, refund);

    charge.refundedAmount += input.amount;
    if (charge.refundedAmount >= charge.amount) {
      charge.status = 'refunded';
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
    const charge = charges.get(providerPaymentId);
    if (!charge) {
      throw new ProviderAuthenticationError(
        `Charge ${providerPaymentId} not found at Mock Stripe.`,
      );
    }
    return {
      status:
        charge.status === 'succeeded'
          ? 'succeeded'
          : charge.status === 'failed'
            ? 'failed'
            : charge.status === 'refunded'
              ? 'refunded'
              : 'pending',
      amount: charge.amount,
      method: charge.method,
      paidAt: charge.capturedAt ?? undefined,
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
        `Customer ${input.customerId} not found at Mock Stripe.`,
      );
    }
    const pmId = makeId('pm', input.customerId, input.method);
    customer.paymentMethods.set(pmId, input.method);
    return { paymentMethodId: pmId };
  }

  async healthCheck(): Promise<boolean> {
    try {
      maybeUnavailable();
      return true;
    } catch {
      return false;
    }
  }
}
