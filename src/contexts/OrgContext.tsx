'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Global Organization Context (PART 3)
//
// After the user is authenticated (handled by AuthContext), this context:
//   1. Loads the user's profile from Firestore (`users/{uid}`)
//   2. Resolves their current organization (`currentOrganizationId`)
//   3. Loads the organization document + the user's membership (role)
//   4. Loads the full member roster for that organization
//   5. Caches everything in a single context value
//
// No page should ever query the current organization directly — it reads
// from `useOrg()`. This guarantees a single source of truth and a single
// Firestore round-trip on login.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
// Type-only import — erased at compile time, does NOT pull in the firebase/auth
// runtime module. Keeps OrgContext in a LIGHT webpack chunk.
import { type User as FirebaseUser } from 'firebase/auth';
// errors.ts, permissions.ts, types.ts are pure (no Firebase import) — safe statically.
import { friendlyAuthError } from '@/lib/auth/errors';
import { can } from '@/lib/auth/permissions';
import type {
  OrganizationDoc,
  OrganizationMemberDoc,
  UserProfileDoc,
  OrgRole,
  Permission,
  OrgMembership,
} from '@/lib/auth/types';
import { useAuth } from './AuthContext';

// ── Lazy Firebase + org-service loaders ───────────────────────────────────────
// @/lib/firebase and @/lib/auth/organizations both pull in the Firebase SDK
// (~40 MB). We import them dynamically so Firebase compiles in its OWN chunk,
// only when the org context actually needs to resolve (after sign-in).
type FirebaseModule = typeof import('@/lib/firebase');
type OrgServiceModule = typeof import('@/lib/auth/organizations');
let firebaseCache: Promise<FirebaseModule> | null = null;
let orgServiceCache: Promise<OrgServiceModule> | null = null;
function loadFirebase(): Promise<FirebaseModule> {
  if (!firebaseCache) firebaseCache = import('@/lib/firebase');
  return firebaseCache;
}
function loadOrgService(): Promise<OrgServiceModule> {
  if (!orgServiceCache) orgServiceCache = import('@/lib/auth/organizations');
  return orgServiceCache;
}

// ─── Context Value ───────────────────────────────────────────────────────────

interface OrgContextValue {
  /** The resolved user profile from Firestore (or null if not loaded). */
  profile: UserProfileDoc | null;
  /** The current organization document. */
  organization: OrganizationDoc | null;
  /** The current user's membership row (carries their role). */
  membership: OrganizationMemberDoc | null;
  /** All members of the current organization. */
  members: OrganizationMemberDoc[];
  /** All organizations the user belongs to (each with their role).
   *  Powers the organization switcher UI. Empty until first load resolves. */
  organizations: OrgMembership[];
  /** The current user's role within the org (convenience accessor). */
  role: OrgRole | null;
  /** True while the org context is being resolved (initial load). */
  loading: boolean;
  /** `true` when the user is exploring via the "Explore Demo" button (no
   *  Firebase Auth session, no Firestore org). In this mode the app shows
   *  empty states instead of trying to fetch real data. `false` for all
   *  real authenticated users. */
  isPreviewMode: boolean;
  /** Friendly error message if the load failed. */
  error: string | null;
  /** Authenticated but has no organization yet (needs onboarding). */
  needsOrganization: boolean;

  /** Reload the entire org context (e.g. after a member is invited). */
  reload: () => Promise<void>;
  /** Switch the current organization (updates `currentOrganizationId`).
   *  Resolves with `{ error }` — `error` is null on success so the caller
   *  can show its own toast / inline feedback. The error is ALSO surfaced
   *  via `error` on this context for global handlers. */
  switchOrganization: (orgId: string) => Promise<{ error: string | null }>;
  /** Mark onboarding complete and set the current org. */
  completeOnboarding: (orgId: string) => Promise<void>;

