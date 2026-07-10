/**
 * Organization membership + role permission helper.
 *
 * Verifies that a caller (identified by Firebase Auth UID) is an active
 * member of the given organization with one of the allowed roles.
 *
 * Membership docs live at /orgs/{orgId}/members/{uid} — same shape as the
 * Next.js app expects (see src/contexts/OrgContext.tsx).
 */
import type { Firestore } from 'firebase-admin/firestore';
import type { OrgMembership, OrgRole } from '../types';

export class PermissionError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus = 403) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    Object.setPrototypeOf(this, PermissionError.prototype);
  }
}

/**
 * Resolve the caller's membership in an org and verify the role is allowed.
 *
 * @returns The membership doc (typed) if the caller is permitted.
 * @throws PermissionError if the caller is not authenticated, not a member,
 *   suspended, or lacks one of the allowed roles.
 */
export async function requireOrgRole(
  db: Firestore,
  uid: string | null | undefined,
  orgId: string,
  ...allowedRoles: OrgRole[]
): Promise<OrgMembership> {
  if (!uid) {
    throw new PermissionError('UNAUTHENTICATED', 'Authentication required.', 401);
  }
  if (!orgId) {
    throw new PermissionError('INVALID_ARGUMENT', 'orgId is required.', 400);
  }

  const snap = await db.doc(`orgs/${orgId}/members/${uid}`).get();
  if (!snap.exists) {
    throw new PermissionError(
      'NOT_ORG_MEMBER',
      'Caller is not a member of this organization.',
      403,
    );
  }
  const data = snap.data() as Partial<OrgMembership>;
  if (data.status && data.status !== 'active') {
    throw new PermissionError(
      'MEMBERSHIP_SUSPENDED',
      `Caller membership is ${data.status}.`,
      403,
    );
  }
  const role = (data.role ?? 'viewer') as OrgRole;
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new PermissionError(
      'INSUFFICIENT_ROLE',
      `Action requires one of: ${allowedRoles.join(', ')}. Caller role: ${role}.`,
      403,
    );
  }
  return {
    uid,
    orgId,
    role,
    status: data.status ?? 'active',
    joinedAt: data.joinedAt ?? Date.now(),
  };
}

/**
 * Convenience: returns true if the caller is the org owner.
 */
export async function isOrgOwner(
  db: Firestore,
  uid: string | null | undefined,
  orgId: string,
): Promise<boolean> {
  try {
    const m = await requireOrgRole(db, uid, orgId, 'owner');
    return m.role === 'owner';
  } catch {
    return false;
  }
}
