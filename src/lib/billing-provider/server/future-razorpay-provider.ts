// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing, Subscriptions & Payments™ — Future Razorpay Provider (SERVER)
//
// Placeholder for the production Razorpay integration. Every method throws
// `NotImplementedError` so the system fails LOUDLY if you switch to this
// provider before implementing the real HTTP calls.
//
// WHEN YOU'RE READY TO GO LIVE:
//   1. Set env: BILLING_PROVIDER=razorpay-future
//   2. Configure: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
//   3. Implement each method below to call the real Razorpay REST API. The
//      request/response shapes are documented inline + at
//      https://razorpay.com/docs/api/payments/
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
 * Production Razorpay provider — not yet implemented.
 *
 * Razorpay API surface (to be wired up):
 *   • POST /v1/customers                → createCustomer
 *   • POST /v1/orders                   → createPaymentSession (returns order_id)
 *   • POST /v1/payments/{id}/capture    → verifyPayment (capture)
 *   • GET  /v1/payments/{id}            → retrievePayment
 *   • POST /v1/payments/{id}/refund     → refundPayment
 *   • POST /v1/customers/{id}/tokens    → addPaymentMethod (card token)
 *   • GET  /v1/customers/{id}/tokens    → listPaymentMethods
 *
 * Razorpay uses HTTP Basic auth (key_id:key_secret). The Checkout flow uses
 * the Orders API + a client-side Razorpay Checkout modal — the `paymentUrl`
 * returned by createPaymentSession would point to the Razorpay-hosted
 * checkout page.
 */
export class FutureRazorpayProvider implements IPaymentProvider {
  readonly name = 'Razorpay (production — not yet implemented)';
  readonly provider: PaymentProviderName = 'razorpay';
  readonly isLive = true;

  /**
   * Validate that the required env vars are configured. Logs a warning if not.
   * Returns the resolved config (for diagnostics + the future implementation).
   */
  requireConfig(): Record<string, string | undefined> {
    const required = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
    const config: Record<string, string | undefined> = {};
    for (const key of required) {
      config[key] = process.env[key];
      if (!config[key]) {
        console.warn(
          `[billing-provider/future-razorpay] Missing env var: ${key}. ` +
            'Set this before switching BILLING_PROVIDER=razorpay-future.',
        );
      }
    }
    return config;
  }

  async createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }> {
    void this.requireConfig();
    void input;
    throw new NotImplementedError('Razorpay createCustomer');
  }

  async createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSessionResult> {
    void this.requireConfig();
    void input;
    throw new NotImplementedError('Razorpay createPaymentSession');
  }

  async verifyPayment(sessionId: string): Promise<VerifyPaymentResult> {
    void this.requireConfig();
    void sessionId;
    throw new NotImplementedError('Razorpay verifyPayment');
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
    throw new NotImplementedError('Razorpay refundPayment');
  }

  async retrievePayment(paymentId: string): Promise<PaymentDetails> {
    void this.requireConfig();
    void paymentId;
    throw new NotImplementedError('Razorpay retrievePayment');
  }

  async addPaymentMethod(input: AddPaymentMethodInput): Promise<{ methodId: string }> {
    void this.requireConfig();
    void input;
    throw new NotImplementedError('Razorpay addPaymentMethod');
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethodDetails[]> {
    void this.requireConfig();
    void customerId;
    throw new NotImplementedError('Razorpay listPaymentMethods');
  }

  async healthCheck(): Promise<boolean> {
    // Once implemented, ping Razorpay's health endpoint.
    // For now, return false so the scheduler doesn't try to use this provider.
    return false;
  }
}

/**
 * Build a BillingSession from a customer id. In production this would call
 * Razorpay to retrieve the customer record + saved tokens.
 */
export function buildSession(customerId: string): BillingSession {
  void customerId;
  throw new NotImplementedError('Razorpay buildSession');
}
