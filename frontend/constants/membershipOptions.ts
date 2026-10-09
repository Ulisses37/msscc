export type MembershipOptionId =
  | 'student'
  | 'individual'
  | 'family'
  | 'corporate';

export interface MembershipOption {
  id: MembershipOptionId;
  displayPriceInCents: number;
  currency: 'USD';
}

// These prices are for display only.
// A later payment request must send the option ID.
// The backend must independently determine the trusted payment amount.
export const MEMBERSHIP_OPTIONS: readonly MembershipOption[] = [
  {
    id: 'student',
    displayPriceInCents: 2_000,
    currency: 'USD',
  },
  {
    id: 'individual',
    displayPriceInCents: 3_500,
    currency: 'USD',
  },
  {
    id: 'family',
    displayPriceInCents: 5_000,
    currency: 'USD',
  },
  {
    id: 'corporate',
    displayPriceInCents: 25_000,
    currency: 'USD',
  },
];

export function formatMembershipPrice(
  option: MembershipOption,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: option.currency,
  }).format(option.displayPriceInCents / 100);
}