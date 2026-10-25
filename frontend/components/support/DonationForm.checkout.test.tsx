/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DonationForm } from '@/components/support/DonationForm';
import { createPaymentSession, getDonationQuote } from '@/services/paymentService';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import { formatCurrency } from '@/utils/formatCurrency';

let mockLocale: 'en' | 'ja' = 'en';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: 'SupportPage') => (key: keyof typeof en.SupportPage) =>
    (mockLocale === 'ja' ? ja : en)[namespace][key],
}));
jest.mock('@/services/paymentService', () => ({ createPaymentSession: jest.fn(), getDonationQuote: jest.fn(),
  readDonationQuote: jest.fn((data: { amount: string; processing_cost_contribution: string; total_amount: string }) => ({
    amount: data.amount, processingCostContribution: data.processing_cost_contribution,
    totalAmount: data.total_amount,
  })),
}));
// Keep the real form and summary, but do not initialize Stripe inside DOM tests.
jest.mock('@/components/support/StripePaymentElement', () => ({
  StripePaymentElement: ({ clientSecret, onEditDonationDetails }: {
    clientSecret: string; onEditDonationDetails: () => void;
  }) => (
    <div data-testid="stripe-payment">
      {clientSecret}
      <button type="button" onClick={onEditDonationDetails}>Edit donation details</button>
    </div>
  ),
}));

const reference = 'DON-00000042';

it('shows the quoted total before checkout and disables stale choices', async () => {
  // Hold the first response to show that checkout cannot start without a
  // quote, then hold the next one so a changed choice cannot reuse the old fee.
  const user = userEvent.setup();
  let finish!: (quote: { amount: string; processingCostContribution: string; totalAmount: string }) => void;
  jest.mocked(getDonationQuote).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<DonationForm />);
  await fillDonor(user);
  const button = screen.getByRole('button', { name: en.SupportPage.continueToPayment });
  expect(button).toBeDisabled();
  await act(async () => {
    finish({ amount: '5.00', processingCostContribution: '0.00', totalAmount: '5.00' });
  });
  await waitFor(() => expect(button).toBeEnabled());
  let finishSelected!: (quote: { amount: string; processingCostContribution: string; totalAmount: string }) => void;
  jest.mocked(getDonationQuote).mockReturnValueOnce(new Promise((resolve) => { finishSelected = resolve; }));
  await user.click(screen.getByRole('checkbox', { name: en.SupportPage.processingCostContribution }));
  expect(button).toBeDisabled();
  await act(async () => {
    finishSelected({ amount: '5.00', processingCostContribution: '0.61', totalAmount: '5.61' });
  });
  await waitFor(() => expect(button).toBeEnabled());
  const breakdown = screen.getByRole('region', { name: en.SupportPage.costBreakdown });
  expect(within(breakdown).getByText('$0.61')).toBeInTheDocument();
  expect(within(breakdown).getByText('$5.61')).toBeInTheDocument();
});

it('replaces an opted-in preview with the saved breakdown before checkout', async () => {
  const user = userEvent.setup();
  // Intentionally disagree with the $5.61 preview below: the saved donation
  // response is authoritative, even if the earlier quote becomes stale.
  jest.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({
    reference_id: reference, amount: '5.00', processing_cost_contribution: '0.62',
    total_amount: '5.62',
  }) } as Response);
  render(<DonationForm />);
  await fillDonor(user);
  const checkbox = screen.getByRole('checkbox', { name: en.SupportPage.processingCostContribution });
  await user.click(checkbox);
  const breakdown = await screen.findByRole('region', { name: en.SupportPage.costBreakdown });
  expect(within(breakdown).getByText('$5.61')).toBeInTheDocument();
  const continueButton = screen.getByRole('button', { name: en.SupportPage.continueToPayment });
  await waitFor(() => expect(continueButton).toBeEnabled());
  await user.click(continueButton);
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(1));
  expect(within(breakdown).getByText('$5.62')).toBeInTheDocument();
  expect(within(breakdown).getByText('$0.62')).toBeInTheDocument();
  expect(within(breakdown).queryByText('$5.61')).not.toBeInTheDocument();
  // The browser submits the opt-in choice, never its own fee or total;
  // checkout identifies the saved donation by reference.
  const [, request] = jest.mocked(global.fetch).mock.calls[0];
  const body = JSON.parse((request as RequestInit).body as string) as Record<string, unknown>;
  expect(body.contribute_to_processing_costs).toBe(true);
  expect(body).not.toHaveProperty('processing_cost_contribution');
  expect(body).not.toHaveProperty('total_amount');
  expect(createPaymentSession).toHaveBeenCalledWith({
    amount: '5', currency: 'usd', paymentPurpose: 'Donation', internalReference: reference,
  });
  expect(checkbox).toBeDisabled();
});
const originalFetch = global.fetch;

