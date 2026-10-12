'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

import { HONEYPOT_FIELD, subscribeToUpdates, type SubscribeSource } from '@/services/emailService';

interface MailingListSignupProps {
  /** Which entry point this instance represents. */
  source: SubscribeSource;
}

/** Standalone "Join our mailing list" form usable on any public page. */
export function MailingListSignup({ source }: MailingListSignupProps) {
  const t = useTranslations('MailingList');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('sending');

    if (honeypot) {
      // A bot filled the field no human can see; never call the backend.
      setStatus('done');
      return;
    }

    try {
      await subscribeToUpdates(email, source, honeypot);
      setStatus('done');
      setEmail('');
    } catch (error) {
      console.error('Mailing-list signup failed.', error);
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <label
        htmlFor="mailing-list-email"
        className="block text-label uppercase tracking-label text-msscc-gray-dark"
      >
        {t('emailLabel')}
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="mailing-list-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-md border border-msscc-gray-light px-3 py-2 text-body-sm text-msscc-gray-dark outline-none focus:border-msscc-teal focus:ring-2 focus:ring-msscc-teal/20"
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-sm bg-msscc-teal px-4 py-2 text-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark disabled:opacity-60"
        >
          {status === 'sending' ? t('submitting') : t('submit')}
        </button>
      </div>

      {/* Honeypot: hidden from people, visible to naive bots. */}
      <input
        type="text"
        name={HONEYPOT_FIELD}
        value={honeypot}
        onChange={(event) => setHoneypot(event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <p className="mt-2 text-caption text-msscc-gray-mid">{t('consent')}</p>
      <p aria-live="polite" className="mt-2 text-body-sm">
        {status === 'done' && <span className="text-msscc-teal">{t('success')}</span>}
        {status === 'error' && (
          <span className="text-msscc-danger">{t('error')}</span>
        )}
      </p>
    </form>
  );
}
