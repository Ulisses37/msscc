'use client';

import { useState } from 'react';

import { isValidEmail } from '@/utils/emailValidation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await fetch(`${API_BASE_URL}/api/auth/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-10">
      <h1 className="mb-6">Forgot password</h1>

      {submitted ? (
        <p>If an account exists with that email, a reset link has been sent.</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
            disabled={email.length === 0 || isSubmitting}
            className="mt-2 rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </div>
  );
}
