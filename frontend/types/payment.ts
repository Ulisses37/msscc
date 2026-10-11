import type { MembershipOptionId } from '@/constants/membershipOptions';

/** Identity belongs in our database, not in Stripe metadata. */
export interface MembershipIdentity {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/** A membership session is priced by the backend, never by this request. */
export interface CreateMembershipPaymentSessionRequest extends MembershipIdentity {
  membershipOptionId: MembershipOptionId;
}

/** The session ID identifies a PaymentIntent for membership payments. */
export interface PaymentSession {
  sessionId: string;
  clientSecret: string;
}

export interface MembershipPaymentSession extends PaymentSession {
  /** Opaque database checkout reference, never the Stripe PaymentIntent secret. */
  confirmationReference: string;
}