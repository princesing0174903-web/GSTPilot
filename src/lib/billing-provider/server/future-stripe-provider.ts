// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing, Subscriptions & Payments™ — Future Stripe Provider (SERVER)
//
// Placeholder for the production Stripe integration. Every method throws
// `NotImplementedError` so the system fails LOUDLY if you switch to this
// provider before implementing the real HTTP calls.
//
// WHEN YOU'RE READY TO GO LIVE:
//   1. Set env: BILLING_PROVIDER=stripe-future
//   2. Configure: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
//                  (STRIPE_PUBLISHABLE_KEY on the client for Checkout.js)
//   3. Implement each method below to call the real Stripe REST API. The
//      request/response shapes are documented inline + at
//      https://stripe.com/docs/api
//   4. The service layer, hooks, and UI DO NOT CHANGE — they only talk to
//      IPaymentProvider. That's the whole point of the provider pattern.
//
// This file is SERVER-ONLY (it will hold real HTTP client code + secrets).
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  AddPaymentMethodInput,
  BillingSession,
  CreateCustomerInput,
  CreatePaymentSessionInput,
  IPaymentProvider,
  PaymentDetails,
  PaymentMethodDetails,
} from '../provider';
import type {
  PaymentProviderName,
  PaymentSessionResult,
  RefundResult,
  VerifyPaymentResult,
} from '../types';
import { NotImplementedError } from '../errors';

/**
 * Production Stripe provider — not yet implemented.
 *
 * Stripe API surface (to be wired up):
 *   • POST /v1/customers                     → createCustomer
 *   • POST /v1/checkout/sessions             → createPaymentSession (Checkout URL)
 *   • POST /v1/payment_intents/{id}/capture  → verifyPayment (capture)
 *   • GET  /v1/payment_intents/{id}          → retrievePayment
 *   • POST /v1/refunds                       → refundPayment
 *   • POST /v1/payment_methods               → addPaymentMethod (attach to customer)
 *   • GET  /v1/customers/{id}/payment_methods → listPaymentMethods
 *
 * Stripe uses Bearer auth (STRIPE_SECRET_KEY). The Checkout flow returns a
 * hosted Checkout URL the client redirects to — the `paymentUrl` returned by
 * createPaymentSession would point to that URL.
 */
export class FutureStripeProvider implements IPaymentProvider {
  readonly name = 'Stripe (production — not yet implemented)';
  readonly provider: PaymentProviderName = 'stripe';
  readonly isLive = true;

  /**
   * Validate that the required env vars are configured. Logs a warning if not.
   * Returns the resolved config (for diagnostics + the future implementation).
   */
  requireConfig(): Record<string, string | undefined> {
    const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
    const config: Record<string, string | undefined> = {};
    for (const key of required) {
      config[key] = process.env[key];
      if (!config[key]) {
        console.warn(
          `[billing-provider/future-stripe] Missing env var: ${key}. ` +
            'Set this before switching BILLING_PROVIDER=stripe-future.',
        );
      }
    }
    return config;
  }

  async createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }> {
    void this.requireConfig();
    void input;
    throw new NotImplementedError('Stripe createCustomer');
  }

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult> {
    void this.requireConfig();
    void input;
    throw new NotImplementedError('Stripe createPaymentSession');
  }

  async verifyPayment(sessionId: string): Promise<VerifyPaymentResult> {
    void this.requireConfig();
    void sessionId;
    throw new NotImplementedError('Stripe verifyPayment');
  }

  async refundPayment(
    paymentId: string,
    amount: number,
    reason?: string,
  ): Promise<RefundResult> {
    void this.requireConfig();
    void paymentId;
    void amount;
    void reason;
    throw new NotImplementedError('Stripe refundPayment');
  }

  async retrievePayment(paymentId: string): Promise<PaymentDetails> {
    void this.requireConfig();
    void paymentId;
    throw new NotImplementedError('Stripe retrievePayment');
  }

  async addPaymentMethod(input: AddPaymentMethodInput): Promise<{ methodId: string }> {
    void this.requireConfig();
    void input;
    throw new NotImplementedError('Stripe addPaymentMethod');
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethodDetails[]> {
    void this.requireConfig();
    void customerId;
    throw new NotImplementedError('Stripe listPaymentMethods');
  }

  async healthCheck(): Promise<boolean> {
    // Once implemented, ping Stripe's health endpoint.
    // For now, return false so the scheduler doesn't try to use this provider.
    return false;
  }
}

/**
 * Build a BillingSession from a customer id. In production this would call
 * Stripe to retrieve the customer record + saved payment methods.
 */
export function buildSession(customerId: string): BillingSession {
  void customerId;
  throw new NotImplementedError('Stripe buildSession');
}
