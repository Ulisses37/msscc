/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { fetchFinancialRecords } from '@/services/financialRecordSearch';
import { downloadCsv } from '@/utils/exportCsv';
import { downloadXlsx } from '@/utils/exportXlsx';
import type { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';

import AdminMembershipsPage from './page';

jest.mock('@/services/financialRecordSearch', () => ({ fetchFinancialRecords: jest.fn() }));
jest.mock('@/utils/exportCsv', () => ({ downloadCsv: jest.fn() }));
jest.mock('@/utils/exportXlsx', () => ({ downloadXlsx: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/hooks/useVisibleTableRevisionPolling', () => ({
  useVisibleTableRevisionPolling: jest.fn(),
}));

const membership: MembershipEntry = {
  membership_id: 1, first_name: 'Unknown', last_name: 'Member', email: null, phone: null,
  membership_type: 'individual', amount_paid: null, payment_status: null,
  reference_id: 'test', start_date: null, end_date: null, renewal_date: null,
  status: 'active', notes: '', created_at: '', updated_at: '',
};

describe('membership table nullable values', () => {
  beforeEach(() => {
    jest.mocked(fetchFinancialRecords).mockResolvedValue([
      membership,
      { ...membership, membership_id: 2, first_name: 'Zero', amount_paid: '0.00',
        payment_status: 'pending', start_date: '2026-02-30', end_date: '2099-01-01' },
    ]);
  });

  it('renders fallbacks and known zero without activating pending checkouts', async () => {
    render(<AdminMembershipsPage />);
    const table = await screen.findByRole('table');
    expect(within(table).getByRole('button', { name: 'Start date' })).toBeInTheDocument();
    expect(screen.queryByText('Date Paid')).not.toBeInTheDocument();
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Unknown');
    expect(rows[1]).toHaveTextContent('Not provided');
    expect(rows[1]).toHaveTextContent('Active (expiration unknown)');
    expect(rows[2]).toHaveTextContent('$0.00');
    expect(rows[2]).toHaveTextContent('Not provided');
    expect(rows[2]).toHaveTextContent('Pending');
    expect(rows[2]).not.toHaveTextContent('Active');
  });

  it.each(['Payment Status', 'Amount', 'Start date', 'Status'])(
    'sorts %s safely in both directions with unknown values last', async (column) => {
      if (column === 'Start date') {
        jest.mocked(fetchFinancialRecords).mockResolvedValue([
          membership, { ...membership, membership_id: 2, first_name: 'Zero',
            start_date: '2026-01-01' },
        ]);
      }
      render(<AdminMembershipsPage />);
      const table = await screen.findByRole('table');
      const button = within(table).getByRole('button', { name: column });
      for (let click = 0; click < 2; click += 1) {
        fireEvent.click(button);
        expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Zero');
      }
    },
  );

  it.each(['csv', 'xlsx'])('wires %s exports to blank-preserving values', async (format) => {
    render(<AdminMembershipsPage />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    fireEvent.click(screen.getByRole('radio', { name: format }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Export ${format.toUpperCase()}` }));
    });
    if (format === 'csv') {
      const [, rows, columns] = jest.mocked(downloadCsv).mock.calls[0];
      const amount = columns.find((column) => column.header === 'Amount paid');
      const start = columns.find((column) => column.header === 'Start date');
      expect(amount?.getValue(rows[0])).toBeNull();
      expect(amount?.getValue(rows[1])).toBe(0);
      expect(start?.getValue(rows[1])).toBeNull();
    } else {
      const [, , rows, columns] = jest.mocked(downloadXlsx).mock.calls[0];
      const amount = columns.find((column) => column.header === 'Amount paid');
      const start = columns.find((column) => column.header === 'Start date');
      expect(amount?.getCell(rows[0])).toBeNull();
      expect(amount?.getCell(rows[1])).toMatchObject({ value: 0, type: Number });
      expect(start?.getCell(rows[1])).toBeNull();
    }
  });
});