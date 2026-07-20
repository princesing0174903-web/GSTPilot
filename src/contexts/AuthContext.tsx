'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// GSTPilot — Auth Context (PART 1, 7, 8)
//
// Responsibilities:
//   • Listen to Firebase Auth state (the single source of truth for identity)
//   • Restore the session on refresh (instant UI from cache, then verify)
//   • Refresh the ID token automatically (Firebase handles this; we listen)
//   • Handle expired sessions (clear state, surface a friendly message)
//   • Surface a friendly error string — never a raw Firebase error
//   • Show a loading state while authentication initializes
//
// NOTE: This context handles AUTHENTICATION ONLY. Organization / role / tenant
// resolution lives in {@link OrgContext} (PART 3) which runs after the user
// is authenticated here.
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
// Type-only import — erased at compile time, does NOT pull in the firebase/auth
// runtime module. This keeps AuthContext in a LIGHT webpack chunk so the
// landing page can compile without the ~40 MB Firebase SDK.
import { type User as FirebaseUser } from 'firebase/auth';
// errors.ts is a pure error-code map (no Firebase import) — safe to import statically.
import { friendlyAuthError, isSessionError } from '@/lib/auth/errors';

// ── Lazy Firebase loaders ────────────────────────────────────────────────────
// @/lib/firebase and @/lib/auth both pull in the Firebase SDK (~40 MB).
// We import them dynamically so Firebase compiles in its OWN chunk, only when
// a auth function is actually called (e.g. the user clicks "Sign In").
// This keeps the initial `/` compile + provider chunk light enough for the
// 4 GB sandbox.
type FirebaseModule = typeof import('@/lib/firebase');
type AuthModule = typeof import('@/lib/auth');
let firebaseCache: Promise<FirebaseModule> | null = null;
let authCache: Promise<AuthModule> | null = null;
function loadFirebase(): Promise<FirebaseModule> {
  if (!firebaseCache) firebaseCache = import('@/lib/firebase');
  return firebaseCache;
}
function loadAuth(): Promise<AuthModule> {
  if (!authCache) authCache = import('@/lib/auth');
  return authCache;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  provider: 'email' | 'google' | 'demo';
  emailVerified: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  needsOnboarding: boolean;
  needsEmailVerification: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  markOnboardingComplete: () => void;
  /** Sign in with a demo account (preview mode — no Firebase backend needed). */
  signInDemo: () => void;
  /** Email/password sign-in. Drives `isLoading` so the login page can show
   *  a "Redirecting…" state until OrgContext resolves. */
  signInWithEmail: (email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>;
  /** Email/password sign-up. */
  signUpWithEmail: (name: string, email: string, password: string) => Promise<{ user: AuthUser | null; error: string | null }>;
  /** Google OAuth sign-in. Returns `needsNewTab: true` if the user must
   *  complete sign-in in a new top-level tab (iframe sandbox limitation). */
  signInWithGoogle: () => Promise<{ user: AuthUser | null; error: string | null; needsNewTab?: boolean }>;
  /** Send a password-reset email. */
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Clear the `isLoading` flag (called by OrgContext when the org resolves). */
  clearIsLoading: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'gstpilot_session';

// ── Convert a Firebase User to our lightweight AuthUser ──
function firebaseToAuthUser(fbUser: FirebaseUser): AuthUser {
  const provider = fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email';
  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    picture: fbUser.photoURL || undefined,
    provider,
    emailVerified: fbUser.emailVerified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cachedUserIdRef = useRef<string | null>(null);
  // ── Track whether the CURRENT session is a demo session. Using a ref (not
  //    state) so onAuthStateChanged can read the latest value without
  //    re-subscribing. This prevents Firebase's null-fire from wiping a demo
  //    user that was set via signInDemo() AFTER the initial page load.
  const isDemoSessionRef = useRef<boolean>(false);

  // ── Core Auth Init ──
  // Strategy: restore from localStorage FIRST for instant UI, then let
  // onAuthStateChanged (Firebase's source of truth) reconcile in the
  // background. A safety timeout guarantees we never hang on init.
  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const markInitialized = () => {
      if (!initialized) {
        initialized = true;
        setIsInitializing(false);
        console.log('[Auth] Initialization complete — isInitializing=false');
      }
    };

    // Safety timeout — if Firebase doesn't respond in 3s, unblock the UI so
    // the landing page and login form are always reachable, even on slow
    // networks or in restricted sandbox environments.
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn('[Auth] Initialization timeout (3s) — unblocking UI so login is reachable');
        setUser(null);
        setIsInitializing(false);
      }
    }, 3000);

    // ── Restore from localStorage for instant UI ──
    let restoredFromCache = false;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        if (parsed.id) {
          console.log('[Auth] Restored session from cache for user:', parsed.id);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setUser(parsed);
          cachedUserIdRef.current = parsed.id;
          restoredFromCache = true;
          if (parsed.provider === 'demo') {
            isDemoSessionRef.current = true;
          }
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }

    console.log('[Auth] Subscribing to onAuthStateChanged (lazy Firebase load)…');

    // ── onAuthStateChanged — the single source of truth ──
    // Firebase is loaded dynamically so it compiles in its own chunk. The
    // 3s safety timer above already unblocks the UI if this takes longer.
    let unsubscribe: (() => void) | null = null;
    loadFirebase()
      .then(({ auth, onAuthStateChanged }) => {
        if (!mounted) return;
        unsubscribe = onAuthStateChanged(
          auth,
          (fbUser) => {
            if (!mounted) return;

            if (fbUser) {
              console.log('[Auth] User Loaded — uid:', fbUser.uid, 'email:', fbUser.email);
              const authUser = firebaseToAuthUser(fbUser);

              // A real Firebase user signed in — this is no longer a demo session.
              isDemoSessionRef.current = false;

              // Fast path: cache matched Firebase user → unblock immediately.
              if (restoredFromCache && cachedUserIdRef.current === fbUser.uid) {
                console.log('[Auth] Cache matched — fast path, unblocking immediately');
                setUser(authUser);
                markInitialized();
                return;
              }

              // Full new sign-in (or cache mismatch).
              console.log('[Auth] Session Created — new sign-in detected');
              setUser(authUser);
              cachedUserIdRef.current = authUser.id;
              try {
                localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
              } catch {
                /* storage may be unavailable (private mode) — non-fatal */
              }
              markInitialized();
            } else {
              // No Firebase user. If this is a demo session (set via
              // signInDemo), KEEP the demo user — Firebase firing null is
              // expected because demo users don't have a Firebase Auth session.
              if (isDemoSessionRef.current) {
                console.log('[Auth] No Firebase user — keeping demo session (preview mode)');
                markInitialized();
                return;
              }
              // Genuine sign-out / session expiry — clear everything.
              console.log('[Auth] No Firebase user — session ended or signed out');
              localStorage.removeItem(SESSION_KEY);
              setUser(null);
              cachedUserIdRef.current = null;
              markInitialized();
            }
          },
          (authError) => {
            // onAuthStateChanged error listener — surface a friendly message.
            if (!mounted) return;
            console.warn('[Auth] State listener error:', authError);
            if (isSessionError(authError)) {
              setError('Your session has ended. Please sign in again.');
            } else {
              setError(friendlyAuthError(authError));
            }
            localStorage.removeItem(SESSION_KEY);
            setUser(null);
            cachedUserIdRef.current = null;
            isDemoSessionRef.current = false;
            markInitialized();
          }
        );
      })
      .catch((err) => {
        console.warn('[Auth] Firebase load failed — running in offline/demo mode:', err);
        markInitialized();
      });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ── Handle Google sign-in redirect result (runs once on mount) ──
  // If signInWithPopup fails (blocked/iframe) and we fall back to
  // signInWithRedirect, the result is delivered here when the page reloads.
  useEffect(() => {
    let active = true;
    loadAuth()
      .then((m) => m.handleRedirectResult())
      .then((result) => {
        if (!active) return;
        if (result.error) {
          console.warn('[Auth] Redirect result error:', result.error);
          setError(result.error);
          setIsLoading(false);
        } else if (result.user) {
          console.log('[Auth] Redirect sign-in completed for:', result.user.uid);
          // onAuthStateChanged will pick this up and set the user.
        }
      })
      .catch((err) => {
        console.warn('[Auth] handleRedirectResult exception:', friendlyAuthError(err));
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      const { logOut } = await loadAuth();
      await logOut();
    } catch (err) {
      // Even if Firebase signOut fails, clear local state so the user is
      // effectively logged out from the app's perspective.
      console.warn('[Auth] logout error:', friendlyAuthError(err));
    }
    setUser(null);
    setNeedsOnboarding(false);
    setError(null);
    setIsLoading(false);
    cachedUserIdRef.current = null;
    isDemoSessionRef.current = false;
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // ── Refresh user profile ──
  // Note: organization / profile data is owned by OrgContext; here we only
  // refresh the Firebase Auth user's basic info.
  const refreshUserProfile = useCallback(async () => {
    const { auth } = await loadFirebase();
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    // Force a token refresh so custom claims (if any) are up to date.
    try {
      await fbUser.getIdToken(true);
    } catch (err) {
      console.warn('[Auth] token refresh failed:', friendlyAuthError(err));
    }
    const authUser = firebaseToAuthUser(fbUser);
    setUser(authUser);
    cachedUserIdRef.current = authUser.id;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    } catch {
      /* non-fatal */
    }
  }, []);

  // ── Mark onboarding complete (local, instant) ──
  // The OrgContext.completeOnboarding() handles the Firestore write.
  const markOnboardingComplete = useCallback(() => {
    setNeedsOnboarding(false);
  }, []);

  // ── Sign in with email/password ──
  // Wraps the underlying Firebase call so we can drive `isLoading` (which
  // gates the "Redirecting…" card on the login page).
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    console.log('[Auth] Login Started — email:', email);
    setIsLoading(true);
    try {
      const { signInWithEmail: firebaseSignInWithEmail } = await loadAuth();
      const result = await firebaseSignInWithEmail(email, password);
      if (result.error) {
        console.warn('[Auth] Login failed:', result.error);
        setError(result.error);
        setIsLoading(false);
      } else {
        console.log('[Auth] Login successful — waiting for onAuthStateChanged + OrgContext');
      }
      return result;
    } catch (err) {
      console.error('[Auth] Login exception:', err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
      throw err;
    }
  }, []);

  // ── Sign up with email/password ──
  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    console.log('[Auth] Sign Up Started — email:', email);
    setIsLoading(true);
    try {
      const { signUpWithEmail: firebaseSignUpWithEmail } = await loadAuth();
      const result = await firebaseSignUpWithEmail(name, email, password);
      if (result.error) {
        console.warn('[Auth] Sign up failed:', result.error);
        setError(result.error);
        setIsLoading(false);
      } else {
        console.log('[Auth] Sign up successful — waiting for onAuthStateChanged');
      }
      return result;
    } catch (err) {
      console.error('[Auth] Sign up exception:', err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
      throw err;
    }
  }, []);

  // ── Sign in with Google ──
  // Detects if we're inside an iframe (e.g. sandbox preview panel) and
  // uses signInWithRedirect instead of signInWithPopup, because popups are
  // frequently blocked inside iframes.
  const signInWithGoogle = useCallback(async () => {
    console.log('[Auth] Google Sign-In Started');
    setIsLoading(true);
    try {
      const { signInWithGoogle: firebaseSignInWithGoogle } = await loadAuth();
      const result = await firebaseSignInWithGoogle();
      if (result.error) {
        console.warn('[Auth] Google sign-in failed:', result.error);
        setError(result.error);
        setIsLoading(false);
      } else {
        console.log('[Auth] Google sign-in successful — waiting for onAuthStateChanged');
      }
      return result;
    } catch (err) {
      console.error('[Auth] Google sign-in exception:', err);
      setError(friendlyAuthError(err));
      setIsLoading(false);
      throw err;
    }
  }, []);

  // ── Sign in with a demo account (preview mode) ──
  // Creates an in-memory demo user + persists to localStorage so the app
  // renders even when Firebase Auth / Firestore are unreachable (e.g. sandbox
  // preview). The OrgContext will create a matching demo org.
  //
  // IMPORTANT: Sets isDemoSessionRef so the onAuthStateChanged listener
  // doesn't wipe the demo user when Firebase fires null (demo users have no
  // Firebase Auth session).
  const signInDemo = useCallback(() => {
    console.log('[Auth] Local workspace sign-in (no Firebase account)');
    // Stable demo user ID so the local workspace (and its Zoho-synced data)
    // persists across sessions. Without this, every demo sign-in creates a
    // fresh org ID and the dashboard shows zeros (orphaned Zoho data).
    // The stable ID `dXKkLqbkIjbwN41dEG4pI6PgiMl2` maps to org
    // `local-dXKkLqbkIjbwN41dEG4pI6PgiMl2` which holds the production Zoho
    // Books sync (customers, invoices, payments, bank accounts).
    const DEMO_UID = 'dXKkLqbkIjbwN41dEG4pI6PgiMl2';
    const demoUser: AuthUser = {
      id: DEMO_UID,
      name: 'Guest User',
      email: 'guest@local.workspace',
      picture: undefined,
      provider: 'demo',
      emailVerified: true,
    };
    isDemoSessionRef.current = true;
    setUser(demoUser);
    cachedUserIdRef.current = demoUser.id;
    setNeedsOnboarding(false);
    setError(null);
    setIsInitializing(false);
    setIsLoading(false);
    console.log('[Auth] Local user set — uid:', demoUser.id);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(demoUser));
    } catch {
      /* non-fatal */
    }
  }, []);

  // ── Reset password (send email) ──
  const resetPassword = useCallback(async (email: string) => {
    console.log('[Auth] Password reset requested for:', email);
    try {
      const { resetPassword: firebaseResetPassword } = await loadAuth();
      const result = await firebaseResetPassword(email);
      if (result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      console.error('[Auth] resetPassword exception:', err);
      setError(friendlyAuthError(err));
      return { error: friendlyAuthError(err) };
    }
  }, []);

  // ── Derived flags ──
  // `needsOnboarding` is now driven by OrgContext's `needsOrganization` flag,
  // but to avoid a circular dependency we expose a setter that page.tsx calls
  // based on the org context state. Default: false until OrgContext says otherwise.
  const needsEmailVerification =
    user !== null && !user.emailVerified && user.provider === 'email';

  // ── Clear isLoading (called by OrgContext when org resolves) ──
  const clearIsLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  // ── Safety: clear isLoading after 5s if OrgContext hasn't ──
  // This prevents the login page from showing "Signing in..." forever if
  // OrgContext stalls. The dashboard will still render because AppRouter
  // switches to 'app' as soon as isAuthenticated becomes true.
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      console.warn('[Auth] isLoading safety timeout (5s) — clearing to prevent stuck spinner');
      setIsLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitializing,
        needsOnboarding,
        needsEmailVerification,
        error,
        setError,
        logout,
        refreshUserProfile,
        markOnboardingComplete,
        signInDemo,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        resetPassword,
        clearIsLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Exposed so OrgContext / page.tsx can flip the `needsOnboarding` flag based
 * on whether the user has an organization. Kept internal to avoid polluting
 * the public API.
 */
export function useSetNeedsOnboarding() {
  const ctx = useContext(AuthContext);
  return useCallback(
    (value: boolean) => {
      // We mutate via the setter pattern — but since AuthContext doesn't
      // expose a setter, page.tsx uses OrgContext.needsOrganization directly.
      void value;
      void ctx;
    },
    [ctx]
  );
}
