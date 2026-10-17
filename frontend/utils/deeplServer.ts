import { createDeepLUsage } from '@/utils/deeplUsage';

import type { DeepLUsage } from '@/types/deepl';

interface DeepLUsageResponse {
  character_count?: unknown;
  character_limit?: unknown;
}

type DeepLUsageMock =
  | 'seventy-nine-percent'
  | 'eighty-percent'
  | 'near-limit'
  | 'max'
  | 'unavailable';

const DEVELOPMENT_USAGE: Record<Exclude<DeepLUsageMock, 'unavailable'>, DeepLUsage> = {
  'seventy-nine-percent': createDeepLUsage(395_000, 500_000),
  'eighty-percent': createDeepLUsage(400_000, 500_000),
  'near-limit': createDeepLUsage(499_900, 500_000),
  max: createDeepLUsage(500_000, 500_000),
};

/** Selects the correct DeepL host for Free and Pro API keys. */
export function getDeepLApiBaseUrl(apiKey: string): string {
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

/** Retrieves and validates usage without exposing the DeepL credential to the browser. */
export async function getDeepLUsage(): Promise<DeepLUsage> {
  const mockScenario = process.env.DEEPL_USAGE_MOCK as DeepLUsageMock | undefined;

  // Local fixtures make threshold states reviewable without consuming the shared account quota.
  if (process.env.NODE_ENV !== 'production' && mockScenario) {
    if (mockScenario === 'unavailable') {
      throw new Error('Development DeepL usage failure requested.');
    }

    const usage = DEVELOPMENT_USAGE[mockScenario];
    if (usage) return usage;
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error('DEEPL_API_KEY is not configured.');

  const response = await fetch(`${getDeepLApiBaseUrl(apiKey)}/v2/usage`, {
    headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`DeepL usage endpoint returned status ${response.status}.`);
  }

  const data = (await response.json()) as DeepLUsageResponse;
  if (typeof data.character_count !== 'number' || typeof data.character_limit !== 'number') {
    throw new Error('DeepL usage endpoint returned an invalid response.');
  }

  return createDeepLUsage(data.character_count, data.character_limit);
}