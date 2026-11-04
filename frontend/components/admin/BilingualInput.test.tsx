/**
 * @jest-environment jsdom
 *
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand components/admin/BilingualInput.test.tsx
 */

import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BilingualInput from '@/components/admin/BilingualInput';

const NOTICE_TEXT = '⚠ The English text was changed. Please review the Japanese text.';

interface DeferredPromise {
  promise: Promise<void>;
  resolve: () => void;
}

function createDeferredPromise(): DeferredPromise {
  let resolve = () => undefined;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

describe('BilingualInput', () => {
  it('shows, dismisses, and redisplays the notice after manual English edits', async () => {
    const onUpdateEn = jest.fn();
    const onUpdateJa = jest.fn();
    const user = userEvent.setup();

    render(
      <BilingualInput
        labelEn="English Text"
        labelJa="Japanese Text"
        valueEn="Original English"
        valueJa="元の日本語"
        onUpdateEn={onUpdateEn}
        onUpdateJa={onUpdateJa}
        onTranslate={jest.fn().mockResolvedValue(undefined)}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();

    const englishEditor = screen.getByRole('textbox', { name: 'English Text' });
    fireEvent.input(englishEditor, { target: { innerHTML: 'Changed English' } });

    expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument();
    expect(onUpdateEn).toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: 'Dismiss English text change notice' }),
    );

    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
    expect(onUpdateJa).not.toHaveBeenCalled();

    fireEvent.input(englishEditor, { target: { innerHTML: '' } });
    expect(screen.getByText(NOTICE_TEXT)).toBeInTheDocument();
  });

  it('does not show the notice when focus leaves without changing English text', () => {
    const onUpdateEn = jest.fn();

    render(
      <BilingualInput
        labelEn="English Text"
        labelJa="Japanese Text"
        valueEn="Original English"
        valueJa="元の日本語"
        onUpdateEn={onUpdateEn}
        onUpdateJa={jest.fn()}
        onTranslate={jest.fn().mockResolvedValue(undefined)}
        onDelete={jest.fn()}
      />,
    );

    const englishEditor = screen.getByRole('textbox', { name: 'English Text' });
    fireEvent.focus(englishEditor);
    fireEvent.blur(englishEditor, { target: { innerHTML: 'Original English' } });

    expect(screen.queryByText(NOTICE_TEXT)).not.toBeInTheDocument();
    expect(onUpdateEn).not.toHaveBeenCalled();
  });

  it('renders the notice before both language fields', () => {
    render(
      <BilingualInput
        labelEn="English Text"
        labelJa="Japanese Text"
        valueEn="Original English"
        valueJa="元の日本語"
        onUpdateEn={jest.fn()}
        onUpdateJa={jest.fn()}
        onTranslate={jest.fn().mockResolvedValue(undefined)}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.input(screen.getByRole('textbox', { name: 'English Text' }), {
      target: { innerHTML: 'Changed English' },
    });

    const notice = screen.getByRole('status');
    const englishEditor = screen.getByRole('textbox', { name: 'English Text' });
    const japaneseEditor = screen.getByRole('textbox', { name: 'Japanese Text' });
    expect(notice.compareDocumentPosition(englishEditor)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(notice.compareDocumentPosition(japaneseEditor)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it.each([
    ['empty English text', ''],
    ['English formatting without readable text', '<strong></strong>'],
  ])('disables translation for %s', (_description, valueEn) => {
    // Tests: translation cannot consume quota when the English editor has no visible characters.
    // Expected output: the Translate to Japanese button is present but disabled.
    render(
      <BilingualInput
        labelEn="English Text"
        labelJa="Japanese Text"
        valueEn={valueEn}
        valueJa=""
        onUpdateEn={jest.fn()}
        onUpdateJa={jest.fn()}
        onTranslate={jest.fn().mockResolvedValue(undefined)}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Translate to Japanese' })).toBeDisabled();
  });

  it('shows a disabled translating state until the translation finishes', async () => {
    // Tests: repeated clicks cannot submit duplicate DeepL requests while one request is pending.
    // Expected output: one callback, Translating... while pending, then the normal enabled label.
    const deferred = createDeferredPromise();
    const onTranslate = jest.fn().mockReturnValue(deferred.promise);
    const user = userEvent.setup();

    render(
      <BilingualInput
        labelEn="English Text"
        labelJa="Japanese Text"
        valueEn="Translate this text"
        valueJa=""
        onUpdateEn={jest.fn()}
        onUpdateJa={jest.fn()}
        onTranslate={onTranslate}
        onDelete={jest.fn()}
      />,
    );

    const translateButton = screen.getByRole('button', { name: 'Translate to Japanese' });
    expect(translateButton).toBeEnabled();

    await user.click(translateButton);

    expect(onTranslate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Translating...' })).toBeDisabled();

    deferred.resolve();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Translate to Japanese' })).toBeEnabled();
    });
  });
});