import type { AuthTokens, UserPayload } from '@/types/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

/** Decode user payload from the middle segment of a JWT. */
export function decodeTokenPayload(accessToken: string): UserPayload {
  const payloadSegment = accessToken.split('.')[1];
  const decoded = JSON.parse(atob(payloadSegment));

  return {
    userId: decoded.user_id,
    email: decoded.email,
    firstName: decoded.first_name,
  };
}

/** POST /api/auth/login/ — returns access and refresh tokens on success. */
export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthTokens> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  return response.json();
}

/** POST /api/auth/token/refresh/ — returns a new access token. */
export async function refreshRequest(
  refreshToken: string,
): Promise<{ access: string }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}
