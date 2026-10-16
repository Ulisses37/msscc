import type { DeepLUsage } from '@/types/deepl';

export const DEEPL_WARNING_PERCENTAGE = 80;

export type TranslationQuotaDecision = 'allow' | 'confirm' | 'block';

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

/** Counts Unicode code points, matching the character unit used for DeepL billing. */
export function countTranslationCharacters(text: string): number {
  return Array.from(text).length;
}

/** Determines whether the requested translation can proceed under the current quota. */
export function getTranslationQuotaDecision(
  usage: DeepLUsage,
  requestedCharacters: number,
): TranslationQuotaDecision {
  if (requestedCharacters > usage.remainingCharacters) return 'block';
  if (usage.usagePercentage >= DEEPL_WARNING_PERCENTAGE) return 'confirm';

  return 'allow';
}
