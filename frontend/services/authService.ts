import type { AuthTokens, UserPayload } from '@/types/auth';

const MOCK_DELAY_MS = 800;

const MOCK_TOKENS: AuthTokens = {
  access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImFkbWluQG1zc2NjMS5vcmciLCJmaXJzdF9uYW1lIjoiQnJ5YW4iLCJleHAiOjk5OTk5OTk5OTl9.mock_signature',
  refresh: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjk5OTk5OTk5OTl9.mock_refresh_signature',
};

const MOCK_EMAIL = 'admin@msscc1.org';
const MOCK_PASSWORD = 'admin123';

function simulateDelay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, MOCK_DELAY_MS);
  });
}

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

/**
 * Simulate POST /api/auth/login/ (TokenObtainPairView).
 *
 * TODO(ulisses): Replace mock with real fetch to Django backend.
 */
export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthTokens> {
  await simulateDelay();

  if (email === MOCK_EMAIL && password === MOCK_PASSWORD) {
    return MOCK_TOKENS;
  }

  throw new Error('Invalid credentials');
}

/**
 * Simulate POST /api/auth/token/refresh/ (TokenRefreshView).
 *
 * TODO(ulisses): Replace mock with real fetch to Django backend.
 */
export async function refreshRequest(
  refreshToken: string,
): Promise<{ access: string }> {
  await simulateDelay();

  if (refreshToken === MOCK_TOKENS.refresh) {
    return { access: MOCK_TOKENS.access };
  }

  throw new Error('Token refresh failed');
}
