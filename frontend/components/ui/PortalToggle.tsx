'use client';

import { useRouter } from 'next/navigation';

interface PortalToggleProps {
  isAdminRoute: boolean;
  adminPortalLabel?: string;
  publicSiteLabel?: string;
}

/** Renders the portal switch with compact mobile sizing and standard sizing from `sm`. */
export function PortalToggle({
  isAdminRoute,
  adminPortalLabel = 'Admin Portal',
  publicSiteLabel = 'Public Site',
}: PortalToggleProps) {
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
      {isAdminRoute ? publicSiteLabel : adminPortalLabel}
    </button>
  );
}
