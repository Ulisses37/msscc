import { membershipDisplayStatus } from './membershipDisplayStatus';
import type { MembershipEntry } from './MembershipDetailDrawer';

// Checkout dates are provisional until payment completes. A future end date
// must not make a pending, failed, or canceled checkout look active.
const membership = {
  status: 'pending', payment_status: 'pending', end_date: '2099-01-01',
} as MembershipEntry;

describe('membershipDisplayStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-04T12:00:00'));
  });

  afterEach(() => jest.useRealTimers());

  it.each([null, undefined, '', 'invalid', '2026-02-30'])(
    'distinguishes recorded active status from unknown expiration %p', (endDate) => {
      expect(membershipDisplayStatus({
        ...membership, status: 'active', payment_status: null, end_date: endDate,
      })).toBe('Active (expiration unknown)');
    },
  );

  it('does not infer active status from dates alone', () => {
    expect(membershipDisplayStatus({ ...membership, status: null, payment_status: null }))
      .toBe('Unknown');
  });

  it.each(['pending', 'failed', 'canceled'])(
    'gives %s payment precedence over a recorded active status', (paymentStatus) => {
      expect(membershipDisplayStatus({
        ...membership, status: 'active', payment_status: paymentStatus,
      })).not.toMatch(/^Active/);
    },
  );

  it('keeps the membership active through its end date', () => {
    expect(membershipDisplayStatus({
      ...membership, status: 'active', payment_status: 'completed', end_date: '2026-11-04',
    })).toBe('Active');
  });
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