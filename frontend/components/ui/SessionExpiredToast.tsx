'use client';

import { useEffect } from 'react';

interface SessionExpiredToastProps {
  onDismiss: () => void;
}

const AUTO_DISMISS_DELAY_MS = 6_000;

/** Notify an admin that their previously active session can no longer be renewed. */
export function SessionExpiredToast({ onDismiss }: SessionExpiredToastProps) {
  useEffect(() => {
    const dismissTimer = window.setTimeout(onDismiss, AUTO_DISMISS_DELAY_MS);
    return () => window.clearTimeout(dismissTimer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-start gap-3 rounded-md bg-msscc-teal px-4 py-3 text-body-sm text-msscc-white shadow-lg"
    >
      <p className="!text-white">Your session has expired. Please sign in again.</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss session expiration notice"
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm !text-white text-lg leading-none transition-colors hover:bg-msscc-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-msscc-white"
      >
        ×
      </button>
    </div>
  );
}
