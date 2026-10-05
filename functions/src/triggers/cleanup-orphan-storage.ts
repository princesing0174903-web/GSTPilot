/**
 * cleanup-orphan-storage — weekly scheduled trigger (Sunday 4:00 AM IST).
 *
 * Scans the org-scoped Storage prefixes and deletes files that don't have a
 * matching Firestore document in /orgs/{orgId}/documents. This reclaims
 * space from abandoned uploads (failed document creation, cancelled onboarding,
 * etc.).
 *
 * Safety rails:
 *   • Only scans prefixes under `orgs/` — never touches system buckets.
 *   • Skips files newer than 7 days (gives the matching doc a chance to land).
 *   • Max 500 deletions per run (configurable) to stay within Cloud Functions
 *     memory/time budget — the rest will be picked up next week.
 *   • Every deletion is audit-logged.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { adminStorage, adminDb } from '../admin';

const MAX_DELETIONS_PER_RUN = 500;
const MIN_AGE_DAYS = 7;

export const cleanupOrphanStorage = onSchedule(
  {
    schedule: '0 4 * * 0', // Sunday 4:00 AM
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async () => {
    const now = Date.now();
    const minAgeMs = MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
    const bucket = adminStorage.bucket();

    let deleted = 0;
    let scanned = 0;
    let skipped = 0;

    try {
      const [files] = await bucket.getFiles({ prefix: 'orgs/' });

      for (const file of files) {
        if (deleted >= MAX_DELETIONS_PER_RUN) {
          logger.info(
            `cleanupOrphanStorage: hit MAX_DELETIONS_PER_RUN=${MAX_DELETIONS_PER_RUN}, stopping.`,
          );
          break;
        }
        scanned++;

        const meta = file.metadata;
        const updated = meta.updated ? Date.parse(meta.updated) : 0;
        if (updated && now - updated < minAgeMs) {
          skipped++;
          continue;
        }

        // Path shape: orgs/{orgId}/documents/{docId}/{filename}
        const parts = file.name.split('/');
        if (parts.length < 4 || parts[2] !== 'documents') {
          skipped++;
          continue;
        }
        const orgId = parts[1];
        const docId = parts[3];
        const docSnap = await adminDb.doc(`orgs/${orgId}/documents/${docId}`).get();
        if (docSnap.exists) {
          skipped++;
          continue;
        }

        try {
          await file.delete();
          await adminDb.collection(`orgs/${orgId}/auditLogs`).add({
            orgId,
            actorUid: null,
            actorEmail: null,
            action: 'storage.orphan_deleted',
            targetType: 'storage_object',
            targetId: file.name,
            metadata: { size: Number(meta.size ?? 0), updated },
            timestamp: now,
          });
          deleted++;
        } catch (err) {
          logger.warn(`cleanupOrphanStorage: failed to delete ${file.name}`, err);
        }
      }

      logger.info(
        `cleanupOrphanStorage: scanned=${scanned} deleted=${deleted} skipped=${skipped}`,
      );
    } catch (err) {
      logger.error('cleanupOrphanStorage: fatal', err);
      throw err;
    }
  },
);
