'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { loginRequest, decodeTokenPayload } from '@/services/authService';

import type { ReactNode } from 'react';
import type { AuthContextValue, UserPayload } from '@/types/auth';

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// Dev User Details
// TODO(pre-delivery): Remove the dev auto-login toggle before handing the
// product to MSSCC. The DEV_AUTO_LOGIN block, DEV_USER constant, and the
// NEXT_PUBLIC_DEV_AUTO_LOGIN env var should all go.
const DEV_AUTO_LOGIN = process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN === 'true';

const DEV_USER: UserPayload = {
  userId: 1,
  email: 'admin@msscc1.org',
  firstName: 'Bryan',
};

/** Wraps the application and provides auth state to all descendants. */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserPayload | null>(
    DEV_AUTO_LOGIN ? DEV_USER : null,
  );
  const [accessToken, setAccessToken] = useState<string | null>(
    DEV_AUTO_LOGIN ? 'dev-auto-login-token' : null,
  );

  const router = useRouter();

  const isAuthenticated = user !== null;

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const tokens = await loginRequest(email, password);
    const payload = decodeTokenPayload(tokens.access);

    setAccessToken(tokens.access);
    setUser(payload);
  }, []);

  const logout = useCallback((): void => {
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
