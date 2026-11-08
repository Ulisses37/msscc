export const MANUAL_DONATION_PAYMENT_METHODS = ['cash', 'check', 'card', 'bank_transfer'] as const;

export type ManualDonationPaymentMethod = typeof MANUAL_DONATION_PAYMENT_METHODS[number];

/** Received donation facts only, with no checkout or payment-processing controls. */
export interface ManualDonationInput {
  donorFirstName: string | null;
  donorLastName: string | null;
  donorEmail: string | null;
  address: string | null;
  amount: string;
  currency: 'usd';
  donationDate: string;
  paymentMethod: ManualDonationPaymentMethod | null;
  isAnonymous: boolean;
  externalReference: string;
  message: string;
}