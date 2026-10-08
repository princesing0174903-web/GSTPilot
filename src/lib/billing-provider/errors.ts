// ═══════════════════════════════════════════════════════════════════════════════
// VEYRO Billing, Subscriptions & Payments™ — Typed Errors
//
// Every failure mode in the billing / payment flow has a dedicated error class
// so callers can branch on `instanceof` and show the right UX (retry vs re-auth
// vs contact-support). All errors are PURE classes — safe for client + server.
// ═══════════════════════════════════════════════════════════════════════════════

/** Base class for every billing error. Carries a machine-readable `code`. */
export class BillingError extends Error {
  /** Stable error code — use for branching, NOT for display. */
  readonly code: string;
  /** Optional HTTP status hint for API routes. */
  readonly statusCode: number;
  /** Whether retrying the same operation could succeed. */
  readonly retryable: boolean;

  constructor(
    message: string,
    opts: { code?: string; statusCode?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = opts.code ?? 'BILLING_ERROR';
    this.statusCode = opts.statusCode ?? 500;
    this.retryable = opts.retryable ?? false;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

/** The referenced subscription was not found. */
export class SubscriptionNotFoundError extends BillingError {
  constructor(message = 'Subscription not found.') {
    super(message, { code: 'SUBSCRIPTION_NOT_FOUND', statusCode: 404, retryable: false });
  }
}

/** The org already has an active subscription (enforce one-per-org). */
export class SubscriptionAlreadyExistsError extends BillingError {
  constructor(message = 'This organization already has an active subscription. Please cancel or upgrade first.') {
    super(message, { code: 'SUBSCRIPTION_ALREADY_EXISTS', statusCode: 409, retryable: false });
  }
}

/** The referenced plan was not found. */
export class PlanNotFoundError extends BillingError {
  constructor(message = 'Subscription plan not found.') {
    super(message, { code: 'PLAN_NOT_FOUND', statusCode: 404, retryable: false });
  }
}

/** The plan is not available for new subscriptions (isActive=false). */
export class PlanNotAvailableError extends BillingError {
  constructor(message = 'This plan is no longer available for new subscriptions.') {
    super(message, { code: 'PLAN_NOT_AVAILABLE', statusCode: 410, retryable: false });
  }
}

/** A payment attempt failed (transient — retryable). */
export class PaymentFailedError extends BillingError {
  constructor(message = 'The payment could not be processed. Please try again.') {
    super(message, { code: 'PAYMENT_FAILED', statusCode: 402, retryable: true });
  }
}

/** The payment was declined by the customer's bank / issuer (not retryable). */
export class PaymentDeclinedError extends BillingError {
  constructor(message = 'The payment was declined. Please try a different payment method.') {
    super(message, { code: 'PAYMENT_DECLINED', statusCode: 402, retryable: false });
  }
}

/** A refund attempt failed. */
export class RefundFailedError extends BillingError {
  constructor(message = 'The refund could not be processed. Please try again later.') {
    super(message, { code: 'REFUND_FAILED', statusCode: 402, retryable: true });
  }
}

/** The referenced invoice was not found. */
export class InvoiceNotFoundError extends BillingError {
  constructor(message = 'Invoice not found.') {
    super(message, { code: 'INVOICE_NOT_FOUND', statusCode: 404, retryable: false });
  }
}

/** The invoice is already paid (e.g. trying to record a duplicate payment). */
export class InvoiceAlreadyPaidError extends BillingError {
  constructor(message = 'This invoice has already been paid.') {
    super(message, { code: 'INVOICE_ALREADY_PAID', statusCode: 409, retryable: false });
  }
}

/** The referenced coupon was not found. */
export class CouponNotFoundError extends BillingError {
  constructor(message = 'Coupon code not found.') {
    super(message, { code: 'COUPON_NOT_FOUND', statusCode: 404, retryable: false });
  }
}

/** The coupon code is invalid (not found, inactive, wrong plan, below min cart, etc.). */
export class CouponInvalidError extends BillingError {
  constructor(message = 'This coupon code is invalid.') {
    super(message, { code: 'COUPON_INVALID', statusCode: 400, retryable: false });
  }
}

/** The coupon code has expired. */
export class CouponExpiredError extends BillingError {
  constructor(message = 'This coupon code has expired.') {
    super(message, { code: 'COUPON_EXPIRED', statusCode: 410, retryable: false });
  }
}

/** The coupon has been redeemed the maximum number of times. */
export class CouponRedemptionExceededError extends BillingError {
  constructor(message = 'This coupon has been redeemed the maximum number of times.') {
    super(message, { code: 'COUPON_REDEMPTION_EXCEEDED', statusCode: 410, retryable: false });
  }
}

/** The usage limit for the current period was exceeded. */
export class UsageLimitExceededError extends BillingError {
  readonly metric: string;
  readonly limit: number;
  readonly current: number;

  constructor(
    metric: string,
    current: number,
    limit: number,
    message?: string,
  ) {
    const msg = message ?? `Usage limit exceeded for ${metric}: ${current} / ${limit}. Please upgrade your plan to continue.`;
    super(msg, { code: 'USAGE_LIMIT_EXCEEDED', statusCode: 429, retryable: false });
    this.metric = metric;
    this.current = current;
    this.limit = limit;
  }
}

/** The org has no billing account — user must add a payment method first. */
export class BillingAccountNotFoundError extends BillingError {
  constructor(message = 'No billing account found. Please add a payment method first.') {
    super(message, { code: 'BILLING_ACCOUNT_NOT_FOUND', statusCode: 404, retryable: false });
  }
}

/** The payment provider service is unavailable (5xx, maintenance, etc.). */
export class ProviderUnavailableError extends BillingError {
  constructor(message = 'The payment service is temporarily unavailable. Please try again later.') {
    super(message, { code: 'PROVIDER_UNAVAILABLE', statusCode: 503, retryable: true });
  }
}

/** Authentication failed (bad API key, revoked token, etc.). */
export class ProviderAuthenticationError extends BillingError {
  constructor(message = 'Payment provider authentication failed. Please contact support.') {
    super(message, { code: 'PROVIDER_AUTH_FAILED', statusCode: 401, retryable: false });
  }
}

/** The provider rate-limited the request — caller should back off and retry. */
export class RateLimitError extends BillingError {
  /** Suggested wait in milliseconds before retrying. */
  readonly retryAfterMs: number;

  constructor(
    message = 'Too many requests to the payment service. Please wait a moment and try again.',
    retryAfterMs = 30_000,
  ) {
    super(message, { code: 'RATE_LIMITED', statusCode: 429, retryable: true });
    this.retryAfterMs = retryAfterMs;
  }
}

/** Input validation failed before even calling the provider. */
export class ValidationError extends BillingError {
  constructor(message = 'Invalid input.', readonly fields?: Record<string, string>) {
    super(message, { code: 'VALIDATION_ERROR', statusCode: 400, retryable: false });
  }
}

/** A proration calculation failed (e.g. negative days remaining). */
export class ProrationError extends BillingError {
  constructor(message = 'Proration calculation failed. The billing period may have already ended.') {
    super(message, { code: 'PRORATION_ERROR', statusCode: 500, retryable: false });
  }
}

/**
 * Thrown by every Future* provider for each method — signals that the
 * production payment integration is not yet enabled. Callers should fall back
 * to the mock provider or surface a clear "feature not available" message.
 */
export class NotImplementedError extends BillingError {
  constructor(feature = 'This billing operation') {
    super(
      `${feature} is not available yet. Production payment integration is not enabled. Set PAYMENT_PROVIDER=<razorpay|stripe> and configure the provider credentials to enable.`,
      { code: 'NOT_IMPLEMENTED', statusCode: 501, retryable: false },
    );
  }
}

/**
 * Convert an unknown error into a human-readable message suitable for display
 * to the end user. Maps known billing errors to friendly copy; falls back to
 * the raw message for unknown errors.
 */
export function friendlyBillingError(err: unknown): string {
  if (err instanceof BillingError) return err.message;
  if (err instanceof Error) return err.message;
  return 'An unexpected billing error occurred. Please try again.';
}

/**
 * Determine whether an error is worth retrying (with backoff).
 * Used by the renewal scheduler and the client retry logic.
 */
export function isRetryableBillingError(err: unknown): boolean {
  if (err instanceof BillingError) return err.retryable;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed')
    );
  }
  return false;
}
