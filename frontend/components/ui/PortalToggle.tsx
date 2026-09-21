'use client';

import { useRouter } from 'next/navigation';

interface PortalToggleProps {
  isAdminRoute: boolean;
}

/** Renders "Admin Portal" when on the public site, "Public Site" when in the admin portal. */
export function PortalToggle({ isAdminRoute }: PortalToggleProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(isAdminRoute ? '/' : '/admin');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="whitespace-nowrap rounded-sm bg-msscc-teal px-3 py-1.5 text-xs tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark sm:px-4 sm:py-2 sm:text-btn"
    >
      {isAdminRoute ? 'Public Site' : 'Admin Portal'}
    </button>
  );
}
