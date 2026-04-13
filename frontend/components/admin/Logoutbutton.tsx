import { useAuth } from '@/context/AuthContext';

/** Calls logout from AuthContext and redirects to home. */
export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-pink-dark"
    >
      Log Out
    </button>
  );
}
