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
      className="rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark"
    >
      {isAdminRoute ? 'Public Site' : 'Admin Portal'}
    </button>
  );
}
