const ACCESS_TOKEN_KEY = 'msscc_access_token';

/** Require the existing admin JWT before requesting private record data. */
export function getAdminRequestHeaders(): Record<string, string> {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    throw new Error('Please sign in to access admin records.');
  }
  return { Authorization: `Bearer ${token}` };
}