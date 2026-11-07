/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { fetchFinancialRecords } from '@/services/financialRecordSearch';
import { useVisibleTableRevisionPolling } from '@/hooks/useVisibleTableRevisionPolling';
import { downloadMembershipImportTemplate } from '@/services/membershipImportTemplate';
import { confirmMembershipCsv, previewMembershipCsv } from '@/services/membershipImportPreview';
import { downloadCsv } from '@/utils/exportCsv';
import { downloadXlsx } from '@/utils/exportXlsx';
import type { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';

import AdminMembershipsPage from './page';

jest.mock('@/components/admin/MailingListStatus', () => ({
  MailingListStatus: ({ recordId }: { recordId: number }) => (
    <div>Subscription for saved record {recordId}</div>
  ),
}));

jest.mock('@/services/financialRecordSearch', () => ({ fetchFinancialRecords: jest.fn() }));
jest.mock('@/utils/exportCsv', () => ({ downloadCsv: jest.fn() }));
jest.mock('@/utils/exportXlsx', () => ({ downloadXlsx: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/hooks/useVisibleTableRevisionPolling', () => ({
  useVisibleTableRevisionPolling: jest.fn(),
}));
jest.mock('@/services/membershipImportTemplate', () => ({
  downloadMembershipImportTemplate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/membershipImportPreview', () => ({
  previewMembershipCsv: jest.fn(), confirmMembershipCsv: jest.fn(),
  MembershipCsvReviewRejected: class MembershipCsvReviewRejected extends Error {},
}));

const membership: MembershipEntry = {
  membership_id: 1, first_name: 'Unknown', last_name: 'Member', email: null, phone: null,
  membership_type: 'individual', amount_paid: null, payment_status: null,
  reference_id: 'test', start_date: null, end_date: null, renewal_date: null,
  status: 'active', notes: '', created_at: '', updated_at: '',
};

describe('membership table nullable values', () => {
  beforeEach(() => {
    jest.mocked(downloadMembershipImportTemplate).mockReset().mockResolvedValue(undefined);
    jest.mocked(previewMembershipCsv).mockReset();
    jest.mocked(confirmMembershipCsv).mockReset();
    jest.mocked(fetchFinancialRecords).mockResolvedValue([
      membership,
      { ...membership, membership_id: 2, first_name: 'Zero', amount_paid: '0.00',
        payment_status: 'pending', start_date: '2026-02-30', end_date: '2099-01-01' },
    ]);
  });

  it('refreshes the current search and opens imported details outside filtered/paged results', async () => {
    const originalFetch = global.fetch;
    localStorage.setItem('msscc_access_token', 'test-admin-token');
    const saved = { ...membership, membership_id: 42, first_name: 'Imported',
      record_source: 'csv_import' };
    const request = jest.fn().mockResolvedValue({ ok: true, json: async () => saved });
    global.fetch = request;
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      record_type: 'membership', row_count: 1, proposed_records: [],
      errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmMembershipCsv).mockResolvedValue({
      record_type: 'membership', batch_id: 'batch-42', created_count: 1,
      membership_ids: [42], already_imported: false,
    });
    try {
      render(<AdminMembershipsPage />);
      await screen.findByRole('table');
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'other member' } });
      await waitFor(() => expect(fetchFinancialRecords).toHaveBeenLastCalledWith('memberships', 'other member'));
      const previousCalls = jest.mocked(fetchFinancialRecords).mock.calls.length;
      fireEvent.change(screen.getByLabelText('Membership CSV file'), {
        target: { files: [new File(['csv'], 'membership.csv')] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm membership import' }));
      expect(await screen.findByText(/Batch batch-42: 1 memberships/)).toBeInTheDocument();
      await waitFor(() => expect(jest.mocked(fetchFinancialRecords).mock.calls.length)
        .toBeGreaterThan(previousCalls));
      expect(fetchFinancialRecords).toHaveBeenLastCalledWith('memberships', 'other member');
      expect(screen.getByRole('searchbox')).toHaveValue('other member');
      // The preview table lives in a dialog only while reviewing; the saved
      // result stays visible even when the current list filter hides its rows.
      expect(screen.queryByRole('dialog', { name: 'Review membership CSV' })).toBeNull();
      expect(within(screen.getByRole('table')).queryByText('Imported')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'View saved membership 42' }));
      const drawer = await screen.findByRole('dialog', { name: 'Imported Member' });
      expect(within(drawer).getByText('CSV import')).toBeInTheDocument();
      expect(request).toHaveBeenLastCalledWith(
        `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/42/`,
        { headers: { Authorization: 'Bearer test-admin-token' }, cache: 'no-store' },
      );
      expect(confirmMembershipCsv).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
      localStorage.clear();
    }
  });

  it('keeps the committed batch and saved-record button after a detail request fails', async () => {
    const originalFetch = global.fetch;
    const request = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({ ok: true, json: async () => ({
        ...membership, membership_id: 42, first_name: 'Imported', record_source: 'csv_import',
      }) });
    global.fetch = request;
    localStorage.setItem('msscc_access_token', 'test-admin-token');
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      record_type: 'membership', row_count: 1, proposed_records: [],
      errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmMembershipCsv).mockResolvedValue({
      record_type: 'membership', batch_id: 'batch-42', created_count: 1,
      membership_ids: [42], already_imported: true,
    });
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(<AdminMembershipsPage />);
      fireEvent.change(screen.getByLabelText('Membership CSV file'), {
        target: { files: [new File(['csv'], 'membership.csv')] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm membership import' }));
      expect(await screen.findByText(/This batch was already imported/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'View saved membership 42' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('batch was saved');
      expect(screen.getByText(/Batch batch-42: 1 memberships/)).toBeInTheDocument();
      // Wait for the failed request's finally block to release its in-flight
      // guard; clicking while the guard is active is deliberately ignored.
      await waitFor(() => expect(screen.getByRole('button', { name: 'View saved membership 42' })).toBeEnabled());
      await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('button', { name: 'View saved membership 42' }));
      expect(await screen.findByRole('dialog', { name: 'Imported Member' })).toBeInTheDocument();
      expect(request).toHaveBeenCalledTimes(2);
      expect(confirmMembershipCsv).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
      localStorage.clear();
      log.mockRestore();
    }
  });

  it('keeps the membership-only template separate from record export', async () => {
    render(<AdminMembershipsPage />);
    // All creation paths belong together; table export stays outside this section.
    const entry = screen.getByRole('region', { name: 'Add memberships' });
    const csvGroup = within(entry).getByRole('group', { name: 'Import from CSV' });
    expect(within(entry).getByRole('button', { name: 'Add membership' })).toBeInTheDocument();
    expect(within(csvGroup).getByRole('heading', { name: 'Review membership CSV' })).toBeInTheDocument();
    expect(within(csvGroup).getByRole('button', { name: 'Upload and review CSV' })).toBeInTheDocument();
    expect(within(csvGroup).getByRole('button', { name: 'Download membership CSV template' })).toBeInTheDocument();
    expect(screen.getByLabelText('Membership CSV file')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Download membership CSV template' });
    expect(screen.getByText(/Preview does not save records/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documentation & Help' })).toHaveAttribute('href', '/admin/documentation');
    expect(screen.queryByText(/Team setup/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1,048,576 UTF-8 bytes/)).not.toBeInTheDocument();
    expect(button).toHaveClass('w-full', 'sm:w-auto');
    fireEvent.click(button);
    await waitFor(() => expect(downloadMembershipImportTemplate).toHaveBeenCalledTimes(1));
    expect(downloadCsv).not.toHaveBeenCalled();
    expect(downloadXlsx).not.toHaveBeenCalled();
  });

  it('reports template download failures without claiming records were created', async () => {
    jest.mocked(downloadMembershipImportTemplate).mockRejectedValue(new Error('denied'));
    render(<AdminMembershipsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Download membership CSV template' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your finance access');
    expect(screen.queryByText('Membership record saved.')).not.toBeInTheDocument();
  });

  it('refreshes the filtered list and retrieves saved details outside its results', async () => {
    const originalFetch = global.fetch;
    const saved = { ...membership, membership_id: 42, first_name: 'Saved',
      email: 'saved@example.test', address: 'Saved address', payment_method: 'check',
      reference_id: 'MEM-MANUAL-00000042', record_source: 'manual', notes: 'Saved notes' };
    const request = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 201,
        json: async () => ({ membership_id: 42 }) })
      .mockResolvedValue({ ok: true, json: async () => saved });
    global.fetch = request;
    localStorage.setItem('msscc_access_token', 'test-admin-token');
    try {
      render(<AdminMembershipsPage />);
      await screen.findByRole('table');
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'existing member' } });
      await waitFor(() => expect(fetchFinancialRecords)
        .toHaveBeenLastCalledWith('memberships', 'existing member'));
      const previousCalls = jest.mocked(fetchFinancialRecords).mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Add membership' }));
      for (const [label, value] of [
        ['First name (required)', 'Entered'], ['Last name (required)', 'Member'],
        ['Membership type (required)', 'Historical'],
      ]) {
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
      }
      fireEvent.click(screen.getByRole('button', { name: 'Review membership' }));
      fireEvent.click(screen.getByRole('button', { name: 'Confirm and save membership' }));
      expect(await screen.findByText('Membership record saved.')).toBeInTheDocument();
      await waitFor(() => expect(jest.mocked(fetchFinancialRecords).mock.calls.length)
        .toBeGreaterThan(previousCalls));
      expect(fetchFinancialRecords).toHaveBeenLastCalledWith('memberships', 'existing member');
      expect(screen.getByRole('searchbox')).toHaveValue('existing member');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(within(screen.getByRole('table')).queryByText('Saved')).not.toBeInTheDocument();

      // A detail failure must not erase the success message or submit creation again.
      request.mockResolvedValueOnce({ ok: false, status: 503 });
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      fireEvent.click(screen.getByRole('button', { name: 'View saved membership' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('The record was saved');
      expect(screen.getByText('Membership record saved.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'View saved membership' }));
      const drawer = await screen.findByRole('dialog', { name: 'Saved Member' });
      expect(within(drawer).getByText('Saved address')).toBeInTheDocument();
      expect(within(drawer).getByText('Saved notes')).toBeInTheDocument();
      expect(within(drawer).getByText('Manual entry')).toBeInTheDocument();
      expect(within(drawer).getByText('Check')).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: 'Email member' }))
        .toHaveAttribute('href', 'mailto:saved%40example.test');
      expect(within(drawer).getByText('Subscription for saved record 42')).toBeInTheDocument();
      expect(request.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
      expect(request).toHaveBeenLastCalledWith(
        `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/42/`,
        { headers: { Authorization: 'Bearer test-admin-token' }, cache: 'no-store' },
      );
      log.mockRestore();
    } finally {
      global.fetch = originalFetch;
      localStorage.clear();
      jest.restoreAllMocks();
    }
  });

  it('pauses revision polling while adding a membership and resumes on cancel', async () => {
    render(<AdminMembershipsPage />);
    await screen.findByRole('table');
    expect(jest.mocked(useVisibleTableRevisionPolling).mock.lastCall?.[3]).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Add membership' }));
    expect(screen.getByRole('dialog', { name: 'Add membership' })).toBeInTheDocument();
    expect(jest.mocked(useVisibleTableRevisionPolling).mock.lastCall?.[3]).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(jest.mocked(useVisibleTableRevisionPolling).mock.lastCall?.[3]).toBe(false);
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