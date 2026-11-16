let accessToken: string | null = null;

/** Return the current in-memory admin access token. */
export function getAccessToken(): string | null {
  return accessToken;
}

/** Replace the in-memory admin access token. */
export function setAccessToken(token: string): void {
  accessToken = token;
}

/** Clear the in-memory admin access token. */
export function clearAccessToken(): void {
  accessToken = null;
}