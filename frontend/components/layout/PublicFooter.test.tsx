/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import type { AnchorHTMLAttributes } from 'react';

import { render, screen } from '@testing-library/react';

import en from '@/messages/en.json';
import ja from '@/messages/ja.json';

import { PublicFooter } from './PublicFooter';

let mockLocale: 'en' | 'ja' = 'en';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof en.Footer) =>
    (mockLocale === 'ja' ? ja : en).Footer[key],
}));

jest.mock('@/i18n/routing', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('PublicFooter', () => {
  it.each(['en', 'ja'] as const)(
    'constrains the %s content while keeping the background full width',
    (locale) => {
      mockLocale = locale;
      render(<PublicFooter />);

      const footer = screen.getByRole('contentinfo');
      const messages = (locale === 'ja' ? ja : en).Footer;
      const content = screen.getByRole('navigation', { name: messages.navigation }).parentElement;

      expect(footer).toHaveClass('w-full', 'bg-msscc-teal');
      expect(footer).not.toHaveClass('max-w-content');
      expect(content).toHaveClass('mx-auto', 'w-full', 'max-w-content', 'grid');
      expect(content).toHaveClass('lg:grid-cols-[1.2fr_1fr_1fr]');
      expect(screen.getByRole('link', { name: messages.home })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: messages.partners })).toHaveAttribute(
        'href', '/partners',
      );
    },
  );
});