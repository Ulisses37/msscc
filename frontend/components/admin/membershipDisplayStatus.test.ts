import { membershipDisplayStatus } from './membershipDisplayStatus';
import type { MembershipEntry } from './MembershipDetailDrawer';

// Checkout dates are provisional until payment completes. A future end date
// must not make a pending, failed, or canceled checkout look active.
const membership = {
  status: 'pending', payment_status: 'pending', end_date: '2099-01-01',
} as MembershipEntry;

describe('membershipDisplayStatus', () => {
  it('does not call a pending checkout active because of provisional dates', () => {
    expect(membershipDisplayStatus(membership)).toBe('Pending');
  });

  it('shows failed and canceled checkouts without activating them', () => {
    expect(membershipDisplayStatus({ ...membership, payment_status: 'failed' })).toBe('Payment failed');
    expect(membershipDisplayStatus({ ...membership, payment_status: 'canceled' })).toBe('Canceled');
  });

  it('shows completed active memberships by their expiration', () => {
    // Only an activated membership should be judged by its end date.
    const active = { ...membership, status: 'active', payment_status: 'completed' };
    expect(membershipDisplayStatus(active)).toBe('Active');
    expect(membershipDisplayStatus({ ...active, end_date: '2000-01-01' })).toBe('Expired');
  });
});