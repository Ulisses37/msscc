/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MembershipPage from '@/app/[locale]/membership/page';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';

type MembershipMessages = typeof enMessages;

let mockMessages: MembershipMessages = enMessages;
let mockLocale = 'en';
const mockFetchPageContent = jest.fn(
  () => new Promise<never>(() => undefined),
);
const originalFetch = global.fetch;

function getMessage(messages: unknown, path: string): string {
  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, messages);

  if (typeof value !== 'string') {
    throw new Error(`Missing translation message: ${path}`);
  }

  return value;
}

function messageShape(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return typeof value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, messageShape(child)]),
  );
}

jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    getMessage(mockMessages, `${namespace}.${key}`),
}));

jest.mock('next/navigation', () => ({
  // App Router normally supplies this dynamic locale segment.
  useParams: () => ({ locale: mockLocale }),
}));

jest.mock('@/hooks/usePreviewBlocks', () => ({
  usePreviewBlocks: () => ({ current: false }),
}));

jest.mock('@/utils/content', () => ({
  // Staff-editable CMS content is unrelated to the membership review flow.
  getCachedPageContent: () => [],
  fetchPageContent: () => mockFetchPageContent(),
}));

jest.mock('@/components/content/ContentBlockRenderer', () => ({
  ContentBlockRenderer: () => null,
}));

jest.mock('@/components/content/ContentFallBack', () => ({
  FallBack: () => null,
}));

describe('MembershipPage review flow', () => {
  beforeEach(() => {
    mockLocale = 'en';
    mockMessages = enMessages;
    mockFetchPageContent.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shares selection state with the summary and enables continue after valid information', async () => {
    const user = userEvent.setup();
    render(<MembershipPage />);
    const continueButton = screen.getByRole('button', {
      name: enMessages.MembershipPage.continueToPayment,
    });

    expect(
      screen.getByText(enMessages.MembershipPage.summaryEmpty),
    ).toBeInTheDocument();
    expect(continueButton).toBeDisabled();

    await user.click(
      screen.getByRole('radio', {
        name: new RegExp(`^${enMessages.MembershipPage.options.family}`),
      }),
    );
    expect(
      screen.getAllByText(enMessages.MembershipPage.options.family),
    ).toHaveLength(2);
    expect(continueButton).toBeDisabled();

    await user.type(
      screen.getByLabelText(enMessages.MembershipPage.email),
      'member@example.com',
    );
    await user.type(
      screen.getByLabelText(enMessages.MembershipPage.firstName),
      'Maya',
    );
    await user.type(
      screen.getByLabelText(enMessages.MembershipPage.lastName),
      'Chen',
    );
    await user.type(
      screen.getByLabelText(enMessages.MembershipPage.address),
      '123 Main Street',
    );

    expect(
      screen.getByLabelText(enMessages.MembershipPage.phoneOptional),
    ).toHaveValue('');
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps continue disabled until invalid information is corrected', async () => {
    const user = userEvent.setup();
    render(<MembershipPage />);

    await user.click(
      screen.getByRole('radio', {
        name: new RegExp(`^${enMessages.MembershipPage.options.student}`),
      }),
    );
    const email = screen.getByLabelText(enMessages.MembershipPage.email);
    await user.type(email, 'invalid');
    await user.tab();
    await user.type(
      screen.getByLabelText(enMessages.MembershipPage.firstName),
      'Maya',
    );
    await user.type(
      screen.getByLabelText(enMessages.MembershipPage.lastName),
      'Chen',
    );
    await user.type(
      screen.getByLabelText(enMessages.MembershipPage.address),
      '123 Main Street',
    );
    const continueButton = screen.getByRole('button', {
      name: enMessages.MembershipPage.continueToPayment,
    });

    expect(continueButton).toBeDisabled();
    expect(screen.getByText(enMessages.MembershipPage.emailError)).toBeInTheDocument();

    await user.clear(email);
    await user.type(email, 'member@example.com');
    await waitFor(() => expect(continueButton).toBeEnabled());
    expect(
      screen.queryByText(enMessages.MembershipPage.emailError),
    ).not.toBeInTheDocument();
  });

  it('keeps matching locale keys and renders the Japanese review flow', () => {
    expect(messageShape(jaMessages.MembershipPage)).toEqual(
      messageShape(enMessages.MembershipPage),
    );

    mockLocale = 'ja';
    mockMessages = jaMessages;
    render(<MembershipPage />);

    expect(
      screen.getByRole('group', {
        name: jaMessages.MembershipPage.optionsHeading,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(jaMessages.MembershipPage.summaryEmpty),
    ).toBeInTheDocument();
  });
});