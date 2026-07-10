/**
 * onUserCreate — fires when a new Firebase Auth user is created.
 *
 * Provisions:
 *   • A default personal organization at /orgs/{orgId} (owner: this user)
 *   • A membership doc at /orgs/{orgId}/members/{uid} (role=owner, status=active)
 *   • A user profile at /users/{uid} (mirror of client-side AuthContext shape)
 *   • A welcome notification at /users/{uid}/notifications/{notifId}
 *
 * All writes happen in a single Firestore batch so provisioning is atomic.
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { adminDb, adminAuth } from '../admin';

export const onUserCreate = onCall(
  { region: 'asia-south1', memory: '256MiB', timeoutSeconds: 30 },
  async (req) => {
    // This is wired as a Cloud Function trigger fired by the client calling
    // it right after `createUserWithEmailAndPassword` succeeds (so we get the
    // caller's auth context for free), rather than `functions.auth.user().onCreate()`,
    // so we can provision synchronously before the client navigates.
    const uid = req.auth?.uid;
    if (!uid) {
      return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Sign-in required.' } };
    }
    const data = (req.data ?? {}) as {
      displayName?: string;
      email?: string;
      companyName?: string;
      planId?: string;
    };

    try {
      const user = await adminAuth.getUser(uid);
      const displayName = data.displayName || user.displayName || 'Founder';
      const email = data.email || user.email || '';
      const companyName = data.companyName || `${displayName}'s Workspace`;
      const planId = data.planId || 'starter';

      const orgRef = adminDb.collection('orgs').doc();
      const orgId = orgRef.id;
      const now = Date.now();

      const batch = adminDb.batch();
      batch.set(orgRef, {
        id: orgId,
        name: companyName,
        ownerId: uid,
        planId,
        createdAt: now,
        updatedAt: now,
      });
      batch.set(adminDb.doc(`orgs/${orgId}/members/${uid}`), {
        uid,
        orgId,
        role: 'owner',
        status: 'active',
        joinedAt: now,
        email,
        displayName,
      });
      batch.set(adminDb.doc(`users/${uid}`), {
        uid,
        email,
        displayName,
        defaultOrgId: orgId,
        createdAt: now,
        updatedAt: now,
        onboardingComplete: false,
      });
      batch.set(adminDb.collection(`users/${uid}/notifications`).doc(), {
        type: 'welcome',
        title: `Welcome to GSTPilot, ${displayName}!`,
        body: 'Your workspace is ready. Add your GSTIN to start filing.',
        read: false,
        createdAt: now,
      });

      await batch.commit();
      logger.info(`onUserCreate: provisioned org ${orgId} for user ${uid}`);
      return { ok: true, data: { orgId, uid } };
    } catch (err) {
      logger.error('onUserCreate failed', err);
      return {
        ok: false,
        error: {
          code: 'PROVISION_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  },
);
