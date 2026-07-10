// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Billing Engine (SERVER-ONLY, pure functions)
//
// Pure functions for billing calculations: proration, renewals, grace periods,
// trials, MRR/ARR, failed-payment retry schedules, coupon application.
//
// All functions are PURE (no Firebase, no side effects). Inputs/outputs are
// plain values. Safe to import from both orchestrator and scheduler.
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  BillingCycle,
  Coupon,
  Subscription,
  SubscriptionPlanId,
} from '../types';
import { getPlan, getPlanPrice } from './plans';
import { ProrationError } from '../errors';

// ─── Proration ────────────────────────────────────────────────────────────────

/**
 * Calculate the proration amounts when changing plans mid-cycle.
 *
 * @param oldPlanId - The current plan
 * @param newPlanId - The new plan
 * @param oldCycle  - The current billing cycle
 * @param newCycle  - The new billing cycle
 * @param daysRemaining - Days remaining in the current period
 * @param daysInPeriod  - Total days in the current period
 * @returns refundAmount (unused time on old plan), chargeAmount (prorated new plan), netAmount (charge - refund)
 */
export function calculateProration(
  oldPlanId: SubscriptionPlanId,
  newPlanId: SubscriptionPlanId,
  oldCycle: BillingCycle,
  newCycle: BillingCycle,
  daysRemaining: number,
  daysInPeriod: number,
): { refundAmount: number; chargeAmount: number; netAmount: number } {
  if (daysInPeriod <= 0) {
    throw new ProrationError('daysInPeriod must be greater than 0.');
  }
  if (daysRemaining < 0) {
    throw new ProrationError('daysRemaining cannot be negative.');
  }
  if (daysRemaining > daysInPeriod) {
    throw new ProrationError('daysRemaining cannot exceed daysInPeriod.');
  }

  const oldPrice = getPlanPrice(oldPlanId, oldCycle);
  const newPrice = getPlanPrice(newPlanId, newCycle);

  // Refund for unused time on the old plan.
  const refundAmount = round2((oldPrice * daysRemaining) / daysInPeriod);

  // Charge for the remaining time on the new plan.
  const chargeAmount = round2((newPrice * daysRemaining) / daysInPeriod);

  // Net amount: positive = charge customer, negative = refund customer.
  const netAmount = round2(chargeAmount - refundAmount);

  return { refundAmount, chargeAmount, netAmount };
}

// ─── Renewal & Period Dates ───────────────────────────────────────────────────

/**
 * Calculate the next renewal date for a subscription.
 * Monthly cycle → +30 days; Yearly cycle → +365 days.
 */
export function calculateRenewalDate(subscription: Subscription): Date {
  return calculateNextBillingDate(new Date(subscription.currentPeriodEnd), subscription.billingCycle);
}

/**
 * Calculate the grace period end date after a failed payment (14 days).
 */
export function calculateGracePeriodEnd(failedPaymentDate: Date): Date {
  return new Date(failedPaymentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
}

/**
 * Calculate the trial end date.
 */
export function calculateTrialEnd(startDate: Date, trialDays: number): Date {
  return new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000);
}

/**
 * Calculate the next billing date based on cycle.
 * Monthly → +30 days; Yearly → +365 days.
 */
export function calculateNextBillingDate(currentPeriodEnd: Date, cycle: BillingCycle): Date {
  const days = cycle === 'yearly' ? 365 : 30;
  return new Date(currentPeriodEnd.getTime() + days * 24 * 60 * 60 * 1000);
}

// ─── MRR / ARR ────────────────────────────────────────────────────────────────

/**
 * Calculate Monthly Recurring Revenue for a subscription.
 * Yearly prices are divided by 12. Coupon discounts are applied.
 */
export function calculateMRR(
  planId: SubscriptionPlanId,
  cycle: BillingCycle,
  coupon?: Coupon | null,
): number {
  const plan = getPlan(planId);
  if (!plan) return 0;

  // Monthly price equivalent (yearly is divided by 12).
  const baseMonthly = cycle === 'yearly' ? plan.priceYearly / 12 : plan.priceMonthly;
  if (!coupon) return round2(baseMonthly);

  // Apply coupon discount.
  const { finalAmount } = applyCouponToAmount(baseMonthly, coupon);
  return round2(finalAmount);
}

/**
 * Calculate Annual Recurring Revenue from MRR (MRR * 12).
 */
export function calculateARR(mrr: number): number {
  return round2(mrr * 12);
}

// ─── Grace Period & Suspension ────────────────────────────────────────────────

/**
 * Whether a subscription should enter the grace period after a failed payment.
 * Returns true if the subscription is active (not already past_due/cancelled).
 */
export function shouldEnterGracePeriod(
  subscription: Subscription,
  _failedPaymentDate: Date,
): boolean {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

/**
 * Whether a subscription should be suspended (grace period has expired).
 */
export function shouldSuspendSubscription(gracePeriodEnd: Date): boolean {
  return new Date() > gracePeriodEnd;
}

// ─── Failed Payment Retry Schedule ────────────────────────────────────────────

/**
 * Retry schedule for failed payments — exponential backoff.
 *   Attempt 1 → immediate
 *   Attempt 2 → +1 day
 *   Attempt 3 → +3 days
 *   Attempt 4 → +7 days
 *   Attempt 5 → +14 days
 *   Attempt 6+ → give up (return null)
 */
export function calculateFailedPaymentRetrySchedule(
  attemptNumber: number,
): { delayMs: number; nextAttemptAt: Date | null } {
  const delays = [
    0,                       // attempt 1: immediate
    1 * 24 * 60 * 60 * 1000,  // attempt 2: +1 day
    3 * 24 * 60 * 60 * 1000,  // attempt 3: +3 days
    7 * 24 * 60 * 60 * 1000,  // attempt 4: +7 days
    14 * 24 * 60 * 60 * 1000, // attempt 5: +14 days
  ];

  if (attemptNumber < 1) {
    return { delayMs: 0, nextAttemptAt: new Date() };
  }
  if (attemptNumber > delays.length) {
    return { delayMs: 0, nextAttemptAt: null }; // give up
  }

  const delayMs = delays[attemptNumber - 1];
  const nextAttemptAt = new Date(Date.now() + delayMs);
  return { delayMs, nextAttemptAt };
}

// ─── Coupon Application ───────────────────────────────────────────────────────

/**
 * Apply a coupon to an amount.
 *   • 'percent'     → amount * (1 - value/100)
 *   • 'fixed'       → amount - value
 *   • 'free_months' → no discount on this invoice (handled at subscription level)
 *
 * Returns the discount amount and the final amount (never negative).
 */
export function applyCouponToAmount(
  amount: number,
  coupon: Coupon,
): { discountAmount: number; finalAmount: number } {
  let discountAmount = 0;
  switch (coupon.type) {
    case 'percent':
      discountAmount = (amount * coupon.value) / 100;
      break;
    case 'fixed':
      discountAmount = coupon.value;
      break;
    case 'free_months':
      // No discount on the current invoice — handled at subscription level
      // (the coupon effectively extends the subscription by N months).
      discountAmount = 0;
      break;
  }
  // Cap the discount at the amount.
  discountAmount = Math.min(discountAmount, amount);
  return {
    discountAmount: round2(discountAmount),
    finalAmount: round2(amount - discountAmount),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
