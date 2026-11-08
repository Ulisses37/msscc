/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { confirmDonationCsv, DonationCsvReviewRejected, previewDonationCsv } from '@/services/donationImportPreview';
import { fetchSavedDonation } from '@/services/manualDonation';

import { DonationCsvReview } from './DonationCsvReview';

jest.mock('@/services/donationImportPreview', () => ({
  previewDonationCsv: jest.fn(), confirmDonationCsv: jest.fn(),
  DonationCsvReviewRejected: class extends Error {
    constructor(public reason: 'review' | 'access') { super('Review again.'); }
  },
}));
jest.mock('@/services/manualDonation', () => ({ fetchSavedDonation: jest.fn() }));

const file = new File(['fictional rows'], 'donations.csv', { type: 'text/csv' });
const proposed = {
  row: 2, values: {
    amount: '35.00', donation_date: '1990-01-02', is_anonymous: false,
    payment_method: 'check', donor_first_name: '<img src=x onerror=alert(1)>',
    donor_last_name: null, donor_email: null, address: null,
    external_reference: '', message: 'Text only',
  },
};
const reviewed = {
  record_type: 'donation' as const, row_count: 2, proposed_records: [proposed],
  errors: [{ row: 3, field: 'address', message: 'Leave blank for an anonymous donation.' }],
  warnings: [{ row: 2, reason: 'existing_reference_amount_date',
    message: 'A saved donation shares the ledger reference, amount and date; review it.' }],
};
const onConfirmed = jest.fn();
const onViewSavedDonation = jest.fn();

function Review() {
  return <DonationCsvReview onConfirmed={onConfirmed} onViewSavedDonation={onViewSavedDonation} />;
}

