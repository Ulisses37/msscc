'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import type { MembershipOptionId } from '@/constants/membershipOptions';
import { isValidEmail } from '@/utils/emailValidation';

interface MembershipFormProps {
  // Selection remains page-owned so this form cannot drift from the options
  // or summary by maintaining a second membership value.
  selectedOptionId: MembershipOptionId | null;
  onContinueToPayment: () => void;
  isPreparingPayment: boolean;
  isPaymentSessionReady: boolean;
  // The page supplies the live review summary so it appears immediately before
  // the readiness control without moving price data into this form.
  children: ReactNode;
}

const inputClassName =
  'mt-1 block w-full rounded-sm border border-msscc-gray-light px-3 py-2 text-sm text-msscc-gray-dark shadow-sm outline-none transition focus:border-msscc-teal focus:ring-2 focus:ring-msscc-teal/20';

export function MembershipForm({
  selectedOptionId,
  onContinueToPayment,
  isPreparingPayment,
  isPaymentSessionReady,
  children,
}: MembershipFormProps) {
  const t = useTranslations('MembershipPage');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Touched flags delay errors until the user leaves a field. Because each
  // error also checks current validity, correcting a value removes it at once.
  const [emailTouched, setEmailTouched] = useState(false);
  const [firstNameTouched, setFirstNameTouched] = useState(false);
  const [lastNameTouched, setLastNameTouched] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);

  const emailIsValid = isValidEmail(email.trim());
  const firstNameIsValid = firstName.trim().length > 0;
  const lastNameIsValid = lastName.trim().length > 0;
  const addressIsValid = address.trim().length > 0;

  // Phone is intentionally omitted: it is optional, and this story does not
  // define a locale-safe phone format. Stripe may request it later if needed.
  const formIsValid =
    selectedOptionId !== null &&
    emailIsValid &&
    firstNameIsValid &&
    lastNameIsValid &&
    addressIsValid;

  const showEmailError = emailTouched && !emailIsValid;
  const showFirstNameError = firstNameTouched && !firstNameIsValid;
  const showLastNameError = lastNameTouched && !lastNameIsValid;
  const showAddressError = addressTouched && !addressIsValid;

  return (
    <section
      aria-labelledby="membership-information-heading"
      className="mt-6"
    >
      <h2
        id="membership-information-heading"
        className="text-xl font-semibold text-slate-800"
      >
        {t('informationHeading')}
      </h2>

      <div className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          {t('email')}
          <input
            type="email"
            name="membershipEmail"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setEmailTouched(true)}
            required
            className={inputClassName}
            aria-invalid={showEmailError}
            aria-describedby={
              showEmailError ? 'membership-email-error' : undefined
            }
          />

          {showEmailError && (
            <span
              id="membership-email-error"
              className="mt-1 block text-sm text-red-600"
              role="alert"
            >
              {t('emailError')}
            </span>
          )}
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            {t('firstName')}
            <input
              type="text"
              name="membershipFirstName"
              autoComplete="given-name"
              maxLength={255}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              onBlur={() => setFirstNameTouched(true)}
              required
              className={inputClassName}
              aria-invalid={showFirstNameError}
              aria-describedby={
                showFirstNameError ? 'membership-first-name-error' : undefined
              }
            />

            {showFirstNameError && (
              <span
                id="membership-first-name-error"
                className="mt-1 block text-sm text-red-600"
                role="alert"
              >
                {t('firstNameRequired')}
              </span>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t('lastName')}
            <input
              type="text"
              name="membershipLastName"
              autoComplete="family-name"
              maxLength={255}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              onBlur={() => setLastNameTouched(true)}
              required
              className={inputClassName}
              aria-invalid={showLastNameError}
              aria-describedby={
                showLastNameError ? 'membership-last-name-error' : undefined
              }
            />

            {showLastNameError && (
              <span
                id="membership-last-name-error"
                className="mt-1 block text-sm text-red-600"
                role="alert"
              >
                {t('lastNameRequired')}
              </span>
            )}
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          {t('address')}
          <input
            type="text"
            name="membershipAddress"
            autoComplete="street-address"
            maxLength={500}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            onBlur={() => setAddressTouched(true)}
            required
            className={inputClassName}
            aria-invalid={showAddressError}
            aria-describedby={
              showAddressError ? 'membership-address-error' : undefined
            }
          />

          {showAddressError && (
            <span
              id="membership-address-error"
              className="mt-1 block text-sm text-red-600"
              role="alert"
            >
              {t('addressRequired')}
            </span>
          )}
        </label>

        <label className="block text-sm font-medium text-slate-700">
          {t('phoneOptional')}
          <input
            type="tel"
            name="membershipPhone"
            autoComplete="tel"
            maxLength={50}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClassName}
          />
        </label>

        <div className="pt-2">{children}</div>

        {/* Keep the existing form validation as the gate for session creation;
            a prepared session must not trigger another PaymentIntent. */}
        <button
          type="button"
          onClick={() => {
            if (formIsValid && !isPreparingPayment && !isPaymentSessionReady) {
              onContinueToPayment();
            }
          }}
          disabled={!formIsValid || isPreparingPayment || isPaymentSessionReady}
          className="rounded-sm bg-msscc-pink px-5 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60"
        >
          {isPreparingPayment
            ? t('preparingPayment')
            : isPaymentSessionReady
              ? t('paymentSessionReady')
              : t('continueToPayment')}
        </button>
      </div>
    </section>
  );
}