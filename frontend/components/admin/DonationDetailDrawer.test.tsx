/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import { DonationDetailDrawer } from './DonationDetailDrawer';
import type { DonationEntry } from './DonationDetailDrawer';

jest.mock('@/components/admin/MailingListStatus', () => ({
  MailingListStatus: ({ resource, recordId }: { resource: string; recordId: number }) => (
    <div data-testid="mailing-list-status">{resource}:{recordId}</div>
  ),
}));

const donation: DonationEntry = {
  donation_id: 1, donor_first_name: 'Test', donor_last_name: 'Donor',
  donor_email: 'donor@example.test', amount: '10.00', processing_cost_contribution: '0.00',
  total_amount: '10.00', donation_date: '2026-11-04', is_anonymous: false,
  message: '', payment_status: 'completed', reference_id: 'DON-00000001',
  created_at: '2026-11-04T12:00:00Z',
};

function addressValue(): HTMLElement {
  const field = screen.getByText('Address').closest('div');
  if (!field) throw new Error('Missing address field');
  return within(field).getByRole('definition');
}

describe('DonationDetailDrawer addresses', () => {
  it('displays a stored multiline address as plain text', () => {
    const address = '123 Example Street\n松山市, 日本\n<b>Not markup</b>';
    render(<DonationDetailDrawer donation={{ ...donation, address }} onClose={jest.fn()} />);
    expect(addressValue().textContent).toBe(address);
    expect(addressValue()).toHaveClass('whitespace-pre-wrap');
    expect(addressValue().querySelector('b')).toBeNull();
    expect(screen.getByTestId('mailing-list-status')).toHaveTextContent('donations:1');
  });

  it.each([null, undefined, '', ' \n '])('shows a fallback for missing address %p', (address) => {
    render(<DonationDetailDrawer donation={{ ...donation, address }} onClose={jest.fn()} />);
    expect(addressValue()).toHaveTextContent('Not provided');
  });

  it.each([null, undefined, 'Private address that must not be displayed'])(
    'never displays an address for an anonymous donation (%p)', (address) => {
      render(<DonationDetailDrawer donation={{
        ...donation, is_anonymous: true, address,
      }} onClose={jest.fn()} />);
      expect(addressValue()).toHaveTextContent('Address not retained for anonymous donations.');
      expect(screen.queryByText('Private address that must not be displayed')).not.toBeInTheDocument();
    },
  );
});