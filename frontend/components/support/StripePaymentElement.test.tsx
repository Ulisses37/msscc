/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render } from '@testing-library/react';

import { StripePaymentElement } from '@/components/support/StripePaymentElement';

const mockLoadStripe = jest.fn(() => Promise.resolve(null));
let mockLocale = 'en';

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
  useCheckoutElements: () => ({ type: 'loading' }),
}));

describe('StripePaymentElement localization', () => {
  const originalPublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  beforeEach(() => {
    mockLoadStripe.mockClear();
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
});