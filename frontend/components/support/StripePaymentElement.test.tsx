/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { StripePaymentElement } from '@/components/support/StripePaymentElement';

const mockLoadStripe = jest.fn(() => Promise.resolve(null));
const mockConfirm = jest.fn();
const mockUpdateEmail = jest.fn();
let mockLocale = 'en';
let mockCanConfirm = false;
let mockCheckoutState: 'loading' | 'success' = 'loading';

jest.mock('@stripe/stripe-js', () => ({
  loadStripe: (...args: unknown[]) => mockLoadStripe(...args),
}));

jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => key,
}));

jest.mock('@stripe/react-stripe-js/checkout', () => ({
  CheckoutElementsProvider: ({ children }: { children: React.ReactNode }) => children,
  PaymentElement: () => null,
  useCheckoutElements: () => mockCheckoutState === 'success'
    ? {
        type: 'success',
        checkout: {
          canConfirm: mockCanConfirm,
          confirm: mockConfirm,
          updateEmail: mockUpdateEmail,
        },
      }
    : { type: 'loading' },
}));

describe('StripePaymentElement localization', () => {
  const originalPublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  beforeEach(() => {
    mockLoadStripe.mockClear();
    mockConfirm.mockReset();
    mockUpdateEmail.mockReset().mockResolvedValue({ type: 'success' });
    mockCheckoutState = 'loading';
    mockCanConfirm = false;
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_localization';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = originalPublishableKey;
  });

  it.each([
    ['en', 'en'],
    ['ja', 'ja'],
  ])('initializes Stripe with the %s page locale', (pageLocale, stripeLocale) => {
    mockLocale = pageLocale;

    render(
      <StripePaymentElement
        clientSecret="cs_test_secret"
        email="donor@example.com"
        onEditDonationDetails={jest.fn()}
      />,
    );

    expect(mockLoadStripe).toHaveBeenCalledWith('pk_test_localization', {
      locale: stripeLocale,
    });
  });

  it('does not confirm an incomplete hosted checkout, even on repeated clicks', async () => {
    // Stripe owns the payment inputs. Its canConfirm flag represents their
    // completeness, so the application must not call confirm while it is false.
    // The mock deliberately contains no card fields or provider secrets.
    mockCheckoutState = 'success';
    render(
      <StripePaymentElement
        clientSecret="cs_test_example"
        email="synthetic@example.com"
        onEditDonationDetails={jest.fn()}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: 'confirmPayment' });
    expect(confirmButton).toBeDisabled();
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    // Synchronizing the donor email must not substitute for completing the
    // Stripe-hosted method or authorize a payment on its own.
    await waitFor(() => expect(mockUpdateEmail).toHaveBeenCalledWith('synthetic@example.com'));
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(confirmButton).toBeDisabled();
  });

  it('holds confirmation while Stripe is unresolved and never treats its response as payment completion', async () => {
    // Two rapid clicks must make only one provider request. Keep it unresolved
    // so the in-flight guard and disabled button can both be inspected without
    // entering card details or relying on a real payment redirect.
    let finishConfirmation!: (result: { type: 'success' }) => void;
    mockCheckoutState = 'success';
    mockCanConfirm = true;
    mockConfirm.mockReturnValue(new Promise((resolve) => { finishConfirmation = resolve; }));

    render(<StripePaymentElement clientSecret="cs_test_example" email=" SYNTHETIC@example.com " onEditDonationDetails={jest.fn()} />);
    const confirmButton = screen.getByRole('button', { name: 'confirmPayment' });
    await waitFor(() => expect(mockUpdateEmail).toHaveBeenCalledWith('synthetic@example.com'));
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(mockConfirm).toHaveBeenCalledWith({ email: 'synthetic@example.com' });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'confirmingPayment' })).toBeDisabled();

    // Stripe normally navigates away on success. An immediate success-shaped
    // response alone must not unlock another confirmation or render a receipt.
    await act(async () => finishConfirmation({ type: 'success' }));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'confirmingPayment' })).toBeDisabled();
    expect(screen.queryByText('paymentCompleted')).not.toBeInTheDocument();
  });

  it.each(['provider error', 'thrown error'] as const)(
    'shows a generic error and permits one controlled retry after a %s',
    async (failure) => {
      // A known failed confirmation is different from an uncertain in-flight
      // outcome: only the former re-enables this same checkout for retry.
      mockCheckoutState = 'success';
      mockCanConfirm = true;
      if (failure === 'provider error') {
        mockConfirm.mockResolvedValueOnce({ type: 'error', error: { message: 'private-provider-detail' } });
      } else {
        mockConfirm.mockRejectedValueOnce(new Error('private-provider-detail'));
      }
      mockConfirm.mockResolvedValueOnce({ type: 'error', error: { message: 'private-provider-detail' } });
      render(<StripePaymentElement clientSecret="cs_test_example" email="synthetic@example.com" onEditDonationDetails={jest.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: 'confirmPayment' }));
      const retry = await screen.findByRole('button', { name: 'tryPaymentAgain' });
      expect(screen.getByRole('alert')).toHaveTextContent('paymentConfirmationError');
      expect(screen.queryByText('private-provider-detail')).not.toBeInTheDocument();
      expect(retry).toBeEnabled();
      fireEvent.click(retry);
      await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2));
      expect(mockConfirm).toHaveBeenNthCalledWith(2, { email: 'synthetic@example.com' });
    },
  );
});