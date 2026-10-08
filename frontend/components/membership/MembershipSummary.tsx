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
  // No line items tells the shared summary to render its unselected state.
  // The zero total below is therefore a safe fallback and is never displayed.
  const lines: readonly PaymentCostLine[] = selectedOption
    ? [
        {
          id: selectedOption.id,
          label: selectedOption.name,
          amountInCents: selectedOption.displayPriceInCents,
        },
      ]
    : [];

  return (
    <PaymentCostSummary
      summaryId="membership-summary"
      heading="Membership summary"
      emptyMessage="Select a membership option to review the total."
      lines={lines}
      totalLabel="Total due"
      totalAmountInCents={selectedOption?.displayPriceInCents ?? 0}
      currency={selectedOption?.currency ?? 'USD'}
      locale={locale}
    />
  );
}
