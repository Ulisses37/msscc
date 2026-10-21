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