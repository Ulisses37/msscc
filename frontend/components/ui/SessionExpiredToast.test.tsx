/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { SessionExpiredToast } from './SessionExpiredToast';

describe('SessionExpiredToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('announces the expiration and lets the admin dismiss it', () => {
    const onDismiss = jest.fn();
    render(<SessionExpiredToast onDismiss={onDismiss} />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your session has expired. Please sign in again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss session expiration notice' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses automatically after six seconds', () => {
    const onDismiss = jest.fn();
    render(<SessionExpiredToast onDismiss={onDismiss} />);

    act(() => {
      jest.advanceTimersByTime(6_000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
