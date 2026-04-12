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
        className="rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark"
      >
        Admin
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onLoginClick}
      className="rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark"
    >
      Login
    </button>
  );
}
