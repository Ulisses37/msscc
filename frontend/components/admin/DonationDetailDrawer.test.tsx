/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DonationDetailDrawer } from './DonationDetailDrawer';
import type { DonationEntry } from './DonationDetailDrawer';

let mockSubscriptionLabel = 'Unsubscribed';

jest.mock('@/components/admin/MailingListStatus', () => ({
  MailingListStatus: ({ resource, recordId }: { resource: string; recordId: number }) => (
    <div data-testid="mailing-list-status">{resource}:{recordId} {mockSubscriptionLabel}</div>
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
  it.each(['cash', 'check', null] as const)(
    'shows saved offline facts independently of contacts with method %p', (method) => {
      render(<DonationDetailDrawer donation={{
        ...donation, donor_first_name: null, donor_last_name: null, donor_email: null,
        record_source: 'manual', payment_method: method, external_reference: 'Ledger 42',
        reference_id: 'DON-MANUAL-00000001', amount: '35.00', total_amount: '35.00',
        donation_date: '1990-01-02',
      }} onClose={jest.fn()} />);
      expect(screen.getByRole('heading', { name: 'Not provided' })).toBeInTheDocument();
      const fieldValue = (label: string) => screen.getByText(label).closest('div');
      expect(fieldValue('Donation amount')).toHaveTextContent('$35.00');
      expect(fieldValue('Recorded total')).toHaveTextContent('$35.00');
      expect(fieldValue('Date')).toHaveTextContent('January 2, 1990');
      expect(fieldValue('Payment status')).toHaveTextContent('completed');
      expect(fieldValue('Record origin')).toHaveTextContent('Manual');
      expect(fieldValue('Payment method')).toHaveTextContent(
        method === 'cash' ? 'Cash' : method === 'check' ? 'Check' : 'Not provided',
      );
      expect(fieldValue('Reference ID')).toHaveTextContent('DON-MANUAL-00000001');
      expect(fieldValue('External reference')).toHaveTextContent('Ledger 42');
      expect(screen.getByText(/No online processing-cost contribution was added/))
        .toBeInTheDocument();
      expect(screen.queryByText('Total payment')).not.toBeInTheDocument();
      expect(screen.queryByText('Processing-cost contribution')).not.toBeInTheDocument();
      expect(screen.getByText(/^Email unavailable:/))
        .toHaveTextContent('no email address is recorded');
      expect(screen.getByTestId('mailing-list-status')).toHaveTextContent('donations:1');
    },
  );

  it('preserves online contribution and total presentation', () => {
    render(<DonationDetailDrawer donation={{
      ...donation, record_source: 'checkout', processing_cost_contribution: '0.60',
      total_amount: '10.60',
    }} onClose={jest.fn()} />);
    expect(screen.getByText('Processing-cost contribution').closest('div'))
      .toHaveTextContent('$0.60');
    expect(screen.getByText('Total payment').closest('div')).toHaveTextContent('$10.60');
    expect(screen.getByText('Record origin').closest('div')).toHaveTextContent('Online checkout');
  });

  it('shows CSV import provenance as an offline received donation', () => {
    render(<DonationDetailDrawer donation={{
      ...donation, record_source: 'csv_import', amount: '35.00', total_amount: '35.00',
      payment_method: 'check', external_reference: 'Ledger entry',
    }} onClose={jest.fn()} />);
    expect(screen.getByText('Record origin').closest('div')).toHaveTextContent('CSV import');
    expect(screen.getByText('Donation amount').closest('div')).toHaveTextContent('$35.00');
    expect(screen.getByText('Recorded total').closest('div')).toHaveTextContent('$35.00');
    expect(screen.getByText(/No online processing-cost contribution was added/)).toBeInTheDocument();
    expect(screen.queryByText('Processing-cost contribution')).not.toBeInTheDocument();
    expect(screen.getByText('External reference').closest('div')).toHaveTextContent('Ledger entry');
  });

  it('hides supplied names as well as the address when anonymous', () => {
    render(<DonationDetailDrawer donation={{
      ...donation, is_anonymous: true, donor_first_name: 'Private first',
      donor_last_name: 'Private last', address: 'Private address',
    }} onClose={jest.fn()} />);
    expect(screen.getByRole('heading', { name: 'Anonymous' })).toBeInTheDocument();
    expect(screen.queryByText(/Private first|Private last|Private address/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email donor' })).toBeInTheDocument();
  });

  it.each(['Unsubscribed', 'Confirmation pending'])(
    'offers recipient-only correspondence independently of %s', (status) => {
      mockSubscriptionLabel = status;
      const record = { ...donation, donor_email: ' Donor+finance@example.test ',
        message: 'Private message', address: 'Private address', is_anonymous: true };
      const before = { ...record };
      const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
      const request = jest.fn();
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: request });
      const view = render(<DonationDetailDrawer donation={record} onClose={jest.fn()} />);
      try {
        const link = screen.getByRole('link', { name: 'Email donor' });
        expect(link).toHaveAttribute('href', 'mailto:Donor%2Bfinance%40example.test');
        expect(link.closest('footer')).toHaveTextContent(status);
        expect(link).toHaveAccessibleDescription(/configured email application/);
        expect(link.closest('footer')).toHaveTextContent('does not send or track');
        // Prevent jsdom navigation, but exercise any application click handlers.
        link.addEventListener('click', (event) => event.preventDefault());
        fireEvent.click(link);
        expect(request).not.toHaveBeenCalled();
        expect(record).toEqual(before);
        expect(screen.queryByText(/message sent/i)).not.toBeInTheDocument();
        view.rerender(<DonationDetailDrawer
          donation={{ ...record, donation_id: 2, donor_email: 'other@example.test' }}
          onClose={jest.fn()}
        />);
        expect(screen.getByRole('link', { name: 'Email donor' }))
          .toHaveAttribute('href', 'mailto:other%40example.test');
      } finally {
        if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
        else Reflect.deleteProperty(globalThis, 'fetch');
      }
    },
  );

  it.each(['', '  ', 'invalid', 'a@example.test,b@example.test',
    'a@example.test?body=private', 'a@example.test\r\nBcc:b@example.test'])(
    'explains unavailable email %p without offering a link', (donorEmail) => {
      render(<DonationDetailDrawer
        donation={{ ...donation, donor_email: donorEmail }} onClose={jest.fn()}
      />);
      expect(screen.queryByRole('link', { name: 'Email donor' })).not.toBeInTheDocument();
      expect(screen.getByText(/^Email unavailable:/)).toHaveTextContent(
        donorEmail.trim() ? 'recorded email address is invalid' : 'no email address is recorded',
      );
    },
  );

  it('retains keyboard-accessible email and close controls without placeholders', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<DonationDetailDrawer donation={donation} onClose={onClose} />);
    const dialog = within(screen.getByRole('dialog'));
    const close = dialog.getByRole('button', { name: 'Close donation details' });
    const link = screen.getByRole('link', { name: 'Email donor' });
    expect(screen.queryByText(/coming soon|mark as cancelled/i)).not.toBeInTheDocument();
    expect(dialog.getAllByRole('button')).toHaveLength(1);
    expect(close).toHaveFocus();
    await user.tab();
    expect(link).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(link).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(close);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

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