/**
 * billing-grace-expiry — daily scheduled trigger (3:00 AM IST).
 *
 * Suspends subscriptions that are past-due beyond their grace period.
 *
 * Grace window: 7 days past `currentPeriodEnd` (configurable per-org via
 * `subscription.graceDays`). At expiry, the subscription is marked
 * `suspended`, the org's `planId` is downgraded to `free`, and all member
 * users receive a `subscription-suspended` notification.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { adminDb } from '../admin';

const DEFAULT_GRACE_DAYS = 7;

export const billingGraceExpiry = onSchedule(
  {
    schedule: '0 3 * * *',
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    try {
      // Subscriptions in `past_due` or `renewing` that have lapsed their period end.
      const snap = await adminDb
        .collection('orgs')
        .where('subscription.status', 'in', ['past_due', 'renewing', 'active'])
        .where('subscription.currentPeriodEnd', '<', now)
        .get();

      let suspended = 0;
      let stillInGrace = 0;
      let failed = 0;

      for (const orgDoc of snap.docs) {
        const orgId = orgDoc.id;
        const data = orgDoc.data() as {
          name?: string;
          subscription?: {
            currentPeriodEnd?: number;
            graceDays?: number;
            planId?: string;
            providerSubscriptionId?: string;
          };
        };
        const sub = data.subscription;
        if (!sub?.currentPeriodEnd) continue;

        const graceDays = sub.graceDays ?? DEFAULT_GRACE_DAYS;
        const graceUntil = sub.currentPeriodEnd + graceDays * DAY_MS;
        if (now < graceUntil) {
          stillInGrace++;
          continue;
        }

        try {
          await adminDb.doc(`orgs/${orgId}`).update({
            'subscription.status': 'suspended',
            'subscription.suspendedAt': now,
            planId: 'free',
            updatedAt: now,
          });

          // Notify all members.
          const membersSnap = await adminDb
            .collection(`orgs/${orgId}/members`)
            .where('status', '==', 'active')
            .get();
          const batch = adminDb.batch();
          for (const m of membersSnap.docs) {
            const memberUid = m.id;
            batch.create(
              adminDb.collection(`users/${memberUid}/notifications`).doc(),
              {
                type: 'subscription-suspended',
                title: 'Subscription suspended',
                body: `Your workspace "${data.name ?? orgId}" was suspended after the grace period ended. Update billing to restore access.`,
                read: false,
                orgId,
                createdAt: now,
              },
            );
          }
          await batch.commit();

          await adminDb.collection(`orgs/${orgId}/auditLogs`).add({
            orgId,
            actorUid: null,
            actorEmail: null,
            action: 'subscription.suspended',
            targetType: 'subscription',
            targetId: sub.providerSubscriptionId ?? null,
            metadata: {
              planId: sub.planId,
              graceDays,
              periodEnd: sub.currentPeriodEnd,
            },
            timestamp: now,
          });
          suspended++;
        } catch (err) {
          logger.error(`billingGraceExpiry: org ${orgId} failed`, err);
          failed++;
        }
      }

      logger.info(
        `billingGraceExpiry: suspended=${suspended} inGrace=${stillInGrace} failed=${failed}`,
      );
    } catch (err) {
      logger.error('billingGraceExpiry: fatal', err);
      throw err;
    }
  },
);
