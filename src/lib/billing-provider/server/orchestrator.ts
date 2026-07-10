// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing, Subscriptions & Payments™ — Server Orchestrator (SERVER-ONLY)
//
// The thin server-side layer that:
//   1. Resolves the active payment provider via the registry
//   2. Encrypts / decrypts customer IDs + tokens with AES-256-GCM
//   3. Calls the provider and returns fully-formed Firestore-ready objects
//   4. Stamps every record with organizationId + subscriptionId + provider
//   5. Runs the billing engine (proration, MRR, grace periods, retries)
//   6. Generates invoices, receipts, credit notes via the invoice engine
//
// This file is SERVER-ONLY — it imports `node:crypto` (via the provider + crypto
// modules) and must NEVER be bundled into client code. API routes are the only
// legitimate consumers.
//
// Multi-tenant: every function takes `organizationId` and stamps it onto every
// returned object so the client can write directly to Firestore without
// additional processing.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as limitConstraint,
  serverTimestamp,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPaymentProvider, getPaymentProviderName } from './registry';
import { encryptConnection, encryptString, decryptConnection } from './crypto';
import type { ProviderCustomerSession } from '../provider';
import {
  calculateMRR,
  calculateARR,
  calculateProration,
  calculateRenewalDate,
  calculateGracePeriodEnd,
  calculateTrialEnd,
  calculateNextBillingDate,
  shouldEnterGracePeriod,
  calculateFailedPaymentRetrySchedule,
  applyCouponToAmount,
} from './billing-engine';
import {
  buildTaxInvoice,
  buildCreditNote,
  buildDebitNote,
  buildReceipt,
  buildRefundReceipt,
  calculateInvoiceTotals,
  markInvoiceAsPaid,
  markInvoiceAsVoid,
} from './invoice-engine';
import { getPlan, isPaidPlan, getPlanPrice, comparePlans } from './plans';
import type { Coupon, PaymentProviderName, SubscriptionPlanId } from '../types';
import {
  BillingAccountNotFoundError,
  BillingError,
  CouponExpiredError,
  CouponNotFoundError,
  CouponRedemptionExceededError,
  InvoiceAlreadyPaidError,
  InvoiceNotFoundError,
  PaymentDeclinedError,
  PaymentFailedError,
  PlanNotFoundError,
  PlanNotAvailableError,
  ProrationError,
  SubscriptionAlreadyExistsError,
  SubscriptionNotFoundError,
  ValidationError,
  friendlyBillingError,
} from '../errors';
import type {
  ApplyCouponInput,
  ApplyCouponResult,
  BillingAccount,
  BillingInvoice,
  CalculateTaxesInput,
  CalculateTaxesResult,
  CompletePaymentResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  InitiatePaymentInput,
  InitiatePaymentResult,
  Payment,
  PaymentAttempt,
  Receipt,
  RecordPaymentInput,
  RecordPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  Subscription,
  UpgradePlanResult,
} from '../types';

// ─── Org guard ───────────────────────────────────────────────────────────────

function assertOrg(orgId: string | undefined | null): void {
  if (!orgId) {
    throw new BillingError(
      'You must belong to an organization to manage billing.',
      { code: 'NO_ORGANIZATION', statusCode: 403 },
    );
  }
}

// ─── Subscription Lifecycle ────────────────────────────────────────────────────

