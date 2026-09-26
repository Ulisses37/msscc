'use client';

import { PaymentElement } from '@stripe/react-stripe-js/checkout';
import { CheckoutElementsProvider } from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';

// NEXT_PUBLIC variables are safe to use in frontend code.
// This must be the publishable pk_test_ key, never the sk_test_ secret key.
const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Initialize Stripe once outside the React component.
// This prevents Stripe from being reloaded whenever the component rerenders.
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

interface StripePaymentElementProps {
  // The client secret is returned by the backend payment-session endpoint.
  clientSecret: string;
}

/**
 * Displays Stripe-hosted payment fields.
 *
 * Stripe collects the card information inside its own secure iframe.
 * Raw card information is therefore not stored in React state or sent
 * through the application's backend.
 */
export function StripePaymentElement({
  clientSecret,
}: StripePaymentElementProps) {
  // Do not attempt to initialize Stripe when configuration is missing.
  if (!stripePromise) {
    return (
      <p className="text-sm text-red-600" role="alert">
        The payment form is currently unavailable.
      </p>
    );
  }

  return (
    <CheckoutElementsProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: {
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#2a9d8f',
              colorText: '#264653',
              borderRadius: '2px',
            },
          },
        },
      }}
    >
      {/* Stripe inserts its secure payment iframe here. */}
      <PaymentElement />
    </CheckoutElementsProvider>
  );
}