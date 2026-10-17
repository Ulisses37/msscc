import { getDeepLApiBaseUrl, getDeepLUsage } from '@/utils/deeplServer';

const originalFetch = global.fetch;
const originalApiKey = process.env.DEEPL_API_KEY;
const originalUsageMock = process.env.DEEPL_USAGE_MOCK;

describe('DeepL server usage helper', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    delete process.env.DEEPL_USAGE_MOCK;
    process.env.DEEPL_API_KEY = 'test-api-key:fx';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.DEEPL_API_KEY;
    } else {
      process.env.DEEPL_API_KEY = originalApiKey;
    }

    if (originalUsageMock === undefined) {
      delete process.env.DEEPL_USAGE_MOCK;
    } else {
      process.env.DEEPL_USAGE_MOCK = originalUsageMock;
    }
    jest.restoreAllMocks();
  });

  it('selects the provider host from the DeepL API key type', () => {
    expect(getDeepLApiBaseUrl('free-key:fx')).toBe('https://api-free.deepl.com');
    expect(getDeepLApiBaseUrl('pro-key')).toBe('https://api.deepl.com');
  });

  it('normalizes the character totals returned by DeepL', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ character_count: 125_000, character_limit: 500_000 }),
    } as Response);

    await expect(getDeepLUsage()).resolves.toEqual({
      characterCount: 125_000,
      characterLimit: 500_000,
      remainingCharacters: 375_000,
      usagePercentage: 25,
    });
    expect(global.fetch).toHaveBeenCalledWith('https://api-free.deepl.com/v2/usage', {
      headers: { Authorization: 'DeepL-Auth-Key test-api-key:fx' },
      cache: 'no-store',
    });
  });

  it('returns deterministic development usage without calling DeepL', async () => {
    // Reviewers can use this same scenario to inspect the exact 80% UI state locally.
    process.env.DEEPL_USAGE_MOCK = 'eighty-percent';

    await expect(getDeepLUsage()).resolves.toMatchObject({ usagePercentage: 80 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an invalid provider response', async () => {
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ character_count: 'private-invalid-value' }),
    } as Response);

    await expect(getDeepLUsage()).rejects.toThrow(
      'DeepL usage endpoint returned an invalid response.',
    );
  });
});