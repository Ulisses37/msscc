import type { AdminTableRevisions } from '@/types/tableRevision';
import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

/**
 * Fetch revision tokens for use by the visible-tab polling controller.
 *
 * The polling controller decides when to call this service. Keeping request and
 * authentication details here lets pages share polling behavior without each
 * page duplicating the authenticated endpoint request.
 */
export async function fetchTableRevisions(): Promise<AdminTableRevisions> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/donations/table-revisions/`,
    {
      headers: getAdminRequestHeaders(),
    },
  );

  if (!response.ok) {
    throw new Error('Unable to fetch table revisions.');
  }

  const revisions: unknown = await response.json();
  if (!hasValidTableRevisions(revisions)) {
    throw new Error('The table revisions response is invalid.');
  }

  return revisions;
}

/**
 * Reject malformed responses before they can become a polling baseline.
 *
 * Both keys are required because one endpoint request supports the donations
 * and memberships hooks, even though each hook watches only its assigned key.
 */
function hasValidTableRevisions(value: unknown): value is AdminTableRevisions {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const revisions = value as Record<string, unknown>;
  return (
    Number.isInteger(revisions.donations) &&
    Number.isInteger(revisions.memberships)
  );
}