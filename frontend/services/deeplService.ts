import {
  countTranslationCharacters,
  getTranslationQuotaDecision,
} from '@/utils/deeplUsage';
import { getRichTextPlainText } from '@/utils/richText';

import type { DeepLUsage } from '@/types/deepl';

const TRANSLATION_UNAVAILABLE_MESSAGE =
  'Translation is unavailable right now. Please try again later.';

/** Retrieves current DeepL usage through the server-only API route. */
async function fetchDeepLUsage(): Promise<DeepLUsage> {
  const response = await fetch('/api/deepl-usage', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`DeepL usage request failed with status ${response.status}.`);
  }

  return (await response.json()) as DeepLUsage;
}

/** Checks quota, requests confirmation when needed, and translates approved text. */
export async function requestDeepLTranslation(text: string): Promise<string | null> {
  try {
    const usage = await fetchDeepLUsage();
    // Formatting tags are not readable source characters, so count the text the admin sees.
    const requestedCharacters = countTranslationCharacters(getRichTextPlainText(text));
    const decision = getTranslationQuotaDecision(usage, requestedCharacters);

    if (decision === 'block') {
      window.alert(
        `This translation needs ${requestedCharacters.toLocaleString()} characters, but only ` +
          `${usage.remainingCharacters.toLocaleString()} remain in the DeepL quota for the current billing cycle. Please refer to the admin dashboard for the remaining limit.`,
      );
      return null;
    }

    if (
      decision === 'confirm' &&
      !window.confirm(
        `DeepL usage is ${Math.round(usage.usagePercentage)}%. ` +
          'Do you want to continue with this translation?',
      )
    ) {
      return null;
    }

    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`Translation request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as { translation?: unknown };
    if (typeof data.translation !== 'string') {
      throw new Error('Translation request returned an invalid response.');
    }

    return data.translation;
  } catch (error) {
    console.error('Translation failed.', error);
    window.alert(TRANSLATION_UNAVAILABLE_MESSAGE);
    return null;
  }
}
