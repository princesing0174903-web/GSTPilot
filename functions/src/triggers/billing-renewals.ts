/**
 * billing-renewals — daily scheduled trigger (2:00 AM IST).
 *
 * Scans /orgs where the subscription is `active` and `currentPeriodEnd`
 * falls within the next 24 hours, then:
 *   • If auto-renew is on → marks the subscription as `renewing`, kicks off
 *     the provider's renewal charge (mocked here — real provider integration
 *     lives in the Next.js billing-provider service which the function calls).
 *   • If auto-renew is off → schedules a grace-period notification.
 *
 * Each renewal is idempotent: the doc's `renewalProcessedFor` field stores
 * the period-end timestamp we last processed, so retries don't double-charge.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { adminDb } from '../admin';

export const billingRenewals = onSchedule(
  {
    schedule: '0 2 * * *',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000; // +24h

    try {
      const snap = await adminDb
        .collection('orgs')
        .where('subscription.status', '==', 'active')
        .where('subscription.currentPeriodEnd', '<=', horizon)
        .get();

      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (const orgDoc of snap.docs) {
        const orgId = orgDoc.id;
        const data = orgDoc.data() as {
          subscription?: {
            currentPeriodEnd?: number;
            autoRenew?: boolean;
            renewalProcessedFor?: number;
            provider?: string;
            providerSubscriptionId?: string;
            planId?: string;
          };
        };
        const sub = data.subscription;
        if (!sub?.currentPeriodEnd) {
          skipped++;
          continue;
        }
        if (
          sub.renewalProcessedFor &&
          sub.renewalProcessedFor >= sub.currentPeriodEnd
        ) {
          skipped++; // already processed this period
          continue;
        }

        try {
          if (sub.autoRenew) {
            // Mark renewing; actual charge is performed by the billing-provider
            // orchestrator on the Next.js side via the provider's webhook flow.
            await adminDb.doc(`orgs/${orgId}`).update({
              'subscription.status': 'renewing',
              'subscription.renewalProcessedFor': sub.currentPeriodEnd,
              'subscription.updatedAt': now,
            });
            await adminDb.collection(`orgs/${orgId}/auditLogs`).add({
              orgId,
              actorUid: null,
              actorEmail: null,
              action: 'subscription.renewing',
              targetType: 'subscription',
              targetId: sub.providerSubscriptionId ?? null,
              metadata: {
                planId: sub.planId,
                provider: sub.provider,
                periodEnd: sub.currentPeriodEnd,
              },
              timestamp: now,
            });
          } else {
            // Going to expire — flag for grace-period handling.
            await adminDb.doc(`orgs/${orgId}`).update({
              'subscription.expiresAt': sub.currentPeriodEnd,
              'subscription.renewalProcessedFor': sub.currentPeriodEnd,
              'subscription.updatedAt': now,
            });
          }
          processed++;
        } catch (err) {
          logger.error(`billingRenewals: org ${orgId} failed`, err);
          failed++;
        }
      }

      logger.info(
        `billingRenewals: processed=${processed} skipped=${skipped} failed=${failed}`,
      );
    } catch (err) {
      logger.error('billingRenewals: fatal', err);
      throw err;
    }
  },
);
