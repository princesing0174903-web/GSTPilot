'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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

// ── Fetch or create user's Firestore document (single round-trip) ──
async function fetchOrCreateFirestoreUser(fbUser: FirebaseUser): Promise<Record<string, unknown> | null> {
  try {
    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as Record<string, unknown>;
    }
    // First time — create the doc
    const provider = fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email';
    const newData = {
      uid: fbUser.uid,
      email: fbUser.email,
      displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
      photoURL: fbUser.photoURL || null,
      provider,
      onboardingCompleted: false,
      createdAt: serverTimestamp(),
      plan: 'free',
    };
    await setDoc(userRef, newData);
    console.log('[Auth] Created Firestore user doc for:', fbUser.email);
    return newData as Record<string, unknown>;
  } catch (error) {
    console.warn('[Auth] Failed to fetch/create Firestore user doc:', error);
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
  const cachedUserIdRef = useRef<string | null>(null);

  // ── Core Auth Init ──
  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const markInitialized = () => {
      if (!initialized) {
        initialized = true;
        setIsInitializing(false);
      }
    };

    // Safety timeout — reduced from 8s to 4s
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialized) {
        console.log('[Auth] Safety timeout — clearing state');
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setIsInitializing(false);
      }
    }, 4000);

    // ── Restore from localStorage FIRST for instant UI ──
    let restoredFromCache = false;
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        if (parsed.provider !== 'demo') {
          setUser(parsed);
          cachedUserIdRef.current = parsed.id;
          restoredFromCache = true;
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }

    // ── Single onAuthStateChanged listener — the ONLY source of truth ──
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!mounted) return;

      if (fbUser) {
        console.log('[Auth] Auth state changed:', fbUser.email);

        // Fast path: if cache matches Firebase user, unblock UI immediately
        // and do Firestore refresh in the background
        if (restoredFromCache && cachedUserIdRef.current === fbUser.uid) {
          markInitialized();
          // Background refresh — don't block the UI
          fetchOrCreateFirestoreUser(fbUser).then((firestoreData) => {
            if (!mounted) return;
            if (firestoreData) {
              const authUser = firebaseToAuthUser(fbUser, firestoreData);
              setUser(authUser);
              localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
            }
          });
          return;
        }

        // Full fetch (new sign-in or cache mismatch)
        const firestoreData = await fetchOrCreateFirestoreUser(fbUser);
        if (!mounted) return;
        const authUser = firebaseToAuthUser(fbUser, firestoreData || undefined);
        setUser(authUser);
        cachedUserIdRef.current = authUser.id;
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
      } else {
        // No Firebase user — clear everything
        console.log('[Auth] Auth state changed: null');
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        cachedUserIdRef.current = null;
      }
      markInitialized();
    });

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
    cachedUserIdRef.current = null;
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // ── Refresh user profile from Firestore ──
  const refreshUserProfile = useCallback(async () => {
    if (!auth.currentUser) return;

    try {
      const firestoreData = await fetchOrCreateFirestoreUser(auth.currentUser);
      const authUser = firebaseToAuthUser(auth.currentUser, firestoreData || undefined);
      setUser(authUser);
      cachedUserIdRef.current = authUser.id;
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
