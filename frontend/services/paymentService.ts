import type {
  CreateMembershipPaymentSessionRequest,
  MembershipPaymentSession,
  PaymentSession,
} from '@/types/payment';
import type { MembershipOptionId } from '@/constants/membershipOptions';

export type { PaymentSession } from '@/types/payment';

export type MembershipPaymentStatus = 'pending' | 'complete' | 'failed' | 'canceled';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export type PaymentReceipt = {
  // Only the public allowlist survives the API boundary; this is not a model
  // or a raw Stripe response.
  paymentPurpose: 'donation' | 'membership';
  amount: string;
  baseAmount?: string;
  processingCostContribution?: string;
  totalAmount?: string;
  currency: string;
  completedAt: string;
  confirmationReference: string;
  membershipOption?: 'student' | 'individual' | 'family' | 'corporate';
  donationPurpose?: string;
};

export type DonationQuote = {
  amount: string;
  processingCostContribution: string;
  totalAmount: string;
};

/** Parse API money into integer cents solely to validate/display it, never to price checkout. */
function decimalCents(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{1,8}\.\d{2}$/.test(value)) return null;
  const [whole, fraction] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Reject malformed or inconsistent money before it becomes a payable UI summary. */
export function readDonationQuote(data: unknown): DonationQuote {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid quote.');
  const fields = data as Record<string, unknown>;
  const base = decimalCents(fields.amount);
  const contribution = decimalCents(fields.processing_cost_contribution);
  const total = decimalCents(fields.total_amount);
  if (base === null || base <= 0 || contribution === null || total === null ||
      base + contribution !== total) throw new Error('Invalid quote.');
  return {
    amount: fields.amount as string,
    processingCostContribution: fields.processing_cost_contribution as string,
    totalAmount: fields.total_amount as string,
  };
}

/** Ask the server for the current choice's price without creating a payment. */
export async function getDonationQuote(amount: string, contribute: boolean): Promise<DonationQuote> {
  const unavailable = () => new Error('Unable to calculate donation total.');
  if (!API_BASE_URL || !/^\d{1,8}(?:\.\d{1,2})?$/.test(amount) ||
      decimalCents(Number(amount).toFixed(2)) === null) {
    throw unavailable();
  }
  try {
    const response = await fetch(`${API_BASE_URL}/api/donations/quote/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, contribute_to_processing_costs: contribute }),
    });
    if (!response.ok) throw unavailable();
    const quote = readDonationQuote(await response.json());
    // A slow response must not display an amount/opt-in combination different
    // from the request, even if its fields are individually well formed.
    if (quote.amount !== Number(amount).toFixed(2) ||
        (!contribute && quote.processingCostContribution !== '0.00')) throw unavailable();
    return quote;
  } catch {
    throw unavailable();
  }
}

export async function getMembershipQuote(optionId: MembershipOptionId, contribute: boolean): Promise<DonationQuote> {
  const unavailable = () => new Error('Unable to calculate membership total.');
  if (!API_BASE_URL) throw unavailable();
  try {
    const response = await fetch(`${API_BASE_URL}/api/payments/membership/quote/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membership_option_id: optionId, contribute_to_processing_costs: contribute }),
    });
    if (!response.ok) throw unavailable();
    const quote = readDonationQuote(await response.json());
    if (!contribute && quote.processingCostContribution !== '0.00') throw unavailable();
    return quote;
  } catch { throw unavailable(); }
}

/** Accept only a completed payment's public receipt, never pass raw API objects to UI. */
export async function getPaymentReceipt(reference: string): Promise<PaymentReceipt> {
  const unavailable = () => new Error('Unable to retrieve receipt.');
  // Reject other namespaces before requesting a public receipt endpoint.
  if (!API_BASE_URL || !/^(DON-[0-9]{8,}|MEM-[0-9a-f]{32})$/.test(reference)) {
    throw unavailable();
  }
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/payments/receipt/?confirmation_reference=${encodeURIComponent(reference)}`,
      { method: 'GET', cache: 'no-store' },
    );
    if (!response.ok) throw unavailable();
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw unavailable();
    const fields = data as Record<string, unknown>;
    // A successful HTTP response does not establish the payment type or the
    // reference; validate both against the requested internal reference.
    const purpose = fields.payment_purpose;
    const option = fields.membership_option;
    const donationPurpose = fields.donation_purpose;
    // Reuse structural validation for the saved breakdown, never the pricing
    // formula: a completed donation retains its original amounts if rates change.
    const hasBreakdown = purpose === 'donation' || (purpose === 'membership' && fields.base_amount !== undefined);
    const breakdown = hasBreakdown ? readDonationQuote({
      amount: fields.base_amount,
      processing_cost_contribution: fields.processing_cost_contribution,
      total_amount: fields.total_amount,
    }) : null;
    if (
      (purpose !== 'donation' && purpose !== 'membership') ||
      (purpose === 'donation' && !reference.startsWith('DON-')) ||
      (purpose === 'membership' && !reference.startsWith('MEM-')) ||
      fields.confirmation_reference !== reference ||
      typeof fields.amount !== 'string' || !/^\d{1,8}\.\d{2}$/.test(fields.amount) ||
      typeof fields.currency !== 'string' || !/^[a-z]{3}$/.test(fields.currency) ||
      typeof fields.completed_at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(fields.completed_at) ||
      !Number.isFinite(Date.parse(fields.completed_at)) ||
      (purpose === 'membership' && !['student', 'individual', 'family', 'corporate'].includes(option as string)) ||
      (purpose === 'membership' && !hasBreakdown &&
        (fields.processing_cost_contribution !== undefined || fields.total_amount !== undefined)) ||
      (donationPurpose !== undefined && (purpose !== 'donation' || typeof donationPurpose !== 'string' || donationPurpose.length > 200))
      || (breakdown !== null && fields.amount !== breakdown.totalAmount)
    ) throw unavailable();
    // Map explicitly: never retain IDs, Stripe values or future backend fields.
    return {
      paymentPurpose: purpose,
      amount: fields.amount,
      ...(breakdown ? {
        baseAmount: breakdown.amount,
        processingCostContribution: breakdown.processingCostContribution,
        totalAmount: breakdown.totalAmount,
      } : {}),
      currency: fields.currency,
      completedAt: fields.completed_at,
      confirmationReference: reference,
      ...(purpose === 'membership' ? { membershipOption: option as PaymentReceipt['membershipOption'] } : {}),
      ...(donationPurpose ? { donationPurpose } : {}),
    };
  } catch {
    throw unavailable();
  }
}

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
  contributeToProcessingCosts = false,
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
        contribute_to_processing_costs: contributeToProcessingCosts,
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
    const saved = readDonationQuote(data);
    return { sessionId, clientSecret, confirmationReference, ...saved };
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