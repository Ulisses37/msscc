'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface MembershipPaymentElementProps {
  clientSecret: string;
  locale: string;
  membershipInformationValid: boolean;
  onPaymentStateChange: (state: 'ready' | 'confirming' | 'submitted') => void;
}

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
// Share one Stripe.js instance; never pass the account secret key to the browser.
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function MembershipPaymentForm({
  locale,
  membershipInformationValid,
  onPaymentStateChange,
}: {
  locale: string;
  membershipInformationValid: boolean;
  onPaymentStateChange: MembershipPaymentElementProps['onPaymentStateChange'];
}) {
  const t = useTranslations('MembershipPage');
  const stripe = useStripe();
  const elements = useElements();
  const [elementReady, setElementReady] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);
  const [takingLonger, setTakingLonger] = useState(false);
  const confirmationInFlight = useRef(false);

  useEffect(() => {
    if (!isSubmitting) {
      setTakingLonger(false);
      return;
    }

    // An unresolved Stripe authentication/confirmation is not a failure. Do
    // not unlock another payment attempt on a timer: it could double-charge.
    const timer = window.setTimeout(() => setTakingLonger(true), 12000);
    return () => window.clearTimeout(timer);
  }, [isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Stripe.js, the iframe, and the selected payment method must all be ready.
    // The ref closes the gap before React commits the disabled button state.
    if (
      !membershipInformationValid ||
      !stripe ||
      !elements ||
      !elementReady ||
      !paymentComplete ||
      submitted ||
      confirmationInFlight.current
    ) {
      return;
    }

    confirmationInFlight.current = true;
    onPaymentStateChange('confirming');
    setIsSubmitting(true);
    setError(false);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(true);
        onPaymentStateChange('ready');
        return;
      }

      const { error: confirmationError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // The existing membership page is a neutral return destination, not
          // proof that a payment succeeded or that membership was activated.
          return_url: `${window.location.origin}/${locale}/membership`,
        },
        redirect: 'if_required',
      });
      if (confirmationError) {
        setError(true);
        onPaymentStateChange('ready');
        return;
      }

      // Card confirmations may return without a redirect. Do not call this a
      // completed membership; the payment-result story will handle status.
      setSubmitted(true);
      onPaymentStateChange('submitted');
    } catch {
      // Neither Stripe error details nor client secrets belong in the UI/logs.
      setError(true);
      onPaymentStateChange('ready');
    } finally {
      confirmationInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {submitted && (
        <p role="status" className="mb-4 rounded-md border border-slate-300 bg-white p-4 text-slate-800">
          {t('paymentSubmitted')}
        </p>
      )}
      {!submitted && (
        <PaymentElement
          onReady={() => setElementReady(true)}
          onChange={(event) => {
            setPaymentComplete(event.complete);
            setError(false);
          }}
          onLoadError={() => {
            setElementReady(false);
            setError(true);
          }}
        />
      )}
      {!submitted && !elementReady && !error && (
        <p role="status" className="mt-3 text-sm text-slate-600">
          {t('loadingPaymentForm')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {t('paymentConfirmationError')}
        </p>
      )}
      {takingLonger && !submitted && (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {t('paymentTakingLonger')}
        </p>
      )}
      {!submitted && (
        <button
          type="submit"
          disabled={
            !membershipInformationValid ||
            !stripe ||
            !elements ||
            !elementReady ||
            !paymentComplete ||
            isSubmitting
          }
          className="mt-5 w-full rounded-md bg-pink-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-pink-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
        >
          {isSubmitting ? t('confirmingPayment') : t('confirmPayment')}
        </button>
      )}
    </form>
  );
}

export function MembershipPaymentElement({
  clientSecret,
  locale,
  membershipInformationValid,
  onPaymentStateChange,
}: MembershipPaymentElementProps) {
  const t = useTranslations('MembershipPage');

  if (!stripePromise || !clientSecret) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('paymentUnavailable')}
      </p>
    );
  }

  return (
    <section
      aria-label={t('secureStripePayment')}
      className="mt-6 rounded-md border border-slate-300 bg-slate-50 p-3 sm:p-5"
    >
      <h2 className="mb-4 text-lg font-semibold text-slate-800">
        {t('secureStripePayment')}
      </h2>
      <Elements
        stripe={stripePromise}
        options={{ clientSecret, locale: locale === 'ja' ? 'ja' : 'en' }}
      >
        <MembershipPaymentForm
          locale={locale}
          membershipInformationValid={membershipInformationValid}
          onPaymentStateChange={onPaymentStateChange}
        />
      </Elements>
    </section>
  );
}