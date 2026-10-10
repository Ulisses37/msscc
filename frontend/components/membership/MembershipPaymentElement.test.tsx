/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';

const mockConfirmPayment = jest.fn();
const mockSubmit = jest.fn();
let mockMessages: typeof enMessages = enMessages;
// Switch the mock between Stripe being unavailable, an incomplete method,
// and a failed iframe load without creating application-owned card fields.
let mockStripeAvailable = true;
let mockElementComplete = true;
let mockLoadError = false;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof enMessages.MembershipPage) =>
    mockMessages.MembershipPage[key],
}));

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({}),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => children,
  // The test never handles card data: onReady/onChange represent Stripe's
  // readiness and completeness events, not application-owned inputs.
  PaymentElement: ({
    onReady,
    onChange,
    onLoadError,
  }: {
    onReady: () => void;
    onChange: (event: { complete: boolean }) => void;
    onLoadError: () => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        if (mockLoadError) {
          onLoadError();
          return;
        }
        onReady();
        onChange({ complete: mockElementComplete });
      }}
    >
      Simulate Stripe ready
    </button>
  ),
  useStripe: () => mockStripeAvailable ? { confirmPayment: mockConfirmPayment } : null,
  useElements: () => mockStripeAvailable ? { submit: mockSubmit } : null,
}));

