/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import { MembershipDetailDrawer } from './MembershipDetailDrawer';
import type { MembershipEntry } from './MembershipDetailDrawer';

const membership: MembershipEntry = {
  membership_id: 1, first_name: 'Test', last_name: 'Member', email: null, phone: null,
  membership_type: 'individual', amount_paid: null, payment_status: null,
  reference_id: 'test', start_date: null, end_date: '2026-02-30', renewal_date: undefined,
  status: 'active', notes: '', created_at: 'invalid', updated_at: '',
};

function fieldValue(label: string): HTMLElement {
  const field = screen.getByText(label).closest('div');
  if (!field) throw new Error(`Missing field: ${label}`);
  return within(field).getByRole('definition');
}

describe('MembershipDetailDrawer nullable values', () => {
  it('displays the stored address as multiline plain text and price independently of payment', () => {
    const address = '123 Example Street\n松山市, 日本\n<b>Not markup</b>';
    render(<MembershipDetailDrawer membership={{
      ...membership, address, membership_price: '35.00', amount_paid: '10.00',
      record_source: 'checkout',
    }} onClose={jest.fn()} />);
    expect(fieldValue('Address').textContent).toBe(address);
    expect(fieldValue('Address')).toHaveClass('whitespace-pre-wrap');
    expect(fieldValue('Address').querySelector('b')).toBeNull();
    expect(fieldValue('Membership price')).toHaveTextContent('$35.00');
    expect(fieldValue('Amount paid')).toHaveTextContent('$10.00');
    expect(fieldValue('Record origin')).toHaveTextContent('Checkout');
  });

  it.each([null, undefined, '', ' \n '])('shows a fallback for missing address %p', (address) => {
    render(<MembershipDetailDrawer membership={{ ...membership, address }} onClose={jest.fn()} />);
    expect(fieldValue('Address')).toHaveTextContent('Not provided');
  });

  it.each([null, undefined, ''])('does not invent a missing price %p', (membershipPrice) => {
    render(<MembershipDetailDrawer membership={{
      ...membership, membership_price: membershipPrice,
    }} onClose={jest.fn()} />);
    expect(fieldValue('Membership price')).toHaveTextContent('Unknown');
  });

  it.each([0, '0.00'])('preserves a known zero membership price %p', (membershipPrice) => {
    render(<MembershipDetailDrawer membership={{
      ...membership, membership_price: membershipPrice,
    }} onClose={jest.fn()} />);
    expect(fieldValue('Membership price')).toHaveTextContent('$0.00');
  });

  it.each([
    ['checkout', 'Checkout'], ['manual', 'Manual entry'], ['legacy_import', 'Legacy import'],
    [null, 'Unknown'], [undefined, 'Unknown'], ['', 'Unknown'], ['other', 'Unknown'],
    ['toString', 'Unknown'],
  ])('labels record origin %p as %s', (recordSource, label) => {
    render(<MembershipDetailDrawer membership={{
      ...membership, record_source: recordSource,
    }} onClose={jest.fn()} />);
    expect(fieldValue('Record origin')).toHaveTextContent(label as string);
  });

  it('renders unknown payments and missing or invalid dates safely', () => {
    render(<MembershipDetailDrawer membership={membership} onClose={jest.fn()} />);
    expect(fieldValue('Amount paid')).toHaveTextContent('Unknown');
    expect(fieldValue('Payment status')).toHaveTextContent('Not provided');
    for (const label of ['Start date', 'End date', 'Renewal date', 'Created', 'Updated']) {
      expect(fieldValue(label)).toHaveTextContent('Not provided');
    }
    expect(fieldValue('Current status')).toHaveTextContent('Active (expiration unknown)');
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('renders a known zero payment as zero', () => {
    render(<MembershipDetailDrawer
      membership={{ ...membership, amount_paid: '0.00' }} onClose={jest.fn()}
    />);
    expect(fieldValue('Amount paid')).toHaveTextContent('$0.00');
  });
});