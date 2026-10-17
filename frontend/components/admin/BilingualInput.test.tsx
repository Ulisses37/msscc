/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BilingualInput from '@/components/admin/BilingualInput';

const NOTICE_TEXT = '⚠ The English text was changed. Please review the Japanese text.';

describe('BilingualInput translation review notice', () => {
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
});