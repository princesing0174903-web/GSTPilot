// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Future Production Providers (SERVER-ONLY)
//
// FutureRazorpayProvider + FutureStripeProvider — placeholders for the
// production payment gateway integrations. Every method throws
// NotImplementedError so the billing service fails LOUDLY when these are
// selected via PAYMENT_PROVIDER=razorpay or PAYMENT_PROVIDER=stripe without
// the corresponding credentials being set.
//
// Each future provider has a requireConfig() helper that warns about missing
// env vars. The actual integration code will live here when these are built
// out in a future phase.
//
// To enable production:
//   1. Set PAYMENT_PROVIDER=razorpay (or stripe)
//   2. Set the env vars listed in requireConfig()
//   3. Replace the method bodies with real API calls (axios/fetch to the
//      provider's REST API). The interface contract stays identical.
// ═══════════════════════════════════════════════════════════════════════════════

import type { IPaymentProvider, ProviderCustomerSession } from '../provider';
import type { PaymentMethod, PaymentProviderName } from '../types';
import { NotImplementedError } from '../errors';

// ─── FutureRazorpayProvider ───────────────────────────────────────────────────

/**
 * Razorpay env vars required for production.
 */
const RAZORPAY_ENV_VARS = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

/**
 * Warn (server-side console) about missing Razorpay env vars. Called by the
 * registry when the provider is first instantiated.
 */
export function requireRazorpayConfig(): void {
  const missing = RAZORPAY_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.warn(
      `[billing-provider/future-razorpay] Missing env vars: ${missing.join(', ')}. ` +
        `Production Razorpay integration is NOT enabled. Set PAYMENT_PROVIDER=mock-razorpay to use the mock provider.`,
    );
  }
}

/**
 * Production Razorpay provider — placeholder.
 *
 * When implemented, this will use the Razorpay REST API:
 *   • https://api.razorpay.com/v1/customers (createCustomer)
 *   • https://api.razorpay.com/v1/orders (createPaymentSession)
 *   • https://api.razorpay.com/v1/payments/{id} (verifyPayment, retrievePayment)
 *   • https://api.razorpay.com/v1/payments/{id}/refund (refundPayment)
 *
 * Auth: HTTP Basic with RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET.
 * Webhook signature: HMAC-SHA256 with RAZORPAY_WEBHOOK_SECRET.
 */
export class FutureRazorpayProvider implements IPaymentProvider {
  readonly name = 'Razorpay (Future)';
  readonly provider: PaymentProviderName = 'razorpay';
  readonly isLive = true;

  constructor() {
    requireRazorpayConfig();
  }

  async createCustomer(): Promise<{ customerId: string; session: ProviderCustomerSession }> {
    throw new NotImplementedError('Razorpay createCustomer');
  }

  async createPaymentSession(): Promise<{
    orderId: string;
    paymentUrl?: string;
    session: ProviderCustomerSession;
  }> {
    throw new NotImplementedError('Razorpay createPaymentSession');
  }

  async verifyPayment(): Promise<{
    succeeded: boolean;
    providerPaymentId: string;
    errorMessage?: string;
  }> {
    throw new NotImplementedError('Razorpay verifyPayment');
  }

  async refundPayment(): Promise<{
    refundId: string;
    succeeded: boolean;
    errorMessage?: string;
  }> {
    throw new NotImplementedError('Razorpay refundPayment');
  }

  async retrievePayment(): Promise<{
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    amount: number;
    method: PaymentMethod;
    paidAt?: string;
  }> {
    throw new NotImplementedError('Razorpay retrievePayment');
  }

  async addPaymentMethod(): Promise<{ paymentMethodId: string }> {
    throw new NotImplementedError('Razorpay addPaymentMethod');
  }

  async healthCheck(): Promise<boolean> {
    // Production health check would ping Razorpay's /v1/health endpoint.
    return false;
  }
}

// ─── FutureStripeProvider ─────────────────────────────────────────────────────

/**
 * Stripe env vars required for production.
 */
const STRIPE_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PUBLISHABLE_KEY',
] as const;

/**
 * Warn (server-side console) about missing Stripe env vars. Called by the
 * registry when the provider is first instantiated.
 */
export function requireStripeConfig(): void {
  const missing = STRIPE_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.warn(
      `[billing-provider/future-stripe] Missing env vars: ${missing.join(', ')}. ` +
        `Production Stripe integration is NOT enabled. Set PAYMENT_PROVIDER=mock-stripe to use the mock provider.`,
    );
  }
}

/**
 * Production Stripe provider — placeholder.
 *
 * When implemented, this will use the Stripe REST API:
 *   • https://api.stripe.com/v1/customers (createCustomer)
 *   • https://api.stripe.com/v1/payment_intents (createPaymentSession)
 *   • https://api.stripe.com/v1/payment_intents/{id}/confirm (verifyPayment)
 *   • https://api.stripe.com/v1/charges/{id} (retrievePayment)
 *   • https://api.stripe.com/v1/refunds (refundPayment)
 *
 * Auth: Bearer STRIPE_SECRET_KEY.
 * Webhook signature: HMAC-SHA256 with STRIPE_WEBHOOK_SECRET.
 */
export class FutureStripeProvider implements IPaymentProvider {
  readonly name = 'Stripe (Future)';
  readonly provider: PaymentProviderName = 'stripe';
  readonly isLive = true;

  constructor() {
    requireStripeConfig();
  }

  async createCustomer(): Promise<{ customerId: string; session: ProviderCustomerSession }> {
    throw new NotImplementedError('Stripe createCustomer');
  }

  async createPaymentSession(): Promise<{
    orderId: string;
    paymentUrl?: string;
    session: ProviderCustomerSession;
  }> {
    throw new NotImplementedError('Stripe createPaymentSession');
  }

  async verifyPayment(): Promise<{
    succeeded: boolean;
    providerPaymentId: string;
    errorMessage?: string;
  }> {
    throw new NotImplementedError('Stripe verifyPayment');
  }

  async refundPayment(): Promise<{
    refundId: string;
    succeeded: boolean;
    errorMessage?: string;
  }> {
    throw new NotImplementedError('Stripe refundPayment');
  }

  async retrievePayment(): Promise<{
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    amount: number;
    method: PaymentMethod;
    paidAt?: string;
  }> {
    throw new NotImplementedError('Stripe retrievePayment');
  }

  async addPaymentMethod(): Promise<{ paymentMethodId: string }> {
    throw new NotImplementedError('Stripe addPaymentMethod');
  }

  async healthCheck(): Promise<boolean> {
    // Production health check would ping Stripe's /v1/balance endpoint.
    return false;
  }
}
