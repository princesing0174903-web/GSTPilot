'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  onAuthStateChanged,
  getRedirectResult,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  provider: 'email' | 'google' | 'demo';
}

// ── Demo users (fallback when Firebase is unavailable) ──
const DEMO_USERS: Record<string, AuthUser> = {
  admin: {
    id: 'demo-admin-001',
    name: 'Rajesh Kumar',
    email: 'rajesh@gstpilot.ai',
    picture: '',
    role: 'admin',
    provider: 'demo',
  },
  manager: {
    id: 'demo-manager-001',
    name: 'Priya Sharma',
    email: 'priya@gstpilot.ai',
    picture: '',
    role: 'manager',
    provider: 'demo',
  },
  staff: {
    id: 'demo-staff-001',
    name: 'Amit Patel',
    email: 'amit@gstpilot.ai',
    picture: '',
    role: 'staff',
    provider: 'demo',
  },
};

const SESSION_KEY = 'gstpilot_session';

// ── Convert Firebase User to our AuthUser ──
function firebaseToAuthUser(fbUser: FirebaseUser): AuthUser {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    picture: fbUser.photoURL || undefined,
    role: 'admin',
    provider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
  };
}

// ── Save user to Firestore (create if doesn't exist) ──
async function saveUserToFirestore(fbUser: FirebaseUser) {
  try {
    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || 'User',
        photoURL: fbUser.photoURL || null,
        createdAt: serverTimestamp(),
        plan: 'free',
      });
    }
  } catch (error) {
    // Firestore write failure shouldn't block login
    console.warn('Failed to save user to Firestore:', error);
  }
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  isRedirecting: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loginWithDemo: (role: string) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Core Auth Init: Handle redirect result + onAuthStateChanged ──
  useEffect(() => {
    let mounted = true;

    // STEP 1: Handle Google redirect result FIRST
    // This resolves when a user returns from Google sign-in redirect
    getRedirectResult(auth)
      .then((result) => {
        if (!mounted) return;
        if (result?.user) {
          // Google sign-in succeeded via redirect
          console.log('[Auth] Google redirect successful:', result.user.email);
          const authUser = firebaseToAuthUser(result.user);
          setUser(authUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
          setIsInitializing(false);
          // Save to Firestore (non-blocking)
          saveUserToFirestore(result.user);
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

    // STEP 2: Listen for normal auth state changes
    // This fires on every page load and whenever auth state changes
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (!mounted) return;
      console.log('[Auth] Auth state changed:', fbUser ? fbUser.email : 'null');

      if (fbUser) {
        const authUser = firebaseToAuthUser(fbUser);
        setUser(authUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
      } else {
        // No Firebase user — check for demo session
        try {
          const stored = localStorage.getItem(SESSION_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as AuthUser;
            if (parsed.provider === 'demo') {
              setUser(parsed);
            } else {
              localStorage.removeItem(SESSION_KEY);
              setUser(null);
            }
          }
        } catch {
          localStorage.removeItem(SESSION_KEY);
          setUser(null);
        }
      }
      setIsInitializing(false);
    });

    // Safety timeout: if neither getRedirectResult nor onAuthStateChanged resolves in 6s
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.log('[Auth] Safety timeout — falling back to localStorage');
        try {
          const stored = localStorage.getItem(SESSION_KEY);
          if (stored) {
            const parsed = JSON.parse(stored) as AuthUser;
            setUser(parsed);
          }
        } catch {
          localStorage.removeItem(SESSION_KEY);
        }
        setIsInitializing(false);
      }
    }, 6000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  // ── Demo login (no Firebase required) ──
  const loginWithDemo = useCallback((role: string) => {
    setError(null);
    const demoUser = DEMO_USERS[role];
    if (demoUser) {
      setUser(demoUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(demoUser));
    } else {
      setError('Invalid demo role.');
    }
  }, []);

  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      const { logOut: firebaseLogOut } = await import('@/lib/auth');
      await firebaseLogOut();
    } catch {
      // Firebase not available or user is demo — just clear local state
    }
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isInitializing,
        isRedirecting,
        error,
        setError,
        loginWithDemo,
        logout,
        clearError,
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
