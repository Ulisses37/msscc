'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/context/AuthContext';
import { isValidEmail } from '@/utils/emailValidation';

interface LoginModalProps {
  onClose: () => void;
  labels?: LoginModalLabels;
}

interface LoginModalLabels {
  title: string;
  email: string;
  password: string;
  forgotPassword: string;
  loggingIn: string;
  login: string;
  invalidEmail: string;
  invalidCredentials: string;
  closeModal: string;
}

const DEFAULT_LABELS: LoginModalLabels = {
  title: 'Log in',
  email: 'Email',
  password: 'Password',
  forgotPassword: 'Forgot password?',
  loggingIn: 'Logging in…',
  login: 'Log In',
  invalidEmail: 'Please enter a valid email address',
  invalidCredentials: 'Invalid email or password',
  closeModal: 'Close login modal',
};

/** Login modal with email and password inputs. Closes on success, X, or backdrop click. */
export function LoginModal({ onClose, labels = DEFAULT_LABELS }: LoginModalProps) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const canSubmit = email.length > 0 && password.length > 0 && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (!isValidEmail(email)) {
      setSubmitError(labels.invalidEmail);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await login(email, password);
      onClose();
    } catch {
      setSubmitError(labels.invalidCredentials);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-md border border-msscc-gray-light bg-msscc-white p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 text-msscc-gray-mid hover:text-msscc-gray-dark"
          aria-label={labels.closeModal}
        >
          ✕
        </button>

        <h2 className="mb-4">{labels.title}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm">{labels.email}</span>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-body-sm">{labels.password}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="px-3 py-2"
            />
          </label>

          {submitError && (
            <span className="text-body-sm text-msscc-danger">{submitError}</span>
          )}

          <Link
            href="/forgot-password"
            onClick={onClose}
            className="text-body-sm text-msscc-teal hover:underline"
          >
            {labels.forgotPassword}
          </Link>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark disabled:opacity-60"
          >
            {isSubmitting ? labels.loggingIn : labels.login}
          </button>
        </form>
      </div>
    </div>
  );
}
