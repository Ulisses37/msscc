const originalFetch = global.fetch;
const safeError = 'Unable to create the payment session.';
let createMembershipPaymentSession: typeof import('@/services/paymentService').createMembershipPaymentSession;

describe('createMembershipPaymentSession', () => {
  beforeAll(async () => {
    // The service captures the configured API base URL at module import time.
    // Reset the module registry so this test does not inherit a missing URL
    // from an earlier import or depend on a developer's local .env file.
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    jest.resetModules();
    ({ createMembershipPaymentSession } = await import('@/services/paymentService'));
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('sends only the option ID and membership purpose to the configured API', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        session_id: 'pi_test_membership',
        client_secret: 'pi_test_secret',
      }),
    } as unknown as Response);

    await expect(
      createMembershipPaymentSession({ membershipOptionId: 'family' }),
    ).resolves.toEqual({ sessionId: 'pi_test_membership', clientSecret: 'pi_test_secret' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/membership/session/`);
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    // Explicit equality guarantees no price, card number, CVC, or client
    // secret is silently added to application requests.
    expect(JSON.parse(options?.body as string)).toEqual({
      membership_option_id: 'family',
      payment_purpose: 'membership',
    });
  });

  it.each([
    // HTTP 200 is insufficient if Stripe Elements cannot use the response.
    null,
    [],
    {},
    { session_id: '', client_secret: 'pi_secret' },
    { session_id: '   ', client_secret: 'pi_secret' },
    { session_id: 123, client_secret: 'pi_secret' },
    { session_id: 'pi_valid', client_secret: null },
    { session_id: 'pi_valid', client_secret: ' ' },
  ])('rejects malformed session data safely: %p', async (data) => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(data),
    } as unknown as Response);

    await expect(
      createMembershipPaymentSession({ membershipOptionId: 'student' }),
    ).rejects.toThrow(safeError);
  });

  it.each(['server', 'network', 'invalid JSON'])('hides %s failures', async (kind) => {
    // Distinct failures must all become the same public-safe error; do not
    // expose response bodies or exception messages to callers.
    if (kind === 'network') {
      jest.mocked(global.fetch).mockRejectedValue(new Error('private-network-detail'));
    } else {
      jest.mocked(global.fetch).mockResolvedValue({
        ok: kind !== 'server',
        json: jest.fn().mockRejectedValue(new Error('private-response-detail')),
      } as unknown as Response);
    }
    await expect(
      createMembershipPaymentSession({ membershipOptionId: 'individual' }),
    ).rejects.toThrow(safeError);
  });
});