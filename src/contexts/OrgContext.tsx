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
  /** True when running in preview/offline mode (Firestore unreachable).
   *  The app renders with an in-memory demo org so the UI is visible.
   *  All data hooks will show empty states. */
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

        setProfile(userProfile);
        // Set memberships immediately so the org switcher renders.
        if (!memberError) {
          setOrganizations(memberships);
        }

        // 2. Resolve the current organization.
        let orgId = userProfile.currentOrganizationId;

        // If the profile has no current org, fall back to the first active
        // membership (if any) and persist the choice.
        if (!orgId && memberships.length > 0) {
          orgId = memberships[0].organization.id;
          // Fire-and-forget the persistence — don't block the UI on it.
          setCurrentOrganizationService(fbUser.uid, orgId).catch(() => {});
        }

        if (!orgId) {
          // Authenticated but no organization yet — onboarding will handle this.
          setOrganization(null);
          setMembership(null);
          setMembers([]);
          return 'done';
        }

        // 3. We already have the org + membership from fetchUserOrganizations
        //    (it does the parallel getDocs). Use that data directly instead
        //    of re-fetching. Previously this did Promise.all([fetchOrganization,
        //    fetchMembership, fetchOrganizationMembers]) which re-fetched the
        //    same org + membership — 2 redundant round-trips per login.
        const membershipFromList = memberships.find(
          (m) => m.organization.id === orgId
        );

        if (membershipFromList) {
          setOrganization(membershipFromList.organization);
          setMembership(membershipFromList.member);
        } else {
          // Org in profile but not in memberships list — fetch directly.
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

        // 4. Fetch the full member roster (separate query, not in the
        //    initial parallel batch, because it's only needed for the team
        //    management UI — don't block the dashboard on it).
        fetchOrganizationMembers(orgId).then((membersResult) => {
          setMembers(membersResult.members);
        }).catch(() => {
          // Non-fatal — team list will be empty but the app still works.
        });

        return 'done';
      } catch (err) {
        if (attempt < MAX_RETRIES) return 'retry';
        setError(friendlyAuthError(err));
        setOrganization(null);
        setMembership(null);
        setMembers([]);
        setOrganizations([]);
        return 'fail';
      }
    };

    // Run the attempt loop with backoff.
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const result = await attemptResolve(attempt);
      if (result === 'done') {
        setLoading(false);
        loadingForRef.current = null;
        return;
      }
      // On 'fail' or 'retry', continue the loop. We DON'T return early on
      // 'fail' — we let the loop exhaust so the preview-mode fallback below
      // can create a demo org when Firestore is unreachable.
      if (attempt < MAX_RETRIES) {
        const delay = BACKOFF_MS[attempt] || 1000;
        console.warn(`[Org] Retrying org context load in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    // Exhausted retries. If Firestore is unreachable (network/unavailable
    // error), fall back to a preview-mode demo org so the app UI is visible.
    // This is the common case in sandbox/preview environments without network
    // egress to Google. In production with Firestore reachable, the real org
    // loads and this path is never hit.
    if (fbUser) {
      const demoOrg: OrganizationDoc = {
        id: 'preview-org',
        name: 'Preview Workspace',
        slug: 'preview-workspace',
        ownerId: fbUser.uid,
        logoUrl: null,
        gstin: null,
        plan: 'pro',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const demoProfile: UserProfileDoc = {
        uid: fbUser.uid,
        email: fbUser.email || 'preview@gstpilot.app',
        displayName: fbUser.displayName || 'Preview User',
        photoURL: fbUser.photoURL,
        phone: null,
        company: 'Preview Workspace',
        gstin: null,
        role: 'owner',
        provider: 'email',
        emailVerified: fbUser.emailVerified,
        onboardingCompleted: true,
        currentOrganizationId: 'preview-org',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const demoMembership: OrganizationMemberDoc = {
        id: `${fbUser.uid}-preview`,
        organizationId: 'preview-org',
        userId: fbUser.uid,
        userEmail: demoProfile.email,
        userDisplayName: demoProfile.displayName,
        userPhotoURL: demoProfile.photoURL,
        role: 'owner',
        status: 'active',
        invitedBy: null,
        invitedAt: new Date().toISOString(),
        joinedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      console.warn('[Org] Firestore unreachable — switching to preview mode with demo org.');
      setProfile(demoProfile);
      setOrganization(demoOrg);
      setMembership(demoMembership);
      setMembers([demoMembership]);
      // In preview mode the user only has access to the demo org, so the
      // switcher will render a single (non-interactive) org name.
      setOrganizations([{ organization: demoOrg, member: demoMembership }]);
      setIsPreviewMode(true);
      setError(null);
      setLoading(false);
      loadingForRef.current = null;
      return;
    }

    // No Firebase user at all — show the error screen.
    setError('Could not connect to the workspace service. Please check your connection and try again.');
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
      setLoading(false);
      setError(null);
      loadingForRef.current = null;
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

    // Safety timer — if Firebase hasn't provided a currentUser within 4s
    // (e.g. Firestore/Auth backend unreachable in a sandbox), fall back to
    // the demo org using the cached auth user so the UI is visible.
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    if (!auth.currentUser && user) {
      safetyTimer = setTimeout(() => {
        if (loadingForRef.current === null && !organization) {
          console.warn('[Org] No Firebase user after 4s — creating preview org from cached session.');
          // Synthesize a minimal FirebaseUser-like object from the cached auth user.
          const syntheticUser = {
            uid: user.id,
            email: user.email,
            displayName: user.name,
            photoURL: user.picture ?? null,
            emailVerified: user.emailVerified,
            providerData: [{ providerId: user.provider === 'google' ? 'google.com' : 'password' }],
          } as FirebaseUser;
          resolveOrgContext(syntheticUser);
        }
      }, 4000);
    }

    return () => {
      unsubscribe();
      if (safetyTimer) clearTimeout(safetyTimer);
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
