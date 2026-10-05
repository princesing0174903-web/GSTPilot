// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing, Subscriptions & Payments™ — Type Definitions
//
// The single source of truth for the billing / subscription / payment data model.
// Every field maps 1:1 to a Firestore collection. All types are PURE (no Firebase
// imports) so they are safe to import from both client and server code.
//
// Provider pattern:
//   • IPaymentProvider (see provider.ts) — the contract every payment backend implements
//   • MockRazorpayProvider   — deterministic simulated UPI/card/netbanking (default)
//   • MockStripeProvider     — deterministic simulated card payments (default-intl)
//   • FutureRazorpayProvider — Razorpay production (placeholder, throws NotImplementedError)
//   • FutureStripeProvider   — Stripe production   (placeholder, throws NotImplementedError)
//   • Switch to production later by changing ONE env var (PAYMENT_PROVIDER) in registry.ts
//
// Multi-tenant: every document carries `organizationId`. Every org-scoped query
// filters on it. Users can never access another organization's billing data.
//
// Security: payment session IDs / customer IDs / provider tokens / receipt data
// are encrypted with AES-256-GCM (server-only key) before being stored in
// Firestore. The client reads the encrypted blob and passes it back to the
// server during payment operations — the client can NEVER decrypt it.
//
// Money units: rupees (₹) as the base unit. Paise-level precision via round2.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Provider & Plan Identifiers ──────────────────────────────────────────────

export type PaymentProviderName =
  | 'mock-razorpay' // MockRazorpayProvider — UPI / card / netbanking (India-first, default)
  | 'mock-stripe'   // MockStripeProvider   — card payments (international)
  | 'razorpay'      // FutureRazorpayProvider — production Razorpay
  | 'stripe';       // FutureStripeProvider   — production Stripe

export type SubscriptionPlanId =
  | 'free'
  | 'starter'
  | 'professional'
  | 'business'
  | 'enterprise';

export type BillingCycle = 'monthly' | 'yearly';

export type SubscriptionStatus =
  | 'trialing'   // free trial active, no payment method
  | 'active'     // paid, current, in good standing
  | 'past_due'   // renewal payment failed, in grace period
  | 'paused'     // user-paused (no invoices, no usage)
  | 'cancelled'  // user cancelled (still active until period end)
  | 'expired';   // fully expired — no access

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'refunded';

export type InvoiceType =
  | 'tax_invoice'    // regular GST invoice for a subscription
  | 'receipt'        // payment confirmation
  | 'credit_note'    // refunds / downgrades
  | 'debit_note'     // additional charges
  | 'refund_receipt'; // refund confirmation

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type PaymentMethod =
  | 'card'
  | 'upi'
  | 'netbanking'
  | 'wallet'
  | 'emandate'
  | 'bank_transfer';

export type UsageMetricType =
  | 'oracle_requests'
  | 'storage_bytes'
  | 'ai_tokens'
  | 'invoices_generated'
  | 'returns_filed'
  | 'api_calls'
  | 'automation_runs';

export type CouponType = 'percent' | 'fixed' | 'free_months';

// ─── Subscription Plans (subscription_plans collection — GLOBAL) ──────────────

/**
 * A subscription tier — one row per plan. Stored in Firestore
 * `subscription_plans/{planId}` (e.g. `free`, `starter`, `professional`).
 *
 * GLOBAL collection: every authenticated user can read; only server-side
 * (Admin SDK / seed script) can write.
 */
export interface SubscriptionPlan {
  /** Doc id = plan slug. */
  id: string;
  /** Plan id (matches the doc id; exported for ergonomics). */
  planId: SubscriptionPlanId;
  /** Display name (e.g. 'Free', 'Starter', 'Professional'). */
  name: string;
  /** One-line marketing tagline. */
  tagline: string;
  /** Multi-line marketing description. */
  description: string;
  /** Monthly price in INR (₹0 = free). */
  priceMonthly: number;
  /** Yearly price in INR (≈ 10 × monthly — 2 months free). */
  priceYearly: number;
  /** Currency code (always 'INR' for now). */
  currency: 'INR';
  /** Trial period in days (14 for paid plans, 0 for Free). */
  trialDays: number;
  /** Human-readable feature list (for the pricing card). */
  features: string[];
  /** Hard usage limits — enforced by the Usage Meter. */
  limits: SubscriptionPlanLimits;
  /** Highlighted as "Most Popular" in the pricing UI (Professional). */
  isPopular?: boolean;
  /** Sort order on the pricing page (0 = first). */
  sortOrder: number;
  /** Whether the plan is currently available for new subscriptions. */
  isActive: boolean;
  /** ISO timestamp the plan was created / last updated. */
  createdAt: string;
  updatedAt: string;
}

