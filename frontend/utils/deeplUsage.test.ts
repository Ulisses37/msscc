import { createDeepLUsage } from '@/utils/deeplUsage';

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
});