beforeEach(() => {
  mockLocale = 'en';
  window.history.replaceState({}, '', '/en/support');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ reference_id: reference, amount: '5.00', processing_cost_contribution: '0.00', total_amount: '5.00' }),
  });
  jest.mocked(getDonationQuote).mockReset();
  jest.mocked(getDonationQuote).mockImplementation(async (amount, choice) => ({
    amount: Number(amount).toFixed(2), processingCostContribution: choice ? '0.61' : '0.00',
    totalAmount: (Number(amount) + (choice ? 0.61 : 0)).toFixed(2),
  }));
  jest.mocked(createPaymentSession).mockReset();
  jest.mocked(createPaymentSession).mockResolvedValue({ sessionId: 'cs_test', clientSecret: 'secret_test' });
});
afterEach(() => { global.fetch = originalFetch; });

async function fillDonor(user: ReturnType<typeof userEvent.setup>, messages = en.SupportPage) {
  // Donor identity is a prerequisite, not the behavior under test here. One
  // change per field avoids dozens of full-form renders for unrelated typing;
  // the amount controls and checkout buttons still use real user events below.
  await act(async () => {
    fireEvent.change(screen.getByRole('textbox', { name: messages.email }), {
      target: { value: 'donor@example.com' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: messages.firstName }), {
      target: { value: 'Ada' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: messages.lastName }), {
      target: { value: 'Lovelace' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: messages.address }), {
      target: { value: '123 Main St' },
    });
  });
}

it('submits an anonymous donation with email only and no personal record fields', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  const button = screen.getByRole('button', { name: en.SupportPage.continueToPayment });
  const firstName = screen.getByRole('textbox', { name: en.SupportPage.firstName });
  const lastName = screen.getByRole('textbox', { name: en.SupportPage.lastName });
  const address = screen.getByRole('textbox', { name: en.SupportPage.address });
  await act(async () => {
    fireEvent.change(screen.getByRole('textbox', { name: en.SupportPage.email }), {
      target: { value: 'DONOR@EXAMPLE.COM' },
    });
  });
  expect(button).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: en.SupportPage.anonymousDonation }));
  expect(firstName).not.toBeRequired();
  expect(lastName).not.toBeRequired();
  expect(address).not.toBeRequired();
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(1));
  const [, request] = jest.mocked(global.fetch).mock.calls[0];
  const payload = JSON.parse((request as RequestInit).body as string);
  expect(payload).toMatchObject({ is_anonymous: true, donor_email: 'donor@example.com' });
  expect(payload).not.toHaveProperty('donor_first_name');
  expect(payload).not.toHaveProperty('donor_last_name');
  expect(payload).not.toHaveProperty('address');
});

