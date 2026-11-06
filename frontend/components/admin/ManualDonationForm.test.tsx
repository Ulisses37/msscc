/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ManualDonationForm } from './ManualDonationForm';

const mockFetch = jest.fn();
const onCancel = jest.fn();
const onCreated = jest.fn();
const originalFetch = global.fetch;

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function enterMinimum() {
  change('Donation amount (USD) (required)', '35.00');
  change('Donation date (required)', '1990-01-02');
}

function review() {
  fireEvent.click(screen.getByRole('button', { name: 'Review donation' }));
}

function confirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and save donation' }));
}

describe('manual donation entry and review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('msscc_access_token', 'test-admin-token');
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ donation_id: 42 }) });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ManualDonationForm onCancel={onCancel} onCreated={onCreated} />);
  });

  afterEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('opens an accessible portaled dialog with persistent actions and received-payment guidance', () => {
    const dialog = screen.getByRole('dialog', { name: 'Add donation' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.getByRole('heading', { name: 'Add donation' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByText(/This does not charge the donor/)).toBeInTheDocument();
    expect(screen.getByText(/Avoid identifying information/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review donation' }).closest('footer')).not.toBeNull();
  });

  it('contains keyboard navigation and allows cancellation without a request', () => {
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('checkbox', { name: 'Anonymous donation' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps entry rows and DOM order aligned (anonymous: %s)', (anonymous) => {
    if (anonymous) fireEvent.click(screen.getByRole('checkbox'));
    const form = screen.getByLabelText('Donation amount (USD) (required)').closest('form');
    expect(form).not.toBeNull();
    const controls = Array.from(form!.querySelectorAll('input:not([type="checkbox"]), select, textarea'));
    expect(controls.map((control) => control.id)).toEqual([
      'amount', 'donationDate', 'paymentMethod', 'externalReference',
      ...(!anonymous ? ['donorFirstName', 'donorLastName'] : []),
      'donorEmail', ...(!anonymous ? ['address'] : []), 'message',
    ].map((key) => `manual-donation-${key}`));
    for (const control of controls) {
      const fullWidth = ['donorEmail', 'address', 'message']
        .some((key) => control.id === `manual-donation-${key}`);
      expect(control.parentElement?.classList.contains('sm:col-span-2')).toBe(fullWidth);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps review rows aligned (anonymous: %s)', (anonymous) => {
    if (anonymous) fireEvent.click(screen.getByRole('checkbox'));
    enterMinimum();
    review();
    const facts = screen.getByRole('region', { name: 'Donation facts' });
    const labels = Array.from(facts.querySelectorAll('dt'));
    expect(labels.map((label) => label.textContent)).toEqual([
      'Anonymous', 'Donation amount (USD)', 'Donation date', 'Payment method',
      'External reference', 'First name', 'Last name', 'Email', 'Address', 'Message',
      'Internal reference', 'Record origin', 'Payment status',
    ]);
    for (const label of labels) {
      const fullWidth = ['Anonymous', 'Email', 'Address', 'Message', 'Internal reference',
        'Record origin', 'Payment status'].includes(label.textContent ?? '');
      expect(label.parentElement?.classList.contains('sm:col-span-2')).toBe(fullWidth);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('identifies invalid financial/contact fields and preserves entered values', () => {
    change('Donation amount (USD) (required)', '0');
    change('Donation date (required)', '9999-01-01');
    change('Email (optional)', 'invalid');
    change('First name (optional)', 'Maya');
    review();
    for (const label of ['Donation amount (USD) (required)', 'Donation date (required)',
      'Email (optional)']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    }
    expect(screen.getByLabelText('First name (optional)')).toHaveValue('Maya');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reviews unknown contacts without treating missing names as anonymous', () => {
    enterMinimum();
    review();
    expect(screen.getByRole('dialog', { name: 'Review donation' })).toBeInTheDocument();
    expect(screen.getByText('35.00 USD')).toBeInTheDocument();
    expect(screen.getByText('1990-01-02')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getAllByText('Unknown / not provided')).toHaveLength(7);
    expect(screen.getByText('Generated on save')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(screen.getByLabelText('Donation amount (USD) (required)')).toHaveValue('35.00');
    expect(screen.getByLabelText('Donation date (required)')).toHaveValue('1990-01-02');
  });

  it('preserves hidden drafts on anonymity toggle but excludes them from review and submission', async () => {
    enterMinimum();
    change('First name (optional)', 'Private first');
    change('Last name (optional)', 'Private last');
    change('Address (optional)', 'Private address');
    change('Email (optional)', ' DONOR@EXAMPLE.TEST ');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.queryByLabelText('First name (optional)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Address (optional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByLabelText('First name (optional)')).toHaveValue('Private first');
    fireEvent.click(screen.getByRole('checkbox'));
    review();
    expect(screen.getAllByText('Not retained for anonymous donations')).toHaveLength(3);
    expect(screen.queryByText('Private first')).not.toBeInTheDocument();
    expect(screen.getByText('donor@example.test')).toBeInTheDocument();
    confirm();
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ donationId: 42 }));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      amount: '35.00', donation_date: '1990-01-02', currency: 'usd', payment_method: null,
      is_anonymous: true, donor_email: 'donor@example.test', external_reference: '', message: '',
    });
  });

  it('submits only normalized manual facts in one authenticated creation request', async () => {
    enterMinimum();
    for (const [label, value] of [
      ['First name (optional)', ' Maya '], ['Last name (optional)', ' 松山 '],
      ['Email (optional)', ' DONOR@EXAMPLE.TEST '], ['Address (optional)', ' Example Street\n松山市 '],
      ['Payment method (optional)', 'check'], ['External reference (optional)', ' cash mentioned '],
      ['Message (optional)', ' Historical note '],
    ]) change(label, value);
    review();
    expect(screen.getByText('Check')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    confirm();
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, request] = mockFetch.mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/manual/`);
    expect(request.headers.Authorization).toBe('Bearer test-admin-token');
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body)).toEqual({
      donor_first_name: 'Maya', donor_last_name: '松山', donor_email: 'donor@example.test',
      address: 'Example Street\n松山市', amount: '35.00', currency: 'usd',
      donation_date: '1990-01-02', payment_method: 'check', is_anonymous: false,
      external_reference: 'cash mentioned', message: 'Historical note',
    });
  });

  it('guards repeated clicks and disables navigation and Escape while saving', async () => {
    let resolveSave!: (value: unknown) => void;
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    enterMinimum();
    review();
    const button = screen.getByRole('button', { name: 'Confirm and save donation' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving donation…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back to edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => resolveSave({
      ok: true, status: 201, json: async () => ({ donation_id: 42 }),
    }));
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('preserves entries and review after network failure, without exposing private errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Private service details'));
    enterMinimum();
    review();
    confirm();
    expect(await screen.findByRole('alert')).toHaveTextContent('Check the donation list');
    expect(screen.queryByText('Private service details')).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(screen.getByLabelText('Donation amount (USD) (required)')).toHaveValue('35.00');
    review();
    confirm();
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it('maps server field errors safely and returns to preserved entry values', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400,
      json: async () => ({ donation_date: ['Private server details'] }) });
    enterMinimum();
    review();
    confirm();
    await waitFor(() => expect(screen.getByLabelText('Donation date (required)'))
      .toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByLabelText('Donation amount (USD) (required)')).toHaveValue('35.00');
    expect(screen.queryByText('Private server details')).not.toBeInTheDocument();
  });

  it.each([401, 403, 503])('preserves review on HTTP %s without claiming success', async (status) => {
    mockFetch.mockResolvedValue({ ok: false, status });
    enterMinimum();
    review();
    confirm();
    await screen.findByRole('alert');
    expect(screen.getByText('35.00 USD')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm and save donation' })).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('makes no request without an admin token', async () => {
    localStorage.clear();
    enterMinimum();
    review();
    confirm();
    await screen.findByRole('alert');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not claim success for malformed success responses', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ donation_id: null }) });
    enterMinimum();
    review();
    confirm();
    await screen.findByRole('alert');
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('can cancel from review without creating a record', () => {
    enterMinimum();
    review();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

it('restores scrolling and trigger focus after unmount', () => {
  const triggerView = render(<button>Add donation</button>);
  const trigger = screen.getByRole('button', { name: 'Add donation' });
  trigger.focus();
  const previousOverflow = document.body.style.overflow;
  const { unmount } = render(<ManualDonationForm onCancel={onCancel} onCreated={onCreated} />);
  unmount();
  expect(document.body.style.overflow).toBe(previousOverflow);
  expect(trigger).toHaveFocus();
  triggerView.unmount();
});
