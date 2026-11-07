/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import {
  confirmMembershipCsv, MembershipCsvReviewRejected, previewMembershipCsv,
} from '@/services/membershipImportPreview';

import { MembershipCsvReview } from './MembershipCsvReview';

jest.mock('@/services/membershipImportPreview', () => ({
  previewMembershipCsv: jest.fn(), confirmMembershipCsv: jest.fn(),
  MembershipCsvReviewRejected: class MembershipCsvReviewRejected extends Error {
    constructor(public readonly reason: 'review' | 'access') {
      super(reason === 'review' ? 'Review rejected. Upload again.' : 'Finance access required.');
    }
  },
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

  it('keeps narrow-screen upload controls and the wide table inside the dialog', async () => {
    // jsdom does not calculate layout; assert the viewport and scroll boundaries
    // that prevent 16 columns from expanding the page on a phone.
    render(<MembershipCsvReview />);
    const picker = screen.getByLabelText('Membership CSV file');
    expect(picker).toHaveClass('w-full', 'min-w-0', 'max-w-full');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const cancel = await screen.findByRole('button', { name: 'Cancel review' });
    const upload = screen.getByRole('button', { name: 'Upload and review CSV' });
    expect(upload.parentElement).toHaveClass('flex-col', 'sm:flex-row');
    expect(upload).toHaveClass('w-full', 'sm:w-auto');
    expect(cancel).toHaveClass('w-full', 'sm:w-auto');
    const dialog = screen.getByRole('dialog', { name: 'Review membership CSV' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Phones scroll the entire dialog, freeing the data from a fixed title and
    // footer. Wider screens retain a fixed header/footer and scroll the body.
    expect(dialog).toHaveClass('w-full', 'max-w-7xl', 'overflow-y-auto', 'overflow-x-hidden', 'sm:overflow-hidden');
    expect(dialog).toHaveClass('max-h-[calc(100dvh-1rem)]');
    // Stacking the heading and full-width Close button on phones prevents the
    // long title from pushing the only dismissal control beyond the viewport.
    const heading = within(dialog).getByRole('heading', { name: 'Review membership CSV' });
    const close = within(dialog).getByRole('button', { name: 'Close review' });
    expect(heading.closest('header')).toHaveClass('flex-col', 'items-stretch', 'sm:flex-row');
    expect(close).toHaveClass('w-full', 'min-w-0', 'sm:w-auto');
    expect(within(dialog).getByRole('status').closest('footer')).toHaveClass('shrink-0');
    const reviewBody = within(dialog).getByText(/Membership preview: 2 data rows/).parentElement;
    expect(reviewBody?.parentElement).toHaveClass('shrink-0', 'sm:flex-1', 'sm:shrink', 'sm:overflow-y-auto');
    expect(reviewBody?.parentElement).not.toHaveClass('overflow-y-auto');
    const scroll = within(dialog).getByRole('region', { name: 'Membership CSV proposals' });
    expect(scroll).toHaveClass('overflow-x-auto', 'max-w-full');
    expect(scroll).toHaveAttribute('tabindex', '0');
    const table = within(scroll).getByRole('table');
    expect(table).toHaveClass('w-max');
    expect(within(table).getByRole('columnheader', { name: 'membership_type' }))
      .toHaveClass('whitespace-nowrap', 'min-w-36');
    // On phones the row label must scroll away rather than covering names;
    // the sticky position is useful only at the wider breakpoint.
    const rowLabel = within(table).getByRole('rowheader', { name: '2' });
    const columnLabel = within(table).getByRole('columnheader', { name: 'CSV row' });
    for (const label of [rowLabel, columnLabel]) {
      expect(label).not.toHaveClass('sticky', 'left-0');
      expect(label).toHaveClass('sm:sticky', 'sm:left-0', 'sm:z-10');
    }
    expect(within(dialog).getByText('Scroll sideways to view all columns.')).toBeInTheDocument();
  });

  it('dismisses on Escape, restores focus and reopens the same review without saving', async () => {
    render(<MembershipCsvReview />);
    const choose = screen.getByLabelText('Membership CSV file');
    fireEvent.change(choose, { target: { files: [file] } });
    const upload = screen.getByRole('button', { name: 'Upload and review CSV' });
    upload.focus();
    fireEvent.click(upload);
    const dialog = await screen.findByRole('dialog', { name: 'Review membership CSV' });
    expect(within(dialog).getByRole('heading', { name: 'Review membership CSV' }))
      .toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Review membership CSV' })).toBeNull();
    expect(upload).toHaveFocus();
    expect(screen.getByText(/Review paused; no records have been saved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen CSV review' }));
    expect(screen.getByRole('dialog', { name: 'Review membership CSV' })).toBeInTheDocument();
    expect(previewMembershipCsv).toHaveBeenCalledTimes(1);
    expect(confirmMembershipCsv).not.toHaveBeenCalled();
  });

  it('contains keyboard focus and keeps an in-flight confirmation review open', async () => {
    let resolveConfirmation: (value: {
      record_type: 'membership'; batch_id: string; created_count: number;
      membership_ids: number[]; already_imported: boolean;
    }) => void = () => undefined;
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmMembershipCsv).mockImplementation(() => new Promise((resolve) => {
      resolveConfirmation = resolve;
    }));
    render(<MembershipCsvReview />);
    fireEvent.change(screen.getByLabelText('Membership CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review membership CSV' });
    const close = within(dialog).getByRole('button', { name: 'Close review' });
    const confirm = within(dialog).getByRole('button', { name: 'Confirm membership import' });
    confirm.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.click(confirm);
    expect(close).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
    resolveConfirmation({
      record_type: 'membership', batch_id: 'batch-1', created_count: 1,
      membership_ids: [2], already_imported: false,
    });
    expect(await screen.findByText(/Membership batch saved/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Review membership CSV' })).toBeNull();
  });

  it('shows uncertain confirmation feedback inside the review dialog for a safe retry', async () => {
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmMembershipCsv).mockRejectedValueOnce(new Error('network'));
    render(<MembershipCsvReview />);
    fireEvent.change(screen.getByLabelText('Membership CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review membership CSV' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm membership import' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Retry with the same reviewed file');
    expect(within(dialog).getByRole('button', { name: 'Close review' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Confirm membership import' })).toBeEnabled();
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

  it('blocks retry with a stale review after a definite rejection', async () => {
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmMembershipCsv).mockRejectedValueOnce(new MembershipCsvReviewRejected('review'));
    render(<MembershipCsvReview />);
    fireEvent.change(screen.getByLabelText('Membership CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm membership import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Upload again');
    expect(screen.getByText(/This review did not save records/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm membership import' })).toBeNull();
    expect(confirmMembershipCsv).toHaveBeenCalledTimes(1);
  });

  it('offers committed IDs and refreshes only after a confirmed or already-imported result', async () => {
    const onConfirmed = jest.fn();
    const onOpenSavedMembership = jest.fn();
    jest.mocked(previewMembershipCsv).mockResolvedValue({
      ...reviewed, errors: [], warnings: [], review_token: 'signed-review',
    });
    jest.mocked(confirmMembershipCsv).mockResolvedValue({
      record_type: 'membership', batch_id: 'batch-1', created_count: 2,
      membership_ids: [21, 22], already_imported: true,
    });
    render(<MembershipCsvReview onConfirmed={onConfirmed}
      onOpenSavedMembership={onOpenSavedMembership} />);
    fireEvent.change(screen.getByLabelText('Membership CSV file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm membership import' }));
    expect(await screen.findByText(/This batch was already imported/)).toBeInTheDocument();
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'View saved membership 22' }));
    expect(onOpenSavedMembership).toHaveBeenCalledWith(22);
    const savedButton = screen.getByRole('button', { name: 'View saved membership 21' });
    expect(savedButton).toHaveClass('w-full', 'sm:w-auto');
    expect(savedButton.closest('ul')).toHaveClass('flex-col', 'sm:flex-row');
  });
});
