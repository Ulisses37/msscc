import { decodeTokenPayload } from '@/services/authService';
import type { UserPayload } from '@/types/auth';

export type VerifiedSession =
  | { ok: true; user: UserPayload }
  | { ok: false; reason: 'missing' | 'invalid' | 'network' };

export async function verifySession(): Promise<VerifiedSession> {
  const token = localStorage.getItem('msscc_access_token');
  if (!token) return { ok: false, reason: 'missing' };

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/token/verify/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.status === 401) return { ok: false, reason: 'invalid' };
    if (!res.ok) return { ok: false, reason: 'network' };

    // The server confirmed the signature and expiry, so the payload can be trusted.
    return { ok: true, user: decodeTokenPayload(token) };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
