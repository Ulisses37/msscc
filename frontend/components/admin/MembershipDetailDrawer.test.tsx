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