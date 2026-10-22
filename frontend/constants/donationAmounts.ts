/**
 * Donation presets are client-configurable display choices, not trusted prices.
 * To change or add a choice, edit this list; the form renders every entry and
 * submits the selected amount through the existing donation/checkout flow.
 * Use plain USD decimal strings (without currency symbols or commas).
 */
export const DONATION_PRESET_AMOUNTS = ['5', '10', '25'] as const;

// Keep the initial choice explicit so reordering the list does not silently
// change the amount selected when a donor opens the form.
export const DEFAULT_DONATION_AMOUNT: string = '5';

/**
 * The backend accepts USD values from $0.01 to $99,999,999.99 (ten digits,
 * two decimal places). Reuse this rule for the form and review summary so
 * neither can disagree about whether the selected amount is payable.
 */
export function isValidDonationAmount(amount: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(amount) &&
    Number(amount) > 0 && Number(amount) <= 99_999_999.99;
}