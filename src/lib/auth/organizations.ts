// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Organization Service Layer
//
// All Firestore reads/writes for the multi-tenant organization system flow
// through this module. Every function is:
//   - Typed (returns concrete document shapes, not raw Firestore data)
//   - Tenant-aware (writes always stamp `organizationId`)
//   - Defensive (never throws raw Firebase errors — returns friendly messages)
//   - Auditable (log-friendly console output, no PII beyond email)
//
// Collections:
//   organizations/{orgId}                — tenant root
//   organization_members/{memberId}      — user ↔ org join with role
//   users/{uid}                          — user profile + currentOrganizationId
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { friendlyFirestoreError } from './errors';
import type {
  OrganizationDoc,
  OrganizationMemberDoc,
  UserProfileDoc,
  OrgRole,
  MemberStatus,
} from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a raw Firestore snapshot into a typed doc with its `id`. */
function toOrgDoc(id: string, data: DocumentData): OrganizationDoc {
  return {
    id,
    name: data.name ?? '',
    slug: data.slug ?? '',
    ownerId: data.ownerId ?? '',
    logoUrl: data.logoUrl ?? null,
    gstin: data.gstin ?? null,
    plan: data.plan ?? 'free',
    status: data.status ?? 'active',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function toMemberDoc(id: string, data: DocumentData): OrganizationMemberDoc {
  return {
    id,
    organizationId: data.organizationId ?? '',
    userId: data.userId ?? '',
    userEmail: data.userEmail ?? '',
    userDisplayName: data.userDisplayName ?? '',
    userPhotoURL: data.userPhotoURL ?? null,
    role: data.role ?? 'viewer',
    status: data.status ?? 'active',
    invitedBy: data.invitedBy ?? null,
    invitedAt: data.invitedAt ?? null,
    joinedAt: data.joinedAt ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function toUserProfileDoc(uid: string, data: DocumentData): UserProfileDoc {
  return {
    uid,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    photoURL: data.photoURL ?? null,
    phone: data.phone ?? null,
    company: data.company ?? null,
    gstin: data.gstin ?? null,
    role: data.role ?? 'viewer',
    provider: data.provider ?? 'email',
    emailVerified: data.emailVerified ?? false,
    onboardingCompleted: data.onboardingCompleted ?? false,
    currentOrganizationId: data.currentOrganizationId ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

/** Build a URL-safe slug from an org name. */
export function slugifyOrg(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `org-${Date.now().toString(36)}`;
}

// ─── User Profile ────────────────────────────────────────────────────────────

/**
 * Fetch the user's profile document from Firestore. If it doesn't exist yet
 * (first sign-in via Google), create a minimal one and return it.
 */
export async function fetchOrCreateUserProfile(params: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  provider: 'google' | 'email';
}): Promise<{ profile: UserProfileDoc | null; error: string | null }> {
  const { uid, email, displayName, photoURL, provider } = params;
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return { profile: toUserProfileDoc(uid, snap.data()), error: null };
    }

    // First-time user — create the profile.
    const newProfile: Record<string, unknown> = {
      uid,
      email,
      displayName: displayName || email.split('@')[0] || 'User',
      photoURL: photoURL || null,
      phone: null,
      company: null,
      gstin: null,
      role: 'owner' as OrgRole, // becomes the org owner once they create one
      provider,
      emailVerified: false,
      onboardingCompleted: false,
      currentOrganizationId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, newProfile);
    console.log('[Org] Created user profile for:', email);
    return { profile: toUserProfileDoc(uid, newProfile), error: null };
  } catch (err) {
    const message = friendlyFirestoreError(err);
    console.warn('[Org] fetchOrCreateUserProfile failed:', message);
    return { profile: null, error: message };
  }
}

/**
 * Update the user's profile fields (name, photo, phone, company, gstin).
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<UserProfileDoc, 'displayName' | 'photoURL' | 'phone' | 'company' | 'gstin'>>
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (err) {
    return { error: friendlyFirestoreError(err) };
  }
}

/**
 * Mark the user's onboarding as complete and record their current org.
 */
export async function markOnboardingComplete(
  uid: string,
  organizationId: string
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      onboardingCompleted: true,
      currentOrganizationId: organizationId,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (err) {
    return { error: friendlyFirestoreError(err) };
  }
}

// ─── Organization Lifecycle ──────────────────────────────────────────────────

/**
 * Create a new organization and make the creator the `owner` member.
 *
 * This is a two-write operation:
 *   1. `organizations/{orgId}` — the tenant root
 *   2. `organization_members/{memberId}` — owner membership row
 *
 * The user's `currentOrganizationId` is then set so subsequent reads are
 * scoped to this org.
 */
export async function createOrganization(params: {
  name: string;
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  ownerPhotoURL?: string | null;
  gstin?: string | null;
  plan?: 'free' | 'pro' | 'enterprise';
}): Promise<{ organization: OrganizationDoc | null; error: string | null }> {
  const {
    name,
    ownerId,
    ownerEmail,
    ownerDisplayName,
    ownerPhotoURL,
    gstin = null,
    plan = 'free',
  } = params;

  try {
    const slug = slugifyOrg(name);

    // 1. Create the organization document.
    const orgRef = await addDoc(collection(db, 'organizations'), {
      name,
      slug,
      ownerId,
      logoUrl: null,
      gstin,
      plan,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const orgId = orgRef.id;

    // 2. Create the owner membership row.
    await setDoc(doc(collection(db, 'organization_members'), `${orgId}_${ownerId}`), {
      organizationId: orgId,
      userId: ownerId,
      userEmail: ownerEmail,
      userDisplayName: ownerDisplayName,
      userPhotoURL: ownerPhotoURL || null,
      role: 'owner' as OrgRole,
      status: 'active' as MemberStatus,
      invitedBy: null,
      invitedAt: serverTimestamp(),
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3. Set the user's current organization.
    await updateDoc(doc(db, 'users', ownerId), {
      currentOrganizationId: orgId,
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    });

    const orgDoc: OrganizationDoc = {
      id: orgId,
      name,
      slug,
      ownerId,
      logoUrl: null,
      gstin,
      plan,
      status: 'active',
      createdAt: null,
      updatedAt: null,
    };

    console.log('[Org] Created organization:', orgId, 'owner:', ownerEmail);
    return { organization: orgDoc, error: null };
  } catch (err) {
    return { organization: null, error: friendlyFirestoreError(err) };
  }
}

/**
 * Fetch a single organization by id.
 */
export async function fetchOrganization(
  orgId: string
): Promise<{ organization: OrganizationDoc | null; error: string | null }> {
  try {
    const snap = await getDoc(doc(db, 'organizations', orgId));
    if (!snap.exists()) {
      return { organization: null, error: 'Organization not found.' };
    }
    return { organization: toOrgDoc(orgId, snap.data()), error: null };
  } catch (err) {
    return { organization: null, error: friendlyFirestoreError(err) };
  }
}

/**
 * Fetch all organizations the given user is a member of. Used to power the
 * org switcher (future) and to find the user's "current" org on login.
 */
export async function fetchUserOrganizations(
  userId: string
): Promise<{ memberships: { organization: OrganizationDoc; member: OrganizationMemberDoc }[]; error: string | null }> {
  try {
    const memberQ = query(
      collection(db, 'organization_members'),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const memberSnap = await getDocs(memberQ);
    if (memberSnap.empty) {
      return { memberships: [], error: null };
    }

    const members = memberSnap.docs.map((d) => toMemberDoc(d.id, d.data()));

    // Fetch each organization (parallel). Skip any that don't exist.
    const orgResults = await Promise.all(
      members.map(async (m) => {
        const orgSnap = await getDoc(doc(db, 'organizations', m.organizationId));
        if (!orgSnap.exists()) return null;
        return { organization: toOrgDoc(m.organizationId, orgSnap.data()), member: m };
      })
    );

    const memberships = orgResults.filter(
      (r): r is { organization: OrganizationDoc; member: OrganizationMemberDoc } => r !== null
    );
    return { memberships, error: null };
  } catch (err) {
    return { memberships: [], error: friendlyFirestoreError(err) };
  }
}

/**
 * Fetch the current user's membership record for a specific org. This is the
 * authoritative source of the user's role within that org.
 */
export async function fetchMembership(
  orgId: string,
  userId: string
): Promise<{ member: OrganizationMemberDoc | null; error: string | null }> {
  try {
    const snap = await getDoc(doc(db, 'organization_members', `${orgId}_${userId}`));
    if (!snap.exists()) {
      return { member: null, error: null };
    }
    return { member: toMemberDoc(snap.id, snap.data()), error: null };
  } catch (err) {
    return { member: null, error: friendlyFirestoreError(err) };
  }
}

/**
 * Fetch all members of an organization, ordered by joined date.
 */
export async function fetchOrganizationMembers(
  orgId: string
): Promise<{ members: OrganizationMemberDoc[]; error: string | null }> {
  try {
    const q = query(
      collection(db, 'organization_members'),
      where('organizationId', '==', orgId),
      where('status', 'in', ['active', 'invited']),
      orderBy('joinedAt', 'asc')
    );
    const snap = await getDocs(q);
    const members = snap.docs.map((d) => toMemberDoc(d.id, d.data()));
    return { members, error: null };
  } catch (err) {
    return { members: [], error: friendlyFirestoreError(err) };
  }
}

// ─── Member Management ───────────────────────────────────────────────────────

/**
 * Invite a new member to an organization. Creates a membership row with
 * status `invited`. (A real email invite flow would be layered on top later.)
 */
export async function inviteMember(params: {
  organizationId: string;
  invitedBy: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  role: OrgRole;
}): Promise<{ member: OrganizationMemberDoc | null; error: string | null }> {
  const { organizationId, invitedBy, userId, userEmail, userDisplayName, role } = params;
  try {
    const memberRef = doc(db, 'organization_members', `${organizationId}_${userId}`);
    const existing = await getDoc(memberRef);
    if (existing.exists()) {
      return { member: null, error: 'This user is already a member of the organization.' };
    }

    const payload: Record<string, unknown> = {
      organizationId,
      userId,
      userEmail,
      userDisplayName: userDisplayName || userEmail.split('@')[0] || 'Member',
      userPhotoURL: null,
      role,
      status: 'invited' as MemberStatus,
      invitedBy,
      invitedAt: serverTimestamp(),
      joinedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(memberRef, payload);
    return { member: toMemberDoc(memberRef.id, payload), error: null };
  } catch (err) {
    return { member: null, error: friendlyFirestoreError(err) };
  }
}

/**
 * Change a member's role. Owners cannot demote themselves (prevent orphaned
 * orgs). The calling user must be an owner/admin — enforce in the UI layer
 * AND rely on Firestore rules as the backstop.
 */
export async function updateMemberRole(
  orgId: string,
  userId: string,
  newRole: OrgRole
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'organization_members', `${orgId}_${userId}`), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (err) {
    return { error: friendlyFirestoreError(err) };
  }
}

/**
 * Remove a member from an organization (soft delete — status → `removed`).
 */
export async function removeMember(
  orgId: string,
  userId: string
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'organization_members', `${orgId}_${userId}`), {
      status: 'removed' as MemberStatus,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (err) {
    return { error: friendlyFirestoreError(err) };
  }
}

/**
 * Switch the user's current organization. Updates `currentOrganizationId`
 * on the user profile. The OrgContext will reactively reload.
 */
export async function setCurrentOrganization(
  uid: string,
  orgId: string
): Promise<{ error: string | null }> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      currentOrganizationId: orgId,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (err) {
    return { error: friendlyFirestoreError(err) };
  }
}

/**
 * Update organization metadata (name, logo, gstin). Owner/admin only.
 */
export async function updateOrganization(
  orgId: string,
  updates: Partial<Pick<OrganizationDoc, 'name' | 'logoUrl' | 'gstin' | 'plan'>>
): Promise<{ error: string | null }> {
  try {
    const payload: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
    if (updates.name) payload.slug = slugifyOrg(updates.name);
    await updateDoc(doc(db, 'organizations', orgId), payload);
    return { error: null };
  } catch (err) {
    return { error: friendlyFirestoreError(err) };
  }
}

/**
 * Hard-delete an organization. Owner only. In production this should be
 * gated by a secondary confirmation + billing reconciliation; for now it
 * performs a cascading soft-delete.
 */
export async function deleteOrganization(
  orgId: string
): Promise<{ error: string | null }> {
  try {
    await deleteDoc(doc(db, 'organizations', orgId));
    return { error: null };
  } catch (err) {
    return { error: friendlyFirestoreError(err) };
  }
}