describe('donation CSV review and signed confirmation', () => {
  beforeEach(() => {
    onConfirmed.mockClear();
    onViewSavedDonation.mockClear();
    jest.mocked(fetchSavedDonation).mockReset().mockResolvedValue({ donation_id: 8 } as never);
    jest.mocked(previewDonationCsv).mockReset().mockResolvedValue(reviewed);
    jest.mocked(confirmDonationCsv).mockReset().mockResolvedValue({
      record_type: 'donation', batch_id: 'test-batch', created_count: 2,
      donation_ids: [7, 8], already_imported: false,
    });
  });

  it('renders normalized facts, anonymous correction and warnings as safe text', async () => {
    const { container } = render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    expect(await screen.findByText(/Donation preview: 2 data rows/)).toBeInTheDocument();
    expect(previewDonationCsv).toHaveBeenCalledWith(file);
    expect(screen.getByRole('alert')).toHaveTextContent('Row 3, address');
    expect(screen.getByText(/Potential duplicates/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('35.00')).toBeInTheDocument();
    expect(within(table).getByText('1990-01-02')).toBeInTheDocument();
    expect(within(table).getByText('false')).toBeInTheDocument();
    expect(within(table).getByText('check')).toBeInTheDocument();
    expect(within(table).getAllByText('Unknown')).toHaveLength(3);
    expect(within(table).getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/Review only; no donations have been saved/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByText(/Acknowledge warnings before confirmation/)).toBeNull();
  });

  it('keeps ten columns readable in a keyboard-accessible mobile scroll region', async () => {
    render(<Review />);
    const picker = screen.getByLabelText('Donation CSV file');
    expect(picker).toHaveClass('w-full', 'min-w-0', 'max-w-full');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const cancel = await screen.findByRole('button', { name: 'Cancel review' });
    const upload = screen.getByRole('button', { name: 'Upload and review CSV' });
    expect(upload.parentElement).toHaveClass('flex-col', 'sm:flex-row');
    expect(cancel).toHaveClass('w-full', 'sm:w-auto');
    // jsdom has no layout engine. Pin the intrinsic table width and unwrapped
    // headers as well as the bounded overflow that fixes the phone screenshot.
    const region = screen.getByRole('region', { name: 'Donation CSV proposals' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('aria-describedby', 'donation-csv-scroll-hint');
    expect(screen.getByText('Scroll sideways to review all donation columns.'))
      .toBeInTheDocument();
    expect(region).toHaveClass('max-w-full', 'overflow-x-auto');
    const dialog = screen.getByRole('dialog', { name: 'Donation CSV review' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Phone-sized dialogs scroll as one surface; at sm the review body takes
    // over vertical scrolling so the actions remain visible on wider screens.
    expect(dialog).toHaveClass('min-w-0', 'max-w-6xl', 'overflow-x-hidden',
      'overflow-y-auto', 'sm:overflow-hidden');
    expect(region.parentElement?.parentElement).toHaveClass('shrink-0', 'sm:min-h-0',
      'sm:flex-1', 'sm:shrink', 'sm:overflow-y-auto');
    expect(screen.getByRole('table').parentElement).toBe(region);
    expect(screen.getByRole('table')).toHaveClass('w-max', 'min-w-full');
    expect(within(region).getByText('Backend-validated donation proposals (read only)'))
      .toHaveClass('whitespace-nowrap');
    expect(within(region).getAllByRole('columnheader')).toHaveLength(11);
    for (const header of within(region).getAllByRole('columnheader')) {
      expect(header).toHaveClass('whitespace-nowrap');
    }
    expect(within(region).getByText('<img src=x onerror=alert(1)>'))
      .toHaveClass('max-w-64', 'break-words');
  });

  it('closes and reopens the same preview, restores focus and traps keyboard navigation', async () => {
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    const upload = screen.getByRole('button', { name: 'Upload and review CSV' });
    upload.focus();
    fireEvent.click(upload);
    const dialog = await screen.findByRole('dialog', { name: 'Donation CSV review' });
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    const heading = within(dialog).getByRole('heading', { name: 'Donation CSV review' });
    expect(heading).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(within(dialog).getByRole('region', { name: 'Donation CSV proposals' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(within(dialog).getByRole('button', { name: 'Close review' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Donation CSV review' })).toBeNull();
    expect(upload).toHaveFocus();
    expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
    fireEvent.click(screen.getByRole('button', { name: 'Reopen CSV review' }));
    expect(screen.getByRole('dialog', { name: 'Donation CSV review' })).toBeInTheDocument();
    expect(previewDonationCsv).toHaveBeenCalledTimes(1);
  });

  it('resets acknowledgment and proposals on selection, re-upload, and cancel', async () => {
    render(<Review />);
    const picker = screen.getByLabelText('Donation CSV file');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.change(picker, { target: { files: [new File(['changed'], 'fixed.csv')] } });
    expect(screen.queryByText(/Donation preview:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel review' }));
    expect(screen.queryByText(/Donation preview:/)).toBeNull();
    expect(previewDonationCsv).toHaveBeenCalledTimes(2);
  });

  it('shows loading and safe failure without claiming a saved donation', async () => {
    let rejectRequest: (error: Error) => void = () => undefined;
    jest.mocked(previewDonationCsv).mockImplementation(() => new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    expect(screen.getByRole('button', { name: 'Reviewing CSV…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reviewing CSV…' }));
    expect(previewDonationCsv).toHaveBeenCalledTimes(1);
    await act(async () => rejectRequest(new Error('private')));
    expect(screen.getByRole('alert')).toHaveTextContent('Check your finance access');
    expect(screen.queryByText(/Donation preview:/)).toBeNull();
  });

  it('ignores an obsolete response after the file picker changes', async () => {
    let resolveRequest: (value: typeof reviewed) => void = () => undefined;
    jest.mocked(previewDonationCsv).mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    render(<Review />);
    const picker = screen.getByLabelText('Donation CSV file');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.change(picker, { target: { files: [new File(['changed'], 'fixed.csv')] } });
    await act(async () => resolveRequest(reviewed));
    expect(screen.queryByText(/Donation preview:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload and review CSV' })).toBeEnabled();
  });

  it('confirms only an error-free signed review with warnings acknowledged', async () => {
    jest.mocked(previewDonationCsv).mockResolvedValue({
      ...reviewed, errors: [], review_token: 'signed-review',
    });
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm donation import' });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(confirm);
    expect(await screen.findByText(/Donation batch saved. Batch test-batch: 2 donations/))
      .toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Donation CSV review' })).toBeNull();
    expect(confirmDonationCsv).toHaveBeenCalledWith(file, 'signed-review', true);
    expect(screen.queryByText(/no donations have been saved/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm donation import' })).toBeNull();
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Saved donation ID')).toHaveValue('7');
  });

  it('cannot dismiss an in-flight confirmation and reopens an uncertain reply with its signed review', async () => {
    jest.mocked(previewDonationCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    let rejectRequest!: (error: Error) => void;
    jest.mocked(confirmDonationCsv).mockImplementationOnce(() => new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Donation CSV review' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm donation import' }));
    expect(within(dialog).getByRole('button', { name: 'Close review' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Donation CSV review' })).toBeInTheDocument();
    await act(async () => rejectRequest(new Error('private response')));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('status is uncertain');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close review' }));
    expect(screen.queryByRole('dialog', { name: 'Donation CSV review' })).toBeNull();
    expect(screen.getByText(/Confirmation may have saved donations; reopen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen CSV review' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Donation CSV review' }))
      .getByRole('button', { name: 'Confirm donation import' }));
    expect(await screen.findByText(/Batch test-batch: 2 donations/)).toBeInTheDocument();
    expect(confirmDonationCsv).toHaveBeenNthCalledWith(2, file, 'signed-review', false);
    expect(previewDonationCsv).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('opens an authorized saved ID outside the list, retry receipt %p', async (alreadyImported) => {
    jest.mocked(previewDonationCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmDonationCsv).mockResolvedValue({
      record_type: 'donation', batch_id: 'batch-1', created_count: 2,
      donation_ids: [7, 8], already_imported: alreadyImported,
    });
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm donation import' }));
    expect(await screen.findByText(/Batch batch-1: 2 donations/)).toBeInTheDocument();
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Saved donation ID'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'View imported donation' }));
    await act(async () => {});
    expect(fetchSavedDonation).toHaveBeenCalledWith(8);
    expect(onViewSavedDonation).toHaveBeenCalledWith(expect.objectContaining({ donation_id: 8 }));
  });

  it('retains the receipt when detail read fails and prevents repeated requests', async () => {
    jest.mocked(previewDonationCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    let rejectDetail!: (error: Error) => void;
    jest.mocked(fetchSavedDonation).mockImplementationOnce(() => new Promise((_, reject) => {
      rejectDetail = reject;
    }));
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm donation import' }));
    await screen.findByText(/Batch test-batch: 2 donations/);
    fireEvent.click(screen.getByRole('button', { name: 'View imported donation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Loading imported donation…' }));
    expect(fetchSavedDonation).toHaveBeenCalledTimes(1);
    await act(async () => rejectDetail(new Error('private error')));
    expect(screen.getByRole('alert')).toHaveTextContent('batch was saved');
    expect(screen.getByText(/Batch test-batch: 2 donations/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View imported donation' }));
    await act(async () => {});
    expect(fetchSavedDonation).toHaveBeenCalledTimes(2);
    expect(confirmDonationCsv).toHaveBeenCalledTimes(1);
  });

  it('keeps same file and token after uncertain reply for safe retry, without duplicate clicks', async () => {
    jest.mocked(previewDonationCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    let rejectRequest: (error: Error) => void = () => undefined;
    jest.mocked(confirmDonationCsv).mockImplementationOnce(() => new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const confirm = await screen.findByRole('button', { name: 'Confirm donation import' });
    fireEvent.click(confirm);
    expect(screen.getByRole('button', { name: 'Confirming…' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirming…' }));
    expect(confirmDonationCsv).toHaveBeenCalledTimes(1);
    await act(async () => rejectRequest(new Error('private response')));
    expect(screen.getByRole('alert')).toHaveTextContent('status is uncertain');
    expect(screen.getByText(/Confirmation may have saved donations/)).toBeInTheDocument();
    expect(screen.getByLabelText('Donation CSV file')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel review' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm donation import' }));
    expect(await screen.findByText(/Donation batch saved/)).toBeInTheDocument();
    expect(confirmDonationCsv).toHaveBeenNthCalledWith(2, file, 'signed-review', false);
    expect(previewDonationCsv).toHaveBeenCalledTimes(1);
  });

  it('requires a fresh review after a definite rejection', async () => {
    jest.mocked(previewDonationCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmDonationCsv).mockRejectedValue(new DonationCsvReviewRejected('review'));
    render(<Review />);
    fireEvent.change(screen.getByLabelText('Donation CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm donation import' }));
    expect(await screen.findByText(/This review did not save donations/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm donation import' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload and review CSV' })).toBeEnabled();
  });
});