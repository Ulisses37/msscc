'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { DonationSummary } from '@/components/support/DonationSummary';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';
import { StripePaymentElement } from '@/components/support/StripePaymentElement';
import {
  DEFAULT_DONATION_AMOUNT,
  DONATION_PRESET_AMOUNTS,
  isValidDonationAmount,
} from '@/constants/donationAmounts';
import { subscribeToUpdates } from '@/services/emailService';
import { createPaymentSession } from '@/services/paymentService';
import { formatCurrency } from '@/utils/formatCurrency';

const inputClassName =
  'mt-1 block w-full rounded-sm border border-msscc-gray-light px-3 py-2 text-sm text-msscc-gray-dark shadow-sm outline-none transition focus:border-msscc-teal focus:ring-2 focus:ring-msscc-teal/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60';

interface DonationResponse {
  reference_id: string;
}

type PaymentStatus = 'pending' | 'completed' | 'failed' | 'canceled';

interface PaymentStatusResponse {
  payment_status?: unknown;
  confirmation_reference?: unknown;
}

const isPaymentStatus = (value: unknown): value is PaymentStatus =>
  value === 'pending' ||
  value === 'completed' ||
  value === 'failed' ||
  value === 'canceled';

export function DonationForm() {
  const t = useTranslations('SupportPage');
  const locale = useLocale();

  // Non-payment donation information remains in application state.
  // The choice is the source of truth: a custom value is never inferred from
  // its numeric similarity to a preset. Keep only the donor's custom entry in
  // separate state so changing the preset catalog requires no form rewiring.
  const [selectedAmount, setSelectedAmount] = useState<string | null>(DEFAULT_DONATION_AMOUNT);
  const [customAmount, setCustomAmount] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState('');
  // Opt-in checkbox: joining the mailing list is independent of the payment.
  const [wantsUpdates, setWantsUpdates] = useState(false);

  // Values displayed in the existing donation summary.
  const [summaryEmail, setSummaryEmail] = useState('');
  const [summaryFirstName, setSummaryFirstName] = useState('');
  const [summaryLastName, setSummaryLastName] = useState('');
  const [summaryAddress, setSummaryAddress] = useState('');
  const [summaryMessage, setSummaryMessage] = useState('');

  // Validation and submission state.
  const [donationTouched, setDonationTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const submissionInFlight = useRef(false);

  // This result comes from the Donation record updated by Stripe's signed
  // webhook. A successful browser redirect alone is not treated as proof of
  // payment.
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    null,
  );
  const [paymentStatusError, setPaymentStatusError] = useState(false);
  const [receiptReference, setReceiptReference] = useState('');

  // The donation reference associates the database record with Stripe.
  const [submittedReference, setSubmittedReference] = useState('');
  // Snapshot the amount that was actually saved with the donation. If Stripe
  // session creation fails, retry with this amount and the existing reference;
  // changing either would cause the backend's amount comparison to reject it.
  const [submittedAmount, setSubmittedAmount] = useState('');

  // Stripe uses this client secret to render the Payment Element.
  // This is not the Stripe account's secret API key.
  const [clientSecret, setClientSecret] = useState('');

  const clearReturnedSessionFromUrl = () => {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete('session_id');
    window.history.replaceState(
      {},
      '',
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
  };

  const handleEditDonationDetails = () => {
    // Preserve the entered form values, but discard the old Stripe session
    // and Donation reference. The next submission creates a new attempt so
    // late webhooks from the failed attempt cannot overwrite the new one.
    setClientSecret('');
    setSubmittedReference('');
    setSubmittedAmount('');
    setPaymentStatus(null);
    setReceiptReference('');
    setPaymentStatusError(false);
    setSubmitError('');
    clearReturnedSessionFromUrl();
  };

  const handleStartNewAttempt = () => {
    setClientSecret('');
    setSubmittedReference('');
    setSubmittedAmount('');
    setPaymentStatus(null);
    setReceiptReference('');
    setPaymentStatusError(false);
    setSubmitError('');
    clearReturnedSessionFromUrl();
  };

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get(
      'session_id',
    );

    if (!sessionId) return;

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attemptCount = 0;
    const maximumAttempts = 10;

    // The webhook may arrive just after Stripe redirects the browser. Poll
    // briefly so a pending record can change to its authoritative outcome.
    const checkPaymentStatus = async () => {
      attemptCount += 1;

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/status/?session_id=${encodeURIComponent(sessionId)}`,
          { cache: 'no-store' },
        );
        const data = (await response
          .json()
          .catch(() => null)) as PaymentStatusResponse | null;
        const nextStatus = data?.payment_status;

        if (!response.ok || !isPaymentStatus(nextStatus)) {
          throw new Error('Payment status request failed.');
        }

        if (isCancelled) return;

        // Only the confirmed backend status supplies a receipt lookup key;
        // submitted form state and Stripe URL values are never receipt data.
        setReceiptReference(
          nextStatus === 'completed' &&
          typeof data?.confirmation_reference === 'string' &&
          /^DON-[0-9]{8,}$/.test(data.confirmation_reference)
            ? data.confirmation_reference : '',
        );
        setPaymentStatus(nextStatus);
        setPaymentStatusError(false);

        if (nextStatus === 'pending' && attemptCount < maximumAttempts) {
          timeoutId = setTimeout(checkPaymentStatus, 1500);
        }
      } catch {
        if (!isCancelled) {
          setPaymentStatusError(true);
        }
      }
    };

    // Show an honest pending state while the first database lookup runs.
    setPaymentStatus('pending');
    setPaymentStatusError(false);
    void checkPaymentStatus();

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const paymentStatusMessage = paymentStatus
    ? {
        pending: t('paymentPending'),
        completed: t('paymentCompleted'),
        failed: t('paymentFailed'),
        canceled: t('paymentCanceled'),
      }[paymentStatus]
    : '';

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
    email.trim(),
  );

  // One effective amount feeds validation, the review summary, the donation
  // record and Stripe session. A missing/unknown option cannot fall back to a
  // previously entered amount, even if the UI normally starts with $5 selected.
  const donation = selectedAmount === 'custom'
    ? customAmount
    : selectedAmount && DONATION_PRESET_AMOUNTS.some((amount) => amount === selectedAmount)
      ? selectedAmount
      : '';
  const donationIsValid = isValidDonationAmount(donation);

  const formIsValid =
    emailIsValid &&
    donationIsValid &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    address.trim().length > 0;

  // Lock the donation details after the database record is created.
  // This keeps the stored donation and Stripe session amounts consistent.
  // Freeze amount controls during the record request too: otherwise a click
  // while awaiting POST could show a different amount from the submitted one.
  const fieldsAreLocked = submittedReference.length > 0 || isSubmitting;

  /**
   * Create the donation record and prepare its Stripe Checkout Session.
   *
   * This does not collect or transmit card information. Stripe's embedded
   * Payment Element handles payment details after this method finishes.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !formIsValid ||
      clientSecret ||
      isSubmitting ||
      submissionInFlight.current
    ) {
      return;
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);
    setSubmitError('');

    // If session creation previously failed, reuse the existing donation
    // reference instead of creating a duplicate donation record.
    const amountForAttempt = submittedReference ? submittedAmount : donation;
    if (!amountForAttempt) {
      submissionInFlight.current = false;
      setIsSubmitting(false);
      return;
    }
    let donationReference = submittedReference;
    let donationWasCreated = donationReference.length > 0;

    try {
      if (!donationReference) {
        const donationResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/donations/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              donor_first_name: firstName.trim(),
              donor_last_name: lastName.trim(),
              donor_email: email.trim().toLowerCase(),
              amount: amountForAttempt,
              is_anonymous: isAnonymous,
              message: message.trim(),
            }),
          },
        );

        const donationData = (await donationResponse
          .json()
          .catch(() => null)) as DonationResponse | null;

        if (
          !donationResponse.ok ||
          typeof donationData?.reference_id !== 'string'
        ) {
          throw new Error('Donation request failed.');
        }

        donationReference = donationData.reference_id;
        donationWasCreated = true;
        setSubmittedAmount(amountForAttempt);
        setSubmittedReference(donationReference);
      }

      // Only after the donation record exists. This is deliberately not
      // awaited: the backend makes synchronous Resend calls, and a mailing-list
      // signup must never delay checkout. Failures are logged and ignored.
      if (wantsUpdates) {
        subscribeToUpdates(email.trim().toLowerCase(), 'donation').catch(
          (error: unknown) => {
            console.error('Mailing-list signup failed after a donation.', error);
          },
        );
      }

      // Use the reusable PR1 endpoint to create a Stripe Checkout Session.
      const paymentSession = await createPaymentSession({
        amount: amountForAttempt,
        currency: 'usd',
        paymentPurpose: 'Donation',
        internalReference: donationReference,
      });

      // Supplying this value causes StripePaymentElement to render.
      setClientSecret(paymentSession.clientSecret);
    } catch {
      setSubmitError(
        donationWasCreated ? t('paymentSessionError') : t('submitError'),
      );
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mt-12 w-full px-0 sm:mt-16 sm:px-6">
      <h2 className="mb-6 mt-16 text-2xl font-bold text-[#264653]">
        {t('heading')}
      </h2>

      {paymentStatusError && (
        <div
          className="mb-6 max-w-[600px] rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <p>{t('paymentResultUnavailable')}</p>
          <button
            type="button"
            onClick={handleStartNewAttempt}
            className="mt-3 rounded-md border border-current px-4 py-2 font-semibold transition-colors hover:bg-white/60"
          >
            {t('startNewDonationAttempt')}
          </button>
        </div>
      )}

      {!paymentStatusError && paymentStatus && (
        <div
          className={`mb-6 max-w-[600px] rounded-md border p-4 text-sm ${
            paymentStatus === 'completed'
              ? 'border-green-200 bg-green-50 text-green-800'
              : paymentStatus === 'pending'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-800'
          }`}
          role={paymentStatus === 'pending' ? 'status' : 'alert'}
          aria-live="polite"
        >
          <p>{paymentStatusMessage}</p>
          {paymentStatus === 'completed' && (
            receiptReference ? (
              <PaymentReceipt
                reference={receiptReference}
                locale={locale}
              />
            ) : (
              <p className="mt-4 text-slate-700">{t('receiptUnavailable')}</p>
            )
          )}

          {(paymentStatus === 'failed' || paymentStatus === 'canceled') && (
            <button
              type="button"
              onClick={handleStartNewAttempt}
              className="mt-3 rounded-md border border-current px-4 py-2 font-semibold transition-colors hover:bg-white/60"
            >
              {t('startNewDonationAttempt')}
            </button>
          )}
        </div>
      )}

      {!paymentStatus && (
        <form
          className="max-w-[600px] space-y-6"
          onSubmit={handleSubmit}
          noValidate
        >
        <label className="block text-sm font-medium text-slate-700">
          {t('email')}
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => {
              setEmailTouched(true);
              setSummaryEmail(email);
            }}
            disabled={fieldsAreLocked}
            required
            className={inputClassName}
            aria-invalid={emailTouched && !emailIsValid}
            aria-describedby={
              emailTouched && !emailIsValid ? 'email-error' : undefined
            }
          />

          {emailTouched && !emailIsValid && (
            <p id="email-error" className="mt-1 text-sm text-red-600">
              {t('emailError')}
            </p>
          )}
        </label>

        <fieldset className="min-w-0" aria-describedby="donation-options-description">
          <legend className="text-sm font-medium text-slate-700">
            {t('donationAmount')}
          </legend>
          <p id="donation-options-description" className="mt-1 text-sm text-slate-600">
            {t('donationOptionsDescription')}
          </p>

          {/* Native radios share a name for arrow-key navigation and expose the
              current choice to screen readers. Match the membership card grid,
              including a single column on narrow screens. */}
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
            {DONATION_PRESET_AMOUNTS.map((amount) => {
              const isSelected = selectedAmount === amount;

              return (
                <label
                  key={amount}
                  className={`flex min-w-0 max-w-full items-center gap-2 rounded-md border px-3 py-2.5 transition-colors ${
                    isSelected
                      ? 'border-pink-700 bg-pink-50 ring-1 ring-pink-700'
                      : 'border-slate-300 bg-white hover:border-pink-500'
                  } ${fieldsAreLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="donationOption"
                    value={amount}
                    checked={isSelected}
                    onChange={() => {
                      if (fieldsAreLocked) return;
                      // Keep the existing summary and amount input synchronized
                      // until the flow integration is completed in SCRUM-738.
                      setSelectedAmount(amount);
                      setDonationTouched(false);
                    }}
                    disabled={fieldsAreLocked}
                    className="h-4 w-4 shrink-0 accent-pink-700"
                  />
                  <span className="min-w-0 break-words text-sm font-medium text-slate-800">
                    {formatCurrency(Number(amount), locale === 'ja' ? 'ja-JP' : 'en-US')}
                  </span>
                </label>
              );
            })}

            <label
              className={`flex min-w-0 max-w-full items-center gap-2 rounded-md border px-3 py-2.5 transition-colors ${
                selectedAmount === 'custom'
                  ? 'border-pink-700 bg-pink-50 ring-1 ring-pink-700'
                  : 'border-slate-300 bg-white hover:border-pink-500'
              } ${fieldsAreLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <input
                type="radio"
                name="donationOption"
                value="custom"
                checked={selectedAmount === 'custom'}
                onChange={() => {
                  if (fieldsAreLocked) return;
                  // Do not carry a previously selected preset into the custom
                  // field as if the donor had typed it. This also prevents an
                  // old preset from appearing in the review summary.
                  setSelectedAmount('custom');
                  setCustomAmount('');
                  setDonationTouched(false);
                }}
                disabled={fieldsAreLocked}
                className="h-4 w-4 shrink-0 accent-pink-700"
              />
              <span className="min-w-0 break-words text-sm font-medium text-slate-800">
                {t('customDonationOption')}
              </span>
            </label>
          </div>

          {selectedAmount === 'custom' && (
            <div className="mt-3 min-w-0">
              <label className="block text-sm font-medium text-slate-700">
                {t('customDonationAmount')}
                <input
                  type="text"
                  name="donationAmount"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(event) => {
                    setCustomAmount(event.target.value);
                  }}
                  onBlur={() => {
                    setDonationTouched(true);
                  }}
                  placeholder={t('donationPlaceholder')}
                  disabled={fieldsAreLocked}
                  required
                  className={inputClassName}
                  aria-invalid={donationTouched && !donationIsValid}
                  aria-describedby={
                    donationTouched && !donationIsValid
                      ? 'donation-amount-error'
                      : undefined
                  }
                />
              </label>

              {/* Keep the error out of the label: assistive technology should
                  announce it as a description, not rename the amount field. */}
              {donationTouched && !donationIsValid && (
                <p id="donation-amount-error" className="mt-1 text-sm text-red-600">
                  {t('donationAmountError')}
                </p>
              )}
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            {t('firstName')}
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              maxLength={255}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              onBlur={() => setSummaryFirstName(firstName)}
              disabled={!emailIsValid || fieldsAreLocked}
              required
              className={inputClassName}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t('lastName')}
            <input
              type="text"
              name="lastName"
              autoComplete="family-name"
              maxLength={255}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              onBlur={() => setSummaryLastName(lastName)}
              disabled={!emailIsValid || fieldsAreLocked}
              required
              className={inputClassName}
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          {t('address')}
          <input
            type="text"
            name="address"
            autoComplete="street-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={() => setSummaryAddress(address)}
            disabled={!emailIsValid || fieldsAreLocked}
            required
            className={inputClassName}
          />
        </label>

        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="isAnonymous"
            checked={isAnonymous}
            onChange={(event) => setIsAnonymous(event.target.checked)}
            disabled={!emailIsValid || fieldsAreLocked}
            className="h-4 w-4 rounded-sm border-msscc-gray-light text-msscc-teal disabled:cursor-not-allowed disabled:opacity-60"
          />
          {t('anonymousDonation')}
        </label>

        <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="wantsUpdates"
            checked={wantsUpdates}
            onChange={(event) => setWantsUpdates(event.target.checked)}
            disabled={!emailIsValid || fieldsAreLocked}
            className="mt-0.5 h-4 w-4 rounded-sm border-msscc-gray-light text-msscc-teal disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span>
            {t('mailingListConsent')}
            <span className="mt-1 block text-caption font-normal text-msscc-gray-mid">
              {t('mailingListConsentDetail')}
            </span>
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t('message')}
          <textarea
            name="message"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onBlur={() => setSummaryMessage(message)}
            disabled={!emailIsValid || fieldsAreLocked}
            className={inputClassName}
          />

          <span className="mt-1 block text-right text-xs text-msscc-gray-mid">
            {message.length}/500
          </span>
        </label>

        <DonationSummary
          donation={donation}
          email={summaryEmail}
          firstName={summaryFirstName}
          lastName={summaryLastName}
          address={summaryAddress}
          isAnonymous={isAnonymous}
          message={summaryMessage}
        />

        {/* The first button records the donation and prepares Stripe. */}
        {!clientSecret && (
          <button
            type="submit"
            disabled={!formIsValid || isSubmitting}
            className="rounded-sm bg-msscc-pink px-5 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60"
          >
            {isSubmitting
              ? t('preparingPayment')
              : t('continueToPayment')}
          </button>
        )}

        {submitError && (
          <p className="text-sm text-red-600" role="alert">
            {submitError}
          </p>
        )}

        {/* Stripe renders its hosted payment fields after session creation. */}
        {clientSecret && (
          <StripePaymentElement
            clientSecret={clientSecret}
            email={email}
            onEditDonationDetails={handleEditDonationDetails}
          />
        )}
        </form>
      )}
    </section>
  );
}
