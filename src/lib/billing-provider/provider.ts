// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing, Subscriptions & Payments™ — Provider Interface
//
// IPaymentProvider is the SINGLE contract every payment backend implements.
// Today we ship two live implementations:
//   • MockRazorpayProvider — deterministic simulated UPI/card/netbanking (default)
//   • MockStripeProvider   — deterministic simulated card payments
//   • FutureRazorpayProvider / FutureStripeProvider — production placeholders
//
// All existing pages communicate ONLY through this interface (via the service
// layer). Switching to a production provider later means changing exactly ONE
// env var in registry.ts — no UI or service code changes.
//
// IMPORTANT: This interface is PURE (no Firebase, no Node `crypto` imports) so
// it is safe to import from both client and server code. The implementations
// live in `server/` and are only ever imported by API routes.
// ═══════════════════════════════════════════════════════════════════════════════

import type { PaymentMethod, PaymentProviderName } from './types';

/**
 * The decrypted provider-customer session object passed between the provider
 * and the service layer. The service encrypts this with AES-256-GCM before
 * persisting to Firestore. This type is intentionally NOT exported to client
 * code — only the server sees decrypted sessions.
 */
export interface ProviderCustomerSession {
  /** The auth / access token returned by the provider after customer creation. */
  accessToken: string;
  /** Optional refresh token (for long-lived access). */
  refreshToken?: string;
  /** The provider this session belongs to. */
  provider: PaymentProviderName;
  /** The provider-side customer id (e.g. `cust_mock_rzp_xxx`). */
  customerId: string;
  /** ISO timestamp when the access token expires. */
  expiresAt: string;
  /** Provider-specific metadata (webhook signatures, account refs, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * The contract every payment backend implements.
 *
 * Every method (except createCustomer / healthCheck) receives the data needed
 * to perform the operation. The SERVICE layer is responsible for persisting
 * results to Firestore and encrypting sessions.
 *
 * Implementations MUST throw the typed errors from `./errors.ts` so callers can
 * branch on `instanceof` for proper UX.
 */
export interface IPaymentProvider {
  /** Human-readable provider name (e.g. 'Mock Razorpay', 'Razorpay'). */
  readonly name: string;
  /** The provider identifier. */
  readonly provider: PaymentProviderName;
  /** Whether this provider makes real network calls to a payment gateway. */
  readonly isLive: boolean;

  /**
   * Create a customer record at the provider (saves email / name / phone for
   * receipts + payment-method attachment).
   * Throws: ValidationError, ProviderUnavailableError, ProviderAuthenticationError.
   */
  createCustomer(input: {
    email: string;
    name: string;
    phone?: string;
    organizationId: string;
  }): Promise<{ customerId: string; session: ProviderCustomerSession }>;

  /**
   * Create a payment session / order for a given amount.
   * Returns an order id + optional payment URL (hosted checkout) + the
   * encrypted session to store on the payment attempt.
   * Throws: ValidationError, ProviderUnavailableError, RateLimitError.
   */
  createPaymentSession(input: {
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
  }>;

  /**
   * Verify a payment after the customer returns from the hosted checkout.
   * For Razorpay this checks the signature; for Stripe this confirms the PI.
   * Throws: PaymentDeclinedError, ProviderAuthenticationError.
   */
  verifyPayment(input: {
    orderId: string;
    paymentId: string;
    signature?: string;
  }): Promise<{ succeeded: boolean; providerPaymentId: string; errorMessage?: string }>;

  /**
   * Refund a payment (full or partial).
   * Throws: RefundFailedError, ProviderUnavailableError.
   */
  refundPayment(input: {
    providerPaymentId: string;
    amount: number;
    reason?: string;
  }): Promise<{ refundId: string; succeeded: boolean; errorMessage?: string }>;

  /**
   * Retrieve the current status / details of a payment by provider id.
   * Throws: ProviderUnavailableError.
   */
  retrievePayment(
    providerPaymentId: string,
  ): Promise<{ status: 'pending' | 'succeeded' | 'failed' | 'refunded'; amount: number; method: PaymentMethod; paidAt?: string }>;

  /**
   * Attach a saved payment method to a customer (for future auto-charges).
   * Throws: ValidationError, ProviderAuthenticationError.
   */
  addPaymentMethod(input: {
    customerId: string;
    method: PaymentMethod;
    details: Record<string, unknown>;
  }): Promise<{ paymentMethodId: string }>;

  /**
   * Health check — used by the scheduler to verify the provider is reachable.
   * Returns true if the provider is operational.
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Re-export the session type so consumers can import everything from the
 * provider module without reaching into `./types`.
 */
export type { PaymentMethod, PaymentProviderName } from './types';