it('omits previously entered names when anonymous and restores ordinary requirements on clearing', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  const button = screen.getByRole('button', { name: en.SupportPage.continueToPayment });
  const choice = screen.getByRole('checkbox', { name: en.SupportPage.anonymousDonation });
  const lastName = screen.getByRole('textbox', { name: en.SupportPage.lastName });
  await user.click(choice);
  // Previously entered names remain editable for an ordinary attempt but
  // must never be sent in the anonymous request.
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(1));
  let [, request] = jest.mocked(global.fetch).mock.calls[0];
  let payload = JSON.parse((request as RequestInit).body as string);
  expect(payload.is_anonymous).toBe(true);
  expect(payload).not.toHaveProperty('donor_first_name');
  expect(payload).not.toHaveProperty('donor_last_name');

  await user.click(screen.getByRole('button', { name: 'Edit donation details' }));
  // Editing remounts the continue button after the Stripe UI is removed.
  const editButton = screen.getByRole('button', { name: en.SupportPage.continueToPayment });
  await user.click(choice);
  expect(lastName).toBeRequired();
  await user.clear(lastName);
  expect(editButton).toBeDisabled();
  await user.type(lastName, 'Lovelace');
  expect(screen.getByRole('textbox', { name: en.SupportPage.firstName })).toHaveValue('Ada');
  expect(lastName).toHaveValue('Lovelace');
  expect(screen.getByRole('textbox', { name: en.SupportPage.address })).toHaveValue('123 Main St');
  expect(choice).not.toBeChecked();
  await waitFor(() => expect(editButton).toBeEnabled());
  await user.click(editButton);
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(2));
  [, request] = jest.mocked(global.fetch).mock.calls[1];
  payload = JSON.parse((request as RequestInit).body as string);
  expect(payload).toMatchObject({
    is_anonymous: false, donor_first_name: 'Ada', donor_last_name: 'Lovelace',
    donor_email: 'donor@example.com',
  });
  expect(payload).not.toHaveProperty('address');
});

it('reviews anonymous details before sending the anonymous request', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  // The summary copies email on blur; the shared fill helper only changes fields.
  await user.tab();
  const summary = screen.getByRole('region', { name: en.SupportPage.summaryHeading });
  const valueFor = (label: string) => within(summary).getByText(label).nextElementSibling;
  const choice = screen.getByRole('checkbox', { name: en.SupportPage.anonymousDonation });

  await user.click(choice);
  expect(valueFor(en.SupportPage.name)).toHaveTextContent(en.SupportPage.anonymousName);
  expect(valueFor(en.SupportPage.name)).not.toHaveTextContent('Ada');
  expect(valueFor(en.SupportPage.address)).toHaveTextContent(en.SupportPage.addressOmitted);
  expect(valueFor(en.SupportPage.address)).not.toHaveTextContent('123 Main St');
  expect(valueFor(en.SupportPage.email)).toHaveTextContent('donor@example.com');
  expect(valueFor(en.SupportPage.anonymousDonation)).toHaveTextContent(en.SupportPage.yes);

  const button = screen.getByRole('button', { name: en.SupportPage.continueToPayment });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(1));
  const [, request] = jest.mocked(global.fetch).mock.calls[0];
  const payload = JSON.parse((request as RequestInit).body as string);
  expect(payload).toMatchObject({ is_anonymous: true, donor_email: 'donor@example.com' });
  expect(payload).not.toHaveProperty('donor_first_name');
  expect(payload).not.toHaveProperty('donor_last_name');
  expect(payload).not.toHaveProperty('address');
});

function reviewAmount(messages = en.SupportPage) {
  // Read only the donation row; other empty summary fields can share the same
  // placeholder and should never determine whether checkout is consistent.
  const summary = screen.getByRole('region', { name: messages.summaryHeading });
  return within(summary).getByText(messages.donationAmount).nextElementSibling;
}

