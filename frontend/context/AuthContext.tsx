'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { loginRequest, decodeTokenPayload } from '@/services/authService';

import type { ReactNode } from 'react';
import type { AuthContextValue, UserPayload } from '@/types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = 'msscc_user';
const TOKEN_KEY = 'msscc_access_token';

/** Read the persisted user payload from localStorage. Returns null when absent or invalid. */
function readStoredUser(): UserPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Read the persisted access token from localStorage. */
function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

interface AuthProviderProps {
  children: ReactNode;
}

/** Wraps the application and provides auth state to all descendants. */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserPayload | null>(
    readStoredUser(),
  );
  const [accessToken, setAccessToken] = useState<string | null>(
    readStoredToken(),
  );

  const router = useRouter();

  const isAuthenticated = user !== null;

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const tokens = await loginRequest(email, password);
    const payload = decodeTokenPayload(tokens.access);

    localStorage.setItem(TOKEN_KEY, tokens.access);
    localStorage.setItem(USER_KEY, JSON.stringify(payload));

    setAccessToken(tokens.access);
    setUser(payload);
    router.push('/admin/dashboard');
  }, [router]);

  const logout = useCallback((): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setAccessToken(null);
    router.push('/');
  }, [router]);

  const value: AuthContextValue = {
    isAuthenticated,
    user,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/** Access auth state from any component. Must be used within AuthProvider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
