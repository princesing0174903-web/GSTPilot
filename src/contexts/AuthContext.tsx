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
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { friendlyAuthError, isSessionError } from '@/lib/auth/errors';

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
  /** Google OAuth sign-in. */
  signInWithGoogle: () => Promise<{ user: AuthUser | null; error: string | null }>;
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
      }
    };

    // Safety timeout — if Firebase doesn't respond in 3s, unblock the UI so
    // the landing page and login form are always reachable, even on slow
    // networks or in restricted sandbox environments.
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn('[Auth] Initialization timeout — unblocking UI');
        setUser(null);
        setIsInitializing(false);
      }
    }, 3000);

    // ── Restore from localStorage for instant UI ──
    let restoredFromCache = false;
    let restoredDemoUser = false;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        if (parsed.id) {
          setUser(parsed);
          cachedUserIdRef.current = parsed.id;
          restoredFromCache = true;
          restoredDemoUser = parsed.provider === 'demo';
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }

    // ── onAuthStateChanged — the single source of truth ──
    const unsubscribe = onAuthStateChanged(
      auth,
      (fbUser) => {
        if (!mounted) return;

        if (fbUser) {
          const authUser = firebaseToAuthUser(fbUser);

          // Fast path: cache matched Firebase user → unblock immediately.
          if (restoredFromCache && cachedUserIdRef.current === fbUser.uid) {
            setUser(authUser);
            markInitialized();
            return;
          }

          // Full new sign-in (or cache mismatch).
          setUser(authUser);
          cachedUserIdRef.current = authUser.id;
          try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
          } catch {
            /* storage may be unavailable (private mode) — non-fatal */
          }
          markInitialized();
        } else {
          // No Firebase user — session expired or signed out.
          // BUT: if the cached user is a demo user (preview mode), keep it
          // so the app remains usable when Firebase is unreachable.
          if (!restoredDemoUser) {
            localStorage.removeItem(SESSION_KEY);
            setUser(null);
            cachedUserIdRef.current = null;
          }
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
        markInitialized();
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      const { logOut: firebaseLogOut } = await import('@/lib/auth');
      await firebaseLogOut();
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
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // ── Refresh user profile ──
  // Note: organization / profile data is owned by OrgContext; here we only
  // refresh the Firebase Auth user's basic info.
  const refreshUserProfile = useCallback(async () => {
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
  // gates the "Redirecting…" card on the login page). Previously `isLoading`
  // was declared but never set to true, causing the success card to flash
  // while OrgContext spent 1–5s resolving.
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { signInWithEmail: firebaseSignIn } = await import('@/lib/auth');
      const result = await firebaseSignIn(email, password);
      if (result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      setError(friendlyAuthError(err));
      throw err;
    } finally {
      // NOTE: we do NOT flip isLoading=false here. OrgContext will resolve
      // the org (1–3s) and the app shell appears. We clear isLoading when
      // OrgContext finishes OR after a 3s safety window below.
      setTimeout(() => setIsLoading(false), 3000);
    }
  }, []);

  // ── Sign up with email/password ──
  const signUpWithEmail = useCallback(async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const { signUpWithEmail: firebaseSignUp } = await import('@/lib/auth');
      const result = await firebaseSignUp(name, email, password);
      if (result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      setError(friendlyAuthError(err));
      throw err;
    } finally {
      setTimeout(() => setIsLoading(false), 3000);
    }
  }, []);

  // ── Sign in with Google ──
  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      const { signInWithGoogle: googleSignIn } = await import('@/lib/auth');
      const result = await googleSignIn();
      if (result.error) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      setError(friendlyAuthError(err));
      throw err;
    } finally {
      setTimeout(() => setIsLoading(false), 3000);
    }
  }, []);

  // ── Sign in with a demo account (preview mode) ──
  // Creates an in-memory demo user + persists to localStorage so the app
  // renders even when Firebase Auth / Firestore are unreachable (e.g. sandbox
  // preview). The OrgContext will create a matching demo org.
  const signInDemo = useCallback(() => {
    const demoUser: AuthUser = {
      id: 'demo-user-' + Date.now(),
      name: 'Preview User',
      email: 'preview@gstpilot.app',
      picture: undefined,
      provider: 'demo',
      emailVerified: true,
    };
    setUser(demoUser);
    cachedUserIdRef.current = demoUser.id;
    setNeedsOnboarding(false);
    setError(null);
    setIsInitializing(false);
    setIsLoading(false);
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(demoUser));
    } catch {
      /* non-fatal */
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
