'use client';

import { useEffect, useRef, useState } from 'react';
import {
  startContentFallbackPolling,
  DEFAULT_CONTENT_FALLBACK_POLL_INTERVAL,
  DEFAULT_CONTENT_FALLBACK_THRESHOLD,
} from '@/utils/contentFallbackPolling';

interface DelayedFallbackOptions {
  pollingInterval?: number;
  fallbackThreshold?: number;
}

export type ContentDisplayState = 'loading' | 'fallback' | 'content';

export const DEFAULT_CONTENT_FALLBACK_MIN_DISPLAY_TIME = 1000;

/**
 * Delay a public page's static fallback while its content blocks have time to
 * arrive from the API or the preview channel.
 */
export function useDelayedFallback(
  contentBlockCount: number,
  {
    pollingInterval = DEFAULT_CONTENT_FALLBACK_POLL_INTERVAL,
    fallbackThreshold = DEFAULT_CONTENT_FALLBACK_THRESHOLD,
  }: DelayedFallbackOptions = {},
): ContentDisplayState {
  const contentReadyRef = useRef(contentBlockCount > 0);
  const fallbackShownAtRef = useRef<number | null>(null);
  const [displayState, setDisplayState] = useState<ContentDisplayState>(
    contentBlockCount > 0 ? 'content' : 'loading',
  );

  contentReadyRef.current = contentBlockCount > 0;

  useEffect(() => {
    if (contentReadyRef.current) {
      const fallbackShownAt = fallbackShownAtRef.current;

      if (fallbackShownAt === null) {
        setDisplayState('content');
        return;
      }

      const remainingDisplayTime =
        DEFAULT_CONTENT_FALLBACK_MIN_DISPLAY_TIME - (Date.now() - fallbackShownAt);

      if (remainingDisplayTime <= 0) {
        fallbackShownAtRef.current = null;
        setDisplayState('content');
        return;
      }

      const revealTimeout = setTimeout(() => {
        if (!contentReadyRef.current) return;

        fallbackShownAtRef.current = null;
        setDisplayState('content');
      }, remainingDisplayTime);

      return () => clearTimeout(revealTimeout);
    }

    // If content disappears while the minimum fallback duration is still in
    // progress, keep the fallback visible and do not restart the threshold.
    if (fallbackShownAtRef.current !== null) {
      setDisplayState('fallback');
      return;
    }

    setDisplayState('loading');

    return startContentFallbackPolling({
      isContentReady: () => contentReadyRef.current,
      onFallback: () => {
        fallbackShownAtRef.current = Date.now();
        setDisplayState('fallback');
      },
      pollingInterval,
      fallbackThreshold,
    });
  }, [fallbackThreshold, pollingInterval, contentBlockCount > 0]);

  return displayState;
}
