/**
 * @jest-environment jsdom
 *
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand services/deeplService.test.ts
 */

import { requestDeepLTranslation } from '@/services/deeplService';

const originalFetch = global.fetch;

function usageResponse(characterCount: number, characterLimit = 500_000): Response {
  return {
    ok: true,
    json: async () => ({
      characterCount,
      characterLimit,
      remainingCharacters: Math.max(0, characterLimit - characterCount),
      usagePercentage: (characterCount / characterLimit) * 100,
    }),
  } as Response;
}

describe('requestDeepLTranslation', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('translates without confirmation below 80 percent usage', async () => {
    // The first response is the quota preflight; only the second response translates text.
    jest.mocked(global.fetch)
      .mockResolvedValueOnce(usageResponse(399_999))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translation: 'こんにちは' }),
      } as Response);

    await expect(requestDeepLTranslation('Hello')).resolves.toBe('こんにちは');
    expect(window.confirm).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello' }),
    });
  });

  it('continues after confirmation at 80 percent usage', async () => {
    jest.mocked(global.fetch)
      .mockResolvedValueOnce(usageResponse(400_000))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ translation: '翻訳' }),
      } as Response);

    await expect(requestDeepLTranslation('Translate')).resolves.toBe('翻訳');
    expect(window.confirm).toHaveBeenCalledWith(
      'DeepL usage is 80%. Do you want to continue with this translation?',
    );
  });

  it('does not translate when the administrator cancels the warning', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce(usageResponse(450_000));
    jest.mocked(window.confirm).mockReturnValue(false);

    await expect(requestDeepLTranslation('Cancel this')).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('blocks visible text that is larger than the remaining quota', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce(usageResponse(499_997));

    await expect(requestDeepLTranslation('<strong>Four</strong>')).resolves.toBeNull();
    expect(window.alert).toHaveBeenCalledWith(
      'This translation needs 4 characters, but only 3 remain in the DeepL quota for the ' +
        'current billing cycle. Please refer to the admin dashboard for the remaining limit.',
    );
    expect(window.confirm).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('shows a generic error when usage cannot be checked', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: false, status: 502 } as Response);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(requestDeepLTranslation('Hello')).resolves.toBeNull();
    expect(window.alert).toHaveBeenCalledWith(
      'Translation is unavailable right now. Please try again later.',
    );
  });
});