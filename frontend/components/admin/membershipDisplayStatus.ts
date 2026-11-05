import { parseMembershipDate } from '@/utils/membershipValues';

import type { MembershipEntry } from './MembershipDetailDrawer';

/** Checkout rows have provisional dates until a verified payment activates them. */
export function membershipDisplayStatus(membership: MembershipEntry): string {
  const paymentStatus = membership.payment_status?.trim().toLowerCase();
  const status = membership.status?.trim().toLowerCase();
  if (paymentStatus === 'failed') return 'Payment failed';
  if (paymentStatus === 'canceled' || paymentStatus === 'cancelled') return 'Canceled';
  if (status === 'pending' || paymentStatus === 'pending') return 'Pending';
  if (status !== 'active') return membership.status?.trim() || 'Unknown';
  const endDate = parseMembershipDate(membership.end_date);
  if (!endDate) return 'Active (expiration unknown)';
  endDate.setHours(23, 59, 59, 999);
  return endDate.getTime() < Date.now() ? 'Expired' : 'Active';
}