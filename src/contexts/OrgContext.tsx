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
import { onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  fetchOrCreateUserProfile,
  fetchOrganization,
  fetchMembership,
  fetchOrganizationMembers,
  fetchUserOrganizations,
  setCurrentOrganization as setCurrentOrganizationService,
  markOnboardingComplete as markOnboardingCompleteService,
} from '@/lib/auth/organizations';
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

        // 1. Fetch / create the user profile AND the user's org memberships
        //    in PARALLEL (previously sequential — saved ~200-500ms on login).
        console.log('[Org] Fetching profile + memberships (attempt', attempt + 1, ')');
        const [profileResult, membershipsResult] = await Promise.all([
          fetchOrCreateUserProfile({
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            provider,
          }),
          fetchUserOrganizations(fbUser.uid),
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
        if (!memberError) {
          setOrganizations(memberships);
        }

        // 2. Resolve the current organization.
        let orgId = userProfile.currentOrganizationId;

        if (!orgId && memberships.length > 0) {
          orgId = memberships[0].organization.id;
          setCurrentOrganizationService(fbUser.uid, orgId).catch(() => {});
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
            fetchOrganization(orgId),
            fetchMembership(orgId, fbUser.uid),
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

        fetchOrganizationMembers(orgId).then((membersResult) => {
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

    // Exhausted retries — Firestore is likely unreachable. In production this
    // path is never hit (Firestore is reachable). We NO LONGER fall back to a
    // synthetic preview-org demo org — that was a dev/preview crutch that
    // caused permission-denied errors on every Firestore subscription.
    // Instead, surface an honest error so the user knows to reconnect.
    console.warn('[Org] Firestore unreachable after retries — showing honest error (no preview fallback)');
    setProfile(null);
    setOrganization(null);
    setMembership(null);
    setMembers([]);
    setOrganizations([]);
    setIsPreviewMode(false);
    setError('Could not connect to the workspace service. Please check your internet connection and try again. If the problem persists, sign out and sign back in.');
    setLoading(false);
    loadingForRef.current = null;
  }, []);

  /**
   * Reload the org context for the current Firebase user.
   */
  const reload = useCallback(async () => {
    if (!auth.currentUser) return;
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
      if (!auth.currentUser) return { error: 'Not signed in.' };
      const { error: switchError } = await setCurrentOrganizationService(
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
      if (!auth.currentUser) return;
      const { error: onboardError } = await markOnboardingCompleteService(
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

    // ── Demo user: create a synthetic preview org so the dashboard renders
    //    without Firestore. Demo users have no Firebase Auth session, so
    //    resolveOrgContext (which needs a FirebaseUser) can't be called.
    //    Without this, `loading` stays true forever → 8s timeout screen.
    if (user.provider === 'demo') {
      console.log('[Org] Demo user detected — creating synthetic preview org');
      const demoOrgId = 'demo-org-preview';
      const demoOrg: OrganizationDoc = {
        id: demoOrgId,
        name: 'Preview Workspace',
        slug: 'preview-workspace',
        ownerId: user.id,
        logoUrl: null,
        gstin: null,
        plan: 'free',
        status: 'active',
        createdAt: null,
        updatedAt: null,
      };
      const demoMember: OrganizationMemberDoc = {
        id: `${demoOrgId}_${user.id}`,
        organizationId: demoOrgId,
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
      const demoProfile: UserProfileDoc = {
        uid: user.id,
        email: user.email,
        displayName: user.name,
        photoURL: null,
        phone: null,
        company: 'Preview Workspace',
        gstin: null,
        role: 'owner',
        provider: 'email',
        emailVerified: true,
        onboardingCompleted: true,
        currentOrganizationId: demoOrgId,
        createdAt: null,
        updatedAt: null,
      };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(demoProfile);
      setOrganization(demoOrg);
      setMembership(demoMember);
      setMembers([demoMember]);
      setOrganizations([{ organization: demoOrg, member: demoMember, role: 'owner' }]);
      setIsPreviewMode(true);
      setLoading(false);
      setError(null);
      loadingForRef.current = user.id;
      try {
        localStorage.setItem('gstpilot_org_id', demoOrgId);
      } catch {
        /* non-fatal */
      }
      return;
    }

    // The Firebase user is the source of truth for the uid + token. Listen
    // to `onIdTokenChanged` so we also catch token refreshes (PART 7).
    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
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

    return () => {
      unsubscribe();
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
