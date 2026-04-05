'use client';

import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';

import type { LoginButtonProps } from '@/types/auth';

/** Renders "Login" button when unauthenticated, "Admin" link when authenticated. */
export function LoginButton({ onLoginClick }: LoginButtonProps) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <Link
        href="/admin"
        className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800"
      >
        Admin
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onLoginClick}
      className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800"
    >
      Login
    </button>
  );
}
