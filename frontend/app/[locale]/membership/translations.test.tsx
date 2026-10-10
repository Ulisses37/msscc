/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { createContext, useContext, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import MembershipPage from '@/app/[locale]/membership/page';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';

let mockLocale = 'en';
const mockMessageContext = createContext<Record<string, unknown>>({});

jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({
    messages,
    children,
  }: {
    messages: Record<string, unknown>;
    children: ReactNode;
  }) => (
    <mockMessageContext.Provider value={messages}>
      {children}
    </mockMessageContext.Provider>
  ),
  useMessages: () => useContext(mockMessageContext),
  useTranslations: (namespace: string) => {
    const messages = useContext(mockMessageContext);
    return (key: string) => {
      const value = key.split('.').reduce<unknown>((current, segment) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[segment]
          : undefined,
      messages[namespace]);
      return typeof value === 'string' ? value : `${namespace}.${key}`;
    };
  },
}));

jest.mock('next/navigation', () => ({
  useParams: () => ({ locale: mockLocale }),
}));

jest.mock('@/hooks/usePreviewBlocks', () => ({
  usePreviewBlocks: () => ({ current: false }),
}));

jest.mock('@/utils/content', () => ({
  getCachedPageContent: () => [],
  fetchPageContent: () => new Promise<never>(() => undefined),
}));

jest.mock('@/components/content/ContentBlockRenderer', () => ({
  ContentBlockRenderer: () => null,
}));

jest.mock('@/components/content/ContentFallBack', () => ({
  FallBack: () => null,
}));

describe('membership page translations with an older layout payload', () => {
  it.each([
    ['en', enMessages.MembershipPage],
    ['ja', jaMessages.MembershipPage],
  ])('renders %s labels when the parent provider has no membership messages', (locale, messages) => {
    mockLocale = locale;
    render(
      <NextIntlClientProvider locale={locale} messages={{ Navbar: enMessages.Navbar }}>
        <MembershipPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('group', { name: messages.optionsHeading })).toBeInTheDocument();
    expect(screen.getByText(messages.summaryEmpty)).toBeInTheDocument();
    expect(screen.getByLabelText(messages.email)).toBeInTheDocument();
    expect(screen.queryByText('MembershipPage.optionsHeading')).not.toBeInTheDocument();
  });
});