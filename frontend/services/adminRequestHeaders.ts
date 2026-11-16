import { getAccessToken } from '@/services/accessTokenStore';

/** Require the in-memory admin JWT before requesting private record data. */
export function getAdminRequestHeaders(): Record<string, string> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Please sign in to access admin records.');
  }
  return { Authorization: `Bearer ${token}` };
}