/**
 * Create a new subscription for an organization.
 *
 * Steps:
 *   1. Validate the plan + cycle
 *   2. Resolve the payment provider via the registry
 *   3. Call provider.createCustomer() to register the customer
 *   4. Encrypt the customer ID + provider tokens (AES-256-GCM)
 *   5. Build the BillingAccount doc
 *   6. Build the Subscription doc (status='trialing' if trialDays>0 else 'active')
 *   7. Build the first BillingInvoice (tax_invoice) for paid plans
 *   8. Return everything for the API route to persist
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  assertOrg(input.organizationId);

  // Validate plan.
  const plan = getPlan(input.planId);
  if (!plan) {
    throw new PlanNotFoundError(`Plan ${input.planId} not found.`);
  }
  if (!plan.isActive) {
    throw new PlanNotAvailableError(`Plan ${input.planId} is not available.`);
  }
  if (!input.customerEmail || !input.customerEmail.includes('@')) {
    throw new ValidationError('A valid customer email is required.');
  }
  if (!input.customerName || input.customerName.trim().length < 2) {
    throw new ValidationError('Customer name must be at least 2 characters.');
  }

  // Check if org already has an active subscription (one per org).
  const existingSub = await findActiveSubscription(input.organizationId);
  if (existingSub) {
    throw new SubscriptionAlreadyExistsError();
  }

  // Resolve provider + create customer.
  const provider = getPaymentProvider();
  let customerId = '';
  let session: ProviderCustomerSession | null = null;
  let encryptedCustomerId: string | null = null;
  let encryptedProviderTokens: string | null = null;

  if (isPaidPlan(input.planId)) {
    try {
      const result = await provider.createCustomer({
        email: input.customerEmail,
        name: input.customerName,
        phone: input.customerPhone,
        organizationId: input.organizationId,
      });
      customerId = result.customerId;
      session = result.session;
      encryptedCustomerId = encryptString(customerId);
      encryptedProviderTokens = encryptConnection(session);
    } catch (err) {
      throw rethrowTyped(err);
    }
  }

  // Build the BillingAccount.
  const now = new Date().toISOString();
  const billingAccount: BillingAccount = {
    id: '', // Set by Firestore on save
    organizationId: input.organizationId,
    subscriptionId: null, // Set after subscription is created
    email: input.customerEmail,
    phone: input.customerPhone ?? null,
    gstin: null,
    billingAddress: {
      name: input.customerName,
      line1: '',
      line2: null,
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    },
    taxId: null,
    encryptedCustomerId,
    encryptedProviderTokens,
    paymentProvider: isPaidPlan(input.planId) ? provider.provider : null,
    defaultPaymentMethod: null,
    autoRenew: true,
    taxExempt: false,
    createdAt: now,
    updatedAt: now,
  };

  // Build the Subscription.
  const startDate = now;
  const trialEnd = plan.trialDays > 0 ? calculateTrialEnd(new Date(startDate), plan.trialDays).toISOString() : null;
  const periodEnd = calculateNextBillingDate(
    new Date(startDate),
    input.billingCycle,
  ).toISOString();
  const status: Subscription['status'] = trialEnd ? 'trialing' : isPaidPlan(input.planId) ? 'active' : 'active';

  // Look up coupon if provided.
  let couponCode: string | null = null;
  let couponDiscountPercent = 0;
  if (input.couponCode) {
    const coupon = await findCoupon(input.couponCode);
    if (coupon) {
      couponCode = coupon.code;
      couponDiscountPercent = coupon.type === 'percent' ? coupon.value : 0;
    }
  }

  const mrr = calculateMRR(input.planId, input.billingCycle);
  const arr = calculateARR(mrr);

  const subscription: Subscription = {
    id: '', // Set by Firestore on save
    organizationId: input.organizationId,
    planId: input.planId,
    planName: plan.name,
    billingCycle: input.billingCycle,
    status,
    startDate,
    endDate: null,
    trialEndDate: trialEnd,
    cancelledAt: null,
    pausedAt: null,
    currentPeriodStart: startDate,
    currentPeriodEnd: periodEnd,
    gracePeriodEnd: null,
    customerId,
    paymentProvider: provider.provider,
    defaultPaymentMethod: null,
    couponCode,
    couponDiscountPercent,
    mrr,
    arr,
    createdAt: now,
    updatedAt: now,
  };

  // Link subscription id to billing account.
  billingAccount.subscriptionId = subscription.id; // empty for now; API route sets it after persisting

  // Build the first invoice for paid plans (not for free / trialing).
  let invoice: BillingInvoice | null = null;
  let paymentSession: InitiatePaymentResult | null = null;

  if (isPaidPlan(input.planId) && status === 'active') {
    // Build the tax invoice.
    invoice = buildTaxInvoice({
      organizationId: input.organizationId,
      subscriptionId: subscription.id,
      type: 'tax_invoice',
      planId: input.planId,
      billingCycle: input.billingCycle,
      periodStart: startDate,
      periodEnd: periodEnd,
      couponCode: couponCode ?? undefined,
      createdBy: input.createdBy,
    });

    // Initiate the payment session.
    try {
      const sessionResult = await provider.createPaymentSession({
        customerId,
        amount: invoice.amountDue,
        currency: 'INR',
        description: `${plan.name} Plan — ${input.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
        invoiceId: invoice.id || 'pending',
        returnUrl: '', // Filled by the API route
      });
      paymentSession = {
        orderId: sessionResult.orderId,
        paymentUrl: sessionResult.paymentUrl ?? null,
        attemptId: '', // Set by API route when it persists the PaymentAttempt
      };
    } catch (err) {
      // Non-fatal: the invoice is still created; payment can be initiated later.
      console.warn('[billing/orchestrator] createPaymentSession failed:', friendlyBillingError(err));
    }
  }

  return {
    subscription,
    billingAccount,
    invoice,
    paymentSession,
  };
}

/**
 * Cancel a subscription.
 *   • immediately=true  → status='cancelled', cancelledAt=now
 *   • immediately=false → status='active' until period end, cancelledAt=periodEnd
 */
export async function cancelSubscription(
  organizationId: string,
  subscriptionId: string,
  immediately = false,
): Promise<Subscription> {
  assertOrg(organizationId);
  const subscription = await readSubscription(organizationId, subscriptionId);
  const now = new Date().toISOString();

  const updated: Subscription = {
    ...subscription,
    status: 'cancelled',
    cancelledAt: immediately ? now : subscription.currentPeriodEnd,
    endDate: immediately ? now : subscription.currentPeriodEnd,
    autoRenew: false,
    updatedAt: now,
  };

  // Persist.
  await updateDoc(doc(db, 'subscriptions', subscriptionId), {
    status: 'cancelled',
    cancelledAt: updated.cancelledAt,
    endDate: updated.endDate,
    autoRenew: false,
    updatedAt: serverTimestamp(),
  });

  return updated;
}

/**
 * Pause a subscription. The subscription is inactive but not cancelled — no
 * invoices are generated, no usage is metered, but the data is preserved.
 */
export async function pauseSubscription(
  organizationId: string,
  subscriptionId: string,
  reason?: string,
): Promise<Subscription> {
  assertOrg(organizationId);
  const subscription = await readSubscription(organizationId, subscriptionId);
  const now = new Date().toISOString();

  const updated: Subscription = {
    ...subscription,
    status: 'paused',
    pausedAt: now,
    updatedAt: now,
  };

  await updateDoc(doc(db, 'subscriptions', subscriptionId), {
    status: 'paused',
    pausedAt: now,
    updatedAt: serverTimestamp(),
  });

  if (reason) {
    console.log(`[billing] subscription ${subscriptionId} paused: ${reason}`);
  }

  return updated;
}

/**
 * Resume a paused subscription.
 */
export async function resumeSubscription(
  organizationId: string,
  subscriptionId: string,
): Promise<Subscription> {
  assertOrg(organizationId);
  const subscription = await readSubscription(organizationId, subscriptionId);
  const now = new Date().toISOString();

  const updated: Subscription = {
    ...subscription,
    status: 'active',
    pausedAt: null,
    updatedAt: now,
  };

  await updateDoc(doc(db, 'subscriptions', subscriptionId), {
    status: 'active',
    pausedAt: null,
    updatedAt: serverTimestamp(),
  });

  return updated;
}

/**
 * Upgrade (or downgrade) a subscription plan.
 *
 *   • Upgrades (new plan > old plan): charge a prorated debit note for the
 *     remaining period.
 *   • Downgrades (new plan < old plan): issue a prorated credit note for the
 *     unused time.
 *
 * Returns the updated subscription + the proration invoice (debit or credit
 * note) + the charge/refund amounts.
 */
