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
): boolean {
  const contentReadyRef = useRef(contentBlockCount > 0);
  const [showFallback, setShowFallback] = useState(false);

  contentReadyRef.current = contentBlockCount > 0;

  useEffect(() => {
    setShowFallback(false);

    if (contentReadyRef.current) return;

    return startContentFallbackPolling({
      isContentReady: () => contentReadyRef.current,
      onFallback: () => setShowFallback(true),
      pollingInterval,
      fallbackThreshold,
    });
  }, [fallbackThreshold, pollingInterval, contentBlockCount > 0]);

  // Do not let a previously initialized fallback remain visible during the
  // render that receives content blocks; the content render always wins.
  return showFallback && contentBlockCount === 0;
}
