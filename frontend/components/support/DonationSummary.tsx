'use client';

import { useLocale, useTranslations } from 'next-intl';

export type PaymentType = 'card' | 'paypal';

interface DonationSummaryProps {
  donation: string;
  paymentType: PaymentType;
  email: string;
  name: string;
  address: string;
  cardNumber: string;
}

export function DonationSummary({
  donation,
  paymentType,
  email,
  name,
  address,
  cardNumber,
}: DonationSummaryProps) {
  const t = useTranslations('SupportPage');
  const locale = useLocale();
  const donationIsValid = /^\d+(\.\d{1,2})?$/.test(donation) && Number(donation) > 0;

  const formattedDonation =
    donation === ''
      ? t('notProvided')
      : donationIsValid
        ? new Intl.NumberFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(Number(donation))
        : t('invalidAmount');

  return (
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
            {email || t('notProvided')}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-msscc-gray-mid">{t('name')}</dt>
          <dd className="text-right text-msscc-gray-dark">{name || t('notProvided')}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-msscc-gray-mid">{t('address')}</dt>
          <dd className="text-right text-msscc-gray-dark">{address || t('notProvided')}</dd>
        </div>
        {paymentType === 'card' && (
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-msscc-gray-mid">{t('cardNumber')}</dt>
            <dd className="text-right text-msscc-gray-dark">
              {cardNumber ? `•••• ${cardNumber.slice(-4)}` : t('notProvided')}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}
