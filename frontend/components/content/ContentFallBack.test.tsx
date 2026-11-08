/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import {
  ContentLoading,
  FallBack,
} from '@/components/content/ContentFallBack';

// next-intl ships an ESM-only build that jest does not transform, so the real
// provider cannot be imported here. This mock runs the component against the
// real en/ja message bundles, which is what this suite verifies.
jest.mock('next-intl', () => {
  // jest hoists this factory above the imports, so the bundles are required
  // here rather than referenced from the module scope.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const enMessages = require('@/messages/en.json');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const jaMessages = require('@/messages/ja.json');
  const bundles: Record<string, unknown> = { en: enMessages, ja: jaMessages };

  let activeMessages: unknown = enMessages;

  return {
    NextIntlClientProvider: ({
      locale,
      children,
    }: {
      locale: string;
      children: React.ReactNode;
    }) => {
      activeMessages = bundles[locale] ?? enMessages;
      return children;
    },
    useTranslations: (namespace: string) => (key: string) => {
      const value = `${namespace}.${key}`
        .split('.')
        .reduce<unknown>((current, segment) => {
          if (current === null || typeof current !== 'object') {
            return undefined;
          }

          return (current as Record<string, unknown>)[segment];
        }, activeMessages);

      return typeof value === 'string' ? value : `${namespace}.${key}`;
    },
  };
});

type Locale = 'en' | 'ja';
type FallbackSource = 'home' | 'about' | 'partners' | 'membership' | 'events' | 'support';

const messagesByLocale = {
  en: enMessages,
  ja: jaMessages,
} as const;

function renderFallback(locale: Locale, source: FallbackSource) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messagesByLocale[locale]}>
      <FallBack source={source} />
    </NextIntlClientProvider>,
  );
}

function messageShape(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return typeof value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, messageShape(child)]),
  );
}

function getMessageValue(messages: typeof enMessages.ContentFallback, path: string): string {
  return path.split('.').reduce<unknown>((value, key) => {
    return (value as Record<string, unknown>)[key];
  }, messages) as string;
}

describe('ContentFallBack localization', () => {
  it('keeps the English and Japanese message namespaces structurally aligned', () => {
    expect(messageShape(jaMessages.ContentFallback)).toEqual(
      messageShape(enMessages.ContentFallback),
    );
  });

  it.each([
    ['home', 'home.heading1'],
    ['about', 'about.aboutHeading1'],
    ['partners', 'events.eventHeading1'],
    ['membership', 'membership.membershipHeading1'],
    ['events', 'events.eventHeading1'],
    ['support', 'support.supportHeading1'],
  ] as const)('renders the %s fallback in English', (source, headingKey) => {
    renderFallback('en', source);

    expect(screen.getByText(getMessageValue(enMessages.ContentFallback, headingKey))).toBeInTheDocument();
    expect(screen.getByText(enMessages.ContentFallback.noticeHeading)).toBeInTheDocument();
    expect(screen.getByAltText(enMessages.ContentFallback.illustrationAlt)).toBeInTheDocument();
  });

  it.each([
    ['home', 'home.heading1'],
    ['about', 'about.aboutHeading1'],
    ['partners', 'events.eventHeading1'],
    ['membership', 'membership.membershipHeading1'],
    ['events', 'events.eventHeading1'],
    ['support', 'support.supportHeading1'],
  ] as const)('renders the %s fallback in Japanese', (source, headingKey) => {
    renderFallback('ja', source);

    expect(screen.getByText(getMessageValue(jaMessages.ContentFallback, headingKey))).toBeInTheDocument();
    expect(screen.getByText(jaMessages.ContentFallback.noticeHeading)).toBeInTheDocument();
    expect(screen.getByAltText(jaMessages.ContentFallback.illustrationAlt)).toBeInTheDocument();
  });

  it.each([
    ['en', enMessages.ContentFallback.loading],
    ['ja', jaMessages.ContentFallback.loading],
  ] as const)('renders the localized loading message in %s', (locale, loadingMessage) => {
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={messagesByLocale[locale]}
      >
        <ContentLoading />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(loadingMessage);
  });
});