async function expectCheckout(user: ReturnType<typeof userEvent.setup>, amount: string) {
  expect(reviewAmount()).toHaveTextContent(formatCurrency(Number(amount)));
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());
  jest.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({
    reference_id: reference, amount: Number(amount).toFixed(2),
    processing_cost_contribution: '0.00', total_amount: Number(amount).toFixed(2),
  }) } as Response);
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(1));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [, request] = jest.mocked(global.fetch).mock.calls[0];
  const body = JSON.parse((request as RequestInit).body as string) as { amount: string };
  expect(body.amount).toBe(amount);
  expect(createPaymentSession).toHaveBeenCalledWith({
    amount, currency: 'usd', paymentPurpose: 'Donation', internalReference: reference,
  });
  expect(screen.getByTestId('stripe-payment')).toBeInTheDocument();
}

it('submits the default $5 preset and locks the selected radio after session creation', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  await expectCheckout(user, '5');
  expect(screen.getByRole('radio', { name: formatCurrency(5) })).toBeChecked();
  expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
});

it('submits the latest preset after switching $5 to $10 to $25', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: formatCurrency(10) }));
  expect(reviewAmount()).toHaveTextContent(formatCurrency(10));
  await user.click(screen.getByRole('radio', { name: formatCurrency(25) }));
  await expectCheckout(user, '25');
});

it('submits a valid custom amount after selecting a preset, then locks the custom input', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: formatCurrency(10) }));
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  const input = screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount });
  expect(reviewAmount()).toHaveTextContent(en.SupportPage.notProvided);
  await user.type(input, '12.50');
  await expectCheckout(user, '12.50');
  expect(input).toBeDisabled();
  expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
});

it('accepts the largest amount supported by the donation and payment APIs', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  await user.type(screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount }), '99999999.99');
  await expectCheckout(user, '99999999.99');
});

it('discards an older custom amount when switching back to a preset', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  await user.type(screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount }), '17.25');
  await user.click(screen.getByRole('radio', { name: formatCurrency(25) }));
  await expectCheckout(user, '25');
});

it('clears an invalid custom error when a preset replaces it and submits only the preset', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  const customInput = screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount });
  await user.type(customInput, '1.234');
  await user.click(screen.getByRole('textbox', { name: en.SupportPage.firstName }));
  expect(customInput).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText(en.SupportPage.donationAmountError)).toBeInTheDocument();
  expect(reviewAmount()).toHaveTextContent(en.SupportPage.invalidAmount);

  // Leaving a rejected custom entry must not poison the next choice: the
  // summary and both independent payment requests now belong to the preset.
  await user.click(screen.getByRole('radio', { name: formatCurrency(10) }));
  expect(screen.queryByText(en.SupportPage.donationAmountError)).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: en.SupportPage.customDonationAmount })).not.toBeInTheDocument();
  await expectCheckout(user, '10');
});

it('clears a previously valid custom value when custom is selected again', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  await user.type(screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount }), '17.25');
  await user.click(screen.getByRole('radio', { name: formatCurrency(25) }));
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  expect(screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount })).toHaveValue('');
  expect(reviewAmount()).toHaveTextContent(en.SupportPage.notProvided);
  expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeDisabled();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(createPaymentSession).not.toHaveBeenCalled();
});

it.each(['', '0', '-1', '1.234', 'abc', '100000000']) (
  'blocks empty or invalid custom amount %j before either request', async (amount) => {
    const user = userEvent.setup();
    render(<DonationForm />);
    await fillDonor(user);
    await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
    const input = screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount });
    // Empty inputs must receive focus before leaving the field; simply
    // selecting the Custom radio does not trigger the input's blur handler.
    await user.click(input);
    if (amount) await user.type(input, amount);
    await user.click(screen.getByRole('textbox', { name: en.SupportPage.firstName }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(en.SupportPage.donationAmountError)).toBeInTheDocument();
    expect(reviewAmount()).toHaveTextContent(amount ? en.SupportPage.invalidAmount : en.SupportPage.notProvided);
    expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(createPaymentSession).not.toHaveBeenCalled();
  },
);

