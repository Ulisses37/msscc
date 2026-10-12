/** @jest-environment jsdom */
import '@testing-library/jest-dom';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  MembershipPaymentResult,
  PAYMENT_STATUS_MAX_POLL_DURATION_MS,
  PAYMENT_STATUS_POLL_INTERVAL_MS,
} from '@/components/membership/MembershipPaymentResult';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import { createMembershipPaymentSession, getMembershipPaymentStatus } from '@/services/paymentService';

const reference = `MEM-${'a'.repeat(32)}`;
let mockMessages: typeof enMessages = enMessages;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof enMessages.MembershipPaymentResult) => {
    const message = mockMessages.MembershipPaymentResult[key];
    if (typeof message !== 'string') throw new Error(`Missing result message: ${key}`);
    return message;
  },
}));
jest.mock('@/services/paymentService', () => ({
  getMembershipPaymentStatus: jest.fn(),
  createMembershipPaymentSession: jest.fn(),
}));
jest.mock('@/components/payments/PaymentReceipt', () => ({
  PaymentReceipt: ({ reference }: { reference: string }) => <div data-testid="receipt">{reference}</div>,
}));

describe('MembershipPaymentResult states and browser recovery', () => {
  beforeEach(() => {
    mockMessages = enMessages;
    jest.mocked(getMembershipPaymentStatus).mockReset();
    jest.mocked(createMembershipPaymentSession).mockReset();
  });

  afterEach(() => jest.useRealTimers());

  const advance = async (milliseconds: number) => {
    // Flush both React updates and the promise continuation of a timer's request.
    await act(async () => { jest.advanceTimersByTime(milliseconds); });
  };

  it('shows loading, then the database-confirmed result without a new payment option', async () => {
    // Keep the first status request unresolved to observe the initial state;
    // returning "complete" must not offer another payment attempt.
    let finish!: (status: 'complete') => void;
    jest.mocked(getMembershipPaymentStatus).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    expect(screen.getByText(enMessages.MembershipPaymentResult.loading)).toBeInTheDocument();
    finish('complete');
    expect(await screen.findByText(enMessages.MembershipPaymentResult.complete)).toBeInTheDocument();
    expect(screen.getByText(enMessages.MembershipPaymentResult.complete).parentElement).toHaveClass(
      'border-green-200', 'bg-green-50',
    );
    expect(screen.getByTestId('receipt')).toHaveTextContent(reference);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it.each(['failed', 'canceled'] as const)('offers a fresh form for %s only after status is confirmed', async (status) => {
    jest.mocked(getMembershipPaymentStatus).mockResolvedValue(status);
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    expect(await screen.findByText(enMessages.MembershipPaymentResult[status])).toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: enMessages.MembershipPaymentResult.returnToPayment })).toHaveAttribute('href', '/en/membership');
  });

  it('never requests status for a malformed reference', async () => {
    render(<MembershipPaymentResult locale="en" confirmationReference="pi_secret" />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(enMessages.MembershipPaymentResult.statusError));
    expect(getMembershipPaymentStatus).not.toHaveBeenCalled();
  });

  it('polls pending after the named interval and stops after a terminal response', async () => {
    jest.useFakeTimers();
    jest.mocked(getMembershipPaymentStatus).mockResolvedValueOnce('pending').mockResolvedValueOnce('complete');
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(enMessages.MembershipPaymentResult.pending)).toBeInTheDocument();
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS - 1);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(screen.getByText(enMessages.MembershipPaymentResult.complete)).toBeInTheDocument();
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each(['failed', 'canceled'] as const)('stops polling on %s and offers only a new form', async (status) => {
    jest.useFakeTimers();
    jest.mocked(getMembershipPaymentStatus).mockResolvedValueOnce('pending').mockResolvedValueOnce(status);
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    await act(async () => { await Promise.resolve(); });
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS);
    expect(screen.getByText(enMessages.MembershipPaymentResult[status])).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en/membership');
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
    expect(createMembershipPaymentSession).not.toHaveBeenCalled();
  });

  it('stops at the maximum duration and offers single status checks without restarting polling', async () => {
    jest.useFakeTimers();
    jest.mocked(getMembershipPaymentStatus).mockResolvedValue('pending');
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    await act(async () => { await Promise.resolve(); });
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    expect(screen.getByText(enMessages.MembershipPaymentResult.takingLonger)).toBeInTheDocument();
    const countAtDeadline = jest.mocked(getMembershipPaymentStatus).mock.calls.length;
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS * 3);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(countAtDeadline);
    // A timed-out pending result permits one explicit read, not a fresh
    // polling window that could keep issuing requests indefinitely.
    fireEvent.click(screen.getByRole('button', { name: enMessages.MembershipPaymentResult.retryStatus }));
    await act(async () => { await Promise.resolve(); });
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(countAtDeadline + 1);
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS * 3);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(countAtDeadline + 1);
  });

  it('shows useful guidance at the deadline even if the first response is still slow', async () => {
    jest.useFakeTimers();
    let finish!: (status: 'pending') => void;
    jest.mocked(getMembershipPaymentStatus).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    expect(screen.getByText(enMessages.MembershipPaymentResult.takingLonger)).toBeInTheDocument();
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(1);
    await act(async () => { finish('pending'); });
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS * 2);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it('does not overlap status requests while a scheduled poll is delayed', async () => {
    jest.useFakeTimers();
    let finish!: (status: 'complete') => void;
    jest.mocked(getMembershipPaymentStatus).mockResolvedValueOnce('pending')
      .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    await act(async () => { await Promise.resolve(); });
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
    // Advancing beyond several intervals cannot queue another request while
    // this poll is unresolved; it can only update the long-running message.
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS * 3);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
    await act(async () => { finish('complete'); });
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it('clears timers on unmount and ignores an in-flight response after leaving', async () => {
    jest.useFakeTimers();
    jest.mocked(getMembershipPaymentStatus).mockResolvedValueOnce('pending');
    const { unmount } = render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    await act(async () => { await Promise.resolve(); });
    unmount();
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS + PAYMENT_STATUS_POLL_INTERVAL_MS);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(1);

    let finish!: (status: 'pending') => void;
    jest.mocked(getMembershipPaymentStatus).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const second = render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    second.unmount();
    await act(async () => { finish('pending'); });
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
  });

  it('retries a failed status read without simultaneous requests or exposing internals', async () => {
    let finish!: (status: 'complete') => void;
    jest.mocked(getMembershipPaymentStatus)
      .mockRejectedValueOnce(new Error('private-backend-detail'))
      .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    const retry = await screen.findByRole('button', { name: enMessages.MembershipPaymentResult.retryStatus });
    expect(screen.getByRole('alert')).not.toHaveTextContent('private-backend-detail');
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
    // Error retry clears the alert immediately; the old button is removed,
    // and the synchronous in-flight guard also rejects a rapid second click.
    expect(screen.queryByRole('button', { name: enMessages.MembershipPaymentResult.retryStatus })).not.toBeInTheDocument();
    await act(async () => { finish('complete'); });
    expect(screen.getByText(enMessages.MembershipPaymentResult.complete)).toBeInTheDocument();
    expect(createMembershipPaymentSession).not.toHaveBeenCalled();
  });

  it('prevents concurrent manual checks during a delayed pending retry', async () => {
    jest.useFakeTimers();
    let finish!: (status: 'complete') => void;
    jest.mocked(getMembershipPaymentStatus).mockResolvedValueOnce('pending')
      .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    await act(async () => { await Promise.resolve(); });
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    const retry = screen.getByRole('button', { name: enMessages.MembershipPaymentResult.retryStatus });
    fireEvent.click(retry);
    fireEvent.click(retry);
    await advance(PAYMENT_STATUS_POLL_INTERVAL_MS * 2);
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
    expect(retry).toBeDisabled();
    await act(async () => { finish('complete'); });
    expect(screen.getByText(enMessages.MembershipPaymentResult.complete)).toBeInTheDocument();
  });

  it('refreshing a completed result reads status but never starts a new payment', async () => {
    jest.mocked(getMembershipPaymentStatus).mockResolvedValue('complete');
    // Remount with the same opaque reference to model a browser refresh;
    // the result page must read existing state rather than create an intent.
    const first = render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    expect(await screen.findByText(enMessages.MembershipPaymentResult.complete)).toBeInTheDocument();
    first.unmount();
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    expect(await screen.findByText(enMessages.MembershipPaymentResult.complete)).toBeInTheDocument();
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(2);
    expect(createMembershipPaymentSession).not.toHaveBeenCalled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([['en', enMessages], ['ja', jaMessages]] as const)('renders all %s result messages without missing keys', async (locale, messages) => {
    mockMessages = messages;
    for (const status of ['pending', 'complete', 'failed', 'canceled'] as const) {
      jest.mocked(getMembershipPaymentStatus).mockResolvedValueOnce(status);
      const view = render(<MembershipPaymentResult locale={locale} confirmationReference={reference} />);
      expect(await screen.findByText(messages.MembershipPaymentResult[status])).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: messages.MembershipPaymentResult.heading })).toBeInTheDocument();
      view.unmount();
    }
    await waitFor(() => expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(4));
  });

  it.each([['en', enMessages], ['ja', jaMessages]] as const)('renders %s error and delayed guidance using translated keys', async (locale, messages) => {
    jest.useFakeTimers();
    mockMessages = messages;
    jest.mocked(getMembershipPaymentStatus).mockRejectedValueOnce(new Error('private-detail'))
      .mockResolvedValue('pending');
    render(<MembershipPaymentResult locale={locale} confirmationReference={reference} />);
    await act(async () => { await Promise.resolve(); });
    const retry = screen.getByRole('button', { name: messages.MembershipPaymentResult.retryStatus });
    expect(screen.getByRole('alert')).toHaveTextContent(messages.MembershipPaymentResult.statusError);
    fireEvent.click(retry);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(messages.MembershipPaymentResult.pending)).toBeInTheDocument();
    // The exact same locale keys must also resolve after the bounded window.
    await advance(PAYMENT_STATUS_MAX_POLL_DURATION_MS);
    expect(screen.getByText(messages.MembershipPaymentResult.takingLonger)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.MembershipPaymentResult.retryStatus })).toBeInTheDocument();
  });
});