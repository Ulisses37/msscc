/** Where a mailing-list signup came from. Must match the backend's choices. */
export type SubscribeSource = 'footer' | 'donation' | 'membership' | 'volunteer';

/**
 * Hidden field the backend uses as a honeypot. Exported so the input and the
 * request body cannot drift apart.
 */
export const HONEYPOT_FIELD = 'website';

/**
 * Confirmation detail the backend returns for a successful confirm. Exported so
 * the page and the view cannot disagree about which body means "confirmed".
 */
export const CONFIRM_RESPONSE_DETAIL =
  'Your subscription to the MSSCC mailing list is confirmed.';

/** Outcome of a confirmation attempt, so the page can render distinct states. */
export type ConfirmSubscriptionOutcome = 'confirmed' | 'invalid';

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

/**
 * Confirm a mailing-list signup from the token in the confirmation email.
 *
 * Resolves `'confirmed'` on a real confirmation and `'invalid'` only for the
 * backend's 400, which covers an unknown, expired or already-used token: those
 * are indistinguishable by design, so the page shows one message for all three.
 *
 * Throws for anything else, because 429, 5xx, a network failure and a 200 whose
 * body is not our confirmation detail all mean "try again", not "your link is
 * bad". Details stay in the console.
 */
export async function confirmSubscription(
  token: string,
): Promise<ConfirmSubscriptionOutcome> {
  if (!API_BASE_URL) {
    throw new Error('Unable to confirm your subscription.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/emails/subscribe/confirm/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (response.status === 400) {
      return 'invalid';
    }

    if (!response.ok) {
      throw new Error(
        `Subscription confirmation failed with status ${response.status}.`,
      );
    }

    // A 200 that is not our confirmation body means a proxy or a changed
    // contract, not a bad token, so it belongs in the try-again state.
    const body: unknown = await response.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      (body as { detail?: unknown }).detail !== CONFIRM_RESPONSE_DETAIL
    ) {
      throw new Error('Subscription confirmation returned an unexpected body.');
    }

    return 'confirmed';
  } catch (error) {
    console.error('Unable to confirm your subscription.', error);
    throw new Error('Unable to confirm your subscription.');
  }
}
