'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

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
function firebaseToAuthUser(fbUser: { uid: string; displayName: string | null; email: string | null; photoURL: string | null; providerData: { providerId: string }[] }): AuthUser {
  return {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    email: fbUser.email || '',
    picture: fbUser.photoURL || undefined,
    role: 'admin',
    provider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
  };
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
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
  const [error, setError] = useState<string | null>(null);

  // ── Initialize: Try Firebase auth state listener, fallback to localStorage ──
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    let initialized = false;

    // Safety timeout: if Firebase doesn't respond in 5s, fall back to localStorage
    const safetyTimer = setTimeout(() => {
      if (!initialized && mounted) {
        initialized = true;
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
    }, 5000);

    async function initAuth() {
      try {
        // Dynamic import to avoid SSR issues and handle Firebase load failures gracefully
        const { onAuthStateChanged, auth } = await import('@/lib/auth');

        unsubscribe = onAuthStateChanged(auth, (fbUser) => {
          if (!mounted) return;
          if (initialized) return; // Already initialized via safety timeout
          initialized = true;
          clearTimeout(safetyTimer);

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
      } catch (err) {
        // Firebase failed to load — fall back to localStorage demo session
        if (!mounted || initialized) return;
        initialized = true;
        clearTimeout(safetyTimer);

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
    }

    initAuth();

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      if (unsubscribe) unsubscribe();
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
