'use client';

import { useTranslations } from 'next-intl';

import {
  PaymentCostSummary,
  type PaymentCostLine,
} from '@/components/payments/PaymentCostSummary';
import type { MembershipOption } from '@/constants/membershipOptions';
import type { DonationQuote } from '@/services/paymentService';

interface MembershipSummaryProps {
  selectedOption: MembershipOption | null;
  locale: string;
  quote?: DonationQuote | null;
}

export function MembershipSummary({
  selectedOption,
  locale,
  quote,
}: MembershipSummaryProps) {
  const t = useTranslations('MembershipPage');

  // No line items tells the shared summary to render its unselected state.
  // The zero total below is therefore a safe fallback and is never displayed.
  const lines: readonly PaymentCostLine[] = selectedOption && quote
    ? [
        {
          id: selectedOption.id,
          label: t(`options.${selectedOption.id}`),
          amountInCents: Math.round(Number(quote.amount) * 100),
        },
        { id: 'processing', label: t('processingCostAmount'),
          amountInCents: Math.round(Number(quote.processingCostContribution) * 100) },
      ]
    : [];

  return (
    <PaymentCostSummary
      summaryId="membership-summary"
      heading={t('summaryHeading')}
      emptyMessage={t('summaryEmpty')}
      lines={lines}
      totalLabel={t('totalDue')}
      totalAmountInCents={quote ? Math.round(Number(quote.totalAmount) * 100) : 0}
      currency={selectedOption?.currency ?? 'USD'}
      locale={locale}
    />
  );
}
