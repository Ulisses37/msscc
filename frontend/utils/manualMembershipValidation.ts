import { z } from 'zod';

import {
  MANUAL_MEMBERSHIP_STATUSES,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_STATUSES,
} from '@/types/manualMembership';
import type { ManualMembershipInput } from '@/types/manualMembership';

const requiredText = z.string().trim().min(1, 'This field is required.').max(255);
const optionalText = z.string().trim().nullish().transform((value) => value || null);
const optionalContact = (maxLength: number) => z.string().trim().max(maxLength)
  .nullish().transform((value) => value || null);

// Keep decimal strings intact: Number('') would fabricate a known zero amount.
const optionalAmount = optionalText.refine(
  (value) => value === null || /^\d{1,8}(\.\d{1,2})?$/.test(value),
  'Enter a nonnegative amount with up to eight integer digits and two decimal places.',
);

const optionalDate = optionalText.refine((value) => {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid date in YYYY-MM-DD format.');

/** Shared validation for the future manual form and its review step; no checkout defaults. */
export const manualMembershipSchema = z.object({
  firstName: requiredText,
  lastName: requiredText,
  membershipType: requiredText,
  status: z.enum(MANUAL_MEMBERSHIP_STATUSES),
  email: optionalContact(254).refine(
    (value) => value === null || z.email().safeParse(value).success,
    'Enter a valid email address.',
  ).transform((value) => value?.toLowerCase() ?? null),
  phone: optionalContact(255),
  address: optionalText,
  membershipPrice: optionalAmount,
  amountPaid: optionalAmount,
  startDate: optionalDate,
  endDate: optionalDate,
  renewalDate: optionalDate,
  paymentStatus: z.enum(MANUAL_PAYMENT_STATUSES).nullish().transform((value) => value ?? null),
  paymentMethod: z.enum(MANUAL_PAYMENT_METHODS).nullish().transform((value) => value ?? null),
  referenceId: z.string().trim().max(255).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    context.addIssue({
      code: 'custom', path: ['endDate'], message: 'End date cannot precede start date.',
    });
  }
});

/** Validate and normalize form values without inferring missing membership facts. */
export function validateManualMembership(input: unknown): ManualMembershipInput {
  return manualMembershipSchema.parse(input);
}