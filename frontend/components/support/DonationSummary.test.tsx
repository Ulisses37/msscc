/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';

import { DonationSummary } from '@/components/support/DonationSummary';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import { formatCurrency } from '@/utils/formatCurrency';

let mockLocale: 'en' | 'ja' = 'en';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  // Fail on missing translations rather than silently accepting incomplete
  // language files in a test that checks the donor-facing review amount.
  useTranslations: (namespace: 'SupportPage') => (key: keyof typeof en.SupportPage) => {
    const value = (mockLocale === 'ja' ? ja : en)[namespace][key];
    if (typeof value !== 'string') throw new Error(`Missing ${namespace}.${key}`);
    return value;
  },
}));

function summary(amount: string) {
  return <DonationSummary
    donation={amount}
    email="donor@example.com"
    firstName="Ada"
    lastName="Lovelace"
    address="123 Main St"
    isAnonymous={false}
    message=""
  />;
}

function amountRow(messages: typeof en.SupportPage) {
  // Several other rows can show "Not provided". Isolate the amount row to
  // ensure a missing or invalid donation cannot look like a payable total.
  const region = screen.getByRole('region', { name: messages.summaryHeading });
  return within(region).getByText(messages.donationAmount).nextElementSibling;
}

beforeEach(() => { mockLocale = 'en'; });

it('shows an unselected amount without implying a zero-dollar donation', () => {
  render(summary(''));
  expect(amountRow(en.SupportPage)).toHaveTextContent(en.SupportPage.notProvided);
  expect(amountRow(en.SupportPage)).not.toHaveTextContent(formatCurrency(0));
});

it('derives the displayed amount from the latest prop for preset and custom values', () => {
  const { rerender } = render(summary('5'));
  expect(amountRow(en.SupportPage)).toHaveTextContent(formatCurrency(5));

  rerender(summary('25'));
  expect(amountRow(en.SupportPage)).toHaveTextContent(formatCurrency(25));
  expect(amountRow(en.SupportPage)).not.toHaveTextContent(formatCurrency(5));

  rerender(summary('12.50'));
  expect(amountRow(en.SupportPage)).toHaveTextContent(formatCurrency(12.5));
  rerender(summary(''));
  expect(amountRow(en.SupportPage)).toHaveTextContent(en.SupportPage.notProvided);
});

it.each(['0', '-1', 'abc', '1.234', '100000000'])(
  'does not show an invalid custom amount %s as payable', (amount) => {
    render(summary(amount));
    expect(amountRow(en.SupportPage)).toHaveTextContent(en.SupportPage.invalidAmount);
  },
);

it('uses Japanese messages and locale-formatted USD for valid and invalid amounts', () => {
  mockLocale = 'ja';
  const { rerender } = render(summary('12.50'));
  expect(amountRow(ja.SupportPage)).toHaveTextContent(formatCurrency(12.5, 'ja-JP'));
  rerender(summary('0'));
  expect(amountRow(ja.SupportPage)).toHaveTextContent(ja.SupportPage.invalidAmount);
  rerender(summary(''));
  expect(amountRow(ja.SupportPage)).toHaveTextContent(ja.SupportPage.notProvided);
});

it.each(['en', 'ja'] as const)('shows the server-quoted breakdown in %s', (language) => {
  mockLocale = language;
  const messages = (language === 'ja' ? ja : en).SupportPage;
  const view = render(<DonationSummary
    donation="12.50"
    quote={{ amount: '12.50', processingCostContribution: '0.68', totalAmount: '13.18' }}
    email="donor@example.com" firstName="Ada" lastName="Lovelace"
    address="123 Main St" isAnonymous={false} message=""
  />);
  expect(screen.getByRole('region', { name: messages.costBreakdown })).toHaveTextContent(
    formatCurrency(13.18, language === 'ja' ? 'ja-JP' : 'en-US'),
  );
  expect(screen.getByText(messages.processingCostAmount)).toBeInTheDocument();
  view.unmount();
});

it.each(['en', 'ja'] as const)(
  'previews anonymous record details in %s and restores personal details when cleared', (language) => {
    mockLocale = language;
    const messages = (language === 'ja' ? ja : en).SupportPage;
    const details = (isAnonymous: boolean) => <DonationSummary
      donation="5" email="donor@example.com" firstName="Ada" lastName="Lovelace"
      address="123 Main St" isAnonymous={isAnonymous} message=""
    />;
    const { rerender } = render(details(false));
    const region = screen.getByRole('region', { name: messages.summaryHeading });
    // Isolate rows: a localized placeholder or the checkbox label may appear
    // elsewhere, but each donor detail must change with the privacy choice.
    const valueFor = (label: string) => within(region).getByText(label).nextElementSibling;
    expect(valueFor(messages.name)).toHaveTextContent('Ada Lovelace');
    expect(valueFor(messages.address)).toHaveTextContent('123 Main St');
    expect(valueFor(messages.anonymousDonation)).toHaveTextContent(messages.no);

    rerender(details(true));
    expect(valueFor(messages.name)).toHaveTextContent(messages.anonymousName);
    expect(valueFor(messages.name)).not.toHaveTextContent('Ada');
    expect(valueFor(messages.address)).toHaveTextContent(messages.addressOmitted);
    expect(valueFor(messages.address)).not.toHaveTextContent('123 Main St');
    expect(valueFor(messages.email)).toHaveTextContent('donor@example.com');
    expect(valueFor(messages.anonymousDonation)).toHaveTextContent(messages.yes);

    rerender(details(false));
    expect(valueFor(messages.name)).toHaveTextContent('Ada Lovelace');
    expect(valueFor(messages.address)).toHaveTextContent('123 Main St');
    expect(valueFor(messages.anonymousDonation)).toHaveTextContent(messages.no);
  },
);