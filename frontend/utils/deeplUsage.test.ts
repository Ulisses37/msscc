/**
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand utils/deeplUsage.test.ts
 */

import {
  countTranslationCharacters,
  createDeepLUsage,
  getTranslationQuotaDecision,
} from '@/utils/deeplUsage';

describe('DeepL usage helpers', () => {
  it('calculates remaining quota and percentage from provider totals', () => {
    // Tests: the exact warning threshold used by the meter and confirmation message.
    // Expected output: 80% used with 100,000 characters remaining.
    expect(createDeepLUsage(400_000, 500_000)).toEqual({
      characterCount: 400_000,
      characterLimit: 500_000,
      remainingCharacters: 100_000,
      usagePercentage: 80,
    });
  });

  it.each([
    [
      'an unused quota',
      0,
      500_000,
      {
        characterCount: 0,
        characterLimit: 500_000,
        remainingCharacters: 500_000,
        usagePercentage: 0,
      },
    ],
    [
      'an exactly exhausted quota',
      500_000,
      500_000,
      {
        characterCount: 500_000,
        characterLimit: 500_000,
        remainingCharacters: 0,
        usagePercentage: 100,
      },
    ],
    [
      'provider usage above the reported limit',
      500_001,
      500_000,
      {
        characterCount: 500_001,
        characterLimit: 500_000,
        remainingCharacters: 0,
        usagePercentage: 100,
      },
    ],
  ])('normalizes %s for display', (_description, count, limit, expectedUsage) => {
    // Tests: meter values stay within user-facing zero and 100 percent boundaries.
    // Expected output: remaining characters never become negative and percentage never exceeds 100.
    expect(createDeepLUsage(count, limit)).toEqual(expectedUsage);
  });

  it('counts Unicode code points instead of UTF-16 code units', () => {
    // Tests: an emoji occupies two JavaScript code units but one DeepL character.
    // Expected output: Latin text, Japanese text, and the emoji count as three characters total.
    expect(countTranslationCharacters('Aあ😀')).toBe(3);
  });

  it.each([
    ['allows usage immediately below 80 percent', createDeepLUsage(7_999, 10_000), 10, 'allow'],
    ['confirms at exactly 80 percent', createDeepLUsage(8_000, 10_000), 10, 'confirm'],
    ['allows a request equal to the remainder', createDeepLUsage(490, 500), 10, 'confirm'],
    ['blocks a request one over the remainder', createDeepLUsage(490, 500), 11, 'block'],
    ['blocks when no quota remains', createDeepLUsage(500, 500), 1, 'block'],
  ])('%s', (_description, usage, requestedCharacters, expectedDecision) => {
    // Tests: exact quota boundaries that control whether the warning or blocking message appears.
    // Expected output: requests are allowed, confirmed, or blocked only at the intended boundary.
    expect(getTranslationQuotaDecision(usage, requestedCharacters)).toBe(expectedDecision);
  });
});