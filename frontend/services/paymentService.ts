const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Information required by the backend to create a Stripe Checkout Session.
 */
interface CreatePaymentSessionRequest {
  amount: string;
  currency: string;
  paymentPurpose: string;
  internalReference: string;
}

/**
 * Information returned by the reusable payment-session endpoint.
 */
export interface PaymentSession {
  sessionId: string;
  clientSecret: string;
}

/**
 * Request a Stripe Checkout Session from the application backend.
 *
 * The Stripe secret key remains on the backend. This frontend request contains
 * only the donation amount and internal reference. It never contains card data.
 */
export async function createPaymentSession({
  amount,
  currency,
  paymentPurpose,
  internalReference,
}: CreatePaymentSessionRequest): Promise<PaymentSession> {
  const response = await fetch(`${API_BASE_URL}/api/payments/session/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      payment_purpose: paymentPurpose,
      internal_reference: internalReference,
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    session_id?: unknown;
    client_secret?: unknown;
  } | null;

  // Do not expose the backend or Stripe error response to the user.
  if (
    !response.ok ||
    typeof data?.session_id !== 'string' ||
    typeof data.client_secret !== 'string'
  ) {
    throw new Error('Unable to create the payment session.');
  }

  return {
    sessionId: data.session_id,
    clientSecret: data.client_secret,
  };
}