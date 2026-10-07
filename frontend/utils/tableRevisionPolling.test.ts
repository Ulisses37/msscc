import type { AdminTableRevisions } from '@/types/tableRevision';
import {
  DEFAULT_TABLE_REVISION_POLLING_INTERVAL,
  startVisibleTableRevisionPolling,
} from '@/utils/tableRevisionPolling';

class FakeVisibilityDocument {
  visibilityState: DocumentVisibilityState = 'visible';

  private listeners = new Set<() => void>();

  // The controller only needs visibility events, so tests emulate just that
  // narrow browser surface instead of requiring a DOM test environment.
  addEventListener = (_type: 'visibilitychange', listener: () => void): void => {
    this.listeners.add(listener);
  };

  removeEventListener = (_type: 'visibilitychange', listener: () => void): void => {
    this.listeners.delete(listener);
  };

  setVisibilityState(visibilityState: DocumentVisibilityState): void {
    this.visibilityState = visibilityState;
    this.listeners.forEach((listener) => listener());
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

function createRevisions(
  donations: number,
  memberships: number,
): AdminTableRevisions {
  return { donations, memberships };
}

function createDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  // Tests hold this promise open to simulate a slow table reload and verify
  // that interval ticks cannot start a concurrent reload.
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

async function flushPromises(): Promise<void> {
  // Advancing fake timers runs interval callbacks, while this yields to the
  // promise continuations started by those callbacks.
  await Promise.resolve();
  await Promise.resolve();
}

describe('startVisibleTableRevisionPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('stores the initial visible revision without reloading the table', async () => {
    const document = new FakeVisibilityDocument();
    const fetchRevisions = jest.fn().mockResolvedValue(createRevisions(12, 4));
    const reloadTable = jest.fn();

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'donations',
      reloadTable,
      fetchRevisions,
      document,
    });
    await flushPromises();

    expect(fetchRevisions).toHaveBeenCalledTimes(1);
    expect(reloadTable).not.toHaveBeenCalled();

