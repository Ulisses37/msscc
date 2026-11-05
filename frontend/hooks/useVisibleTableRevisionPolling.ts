'use client';

import { useEffect, useRef } from 'react';

import { fetchTableRevisions } from '@/services/tableRevisionService';
import type { AdminTableKey } from '@/types/tableRevision';
import {
  DEFAULT_TABLE_REVISION_POLLING_INTERVAL,
  startVisibleTableRevisionPolling,
} from '@/utils/tableRevisionPolling';

/**
 * Connect visible-tab revision polling to an admin page's table reload callback.
 *
 * The controller owns visibility and concurrency behavior. This hook only ties
 * that controller to the component lifecycle and supplies the authenticated
 * revision service used by both donations and memberships pages.
 */
export function useVisibleTableRevisionPolling(
  tableKey: AdminTableKey,
  reloadTable: () => Promise<void> | void,
  pollingInterval = DEFAULT_TABLE_REVISION_POLLING_INTERVAL,
  paused = false,
): void {
  const reloadTableRef = useRef(reloadTable);
  const controllerRef = useRef<ReturnType<typeof startVisibleTableRevisionPolling> | null>(null);
  const pausedRef = useRef(paused);

  // A page can replace its callback after rendering. Keeping the latest callback
  // in a ref avoids resetting the active interval solely because its identity changed.
  useEffect(() => {
    reloadTableRef.current = reloadTable;
  }, [reloadTable]);

  useEffect(() => {
    const controller = startVisibleTableRevisionPolling({
      tableKey,
      // The controller calls the current page callback without owning page state.
      reloadTable: () => reloadTableRef.current(),
      fetchRevisions: fetchTableRevisions,
      document,
      pollingInterval,
      paused: pausedRef.current,
    });
    controllerRef.current = controller;
    return () => {
      controller();
      controllerRef.current = null;
    };
  }, [pollingInterval, tableKey]);

  useEffect(() => {
    pausedRef.current = paused;
    controllerRef.current?.setPaused(paused);
  }, [paused]);
}