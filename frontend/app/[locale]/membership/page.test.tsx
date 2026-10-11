/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MembershipPage from '@/app/[locale]/membership/page';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import { createMembershipPaymentSession } from '@/services/paymentService';

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
  useMessages: () => mockMessages,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
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

jest.mock('@/services/paymentService', () => ({
  createMembershipPaymentSession: jest.fn(),
}));

// Stripe itself is exercised by the component tests. This stub exposes only
// the page's session handoff and never receives or simulates card information.
jest.mock('@/components/membership/MembershipPaymentElement', () => ({
  MembershipPaymentElement: ({ clientSecret }: { clientSecret: string }) => (
    <div data-testid="membership-stripe-element">{clientSecret}</div>
  ),
}));

describe('MembershipPage review flow', () => {
  beforeEach(() => {
    mockLocale = 'en';
    mockMessages = enMessages;
    mockFetchPageContent.mockClear();
    jest.mocked(createMembershipPaymentSession).mockReset();
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
    // Hold the session request open to check the loading state independently
    // of Stripe mounting after the response arrives.
    let finishSession!: (value: { sessionId: string; clientSecret: string }) => void;
    jest.mocked(createMembershipPaymentSession).mockReturnValue(
      new Promise((resolve) => {
        finishSession = resolve;
      }),
    );
    await user.click(continueButton);
    expect(createMembershipPaymentSession).toHaveBeenCalledWith({
      membershipOptionId: 'family',
      firstName: 'Maya', lastName: 'Chen', email: 'member@example.com', phone: '',
    });
    // Page-content fetches are separate from the mocked payment service.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.preparingPayment })).toBeDisabled();
    expect(screen.queryByTestId('membership-stripe-element')).not.toBeInTheDocument();

    finishSession({ sessionId: 'pi_family', clientSecret: 'pi_secret_family' });
    expect(await screen.findByTestId('membership-stripe-element')).toHaveTextContent('pi_secret_family');
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.paymentSessionReady })).toBeDisabled();
    expect(screen.getByLabelText(enMessages.MembershipPage.email)).toBeDisabled();
  });

  it('ignores an old session after selection changes', async () => {
    const user = userEvent.setup();
    // A late response for the old selection must never mount Elements with
    // a client secret for a different membership price.
    let finishSession!: (value: { sessionId: string; clientSecret: string }) => void;
    jest.mocked(createMembershipPaymentSession).mockReturnValue(
      new Promise((resolve) => {
        finishSession = resolve;
      }),
    );
    render(<MembershipPage />);
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.student}`) }));
    await user.type(screen.getByLabelText(enMessages.MembershipPage.email), 'member@example.com');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.firstName), 'Maya');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.lastName), 'Chen');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.address), '123 Main Street');
    await user.click(screen.getByRole('button', { name: enMessages.MembershipPage.continueToPayment }));
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.family}`) }));

    finishSession({ sessionId: 'pi_old_student', clientSecret: 'pi_secret_old' });
    await waitFor(() => expect(screen.getByRole('button', { name: enMessages.MembershipPage.continueToPayment })).toBeEnabled());
    expect(screen.queryByTestId('membership-stripe-element')).not.toBeInTheDocument();
  });

  it('shows a translated safe error and allows retry when a session fails', async () => {
    const user = userEvent.setup();
    // This sentinel stands in for sensitive upstream text, which must stay
    // out of the rendered error while leaving the visitor able to retry.
    jest.mocked(createMembershipPaymentSession).mockRejectedValue(new Error('private-stripe-detail'));
    render(<MembershipPage />);
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.student}`) }));
    await user.type(screen.getByLabelText(enMessages.MembershipPage.email), 'member@example.com');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.firstName), 'Maya');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.lastName), 'Chen');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.address), '123 Main Street');
    await user.click(screen.getByRole('button', { name: enMessages.MembershipPage.continueToPayment }));

    expect(await screen.findByRole('alert')).toHaveTextContent(enMessages.MembershipPage.paymentSessionError);
    expect(screen.queryByText(/private-stripe-detail/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.continueToPayment })).toBeEnabled();
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