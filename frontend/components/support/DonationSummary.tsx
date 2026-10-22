'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatCurrency } from '@/utils/formatCurrency';
import { isValidDonationAmount } from '@/constants/donationAmounts';

interface DonationSummaryProps {
  donation: string;
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  isAnonymous: boolean;
  message: string;
}

/**
 * Displays the non-payment donation information for review.
 *
 * Payment details are intentionally excluded because Stripe collects and
 * displays them inside its secure Payment Element.
 */
export function DonationSummary({
  donation,
  email,
  firstName,
  lastName,
  address,
  isAnonymous,
  message,
}: DonationSummaryProps) {
  const t = useTranslations('SupportPage');
  const locale = useLocale();

  // Use the same validity rule as checkout: the summary must not present an
  // amount the API would reject as a payable total.
  const donationIsValid = isValidDonationAmount(donation);

  const formattedDonation =
    donation === ''
      ? t('notProvided')
      : donationIsValid
        ? formatCurrency(Number(donation), locale === 'ja' ? 'ja-JP' : 'en-US')
        : t('invalidAmount');

  return (
    <section
      aria-labelledby="donation-summary-heading"
      className="rounded-sm border border-msscc-gray-light bg-gray-50 p-4 sm:p-5"
    >
      <h3
        id="donation-summary-heading"
        className="mb-4 text-lg font-semibold text-msscc-teal"
      >
        {t('summaryHeading')}
      </h3>

      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-3 sm:gap-4">
          <dt className="font-medium text-msscc-gray-mid">
            {t('donationAmount')}
          </dt>
          <dd className="text-right text-msscc-gray-dark">
            {formattedDonation}
          </dd>
        </div>

        <div className="flex justify-between gap-3 sm:gap-4">
          <dt className="font-medium text-msscc-gray-mid">
            {t('email')}
          </dt>
          <dd className="break-all text-right text-msscc-gray-dark">
            {email || t('notProvided')}
          </dd>
        </div>

        <div className="flex justify-between gap-3 sm:gap-4">
          <dt className="font-medium text-msscc-gray-mid">
            {t('name')}
          </dt>
          <dd className="text-right text-msscc-gray-dark">
            {[firstName, lastName].filter(Boolean).join(' ') ||
              t('notProvided')}
          </dd>
        </div>

        <div className="flex justify-between gap-3 sm:gap-4">
          <dt className="font-medium text-msscc-gray-mid">
            {t('address')}
          </dt>
          <dd className="text-right text-msscc-gray-dark">
            {address || t('notProvided')}
          </dd>
        </div>

        <div className="flex justify-between gap-3 sm:gap-4">
          <dt className="font-medium text-msscc-gray-mid">
            {t('anonymousDonation')}
          </dt>
          <dd className="text-right text-msscc-gray-dark">
            {isAnonymous ? t('yes') : t('no')}
          </dd>
        </div>

        <div className="flex justify-between gap-3 sm:gap-4">
          <dt className="font-medium text-msscc-gray-mid">
            {t('message')}
          </dt>
          <dd className="max-w-[65%] whitespace-pre-wrap text-right text-msscc-gray-dark">
            {message || t('notProvided')}
          </dd>
        </div>
      </dl>
    </section>
  );
}