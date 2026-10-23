/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  DEFAULT_CONTENT_FALLBACK_MIN_DISPLAY_TIME,
  useDelayedFallback,
} from '@/hooks/useDelayedFallback';

describe('useDelayedFallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts directly in content when cached blocks are available', () => {
    const { result } = renderHook(() => useDelayedFallback(1));

    expect(result.current).toBe('content');
  });

  it('starts in loading and only shows fallback after the threshold', () => {
    const { result } = renderHook(() =>
      useDelayedFallback(0, {
        pollingInterval: 100,
        fallbackThreshold: 500,
      }),
    );

    expect(result.current).toBe('loading');

    act(() => jest.advanceTimersByTime(499));
    expect(result.current).toBe('loading');

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('fallback');
  });

  it('switches to content without showing fallback when content arrives early', () => {
    const { result, rerender } = renderHook(
      ({ contentBlockCount }: { contentBlockCount: number }) =>
        useDelayedFallback(contentBlockCount, {
          pollingInterval: 100,
          fallbackThreshold: 500,
        }),
      { initialProps: { contentBlockCount: 0 } },
    );

    act(() => {
      rerender({ contentBlockCount: 1 });
    });

    expect(result.current).toBe('content');

    act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe('content');
  });

  it('keeps fallback visible for the minimum display time after content arrives', () => {
    const { result, rerender } = renderHook(
      ({ contentBlockCount }: { contentBlockCount: number }) =>
        useDelayedFallback(contentBlockCount, {
          pollingInterval: 100,
          fallbackThreshold: 500,
        }),
      { initialProps: { contentBlockCount: 0 } },
    );

    act(() => jest.advanceTimersByTime(500));
    expect(result.current).toBe('fallback');

    act(() => {
      rerender({ contentBlockCount: 1 });
    });
    expect(result.current).toBe('fallback');

    act(() => jest.advanceTimersByTime(DEFAULT_CONTENT_FALLBACK_MIN_DISPLAY_TIME - 1));
    expect(result.current).toBe('fallback');

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('content');
  });

  it('cleans up polling and reveal timers when unmounted', () => {
    const { result, rerender, unmount } = renderHook(
      ({ contentBlockCount }: { contentBlockCount: number }) =>
        useDelayedFallback(contentBlockCount, {
          pollingInterval: 100,
          fallbackThreshold: 500,
        }),
      { initialProps: { contentBlockCount: 0 } },
    );

    act(() => jest.advanceTimersByTime(500));
    expect(result.current).toBe('fallback');

    act(() => {
      rerender({ contentBlockCount: 1 });
    });
    unmount();

    act(() => jest.advanceTimersByTime(DEFAULT_CONTENT_FALLBACK_MIN_DISPLAY_TIME));
    expect(jest.getTimerCount()).toBe(0);
  });
});
