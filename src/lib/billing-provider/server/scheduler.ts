// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot Billing™ — Background Scheduler (SERVER-ONLY)
//
// Manages billing background operations:
//   • Renewals due: subscriptions past their period end + auto-renew=true
//   • Grace period expirations: past-due subscriptions past their grace period
//   • Failed payment retries: re-attempt failed payments on the retry schedule
//
// Every job runs in the orchestrator (which is server-only). The scheduler is
// SERVER-ONLY because it imports the orchestrator. API routes are the only
// legitimate consumers.
//
// Architecture note: in production you'd run this as a Cloud Function / cron
// worker. In the sandbox we use an in-memory interval (5 minutes) that's
// started on first API hit and runs for the process lifetime.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  processRenewalsDue,
  processGracePeriodExpirations,
  processFailedPaymentRetries,
} from './orchestrator';
import { friendlyBillingError } from '../errors';

// ─── Background billing (in-memory interval) ──────────────────────────────────

let intervalHandle: NodeJS.Timeout | null = null;
const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (300s)

/**
 * Start the background billing interval. Idempotent — calling it multiple
 * times is safe; only the first call starts the interval.
 *
 * Each tick:
 *   1. processRenewalsDue() — auto-renew subscriptions past their period end
 *   2. processGracePeriodExpirations() — suspend past-due subscriptions past grace
 *   3. processFailedPaymentRetries() — retry failed payments on schedule
 */
export function startBackgroundBilling(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(async () => {
    try {
      const renewals = await processRenewalsDue();
      const graceExpirations = await processGracePeriodExpirations();
      const retries = await processFailedPaymentRetries();

      if (
        renewals.processed > 0 ||
        renewals.failed > 0 ||
        graceExpirations.suspended > 0 ||
        retries.retried > 0
      ) {
        console.log(
          `[billing-scheduler] tick: renewals { processed: ${renewals.processed}, failed: ${renewals.failed} }, ` +
            `grace expirations { suspended: ${graceExpirations.suspended} }, ` +
            `retries { retried: ${retries.retried}, succeeded: ${retries.succeeded} }`,
        );
      }
    } catch (err) {
      console.warn('[billing-scheduler] background tick failed:', friendlyBillingError(err));
    }
  }, TICK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
  console.log('[billing-scheduler] background billing started (5min interval)');
}

/**
 * Stop the background billing interval. Mostly useful for tests.
 */
export function stopBackgroundBilling(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/**
 * Manually trigger a renewal for a specific organization.
 * Useful for testing or for "renew now" buttons in the admin UI.
 *
 * Note: this just runs the renewal check across all orgs. For a specific
 * org renewal, use the orchestrator's `renewSubscription` (not exported here).
 */
export async function runManualRenewal(
  organizationId: string,
): Promise<{ ok: true }> {
  // The orchestrator's processRenewalsDue() processes all orgs. For an
  // org-specific renewal, we'd need to extend the orchestrator with a
  // renewSubscriptionForOrg() function. For now, we just run the global check.
  void organizationId; // reserved for future per-org renewal
  await processRenewalsDue();
  return { ok: true };
}

/**
 * Manually trigger a failed-payment retry for a specific org + payment.
 * Useful for "retry now" buttons in the admin UI.
 */
export async function runFailedPaymentRetry(
  organizationId: string,
  paymentId: string,
): Promise<{ ok: true }> {
  // Same caveat as runManualRenewal — the orchestrator processes globally.
  // For a specific payment retry, the orchestrator would need a per-payment
  // retry function. For now, we just run the global check.
  void organizationId; // reserved for future per-payment retry
  void paymentId;
  await processFailedPaymentRetries();
  return { ok: true };
}
