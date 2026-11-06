import type { AdminTableKey, AdminTableRevisions } from '@/types/tableRevision';

export const DEFAULT_TABLE_REVISION_POLLING_INTERVAL = 3000;

// This small document contract keeps polling testable in Jest's Node environment.
// The React hook supplies the browser's real document object at runtime.
interface VisibilityDocument {
  visibilityState: DocumentVisibilityState;
  addEventListener: (type: 'visibilitychange', listener: () => void) => void;
  removeEventListener: (type: 'visibilitychange', listener: () => void) => void;
}

interface TableRevisionPollingOptions {
  tableKey: AdminTableKey;
  reloadTable: () => Promise<void> | void;
  fetchRevisions: () => Promise<AdminTableRevisions>;
  document: VisibilityDocument;
  pollingInterval?: number;
  paused?: boolean;
}

interface TableRevisionPollingController {
  (): void;
  setPaused: (paused: boolean) => void;
}

/**
 * Poll one admin-table revision while the browser tab is visible.
 *
 * The service passed through fetchRevisions provides both table revisions in one
 * request. This controller compares only tableKey, then asks the page-provided
 * reload callback to retrieve full table data when that revision increases.
 */
export function startVisibleTableRevisionPolling({
  tableKey,
  reloadTable,
  fetchRevisions,
  document,
  pollingInterval = DEFAULT_TABLE_REVISION_POLLING_INTERVAL,
  paused = false,
}: TableRevisionPollingOptions): TableRevisionPollingController {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isStopped = false;
  let isChecking = false;
  let lastRevision: number | null = null;
  let isPaused = paused;
  let pauseVersion = 0;
  let checkAfterResume = false;

  // A hidden tab must not retain a timer because inactive admin pages should
  // not continue making revision requests in the background.
  const stopInterval = (): void => {
    if (intervalId === null) {
      return;
    }

    clearInterval(intervalId);
    intervalId = null;
  };

  const checkForRevisionChange = async (): Promise<void> => {
    // One guard covers both the lightweight revision request and a potentially
    // slower full-table reload, preventing overlapping reload callbacks.
    if (isStopped || isPaused || isChecking || document.visibilityState !== 'visible') {
      return;
    }

    isChecking = true;
    const version = pauseVersion;
    const isResumeCheck = checkAfterResume;
    checkAfterResume = false;

    try {
      const revisions = await fetchRevisions();
      if (isStopped || isPaused || version !== pauseVersion
        || document.visibilityState !== 'visible') {
        return;
      }

      const currentRevision = revisions[tableKey];
      if (lastRevision === null) {
        // The initial response establishes a baseline. The page performs its
        // own initial table fetch, so this must not cause a redundant reload.
        lastRevision = currentRevision;
        // A form may open before the initial baseline request completes.
        // In that case, refresh once on resume rather than miss changes during entry.
        if (isResumeCheck) await reloadTable();
        return;
      }

      if (currentRevision > lastRevision) {
        // Record the observed revision before awaiting the reload. A later
        // higher revision can then trigger one follow-up reload after this one.
        lastRevision = currentRevision;
        await reloadTable();
      }
    } catch (error: unknown) {
      console.error('Unable to check admin table revisions.', error);
    } finally {
      isChecking = false;
      // A quick close can occur before the pre-pause request settles. Ignore its
      // stale result, then perform the close-time check without overlapping requests.
      if (checkAfterResume && !isStopped && !isPaused
        && document.visibilityState === 'visible') {
        void checkForRevisionChange();
      }
    }
  };

  const startInterval = (): void => {
    if (isStopped || isPaused || intervalId !== null
      || document.visibilityState !== 'visible') {
      return;
    }

    intervalId = setInterval(() => {
      void checkForRevisionChange();
    }, pollingInterval);
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      stopInterval();
      return;
    }

    // Returning to a tab should not wait for the next interval before checking
    // whether another admin changed its table while this tab was inactive.
    void checkForRevisionChange();
    startInterval();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  if (document.visibilityState === 'visible') {
    // A visible initial mount receives a baseline immediately, then polls.
    void checkForRevisionChange();
    startInterval();
  }

  const stopPolling = (): void => {
    // The hook returns this cleanup through useEffect, so navigation cannot
    // leave an interval or a visibility listener associated with an old page.
    isStopped = true;
    stopInterval();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  return Object.assign(stopPolling, {
    setPaused(nextPaused: boolean): void {
      if (isStopped || nextPaused === isPaused) return;
      isPaused = nextPaused;
      pauseVersion += 1;
      if (isPaused) {
        stopInterval();
        checkAfterResume = false;
      } else {
        checkAfterResume = true;
        void checkForRevisionChange();
        startInterval();
      }
    },
  });
}