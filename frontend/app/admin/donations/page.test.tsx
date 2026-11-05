/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useVisibleTableRevisionPolling } from '@/hooks/useVisibleTableRevisionPolling';
import { fetchFinancialRecords } from '@/services/financialRecordSearch';

import AdminDonationsPage from './page';

jest.mock('@/services/financialRecordSearch', () => ({ fetchFinancialRecords: jest.fn() }));
jest.mock('@/hooks/useVisibleTableRevisionPolling', () => ({
  useVisibleTableRevisionPolling: jest.fn(),
}));
jest.mock('@/utils/exportCsv', () => ({ downloadCsv: jest.fn() }));
jest.mock('@/utils/exportXlsx', () => ({ downloadXlsx: jest.fn() }));

const originalFetch = global.fetch;

describe('donation page manual-entry dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchFinancialRecords).mockResolvedValue([]);
    localStorage.setItem('msscc_access_token', 'test-admin-token');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ donation_id: 42 }),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('opens on an empty list, pauses polling, and resumes it when canceled', async () => {
    render(<AdminDonationsPage />);
    await waitFor(() => expect(fetchFinancialRecords).toHaveBeenCalled());
    const trigger = screen.getByRole('button', { name: 'Add donation' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Add donation' })).toBeInTheDocument();
    expect(useVisibleTableRevisionPolling)
      .toHaveBeenLastCalledWith('donations', expect.any(Function), 3000, true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useVisibleTableRevisionPolling)
      .toHaveBeenLastCalledWith('donations', expect.any(Function), 3000, false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('closes after explicit save and shows only a record-saved confirmation', async () => {
    render(<AdminDonationsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add donation' }));
    fireEvent.change(screen.getByLabelText('Donation amount (USD) (required)'), {
      target: { value: '35.00' },
    });
    fireEvent.change(screen.getByLabelText('Donation date (required)'), {
      target: { value: '1990-01-02' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review donation' }));
    expect(global.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save donation' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Donation record saved.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
