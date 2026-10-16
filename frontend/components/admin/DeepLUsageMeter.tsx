'use client';

import { useEffect, useState } from 'react';

import type { DeepLUsage } from '@/types/deepl';

/** Retrieves current usage through the server-only DeepL route. */
async function fetchDeepLUsage(): Promise<DeepLUsage> {
  const response = await fetch('/api/deepl-usage', { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`DeepL usage request failed with status ${response.status}.`);
  }

  return (await response.json()) as DeepLUsage;
}

/** Displays the current DeepL account usage on the admin dashboard. */
export function DeepLUsageMeter() {
  const [usage, setUsage] = useState<DeepLUsage | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadUsage = async () => {
      try {
        const currentUsage = await fetchDeepLUsage();
        if (isMounted) setUsage(currentUsage);
      } catch (error) {
        console.error('Unable to display DeepL usage.', error);
        if (isMounted) setErrorMessage('DeepL usage is currently unavailable.');
      }
    };

    void loadUsage();

    return () => {
      isMounted = false;
    };
  }, []);

  if (errorMessage) {
    return (
      <div
        role="alert"
        className="bg-msscc-pink-faint px-4 py-3 text-center text-sm text-msscc-danger"
      >
        {errorMessage}
      </div>
    );
  }

  if (!usage) {
    return (
      <div role="status" className="bg-msscc-pink px-4 py-4 text-center text-gray-200">
        Loading DeepL usage...
      </div>
    );
  }

  const roundedPercentage = Math.round(usage.usagePercentage);

  return (
    <div className="flex flex-col items-center bg-msscc-pink px-4 py-4 text-white">
      <div className="mb-3 flex items-center justify-center gap-3">
        <UsageProgressBar percent={usage.usagePercentage} />
        <div className="flex flex-col items-center">
          <div className="text-2xl">{roundedPercentage}%</div>
          <div className="text-xs text-gray-200">
            {usage.remainingCharacters.toLocaleString()} left
          </div>
        </div>
      </div>
      <div className="text-center text-gray-200">DeepL Translation Usage</div>
      <div className="mt-1 text-center text-xs text-gray-200">
        {usage.characterCount.toLocaleString()} / {usage.characterLimit.toLocaleString()}{' '}
        characters
      </div>
    </div>
  );
}

function UsageProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="flex h-16 w-6 flex-col justify-end overflow-hidden bg-msscc-gray-light"
      role="progressbar"
      aria-label="DeepL character usage"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="w-full bg-msscc-teal transition-all duration-500"
        style={{ height: `${clamped}%` }}
      />
    </div>
  );
}