'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import en from '@/messages/en.json';
import ja from '@/messages/ja.json';

interface SessionExpiredToastProps {
  onDismiss: () => void;
}

const AUTO_DISMISS_DELAY_MS = 6_000;

const MESSAGES = {
  en: en.SessionExpiredToast,
  ja: ja.SessionExpiredToast,
};

/** Notify an admin that their previously active session can no longer be renewed. */
export function SessionExpiredToast({ onDismiss }: SessionExpiredToastProps) {
  const pathname = usePathname();
  const firstSegment = pathname?.split('/')[1];

  // Admin routes have no locale in the URL, so wait until the user lands on a public page.
  const isAdminRoute = firstSegment === 'admin';
  const copy = MESSAGES[firstSegment === 'ja' ? 'ja' : 'en'];

  useEffect(() => {
    if (isAdminRoute) return undefined;

    const dismissTimer = window.setTimeout(onDismiss, AUTO_DISMISS_DELAY_MS);
    return () => window.clearTimeout(dismissTimer);
  }, [isAdminRoute, onDismiss]);

  if (isAdminRoute) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-start gap-3 rounded-md bg-msscc-teal px-4 py-3 text-body-sm text-msscc-white shadow-lg"
    >
      <p className="!text-white">{copy.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={copy.dismiss}
        className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm !text-white text-lg leading-none transition-colors hover:bg-msscc-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-msscc-white"
      >
        ×
      </button>
    </div>
  );
}
