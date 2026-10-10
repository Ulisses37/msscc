import { formatCurrency } from '@/utils/formatCurrency';

/**
 * Keeps monetary inputs in integer cents until display formatting to avoid
 * introducing floating-point values into selection or payment state.
 */
export interface PaymentCostLine {
  id: string;
  label: string;
  amountInCents: number;
}

interface PaymentCostSummaryProps {
  summaryId: string;
  heading: string;
  headingLevel?: 'h2' | 'h3';
  emptyMessage: string;
  lines: readonly PaymentCostLine[];
  totalLabel: string;
  totalAmountInCents: number;
  currency: string;
  locale: string;
}

export function PaymentCostSummary({
  summaryId,
  heading,
  headingLevel = 'h2',
  emptyMessage,
  lines,
  totalLabel,
  totalAmountInCents,
  currency,
  locale,
}: PaymentCostSummaryProps) {
  const Heading = headingLevel;

  // The deterministic ID gives the region an accessible name. Polite live
  // updates announce selection changes without interrupting the user.
  const headingId = `${summaryId}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      aria-live="polite"
      className="rounded-sm border border-msscc-gray-light bg-gray-50 p-4 sm:p-5"
    >
      <Heading
        id={headingId}
        className="mb-4 text-lg font-semibold text-msscc-teal"
      >
        {heading}
      </Heading>

      {lines.length === 0 ? (
        <p className="text-sm text-msscc-gray-mid">{emptyMessage}</p>
      ) : (
        <dl className="space-y-3 text-sm">
          {lines.map((line) => (
            <div
              key={line.id}
              className="flex min-w-0 justify-between gap-3 sm:gap-4"
            >
              <dt className="min-w-0 break-words font-medium text-msscc-gray-mid">
                {line.label}
              </dt>

              <dd className="shrink-0 text-right text-msscc-gray-dark">
                {formatCurrency(
                  line.amountInCents / 100,
                  locale,
                  currency,
                )}
              </dd>
            </div>
          ))}

          <div className="flex min-w-0 justify-between gap-3 border-t border-msscc-gray-light pt-3 sm:gap-4">
            <dt className="font-semibold text-msscc-gray-dark">
              {totalLabel}
            </dt>

            <dd className="shrink-0 text-right font-semibold text-msscc-gray-dark">
              {formatCurrency(
                totalAmountInCents / 100,
                locale,
                currency,
              )}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
