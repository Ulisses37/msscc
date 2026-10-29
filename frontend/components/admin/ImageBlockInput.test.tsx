/**
 * @jest-environment jsdom
 *
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand components/admin/ImageBlockInput.test.tsx
 */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ImageBlockInput from '@/components/admin/ImageBlockInput';

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

function renderImageBlock(contentEn: string, onTranslate?: () => Promise<void>) {
  return render(
    <ImageBlockInput
      contentEn={contentEn}
      contentJa=""
      imageUrl={null}
      imageAlignment="center"
      imageWidth={100}
      onUpdateEn={jest.fn()}
      onUpdateJa={jest.fn()}
      onUpdateAlignment={jest.fn()}
      onUpdateWidth={jest.fn()}
      onSelectFile={jest.fn()}
      onDelete={jest.fn()}
      onTranslate={onTranslate}
    />,
  );
}

describe('ImageBlockInput translation button', () => {
  it('does not render a translation button when no callback is provided', () => {
    // Tests: page-editor image blocks can use this component without offering DeepL translation.
    // Expected output: no image-caption translation button is rendered.
    renderImageBlock('Festival guests');

    expect(
      screen.queryByRole('button', { name: 'Translate image caption to Japanese' }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['empty English caption', ''],
    ['English formatting without readable text', '<em></em>'],
  ])('disables translation for %s', (_description, contentEn) => {
    // Tests: an image-caption request cannot consume quota without visible source text.
    // Expected output: the caption translation button is present but disabled.
    renderImageBlock(contentEn, jest.fn().mockResolvedValue(undefined));

    expect(
      screen.getByRole('button', { name: 'Translate image caption to Japanese' }),
    ).toBeDisabled();
  });

  it('shows a disabled translating state until the image caption request finishes', async () => {
    // Tests: the image-caption button prevents duplicate requests while its callback is pending.
    // Expected output: one callback, Translating... while pending, then the normal enabled label.
    const deferred = createDeferredPromise();
    const onTranslate = jest.fn().mockReturnValue(deferred.promise);
    const user = userEvent.setup();
    renderImageBlock('Festival guests', onTranslate);

    const translateButton = screen.getByRole('button', {
      name: 'Translate image caption to Japanese',
    });
    expect(translateButton).toBeEnabled();

    await user.click(translateButton);

    expect(onTranslate).toHaveBeenCalledTimes(1);
    expect(translateButton).toBeDisabled();
    expect(translateButton).toHaveTextContent('Translating...');

    deferred.resolve();

    await waitFor(() => {
      expect(translateButton).toBeEnabled();
      expect(translateButton).toHaveTextContent('Translate to Japanese');
    });
  });
});