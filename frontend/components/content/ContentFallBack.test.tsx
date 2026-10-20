/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import { FallBack } from '@/components/content/ContentFallBack';

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
});