/**
 * Hard usage limits per plan. Each key is enforced by the Usage Meter.
 * Use Infinity for unlimited.
 */
export interface SubscriptionPlanLimits {
  /** Storage in bytes (Infinity = unlimited). */
  storageBytes: number;
  /** AI Oracle credits per month (Infinity = unlimited). */
  aiCreditsMonthly: number;
  /** Max team members (Infinity = unlimited). */
  teamMembers: number;
  /** Automation workflow runs per month (Infinity = unlimited). */
  automationRunsMonthly: number;
  /** API calls per month (Infinity = unlimited). */
  apiCallsMonthly: number;
  /** Invoices generated per month (Infinity = unlimited). */
  invoicesMonthly: number;
  /** GST returns filed per month (Infinity = unlimited). */
  returnsMonthly: number;
  /** Oracle chat / analysis requests per month (Infinity = unlimited). */
  oracleRequestsMonthly: number;
}

// ─── Subscriptions (subscriptions collection — ORG-SCOPED) ────────────────────

/**
 * The active subscription document for an organization — one per org.
 * Stored in Firestore `subscriptions/{subscriptionId}`.
 */
export interface Subscription {
  id: string;
  /** Tenant scope — NEVER null. Every query filters on this. */
  organizationId: string;
  /** Plan id (e.g. 'professional'). */
  planId: SubscriptionPlanId;
  /** Snapshot of the plan name at subscription time (for historical display). */
  planName: string;
  /** Billing cycle. */
  billingCycle: BillingCycle;
  /** Current status — drives access. */
  status: SubscriptionStatus;
  /** ISO timestamp the subscription started. */
  startDate: string;
  /** ISO timestamp the subscription ends (cancellation or final renewal). */
  endDate: string | null;
  /** ISO timestamp when the trial ends (null if no trial). */
  trialEndDate: string | null;
  /** ISO timestamp when the subscription was cancelled (null if not cancelled). */
  cancelledAt: string | null;
  /** ISO timestamp when the subscription was paused (null if not paused). */
  pausedAt: string | null;
  /** ISO timestamp the current billing period started. */
  currentPeriodStart: string;
  /** ISO timestamp the current billing period ends (renews here if active). */
  currentPeriodEnd: string;
  /** ISO timestamp when the grace period ends (if past_due). */
  gracePeriodEnd: string | null;
  /**
   * Payment provider customer ID. The raw value lives only server-side in
   * BillingAccount.encryptedCustomerId; this field is kept in sync for
   * denormalized queries but should never contain anything sensitive.
   */
  customerId: string;
  /** Payment provider servicing this subscription. */
  paymentProvider: PaymentProviderName;
  /** Default payment method (null if none saved). */
  defaultPaymentMethod: PaymentMethod | null;
  /** Applied coupon code (for display). */
  couponCode: string | null;
  /** Discount percentage from the applied coupon (0 if none). */
  couponDiscountPercent: number;
  /** Monthly recurring revenue (in INR). */
  mrr: number;
  /** Annual recurring revenue (in INR). */
  arr: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Billing Accounts (billing_accounts collection — ORG-SCOPED) ─────────────

/**
 * The billing account document — one per organization. Stores the customer ID
 * at the payment provider + an AES-256-GCM encrypted blob of provider-side
 * metadata. Stored in Firestore `billing_accounts/{accountId}`.
 */
export interface BillingAccount {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** Subscription id this account belongs to (null before subscription created). */
  subscriptionId: string | null;
  /** Customer contact email. */
  email: string;
  /** Customer contact phone (null if none). */
  phone: string | null;
  /** Customer GSTIN (for tax invoices). */
  gstin: string | null;
  /** Billing address (Indian format). */
  billingAddress: BillingAddress;
  /** Tax id (PAN / GSTIN — for invoices). */
  taxId: string | null;
  /**
   * AES-256-GCM encrypted provider customer ID. Org members can READ this
   * field (rules allow it) but they CANNOT decrypt it without the server-only
   * master key.
   */
  encryptedCustomerId: string | null;
  /**
   * AES-256-GCM encrypted blob of provider tokens / payment-method references.
   */
  encryptedProviderTokens: string | null;
  /** Payment provider this account is registered with. */
  paymentProvider: PaymentProviderName | null;
  /** Default payment method (null if none saved). */
  defaultPaymentMethod: PaymentMethod | null;
  /** Whether the subscription auto-renews on period end. */
  autoRenew: boolean;
  /** Whether the customer is tax-exempt (no GST charged). */
  taxExempt: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Billing address (Indian format). */
export interface BillingAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// ─── Invoices (billing_invoices collection — ORG-SCOPED) ─────────────────────

/**
 * A single line item on a billing invoice.
 */
export interface BillingInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxable: boolean;
  hsnCode: string | null;
}

/**
 * The billing invoice document — one per billing period per subscription.
 * Stored in Firestore `billing_invoices/{invoiceId}`.
 */
export interface BillingInvoice {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** Subscription this invoice belongs to. */
  subscriptionId: string;
  /** Invoice number (e.g. `GSTP/2024/01/00001`). */
  invoiceNumber: string;
  /** Document type — see InvoiceType. */
  type: InvoiceType;
  /** Current status. */
  status: InvoiceStatus;
  /** ISO timestamp the invoice was issued. */
  issueDate: string;
  /** ISO timestamp the invoice is due. */
  dueDate: string;
  /** ISO timestamp the invoice was fully paid (null if unpaid). */
  paidDate: string | null;
  /** ISO timestamp the billing period started. */
  periodStart: string;
  /** ISO timestamp the billing period ended. */
  periodEnd: string;
  /** Line items. */
  lineItems: BillingInvoiceLineItem[];
  /** Subtotal in INR (Σ lineItems.amount). */
  subtotal: number;
  /** Discount in INR (from applied coupon, if any). */
  discount: number;
  /** Tax (GST) in INR. */
  tax: number;
  /** GST breakdown by component. */
  taxBreakdown: { cgst: number; sgst: number; igst: number; cess: number };
  /** Total in INR (subtotal − discount + tax). */
  total: number;
  /** Amount paid in INR. */
  amountPaid: number;
  /** Balance due in INR (total − amountPaid). */
  amountDue: number;
  /** Currency code (always 'INR'). */
  currency: 'INR';
  /** Notes shown on the invoice. */
  notes: string | null;
  /** Applied coupon code (for display). */
  couponCode: string | null;
  /** Original invoice this document references (for credit/debit notes). */
  linkedInvoiceId: string | null;
  /** True when the PDF has been generated and pdfPath is valid. */
  pdfReady: boolean;
  /** URL / path to the PDF (null until generated). */
  pdfPath: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Payments (payments collection — ORG-SCOPED) ─────────────────────────────

/**
 * A single payment — one per invoice payment attempt that succeeded (or one
 * per refund). Stored in Firestore `payments/{paymentId}`.
 */
export interface Payment {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** Subscription this payment is for (denormalized for queries). */
  subscriptionId: string;
  /** Invoice this payment is for (null for one-off charges). */
  invoiceId: string | null;
  /** Amount in INR. */
  amount: number;
  /** Currency code. */
  currency: 'INR';
  /** Payment status. */
  status: PaymentStatus;
  /** Payment provider that processed this payment. */
  provider: PaymentProviderName;
  /** Provider payment id (e.g. `pay_mock_rzp_xxx`, `pi_mock_stripe_xxx`). */
  providerPaymentId: string | null;
  /** Provider order / session id (e.g. `order_mock_rzp_xxx`). */
  providerOrderId: string | null;
  /** Payment method used. */
  method: PaymentMethod;
  /** Description (e.g. 'Professional Plan — Monthly'). */
  description: string | null;
  /** Failure reason (if status='failed'). */
  failureReason: string | null;
  /** Amount refunded (in INR) — sum of all refunds. */
  refundAmount: number;
  /** ISO timestamp the refund was processed (null if no refund). */
  refundedAt: string | null;
  /** ISO timestamp the payment was captured (null if not yet paid). */
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment Attempts (payment_attempts collection — ORG-SCOPED) ─────────────

/**
 * Every payment attempt is logged — successful or not — for retry logic,
 * fraud detection, and analytics. Stored in Firestore
 * `payment_attempts/{attemptId}`. A failed attempt that's later retried creates
 * a NEW attempt doc (with the same invoiceId).
 */
export interface PaymentAttempt {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** Payment id (null until the attempt succeeds). */
  paymentId: string | null;
  /** Subscription this attempt is for. */
  subscriptionId: string;
  /** Invoice this attempt is for. */
  invoiceId: string;
  /** Amount attempted in INR. */
  amount: number;
  /** Payment provider. */
  provider: PaymentProviderName;
  /** Attempt status. */
  status: 'initiated' | 'succeeded' | 'failed';
  /** Error code (if status='failed'). */
  errorCode: string | null;
  /** Error message (if status='failed'). */
  errorMessage: string | null;
  /** Provider request id (correlates with provider logs). */
  providerRequestId: string | null;
  /** Sequence number of this attempt (1 = first try, 2 = retry, etc.). */
  attemptNumber: number;
  createdAt: string;
}

// ─── Receipts (receipts collection — ORG-SCOPED) ─────────────────────────────

/**
 * A receipt — generated after a payment (or refund) succeeds. Distinct from an
 * invoice because the invoice is the bill; the receipt is the proof of payment.
 * Stored in Firestore `receipts/{receiptId}`.
 */
export interface Receipt {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** Payment this receipt is for. */
  paymentId: string;
  /** Invoice this receipt is for (null for non-invoice payments). */
  invoiceId: string | null;
  /** Receipt number (e.g. `RCT/2024/01/00001`). */
  receiptNumber: string;
  /** Amount in INR. */
  amount: number;
  /** Currency code. */
  currency: 'INR';
  /** Payment method (for display). */
  method: PaymentMethod;
  /** Payment provider that processed the underlying payment. */
  provider: PaymentProviderName;
  /** Issued-to details (the customer). */
  issuedTo: { name: string; email: string; phone: string | null };
  /** Notes. */
  notes: string | null;
  createdAt: string;
}

// ─── Coupons (coupons collection — GLOBAL or ORG-SCOPED) ─────────────────────

/**
 * A coupon / promo code. Stored in Firestore `coupons/{couponId}`.
 * organizationId = null means global coupon (system-wide). Otherwise org-private.
 */
export interface Coupon {
  id: string;
  /** Tenant scope — null = global coupon (system-wide). */
  organizationId: string | null;
  /** Display code (uppercased, e.g. `LAUNCH50`). */
  code: string;
  /** Discount type. */
  type: CouponType;
  /** Discount value (percent 0-100, fixed INR amount, or months free). */
  value: number;
  /** Currency code. */
  currency: 'INR';
  /** Max redemptions (Infinity = unlimited). */
  maxRedemptions: number;
  /** Number of times this coupon has been redeemed. */
  redemptionsCount: number;
  /** ISO timestamp the coupon becomes valid. */
  validFrom: string;
  /** ISO timestamp the coupon expires (null = never expires). */
  validUntil: string | null;
  /** Plans this coupon is valid for (or 'all'). */
  applicablePlans: SubscriptionPlanId[] | 'all';
  /** Whether this coupon is currently active. */
  isActive: boolean;
  /** Created by (admin). */
  createdBy: { uid: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

// ─── Usage Records (usage_records collection — ORG-SCOPED) ───────────────────

/**
 * A single usage event — one doc per event. Stored in Firestore
 * `usage_records/{recordId}`. Aggregated by month for limit enforcement.
 */
export interface UsageRecord {
  id: string;
  /** Tenant scope — NEVER null. */
  organizationId: string;
  /** Subscription this usage is for. */
  subscriptionId: string;
  /** Usage metric type. */
  metric: UsageMetricType;
  /** Amount consumed (e.g. 1 for one request, 1024 for KB of storage). */
  quantity: number;
  /** ISO timestamp the period started. */
  periodStart: string;
  /** ISO timestamp the period ended. */
  periodEnd: string;
  /** Arbitrary metadata (request id, file name, etc.). */
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Aggregated Billing Summary (for dashboard) ───────────────────────────────

/**
 * Aggregated billing state for the dashboard — computed from real-time
 * Firestore data. This is what `useBilling()` returns as `summary`.
 */
export interface BillingSummary {
  /** Current plan id (or null if no subscription). */
  currentPlan: SubscriptionPlanId | null;
  /** Current plan name (or null if no subscription). */
  planName: string | null;
  /** Current subscription status (or null if no subscription). */
  subscriptionStatus: SubscriptionStatus | null;
  /** Monthly recurring revenue (in INR). */
  mrr: number;
  /** Annual recurring revenue (in INR). */
  arr: number;
  /** ISO timestamp of the next renewal (or null). */
  nextRenewalDate: string | null;
  /** Days until the next renewal (or null). */
  daysToRenewal: number | null;
  /** Trial days remaining (or null if not trialing). */
  trialDaysLeft: number | null;
  /** Outstanding balance (in INR) — sum of unpaid invoices. */
  outstandingAmount: number;
  /** Number of failed payments in the last 30 days. */
  failedPayments: number;
  /** Usage for the current period, by metric. */
  usageThisPeriod: Record<UsageMetricType, number>;
  /** Plan limits (or null if no subscription / free plan limits unknown). */
  usageLimits: Record<UsageMetricType, number> | null;
  /** Usage percentage by metric (0..100; Infinity if limit is Infinity). */
  usagePercent: Record<UsageMetricType, number>;
  /** Most recent 10 invoices (for the dashboard feed). */
  recentInvoices: BillingInvoice[];
  /** Most recent 10 payments (for the dashboard feed). */
  recentPayments: Payment[];
  /** List of connected payment providers (e.g. ['mock-razorpay']). */
  connectedProviders: PaymentProviderName[];
}

// ─── Service Input / Result Types ─────────────────────────────────────────────

export interface CreateSubscriptionInput {
  organizationId: string;
  planId: SubscriptionPlanId;
  billingCycle: BillingCycle;
  couponCode?: string;
  createdBy: { uid: string; name: string; email: string };
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
}

export interface CreateSubscriptionResult {
  subscription: Subscription;
  billingAccount: BillingAccount;
  invoice: BillingInvoice | null;
  /** Payment session for the initial invoice (null for free plan / trial). */
  paymentSession: InitiatePaymentResult | null;
}

export interface UpgradePlanResult {
  subscription: Subscription;
  /** Proration invoice (debit or credit note) generated by the upgrade. */
  prorationInvoice: BillingInvoice | null;
  /** Amount to refund (in INR) — for downgrades. */
  refundAmount: number;
  /** Amount to charge (in INR) — for upgrades. */
  chargeAmount: number;
}

export interface CreateInvoiceInput {
  organizationId: string;
  subscriptionId: string;
  type: InvoiceType;
  /** Plan id (for tax invoices). */
  planId?: SubscriptionPlanId;
  billingCycle?: BillingCycle;
  periodStart: string;
  periodEnd: string;
  couponCode?: string;
  /** For credit/debit notes — the original invoice to reference. */
  linkedInvoiceId?: string;
  /** For credit/debit notes — the amount to credit/debit. */
  amount?: number;
  /** For credit/debit notes — the reason. */
  reason?: string;
  /** Organization state (for GST same-state vs inter-state). */
  organizationState?: string;
  /** Billing state (for GST same-state vs inter-state). */
  billingState?: string;
  createdBy: { uid: string; name: string; email: string };
}

export interface CreateInvoiceResult {
  invoice: BillingInvoice;
}

export interface RecordPaymentInput {
  organizationId: string;
  subscriptionId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  provider: PaymentProviderName;
  providerPaymentId?: string;
  providerOrderId?: string;
  description?: string;
}

export interface RecordPaymentResult {
  payment: Payment;
  invoice: BillingInvoice;
  receipt: Receipt;
}

export interface ApplyCouponInput {
  organizationId: string;
  subscriptionId: string;
  couponCode: string;
  appliedBy: { uid: string; name: string; email: string };
}

export interface ApplyCouponResult {
  coupon: Coupon;
  discountPercent: number;
  /** Discount amount in INR for the upcoming invoice. */
  discountAmount: number;
}

export interface CalculateTaxesInput {
  amount: number;
  organizationState?: string;
  billingState?: string;
  taxExempt?: boolean;
}

export interface CalculateTaxesResult {
  subtotal: number;
  taxBreakdown: { cgst: number; sgst: number; igst: number; cess: number };
  tax: number;
  total: number;
}

export interface InitiatePaymentInput {
  organizationId: string;
  subscriptionId: string;
  invoiceId: string;
  amount: number;
  description: string;
  method?: PaymentMethod;
  returnUrl: string;
}

export interface InitiatePaymentResult {
  orderId: string;
  paymentUrl: string | null;
  attemptId: string;
}

export interface CompletePaymentResult {
  payment: Payment | null;
  invoice: BillingInvoice | null;
  receipt: Receipt | null;
  /** True if the payment succeeded. */
  succeeded: boolean;
  /** Error message if the payment failed. */
  errorMessage: string | null;
}

export interface RefundPaymentInput {
  organizationId: string;
  paymentId: string;
  amount: number;
  reason?: string;
  refundedBy: { uid: string; name: string; email: string };
}

export interface RefundPaymentResult {
  refundPayment: Payment;
  refundReceipt: Receipt;
  creditNote: BillingInvoice;
}
