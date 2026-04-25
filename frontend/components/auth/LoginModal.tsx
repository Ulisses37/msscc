'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';
import { isValidEmail } from '@/utils/emailValidation';

interface LoginModalProps {
  onClose: () => void;
}

/** Login modal with email and password inputs. Closes on success, X, or backdrop click. */
export function LoginModal({ onClose }: LoginModalProps) {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);

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

  const emailIsValid = isValidEmail(email);
  const passwordIsValid = password.length > 0;
  const canSubmit = emailIsValid && passwordIsValid && !isSubmitting;
  const showEmailError = emailTouched && email.length > 0 && !emailIsValid;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await login(email, password);
      onClose();
      router.push('/admin/dashboard');
    } catch {
      setSubmitError('Invalid email or password');
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
          aria-label="Close login modal"
        >
          ✕
        </button>

        <h2 className="mb-4">Log in</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-body-sm">Email</span>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setEmailTouched(true)}
              aria-invalid={showEmailError}
              required
              className="px-3 py-2"
            />
            {showEmailError && (
              <span className="text-body-sm text-msscc-danger">
                Please enter a valid email address
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-body-sm">Password</span>
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

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 rounded-sm bg-msscc-teal px-4 py-2 text-btn tracking-btn text-msscc-white transition-colors hover:bg-msscc-teal-dark disabled:opacity-60"
          >
            {isSubmitting ? 'Logging in…' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
