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

/** Wraps the application and provides auth state to all descendants. */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserPayload | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Comment out the above and uncomment the below to test with a fake user
  // const [user, setUser] = useState<UserPayload | null>({ userId: 1, email: 'admin@msscc1.org' });
  // const [accessToken, setAccessToken] = useState<string | null>('fake-token');

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