    stopPolling();
  });

  it('checks the assigned table at the default interval and reloads on an increase', async () => {
    const document = new FakeVisibilityDocument();
    const fetchRevisions = jest
      .fn()
      .mockResolvedValueOnce(createRevisions(12, 4))
      .mockResolvedValueOnce(createRevisions(13, 4));
    const reloadTable = jest.fn();

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'donations',
      reloadTable,
      fetchRevisions,
      document,
    });
    await flushPromises();

    jest.advanceTimersByTime(DEFAULT_TABLE_REVISION_POLLING_INTERVAL);
    await flushPromises();

    expect(fetchRevisions).toHaveBeenCalledTimes(2);
    expect(reloadTable).toHaveBeenCalledTimes(1);

    stopPolling();
  });

  it('ignores changes to the other table and lower assigned revisions', async () => {
    const document = new FakeVisibilityDocument();
    const fetchRevisions = jest
      .fn()
      .mockResolvedValueOnce(createRevisions(12, 4))
      .mockResolvedValueOnce(createRevisions(12, 5))
      .mockResolvedValueOnce(createRevisions(11, 5));
    const reloadTable = jest.fn();

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'donations',
      reloadTable,
      fetchRevisions,
      document,
      pollingInterval: 1000,
    });
    await flushPromises();

    jest.advanceTimersByTime(1000);
    await flushPromises();
    jest.advanceTimersByTime(1000);
    await flushPromises();

    expect(reloadTable).not.toHaveBeenCalled();

    stopPolling();
  });

  it('stops requests while hidden and checks immediately when visible again', async () => {
    const document = new FakeVisibilityDocument();
    const fetchRevisions = jest
      .fn()
      .mockResolvedValueOnce(createRevisions(12, 4))
      .mockResolvedValueOnce(createRevisions(13, 4));
    const reloadTable = jest.fn();

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'donations',
      reloadTable,
      fetchRevisions,
      document,
    });
    await flushPromises();

    document.setVisibilityState('hidden');
    jest.advanceTimersByTime(DEFAULT_TABLE_REVISION_POLLING_INTERVAL * 2);
    await flushPromises();
    expect(fetchRevisions).toHaveBeenCalledTimes(1);

    document.setVisibilityState('visible');
    await flushPromises();
    expect(fetchRevisions).toHaveBeenCalledTimes(2);
    expect(reloadTable).toHaveBeenCalledTimes(1);

    stopPolling();
  });

  it('does not start requests until an initially hidden tab becomes visible', async () => {
    const document = new FakeVisibilityDocument();
    document.visibilityState = 'hidden';
    const fetchRevisions = jest.fn().mockResolvedValue(createRevisions(12, 4));
    const reloadTable = jest.fn();

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'memberships',
      reloadTable,
      fetchRevisions,
      document,
    });
    jest.advanceTimersByTime(DEFAULT_TABLE_REVISION_POLLING_INTERVAL * 2);
    await flushPromises();
    expect(fetchRevisions).not.toHaveBeenCalled();

    document.setVisibilityState('visible');
    await flushPromises();
    expect(fetchRevisions).toHaveBeenCalledTimes(1);

    stopPolling();
  });

  it('prevents concurrent reloads and checks again after the active reload completes', async () => {
    const document = new FakeVisibilityDocument();
    const firstReload = createDeferred();
    const fetchRevisions = jest
      .fn()
      .mockResolvedValueOnce(createRevisions(12, 4))
      .mockResolvedValueOnce(createRevisions(13, 4))
      .mockResolvedValueOnce(createRevisions(14, 4));
    const reloadTable = jest
      .fn()
      .mockImplementationOnce(() => firstReload.promise)
      .mockResolvedValueOnce(undefined);

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'donations',
      reloadTable,
      fetchRevisions,
      document,
      pollingInterval: 1000,
    });
    await flushPromises();

    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(reloadTable).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(2000);
    await flushPromises();
    expect(fetchRevisions).toHaveBeenCalledTimes(2);
    expect(reloadTable).toHaveBeenCalledTimes(1);

    firstReload.resolve();
    await flushPromises();
    jest.advanceTimersByTime(1000);
    await flushPromises();

    expect(fetchRevisions).toHaveBeenCalledTimes(3);
    expect(reloadTable).toHaveBeenCalledTimes(2);

    stopPolling();
  });

  it('cleans up the interval and visibility listener when stopped', async () => {
    const document = new FakeVisibilityDocument();
    const fetchRevisions = jest.fn().mockResolvedValue(createRevisions(12, 4));
    const reloadTable = jest.fn();

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'donations',
      reloadTable,
      fetchRevisions,
      document,
    });
    await flushPromises();

    stopPolling();
    document.setVisibilityState('hidden');
    document.setVisibilityState('visible');
    jest.advanceTimersByTime(DEFAULT_TABLE_REVISION_POLLING_INTERVAL * 2);
    await flushPromises();

    expect(document.listenerCount).toBe(0);
    expect(fetchRevisions).toHaveBeenCalledTimes(1);
  });

  it('continues polling after a revision request fails', async () => {
    const document = new FakeVisibilityDocument();
    const fetchRevisions = jest
      .fn()
      .mockRejectedValueOnce(new Error('request failed'))
      .mockResolvedValueOnce(createRevisions(12, 4));
    const reloadTable = jest.fn();

    const stopPolling = startVisibleTableRevisionPolling({
      tableKey: 'donations',
      reloadTable,
      fetchRevisions,
      document,
      pollingInterval: 1000,
    });
    await flushPromises();

    jest.advanceTimersByTime(1000);
    await flushPromises();

    expect(fetchRevisions).toHaveBeenCalledTimes(2);
    expect(reloadTable).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();

    stopPolling();
  });
});