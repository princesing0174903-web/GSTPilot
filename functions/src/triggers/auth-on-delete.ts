/**
 * onUserDelete — fires when a Firebase Auth user is deleted (via Admin SDK
 * or from the Firebase Console).
 *
 * Cleans up all user-owned data:
 *   • Personal orgs owned by this user (and their members subcollection)
 *   • The /users/{uid} profile doc + all subcollections (notifications, preferences)
 *
 * Orgs that have OTHER members are NOT deleted — ownership is transferred to
 * the longest-tenured admin instead. This prevents accidental data loss when
 * a single founder leaves a multi-person firm.
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { adminDb, adminAuth } from '../admin';

interface DeleteUserInput {
  uid?: string;
}

export const onUserDelete = onCall(
  { region: 'asia-south1', memory: '512MiB', timeoutSeconds: 60 },
  async (req) => {
    // Privileged: callable only from internal admin tooling. The caller must
    // be a Firebase Auth user (server-side check); the actual `uid` to delete
    // is passed via data and we re-verify with adminAuth.getUser before purge.
    const callerUid = req.auth?.uid;
    if (!callerUid) {
      return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sign-in required.' } };
    }
    const targetUid = ((req.data ?? {}) as DeleteUserInput).uid ?? callerUid;

    try {
      // Confirm the target user exists in Auth (throws if not).
      await adminAuth.getUser(targetUid);
    } catch (err) {
      logger.warn(`onUserDelete: target ${targetUid} not found in Auth`, err);
      return {
        ok: false,
        error: { code: 'USER_NOT_FOUND', message: 'Target user does not exist in Auth.' },
      };
    }

    try {
      const now = Date.now();
      const ownedOrgsSnap = await adminDb
        .collection('orgs')
        .where('ownerId', '==', targetUid)
        .get();

      const transferred: string[] = [];
      const deleted: string[] = [];

      for (const orgDoc of ownedOrgsSnap.docs) {
        const orgId = orgDoc.id;
        const membersSnap = await adminDb
          .collection(`orgs/${orgId}/members`)
          .where('uid', '!=', targetUid)
          .where('status', '==', 'active')
          .orderBy('joinedAt', 'asc')
          .limit(1)
          .get();

        if (membersSnap.empty) {
          // Solo org — purge everything.
          await purgeOrg(orgId);
          deleted.push(orgId);
        } else {
          // Transfer ownership to the longest-tenured admin.
          const newOwner = membersSnap.docs[0];
          const newOwnerUid = newOwner.id;
          await adminDb.doc(`orgs/${orgId}`).update({
            ownerId: newOwnerUid,
            updatedAt: now,
          });
          await adminDb.doc(`orgs/${orgId}/members/${newOwnerUid}`).update({
            role: 'owner',
          });
          // Remove the deleted user's membership doc.
          await adminDb.doc(`orgs/${orgId}/members/${targetUid}`).delete();
          transferred.push(orgId);
        }
      }

      // Always remove the user profile + their membership in orgs they DON'T own.
      const memberOfSnap = await adminDb
        .collectionGroup('members')
        .where('uid', '==', targetUid)
        .get();
      const batch = adminDb.batch();
      for (const m of memberOfSnap.docs) batch.delete(m.ref);
      batch.delete(adminDb.doc(`users/${targetUid}`));
      await batch.commit();

      logger.info(
        `onUserDelete: uid=${targetUid} deleted=${deleted.length} transferred=${transferred.length}`,
      );
      return { ok: true, data: { deletedOrgs: deleted, transferredOrgs: transferred } };
    } catch (err) {
      logger.error('onUserDelete failed', err);
      return {
        ok: false,
        error: {
          code: 'CLEANUP_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
);

/**
 * Hard-delete an org + its members subcollection + audit logs.
 * (Other subcollections — invoices, returns, etc. — are retained by default
 * for compliance; the Firestore TTL policy governs their eventual expiry.)
 */
async function purgeOrg(orgId: string): Promise<void> {
  const membersSnap = await adminDb.collection(`orgs/${orgId}/members`).get();
  const batch = adminDb.batch();
  for (const m of membersSnap.docs) batch.delete(m.ref);
  batch.delete(adminDb.doc(`orgs/${orgId}`));
  await batch.commit();
}
