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

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  error: string | null;
  loginWithEmail: (email: string, password: string, remember?: boolean) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithDemo: (role: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

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
const REMEMBER_KEY = 'gstpilot_remember';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser;
        setUser(parsed);
      }
    } catch {
      // Invalid session data, clear it
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  // Persist session whenever user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
  }, [user]);

  const loginWithEmail = useCallback(async (email: string, password: string, remember = true) => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Demo validation
      if (!email || !password) {
        throw new Error('Please enter both email and password.');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }

      // Check demo credentials
      const demoUser = Object.values(DEMO_USERS).find(u => u.email === email);
      if (demoUser && password === 'demo123') {
        setUser(demoUser);
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, 'true');
        }
        return;
      }

      // For any other valid email/password, create a user
      const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const newUser: AuthUser = {
        id: `user-${Date.now()}`,
        name,
        email,
        role: 'staff',
        provider: 'email',
      };
      setUser(newUser);
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, 'true');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate Google OAuth flow
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulated Google user
      const googleUser: AuthUser = {
        id: 'google-001',
        name: 'Vikram Singh',
        email: 'vikram.singh@gmail.com',
        picture: '',
        role: 'admin',
        provider: 'google',
      };
      setUser(googleUser);
      localStorage.setItem(REMEMBER_KEY, 'true');
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithDemo = useCallback(async (role: string) => {
    setIsLoading(true);
    setError(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const demoUser = DEMO_USERS[role];
      if (demoUser) {
        setUser(demoUser);
        localStorage.setItem(REMEMBER_KEY, 'true');
      } else {
        throw new Error('Invalid demo role.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Demo login failed.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
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
        loginWithEmail,
        loginWithGoogle,
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
