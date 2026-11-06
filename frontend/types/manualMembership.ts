export const MANUAL_MEMBERSHIP_STATUSES = [
  'unknown', 'active', 'inactive', 'pending', 'expired', 'canceled',
] as const;

export const MANUAL_PAYMENT_STATUSES = [
  'pending', 'completed', 'failed', 'canceled', 'waived',
] as const;

export const MANUAL_PAYMENT_METHODS = [
  'cash', 'check', 'card', 'bank_transfer', 'other',
] as const;

export type ManualMembershipStatus = typeof MANUAL_MEMBERSHIP_STATUSES[number];
export type ManualPaymentStatus = typeof MANUAL_PAYMENT_STATUSES[number];
export type ManualPaymentMethod = typeof MANUAL_PAYMENT_METHODS[number];

/** Normalized manual facts, separate from public checkout selections and pricing. */
export interface ManualMembershipInput {
  firstName: string;
  lastName: string;
  membershipType: string;
  status: ManualMembershipStatus;
  email: string | null;
  phone: string | null;
  address: string | null;
  membershipPrice: string | null;
  amountPaid: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  paymentStatus: ManualPaymentStatus | null;
  paymentMethod: ManualPaymentMethod | null;
  referenceId: string;
  notes: string;
}