describe('MembershipPaymentElement no-redirect confirmation', () => {
  let MembershipPaymentElement: typeof import('@/components/membership/MembershipPaymentElement').MembershipPaymentElement;
  const renderPayment = (props: { locale?: string; membershipInformationValid?: boolean } = {}) => {
    const onPaymentStateChange = jest.fn();
    render(
      <MembershipPaymentElement
        clientSecret="pi_test_secret"
        locale={props.locale ?? 'en'}
        membershipInformationValid={props.membershipInformationValid ?? true}
        onPaymentStateChange={onPaymentStateChange}
      />,
    );
    return onPaymentStateChange;
  };

  beforeAll(async () => {
    // The component reads the publishable key when its module is first loaded.
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_dummy';
    ({ MembershipPaymentElement } = await import('@/components/membership/MembershipPaymentElement'));
  });

  beforeEach(() => {
    mockMessages = enMessages;
    mockStripeAvailable = true;
    mockElementComplete = true;
    mockLoadError = false;
    mockConfirmPayment.mockReset();
    mockSubmit.mockReset();
    mockSubmit.mockResolvedValue({ error: undefined });
  });

  it('shows neutral submitted feedback and prevents simultaneous confirmation', async () => {
    // Keep Stripe confirmation unresolved while clicking twice to exercise
    // the in-flight guard, then settle without implying payment succeeded.
    let finishConfirmation!: (result: { error: undefined }) => void;
    mockConfirmPayment.mockReturnValue(
      new Promise((resolve) => {
        finishConfirmation = resolve;
      }),
    );

    const onPaymentStateChange = renderPayment();

    const pay = screen.getByRole('button', {
      name: enMessages.MembershipPage.confirmPayment,
    });
    expect(pay).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    fireEvent.click(pay);
    fireEvent.click(pay);

    await waitFor(() => expect(mockConfirmPayment).toHaveBeenCalledTimes(1));
    expect(pay).toBeDisabled();
    expect(onPaymentStateChange).toHaveBeenCalledWith('confirming');
    expect(mockConfirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}/en/membership`,
        },
      }),
    );

    finishConfirmation({ error: undefined });
    expect(
      await screen.findByText(enMessages.MembershipPage.paymentSubmitted),
    ).toBeInTheDocument();
    expect(onPaymentStateChange).toHaveBeenCalledWith('submitted');
    expect(screen.queryByRole('button', { name: enMessages.MembershipPage.confirmPayment })).not.toBeInTheDocument();
  });

  it('keeps payment disabled until Stripe, the element, and membership fields are ready', () => {
    const { rerender } = render(
      <MembershipPaymentElement clientSecret="pi_test_secret" locale="en" membershipInformationValid={false} onPaymentStateChange={jest.fn()} />,
    );
    expect(screen.getByText(enMessages.MembershipPage.loadingPaymentForm)).toBeInTheDocument();
    const pay = screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment });
    expect(pay).toBeDisabled();
    mockElementComplete = false;
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    expect(pay).toBeDisabled();
    mockElementComplete = true;
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    expect(pay).toBeDisabled();
    // Stripe readiness alone cannot override invalid membership information.
    rerender(
      <MembershipPaymentElement clientSecret="pi_test_secret" locale="en" membershipInformationValid onPaymentStateChange={jest.fn()} />,
    );
    expect(pay).toBeEnabled();
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });

  it('reports a safe error and re-enables payment after a rejected confirmation', async () => {
    mockConfirmPayment.mockResolvedValue({ error: { message: 'private-stripe-detail' } });
    const onPaymentStateChange = renderPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    fireEvent.click(screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment }));

    expect(await screen.findByRole('alert')).toHaveTextContent(enMessages.MembershipPage.paymentConfirmationError);
    expect(screen.queryByText(/private-stripe-detail/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment })).toBeEnabled();
    expect(onPaymentStateChange).toHaveBeenLastCalledWith('ready');
  });

  it('does not confirm if Stripe rejects elements.submit', async () => {
    mockSubmit.mockResolvedValue({ error: { message: 'private-stripe-detail' } });
    renderPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    fireEvent.click(screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment }));
    expect(await screen.findByRole('alert')).toHaveTextContent(enMessages.MembershipPage.paymentConfirmationError);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });

  it('handles thrown confirmation errors and Stripe element load failures safely', async () => {
    mockConfirmPayment.mockRejectedValue(new Error('private-stripe-detail'));
    renderPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    fireEvent.click(screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment }));
    expect(await screen.findByRole('alert')).toHaveTextContent(enMessages.MembershipPage.paymentConfirmationError);
    cleanup();

    mockLoadError = true;
    renderPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    expect(screen.getByRole('alert')).toHaveTextContent(enMessages.MembershipPage.paymentConfirmationError);
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment })).toBeDisabled();
  });

  it('shows a translated Japanese error without missing-message keys', async () => {
    mockMessages = jaMessages;
    mockConfirmPayment.mockResolvedValue({ error: { message: 'private-stripe-detail' } });
    renderPayment({ locale: 'ja' });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.MembershipPage.confirmPayment }));
    expect(await screen.findByRole('alert')).toHaveTextContent(jaMessages.MembershipPage.paymentConfirmationError);
  });

  it('shows Japanese submitted feedback without claiming membership activation', async () => {
    mockMessages = jaMessages;
    mockConfirmPayment.mockResolvedValue({ error: undefined });
    const onPaymentStateChange = renderPayment({ locale: 'ja' });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.MembershipPage.confirmPayment }));
    expect(await screen.findByText(jaMessages.MembershipPage.paymentSubmitted)).toBeInTheDocument();
    expect(onPaymentStateChange).toHaveBeenLastCalledWith('submitted');
    expect(mockConfirmPayment).toHaveBeenCalledWith(expect.objectContaining({
      confirmParams: { return_url: `${window.location.origin}/ja/membership` },
      redirect: 'if_required',
    }));
  });

  it('does not submit without Stripe context and reports an absent client secret safely', () => {
    mockStripeAvailable = false;
    renderPayment();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment })).toBeDisabled();
    expect(mockSubmit).not.toHaveBeenCalled();
    cleanup();
    render(<MembershipPaymentElement clientSecret="" locale="en" membershipInformationValid onPaymentStateChange={jest.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(enMessages.MembershipPage.paymentUnavailable);
  });

  it('shows delayed-submission guidance without starting another confirmation', async () => {
    // Stripe may stay pending (for example during authentication); the timer
    // only changes the message, never releases the duplicate-payment guard.
    jest.useFakeTimers();
    try {
      mockConfirmPayment.mockReturnValue(new Promise(() => undefined));
      renderPayment();
      fireEvent.click(screen.getByRole('button', { name: 'Simulate Stripe ready' }));
      fireEvent.click(screen.getByRole('button', { name: enMessages.MembershipPage.confirmPayment }));
      await act(async () => { await Promise.resolve(); }); // Wait for elements.submit.
      expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
      // The disabled button and the synchronous ref both prevent retries.
      expect(screen.getByRole('button', { name: enMessages.MembershipPage.confirmingPayment })).toBeDisabled();
      act(() => { jest.advanceTimersByTime(12000); });
      expect(screen.getByText(enMessages.MembershipPage.paymentTakingLonger)).toBeInTheDocument();
      expect(mockConfirmPayment).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});