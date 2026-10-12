const originalFetch = global.fetch;
let subscribeToUpdates: typeof import('@/services/emailService').subscribeToUpdates;

describe('subscribeToUpdates', () => {
  beforeAll(async () => {
    // The service captures the configured API base URL at module import time.
    // Reset the module registry so this test does not inherit a missing URL
    // from an earlier import or depend on a developer's local .env file.
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
    jest.resetModules();
    ({ subscribeToUpdates } = await import('@/services/emailService'));
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('posts the email and source to the subscribe endpoint', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as unknown as Response);

    await subscribeToUpdates('Member@Example.Test', 'footer');

    expect(global.fetch).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_URL}/api/emails/subscribe/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'Member@Example.Test', source: 'footer', website: '' }),
      },
    );
  });

  it('sends a filled honeypot so the backend can discard it', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true } as unknown as Response);

    await subscribeToUpdates('member@example.test', 'footer', 'http://spam.example');

    const [, options] = jest.mocked(global.fetch).mock.calls[0];
    expect(JSON.parse(options?.body as string)).toEqual({
      email: 'member@example.test',
      source: 'footer',
      website: 'http://spam.example',
    });
  });

  it.each([
    ['server', { ok: false, status: 503 }],
    ['throttled', { ok: false, status: 429 }],
  ])('hides %s failures behind a generic message', async (_kind, response) => {
    jest.mocked(global.fetch).mockResolvedValue(response as unknown as Response);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(subscribeToUpdates('member@example.test', 'donation')).rejects.toThrow(
      'Unable to join the mailing list.',
    );
  });

  it('hides a network failure behind the same generic message', async () => {
    jest.mocked(global.fetch).mockRejectedValue(new Error('private-network-detail'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(subscribeToUpdates('member@example.test', 'membership')).rejects.toThrow(
      'Unable to join the mailing list.',
    );
  });
});
