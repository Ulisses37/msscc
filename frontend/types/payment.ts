import type { MembershipOptionId } from '@/constants/membershipOptions';

/** A membership session is priced by the backend, never by this request. */
export interface CreateMembershipPaymentSessionRequest {
  membershipOptionId: MembershipOptionId;
}

/** The session ID identifies a PaymentIntent for membership payments. */
export interface PaymentSession {
  sessionId: string;
  clientSecret: string;
}