it('uses Japanese validation text for an invalid custom amount', async () => {
  mockLocale = 'ja';
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user, ja.SupportPage);
  await user.click(screen.getByRole('radio', { name: ja.SupportPage.customDonationOption }));
  const input = screen.getByRole('textbox', { name: ja.SupportPage.customDonationAmount });
  await user.type(input, '0');
  await user.click(screen.getByRole('textbox', { name: ja.SupportPage.firstName }));
  expect(screen.getByText(ja.SupportPage.donationAmountError)).toBeInTheDocument();
  expect(reviewAmount(ja.SupportPage)).toHaveTextContent(ja.SupportPage.invalidAmount);
  expect(screen.getByRole('button', { name: ja.SupportPage.continueToPayment })).toBeDisabled();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('freezes the amount during record creation and reuses the same amount and reference on session retry', async () => {
  const user = userEvent.setup();
  let completeRecord!: (response: Response) => void;
  jest.mocked(global.fetch).mockReturnValueOnce(new Promise((resolve) => { completeRecord = resolve; }));
  jest.mocked(createPaymentSession)
    .mockRejectedValueOnce(new Error('Payment unavailable'))
    .mockResolvedValueOnce({ sessionId: 'cs_retry', clientSecret: 'secret_retry' });
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: formatCurrency(25) }));
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
  completeRecord({ ok: true, json: async () => ({ reference_id: reference, amount: '25.00',
    processing_cost_contribution: '0.00', total_amount: '25.00' }) } as Response);
  await screen.findByText(en.SupportPage.paymentSessionError);
  expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(2));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(createPaymentSession).toHaveBeenNthCalledWith(2, {
    amount: '25', currency: 'usd', paymentPurpose: 'Donation', internalReference: reference,
  });
  expect(reviewAmount()).toHaveTextContent(formatCurrency(25));
});

it('keeps an entered custom amount locked when payment-session creation fails', async () => {
  const user = userEvent.setup();
  jest.mocked(createPaymentSession).mockRejectedValueOnce(new Error('Payment unavailable'));
  render(<DonationForm />);
  await fillDonor(user);
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  const customInput = screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount });
  await user.type(customInput, '32.75');
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());
  jest.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({
    reference_id: reference, amount: '32.75', processing_cost_contribution: '0.00',
    total_amount: '32.75',
  }) } as Response);
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await screen.findByText(en.SupportPage.paymentSessionError);
  expect(customInput).toBeDisabled();
  expect(customInput).toHaveValue('32.75');
  expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
  expect(reviewAmount()).toHaveTextContent(formatCurrency(32.75));
  // The retry creates a session for the existing record, not a new record
  // using some other selection or an edited custom field.
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(2));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(createPaymentSession).toHaveBeenNthCalledWith(2, {
    amount: '32.75', currency: 'usd', paymentPurpose: 'Donation', internalReference: reference,
  });
});

it('unlocks amount controls only when editing details with a new donation attempt', async () => {
  const user = userEvent.setup();
  const nextReference = 'DON-00000043';
  // Editing after Stripe session creation must create a fresh record: the new
  // amount cannot be paired with the original donation's saved reference.
  render(<DonationForm />);
  await fillDonor(user);
  await expectCheckout(user, '5');
  await user.click(screen.getByRole('button', { name: 'Edit donation details' }));
  const amount = screen.getByRole('radio', { name: formatCurrency(25) });
  expect(amount).toBeEnabled();
  await user.click(amount);
  expect(reviewAmount()).toHaveTextContent(formatCurrency(25));
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());
  jest.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({
    reference_id: nextReference, amount: '25.00', processing_cost_contribution: '0.00',
    total_amount: '25.00',
  }) } as Response);
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(2));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [, nextRequest] = jest.mocked(global.fetch).mock.calls[1];
  expect(JSON.parse((nextRequest as RequestInit).body as string)).toEqual(
    expect.objectContaining({ amount: '25' }),
  );
  expect(createPaymentSession).toHaveBeenNthCalledWith(2, {
    amount: '25', currency: 'usd', paymentPurpose: 'Donation', internalReference: nextReference,
  });
});