  /** Permission check — convenience wrapper around `can(role, permission)`. */
  can: (permission: Permission) => boolean;
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, clearIsLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [organization, setOrganization] = useState<OrganizationDoc | null>(null);
  const [membership, setMembership] = useState<OrganizationMemberDoc | null>(null);
  const [members, setMembers] = useState<OrganizationMemberDoc[]>([]);
  const [organizations, setOrganizations] = useState<OrgMembership[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Track the user we're currently loading for, to avoid redundant fetches
  // when Firebase fires `onIdTokenChanged` multiple times.
  const loadingForRef = useRef<string | null>(null);

  // Whenever loading finishes (success OR preview fallback OR error), clear
  // the AuthContext `isLoading` flag so the login page's "Redirecting…"
  // card disappears. Previously `isLoading` stayed true for 3s (safety
  // timeout) even after the org resolved, making login feel slow.
  useEffect(() => {
    if (!loading) {
      clearIsLoading();
    }
  }, [loading, clearIsLoading]);

  // Persist the current organization id to localStorage so the non-React
  // firestore-service module can stamp every written document with
  // `organizationId` (the field the security rules + onSnapshot hooks require).
  // Without this, currentOrgId() in firestore-service returns null and writes
  // either throw or create documents the hooks can never read back.
  useEffect(() => {
    try {
      if (organization?.id) {
        localStorage.setItem('gstpilot_org_id', organization.id);
      } else {
        localStorage.removeItem('gstpilot_org_id');
      }
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [organization?.id]);

  /**
   * Resolve the full org context for a Firebase user. Idempotent — if a load
   * is already in-flight for this uid, it returns early.
   *
   * Includes retry logic with exponential backoff for transient Firestore
   * errors (network / unavailable). Permanent errors (permission-denied,
   * not-found) are surfaced immediately.
   */
  const resolveOrgContext = useCallback(async (fbUser: FirebaseUser) => {
    if (loadingForRef.current === fbUser.uid) return;
    loadingForRef.current = fbUser.uid;
    console.log('[Org] Resolving org context for uid:', fbUser.uid);
    setLoading(true);
    setError(null);

    // Reduced from 3 retries @ [500,1000,2000]ms = 3.5s of pure waiting to
    // 1 retry @ 500ms. Permission-denied / not-found are permanent and don't
    // benefit from retries; transient network blips recover in <500ms.
    const MAX_RETRIES = 1;
    const BACKOFF_MS = [500];

    const attemptResolve = async (attempt: number): Promise<'done' | 'retry' | 'fail'> => {
      try {
        const provider =
          fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email';

        // Lazy-load the org service module (pulls Firebase) on first use.
        const orgService = await loadOrgService();

        // 1. Fetch / create the user profile AND the user's org memberships
        //    in PARALLEL (previously sequential — saved ~200-500ms on login).
        console.log('[Org] Fetching profile + memberships (attempt', attempt + 1, ')');
        const [profileResult, membershipsResult] = await Promise.all([
          orgService.fetchOrCreateUserProfile({
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            provider,
          }),
          orgService.fetchUserOrganizations(fbUser.uid),
        ]);

        const { profile: userProfile, error: profileError } = profileResult;
        const { memberships, error: memberError } = membershipsResult;

        if (profileError || !userProfile) {
          console.warn('[Org] Profile fetch error:', profileError);
          if (attempt < MAX_RETRIES) {
            return 'retry';
          }
          setError(profileError || 'Could not load your profile.');
          setProfile(null);
          setOrganization(null);
          setMembership(null);
          setMembers([]);
          setOrganizations([]);
          return 'fail';
        }

        console.log('[Org] Profile loaded. Orgs found:', memberships.length);
        setProfile(userProfile);
        // ── Previously memberError was silently swallowed here, which sent
        //    users with a real org (but a transient membership-fetch failure)
        //    into AutoProvisionWorkspace → which then tried to create a NEW
        //    org and hit permission-denied. Now: if both profile AND member
        //    fetch failed, surface the error and fall through to the local
        //    workspace fallback. If only member fetch failed but profile is
        //    OK, treat as "no orgs" (the user might genuinely have none) —
        //    but log so it's debuggable.
        if (memberError) {
          console.warn('[Org] Membership fetch error (non-fatal):', memberError);
          // If profile fetch ALSO had an error, this is a real failure → bail.
          // Otherwise, proceed with empty memberships (user may be brand-new).
        }
        setOrganizations(memberships);

        // 2. Resolve the current organization.
        let orgId = userProfile.currentOrganizationId;

        if (!orgId && memberships.length > 0) {
          orgId = memberships[0].organization.id;
          orgService.setCurrentOrganization(fbUser.uid, orgId).catch(() => {});
        }

        if (!orgId) {
          console.log('[Org] No organization found — needs onboarding');
          setOrganization(null);
          setMembership(null);
          setMembers([]);
          return 'done';
        }

        const membershipFromList = memberships.find(
          (m) => m.organization.id === orgId
        );

        if (membershipFromList) {
          console.log('[Org] Organization resolved:', membershipFromList.organization.name);
          setOrganization(membershipFromList.organization);
          setMembership(membershipFromList.member);
        } else {
          const [orgResult, memberResult] = await Promise.all([
            orgService.fetchOrganization(orgId),
            orgService.fetchMembership(orgId, fbUser.uid),
          ]);

          if (orgResult.error || !orgResult.organization) {
            if (attempt < MAX_RETRIES) return 'retry';
            setError(orgResult.error || 'Organization could not be loaded.');
            setOrganization(null);
            setMembership(null);
            setMembers([]);
            setOrganizations([]);
            return 'fail';
          }

          setOrganization(orgResult.organization);
          setMembership(memberResult.member);
        }

        orgService.fetchOrganizationMembers(orgId).then((membersResult) => {
          setMembers(membersResult.members);
        }).catch(() => {});

        console.log('[Org] Context resolved successfully — loading=false');
        return 'done';
      } catch (err) {
        console.warn('[Org] Resolution error:', err);
        if (attempt < MAX_RETRIES) return 'retry';
        setError(friendlyAuthError(err));
        setOrganization(null);
        setMembership(null);
        setMembers([]);
        setOrganizations([]);
        return 'fail';
      }
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const result = await attemptResolve(attempt);
      if (result === 'done') {
        setLoading(false);
        loadingForRef.current = null;
        return;
      }
      if (attempt < MAX_RETRIES) {
        const delay = BACKOFF_MS[attempt] || 1000;
        console.warn(`[Org] Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Exhausted retries — Firestore is unreachable. Rather than blocking the
    // user with an error screen, fall back to a LOCAL workspace so the app
    // remains usable. The dashboard will show empty states (no data yet), and
    // the user can still navigate, configure settings, and use the UI. When
    // Firestore becomes reachable again, a reload will pick up real data.
    console.warn('[Org] Firestore unreachable after retries — falling back to local workspace');
    const localOrgId = `local-${fbUser.uid}`;
    const localOrg: OrganizationDoc = {
      id: localOrgId,
      name: fbUser.displayName || fbUser.email?.split('@')[0] || 'My Workspace',
      slug: 'my-workspace',
      ownerId: fbUser.uid,
      logoUrl: null,
      gstin: null,
      plan: 'free',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    };
    const localMember: OrganizationMemberDoc = {
      id: `${localOrgId}_${fbUser.uid}`,
      organizationId: localOrgId,
      userId: fbUser.uid,
      userEmail: fbUser.email || '',
      userDisplayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
      userPhotoURL: fbUser.photoURL || null,
      role: 'owner',
      status: 'active',
      invitedBy: null,
      invitedAt: null,
      joinedAt: null,
      createdAt: null,
      updatedAt: null,
    };
    const localProfile: UserProfileDoc = {
      uid: fbUser.uid,
      email: fbUser.email || '',
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
      photoURL: fbUser.photoURL || null,
      phone: null,
      company: null,
      gstin: null,
      role: 'owner',
      provider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
      emailVerified: fbUser.emailVerified,
      onboardingCompleted: true,
      currentOrganizationId: localOrgId,
      createdAt: null,
      updatedAt: null,
    };
    setProfile(localProfile);
    setOrganization(localOrg);
    setMembership(localMember);
    setMembers([localMember]);
    setOrganizations([{ organization: localOrg, member: localMember, role: 'owner' }]);
    setIsPreviewMode(false);
    setError(null);
    setLoading(false);
    loadingForRef.current = null;
    try {
      localStorage.setItem('gstpilot_org_id', localOrgId);
    } catch {
      /* non-fatal */
    }
  }, []);

  /**
   * Reload the org context for the current Firebase user. If there's no
   * Firebase user (demo/local mode), this is a no-op — the local workspace
   * is already set and doesn't need reloading.
   */
  const reload = useCallback(async () => {
    const { auth } = await loadFirebase();
    if (!auth.currentUser) {
      // Demo / local mode — nothing to reload from Firestore.
      return;
    }
    loadingForRef.current = null; // force re-load
    await resolveOrgContext(auth.currentUser);
  }, [resolveOrgContext]);

  /**
   * Switch the current organization. Returns `{ error }` so the caller can
   * surface a toast / inline message — the error is ALSO mirrored onto the
   * context's `error` field for global handlers.
   */
  const switchOrganization = useCallback(
    async (orgId: string): Promise<{ error: string | null }> => {
      const { auth } = await loadFirebase();
      const orgService = await loadOrgService();
      if (!auth.currentUser) return { error: 'Not signed in.' };
      const { error: switchError } = await orgService.setCurrentOrganization(
        auth.currentUser.uid,
        orgId
      );
      if (switchError) {
        setError(switchError);
        return { error: switchError };
      }
      loadingForRef.current = null;
      await resolveOrgContext(auth.currentUser);
      return { error: null };
    },
    [resolveOrgContext]
  );

  /**
   * Mark onboarding complete and set the current org.
   */
  const completeOnboarding = useCallback(
    async (orgId: string) => {
      const { auth } = await loadFirebase();
      const orgService = await loadOrgService();
      if (!auth.currentUser) return;
      const { error: onboardError } = await orgService.markOnboardingComplete(
        auth.currentUser.uid,
        orgId
      );
      if (onboardError) {
        setError(onboardError);
        return;
      }
      loadingForRef.current = null;
      await resolveOrgContext(auth.currentUser);
    },
    [resolveOrgContext]
  );

  // ── Reactively resolve the org context whenever the auth user changes ──
  useEffect(() => {
    // Firebase is loaded lazily so this effect can't read `auth.currentUser`
    // synchronously. We kick off the lazy load and act on the result.
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    // ── FAST PATH: Demo users have no Firebase Auth session, so we can set up
    //    their local workspace SYNCHRONOUSLY without waiting for the lazy
    //    `loadFirebase()` import. Previously the demo path lived inside the
    //    `.then()` callback below, which meant `loading` stayed true until
    //    Firebase finished loading — on slow connections that took >8s and
    //    triggered the DashboardTimeoutBoundary error screen. Moving it above
    //    the firebase load means demo users resolve in <1 render cycle.
    if (isAuthenticated && user && user.provider === 'demo') {
      // Skip if we've already resolved for this user.
      if (loadingForRef.current !== user.id) {
        console.log('[Org] Demo user detected (fast path) — creating local workspace synchronously');
        const localOrgId = `local-${user.id}`;
        const localOrg: OrganizationDoc = {
          id: localOrgId,
          name: user.name + "'s Workspace",
          slug: 'my-workspace',
          ownerId: user.id,
          logoUrl: null,
          gstin: null,
          plan: 'free',
          status: 'active',
          createdAt: null,
          updatedAt: null,
        };
        const localMember: OrganizationMemberDoc = {
          id: `${localOrgId}_${user.id}`,
          organizationId: localOrgId,
          userId: user.id,
          userEmail: user.email,
          userDisplayName: user.name,
          userPhotoURL: null,
          role: 'owner',
          status: 'active',
          invitedBy: null,
          invitedAt: null,
          joinedAt: null,
          createdAt: null,
          updatedAt: null,
        };
        const localProfile: UserProfileDoc = {
          uid: user.id,
          email: user.email,
          displayName: user.name,
          photoURL: null,
          phone: null,
          company: null,
          gstin: null,
          role: 'owner',
          provider: 'email',
          emailVerified: true,
          onboardingCompleted: true,
          currentOrganizationId: localOrgId,
          createdAt: null,
          updatedAt: null,
        };
        /* eslint-disable react-hooks/set-state-in-effect */
        setProfile(localProfile);
        setOrganization(localOrg);
        setMembership(localMember);
        setMembers([localMember]);
        setOrganizations([{ organization: localOrg, member: localMember, role: 'owner' }]);
        setIsPreviewMode(false);
        setLoading(false);
        setError(null);
        /* eslint-enable react-hooks/set-state-in-effect */
        loadingForRef.current = user.id;
        try {
          localStorage.setItem('gstpilot_org_id', localOrgId);
        } catch {
          /* non-fatal */
        }
      }
      // Demo users never need Firebase — return early so we don't even start
      // the lazy load. This is the key fix for the 8s timeout.
      return;
    }

    loadFirebase()
      .then(({ auth, onIdTokenChanged }) => {
        if (cancelled) return;

        // If React says "not authenticated" but Firebase still has a currentUser,
        // this is a transient state (HMR remount, brief re-render) — don't wipe
        // the org context. Only reset on a genuine sign-out (no Firebase user).
        if (!isAuthenticated || !user) {
          if (auth.currentUser) {
            // Firebase still has a user — this is a transient blip. Wait for
            // onAuthStateChanged to re-sync the React state.
            return;
          }
          // Genuine sign-out — reset org state. This synchronous clear is the
          // correct reaction to an external auth-state change.
          setProfile(null);
          setOrganization(null);
          setMembership(null);
          setMembers([]);
          setOrganizations([]);
          setIsPreviewMode(false);
          setLoading(false);
          setError(null);
          loadingForRef.current = null;
          return;
        }

        // ── Demo user fallback (should never run because of the fast path above,
        //    but kept as a safety net in case the fast path was skipped).
        if (user && user.provider === 'demo') {
          console.log('[Org] Demo user detected (fallback path) — creating local workspace');
          const localOrgId = `local-${user.id}`;
          const localOrg: OrganizationDoc = {
            id: localOrgId,
            name: user.name + "'s Workspace",
            slug: 'my-workspace',
            ownerId: user.id,
            logoUrl: null,
            gstin: null,
            plan: 'free',
            status: 'active',
            createdAt: null,
            updatedAt: null,
          };
          const localMember: OrganizationMemberDoc = {
            id: `${localOrgId}_${user.id}`,
            organizationId: localOrgId,
            userId: user.id,
            userEmail: user.email,
            userDisplayName: user.name,
            userPhotoURL: null,
            role: 'owner',
            status: 'active',
            invitedBy: null,
            invitedAt: null,
            joinedAt: null,
            createdAt: null,
            updatedAt: null,
          };
          const localProfile: UserProfileDoc = {
            uid: user.id,
            email: user.email,
            displayName: user.name,
            photoURL: null,
            phone: null,
            company: null,
            gstin: null,
            role: 'owner',
            provider: 'email',
            emailVerified: true,
            onboardingCompleted: true,
            currentOrganizationId: localOrgId,
            createdAt: null,
            updatedAt: null,
          };
          setProfile(localProfile);
          setOrganization(localOrg);
          setMembership(localMember);
          setMembers([localMember]);
          setOrganizations([{ organization: localOrg, member: localMember, role: 'owner' }]);
          setIsPreviewMode(false);
          setLoading(false);
          setError(null);
          loadingForRef.current = user.id;
          try {
            localStorage.setItem('gstpilot_org_id', localOrgId);
          } catch {
            /* non-fatal */
          }
          return;
        }

        // The Firebase user is the source of truth for the uid + token. Listen
        // to `onIdTokenChanged` so we also catch token refreshes (PART 7).
        unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
          if (!fbUser) {
            // Token revoked / session expired — AuthContext will handle sign-out.
            return;
          }
          // Only do a full re-resolve if the uid changed. Token refreshes alone
          // don't require reloading the org context.
          if (loadingForRef.current !== fbUser.uid) {
            await resolveOrgContext(fbUser);
          }
        });

        // Kick off the initial resolve immediately.
        if (auth.currentUser && loadingForRef.current !== auth.currentUser.uid) {
          resolveOrgContext(auth.currentUser);
        }
      })
      .catch((err) => {
        console.warn('[Org] Firebase load failed — org context inactive:', err);
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, user?.id, user, resolveOrgContext]);

  // ── Derived values ──
  const role: OrgRole | null = membership?.role ?? profile?.role ?? null;
  const needsOrganization = isAuthenticated && !loading && !organization;

  const canPermission = useCallback(
    (permission: Permission) => can(role, permission),
    [role]
  );

  const value: OrgContextValue = {
    profile,
    organization,
    membership,
    members,
    organizations,
    role,
    loading,
    error,
    isPreviewMode,
    needsOrganization,
    reload,
    switchOrganization,
    completeOnboarding,
    can: canPermission,
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (ctx === undefined) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return ctx;
}

/**
 * Convenience hook — returns just the current organization id, or null.
 * Safe to call from any component under OrgProvider.
 */
export function useCurrentOrgId(): string | null {
  const { organization } = useOrg();
  return organization?.id ?? null;
}

/**
 * Convenience hook — returns the current user's role, or null.
 */
export function useCurrentRole(): OrgRole | null {
  const { role } = useOrg();
  return role;
}
