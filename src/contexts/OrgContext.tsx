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
import { useAuth, type AuthUser } from './AuthContext';
import { boot } from '@/lib/perf/boot-tracer';

// ── Hard timeout for the Firebase SDK initialization itself ─────────────────
// `loadFirebase()` dynamically imports the Firebase SDK and initializes Auth.
// In a restricted sandbox, the SDK's internal network calls to
// securetoken.googleapis.com / firebaselogging-pa.googleapis.com can hang
// indefinitely. This bounds the entire init flow so the user is never stuck
// on a loading screen because Firebase Auth is unreachable.
const FIREBASE_INIT_TIMEOUT_MS = 5_000;

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

// ── Hard timeout for Firestore calls ──────────────────────────────────────────
// Firestore's SDK has NO hard deadline — on network issues or permission
// errors it retries with exponential backoff that can run for MINUTES. This
// guarantees every Firestore operation in the org-resolution path resolves
// (or rejects) within 3s, so the user never sits on a loading screen for
// more than ~3s before we fall back to a local workspace.
//
// Previously 5s with 1 retry = 10.5s worst case, which exceeded the
// DashboardTimeoutBoundary's 6s timeout and showed a "Taking longer than
// usual" error screen. With 3s + 0 retries, worst case is ~3.5s (well
// under the 6s boundary) and the user lands on the dashboard fast.
import { withTimeout, isTimeoutError } from '@/lib/async/withTimeout';
const FIRESTORE_OP_TIMEOUT_MS = 3_000;

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

  /**
   * Imperatively install a LOCAL workspace for the given user.
   *
   * This is the GUARANTEED ESCAPE HATCH used by `AutoProvisionWorkspace` when
   * Firestore org creation fails OR when `markOnboardingComplete` hangs.
   * Without it, `needsOrganization` stays `true` and `<AutoProvisionWorkspace />`
   * re-mounts forever (with `ranRef` blocking re-provision) — the direct cause
   * of the "Preparing your dashboard…" infinite hang.
   *
   * Mirrors the demo fast path (lines 497-564) but accepts any user.
   * Sets `organization`, `profile`, `membership`, `members`, `organizations`,
   * `loading=false`, `loadingForRef.current=user.id`, and persists
   * `gstpilot_org_id` to localStorage. After this call, `needsOrganization`
   * flips to `false` and the dashboard renders.
   */
  setLocalWorkspace: (user: AuthUser) => void;

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

    // No retries — Firestore in this sandbox is either reachable (<1s) or
    // unreachable (blocked). Retrying just doubles the wait for no benefit.
    // If the first attempt fails, we immediately fall back to a local
    // workspace so the user is NEVER blocked for more than ~3.5s.
    const MAX_RETRIES = 0;
    const BACKOFF_MS: number[] = [];

    const attemptResolve = async (attempt: number): Promise<'done' | 'retry' | 'fail'> => {
      try {
        const provider =
          fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email';

        // Lazy-load the org service module (pulls Firebase) on first use.
        const orgService = await loadOrgService();

        // 1. Fetch / create the user profile AND the user's org memberships
        //    in PARALLEL (previously sequential — saved ~200-500ms on login).
        //    Each call is bounded by FIRESTORE_OP_TIMEOUT_MS so a hung
        //    Firestore SDK (no hard deadline of its own) can't block the boot.
        console.log('[Org] Fetching profile + memberships (attempt', attempt + 1, ')');
        const [profileResult, membershipsResult] = await Promise.all([
          withTimeout(
            orgService.fetchOrCreateUserProfile({
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              provider,
            }),
            FIRESTORE_OP_TIMEOUT_MS,
            'fetchOrCreateUserProfile',
          ).catch((err) => {
            if (isTimeoutError(err)) {
              console.warn('[Org] fetchOrCreateUserProfile timed out');
              return { profile: null, error: 'Profile fetch timed out.' };
            }
            throw err;
          }),
          withTimeout(
            orgService.fetchUserOrganizations(fbUser.uid),
            FIRESTORE_OP_TIMEOUT_MS,
            'fetchUserOrganizations',
          ).catch((err) => {
            if (isTimeoutError(err)) {
              console.warn('[Org] fetchUserOrganizations timed out');
              return { memberships: [], error: 'Organizations fetch timed out.' };
            }
            throw err;
          }),
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
          // Both calls bounded — a hung Firestore SDK can't block here either.
          const [orgResult, memberResult] = await Promise.all([
            withTimeout(
              orgService.fetchOrganization(orgId),
              FIRESTORE_OP_TIMEOUT_MS,
              'fetchOrganization',
            ).catch((err) => {
              if (isTimeoutError(err)) {
                return { organization: null, error: 'Organization fetch timed out.' };
              }
              throw err;
            }),
            withTimeout(
              orgService.fetchMembership(orgId, fbUser.uid),
              FIRESTORE_OP_TIMEOUT_MS,
              'fetchMembership',
            ).catch((err) => {
              if (isTimeoutError(err)) {
                return { member: null, error: 'Membership fetch timed out.' };
              }
              throw err;
            }),
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
        boot.mark('organization ready');
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
    boot.mark('organization ready (local fallback)');
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

  // ── setLocalWorkspace — guaranteed escape hatch ─────────────────────────
  // Builds a local org/profile/membership purely from an AuthUser (no Firebase
  // round-trip). Used by AutoProvisionWorkspace when Firestore writes hang or
  // org creation fails. Without this, the user can be stuck on "Preparing your
  // dashboard…" indefinitely because `needsOrganization` only flips to `false`
  // when `organization` is set — and neither `setCurrentView('dashboard')` nor
  // `setCurrentScreen('app')` updates `organization`.
  const setLocalWorkspace = useCallback((wsUser: AuthUser) => {
    const localOrgId = `local-${wsUser.id}`;
    const localOrg: OrganizationDoc = {
      id: localOrgId,
      name: wsUser.name + "'s Workspace",
      slug: 'my-workspace',
      ownerId: wsUser.id,
      logoUrl: null,
      gstin: null,
      plan: 'free',
      status: 'active',
      createdAt: null,
      updatedAt: null,
    };
    const localMember: OrganizationMemberDoc = {
      id: `${localOrgId}_${wsUser.id}`,
      organizationId: localOrgId,
      userId: wsUser.id,
      userEmail: wsUser.email,
      userDisplayName: wsUser.name,
      userPhotoURL: wsUser.picture ?? null,
      role: 'owner',
      status: 'active',
      invitedBy: null,
      invitedAt: null,
      joinedAt: null,
      createdAt: null,
      updatedAt: null,
    };
    const localProfile: UserProfileDoc = {
      uid: wsUser.id,
      email: wsUser.email,
      displayName: wsUser.name,
      photoURL: wsUser.picture ?? null,
      phone: null,
      company: null,
      gstin: null,
      role: 'owner',
      provider: wsUser.provider === 'google' ? 'google' : 'email',
      emailVerified: wsUser.emailVerified,
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
    loadingForRef.current = wsUser.id;
    try {
      localStorage.setItem('gstpilot_org_id', localOrgId);
    } catch {
      /* non-fatal */
    }
    console.log('[Org] setLocalWorkspace installed for uid:', wsUser.id, '→ orgId:', localOrgId);
  }, []);

  // ── Reactively resolve the org context whenever the auth user changes ──
  // CRITICAL: The dependency array uses only primitive values (isAuthenticated,
  // userId, provider) — NOT the `user` object itself. The `user` object is
  // recreated on every AuthContext render, which would cause this effect to
  // tear down and re-create the Firebase subscription on every render cycle,
  // leading to repeated resolveOrgContext calls, repeated Firestore queries,
  // and ultimately the org-resolution timeout loop. By depending only on the
  // primitive userId + provider, the subscription is created ONCE per sign-in
  // and stays stable until the user actually changes (sign-out → sign-in).
  // The `user` object is captured in a ref so the effect body always reads
  // the latest value without re-triggering the effect.
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    // Firebase is loaded lazily so this effect can't read `auth.currentUser`
    // synchronously. We kick off the lazy load and act on the result.
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    // Read the latest user from the ref (not the closure-captured value).
    const currentUser = userRef.current;

    // ── FAST PATH: Demo users have no Firebase Auth session, so we can set up
    //    their local workspace SYNCHRONOUSLY without waiting for the lazy
    //    `loadFirebase()` import. Previously the demo path lived inside the
    //    `.then()` callback below, which meant `loading` stayed true until
    //    Firebase finished loading — on slow connections that took >8s and
    //    triggered the DashboardTimeoutBoundary error screen. Moving it above
    //    the firebase load means demo users resolve in <1 render cycle.
    if (isAuthenticated && currentUser && currentUser.provider === 'demo') {
      // Skip if we've already resolved for this user.
      if (loadingForRef.current !== currentUser.id) {
        console.log('[Org] Demo user detected (fast path) — creating local workspace synchronously');
        const localOrgId = `local-${currentUser.id}`;
        const localOrg: OrganizationDoc = {
          id: localOrgId,
          name: currentUser.name + "'s Workspace",
          slug: 'my-workspace',
          ownerId: currentUser.id,
          logoUrl: null,
          gstin: null,
          plan: 'free',
          status: 'active',
          createdAt: null,
          updatedAt: null,
        };
        const localMember: OrganizationMemberDoc = {
          id: `${localOrgId}_${currentUser.id}`,
          organizationId: localOrgId,
          userId: currentUser.id,
          userEmail: currentUser.email,
          userDisplayName: currentUser.name,
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
          uid: currentUser.id,
          email: currentUser.email,
          displayName: currentUser.name,
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
        loadingForRef.current = currentUser.id;
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

    // Wrap the entire Firebase init chain in a hard timeout. If the SDK's
    // internal network calls hang (sandbox, offline, DNS failure), the user
    // gets a local workspace after 8s instead of sitting on a loader forever.
    withTimeout(
      loadFirebase().then(({ auth, onIdTokenChanged }) => {
        if (cancelled) return;

        // If React says "not authenticated" but Firebase still has a currentUser,
        // this is a transient state (HMR remount, brief re-render) — don't wipe
        // the org context. Only reset on a genuine sign-out (no Firebase user).
        if (!isAuthenticated || !currentUser) {
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
        if (currentUser && currentUser.provider === 'demo') {
          console.log('[Org] Demo user detected (fallback path) — creating local workspace');
          const localOrgId = `local-${currentUser.id}`;
          const localOrg: OrganizationDoc = {
            id: localOrgId,
            name: currentUser.name + "'s Workspace",
            slug: 'my-workspace',
            ownerId: currentUser.id,
            logoUrl: null,
            gstin: null,
            plan: 'free',
            status: 'active',
            createdAt: null,
            updatedAt: null,
          };
          const localMember: OrganizationMemberDoc = {
            id: `${localOrgId}_${currentUser.id}`,
            organizationId: localOrgId,
            userId: currentUser.id,
            userEmail: currentUser.email,
            userDisplayName: currentUser.name,
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
            uid: currentUser.id,
            email: currentUser.email,
            displayName: currentUser.name,
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
          loadingForRef.current = currentUser.id;
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
        } else if (
          !auth.currentUser &&
          currentUser &&
          currentUser.provider !== 'demo' &&
          loadingForRef.current !== currentUser.id
        ) {
          // ── Cached-real-user fallback ──────────────────────────────────
          // Firebase Auth hasn't surfaced `currentUser` (network unreachable,
          // token endpoint hung), but AuthContext has a cached real user from
          // localStorage. Without this branch, `loading` stays `true` FOREVER
          // because `resolveOrgContext` is never called.
          //
          // We build a synthetic minimal FirebaseUser-shaped object so the
          // normal resolve path runs. The Firestore calls inside
          // `resolveOrgContext` have their own 3s timeouts and will fall back
          // to a local workspace if Firestore is also unreachable — exactly
          // what we want.
          console.warn('[Org] auth.currentUser is null but cached real user exists — resolving with synthetic user to avoid indefinite loading state');
          const syntheticUser = {
            uid: currentUser.id,
            email: currentUser.email,
            displayName: currentUser.name,
            photoURL: currentUser.picture ?? null,
            emailVerified: currentUser.emailVerified,
            providerData: [{
              providerId: currentUser.provider === 'google' ? 'google.com' : 'password',
            }],
          } as unknown as FirebaseUser;
          resolveOrgContext(syntheticUser);
        }
      }),
      FIREBASE_INIT_TIMEOUT_MS,
      'org firebase init',
    ).catch((err) => {
      if (isTimeoutError(err)) {
        console.warn('[Org] Firebase init timed out — installing local workspace to unblock the user');
        if (currentUser && currentUser.provider !== 'demo') {
          setLocalWorkspace(currentUser);
        }
      } else {
        console.warn('[Org] Firebase load failed — org context inactive:', err);
      }
    });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
    // CRITICAL: Only depend on primitive values (isAuthenticated, userId,
    // provider) — NOT the `user` object. The `user` object is recreated on
    // every AuthContext render, which would cause this effect to re-run and
    // re-create the Firebase subscription on every render cycle. The `user`
    // is read from `userRef.current` inside the effect, so it's always fresh.
    // `resolveOrgContext` and `setLocalWorkspace` are stable (useCallback).
  }, [isAuthenticated, user?.id, user?.provider, resolveOrgContext, setLocalWorkspace]);

  // ── Derived values ──
  const role: OrgRole | null = membership?.role ?? profile?.role ?? null;
  // Demo users never need onboarding — OrgContext's fast path creates a local
  // workspace synchronously. Without this guard, a render-cycle race between
  // AuthContext flipping `isAuthenticated=true` and OrgContext's fast-path
  // effect running causes `needsOrganization` to briefly be `true`, which
  // triggers `<AutoProvisionWorkspace />` to fire a wasted Firestore
  // createOrganization call (harmless but noisy — logs 4 warnings per demo
  // sign-in). Excluding demo users here eliminates the race entirely.
  const needsOrganization =
    isAuthenticated &&
    !loading &&
    !organization &&
    user?.provider !== 'demo';

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
    setLocalWorkspace,
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
