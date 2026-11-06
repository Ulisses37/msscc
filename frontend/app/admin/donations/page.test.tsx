/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { useVisibleTableRevisionPolling } from '@/hooks/useVisibleTableRevisionPolling';
import { fetchFinancialRecords } from '@/services/financialRecordSearch';
import { downloadDonationImportTemplate } from '@/services/donationImportTemplate';
import type { DonationEntry } from '@/components/admin/DonationDetailDrawer';

import AdminDonationsPage from './page';

jest.mock('@/services/financialRecordSearch', () => ({ fetchFinancialRecords: jest.fn() }));
jest.mock('@/services/donationImportTemplate', () => ({ downloadDonationImportTemplate: jest.fn() }));
jest.mock('@/hooks/useVisibleTableRevisionPolling', () => ({
  useVisibleTableRevisionPolling: jest.fn(),
}));
jest.mock('@/utils/exportCsv', () => ({ downloadCsv: jest.fn() }));
jest.mock('@/utils/exportXlsx', () => ({ downloadXlsx: jest.fn() }));
jest.mock('@/components/admin/MailingListStatus', () => ({
  MailingListStatus: ({ recordId }: { recordId: number }) => (
    <div>Subscription for saved record {recordId}</div>
  ),
}));

const originalFetch = global.fetch;
const savedDonation: DonationEntry = {
  donation_id: 42, donor_first_name: null, donor_last_name: null, donor_email: null,
  amount: '35.00', total_amount: '35.00', processing_cost_contribution: '0.00',
  donation_date: '1990-01-02', payment_status: 'completed', is_anonymous: false,
  record_source: 'manual', payment_method: 'check', external_reference: 'Ledger 42',
  reference_id: 'DON-MANUAL-00000042', message: '', created_at: '',
};

function saveDonation() {
  fireEvent.click(screen.getByRole('button', { name: 'Add donation' }));
  fireEvent.change(screen.getByLabelText('Donation amount (USD) (required)'), {
    target: { value: '35.00' },
  });
  fireEvent.change(screen.getByLabelText('Donation date (required)'), {
    target: { value: '1990-01-02' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review donation' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and save donation' }));
}

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

  it('offers the separate donation template and reports download access failures', async () => {
    // The service is mocked so this test proves page wiring without hitting
    // the backend or downloading a real file in the DOM test environment.
    jest.mocked(downloadDonationImportTemplate).mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('private response'));
    render(<AdminDonationsPage />);
    expect(screen.getByText(/payment status is always completed/i)).toBeInTheDocument();
    expect(screen.getByText(/anonymous donations retain no donor names or address/i))
      .toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Download donation CSV template' });
    fireEvent.click(button);
    await waitFor(() => expect(downloadDonationImportTemplate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    // Never display a raw private server/network message in the admin page.
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your finance access');
    expect(screen.queryByText('private response')).not.toBeInTheDocument();
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

  it('refreshes the current search and opens saved facts outside the current page', async () => {
    jest.mocked(fetchFinancialRecords).mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({
      ...savedDonation, donation_id: index + 100, donor_first_name: 'Existing',
    })));
    jest.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 201, json: async () => ({ donation_id: 42 }),
    } as Response).mockResolvedValue({
      ok: true, json: async () => savedDonation,
    } as Response);
    render(<AdminDonationsPage />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Existing' } });
    await waitFor(() => expect(fetchFinancialRecords)
      .toHaveBeenLastCalledWith('donations', 'Existing'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    const previousCalls = jest.mocked(fetchFinancialRecords).mock.calls.length;
    saveDonation();
    expect(await screen.findByText('Donation record saved.')).toBeInTheDocument();
    await waitFor(() => expect(jest.mocked(fetchFinancialRecords).mock.calls.length)
      .toBeGreaterThan(previousCalls));
    expect(fetchFinancialRecords).toHaveBeenLastCalledWith('donations', 'Existing');
    expect(screen.getByRole('searchbox')).toHaveValue('Existing');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View saved donation' }));
    const dialog = await screen.findByRole('dialog', { name: 'Not provided' });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/donations/42/'),
      expect.objectContaining({ cache: 'no-store', headers: expect.objectContaining({
        Authorization: 'Bearer test-admin-token',
      }) }),
    );
    expect(within(dialog).getByText('Ledger 42')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Subscription for saved record 42');
    expect(within(dialog).getByText('Payment method').closest('div')).toHaveTextContent('Check');
  });

  it('guards duplicate detail requests and retries safely without creating again', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    let resolveDetail!: (response: Response) => void;
    jest.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 201, json: async () => ({ donation_id: 42 }),
    } as Response).mockImplementationOnce(() => new Promise((resolve) => {
      resolveDetail = resolve;
    })).mockResolvedValueOnce({ ok: true, json: async () => savedDonation } as Response);
    try {
      render(<AdminDonationsPage />);
      saveDonation();
      await screen.findByText('Donation record saved.');
      fireEvent.click(screen.getByRole('button', { name: 'View saved donation' }));
      const loading = screen.getByRole('button', { name: 'Loading saved donation…' });
      expect(loading).toBeDisabled();
      fireEvent.click(loading);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      await act(async () => resolveDetail({ ok: false } as Response));
      expect(await screen.findByRole('alert')).toHaveTextContent('The record was saved');
      expect(screen.getByText('Donation record saved.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'View saved donation' }));
      await screen.findByRole('dialog', { name: 'Not provided' });
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(jest.mocked(global.fetch).mock.calls.filter(([, options]) =>
        options?.method === 'POST')).toHaveLength(1);
    } finally {
      log.mockRestore();
    }
  });
});
