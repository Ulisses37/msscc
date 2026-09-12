'use client';

// React and Next.js Imports
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

// Components
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';

// Types
import type { DbContentBlock } from '@/types/content';

// Project Utilities
import { fetchPageContent } from '@/utils/content';

type PaymentType = 'card' | 'paypal';

export default function SupportPage() {
  const t = useTranslations('SupportPage');
  const [donation, setDonation] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('card');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [summaryDonation, setSummaryDonation] = useState('');
  const [summaryEmail, setSummaryEmail] = useState('');
  const [summaryName, setSummaryName] = useState('');
  const [summaryAddress, setSummaryAddress] = useState('');
  const [summaryCardNumber, setSummaryCardNumber] = useState('');
  const [donationTouched, setDonationTouched] = useState(false);
  const [cardNumberTouched, setCardNumberTouched] = useState(false);
  const [securityCodeTouched, setSecurityCodeTouched] = useState(false);
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>([]);
  const params = useParams();
  const locale = params?.locale;

  // Fetch text content from the database to display on page
  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('support');
        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

    loadPageContent();
  }, []);

  const inputClassName =
    'mt-1 block w-full rounded-sm border border-msscc-gray-light px-3 py-2 text-sm text-msscc-gray-dark shadow-sm outline-none transition focus:border-msscc-teal focus:ring-2 focus:ring-msscc-teal/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60';

  const emailProvided = email.trim().length > 0;
  const donationIsValid = /^\d+(\.\d{1,2})?$/.test(donation) && Number(donation) > 0;
  const cardNumberIsValid = cardNumber.length >= 12 && cardNumber.length <= 19;
  const securityCodeIsValid = securityCode.length >= 3 && securityCode.length <= 4;
  const summaryDonationIsValid =
    /^\d+(\.\d{1,2})?$/.test(summaryDonation) && Number(summaryDonation) > 0;

  const formattedDonation =
    summaryDonation === ''
      ? t('notProvided')
      : summaryDonationIsValid
        ? new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(summaryDonation))
        : t('invalidAmount');

  return (
    <main className="mx-auto max-w-content px-6 py-10">
      {/* Display Staff-Editable Content Blocks */}
      <section className="mb-10 w-full max-w-[1200px] space-y-6">
        {contentBlocks.map((block) => (
          <ContentBlockRenderer
            key={block.content_id}
            block={block}
            locale={String(locale)}
          />
        ))}
      </section>

      <section className="mt-16 w-full px-6">
        <h2 className="mb-6 mt-16 text-2xl font-bold text-[#264653]">
          {t('heading')}
        </h2>
        <div className="max-w-[600px] space-y-6">
          <label className="block text-sm font-medium text-slate-700">
            {t('email')}
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setSummaryEmail(email)}
              required
              className={inputClassName}
            />
          </label>

          {/* Payment type selector */}
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-slate-700">
              {t('paymentType')}
            </legend>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                aria-pressed={paymentType === 'card'}
                onClick={() => setPaymentType('card')}
                disabled={!emailProvided}
                className={`rounded-sm border px-4 py-2 text-btn tracking-btn transition-colors disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60 ${
                  paymentType === 'card'
                    ? 'border-msscc-pink bg-msscc-pink text-white'
                    : 'border-msscc-teal bg-white text-msscc-teal hover:bg-msscc-teal hover:text-white'
                }`}
              >
                {t('card')}
              </button>
              <button
                type="button"
                aria-pressed={paymentType === 'paypal'}
                onClick={() => setPaymentType('paypal')}
                disabled={!emailProvided}
                className={`rounded-sm border px-4 py-2 text-btn tracking-btn transition-colors disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-60 ${
                  paymentType === 'paypal'
                    ? 'border-msscc-pink bg-msscc-pink text-white'
                    : 'border-msscc-teal bg-white text-msscc-teal hover:bg-msscc-teal hover:text-white'
                }`}
              >
                {t('paypal')}
              </button>
            </div>
          </fieldset>

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
              disabled={!emailProvided}
              required
              className={inputClassName}
              aria-invalid={donationTouched && !donationIsValid}
              aria-describedby={
                donationTouched && !donationIsValid ? 'donation-amount-error' : undefined
              }
            />
            {donationTouched && !donationIsValid && (
              <p id="donation-amount-error" className="mt-1 text-sm text-red-600">
                {t('donationAmountError')}
              </p>
            )}
          </label>

          {/* Fields required for every payment type */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              {t('name')}
              <input
                type="text"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setSummaryName(name)}
                disabled={!emailProvided}
                required
                className={inputClassName}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              {t('address')}
              <input
                type="text"
                name="address"
                autoComplete="street-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                onBlur={() => setSummaryAddress(address)}
                disabled={!emailProvided}
                required
                className={inputClassName}
              />
            </label>
          </div>

          {/* Payment-specific fields */}
          {paymentType === 'card' ? (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                {t('cardNumber')}
                <input
                  type="text"
                  name="cardNumber"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  onChange={(event) =>
                    setCardNumber(event.target.value.replace(/\D/g, '').slice(0, 19))
                  }
                  onBlur={() => {
                    setCardNumberTouched(true);
                    setSummaryCardNumber(cardNumber);
                  }}
                  disabled={!emailProvided}
                  required
                  className={inputClassName}
                  aria-invalid={cardNumberTouched && !cardNumberIsValid}
                  aria-describedby={
                    cardNumberTouched && !cardNumberIsValid ? 'card-number-error' : undefined
                  }
                />
                {cardNumberTouched && !cardNumberIsValid && (
                  <p id="card-number-error" className="mt-1 text-sm text-red-600">
                    {t('cardNumberError')}
                  </p>
                )}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  {t('expirationDate')}
                  <input
                    type="text"
                    name="expirationDate"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    placeholder="MM/YY"
                    disabled={!emailProvided}
                    required
                    className={inputClassName}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  {t('securityCode')}
                  <input
                    type="text"
                    name="securityCode"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={securityCode}
                    onChange={(event) =>
                      setSecurityCode(event.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    onBlur={() => setSecurityCodeTouched(true)}
                    disabled={!emailProvided}
                    required
                    className={inputClassName}
                    aria-invalid={securityCodeTouched && !securityCodeIsValid}
                    aria-describedby={
                      securityCodeTouched && !securityCodeIsValid
                        ? 'security-code-error'
                        : undefined
                    }
                  />
                  {securityCodeTouched && !securityCodeIsValid && (
                    <p id="security-code-error" className="mt-1 text-sm text-red-600">
                      {t('securityCodeError')}
                    </p>
                  )}
                </label>
              </div>
            </div>
          ) : (
            <p className="text-sm text-msscc-gray-mid">
              {t('paypalInstructions')}
            </p>
          )}

          {/* Live donation summary */}
          <section
            aria-labelledby="donation-summary-heading"
            className="rounded-sm border border-msscc-gray-light bg-gray-50 p-5"
          >
            <h3
              id="donation-summary-heading"
              className="mb-4 text-lg font-semibold text-msscc-teal"
            >
              {t('summaryHeading')}
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-msscc-gray-mid">{t('donationAmount')}</dt>
                <dd className="text-right text-msscc-gray-dark">{formattedDonation}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-msscc-gray-mid">{t('paymentType')}</dt>
                <dd className="text-right text-msscc-gray-dark">
                  {paymentType === 'card' ? t('card') : t('paypal')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-msscc-gray-mid">{t('email')}</dt>
                <dd className="break-all text-right text-msscc-gray-dark">
                  {summaryEmail || t('notProvided')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-msscc-gray-mid">{t('name')}</dt>
                <dd className="text-right text-msscc-gray-dark">
                  {summaryName || t('notProvided')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-msscc-gray-mid">{t('address')}</dt>
                <dd className="text-right text-msscc-gray-dark">
                  {summaryAddress || t('notProvided')}
                </dd>
              </div>
              {paymentType === 'card' && (
                <div className="flex justify-between gap-4">
                  <dt className="font-medium text-msscc-gray-mid">{t('cardNumber')}</dt>
                  <dd className="text-right text-msscc-gray-dark">
                    {summaryCardNumber
                      ? `•••• ${summaryCardNumber.replace(/\D/g, '').slice(-4)}`
                      : t('notProvided')}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </div>
      </section>

      {/* WEBSITE FOOTER: Moved outside the section to match the header style */}
      <footer className="mt-16 w-full max-w-[1200px] border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
        Matsuyama-Sacramento Sister City Corporation
      </footer>
    </main>
  );
}