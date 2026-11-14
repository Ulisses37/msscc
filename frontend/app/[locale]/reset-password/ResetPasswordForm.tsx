'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/routing';

export default function ResetPasswordForm() {
  const t = useTranslations('ResetPasswordPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => router.push('/'), 2000);
    return () => clearTimeout(timer);
  }, [success, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!uid || !token) {
      setError(t('invalidLink'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('mismatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('tooShort'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/password-reset/confirm/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, token, new_password: newPassword }),
        },
      );

      if (!response.ok) {
        setError(t('invalidLink'));
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(t('genericError'));
      setIsSubmitting(false);
    }
  };

  const canSubmit = newPassword.length > 0 && confirmPassword.length > 0 && !isSubmitting;

  const cardClass =
    'rounded-md border border-msscc-gray-light bg-msscc-white p-6 shadow-sm sm:p-8';

  // On-load guard: if the reset link is missing its uid/token, never render
  // the form, show an error state immediately instead.
  if (!uid || !token) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12">
        <div className={cardClass}>
          <h1 className="mb-4">{t('heading')}</h1>
          <p role="alert" className="text-body-sm text-msscc-danger">
            {t('invalidLink')}
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-body-sm text-msscc-teal hover:underline"
          >
            {t('backToHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      {/* White card so the form stays readable over the gallery background. */}
      <div className={cardClass}>
        <h1 className="mb-6">{t('heading')}</h1>

        {success ? (
          <p role="status" className="text-msscc-teal">
            {t('success')}
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-body-sm">{t('newPassword')}</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                className="px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-body-sm">{t('confirmPassword')}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
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
              disabled={!canSubmit}
              className="mt-2 rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark disabled:opacity-60"
            >
              {isSubmitting ? t('submitting') : t('submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}