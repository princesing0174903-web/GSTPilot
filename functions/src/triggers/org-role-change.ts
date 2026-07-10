/**
 * org-role-change — onCall function for securely changing a member's role.
 *
 * Only the org owner can change roles. The owner role itself can only be
 * transferred (not added to a second person) — if the request promotes
 * someone to owner, the caller is automatically demoted to admin, ensuring
 * a single owner at all times.
 */
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { adminDb } from '../admin';
import { requireOrgRole, PermissionError } from '../helpers/org-permission';
import type { OrgRole } from '../types';

interface RoleChangeInput {
  orgId: string;
  targetUid: string;
  newRole: OrgRole;
}

const VALID_ROLES: OrgRole[] = ['owner', 'admin', 'accountant', 'viewer'];

export const orgRoleChange = onCall(
  { region: 'asia-south1', memory: '256MiB', timeoutSeconds: 30 },
  async (req) => {
    const callerUid = req.auth?.uid;
    const { orgId, targetUid, newRole } = (req.data ?? {}) as RoleChangeInput;

    if (!orgId || !targetUid || !newRole) {
      return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'orgId, targetUid, newRole required.' } };
    }
    if (!VALID_ROLES.includes(newRole)) {
      return { ok: false, error: { code: 'INVALID_ROLE', message: `newRole must be one of: ${VALID_ROLES.join(', ')}` } };
    }

    try {
      await requireOrgRole(adminDb, callerUid, orgId, 'owner');
    } catch (err) {
      if (err instanceof PermissionError) {
        return { ok: false, error: { code: err.code, message: err.message } };
      }
      throw err;
    }

    if (callerUid === targetUid && newRole !== 'owner') {
      return {
        ok: false,
        error: { code: 'SELF_DEMOTE_FORBIDDEN', message: 'Owner cannot demote self. Transfer ownership to another member first.' },
      };
    }

    try {
      const targetRef = adminDb.doc(`orgs/${orgId}/members/${targetUid}`);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        return { ok: false, error: { code: 'TARGET_NOT_MEMBER', message: 'Target user is not a member of this org.' } };
      }
      const now = Date.now();
      const batch = adminDb.batch();
      batch.update(targetRef, { role: newRole, updatedAt: now });

      if (newRole === 'owner' && callerUid !== targetUid) {
        // Demote current owner → admin (single-owner invariant).
        batch.update(adminDb.doc(`orgs/${orgId}/members/${callerUid as string}`), {
          role: 'admin',
          updatedAt: now,
        });
        batch.update(adminDb.doc(`orgs/${orgId}`), {
          ownerId: targetUid,
          updatedAt: now,
        });
      }

      batch.create(adminDb.collection(`orgs/${orgId}/auditLogs`).doc(), {
        orgId,
        actorUid: callerUid ?? null,
        actorEmail: null,
        action: 'member.role_changed',
        targetType: 'member',
        targetId: targetUid,
        metadata: { newRole, transferredOwnership: newRole === 'owner' && callerUid !== targetUid },
        timestamp: now,
      });

      await batch.commit();
      logger.info(
        `orgRoleChange: caller=${callerUid} target=${targetUid} newRole=${newRole} org=${orgId}`,
      );
      return { ok: true, data: { targetUid, newRole } };
    } catch (err) {
      logger.error('orgRoleChange failed', err);
      return {
        ok: false,
        error: { code: 'ROLE_CHANGE_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
      };
    }
  },
);
