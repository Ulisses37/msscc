'use client';

import { useTranslations } from 'next-intl';

import {
  PaymentCostSummary,
  type PaymentCostLine,
} from '@/components/payments/PaymentCostSummary';
import type { MembershipOption } from '@/constants/membershipOptions';

interface MembershipSummaryProps {
  selectedOption: MembershipOption | null;
  locale: string;
}

export function MembershipSummary({
  selectedOption,
  locale,
}: MembershipSummaryProps) {
  const t = useTranslations('MembershipPage');

  // No line items tells the shared summary to render its unselected state.
  // The zero total below is therefore a safe fallback and is never displayed.
  const lines: readonly PaymentCostLine[] = selectedOption
    ? [
        {
          id: selectedOption.id,
          label: t(`options.${selectedOption.id}`),
          amountInCents: selectedOption.displayPriceInCents,
        },
      ]
    : [];

  return (
    <PaymentCostSummary
      summaryId="membership-summary"
      heading={t('summaryHeading')}
      emptyMessage={t('summaryEmpty')}
      lines={lines}
      totalLabel={t('totalDue')}
      totalAmountInCents={selectedOption?.displayPriceInCents ?? 0}
      currency={selectedOption?.currency ?? 'USD'}
      locale={locale}
    />
  );
}
