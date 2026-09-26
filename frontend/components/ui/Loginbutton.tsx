import type { LoginButtonProps } from '@/types/auth';

/** Renders a single login action sized to fit the mobile banner action row. */
export function LoginButton({ onLoginClick }: LoginButtonProps) {
  return (
    <button
      type="button"
      onClick={onLoginClick}
      className="whitespace-nowrap rounded-sm bg-msscc-teal px-3 py-1.5 text-xs tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark sm:px-4 sm:py-2 sm:text-btn"
    >
      Login
    </button>
  );
}
