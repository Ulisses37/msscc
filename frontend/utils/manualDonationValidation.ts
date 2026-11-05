import { z } from 'zod';

import { MANUAL_DONATION_PAYMENT_METHODS } from '@/types/manualDonation';
import type { ManualDonationInput } from '@/types/manualDonation';

const optionalContact = (maxLength?: number) => {
  const text = maxLength === undefined ? z.string().trim() : z.string().trim().max(maxLength);
  return text.nullish().transform((value) => value || null);
};

const donationDate = z.string().trim().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid date in YYYY-MM-DD format.').refine((value) => {
  // Compare date-only values, not UTC instants that can shift the selected calendar day.
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')].join('-');
  return value <= today;
}, 'Donation date cannot be in the future.');

/** Validate only manual facts; payment status, totals, and origin belong to the server. */
export const manualDonationSchema = z.strictObject({
  donorFirstName: optionalContact(255),
  donorLastName: optionalContact(255),
  donorEmail: optionalContact(254).refine(
    (value) => value === null || z.email().safeParse(value).success,
    'Enter a valid email address.',
  ).transform((value) => value?.toLowerCase() ?? null),
  address: optionalContact(),
  amount: z.string().trim().regex(
    /^\d{1,8}(\.\d{1,2})?$/,
    'Enter a positive USD amount with up to eight integer digits and two decimal places.',
  ).refine((value) => Number(value) > 0, 'Donation amount must be greater than zero.'),
  currency: z.literal('usd').default('usd'),
  donationDate,
  paymentMethod: z.enum(MANUAL_DONATION_PAYMENT_METHODS)
    .nullish().transform((value) => value ?? null),
  isAnonymous: z.boolean().default(false),
  externalReference: z.string().trim().max(255).optional().default(''),
  message: z.string().trim().max(500).optional().default(''),
}).transform((value) => value.isAnonymous ? {
  ...value, donorFirstName: null, donorLastName: null, address: null,
} : value);

/** Normalize review/submission facts without fabricating missing donor information. */
export function validateManualDonation(input: unknown): ManualDonationInput {
  return manualDonationSchema.parse(input);
}