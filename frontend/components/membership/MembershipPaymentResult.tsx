'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';

import {
  getMembershipPaymentStatus,
  type MembershipPaymentStatus,
} from '@/services/paymentService';

export const PAYMENT_STATUS_POLL_INTERVAL_MS = 3000;
export const PAYMENT_STATUS_MAX_POLL_DURATION_MS = 60000;

export function MembershipPaymentResult({
  locale,
  confirmationReference,
}: {
  locale: string;
  confirmationReference: string;
}) {
  const t = useTranslations('MembershipPaymentResult');
  const [paymentStatus, setPaymentStatus] = useState<MembershipPaymentStatus | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [takingLonger, setTakingLonger] = useState(false);
  const retryRef = useRef<((restartPolling: boolean) => void) | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let deadline = Date.now() + PAYMENT_STATUS_MAX_POLL_DURATION_MS;
    setPaymentStatus(null);
    setError(false);
    setLoading(true);
    setTakingLonger(false);

    if (!/^MEM-[0-9a-f]{32}$/.test(confirmationReference)) {
      setLoading(false);
      setError(true);
      retryRef.current = null;
      return () => {
        active = false;
      };
    }

    const checkStatus = async () => {
      // The synchronous guard prevents a rapid click and a polling tick from
      // launching concurrent reads before React updates the disabled button.
      if (!active || inFlight) return;
      inFlight = true;
      if (timer !== undefined) clearTimeout(timer);
      setLoading(true);
      setError(false);
      // A delayed response must not make the result look frozen. This timer
      // bounds the observation window even when the first request is slow.
      if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
      const remainingUntilDeadline = deadline - Date.now();
      if (remainingUntilDeadline > 0) {
        deadlineTimer = setTimeout(() => {
          if (active) {
            setTakingLonger(true);
            // Stop queued polling even when a slow response is still pending.
            if (timer !== undefined) clearTimeout(timer);
          }
        }, remainingUntilDeadline);
      } else {
        setTakingLonger(true);
      }
      try {
        const status = await getMembershipPaymentStatus(confirmationReference);
        if (!active) return;
        setPaymentStatus(status);
        if (status === 'pending') {
          const remaining = deadline - Date.now();
          if (remaining > PAYMENT_STATUS_POLL_INTERVAL_MS) {
            // Set a single timer only after this request settles, so slow
            // responses cannot pile up overlapping status requests. The
            // deadline timer ends polling rather than issuing a final request.
            timer = setTimeout(checkStatus, PAYMENT_STATUS_POLL_INTERVAL_MS);
          } else if (remaining <= 0) {
            setTakingLonger(true);
          }
        } else if (deadlineTimer !== undefined) {
          clearTimeout(deadlineTimer);
        }
      } catch {
        if (active) {
          if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
          setError(true);
        }
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };

    retryRef.current = (restartPolling) => {
      if (inFlight) return;
      // A manual retry after a request error may start a fresh bounded
      // observation window; a timed-out pending result gets one check only.
      if (restartPolling) {
        deadline = Date.now() + PAYMENT_STATUS_MAX_POLL_DURATION_MS;
        setTakingLonger(false);
      }
      void checkStatus();
    };
    void checkStatus();
    return () => {
      active = false;
      retryRef.current = null;
      if (timer !== undefined) clearTimeout(timer);
      if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
      // Ignore any late response after unmount or a reference change.
    };
  }, [confirmationReference]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <section
        aria-labelledby="membership-payment-result-heading"
        className="rounded-md border border-slate-200 bg-white p-5 sm:p-8"
      >
        <h1
          id="membership-payment-result-heading"
          className="mb-4 text-2xl font-bold text-slate-800"
        >
          {t('heading')}
        </h1>
        {loading && !paymentStatus && !error && (
          <p role="status">{takingLonger ? t('takingLonger') : t('loading')}</p>
        )}
        {error && (
          <div role="alert">
            <p>{t('statusError')}</p>
            {retryRef.current && (
              <button
                type="button"
                disabled={loading}
                onClick={() => retryRef.current?.(true)}
                className="mt-4 rounded-md bg-pink-700 px-5 py-3 text-white disabled:opacity-50"
              >
                {t('retryStatus')}
              </button>
            )}
          </div>
        )}
        {!error && paymentStatus === 'pending' && (
          <div role="status">
            <p>{takingLonger ? t('takingLonger') : t('pending')}</p>
            {takingLonger && (
              <button
                type="button"
                disabled={loading}
                onClick={() => retryRef.current?.(false)}
                className="mt-4 rounded-md bg-pink-700 px-5 py-3 text-white disabled:opacity-50"
              >
                {t('retryStatus')}
              </button>
            )}
          </div>
        )}
        {/* Match the donation success frame without changing other states. */}
        {!error && paymentStatus === 'complete' && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-800" role="status">
            <p>{t('complete')}</p>
            <PaymentReceipt locale={locale} reference={confirmationReference} />
          </div>
        )}
        {!error && (paymentStatus === 'failed' || paymentStatus === 'canceled') && (
          <div role="status">
            <p>{t(paymentStatus)}</p>
            {/* Returning to the form starts a new attempt only after the visitor
                explicitly enters details and chooses to pay again. */}
            <a
              href={`/${locale}/membership`}
              className="mt-4 inline-block rounded-md bg-pink-700 px-5 py-3 text-white"
            >
              {t('returnToPayment')}
            </a>
          </div>
        )}
      </section>
    </main>
  );
}