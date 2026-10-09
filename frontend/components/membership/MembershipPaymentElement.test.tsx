/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import enMessages from '@/messages/en.json';

const mockConfirmPayment = jest.fn();
const mockSubmit = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof enMessages.MembershipPage) =>
    enMessages.MembershipPage[key],
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
  }: {
    onReady: () => void;
    onChange: (event: { complete: boolean }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onReady();
        onChange({ complete: true });
      }}
    >
      Simulate Stripe ready
    </button>
  ),
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({ submit: mockSubmit }),
}));

describe('MembershipPaymentElement no-redirect confirmation', () => {
  beforeEach(() => {
    mockConfirmPayment.mockReset();
    mockSubmit.mockReset();
    mockSubmit.mockResolvedValue({ error: undefined });
  });

  it('shows neutral submitted feedback and prevents simultaneous confirmation', async () => {
    // The component reads the publishable key when its module is first loaded.
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_dummy';
    const { MembershipPaymentElement } = await import(
      '@/components/membership/MembershipPaymentElement'
    );
    let finishConfirmation!: (result: { error: undefined }) => void;
    mockConfirmPayment.mockReturnValue(
      new Promise((resolve) => {
        finishConfirmation = resolve;
      }),
    );

    const onPaymentStateChange = jest.fn();
    render(
      <MembershipPaymentElement
        clientSecret="pi_test_secret"
        locale="en"
        membershipInformationValid
        onPaymentStateChange={onPaymentStateChange}
      />,
    );

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
});