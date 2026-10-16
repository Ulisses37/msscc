import type { DeepLUsage } from '@/types/deepl';

/** Converts DeepL's character totals into values displayed by the usage meter. */
export function createDeepLUsage(characterCount: number, characterLimit: number): DeepLUsage {
  if (!Number.isFinite(characterCount) || !Number.isFinite(characterLimit)) {
    throw new Error('DeepL usage values must be finite numbers.');
  }

  if (characterCount < 0 || characterLimit <= 0) {
    throw new Error('DeepL usage values are outside the expected range.');
  }

  const remainingCharacters = Math.max(0, characterLimit - characterCount);
  const usagePercentage = Math.min(100, (characterCount / characterLimit) * 100);

  return {
    characterCount,
    characterLimit,
    remainingCharacters,
    usagePercentage,
  };
}