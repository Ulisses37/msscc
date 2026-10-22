/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DonationForm } from '@/components/support/DonationForm';
import { createPaymentSession } from '@/services/paymentService';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import { formatCurrency } from '@/utils/formatCurrency';

let mockLocale: 'en' | 'ja' = 'en';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: 'SupportPage') => (key: keyof typeof en.SupportPage) =>
    (mockLocale === 'ja' ? ja : en)[namespace][key],
}));
jest.mock('@/services/paymentService', () => ({ createPaymentSession: jest.fn() }));
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
const originalFetch = global.fetch;

beforeEach(() => {
  mockLocale = 'en';
  window.history.replaceState({}, '', '/en/support');
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ reference_id: reference }),
  });
  jest.mocked(createPaymentSession).mockReset();
  jest.mocked(createPaymentSession).mockResolvedValue({ sessionId: 'cs_test', clientSecret: 'secret_test' });
});
afterEach(() => { global.fetch = originalFetch; });

async function fillDonor(user: ReturnType<typeof userEvent.setup>, messages = en.SupportPage) {
  await user.type(screen.getByRole('textbox', { name: messages.email }), 'donor@example.com');
  await user.type(screen.getByRole('textbox', { name: messages.firstName }), 'Ada');
  await user.type(screen.getByRole('textbox', { name: messages.lastName }), 'Lovelace');
  await user.type(screen.getByRole('textbox', { name: messages.address }), '123 Main St');
}

function reviewAmount(messages = en.SupportPage) {
  // Read only the donation row; other empty summary fields can share the same
  // placeholder and should never determine whether checkout is consistent.
  const summary = screen.getByRole('region', { name: messages.summaryHeading });
  return within(summary).getByText(messages.donationAmount).nextElementSibling;
}

async function expectCheckout(user: ReturnType<typeof userEvent.setup>, amount: string) {
  expect(reviewAmount()).toHaveTextContent(formatCurrency(Number(amount)));
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
  await user.click(screen.getByRole('button', { name: en.SupportPage.continueToPayment }));
  expect(screen.getAllByRole('radio').every((radio) => (radio as HTMLInputElement).disabled)).toBe(true);
  completeRecord({ ok: true, json: async () => ({ reference_id: reference }) } as Response);
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

it('unlocks amount controls only when editing details with a new donation attempt', async () => {
  const user = userEvent.setup();
  const nextReference = 'DON-00000043';
  // Editing after Stripe session creation must create a fresh record: the new
  // amount cannot be paired with the original donation's saved reference.
  jest.mocked(global.fetch)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reference_id: reference }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reference_id: nextReference }) } as Response);
  render(<DonationForm />);
  await fillDonor(user);
  await expectCheckout(user, '5');
  await user.click(screen.getByRole('button', { name: 'Edit donation details' }));
  const amount = screen.getByRole('radio', { name: formatCurrency(25) });
  expect(amount).toBeEnabled();
  await user.click(amount);
  expect(reviewAmount()).toHaveTextContent(formatCurrency(25));
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