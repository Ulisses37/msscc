/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { previewDonationCsv } from '@/services/donationImportPreview';

import { DonationCsvReview } from './DonationCsvReview';

jest.mock('@/services/donationImportPreview', () => ({ previewDonationCsv: jest.fn() }));

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

describe('donation CSV review only', () => {
  beforeEach(() => {
    jest.mocked(previewDonationCsv).mockReset().mockResolvedValue(reviewed);
  });

  it('renders normalized facts, anonymous correction and warnings as safe text', async () => {
    const { container } = render(<DonationCsvReview />);
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
    expect(screen.queryByText(/Acknowledge warnings before future confirmation/)).toBeNull();
  });

  it('keeps ten columns readable in a keyboard-accessible mobile scroll region', async () => {
    render(<DonationCsvReview />);
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
    expect(region).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'overflow-x-auto');
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

  it('resets acknowledgment and proposals on selection, re-upload, and cancel', async () => {
    render(<DonationCsvReview />);
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
    render(<DonationCsvReview />);
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
    render(<DonationCsvReview />);
    const picker = screen.getByLabelText('Donation CSV file');
    fireEvent.change(picker, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload and review CSV' }));
    fireEvent.change(picker, { target: { files: [new File(['changed'], 'fixed.csv')] } });
    await act(async () => resolveRequest(reviewed));
    expect(screen.queryByText(/Donation preview:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload and review CSV' })).toBeEnabled();
  });
});