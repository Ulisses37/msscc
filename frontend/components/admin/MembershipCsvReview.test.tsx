/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { confirmMembershipCsv, previewMembershipCsv } from '@/services/membershipImportPreview';

import { MembershipCsvReview } from './MembershipCsvReview';

jest.mock('@/services/membershipImportPreview', () => ({
  previewMembershipCsv: jest.fn(), confirmMembershipCsv: jest.fn(),
}));

const file = new File(['fixed headers'], 'membership.csv', { type: 'text/csv' });
const proposal = {
  row: 2,
  values: { first_name: '<img src=x onerror=alert(1)>', last_name: 'Test',
    membership_type: 'Historical', status: 'unknown', email: null, phone: null,
    address: null, membership_price: null, amount_paid: '0.00', start_date: null,
    end_date: null, renewal_date: null, payment_status: null, payment_method: null,
    reference_id: '', notes: 'Private notes' },
};
const reviewed = {
  record_type: 'membership' as const, row_count: 2, proposed_records: [proposal],
  errors: [{ row: 3, field: 'status', message: 'Invalid or missing value.' }],
  warnings: [{ row: 2, reason: 'repeated_row', message: 'Same validated facts as CSV row 1.' }],
};

describe('membership CSV review only', () => {
  beforeEach(() => {
    jest.mocked(previewMembershipCsv).mockReset().mockResolvedValue(reviewed);
    jest.mocked(confirmMembershipCsv).mockReset().mockResolvedValue({
      record_type: 'membership', batch_id: 'batch-1', created_count: 2,
      membership_ids: [1, 2], already_imported: false,
    });
  });

  it('uploads, renders normalized values as text, gates warnings and reports errors', async () => {
    const { container } = render(<MembershipCsvReview />);
    const choose = screen.getByLabelText('Membership CSV file');
    fireEvent.change(choose, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    expect(await screen.findByText(/Membership preview: 2 data rows/)).toBeInTheDocument();
    expect(previewMembershipCsv).toHaveBeenCalledWith(file);
    expect(screen.getByRole('alert')).toHaveTextContent('Row 3, status');
    expect(screen.getByText(/Potential duplicates/)).toBeInTheDocument();
    expect(screen.getByText(/Acknowledge warnings before future confirmation/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('0.00')).toBeInTheDocument();
    expect(within(table).getAllByText('Unknown').length).toBeGreaterThan(0);
    // The uploaded tag must be visible as text, never interpreted as an image.
    expect(within(table).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByText(/Acknowledge warnings before future confirmation/)).toBeNull();
    expect(screen.getByText(/Review only; no records have been saved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();
  });

  it('clears acknowledgment and prior review on file change, cancel and re-upload', async () => {
    render(<MembershipCsvReview />);
    const choose = screen.getByLabelText('Membership CSV file');
    fireEvent.change(choose, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    await screen.findByRole('checkbox');
    fireEvent.click(screen.getByRole('checkbox'));
    // A new file invalidates review of the old warnings, even before upload.
    fireEvent.change(choose, { target: { files: [new File(['new'], 'new.csv')] } });
    expect(screen.queryByText(/Membership preview:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel review' }));
    expect(screen.queryByText(/Membership preview:/)).toBeNull();
    expect(previewMembershipCsv).toHaveBeenCalledTimes(2);
  });

  it('shows loading, handles failure and never claims a saved record', async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    jest.mocked(previewMembershipCsv).mockImplementation(() => new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    render(<MembershipCsvReview />);
    fireEvent.change(screen.getByLabelText('Membership CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    expect(screen.getByRole('button', { name: 'Reviewing CSV…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reviewing CSV…' }));
    expect(previewMembershipCsv).toHaveBeenCalledTimes(1);
    rejectRequest(new Error('private'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Check your finance access'));
    expect(screen.queryByText(/Membership preview:/)).toBeNull();
    expect(screen.queryByText('Membership record saved.')).toBeNull();
  });

  it('ignores stale responses when the file changes before preview finishes', async () => {
    let resolveRequest: (value: typeof reviewed) => void = () => undefined;
    jest.mocked(previewMembershipCsv).mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<MembershipCsvReview />);
    const choose = screen.getByLabelText('Membership CSV file');
    fireEvent.change(choose, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.change(choose, { target: { files: [new File(['changed'], 'other.csv')] } });
    // Completing the original request must not replace review of the new file.
    resolveRequest(reviewed);
    await waitFor(() => expect(screen.queryByText(/Membership preview:/)).toBeNull());
    expect(screen.getByRole('button', { name: 'Upload and review CSV' })).toBeEnabled();
  });

  it('confirms only an error-free review, requires warning acknowledgment, and reports save', async () => {
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      ...reviewed, errors: [], review_token: 'signed-review',
    });
    render(<MembershipCsvReview />);
    fireEvent.change(screen.getByLabelText('Membership CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm membership import' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(confirm);
    expect(await screen.findByText(/Membership batch saved. Batch batch-1: 2 memberships/)).toBeInTheDocument();
    expect(confirmMembershipCsv).toHaveBeenCalledWith(file, 'signed-review', true);
    expect(screen.queryByText(/no records have been saved/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm membership import' })).toBeNull();
  });

  it('retains the reviewed file after an uncertain confirmation for an idempotent retry', async () => {
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmMembershipCsv).mockRejectedValueOnce(new Error('network'));
    render(<MembershipCsvReview />);
    fireEvent.change(screen.getByLabelText('Membership CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm membership import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Retry with the same reviewed file');
    expect(screen.queryByText(/no records have been saved/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm membership import' }));
    expect(await screen.findByText(/Membership batch saved/)).toBeInTheDocument();
    expect(confirmMembershipCsv).toHaveBeenCalledTimes(2);
    expect(previewMembershipCsv).toHaveBeenCalledTimes(1);
  });
});
