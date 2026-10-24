export const DEFAULT_CONTENT_FALLBACK_POLL_INTERVAL = 250;
export const DEFAULT_CONTENT_FALLBACK_THRESHOLD = 3000;

interface ContentFallbackPollingOptions {
  isContentReady: () => boolean;
  onFallback: () => void;
  pollingInterval?: number;
  fallbackThreshold?: number;
}

/**
 * Wait for public-page content to render before allowing its static fallback.
 *
 * This controller only polls readiness. It does not fetch content, which keeps
 * the fallback timing independent from the page's content request and preview
 * message handling.
 */
export function startContentFallbackPolling({
  isContentReady,
  onFallback,
  pollingInterval = DEFAULT_CONTENT_FALLBACK_POLL_INTERVAL,
  fallbackThreshold = DEFAULT_CONTENT_FALLBACK_THRESHOLD,
}: ContentFallbackPollingOptions): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isStopped = false;

  //Timer, Refreshes every page enter
  const startedAt = Date.now();

  const stopPolling = (): void => {
    if (isStopped) return;

    isStopped = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const checkContentReadiness = (): void => {
    if (isStopped) return;

    if (isContentReady()) {
      stopPolling();
      return;
    }

    const remainingTime = fallbackThreshold - (Date.now() - startedAt);
    if (remainingTime <= 0) {
      stopPolling();
      onFallback();
      return;
    }

    timeoutId = setTimeout(
      checkContentReadiness,
      Math.min(pollingInterval, remainingTime),
    );
  };

  // Check immediately so cached content can cancel the controller without
  // waiting for the first interval tick.
  checkContentReadiness();

  return stopPolling;
}
