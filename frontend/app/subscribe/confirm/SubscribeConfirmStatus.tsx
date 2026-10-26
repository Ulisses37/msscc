'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { confirmSubscription } from '@/services/emailService';

// This page is deliberately unlocalized: it is reached from an English
// confirmation email and lives outside app/[locale]/, so its strings are
// English literals rather than message keys.
type ConfirmState = 'loading' | 'success' | 'invalid' | 'error';

const MESSAGES: Record<ConfirmState, string> = {
  loading: 'Confirming your subscription…',
  success: 'Thanks, your subscription is confirmed.',
  invalid: 'This confirmation link is invalid or has expired.',
  error: 'We could not confirm your subscription right now. Please try again.',
};

interface SubscribeConfirmStatusProps {
  /** Raw token from the confirmation link, or an empty string when absent. */
  token: string;
}

/** Confirms the token once, then renders the outcome with a way back home. */
export default function SubscribeConfirmStatus({ token }: SubscribeConfirmStatusProps) {
  const [state, setState] = useState<ConfirmState>('loading');
  // Next dev runs effects twice, and the token is single use, so a second
  // request would turn a successful confirm into "invalid". The ref makes the
  // request fire exactly once per token.
  const hasRequested = useRef(false);

  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;

    if (!token) {
      setState('invalid');
      return;
    }

    confirmSubscription(token)
      .then((outcome) => {
        setState(outcome === 'confirmed' ? 'success' : 'invalid');
      })
      .catch((error: unknown) => {
        console.error('Subscription confirmation failed.', error);
        setState('error');
      });
  }, [token]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-6">Mailing list confirmation</h1>

      <p
        aria-live="polite"
        className={
          state === 'invalid' || state === 'error'
            ? 'text-body-sm text-msscc-danger'
            : 'text-body-sm text-msscc-gray-dark'
        }
      >
        {MESSAGES[state]}
      </p>

      {state !== 'loading' && (
        <Link href="/" className="mt-4 text-body-sm text-msscc-teal hover:underline">
          Back to home page
        </Link>
      )}
    </div>
  );
}
