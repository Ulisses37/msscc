import type {
  CreateMembershipPaymentSessionRequest,
  PaymentSession,
} from '@/types/payment';

export type { PaymentSession } from '@/types/payment';

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

/** Request a membership PaymentIntent without sending a price or card data. */
export async function createMembershipPaymentSession({
  membershipOptionId,
}: CreateMembershipPaymentSessionRequest): Promise<PaymentSession> {
  // Keep the failure generic even when the network, backend, or Stripe response
  // contains details; the calling page shows its own translated message.
  const unavailable = () => new Error('Unable to create the payment session.');
  if (!API_BASE_URL) {
    throw unavailable();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/membership/session/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        membership_option_id: membershipOptionId,
        payment_purpose: 'membership',
      }),
    });
    if (!response.ok) {
      throw unavailable();
    }

    const data: unknown = await response.json();
    // A successful HTTP response is not enough: Stripe Elements needs both
    // nonblank strings. Do not log or display malformed responses or secrets.
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw unavailable();
    }
    const { session_id: sessionId, client_secret: clientSecret } = data as Record<
      string,
      unknown
    >;
    if (
      typeof sessionId !== 'string' ||
      !sessionId.trim() ||
      typeof clientSecret !== 'string' ||
      !clientSecret.trim()
    ) {
      throw unavailable();
    }

    return { sessionId, clientSecret };
  } catch {
    throw unavailable();
  }
}