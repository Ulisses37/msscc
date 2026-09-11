import type { LoginButtonProps } from '@/types/auth';

/** Renders a single unconditional "Login" button. */
export function LoginButton({ onLoginClick }: LoginButtonProps) {
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
