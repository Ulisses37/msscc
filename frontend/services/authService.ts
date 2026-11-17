import type { AuthTokens, UserPayload } from '@/types/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

let csrfToken: string | null = null;
let refreshPromise: Promise<AuthTokens> | null = null;

/** Decode user payload from the middle segment of a JWT. */
export function decodeTokenPayload(accessToken: string): UserPayload {
  const payloadSegment = accessToken.split('.')[1];
  const decoded = JSON.parse(atob(payloadSegment));

  return {
    userId: decoded.user_id,
    email: decoded.email,
    firstName: decoded.first_name,
    lastName: decoded.last_name,

    permissionData: decoded.permissions_data,
    isExecutive: decoded.is_executive,
    isSuperuser: decoded.is_superuser,
  };
}

/** Request a CSRF token before submitting a credentialed auth request. */
async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  const response = await fetch(`${API_URL}/api/auth/csrf/`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Unable to establish a secure session.');
  }

  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as Record<string, unknown>).csrf_token !== 'string'
  ) {
    throw new Error('Unable to establish a secure session.');
  }

  csrfToken = (data as Record<string, string>).csrf_token;
  return csrfToken;
}

/** POST /api/auth/login/ — stores the refresh token in an HttpOnly cookie. */
export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthTokens> {
  const csrf = await getCsrfToken();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Invalid credentials');
  }

  return response.json();
}

/** POST /api/auth/token/refresh/ — rotates the HttpOnly refresh cookie. */
export async function refreshRequest(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const csrf = await getCsrfToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return response.json();
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/** POST /api/auth/logout/ — revokes and clears the HttpOnly refresh cookie. */
export async function logoutRequest(): Promise<void> {
  const csrf = await getCsrfToken();
  const response = await fetch(`${API_URL}/api/auth/logout/`, {
    method: 'POST',
    headers: { 'X-CSRFToken': csrf },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Unable to end the secure session.');
  }
}
