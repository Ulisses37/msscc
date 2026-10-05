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
): void {
  const reloadTableRef = useRef(reloadTable);

  // A page can replace its callback after rendering. Keeping the latest callback
  // in a ref avoids resetting the active interval solely because its identity changed.
  useEffect(() => {
    reloadTableRef.current = reloadTable;
  }, [reloadTable]);

  useEffect(() => {
    return startVisibleTableRevisionPolling({
      tableKey,
      // The controller calls the current page callback without owning page state.
      reloadTable: () => reloadTableRef.current(),
      fetchRevisions: fetchTableRevisions,
      document,
      pollingInterval,
    });
  }, [pollingInterval, tableKey]);
}