export async function upgradePlan(
  organizationId: string,
  subscriptionId: string,
  newPlanId: SubscriptionPlanId,
  newCycle?: Subscription.BillingCycle,
  applyImmediately = true,
): Promise<UpgradePlanResult> {
  assertOrg(organizationId);
  const subscription = await readSubscription(organizationId, subscriptionId);
  const oldPlan = getPlan(subscription.planId);
  const newPlan = getPlan(newPlanId);
  if (!oldPlan) throw new PlanNotFoundError(`Plan ${subscription.planId} not found.`);
  if (!newPlan) throw new PlanNotFoundError(`Plan ${newPlanId} not found.`);
  if (!newPlan.isActive) throw new PlanNotAvailableError(`Plan ${newPlanId} is not available.`);

  const cycle = newCycle ?? subscription.billingCycle;
  const now = new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const daysInPeriod = Math.max(
    1,
    Math.round(
      (periodEnd.getTime() - new Date(subscription.currentPeriodStart).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  const daysRemaining = Math.max(
    0,
    Math.round((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );

  if (daysRemaining <= 0) {
    throw new ProrationError('The current billing period has already ended.');
  }

  const proration = calculateProration(
    subscription.planId,
    newPlanId,
    subscription.billingCycle,
    cycle,
    daysRemaining,
    daysInPeriod,
  );

  // Build the proration invoice (debit note for upgrades, credit note for downgrades).
  let prorationInvoice: BillingInvoice | null = null;
  const comparison = comparePlans(newPlanId, subscription.planId);

  if (applyImmediately && proration.netAmount !== 0) {
    // For upgrades: debit note (charge).
    // For downgrades: credit note (refund).
    if (comparison === 'higher') {
      // Look up the latest invoice to link.
      const latestInvoice = await findLatestInvoice(organizationId, subscriptionId);
      if (latestInvoice) {
        prorationInvoice = buildDebitNote(
          latestInvoice,
          proration.chargeAmount,
          `Upgrade from ${oldPlan.name} to ${newPlan.name} (prorated ${daysRemaining}/${daysInPeriod} days)`,
        );
        prorationInvoice.organizationId = organizationId;
      }
    } else if (comparison === 'lower') {
      const latestInvoice = await findLatestInvoice(organizationId, subscriptionId);
      if (latestInvoice) {
        prorationInvoice = buildCreditNote(
          latestInvoice,
          proration.refundAmount,
          `Downgrade from ${oldPlan.name} to ${newPlan.name} (prorated ${daysRemaining}/${daysInPeriod} days)`,
        );
        prorationInvoice.organizationId = organizationId;
      }
    }
  }

  // Update the subscription.
  const newMrr = calculateMRR(newPlanId, cycle);
  const newArr = calculateARR(newMrr);
  const newPeriodEnd = calculateNextBillingDate(
    applyImmediately ? now : periodEnd,
    cycle,
  ).toISOString();

  const updated: Subscription = {
    ...subscription,
    planId: newPlanId,
    planName: newPlan.name,
    billingCycle: cycle,
    mrr: newMrr,
    arr: newArr,
    currentPeriodStart: applyImmediately ? now.toISOString() : subscription.currentPeriodStart,
    currentPeriodEnd: newPeriodEnd,
    updatedAt: now.toISOString(),
  };

  await updateDoc(doc(db, 'subscriptions', subscriptionId), {
    planId: newPlanId,
    planName: newPlan.name,
    billingCycle: cycle,
    mrr: newMrr,
    arr: newArr,
    currentPeriodStart: updated.currentPeriodStart,
    currentPeriodEnd: newPeriodEnd,
    updatedAt: serverTimestamp(),
  });

  return {
    subscription: updated,
    prorationInvoice,
    refundAmount: proration.refundAmount,
    chargeAmount: proration.chargeAmount,
  };
}

/**
 * Downgrade a subscription plan. Same as upgradePlan — the difference is in
 * the proration direction (credit note vs debit note).
 */
export async function downgradePlan(
  organizationId: string,
  subscriptionId: string,
  newPlanId: SubscriptionPlanId,
  applyImmediately = false,
): Promise<UpgradePlanResult> {
  // Downgrades default to apply-at-period-end (applyImmediately=false).
  return upgradePlan(organizationId, subscriptionId, newPlanId, undefined, applyImmediately);
}

// ─── Invoice Operations ────────────────────────────────────────────────────────

/**
 * Create a new invoice (tax_invoice, credit_note, debit_note, refund_receipt).
 */
export async function createInvoice(
  input: CreateInvoiceInput,
): Promise<CreateInvoiceResult> {
  assertOrg(input.organizationId);
  let invoice: BillingInvoice;
  switch (input.type) {
    case 'tax_invoice':
      invoice = buildTaxInvoice(input);
      break;
    case 'credit_note': {
      if (!input.linkedInvoiceId) {
        throw new ValidationError('linkedInvoiceId is required for credit notes.');
      }
      const original = await readInvoice(input.organizationId, input.linkedInvoiceId);
      invoice = buildCreditNote(original, input.amount ?? 0, input.reason ?? 'Credit');
      break;
    }
    case 'debit_note': {
      if (!input.linkedInvoiceId) {
        throw new ValidationError('linkedInvoiceId is required for debit notes.');
      }
      const original = await readInvoice(input.organizationId, input.linkedInvoiceId);
      invoice = buildDebitNote(original, input.amount ?? 0, input.reason ?? 'Additional charge');
      break;
    }
    default:
      throw new ValidationError(`Unsupported invoice type: ${input.type}`);
  }
  return { invoice };
}

/**
 * Mark an invoice as paid + generate a receipt.
 */
export async function markInvoicePaid(
  organizationId: string,
  invoiceId: string,
  payment: Payment,
): Promise<BillingInvoice> {
  assertOrg(organizationId);
  const invoice = await readInvoice(organizationId, invoiceId);
  if (invoice.status === 'paid') {
    throw new InvoiceAlreadyPaidError();
  }
  const now = new Date().toISOString();
  const updated = markInvoiceAsPaid(invoice, payment, now);

  await updateDoc(doc(db, 'billing_invoices', invoiceId), {
    status: 'paid',
    amountPaid: updated.amountPaid,
    amountDue: updated.amountDue,
    paidDate: now,
    updatedAt: serverTimestamp(),
  });

  return updated;
}

// ─── Payment Operations ────────────────────────────────────────────────────────

/**
 * Record a payment (manual or provider-verified).
 *
 *   1. (Optional) Calls provider.verifyPayment if providerPaymentId + providerOrderId are given
 *   2. Creates the Payment doc
 *   3. Creates the PaymentAttempt doc
 *   4. Marks the linked invoice as paid
 *   5. Generates a Receipt
 *   6. Returns { payment, invoice, receipt }
 */
export async function recordPayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  assertOrg(input.organizationId);

  let verified = true;
  let providerPaymentId = input.providerPaymentId ?? null;
  let failureReason: string | null = null;

  // Verify the payment with the provider if both ids are present.
  if (input.providerOrderId && input.providerPaymentId) {
    const provider = getPaymentProvider(input.provider);
    try {
      const result = await provider.verifyPayment({
        orderId: input.providerOrderId,
        paymentId: input.providerPaymentId,
      });
      verified = result.succeeded;
      if (!verified) {
        failureReason = result.errorMessage ?? 'Payment verification failed.';
      }
    } catch (err) {
      throw rethrowTyped(err);
    }
  }

  const now = new Date().toISOString();
  const status: Payment['status'] = verified ? 'succeeded' : 'failed';

  const payment: Payment = {
    id: '', // Set by Firestore on save
    organizationId: input.organizationId,
    subscriptionId: input.subscriptionId,
    invoiceId: input.invoiceId,
    amount: input.amount,
    currency: 'INR',
    status,
    provider: input.provider,
    providerPaymentId,
    providerOrderId: input.providerOrderId ?? null,
    method: input.method,
    description: input.description ?? null,
    failureReason,
    refundAmount: 0,
    refundedAt: null,
    paidAt: verified ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  // Persist the Payment.
  const paymentRef = await addDoc(collection(db, 'payments'), {
    ...payment,
    organizationId: input.organizationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  payment.id = paymentRef.id;

  // Persist the PaymentAttempt.
  const attempt: PaymentAttempt = {
    id: '',
    organizationId: input.organizationId,
    paymentId: verified ? paymentRef.id : null,
    subscriptionId: input.subscriptionId,
    invoiceId: input.invoiceId,
    amount: input.amount,
    provider: input.provider,
    status: verified ? 'succeeded' : 'failed',
    errorCode: verified ? null : 'PAYMENT_FAILED',
    errorMessage: failureReason,
    providerRequestId: input.providerOrderId ?? null,
    attemptNumber: 1, // TODO: count prior attempts
    createdAt: now,
  };
  await addDoc(collection(db, 'payment_attempts'), {
    ...attempt,
    organizationId: input.organizationId,
    createdAt: serverTimestamp(),
  });

  // Mark the invoice as paid + generate receipt.
  let invoice: BillingInvoice | null = null;
  let receipt: Receipt | null = null;

  if (verified) {
    invoice = await markInvoicePaid(input.organizationId, input.invoiceId, payment);
    receipt = buildReceipt(payment, invoice);
    receipt.id = ''; // Set by Firestore on save
    await addDoc(collection(db, 'receipts'), {
      ...receipt,
      organizationId: input.organizationId,
      createdAt: serverTimestamp(),
    });
  }

  if (!invoice) {
    // Re-read for the return type.
    invoice = await readInvoice(input.organizationId, input.invoiceId);
  }
  if (!receipt) {
    receipt = buildReceipt(payment, invoice);
  }

  return { payment, invoice, receipt };
}

/**
 * Refund a payment (full or partial).
 *
 *   1. Calls provider.refundPayment
 *   2. Updates the original Payment (refundAmount, refundedAt, status)
 *   3. Creates a new Payment doc (the refund itself, status='refunded')
 *   4. Generates a refund Receipt
 *   5. Creates a credit_note BillingInvoice linked to the original
 *   6. Returns { refundPayment, refundReceipt, creditNote }
 */
export async function refundPayment(
  input: RefundPaymentInput,
): Promise<RefundPaymentResult> {
  assertOrg(input.organizationId);
  const payment = await readPayment(input.organizationId, input.paymentId);
  if (payment.status !== 'succeeded' && payment.status !== 'partially_refunded') {
    throw new PaymentFailedError(
      `Payment ${input.paymentId} cannot be refunded (status: ${payment.status}).`,
    );
  }
  if (input.amount <= 0) {
    throw new ValidationError('Refund amount must be greater than 0.');
  }
  const maxRefund = payment.amount - payment.refundAmount;
  if (input.amount > maxRefund) {
    throw new ValidationError(
      `Refund amount exceeds refundable balance (max: ₹${maxRefund}).`,
    );
  }

  // Call the provider to issue the refund.
  const provider = getPaymentProvider(payment.provider);
  if (payment.providerPaymentId) {
    try {
      const result = await provider.refundPayment({
        providerPaymentId: payment.providerPaymentId,
        amount: input.amount,
        reason: input.reason,
      });
      if (!result.succeeded) {
        throw new PaymentFailedError(
          result.errorMessage ?? 'Refund failed at the provider.',
        );
      }
    } catch (err) {
      throw rethrowTyped(err);
    }
  }

  const now = new Date().toISOString();

  // Update the original payment.
  const newRefundAmount = payment.refundAmount + input.amount;
  const newStatus: Payment['status'] =
    newRefundAmount >= payment.amount ? 'refunded' : 'partially_refunded';
  await updateDoc(doc(db, 'payments', payment.id), {
    refundAmount: newRefundAmount,
    refundedAt: now,
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  // Create the refund Payment doc.
  const refundPaymentDoc: Payment = {
    id: '',
    organizationId: input.organizationId,
    subscriptionId: payment.subscriptionId,
    invoiceId: payment.invoiceId,
    amount: -input.amount, // Negative for refunds
    currency: 'INR',
    status: 'refunded',
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId,
    providerOrderId: payment.providerOrderId,
    method: payment.method,
    description: `Refund: ${input.reason ?? 'Customer requested'}`,
    failureReason: null,
    refundAmount: 0,
    refundedAt: now,
    paidAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const refundRef = await addDoc(collection(db, 'payments'), {
    ...refundPaymentDoc,
    organizationId: input.organizationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  refundPaymentDoc.id = refundRef.id;

  // Generate the refund receipt.
  const refundReceipt = buildRefundReceipt(payment, input.amount);
  refundReceipt.id = '';
  await addDoc(collection(db, 'receipts'), {
    ...refundReceipt,
    organizationId: input.organizationId,
    createdAt: serverTimestamp(),
  });

  // Generate the credit note linked to the original invoice.
  let creditNote: BillingInvoice;
  if (payment.invoiceId) {
    const originalInvoice = await readInvoice(input.organizationId, payment.invoiceId);
    creditNote = buildCreditNote(
      originalInvoice,
      input.amount,
      input.reason ?? 'Customer refund',
    );
    creditNote.id = '';
    await addDoc(collection(db, 'billing_invoices'), {
      ...creditNote,
      organizationId: input.organizationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    // No invoice linked — create a standalone credit note.
    creditNote = buildCreditNote(
      {
        id: '',
        organizationId: input.organizationId,
        subscriptionId: payment.subscriptionId,
        invoiceNumber: 'N/A',
        type: 'tax_invoice',
        status: 'paid',
        issueDate: now,
        dueDate: now,
        paidDate: now,
        periodStart: now,
        periodEnd: now,
        lineItems: [],
        subtotal: 0,
        discount: 0,
        tax: 0,
        taxBreakdown: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
        total: 0,
        amountPaid: 0,
        amountDue: 0,
        currency: 'INR',
        notes: null,
        couponCode: null,
        linkedInvoiceId: null,
        pdfReady: false,
        pdfPath: null,
        createdAt: now,
        updatedAt: now,
      },
      input.amount,
      input.reason ?? 'Customer refund',
    );
  }

  return {
    refundPayment: refundPaymentDoc,
    refundReceipt,
    creditNote,
  };
}

/**
 * Generate a receipt for a payment (manual trigger — usually receipts are
 * generated automatically by recordPayment).
 */
export async function generateReceipt(
  organizationId: string,
  paymentId: string,
  invoiceId?: string,
): Promise<Receipt> {
  assertOrg(organizationId);
  const payment = await readPayment(organizationId, paymentId);
  let invoice: BillingInvoice | null = null;
  if (invoiceId) {
    invoice = await readInvoice(organizationId, invoiceId);
  }
  const receipt = buildReceipt(payment, invoice);
  receipt.id = '';
  await addDoc(collection(db, 'receipts'), {
    ...receipt,
    organizationId,
    createdAt: serverTimestamp(),
  });
  return receipt;
}

// ─── Coupon Operations ────────────────────────────────────────────────────────

/**
 * Apply a coupon to a subscription.
 * Validates the coupon (active, not expired, under maxRedemptions,
 * applicablePlans), increments redemptionsCount, attaches to subscription +
 * upcoming invoice.
 */
export async function applyCoupon(
  input: ApplyCouponInput,
): Promise<ApplyCouponResult> {
  assertOrg(input.organizationId);
  const subscription = await readSubscription(input.organizationId, input.subscriptionId);
  const coupon = await findCoupon(input.couponCode);
  if (!coupon) {
    throw new CouponNotFoundError(`Coupon code ${input.couponCode} not found.`);
  }
  if (!coupon.isActive) {
    throw new CouponExpiredError('This coupon is no longer active.');
  }

  // Check expiry.
  if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
    throw new CouponExpiredError();
  }

  // Check redemption count.
  if (isFinite(coupon.maxRedemptions) && coupon.redemptionsCount >= coupon.maxRedemptions) {
    throw new CouponRedemptionExceededError();
  }

  // Check applicable plans.
  if (
    coupon.applicablePlans !== 'all' &&
    !coupon.applicablePlans.includes(subscription.planId)
  ) {
    throw new CouponNotFoundError(
      `Coupon ${coupon.code} is not applicable to the ${subscription.planId} plan.`,
    );
  }

  // Increment redemptions count.
  await updateDoc(doc(db, 'coupons', coupon.id), {
    redemptionsCount: coupon.redemptionsCount + 1,
    updatedAt: serverTimestamp(),
  });

  // Attach to subscription.
  const discountPercent = coupon.type === 'percent' ? coupon.value : 0;
  await updateDoc(doc(db, 'subscriptions', subscription.id), {
    couponCode: coupon.code,
    couponDiscountPercent: discountPercent,
    updatedAt: serverTimestamp(),
  });

  // Compute the discount amount for the upcoming invoice.
  const plan = getPlan(subscription.planId);
  const baseAmount = plan
    ? getPlanPrice(subscription.planId, subscription.billingCycle)
    : 0;
  const { discountAmount } = applyCouponToAmount(baseAmount, coupon);

  return {
    coupon: { ...coupon, redemptionsCount: coupon.redemptionsCount + 1 },
    discountPercent,
    discountAmount,
  };
}

// ─── Tax Calculation ──────────────────────────────────────────────────────────

/**
 * Calculate taxes for an amount (GST).
 */
export async function calculateTaxes(
  input: CalculateTaxesInput,
): Promise<CalculateTaxesResult> {
  assertOrg(input.organizationId ?? '');
  if (input.taxExempt) {
    return {
      subtotal: input.amount,
      taxBreakdown: { cgst: 0, sgst: 0, igst: 0, cess: 0 },
      tax: 0,
      total: input.amount,
    };
  }
  const totals = calculateInvoiceTotals(
    [
      {
        description: 'Taxable amount',
        quantity: 1,
        unitPrice: input.amount,
        amount: input.amount,
        taxable: true,
        hsnCode: '998314',
      },
    ],
    null,
    input.organizationState,
    input.billingState,
  );
  return {
    subtotal: totals.subtotal,
    taxBreakdown: totals.taxBreakdown,
    tax: totals.tax,
    total: totals.total,
  };
}

// ─── Payment Session Operations ───────────────────────────────────────────────

/**
 * Initiate a payment session for an invoice.
 *
 *   1. Reads the billing account to get the (encrypted) customer id
 *   2. Decrypts the customer id
 *   3. Calls provider.createPaymentSession
 *   4. Creates a PaymentAttempt doc (status='initiated')
 *   5. Returns { orderId, paymentUrl, attemptId }
 */
export async function initiatePayment(
  input: InitiatePaymentInput,
): Promise<InitiatePaymentResult> {
  assertOrg(input.organizationId);

  // Read the billing account.
  const account = await readBillingAccount(input.organizationId);
  if (!account.encryptedCustomerId) {
    throw new BillingAccountNotFoundError(
      'No payment provider customer is associated with this organization.',
    );
  }

  // Decrypt the customer id (server-only).
  const { decryptString } = await import('./crypto');
  const customerId = decryptString(account.encryptedCustomerId);

  // Call the provider.
  const provider = getPaymentProvider(account.paymentProvider ?? undefined);
  let sessionResult;
  try {
    sessionResult = await provider.createPaymentSession({
      customerId,
      amount: input.amount,
      currency: 'INR',
      description: input.description,
      invoiceId: input.invoiceId,
      method: input.method,
      returnUrl: input.returnUrl,
    });
  } catch (err) {
    throw rethrowTyped(err);
  }

  // Create the PaymentAttempt doc.
  const now = new Date().toISOString();
  const attemptRef = await addDoc(collection(db, 'payment_attempts'), {
    organizationId: input.organizationId,
    paymentId: null,
    subscriptionId: input.subscriptionId,
    invoiceId: input.invoiceId,
    amount: input.amount,
    provider: provider.provider,
    status: 'initiated',
    errorCode: null,
    errorMessage: null,
    providerRequestId: sessionResult.orderId,
    attemptNumber: 1,
    createdAt: serverTimestamp(),
  });

  return {
    orderId: sessionResult.orderId,
    paymentUrl: sessionResult.paymentUrl ?? null,
    attemptId: attemptRef.id,
  };
}

/**
 * Complete a payment after the customer returns from the hosted checkout.
 *
 *   1. Calls provider.verifyPayment
 *   2. If succeeded → recordPayment flow
 *   3. If failed → mark PaymentAttempt failed + schedule retry
 */
export async function completePayment(
  organizationId: string,
  orderId: string,
  paymentId: string,
  signature?: string,
): Promise<CompletePaymentResult> {
  assertOrg(organizationId);

  // Read the PaymentAttempt to get context.
  const attemptSnap = await getDocs(
    query(
      collection(db, 'payment_attempts'),
      where('organizationId', '==', organizationId),
      where('providerRequestId', '==', orderId),
      limitConstraint(1),
    ),
  );
  if (attemptSnap.empty) {
    throw new PaymentFailedError(`Payment attempt for order ${orderId} not found.`);
  }
  const attemptData = attemptSnap.docs[0].data() as Record<string, unknown>;
  const attemptId = attemptSnap.docs[0].id;

  const provider = getPaymentProvider(attemptData.provider as PaymentProviderName);

  let verified = false;
  let providerPaymentId = paymentId;
  let errorMessage: string | null = null;
  try {
    const result = await provider.verifyPayment({
      orderId,
      paymentId,
      signature,
    });
    verified = result.succeeded;
    providerPaymentId = result.providerPaymentId;
    if (!verified) {
      errorMessage = result.errorMessage ?? 'Payment verification failed.';
    }
  } catch (err) {
    if (err instanceof PaymentDeclinedError) {
      errorMessage = err.message;
    } else {
      throw rethrowTyped(err);
    }
  }

  // Update the attempt.
  await updateDoc(doc(db, 'payment_attempts', attemptId), {
    status: verified ? 'succeeded' : 'failed',
    paymentId: verified ? providerPaymentId : null,
    errorCode: verified ? null : 'PAYMENT_FAILED',
    errorMessage: verified ? null : errorMessage,
  });

  if (!verified) {
    return {
      payment: null,
      invoice: null,
      receipt: null,
      succeeded: false,
      errorMessage,
    };
  }

  // Record the payment (creates Payment + marks invoice paid + generates receipt).
  const result = await recordPayment({
    organizationId,
    subscriptionId: String(attemptData.subscriptionId ?? ''),
    invoiceId: String(attemptData.invoiceId ?? ''),
    amount: Number(attemptData.amount ?? 0),
    method: 'upi', // Default; provider.retrievePayment can refine this
    provider: attemptData.provider as PaymentProviderName,
    providerPaymentId,
    providerOrderId: orderId,
    description: 'Payment completed via hosted checkout',
  });

  return {
    payment: result.payment,
    invoice: result.invoice,
    receipt: result.receipt,
    succeeded: true,
    errorMessage: null,
  };
}

// ─── Billing Health & Scheduler Operations ────────────────────────────────────

/**
 * Get the billing health for an organization.
 */
export async function getBillingHealth(
  organizationId: string,
): Promise<{
  status: 'healthy' | 'past_due' | 'suspended' | 'cancelled' | 'none';
  daysToRenewal: number | null;
  outstandingAmount: number;
  failedPayments: number;
  gracePeriodEnd: string | null;
}> {
  assertOrg(organizationId);
  const subscription = await findActiveSubscription(organizationId);
  if (!subscription) {
    return {
      status: 'none',
      daysToRenewal: null,
      outstandingAmount: 0,
      failedPayments: 0,
      gracePeriodEnd: null,
    };
  }

  const now = new Date();
  const renewalDate = new Date(subscription.currentPeriodEnd);
  const daysToRenewal = Math.max(
    0,
    Math.round((renewalDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  );

  // Sum unpaid invoices.
  const invoices = await listInvoices(organizationId, subscription.id);
  const outstanding = invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + i.amountDue, 0);

  // Count failed payments in the last 30 days.
  const payments = await listPayments(organizationId, subscription.id);
  const failedPayments = payments.filter(
    (p) =>
      p.status === 'failed' &&
      new Date(p.createdAt).getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).length;

  let status: 'healthy' | 'past_due' | 'suspended' | 'cancelled';
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      status = 'healthy';
      break;
    case 'past_due':
      status = 'past_due';
      break;
    case 'paused':
      status = 'suspended';
      break;
    case 'cancelled':
      status = 'cancelled';
      break;
    case 'expired':
      status = 'suspended';
      break;
    default:
      status = 'healthy';
  }

  return {
    status,
    daysToRenewal,
    outstandingAmount: outstanding,
    failedPayments,
    gracePeriodEnd: subscription.gracePeriodEnd,
  };
}

/**
 * Process all subscriptions due for renewal (currentPeriodEnd < now AND
 * status='active' AND autoRenew=true).
 *
 * For each: creates a new tax_invoice + auto-charges via the provider.
 *
 * Used by the scheduler.
 */
export async function processRenewalsDue(): Promise<{
  processed: number;
  failed: number;
}> {
  const now = new Date().toISOString();
  // Find all active subscriptions past their period end.
  const snap = await getDocs(
    query(
      collection(db, 'subscriptions'),
      where('status', '==', 'active'),
      where('autoRenew', '==', true),
      where('currentPeriodEnd', '<=', now),
      limitConstraint(50),
    ),
  );

  let processed = 0;
  let failed = 0;
  for (const docSnap of snap.docs) {
    const sub = { id: docSnap.id, ...(docSnap.data() as Omit<Subscription, 'id'>) } as Subscription;
    try {
      await renewSubscription(sub);
      processed++;
    } catch (err) {
      console.warn(
        `[billing/orchestrator] renewal failed for ${sub.id}:`,
        friendlyBillingError(err),
      );
      failed++;
    }
  }
  return { processed, failed };
}

/**
 * Process grace period expirations — subscriptions past their grace period
 * get marked as 'cancelled' (or 'expired').
 */
export async function processGracePeriodExpirations(): Promise<{
  suspended: number;
}> {
  const now = new Date().toISOString();
  const snap = await getDocs(
    query(
      collection(db, 'subscriptions'),
      where('status', '==', 'past_due'),
      where('gracePeriodEnd', '<=', now),
      limitConstraint(50),
    ),
  );

  let suspended = 0;
  for (const docSnap of snap.docs) {
    await updateDoc(docSnap.ref, {
      status: 'cancelled',
      endDate: now,
      updatedAt: serverTimestamp(),
    });
    suspended++;
  }
  return { suspended };
}

/**
 * Process failed payment retries — find failed PaymentAttempts due for retry
 * and re-attempt them.
 */
export async function processFailedPaymentRetries(): Promise<{
  retried: number;
  succeeded: number;
}> {
  const now = new Date();
  // Find failed attempts with status='failed' and a retry scheduled.
  // (For simplicity, we just retry the most recent 10 failed attempts.)
  const snap = await getDocs(
    query(
      collection(db, 'payment_attempts'),
      where('status', '==', 'failed'),
      orderBy('createdAt', 'asc'),
      limitConstraint(10),
    ),
  );

  let retried = 0;
  let succeeded = 0;
  for (const docSnap of snap.docs) {
    const attempt = docSnap.data() as PaymentAttempt;
    const { nextAttemptAt } = calculateFailedPaymentRetrySchedule(attempt.attemptNumber + 1);
    if (!nextAttemptAt || nextAttemptAt > now) continue;

    // Re-attempt: re-call completePayment with the original order id.
    try {
      const result = await completePayment(
        attempt.organizationId,
        attempt.providerRequestId ?? '',
        '', // No new payment id; provider may regenerate one
      );
      retried++;
      if (result.succeeded) succeeded++;
    } catch (err) {
      console.warn(
        `[billing/orchestrator] retry failed for attempt ${attempt.id}:`,
        friendlyBillingError(err),
      );
    }
  }
  return { retried, succeeded };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function renewSubscription(subscription: Subscription): Promise<void> {
  const plan = getPlan(subscription.planId);
  if (!plan) throw new PlanNotFoundError(`Plan ${subscription.planId} not found.`);

  // Create the new invoice.
  const invoice = buildTaxInvoice({
    organizationId: subscription.organizationId,
    subscriptionId: subscription.id,
    type: 'tax_invoice',
    planId: subscription.planId,
    billingCycle: subscription.billingCycle,
    periodStart: subscription.currentPeriodEnd,
    periodEnd: calculateNextBillingDate(
      new Date(subscription.currentPeriodEnd),
      subscription.billingCycle,
    ).toISOString(),
    couponCode: subscription.couponCode ?? undefined,
    createdBy: { uid: 'system', name: 'System', email: 'system@gstpilot.test' },
  });
  invoice.id = '';
  await addDoc(collection(db, 'billing_invoices'), {
    ...invoice,
    organizationId: subscription.organizationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Auto-charge via the provider (if a saved payment method exists).
  // For the mock provider, this always succeeds (or fails 10% of the time).
  try {
    const session = await initiatePayment({
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      amount: invoice.amountDue,
      description: `Renewal: ${plan.name} Plan`,
      returnUrl: '',
    });
    // Immediately "complete" the payment (mock provider doesn't require customer interaction).
    await completePayment(
      subscription.organizationId,
      session.orderId,
      '', // mock provider generates the payment id internally
    );

    // Advance the subscription period.
    const newPeriodEnd = calculateNextBillingDate(
      new Date(subscription.currentPeriodEnd),
      subscription.billingCycle,
    ).toISOString();
    await updateDoc(doc(db, 'subscriptions', subscription.id), {
      currentPeriodStart: subscription.currentPeriodEnd,
      currentPeriodEnd: newPeriodEnd,
      status: 'active',
      gracePeriodEnd: null,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // Payment failed — enter grace period.
    const graceEnd = calculateGracePeriodEnd(new Date()).toISOString();
    await updateDoc(doc(db, 'subscriptions', subscription.id), {
      status: 'past_due',
      gracePeriodEnd: graceEnd,
      updatedAt: serverTimestamp(),
    });
    throw err;
  }
}

async function readSubscription(
  organizationId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const snap = await getDoc(doc(db, 'subscriptions', subscriptionId));
  if (!snap.exists()) {
    throw new SubscriptionNotFoundError(`Subscription ${subscriptionId} not found.`);
  }
  const data = snap.data() as Record<string, unknown>;
  if (data.organizationId !== organizationId) {
    throw new SubscriptionNotFoundError(
      `Subscription ${subscriptionId} does not belong to organization ${organizationId}.`,
    );
  }
  return { id: snap.id, ...(data as Omit<Subscription, 'id'>) };
}

async function findActiveSubscription(
  organizationId: string,
): Promise<Subscription | null> {
  const snap = await getDocs(
    query(
      collection(db, 'subscriptions'),
      where('organizationId', '==', organizationId),
      where('status', 'in', ['active', 'trialing', 'past_due', 'paused']),
      limitConstraint(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Subscription, 'id'>) };
}

async function readInvoice(
  organizationId: string,
  invoiceId: string,
): Promise<BillingInvoice> {
  const snap = await getDoc(doc(db, 'billing_invoices', invoiceId));
  if (!snap.exists()) {
    throw new InvoiceNotFoundError(`Invoice ${invoiceId} not found.`);
  }
  const data = snap.data() as Record<string, unknown>;
  if (data.organizationId !== organizationId) {
    throw new InvoiceNotFoundError(
      `Invoice ${invoiceId} does not belong to organization ${organizationId}.`,
    );
  }
  return { id: snap.id, ...(data as Omit<BillingInvoice, 'id'>) };
}

async function readPayment(
  organizationId: string,
  paymentId: string,
): Promise<Payment> {
  const snap = await getDoc(doc(db, 'payments', paymentId));
  if (!snap.exists()) {
    throw new InvoiceNotFoundError(`Payment ${paymentId} not found.`);
  }
  const data = snap.data() as Record<string, unknown>;
  if (data.organizationId !== organizationId) {
    throw new InvoiceNotFoundError(
      `Payment ${paymentId} does not belong to organization ${organizationId}.`,
    );
  }
  return { id: snap.id, ...(data as Omit<Payment, 'id'>) };
}

async function readBillingAccount(
  organizationId: string,
): Promise<BillingAccount> {
  const snap = await getDocs(
    query(
      collection(db, 'billing_accounts'),
      where('organizationId', '==', organizationId),
      limitConstraint(1),
    ),
  );
  if (snap.empty) {
    throw new BillingAccountNotFoundError();
  }
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<BillingAccount, 'id'>) };
}

async function findCoupon(code: string): Promise<Coupon | null> {
  const upperCode = code.toUpperCase().trim();
  const snap = await getDocs(
    query(
      collection(db, 'coupons'),
      where('code', '==', upperCode),
      limitConstraint(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Coupon, 'id'>) };
}

async function findLatestInvoice(
  organizationId: string,
  subscriptionId: string,
): Promise<BillingInvoice | null> {
  const snap = await getDocs(
    query(
      collection(db, 'billing_invoices'),
      where('organizationId', '==', organizationId),
      where('subscriptionId', '==', subscriptionId),
      orderBy('createdAt', 'desc'),
      limitConstraint(1),
    ),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<BillingInvoice, 'id'>) };
}

async function listInvoices(
  organizationId: string,
  subscriptionId: string,
): Promise<BillingInvoice[]> {
  const snap = await getDocs(
    query(
      collection(db, 'billing_invoices'),
      where('organizationId', '==', organizationId),
      where('subscriptionId', '==', subscriptionId),
      orderBy('createdAt', 'desc'),
      limitConstraint(50),
    ),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BillingInvoice, 'id'>),
  }));
}

async function listPayments(
  organizationId: string,
  subscriptionId: string,
): Promise<Payment[]> {
  const snap = await getDocs(
    query(
      collection(db, 'payments'),
      where('organizationId', '==', organizationId),
      where('subscriptionId', '==', subscriptionId),
      orderBy('createdAt', 'desc'),
      limitConstraint(50),
    ),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Payment, 'id'>),
  }));
}

/**
 * Wrap an unknown error in a typed BillingError if it isn't already one.
 */
function rethrowTyped(err: unknown): never {
  if (err instanceof BillingError) throw err;
  if (err instanceof Error) {
    throw new BillingError(err.message, {
      code: 'PROVIDER_ERROR',
      statusCode: 502,
      retryable: true,
      cause: err,
    });
  }
  throw new BillingError('An unknown error occurred while contacting the payment provider.', {
    code: 'UNKNOWN',
    statusCode: 500,
  });
}

// ─── Provider diagnostics ────────────────────────────────────────────────────

export async function providerHealthCheck(): Promise<{
  healthy: boolean;
  name: string;
  provider: PaymentProviderName;
  isLive: boolean;
}> {
  const p = getPaymentProvider();
  try {
    const healthy = await p.healthCheck();
    return { healthy, name: p.name, provider: p.provider, isLive: p.isLive };
  } catch {
    return { healthy: false, name: p.name, provider: p.provider, isLive: p.isLive };
  }
}

// ─── Type re-exports ─────────────────────────────────────────────────────────

export type {
  ApplyCouponInput,
  ApplyCouponResult,
  BillingAccount,
  BillingInvoice,
  CalculateTaxesInput,
  CalculateTaxesResult,
  CompletePaymentResult,
  CreateInvoiceInput,
  CreateInvoiceResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  InitiatePaymentInput,
  InitiatePaymentResult,
  Payment,
  PaymentAttempt,
  Receipt,
  RecordPaymentInput,
  RecordPaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  Subscription,
  UpgradePlanResult,
};
