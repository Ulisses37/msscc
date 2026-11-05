import { fetchSubscriptionStatus } from './subscriptionStatusService';

describe('fetchSubscriptionStatus', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, value: { getItem: jest.fn().mockReturnValue('test-admin-token') },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'pending' }) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it.each(['donations', 'memberships'] as const)(
    'uses authenticated uncached record lookup for %s', async (resource) => {
      const signal = new AbortController().signal;
      await expect(fetchSubscriptionStatus(resource, 42, signal)).resolves.toBe('pending');
      const [url, options] = jest.mocked(fetch).mock.calls[0];
      expect(String(url)).toContain(resource === 'memberships'
        ? '/api/donations/memberships/42/subscription-status/'
        : '/api/donations/42/subscription-status/');
      expect(options).toEqual({
        headers: { Authorization: 'Bearer test-admin-token' }, cache: 'no-store', signal,
      });
    },
  );

  it.each(['http', 'network', 'json', 'invalid', 'auth'])(
    'reports %s failure without leaking private details', async (kind) => {
      const log = jest.spyOn(console, 'error').mockImplementation(() => {});
      if (kind === 'auth') jest.mocked(localStorage.getItem).mockReturnValue(null);
      if (kind === 'network') jest.mocked(fetch).mockRejectedValue(new Error('private-email'));
      if (kind === 'http') jest.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      if (kind === 'json' || kind === 'invalid') jest.mocked(fetch).mockResolvedValue({
        ok: true, json: async () => {
          if (kind === 'json') throw new Error('private-email');
          return { status: 'unexpected' };
        },
      } as Response);
      await expect(fetchSubscriptionStatus('donations', 1, new AbortController().signal))
        .rejects.toThrow('Status unavailable');
      expect(log).toHaveBeenCalledWith('Unable to read mailing-list status.');
      if (kind === 'auth') expect(fetch).not.toHaveBeenCalled();
    },
  );
});