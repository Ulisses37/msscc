'use client';

import { useAuth } from '@/context/AuthContext';

/** Displays a greeting with the admin's first name. Admin dashboard only. */
export function WelcomeBanner() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="w-full bg-msscc-pink-dark px-6 py-3">
      <p className="text-body font-body text-msscc-white">
        Hello, {user.firstName}
      </p>
    </div>
  );
}
