import type {
  CreateMembershipPaymentSessionRequest,
  MembershipPaymentSession,
  PaymentSession,
} from '@/types/payment';

export type { PaymentSession } from '@/types/payment';

export type MembershipPaymentStatus = 'pending' | 'complete' | 'failed' | 'canceled';

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
  firstName,
  lastName,
  email,
  phone,
}: CreateMembershipPaymentSessionRequest): Promise<MembershipPaymentSession> {
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
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
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
    const {
      session_id: sessionId,
      client_secret: clientSecret,
      confirmation_reference: confirmationReference,
    } = data as Record<
      string,
      unknown
    >;
    if (
      typeof sessionId !== 'string' ||
      !sessionId.trim() ||
      typeof clientSecret !== 'string' ||
      !clientSecret.trim() ||
      typeof confirmationReference !== 'string' ||
      !/^MEM-[0-9a-f]{32}$/.test(confirmationReference)
    ) {
      throw unavailable();
    }

    return { sessionId, clientSecret, confirmationReference };
  } catch {
    throw unavailable();
  }
}

/** Read the locally confirmed membership state; never trust a browser-supplied status. */
export async function getMembershipPaymentStatus(
  confirmationReference: string,
): Promise<MembershipPaymentStatus> {
  const unavailable = () => new Error('Unable to retrieve payment status.');
  if (!API_BASE_URL || !/^MEM-[0-9a-f]{32}$/.test(confirmationReference)) {
    throw unavailable();
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/payments/membership/status/?confirmation_reference=${encodeURIComponent(confirmationReference)}`,
      { method: 'GET', cache: 'no-store' },
    );
    if (!response.ok) throw unavailable();
    const data: unknown = await response.json();
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw unavailable();
    }
    const { payment_purpose: purpose, payment_status: status } = data as Record<string, unknown>;
    // Return only the allowlisted status: never pass through extra response
    // fields (including any future Stripe objects or secrets) to the page.
    if (purpose !== 'membership' || typeof status !== 'string' || !['pending', 'complete', 'failed', 'canceled'].includes(status)) {
      throw unavailable();
    }
    return status as MembershipPaymentStatus;
  } catch {
    throw unavailable();
  }
}