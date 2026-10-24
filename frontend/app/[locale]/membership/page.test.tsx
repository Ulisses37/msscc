/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MembershipPage from '@/app/[locale]/membership/page';
import { MEMBERSHIP_OPTIONS, type MembershipOptionId } from '@/constants/membershipOptions';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import { createMembershipPaymentSession, getMembershipQuote, type DonationQuote } from '@/services/paymentService';
import type { MembershipPaymentSession } from '@/types/payment';

type MembershipMessages = typeof enMessages;

let mockMessages: MembershipMessages = enMessages;
let mockLocale = 'en';
const mockFetchPageContent = jest.fn(
  () => new Promise<never>(() => undefined),
);
const originalFetch = global.fetch;

// Default tests need a valid server response, not another fee formula. Use
// catalog amounts for fee-free quotes; opt-in tests supply explicit quotes.
function feeFreeQuote(optionId: MembershipOptionId): DonationQuote {
  const option = MEMBERSHIP_OPTIONS.find((candidate) => candidate.id === optionId);
  if (!option) throw new Error(`Missing membership test option: ${optionId}`);
  const amount = (option.displayPriceInCents / 100).toFixed(2);
  return { amount, processingCostContribution: '0.00', totalAmount: amount };
}

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
  getMembershipQuote: jest.fn(),
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
    jest.mocked(getMembershipQuote).mockReset();
    // Price math is tested at the backend boundary; this page test only
    // simulates the server's response and checks which quote is current.
    jest.mocked(getMembershipQuote).mockImplementation(async (option) => feeFreeQuote(option));
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
    await waitFor(() => expect(
      screen.getAllByText(enMessages.MembershipPage.options.family),
    ).toHaveLength(2));
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
    await waitFor(() => expect(continueButton).toBeEnabled());
    // Hold the session request open to check the loading state independently
    // of Stripe mounting after the response arrives.
    let finishSession!: (value: MembershipPaymentSession) => void;
    jest.mocked(createMembershipPaymentSession).mockReturnValue(
      new Promise((resolve) => {
        finishSession = resolve;
      }),
    );
    await user.click(continueButton);
    // The preview is never sent back as an amount: checkout reprices the option
    // and contribution choice on the server before creating a PaymentIntent.
    expect(createMembershipPaymentSession).toHaveBeenCalledWith({
      membershipOptionId: 'family',
      contributeToProcessingCosts: false,
      firstName: 'Maya', lastName: 'Chen', email: 'member@example.com', phone: '',
    });
    // Page-content fetches are separate from the mocked payment service.
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.preparingPayment })).toBeDisabled();
    expect(screen.queryByTestId('membership-stripe-element')).not.toBeInTheDocument();

    finishSession({ sessionId: 'pi_family', clientSecret: 'pi_secret_family', confirmationReference: `MEM-${'a'.repeat(32)}`,
      ...feeFreeQuote('family') });
    expect(await screen.findByTestId('membership-stripe-element')).toHaveTextContent('pi_secret_family');
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.paymentSessionReady })).toBeDisabled();
    expect(screen.getByLabelText(enMessages.MembershipPage.email)).toBeDisabled();
  });

  it('exposes the optional checkbox description and blocks checkout while its new quote loads', async () => {
    const user = userEvent.setup();
    render(<MembershipPage />);
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.student}`) }));
    const checkbox = screen.getByRole('checkbox', { name: enMessages.MembershipPage.processingCostContribution });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAccessibleDescription(enMessages.MembershipPage.processingCostContributionDetail);

    await user.type(screen.getByLabelText(enMessages.MembershipPage.email), 'member@example.com');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.firstName), 'Maya');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.lastName), 'Chen');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.address), '123 Main Street');
    const continueButton = screen.getByRole('button', { name: enMessages.MembershipPage.continueToPayment });
    await waitFor(() => expect(continueButton).toBeEnabled());

    let finishQuote!: (value: DonationQuote) => void;
    jest.mocked(getMembershipQuote).mockReturnValueOnce(new Promise((resolve) => { finishQuote = resolve; }));
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(getMembershipQuote).toHaveBeenLastCalledWith('student', true);
    expect(continueButton).toBeDisabled();

    await act(async () => {
      finishQuote({ amount: '20.00', processingCostContribution: '0.91', totalAmount: '20.91' });
    });
    await waitFor(() => expect(continueButton).toBeEnabled());
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(getMembershipQuote).toHaveBeenLastCalledWith('student', false);
    // A cleared checkbox must reach the checkout request as false, not just
    // look unchecked on screen after an earlier opt-in.
    await waitFor(() => expect(continueButton).toBeEnabled());
    jest.mocked(createMembershipPaymentSession).mockResolvedValue({
      sessionId: 'pi_cleared', clientSecret: 'pi_secret_cleared',
      confirmationReference: `MEM-${'a'.repeat(32)}`,
      ...feeFreeQuote('student'),
    });
    await user.click(continueButton);
    expect(createMembershipPaymentSession).toHaveBeenCalledWith(expect.objectContaining({
      membershipOptionId: 'student', contributeToProcessingCosts: false,
    }));
    expect(await screen.findByTestId('membership-stripe-element')).toBeInTheDocument();
  });

  it('waits for the new server quote before enabling checkout after opt-in', async () => {
    const user = userEvent.setup();
    let finish!: (value: DonationQuote) => void;
    jest.mocked(getMembershipQuote)
      .mockResolvedValueOnce(feeFreeQuote('student'))
      .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<MembershipPage />);
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.student}`) }));
    const summary = screen.getByRole('region', { name: enMessages.MembershipPage.summaryHeading });
    await waitFor(() => expect(within(summary).getAllByText('$20.00')).toHaveLength(2));
    const checkbox = screen.getByRole('checkbox', { name: enMessages.MembershipPage.processingCostContribution });
    await user.click(checkbox);
    // The old fee-free price must disappear immediately, before the new
    // opt-in quote returns, and checkout must not use it in the meantime.
    expect(within(summary).queryByText('$20.00')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: enMessages.MembershipPage.continueToPayment })).toBeDisabled();
    finish({ amount: '20.00', processingCostContribution: '0.91', totalAmount: '20.91' });
    expect(await within(summary).findByText('$20.91')).toBeInTheDocument();
    expect(getMembershipQuote).toHaveBeenLastCalledWith('student', true);
  });

  it('shows saved checkout amounts instead of a stale preview after session creation', async () => {
    const user = userEvent.setup();
    jest.mocked(createMembershipPaymentSession).mockResolvedValue({
      sessionId: 'pi_saved', clientSecret: 'pi_secret_saved',
      confirmationReference: `MEM-${'a'.repeat(32)}`,
      amount: '20.00', processingCostContribution: '1.00', totalAmount: '21.00',
    });
    render(<MembershipPage />);
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.student}`) }));
    const checkbox = screen.getByRole('checkbox', { name: enMessages.MembershipPage.processingCostContribution });
    jest.mocked(getMembershipQuote).mockResolvedValue({
      amount: '20.00', processingCostContribution: '0.91', totalAmount: '20.91',
    });
    await user.click(checkbox);
    const summary = screen.getByRole('region', { name: enMessages.MembershipPage.summaryHeading });
    expect(await within(summary).findByText('$20.91')).toBeInTheDocument();
    await user.type(screen.getByLabelText(enMessages.MembershipPage.email), 'member@example.com');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.firstName), 'Maya');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.lastName), 'Chen');
    await user.type(screen.getByLabelText(enMessages.MembershipPage.address), '123 Main Street');
    await user.click(screen.getByRole('button', { name: enMessages.MembershipPage.continueToPayment }));
    expect(await screen.findByTestId('membership-stripe-element')).toBeInTheDocument();
    expect(within(summary).getByText('$21.00')).toBeInTheDocument();
    expect(within(summary).queryByText('$20.91')).not.toBeInTheDocument();
    expect(checkbox).toBeDisabled();
  });

  it('ignores a late quote for the previous membership option', async () => {
    const user = userEvent.setup();
    let finishOldQuote!: (value: DonationQuote) => void;
    jest.mocked(getMembershipQuote)
      .mockReturnValueOnce(new Promise((resolve) => { finishOldQuote = resolve; }))
      .mockResolvedValueOnce(feeFreeQuote('family'));

    render(<MembershipPage />);
    const summary = screen.getByRole('region', { name: enMessages.MembershipPage.summaryHeading });
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.student}`) }));
    // The second selection returns first; it becomes the only eligible quote.
    await user.click(screen.getByRole('radio', { name: new RegExp(`^${enMessages.MembershipPage.options.family}`) }));
    const familyAmount = new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' })
      .format(Number(feeFreeQuote('family').amount));
    await waitFor(() => expect(within(summary).getAllByText(familyAmount)).toHaveLength(2));

    await act(async () => { finishOldQuote(feeFreeQuote('student')); });
    // Even after the old response resolves, neither its option nor its amount
    // may replace the current summary or authorize a stale checkout.
    await waitFor(() => expect(within(summary).getAllByText(familyAmount)).toHaveLength(2));
    expect(within(summary).queryByText(enMessages.MembershipPage.options.student)).not.toBeInTheDocument();
    expect(getMembershipQuote).toHaveBeenNthCalledWith(1, 'student', false);
    expect(getMembershipQuote).toHaveBeenNthCalledWith(2, 'family', false);
  });

  it('ignores an old session after selection changes', async () => {
    const user = userEvent.setup();
    // A late response for the old selection must never mount Elements with
    // a client secret for a different membership price.
    let finishSession!: (value: MembershipPaymentSession) => void;
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

    finishSession({ sessionId: 'pi_old_student', clientSecret: 'pi_secret_old', confirmationReference: `MEM-${'a'.repeat(32)}`,
      ...feeFreeQuote('student') });
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