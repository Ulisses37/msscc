import { useAuth } from '@/context/AuthContext';

/** Calls logout and uses compact mobile sizing to fit the banner action row. */
export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button
      type="button"
      onClick={logout}
      className="whitespace-nowrap rounded-sm bg-msscc-pink px-3 py-1.5 text-xs tracking-btn text-msscc-white transition-colors hover:bg-msscc-pink-dark sm:px-4 sm:py-2 sm:text-btn"
    >
      Log Out
    </button>
  );
}