it.each([
  ['unchecked by default', false, false],
  ['selected', true, true],
  ['cleared again', true, false],
] as const)('submits the processing-cost choice when %s', async (_case, select, finalChoice) => {
  const user = userEvent.setup();
  render(<DonationForm />);
  await fillDonor(user);
  const checkbox = screen.getByRole('checkbox', { name: en.SupportPage.processingCostContribution });
  if (select) await user.click(checkbox);
  if (select && !finalChoice) await user.click(checkbox);
  expect(checkbox).toHaveProperty('checked', finalChoice);
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());

  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(1));
  const [, request] = jest.mocked(global.fetch).mock.calls[0];
  const body = JSON.parse((request as RequestInit).body as string) as Record<string, unknown>;
  expect(body).toMatchObject({ amount: '5', contribute_to_processing_costs: finalChoice });
  // Checkout sends only the choice; contribution and total stay server-controlled.
  expect(body).not.toHaveProperty('processing_cost_contribution');
  expect(body).not.toHaveProperty('total_amount');
  expect(createPaymentSession).toHaveBeenCalledWith({
    amount: '5', currency: 'usd', paymentPurpose: 'Donation', internalReference: reference,
  });
  expect(checkbox).toBeDisabled();
});

it('locks the choice during donation creation and after session failure, then keeps it on retry', async () => {
  const user = userEvent.setup();
  let completeRecord!: (response: Response) => void;
  jest.mocked(global.fetch).mockReturnValueOnce(new Promise((resolve) => { completeRecord = resolve; }));
  jest.mocked(createPaymentSession).mockRejectedValueOnce(new Error('Payment unavailable'));
  render(<DonationForm />);
  await fillDonor(user);
  const checkbox = screen.getByRole('checkbox', { name: en.SupportPage.processingCostContribution });
  await user.click(checkbox);
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  expect(checkbox).toBeDisabled();
  expect(checkbox).toBeChecked();
  completeRecord({ ok: true, json: async () => ({ reference_id: reference, amount: '5.00',
    processing_cost_contribution: '0.61', total_amount: '5.61' }) } as Response);
  await screen.findByText(en.SupportPage.paymentSessionError);
  expect(checkbox).toBeDisabled();
  expect(checkbox).toBeChecked();

  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(2));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [, request] = jest.mocked(global.fetch).mock.calls[0];
  expect(JSON.parse((request as RequestInit).body as string).contribute_to_processing_costs).toBe(true);
  expect(checkbox).toBeDisabled();
});

it('unlocks the choice on edit and submits the new choice with a fresh donation', async () => {
  const user = userEvent.setup();
  jest.mocked(global.fetch)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reference_id: reference,
      amount: '5.00', processing_cost_contribution: '0.61', total_amount: '5.61' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reference_id: 'DON-00000043',
      amount: '5.00', processing_cost_contribution: '0.00', total_amount: '5.00' }) } as Response);
  render(<DonationForm />);
  await fillDonor(user);
  const checkbox = screen.getByRole('checkbox', { name: en.SupportPage.processingCostContribution });
  await user.click(checkbox);
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(1));
  expect(checkbox).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Edit donation details' }));
  expect(checkbox).toBeEnabled();
  expect(checkbox).toBeChecked();
  await user.click(checkbox);
  await waitFor(() => expect(screen.getByRole('button', { name: en.SupportPage.continueToPayment })).toBeEnabled());
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  await waitFor(() => expect(createPaymentSession).toHaveBeenCalledTimes(2));
  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [, request] = jest.mocked(global.fetch).mock.calls[1];
  expect(JSON.parse((request as RequestInit).body as string).contribute_to_processing_costs).toBe(false);
  expect(checkbox).toBeDisabled();
});