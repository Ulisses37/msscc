'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

import { DonationSummary } from '@/components/support/DonationSummary';
import { StripePaymentElement } from '@/components/support/StripePaymentElement';
import { createPaymentSession } from '@/services/paymentService';

const inputClassName =
  'mt-1 block w-full rounded-sm border border-msscc-gray-light px-3 py-2 text-sm text-msscc-gray-dark shadow-sm outline-none transition focus:border-msscc-teal focus:ring-2 focus:ring-msscc-teal/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60';

interface DonationResponse {
  reference_id: string;
}

export function DonationForm() {
  const t = useTranslations('SupportPage');

  // Non-payment donation information remains in application state.
  const [donation, setDonation] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState('');

  // Values displayed in the existing donation summary.
  const [summaryDonation, setSummaryDonation] = useState('');
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

  // The donation reference associates the database record with Stripe.
  const [submittedReference, setSubmittedReference] = useState('');

  // Stripe uses this client secret to render the Payment Element.
  // This is not the Stripe account's secret API key.
  const [clientSecret, setClientSecret] = useState('');

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
    email.trim(),
  );

  const donationIsValid =
    /^\d+(\.\d{1,2})?$/.test(donation) && Number(donation) > 0;

  const formIsValid =
    emailIsValid &&
    donationIsValid &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    address.trim().length > 0;

  // Lock the donation details after the database record is created.
  // This keeps the stored donation and Stripe session amounts consistent.
  const fieldsAreLocked = submittedReference.length > 0;

  /**
   * Create the donation record and prepare its Stripe Checkout Session.
   *
   * This does not collect or transmit card information. Stripe's embedded
   * Payment Element handles payment details after this method finishes.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formIsValid || clientSecret || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError('');

    // If session creation previously failed, reuse the existing donation
    // reference instead of creating a duplicate donation record.
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
              amount: donation,
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
        setSubmittedReference(donationReference);
      }

      // Use the reusable PR1 endpoint to create a Stripe Checkout Session.
      const paymentSession = await createPaymentSession({
        amount: donation,
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
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mt-12 w-full px-0 sm:mt-16 sm:px-6">
      <h2 className="mb-6 mt-16 text-2xl font-bold text-[#264653]">
        {t('heading')}
      </h2>

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

        <label className="block text-sm font-medium text-slate-700">
          {t('donationAmount')}
          <input
            type="text"
            name="donationAmount"
            inputMode="decimal"
            value={donation}
            onChange={(event) => setDonation(event.target.value)}
            onBlur={() => {
              setDonationTouched(true);
              setSummaryDonation(donation);
            }}
            placeholder={t('donationPlaceholder')}
            disabled={!emailIsValid || fieldsAreLocked}
            required
            className={inputClassName}
            aria-invalid={donationTouched && !donationIsValid}
            aria-describedby={
              donationTouched && !donationIsValid
                ? 'donation-amount-error'
                : undefined
            }
          />

          {donationTouched && !donationIsValid && (
            <p
              id="donation-amount-error"
              className="mt-1 text-sm text-red-600"
            >
              {t('donationAmountError')}
            </p>
          )}
        </label>

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
          donation={summaryDonation}
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
          />
        )}
      </form>
    </section>
  );
}