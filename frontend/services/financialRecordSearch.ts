import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

type FinancialResource = 'donations' | 'memberships';

/** Fetch authorized backend matches without logging query text or response data. */
export async function fetchFinancialRecords<T>(
  resource: FinancialResource,
  search: string,
): Promise<T[]> {
  const path = resource === 'donations' ? '/api/donations/' : '/api/donations/memberships/';
  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  const suffix = query.size ? `?${query.toString()}` : '';
  const headers = getAdminRequestHeaders();
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}${suffix}`, {
      headers,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Record request failed.');
    return await response.json() as T[];
  } catch {
    console.error('Unable to load financial records.');
    throw new Error('Unable to load financial records. Please try again.');
  }
}

export async function fetchDashboardFinancialRecords<T>(
  resource: FinancialResource,
): Promise<T[]> {
  const path =
    resource === 'donations'
      ? '/api/donations/dashboard/donations/'
      : '/api/donations/dashboard/memberships/';
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Record request failed.');
    return (await response.json()) as T[];
  } catch {
    console.error('Unable to load records.');
    throw new Error('Unable to load records. Please try again.');
  }
}
