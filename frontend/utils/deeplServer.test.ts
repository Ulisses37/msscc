/**
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand utils/deeplServer.test.ts
 *
 * Global fetch is mocked. These tests never contact the live DeepL usage endpoint.
 */

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
    // Tests: the configured Free key selects the Free usage endpoint and authorization format.
    // Expected output: normalized totals and one no-cache request to api-free.deepl.com.
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

  it('normalizes Free API usage above the provider limit', async () => {
    // Tests: unexpected over-limit provider totals cannot create a negative dashboard remainder.
    // Expected output: zero characters remaining and usage capped at 100 percent.
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ character_count: 500_001, character_limit: 500_000 }),
    } as Response);

    await expect(getDeepLUsage()).resolves.toEqual({
      characterCount: 500_001,
      characterLimit: 500_000,
      remainingCharacters: 0,
      usagePercentage: 100,
    });
  });

  it('rejects a non-OK response from the Free usage endpoint', async () => {
    // Tests: provider HTTP failures are converted into a predictable server-helper error.
    // Expected output: rejection includes the status for server logs, not a normalized usage object.
    jest.mocked(global.fetch).mockResolvedValue({ ok: false, status: 429 } as Response);

    await expect(getDeepLUsage()).rejects.toThrow(
      'DeepL usage endpoint returned status 429.',
    );
  });

  it('rejects usage requests when the DeepL API key is missing', async () => {
    // Tests: the helper fails before making an unauthenticated provider request.
    // Expected output: a configuration error and zero fetch calls.
    delete process.env.DEEPL_API_KEY;

    await expect(getDeepLUsage()).rejects.toThrow('DEEPL_API_KEY is not configured.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns deterministic development usage without calling DeepL', async () => {
    // Reviewers can use this same scenario to inspect the exact 80% UI state locally.
    process.env.DEEPL_USAGE_MOCK = 'eighty-percent';

    await expect(getDeepLUsage()).resolves.toMatchObject({ usagePercentage: 80 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing character limit', { character_count: 125_000 }],
    ['a string character count', { character_count: '125000', character_limit: 500_000 }],
    ['a null character limit', { character_count: 125_000, character_limit: null }],
  ])('rejects provider data with %s', async (_description, providerBody) => {
    // Tests: runtime validation rejects values that cannot safely drive quota messages or meters.
    // Expected output: the same predictable invalid-response error for every malformed payload.
    jest.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => providerBody,
    } as Response);

    await expect(getDeepLUsage()).rejects.toThrow(
      'DeepL usage endpoint returned an invalid response.',
    );
  });
});