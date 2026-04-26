'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function ResetPasswordPage() {
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
    const timer = setTimeout(() => router.push('/'), 3000);
    return () => clearTimeout(timer);
  }, [success, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!uid || !token) {
      setError('Invalid or expired reset link.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, new_password: newPassword }),
      });

      if (!response.ok) {
        setError('Invalid or expired reset link.');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    newPassword.length > 0 && confirmPassword.length > 0 && !isSubmitting;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-6">Reset password</h1>

      {success ? (
        <p>Password reset successfully. Redirecting to home…</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              disabled={isSubmitting}
              className="px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-body-sm">Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              disabled={isSubmitting}
              className="px-3 py-2"
            />
          </label>

          {error && (
            <span className="text-body-sm text-msscc-danger">{error}</span>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}
    </div>
  );
}
