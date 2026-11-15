'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { isValidEmail } from '@/utils/emailValidation';

export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPasswordPage');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError(t('invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setError(t('genericError'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      {/* White card so the form stays readable over the gallery background. */}
      <div className="rounded-md border border-msscc-gray-light bg-msscc-white p-6 shadow-sm sm:p-8">
        <h1 className="mb-2">{t('heading')}</h1>

        {submitted ? (
          <p role="status" className="mt-4 text-msscc-teal">
            {t('success')}
          </p>
        ) : (
          <>
            <p className="mb-6 text-body-sm text-msscc-gray-mid">{t('description')}</p>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-body-sm">{t('emailLabel')}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                  className="px-3 py-2"
                />
              </label>

              {error && (
                <span role="alert" className="text-body-sm text-msscc-danger">
                  {error}
                </span>
              )}

              <button
                type="submit"
                disabled={email.length === 0 || isSubmitting}
                className="mt-2 rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark disabled:opacity-60"
              >
                {isSubmitting ? t('sending') : t('submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}