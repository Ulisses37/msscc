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
});