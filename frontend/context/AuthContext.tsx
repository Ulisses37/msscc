'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { clearAccessToken, setAccessToken } from '@/services/accessTokenStore';
import {
  decodeTokenPayload,
  loginRequest,
  logoutRequest,
  refreshRequest,
} from '@/services/authService';

import type { ReactNode } from 'react';
import type { AuthContextValue, UserPayload } from '@/types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

function clearLegacyAuthStorage(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('msscc_access_token');
  localStorage.removeItem('msscc_user');
}

interface AuthProviderProps {
  children: ReactNode;
}

function getRefreshDelay(accessToken: string): number {
  try {
    const payloadSegment = accessToken.split('.')[1];
    const payload = JSON.parse(atob(payloadSegment)) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return 0;

    return Math.max(payload.exp * 1000 - Date.now() - 30_000, 0);
  } catch {
    return 0;
  }
}

/** Wraps the application and provides auth state to all descendants. */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [accessToken, setCurrentAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  const isAuthenticated = user !== null;

  const clearSession = useCallback((): void => {
    clearAccessToken();
    clearLegacyAuthStorage();
    setCurrentAccessToken(null);
    setUser(null);
  }, []);

  const applyAccessToken = useCallback((token: string): boolean => {
    try {
      const payload = decodeTokenPayload(token);
      setAccessToken(token);
      setCurrentAccessToken(token);
      setUser(payload);
      return true;
    } catch (error) {
      console.error('Unable to decode the current admin session.', error);
      clearSession();
      return false;
    }
  }, [clearSession]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const tokens = await refreshRequest();
      return applyAccessToken(tokens.access);
    } catch {
      clearSession();
      return false;
    }
  }, [applyAccessToken, clearSession]);

  useEffect(() => {
    clearLegacyAuthStorage();
    void refreshSession().finally(() => setIsLoading(false));
  }, [refreshSession]);

  useEffect(() => {
    if (!accessToken) return undefined;

    const refreshTimer = window.setTimeout(() => {
      void refreshSession();
    }, getRefreshDelay(accessToken));

    return () => window.clearTimeout(refreshTimer);
  }, [accessToken, refreshSession]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const tokens = await loginRequest(email, password);
    if (!applyAccessToken(tokens.access)) {
      throw new Error('Unable to start the secure session.');
    }
    router.push('/admin/dashboard');
  }, [applyAccessToken, router]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } catch (error) {
      console.error('Unable to revoke the server session during logout.', error);
    } finally {
      clearSession();
      router.push('/');
    }
  }, [clearSession, router]);

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
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
