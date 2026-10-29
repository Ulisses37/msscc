/**
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand app/api/deepl-usage/route.test.ts
 *
 * The DeepL usage helper is mocked. These tests never contact the live service.
 */

import { getDeepLUsage } from '@/utils/deeplServer';

import { GET } from './route';

const TEST_API_KEY = 'non-production-test-key:fx';

jest.mock('@/utils/deeplServer', () => ({
  getDeepLUsage: jest.fn(),
}));

describe('GET /api/deepl-usage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns normalized DeepL usage to the admin client', async () => {
    // Tests: the route passes the server-only helper result through without changing its values.
    // Expected output: status 200 with the exact normalized usage object.
    const usage = {
      characterCount: 400_000,
      characterLimit: 500_000,
      remainingCharacters: 100_000,
      usagePercentage: 80,
    };
    jest.mocked(getDeepLUsage).mockResolvedValue(usage);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(usage);
    expect(getDeepLUsage).toHaveBeenCalledTimes(1);
  });

  it('returns a safe 502 response when DeepL usage is unavailable', async () => {
    // Tests: provider and configuration failures stay on the server boundary.
    // Expected output: status 502 with only the public error message and no credentials.
    jest.mocked(getDeepLUsage).mockRejectedValue(
      new Error(`Private provider failure using ${TEST_API_KEY}`),
    );

    const response = await GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: 'DeepL usage is unavailable' });
    expect(JSON.stringify(body)).not.toContain(TEST_API_KEY);
    expect(JSON.stringify(body)).not.toContain('Private provider failure');
  });
});