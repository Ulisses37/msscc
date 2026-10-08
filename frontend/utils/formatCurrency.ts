/**
 * Formats a major-unit amount for display. Callers holding integer cents must
 * convert to major units before calling this shared formatter.
 */
export function formatCurrency(
  amount: number,
  locale = 'en-US',
  currency = 'USD',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
