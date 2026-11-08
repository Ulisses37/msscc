/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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
});