import {
  startContentFallbackPolling,
} from '@/utils/contentFallbackPolling';

describe('startContentFallbackPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits for the content threshold before initializing the fallback', () => {
    let contentReady = false;
    const onFallback = jest.fn();

    startContentFallbackPolling({
      isContentReady: () => contentReady,
      onFallback,
      pollingInterval: 100,
      fallbackThreshold: 500,
    });

    jest.advanceTimersByTime(400);
    expect(onFallback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(onFallback).toHaveBeenCalledTimes(1);

    contentReady = true;
  });

  it('stops polling when content becomes ready before the threshold', () => {
    let contentReady = false;
    const onFallback = jest.fn();

    startContentFallbackPolling({
      isContentReady: () => contentReady,
      onFallback,
      pollingInterval: 100,
      fallbackThreshold: 500,
    });

    jest.advanceTimersByTime(200);
    contentReady = true;
    jest.advanceTimersByTime(500);

    expect(onFallback).not.toHaveBeenCalled();
  });

  it('supports explicit cleanup before the threshold', () => {
    const onFallback = jest.fn();
    const stopPolling = startContentFallbackPolling({
      isContentReady: () => false,
      onFallback,
      pollingInterval: 100,
      fallbackThreshold: 500,
    });

    stopPolling();
    jest.advanceTimersByTime(500);

    expect(onFallback).not.toHaveBeenCalled();
  });
});
