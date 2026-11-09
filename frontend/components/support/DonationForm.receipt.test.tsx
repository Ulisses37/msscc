/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

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

it.each(['rejected request', 'malformed response'] as const)(
  'does not claim a completed donation when the returned status has a %s',
  async (failure) => {
    // A redirect is not proof of settlement. Model a backend/network failure
    // without contacting Stripe or exposing the session identifier or provider
    // error to the visitor. An ambiguous result must not render a receipt.
    if (failure === 'rejected request') {
      jest.mocked(global.fetch).mockRejectedValue(new Error('private-provider-detail'));
    } else {
      jest.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ payment_status: 'unknown', confirmation_reference: reference }),
      } as Response);
    }

    render(<DonationForm />);
    expect(await screen.findByText(en.SupportPage.paymentResultUnavailable)).toBeInTheDocument();
    expect(screen.queryByText(en.SupportPage.paymentCompleted)).not.toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
    expect(screen.queryByText(reference)).not.toBeInTheDocument();
    expect(screen.queryByText('private-provider-detail')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  },
);

it('retries the original session after an uncertain lookup, never starting a second donation', async () => {
  jest.mocked(global.fetch)
    .mockRejectedValueOnce(new Error('private-provider-detail'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      payment_status: 'completed', confirmation_reference: reference,
    }) } as Response);
  render(<DonationForm />);
  expect(await screen.findByText(en.SupportPage.paymentResultUnavailable)).toBeInTheDocument();
  // A failed network request is not a failed payment. Preserve the original
  // session so a retry checks its backend status rather than creating a charge.
  expect(screen.queryByRole('button', { name: en.SupportPage.startNewDonationAttempt })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: en.SupportPage.retryPaymentStatus }));
  expect(await screen.findByTestId('receipt')).toHaveTextContent(reference);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(jest.mocked(global.fetch).mock.calls[1]).toEqual(jest.mocked(global.fetch).mock.calls[0]);
  expect(window.location.search).toBe('?session_id=cs_test_safe');
});

it('ignores rapid repeat status-retry clicks until the first lookup resolves', async () => {
  let finish!: (value: Response) => void;
  jest.mocked(global.fetch)
    .mockRejectedValueOnce(new Error('private-provider-detail'))
    .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<DonationForm />);
  expect(await screen.findByText(en.SupportPage.paymentResultUnavailable)).toBeInTheDocument();
  const retry = screen.getByRole('button', { name: en.SupportPage.retryPaymentStatus });
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(retry).toBeDisabled();
  expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  await act(async () => finish({ ok: true, json: async () => ({
    payment_status: 'pending', confirmation_reference: reference,
  }) } as Response));
  expect(screen.getByText(en.SupportPage.paymentPending)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

it('rechecks the same returned session on refresh without creating another donation', async () => {
  // Remounting models a browser refresh: URL state survives, component state
  // does not. Both mounts must ask the backend rather than trust the redirect.
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
    payment_status: 'completed', confirmation_reference: reference,
  }) } as Response);
  const first = render(<DonationForm />);
  expect(await screen.findByTestId('receipt')).toHaveTextContent(reference);
  first.unmount();
  render(<DonationForm />);
  expect(await screen.findByTestId('receipt')).toHaveTextContent(reference);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(jest.mocked(global.fetch).mock.calls[1]).toEqual(jest.mocked(global.fetch).mock.calls[0]);
  expect(jest.mocked(global.fetch).mock.calls[0][0]).toContain('/api/payments/status/');
});

it('stops pending polling after ten checks without claiming success or mounting a receipt', async () => {
  jest.useFakeTimers();
  try {
    // Every mocked backend response remains pending. Advancing eleven polling
    // intervals catches accidental retries beyond the documented ten-check cap.
    jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
      payment_status: 'pending', confirmation_reference: reference,
    }) } as Response);
    render(<DonationForm />);
    await act(async () => { await Promise.resolve(); });
    for (let check = 1; check < 10; check += 1) {
      await act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); });
    }
    await act(async () => { jest.advanceTimersByTime(3000); await Promise.resolve(); });
    expect(global.fetch).toHaveBeenCalledTimes(10);
    expect(screen.getByText(en.SupportPage.paymentPending)).toBeInTheDocument();
    expect(screen.queryByText(en.SupportPage.paymentCompleted)).not.toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

it('ignores a late completed status after leaving the returned support page', async () => {
  let finish!: (response: Response) => void;
  jest.mocked(global.fetch).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const view = render(<DonationForm />);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  // This resolved promise must not create a receipt, trigger a second lookup,
  // or update state for a page that is no longer mounted.
  await act(async () => finish({ ok: true, json: async () => ({
    payment_status: 'completed', confirmation_reference: reference,
  }) } as Response));
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
});