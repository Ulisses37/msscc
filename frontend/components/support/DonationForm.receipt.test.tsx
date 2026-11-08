/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';

import { DonationForm } from '@/components/support/DonationForm';
import en from '@/messages/en.json';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof en.SupportPage) => en.SupportPage[key],
  useLocale: () => 'en',
}));
jest.mock('@/components/support/DonationSummary', () => ({ DonationSummary: () => null }));
jest.mock('@/components/support/StripePaymentElement', () => ({ StripePaymentElement: () => null }));
jest.mock('@/components/payments/PaymentReceipt', () => ({
  // Spy on when the receipt mounts; a unit test must not contact the receipt
  // endpoint while it verifies the redirected page's status gating.
  PaymentReceipt: ({ reference }: { reference: string }) =>
    <div data-testid="receipt">{reference}</div>,
}));

const originalFetch = global.fetch;
const reference = 'DON-00000042';

beforeEach(() => {
  window.history.replaceState({}, '', '/en/support?session_id=cs_test_safe');
  global.fetch = jest.fn();
});
afterEach(() => { global.fetch = originalFetch; });

it('shows the receipt only after the redirect status confirms a completed donation', async () => {
  let finish!: (value: Response) => void;
  jest.mocked(global.fetch).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  render(<DonationForm />);
  expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  await act(async () => finish({ ok: true, json: async () => ({
    payment_status: 'completed', confirmation_reference: reference,
  }) } as Response));
  expect(screen.getByText(en.SupportPage.paymentCompleted)).toBeInTheDocument();
  expect(screen.getByTestId('receipt')).toHaveTextContent(reference);
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/payments/status/?session_id=cs_test_safe'),
    { cache: 'no-store' },
  );
});

it('keeps a pending donation unconfirmed until a later backend status completes it', async () => {
  jest.useFakeTimers();
  try {
    // Even a successful status HTTP response with a receipt-shaped reference
    // is not a payment success while the signed-webhook-backed state is pending.
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        payment_status: 'pending', confirmation_reference: reference,
      }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        payment_status: 'completed', confirmation_reference: reference,
      }) } as Response);

    render(<DonationForm />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(en.SupportPage.paymentPending)).toBeInTheDocument();
    expect(screen.queryByText(en.SupportPage.paymentCompleted)).not.toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // The form waits for its existing polling interval, then reads the same
    // session's authoritative status instead of creating a second payment.
    await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(jest.mocked(global.fetch).mock.calls[1]).toEqual(jest.mocked(global.fetch).mock.calls[0]);
    expect(screen.getByText(en.SupportPage.paymentCompleted)).toBeInTheDocument();
    expect(screen.getByTestId('receipt')).toHaveTextContent(reference);
  } finally {
    jest.useRealTimers();
  }
});

it.each(['failed', 'canceled'] as const)('does not show a receipt for %s', async (state) => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
    payment_status: state, confirmation_reference: reference,
  }) } as Response);
  render(<DonationForm />);
  expect(await screen.findByText(en.SupportPage[state === 'failed' ? 'paymentFailed' : 'paymentCanceled'])).toBeInTheDocument();
  expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
});

it('keeps the success message when the completed status has no safe receipt reference', async () => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
    payment_status: 'completed', confirmation_reference: 'pi_private',
  }) } as Response);
  render(<DonationForm />);
  expect(await screen.findByText(en.SupportPage.paymentCompleted)).toBeInTheDocument();
  expect(screen.getByText(en.SupportPage.receiptUnavailable)).toBeInTheDocument();
  expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  expect(screen.queryByText('pi_private')).not.toBeInTheDocument();
});