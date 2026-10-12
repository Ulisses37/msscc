/** Where a mailing-list signup came from. Must match the backend's choices. */
export type SubscribeSource = 'footer' | 'donation' | 'membership' | 'volunteer';

/**
 * Hidden field the backend uses as a honeypot. Exported so the input and the
 * request body cannot drift apart.
 */
export const HONEYPOT_FIELD = 'website';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Add an address to the MSSCC mailing list.
 *
 * The backend returns the same response whether or not the address was already
 * known, so callers show one success message and never assume a new signup.
 * Throws a generic error on failure; details stay in the console.
 *
 * `honeypot` is the value of the hidden anti-bot field. Real callers omit it.
 */
export async function subscribeToUpdates(
  email: string,
  source: SubscribeSource,
  honeypot = '',
): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Unable to join the mailing list.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/emails/subscribe/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source, [HONEYPOT_FIELD]: honeypot }),
    });

    if (!response.ok) {
      throw new Error(`Mailing-list signup failed with status ${response.status}.`);
    }
  } catch (error) {
    console.error('Unable to join the mailing list.', error);
    throw new Error('Unable to join the mailing list.');
  }
}
