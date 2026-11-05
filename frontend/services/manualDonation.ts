import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

import type { ManualDonationInput } from '@/types/manualDonation';

const API_FIELDS: Record<keyof ManualDonationInput, string> = {
  donorFirstName: 'donor_first_name', donorLastName: 'donor_last_name', donorEmail: 'donor_email',
  address: 'address', amount: 'amount', currency: 'currency', donationDate: 'donation_date',
  paymentMethod: 'payment_method', isAnonymous: 'is_anonymous',
  externalReference: 'external_reference', message: 'message',
};

/** Safe field feedback without exposing server responses or private donor facts. */
export class ManualDonationSaveError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Partial<Record<keyof ManualDonationInput, string>> = {},
  ) {
    super(message);
    this.name = 'ManualDonationSaveError';
  }
}

/** Record received facts through the authorized endpoint, never through checkout. */
export async function createManualDonation(
  input: ManualDonationInput,
): Promise<{ donationId: number }> {
  try {
    const body = Object.fromEntries(
      (Object.keys(API_FIELDS) as (keyof ManualDonationInput)[])
        .filter((key) => !input.isAnonymous
          || !['donorFirstName', 'donorLastName', 'address'].includes(key))
        .map((key) => [API_FIELDS[key], input[key]]),
    );
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/manual/`, {
      method: 'POST',
      headers: { ...getAdminRequestHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 400) {
      const data: unknown = await response.json();
      const fields: Partial<Record<keyof ManualDonationInput, string>> = {};
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const key of Object.keys(API_FIELDS) as (keyof ManualDonationInput)[]) {
          if (Object.hasOwn(data, API_FIELDS[key])) {
            fields[key] = 'This value was not accepted. Please check it and review again.';
          }
        }
      }
      throw new ManualDonationSaveError('Please check the donation details.', fields);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ManualDonationSaveError(
        'You do not have permission to save this record. Please check your admin sign-in.',
      );
    }
    if (!response.ok) throw new Error('Donation request failed.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('donation_id' in data)
      || typeof data.donation_id !== 'number' || !Number.isSafeInteger(data.donation_id)
      || data.donation_id <= 0) {
      throw new Error('Invalid donation response.');
    }
    return { donationId: data.donation_id };
  } catch (error) {
    console.error('Unable to complete the manual donation save request.');
    if (error instanceof ManualDonationSaveError) throw error;
    throw new ManualDonationSaveError(
      'Unable to confirm the save. Your entries are preserved. '
      + 'Check the donation list before retrying to avoid creating a duplicate.',
    );
  }
}
