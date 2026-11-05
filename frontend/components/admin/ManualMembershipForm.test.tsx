/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { ManualMembershipForm } from './ManualMembershipForm';

const mockFetch = jest.fn();
const onCancel = jest.fn();
const onCreated = jest.fn();

function enterMinimum() {
  fireEvent.change(screen.getByLabelText('First name (required)'), { target: { value: 'Maya' } });
  fireEvent.change(screen.getByLabelText('Last name (required)'), { target: { value: 'Sato' } });
  fireEvent.change(screen.getByLabelText('Membership type (required)'), {
    target: { value: 'Historical family' },
  });
}

function openReview() {
  fireEvent.click(screen.getByRole('button', { name: 'Review membership' }));
}

describe('manual membership entry and confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('msscc_access_token', 'test-admin-token');
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({ ok: true, status: 201,
      json: async () => ({ membership_id: 42 }) });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ManualMembershipForm onCancel={onCancel} onCreated={onCreated} />);
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('opens a portaled modal with focused heading and a persistent action footer', () => {
    const dialog = screen.getByRole('dialog', { name: 'Add membership' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(screen.getByRole('heading', { name: 'Add membership' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    const reviewButton = screen.getByRole('button', { name: 'Review membership' });
    expect(reviewButton.closest('footer')).not.toBeNull();
    expect(reviewButton).toHaveAttribute('form', 'manual-membership-entry');
  });

  it('contains keyboard navigation and permits Escape cancellation before submission', () => {
    const dialog = screen.getByRole('dialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByLabelText('First name (required)')).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('identifies required fields and preserves entries after validation errors', () => {
    fireEvent.change(screen.getByLabelText('First name (required)'), {
      target: { value: 'Maya' },
    });
    openReview();
    expect(screen.getByLabelText('First name (required)')).toHaveValue('Maya');
    expect(screen.getByLabelText('Last name (required)')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Membership type (required)'))
      .toHaveAccessibleDescription('This field is required.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reviews historical unknowns without inventing dates, amounts, or payment status', () => {
    enterMinimum();
    openReview();
    const payment = screen.getByRole('region', { name: 'Payment information' });
    expect(within(payment).getAllByText('Unknown / not provided')).toHaveLength(5);
    expect(within(payment).getByText('Generated on save')).toBeInTheDocument();
    const membership = screen.getByRole('region', { name: 'Membership information' });
    expect(within(membership).getByText('Unknown')).toBeInTheDocument();
    expect(within(membership).getAllByText('Unknown / not provided')).toHaveLength(3);
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(screen.getByLabelText('First name (required)')).toHaveValue('Maya');
    expect(screen.getByLabelText('Amount paid (USD) (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Start date (optional)')).toHaveValue('');
  });

  it('retains known zero, offline payment facts, and all values when returning to edit', () => {
    enterMinimum();
    const entries = [
      ['Email (optional)', 'MAYA@EXAMPLE.TEST'], ['Phone (optional)', '+81 123'],
      ['Address (optional)', 'Recorded address'], ['Amount paid (USD) (optional)', '0.00'],
      ['Membership price (USD) (optional)', '35.00'], ['Start date (optional)', '2020-01-01'],
      ['End date (optional)', '2020-12-31'], ['Renewal date (optional)', '2021-01-01'],
      ['Payment status (optional)', 'completed'], ['Payment method (optional)', 'cash'],
      ['Record status (required)', 'expired'], ['Reference (optional)', 'Receipt 123'],
      ['Notes (optional)', 'Historical record'],
    ];
    for (const [label, value] of entries) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    openReview();
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('maya@example.test')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    for (const [label, value] of entries) {
      expect(screen.getByLabelText(label)).toHaveValue(value);
    }
  });

  it('shows invalid email, negative amount, and date-order errors beside the fields', () => {
    enterMinimum();
    for (const [label, value] of [
      ['Email (optional)', 'invalid'], ['Amount paid (USD) (optional)', '-1'],
      ['Start date (optional)', '2020-02-01'], ['End date (optional)', '2020-01-01'],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    openReview();
    expect(screen.getByLabelText('Email (optional)'))
      .toHaveAccessibleDescription('Enter a valid email address.');
    expect(screen.getByLabelText('Amount paid (USD) (optional)'))
      .toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('End date (optional)'))
      .toHaveAccessibleDescription('End date cannot precede start date.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([false, true])('cancels without a request, from review: %s', (review) => {
    enterMinimum();
    if (review) openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('submits only after confirmation with authentication and explicit unknowns', async () => {
    enterMinimum();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save membership' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ membershipId: 42 }));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, request] = mockFetch.mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/`);
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({
      Authorization: 'Bearer test-admin-token', 'Content-Type': 'application/json',
    });
    expect(JSON.parse(request.body)).toEqual({
      first_name: 'Maya', last_name: 'Sato', membership_type: 'Historical family',
      status: 'unknown', email: null, phone: null, address: null,
      membership_price: null, amount_paid: null, start_date: null, end_date: null,
      renewal_date: null, payment_status: null, payment_method: null, reference_id: '', notes: '',
    });
  });

  it('guards repeated clicks and disables navigation while a save is pending', async () => {
    let resolveSave!: (response: unknown) => void;
    mockFetch.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    enterMinimum();
    openReview();
    const confirm = screen.getByRole('button', { name: 'Confirm and save membership' });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving membership…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back to edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
    await act(async () => {
      resolveSave({ ok: true, status: 201, json: async () => ({ membership_id: 42 }) });
    });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('preserves review and input after network failure and allows a deliberate retry', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Private service details'));
    enterMinimum();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save membership' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to confirm the save');
    expect(screen.queryByText('Private service details')).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(screen.getByLabelText('First name (required)')).toHaveValue('Maya');
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save membership' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it('maps server field errors without exposing raw server messages', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400,
      json: async () => ({ email: ['Private server details'] }) });
    enterMinimum();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save membership' }));
    await waitFor(() => expect(screen.getByLabelText('Email (optional)'))
      .toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByLabelText('First name (required)')).toHaveValue('Maya');
    expect(screen.queryByText('Private server details')).not.toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it.each([401, 403, 503])('handles HTTP %s without success or losing the review', async (status) => {
    mockFetch.mockResolvedValue({ ok: false, status });
    enterMinimum();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save membership' }));
    await screen.findByRole('alert');
    expect(screen.getByText('Maya')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm and save membership' })).toBeEnabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('makes no network request without an admin token', async () => {
    localStorage.clear();
    enterMinimum();
    openReview();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save membership' }));
    await screen.findByRole('alert');
    expect(mockFetch).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

it('restores page scrolling and prior focus when the form unmounts', () => {
  const { unmount: unmountTrigger } = render(<button type="button">Add membership</button>);
  const trigger = screen.getByRole('button', { name: 'Add membership' });
  trigger.focus();
  const previousOverflow = document.body.style.overflow;
  const { unmount } = render(<ManualMembershipForm onCancel={onCancel} onCreated={onCreated} />);
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe(previousOverflow);
  expect(trigger).toHaveFocus();
  unmountTrigger();
});