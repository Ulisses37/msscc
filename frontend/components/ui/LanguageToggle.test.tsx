/**
 * @jest-environment jsdom
 *
 * Run this file from the repository root with:
 * npm --prefix frontend test -- --runInBand components/ui/LanguageToggle.test.tsx
 */

import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocale } from 'next-intl';

import { usePathname, useRouter } from '@/i18n/routing';

import { LanguageToggle } from './LanguageToggle';

jest.mock('next-intl', () => ({
  useLocale: jest.fn(),
}));

jest.mock('@/i18n/routing', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

const replace = jest.fn();

function renderToggle(locale: 'en' | 'ja', pathname = '/events/history'): void {
  jest.mocked(useLocale).mockReturnValue(locale);
  jest.mocked(usePathname).mockReturnValue(pathname);
  jest.mocked(useRouter).mockReturnValue({ replace } as ReturnType<typeof useRouter>);
  render(<LanguageToggle />);
}

describe('LanguageToggle', () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it('renders the current English UI with English selected', () => {
    // Tests: the visible ENG and 日本語 controls when the current locale is English.
    // Expected output: ENG is pressed and visually active, while 日本語 is not pressed.
    renderToggle('en');

    const englishButton = screen.getByRole('button', { name: 'Switch to English' });
    const japaneseButton = screen.getByRole('button', { name: '日本語に切り替え' });

    expect(englishButton).toHaveTextContent('ENG');
    expect(japaneseButton).toHaveTextContent('日本語');
    expect(englishButton).toHaveAttribute('aria-pressed', 'true');
    expect(japaneseButton).toHaveAttribute('aria-pressed', 'false');
    expect(englishButton).toHaveClass('bg-[#264653]', 'text-white');
    expect(japaneseButton).not.toHaveClass('bg-[#264653]', 'text-white');
  });

  it('renders the current Japanese UI with Japanese selected', () => {
    // Tests: active-state behavior when the current locale is Japanese.
    // Expected output: 日本語 is pressed and visually active, while ENG is not pressed.
    renderToggle('ja');

    const englishButton = screen.getByRole('button', { name: 'Switch to English' });
    const japaneseButton = screen.getByRole('button', { name: '日本語に切り替え' });

    expect(japaneseButton).toHaveAttribute('aria-pressed', 'true');
    expect(englishButton).toHaveAttribute('aria-pressed', 'false');
    expect(japaneseButton).toHaveClass('bg-[#264653]', 'text-white');
    expect(englishButton).not.toHaveClass('bg-[#264653]', 'text-white');
  });

  it('switches from English to Japanese while preserving the pathname', async () => {
    // Tests: switchLanguage from an English page and locale-aware router navigation.
    // Expected output: router.replace receives the unchanged pathname and locale ja exactly once.
    const user = userEvent.setup();
    renderToggle('en', '/membership');

    await user.click(screen.getByRole('button', { name: '日本語に切り替え' }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/membership', { locale: 'ja' });
  });

  it('switches from Japanese to English while preserving the pathname', async () => {
    // Tests: switchLanguage from a Japanese page and locale-aware router navigation.
    // Expected output: router.replace receives the unchanged pathname and locale en exactly once.
    const user = userEvent.setup();
    renderToggle('ja', '/events/history');

    await user.click(screen.getByRole('button', { name: 'Switch to English' }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/events/history', { locale: 'en' });
  });

  it.each([
    ['en', 'Switch to English'],
    ['ja', '日本語に切り替え'],
  ] as const)('does not navigate when %s is already active', async (locale, buttonName) => {
    // Tests: selecting the locale that useLocale already reports as active.
    // Expected output: no router replacement and no browser-location reload or pathname change.
    const user = userEvent.setup();
    const originalHref = window.location.href;
    renderToggle(locale, '/partners');

    await user.click(screen.getByRole('button', { name: buttonName }));

    expect(replace).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalHref);
  });
});