import { fetchFinancialRecords } from './financialRecordSearch';

describe('fetchFinancialRecords', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: jest.fn().mockReturnValue('test-admin-token') },
    });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('encodes trimmed Unicode search and sends the JWT without caching', async () => {
    await fetchFinancialRecords('donations', '  松山 & Maya+  ');
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    const parsed = new URL(String(url), 'http://localhost');
    expect(parsed.searchParams.get('search')).toBe('松山 & Maya+');
    expect(parsed.pathname).toContain('/api/donations/');
    expect(options).toEqual({
      headers: { Authorization: 'Bearer test-admin-token' }, cache: 'no-store',
    });
  });

  it('omits search for whitespace-only input and selects the membership endpoint', async () => {
    await fetchFinancialRecords('memberships', ' \t ');
    expect(jest.mocked(fetch).mock.calls[0][0]).toBe(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/`,
    );
  });

  it('returns backend matches without filtering them in the browser', async () => {
    const records = [{ first_name: 'Maya', phone: '(916) 555-0123' }];
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => records } as Response);
    await expect(fetchFinancialRecords('memberships', '916555')).resolves.toEqual(records);
  });

  it('does not send a request without the existing token', async () => {
    jest.mocked(localStorage.getItem).mockReturnValue(null);
    await expect(fetchFinancialRecords('donations', 'private')).rejects.toThrow('Please sign in');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['http', 'network', 'json'])('sanitizes %s failures in messages and logs', async (kind) => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    if (kind === 'network') {
      jest.mocked(fetch).mockRejectedValue(new Error('private-query-and-pii'));
    } else {
      jest.mocked(fetch).mockResolvedValue({
        ok: kind !== 'http',
        json: async () => { throw new Error('private-query-and-pii'); },
      } as unknown as Response);
    }
    await expect(fetchFinancialRecords('donations', 'private-query-and-pii')).rejects.toThrow(
      'Unable to load financial records. Please try again.',
    );
    expect(log).toHaveBeenCalledWith('Unable to load financial records.');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-query-and-pii');
  });
});
