'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  getRedirectResult,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: string;
  provider: 'email' | 'google';
  emailVerified: boolean;
  onboardingCompleted: boolean;
  firmId?: string;
  firmName?: string;
  phone?: string;
}

const SESSION_KEY = 'gstpilot_session';

// ── Convert Firebase User + Firestore data to our AuthUser ──
function firebaseToAuthUser(
  fbUser: FirebaseUser,
  firestoreData?: Record<string, unknown>
): AuthUser {
  const provider = fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email';

  return {
    id: fbUser.uid,
    name: (firestoreData?.displayName as string) || fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    picture: (firestoreData?.photoURL as string) || fbUser.photoURL || undefined,
    role: (firestoreData?.role as string) || 'admin',
    provider,
    emailVerified: fbUser.emailVerified,
    onboardingCompleted: (firestoreData?.onboardingCompleted as boolean) ?? false,
    firmId: (firestoreData?.firmId as string) || undefined,
    firmName: (firestoreData?.firmName as string) || undefined,
    phone: (firestoreData?.phone as string) || undefined,
  };
}

// ── Fetch user's Firestore document ──
async function fetchFirestoreUser(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as Record<string, unknown>;
    }
    return null;
  } catch (error) {
    console.warn('[Auth] Failed to fetch Firestore user doc:', error);
    return null;
  }
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Restore session from localStorage for quick paint, then validate with Firebase ──
  useEffect(() => {
    // Quick restore from localStorage to prevent flash
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        // Only restore if it's a real auth user (not demo)
        if (parsed.provider !== 'demo') {
          setUser(parsed);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // ── Core Auth Init: Handle redirect result + onAuthStateChanged ──
  useEffect(() => {
    let mounted = true;

    // STEP 1: Handle Google redirect result FIRST
    // This resolves when a user returns from Google sign-in redirect
    getRedirectResult(auth)
      .then(async (result) => {
        if (!mounted) return;
        if (result?.user) {
          console.log('[Auth] Google redirect successful:', result.user.email);
          const firestoreData = await fetchFirestoreUser(result.user.uid);
          const authUser = firebaseToAuthUser(result.user, firestoreData || undefined);
          setUser(authUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
          setIsInitializing(false);
        }
        // If result is null, no redirect was pending — onAuthStateChanged will handle it
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[Auth] Redirect error:', err);
        const message = err instanceof Error ? err.message : 'Google sign-in failed.';
        if (message.includes('unauthorized-domain')) {
          setError('This domain is not authorized for Google Sign-In. Please add it in Firebase Console → Authentication → Settings → Authorized domains.');
        }
        setIsInitializing(false);
      });

    // STEP 2: Listen for normal auth state changes (PRIMARY source of truth)
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!mounted) return;
      console.log('[Auth] Auth state changed:', fbUser ? fbUser.email : 'null');

      if (fbUser) {
        // Fetch Firestore user document for onboarding status and profile data
        const firestoreData = await fetchFirestoreUser(fbUser.uid);
        const authUser = firebaseToAuthUser(fbUser, firestoreData || undefined);
        setUser(authUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
      } else {
        // No Firebase user — clear everything
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
      }
      setIsInitializing(false);
    });

    // Safety timeout: if neither getRedirectResult nor onAuthStateChanged resolves in 8s
    const safetyTimer = setTimeout(() => {
      if (mounted && isInitializing) {
        console.log('[Auth] Safety timeout — clearing state');
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setIsInitializing(false);
      }
    }, 8000);

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
    } catch {
      // Firebase not available — just clear local state
    }
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // ── Refresh user profile from Firestore ──
  const refreshUserProfile = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      const firestoreData = await fetchFirestoreUser(auth.currentUser.uid);
      const authUser = firebaseToAuthUser(auth.currentUser, firestoreData || undefined);
      setUser(authUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    } catch (error) {
      console.warn('[Auth] Failed to refresh user profile:', error);
    }
  }, []);

  // ── Derived flags ──
  const needsOnboarding = user !== null && !user.onboardingCompleted;
  const needsEmailVerification = user !== null && !user.emailVerified && user.provider === 'email';

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
