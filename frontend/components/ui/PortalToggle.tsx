import Link from 'next/link';

interface PortalToggleProps {
  isAdminRoute: boolean;
}

/** Renders "Admin Portal" when on the public site, "Public Site" when in the admin portal. */
export function PortalToggle({ isAdminRoute }: PortalToggleProps) {
  return (
    <Link
      href={isAdminRoute ? '/' : '/admin'}
      className="rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark"
    >
      {isAdminRoute ? 'Public Site' : 'Admin Portal'}
    </Link>
  );
}
