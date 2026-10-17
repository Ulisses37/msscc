import {
  countTranslationCharacters,
  createDeepLUsage,
  getTranslationQuotaDecision,
} from '@/utils/deeplUsage';

describe('DeepL usage helpers', () => {
  it('calculates remaining quota and percentage from provider totals', () => {
    // Use an even fraction so every displayed meter value is easy to verify.
    expect(createDeepLUsage(400_000, 500_000)).toEqual({
      characterCount: 400_000,
      characterLimit: 500_000,
      remainingCharacters: 100_000,
      usagePercentage: 80,
    });
  });

  it('counts Unicode code points instead of UTF-16 code units', () => {
    // The emoji occupies two JavaScript code units but one billable character.
    expect(countTranslationCharacters('Aあ😀')).toBe(3);
  });

  it.each([
    ['allows usage below the warning threshold', createDeepLUsage(399, 500), 10, 'allow'],
    ['confirms at the warning threshold', createDeepLUsage(400, 500), 10, 'confirm'],
    ['blocks a request larger than the remainder', createDeepLUsage(490, 500), 11, 'block'],
    ['blocks when no quota remains', createDeepLUsage(500, 500), 1, 'block'],
  ])('%s', (_description, usage, requestedCharacters, expectedDecision) => {
    expect(getTranslationQuotaDecision(usage, requestedCharacters)).toBe(expectedDecision);
  });
});