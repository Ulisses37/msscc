/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MembershipDetailDrawer } from './MembershipDetailDrawer';
import type { MembershipEntry } from './MembershipDetailDrawer';

let mockSubscriptionLabel = 'Unsubscribed';

jest.mock('@/components/admin/MailingListStatus', () => ({
  MailingListStatus: ({ resource, recordId }: { resource: string; recordId: number }) => (
    <div data-testid="mailing-list-status">{resource}:{recordId} {mockSubscriptionLabel}</div>
  ),
}));

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
  it.each(['Unsubscribed', 'Confirmation pending'])(
    'offers recipient-only correspondence independently of %s', (status) => {
      mockSubscriptionLabel = status;
      const record = { ...membership, email: ' Member+finance@example.test ',
        notes: 'Private notes', address: 'Private address', amount_paid: '50.00' };
      const before = { ...record };
      const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
      const request = jest.fn();
      Object.defineProperty(globalThis, 'fetch', { configurable: true, value: request });
      const view = render(<MembershipDetailDrawer membership={record} onClose={jest.fn()} />);
      try {
        const link = screen.getByRole('link', { name: 'Email member' });
        expect(link).toHaveAttribute('href', 'mailto:Member%2Bfinance%40example.test');
        expect(link.closest('footer')).toHaveTextContent(status);
        expect(link).toHaveAccessibleDescription(/configured email application/);
        expect(link.closest('footer')).toHaveTextContent('does not send or track');
        // Prevent jsdom navigation, but exercise any application click handlers.
        link.addEventListener('click', (event) => event.preventDefault());
        fireEvent.click(link);
        expect(request).not.toHaveBeenCalled();
        expect(record).toEqual(before);
        expect(screen.queryByText(/message sent/i)).not.toBeInTheDocument();
        view.rerender(<MembershipDetailDrawer
          membership={{ ...record, membership_id: 2, email: 'other@example.test' }}
          onClose={jest.fn()}
        />);
        expect(screen.getByRole('link', { name: 'Email member' }))
          .toHaveAttribute('href', 'mailto:other%40example.test');
      } finally {
        if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
        else Reflect.deleteProperty(globalThis, 'fetch');
      }
    },
  );

  it.each([null, '', '  ', 'invalid', 'a@example.test,b@example.test',
    'a@example.test?subject=private', 'a@example.test\r\nBcc:b@example.test'])(
    'explains unavailable email %p without offering a link', (email) => {
      render(<MembershipDetailDrawer membership={{ ...membership, email }} onClose={jest.fn()} />);
      expect(screen.queryByRole('link', { name: 'Email member' })).not.toBeInTheDocument();
      expect(screen.getByText(/^Email unavailable:/)).toHaveTextContent(
        email?.trim() ? 'recorded email address is invalid' : 'no email address is recorded',
      );
    },
  );

  it('retains keyboard-accessible email and close controls without placeholders', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<MembershipDetailDrawer
      membership={{ ...membership, email: 'member@example.test' }} onClose={onClose}
    />);
    const dialog = within(screen.getByRole('dialog'));
    const close = dialog.getByRole('button', { name: 'Close membership details' });
    const link = screen.getByRole('link', { name: 'Email member' });
    expect(screen.queryByText('Mark as cancelled')).not.toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
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
    expect(screen.getByTestId('mailing-list-status')).toHaveTextContent('memberships:1');
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