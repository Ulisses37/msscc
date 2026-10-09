/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

import { MembershipSummary } from '@/components/membership/MembershipSummary';
import { MEMBERSHIP_OPTIONS } from '@/constants/membershipOptions';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';

type MembershipMessages = typeof enMessages;

// Each test can switch locales without requiring a shared provider or changing
// the repository-wide Jest configuration.
let mockMessages: MembershipMessages = enMessages;

// Keep translation lookup strict: a locale render should fail immediately if
// the component requests a missing nested key or a non-string message.
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

jest.mock('next-intl', () => ({
  // MembershipSummary only needs the namespace-scoped translation function.
  useTranslations: (namespace: string) => (key: string) =>
    getMessage(mockMessages, `${namespace}.${key}`),
}));

describe('MembershipSummary', () => {
  beforeEach(() => {
    // Prevent the Japanese test's selected messages from leaking into another
    // test when Jest runs this file as part of the complete suite.
    mockMessages = enMessages;
  });

  it('displays the translated unselected state without a zero total', () => {
    render(<MembershipSummary selectedOption={null} locale="en" />);

    expect(
      screen.getByRole('region', {
        name: enMessages.MembershipPage.summaryHeading,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enMessages.MembershipPage.summaryEmpty),
    ).toBeInTheDocument();
    // No selection is not the same as a free membership. The empty state must
    // appear instead of a misleading zero-dollar total.
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('updates the translated membership and correctly formatted total', () => {
    const student = MEMBERSHIP_OPTIONS[0];
    const family = MEMBERSHIP_OPTIONS[2];
    const { rerender } = render(
      <MembershipSummary selectedOption={student} locale="en" />,
    );
    const studentPrice = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: student.currency,
    }).format(student.displayPriceInCents / 100);

    expect(
      screen.getByText(enMessages.MembershipPage.options.student),
    ).toBeInTheDocument();
    // The amount appears once on the membership line and once in the total.
    expect(screen.getAllByText(studentPrice)).toHaveLength(2);

    // Supply a new page-owned selection and confirm the summary derives its
    // content from current props rather than retaining stale internal state.
    rerender(
      <MembershipSummary selectedOption={family} locale="en" />,
    );
    const familyPrice = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: family.currency,
    }).format(family.displayPriceInCents / 100);

    expect(
      screen.queryByText(enMessages.MembershipPage.options.student),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(enMessages.MembershipPage.options.family),
    ).toBeInTheDocument();
    expect(screen.getAllByText(familyPrice)).toHaveLength(2);
  });

  it('renders Japanese labels and locale-formatted USD', () => {
    mockMessages = jaMessages;
    const corporate = MEMBERSHIP_OPTIONS[3];
    // Calculate the expectation with the same browser internationalization API
    // so the test verifies Japanese locale rules rather than a hardcoded format.
    const expectedPrice = new Intl.NumberFormat('ja', {
      style: 'currency',
      currency: corporate.currency,
    }).format(corporate.displayPriceInCents / 100);

    render(<MembershipSummary selectedOption={corporate} locale="ja" />);

    expect(
      screen.getByRole('region', {
        name: jaMessages.MembershipPage.summaryHeading,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(jaMessages.MembershipPage.options.corporate),
    ).toBeInTheDocument();
    expect(
      screen.getByText(jaMessages.MembershipPage.totalDue),
    ).toBeInTheDocument();
    expect(screen.getAllByText(expectedPrice)).toHaveLength(2);
  });
});
