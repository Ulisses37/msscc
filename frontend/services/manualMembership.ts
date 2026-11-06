import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

import type { ManualMembershipInput } from '@/types/manualMembership';
import type { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';

/** Retrieve saved server facts independently of list search and pagination. */
export async function fetchSavedMembership(membershipId: number): Promise<MembershipEntry> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/${membershipId}/`,
      { headers: getAdminRequestHeaders(), cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Membership detail request failed.');
    const data: MembershipEntry = await response.json();
    if (data?.membership_id !== membershipId) throw new Error('Invalid membership response.');
    return data;
  } catch {
    console.error('Unable to load the saved membership details.');
    throw new Error('The record was saved, but its details could not be loaded. Please try again.');
  }
}

const API_FIELDS: Record<keyof ManualMembershipInput, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  membershipType: 'membership_type',
  status: 'status',
  email: 'email',
  phone: 'phone',
  address: 'address',
  membershipPrice: 'membership_price',
  amountPaid: 'amount_paid',
  startDate: 'start_date',
  endDate: 'end_date',
  renewalDate: 'renewal_date',
  paymentStatus: 'payment_status',
  paymentMethod: 'payment_method',
  referenceId: 'reference_id',
  notes: 'notes',
};

/** Safe feedback for rejected manual facts, never raw server response text. */
export class ManualMembershipSaveError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Partial<Record<keyof ManualMembershipInput, string>> = {},
  ) {
    super(message);
    this.name = 'ManualMembershipSaveError';
  }
}

/** Submit only manual facts to the authorized endpoint; never invoke checkout services. */
export async function createManualMembership(
  input: ManualMembershipInput,
): Promise<{ membershipId: number }> {
  try {
    const body = Object.fromEntries(
      (Object.keys(API_FIELDS) as (keyof ManualMembershipInput)[])
        .map((key) => [API_FIELDS[key], input[key]]),
    );
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/`,
      {
        method: 'POST',
        headers: { ...getAdminRequestHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (response.status === 400) {
      const data: unknown = await response.json();
      const fields: Partial<Record<keyof ManualMembershipInput, string>> = {};
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const key of Object.keys(API_FIELDS) as (keyof ManualMembershipInput)[]) {
          if (Object.hasOwn(data, API_FIELDS[key])) {
            fields[key] = 'This value was not accepted. Please check it and review again.';
          }
        }
      }
      throw new ManualMembershipSaveError('Please check the membership details.', fields);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ManualMembershipSaveError(
        'You do not have permission to save this record. Please check your admin sign-in.',
      );
    }
    if (!response.ok) throw new Error('Membership request failed.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('membership_id' in data)
      || typeof data.membership_id !== 'number') {
      throw new Error('Invalid membership response.');
    }
    return { membershipId: data.membership_id };
  } catch (error) {
    // Deliberately omit input, server response bodies, and tokens from logs.
    console.error('Unable to complete the manual membership save request.');
    if (error instanceof ManualMembershipSaveError) throw error;
    throw new ManualMembershipSaveError(
      'Unable to confirm the save. Your entries are preserved. '
      + 'Check the membership list before retrying to avoid creating a duplicate.',
    );
  }
}