import type { MembershipEntry } from './MembershipDetailDrawer';

/** Checkout rows have provisional dates until a verified payment activates them. */
export function membershipDisplayStatus(membership: MembershipEntry): string {
  if (membership.payment_status.toLowerCase() === 'failed') return 'Payment failed';
  if (membership.payment_status.toLowerCase() === 'canceled') return 'Canceled';
  if (membership.status.toLowerCase() === 'pending' ||
      membership.payment_status.toLowerCase() === 'pending') return 'Pending';
  if (membership.status.toLowerCase() !== 'active') return membership.status || 'Inactive';
  return new Date(`${membership.end_date}T23:59:59`).getTime() < Date.now()
    ? 'Expired' : 'Active';
}