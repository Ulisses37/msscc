import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

import type { FinancialRecordResource, SubscriptionStatus } from '@/types/subscriptionStatus';

/** Read current consent for a stored financial record without sending its email in a URL. */
export async function fetchSubscriptionStatus(
  resource: FinancialRecordResource,
  recordId: number,
  signal: AbortSignal,
): Promise<SubscriptionStatus> {
  const prefix = resource === 'memberships' ? '/api/donations/memberships' : '/api/donations';
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}${prefix}/${recordId}/subscription-status/`,
      { headers: getAdminRequestHeaders(), cache: 'no-store', signal },
    );
    if (!response.ok) throw new Error('Status request failed.');
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || !('status' in body)) {
      throw new Error('Invalid status response.');
    }
    switch (body.status) {
      case 'subscribed':
      case 'pending':
      case 'unsubscribed':
      case 'not_recorded':
      case 'email_unavailable':
        return body.status;
      default:
        throw new Error('Invalid status response.');
    }
  } catch {
    if (!signal.aborted) console.error('Unable to read mailing-list status.');
    throw new Error('Status unavailable');
  }
}