/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DonationForm } from '@/components/support/DonationForm';
import {
  DEFAULT_DONATION_AMOUNT,
  DONATION_PRESET_AMOUNTS,
} from '@/constants/donationAmounts';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import { formatCurrency } from '@/utils/formatCurrency';

// Exercise the actual form and summary, while avoiding Stripe initialization;
// choice and locale assertions must not depend on external payment services.
let mockLocale: 'en' | 'ja' = 'en';
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: 'SupportPage') => (key: keyof typeof en.SupportPage) => {
    const messages = mockLocale === 'ja' ? ja : en;
    return messages[namespace][key];
  },
}));
jest.mock('@/components/support/StripePaymentElement', () => ({
  StripePaymentElement: () => null,
}));

beforeEach(() => {
  mockLocale = 'en';
  window.history.replaceState({}, '', '/en/support');
});

it('renders configured presets with the agreed initial choice and formatted review amount', () => {
  render(<DonationForm />);

  // These values are the agreed PR requirement; do not merely mirror the
  // configuration or an accidental edit to it could make this test pass.
  expect(DONATION_PRESET_AMOUNTS).toEqual(['5', '10', '25']);
  expect(DEFAULT_DONATION_AMOUNT).toBe('5');
  const group = screen.getByRole('group', { name: en.SupportPage.donationAmount });
  for (const amount of DONATION_PRESET_AMOUNTS) {
    const radio = within(group).getByRole('radio', {
      name: formatCurrency(Number(amount)),
    });
    expect(radio).toBeInTheDocument();
    expect(radio).toHaveAttribute('value', amount);
  }
  expect(within(group).getAllByRole('radio')).toHaveLength(DONATION_PRESET_AMOUNTS.length + 1);
  expect(within(group).getByRole('radio', {
    name: formatCurrency(Number(DEFAULT_DONATION_AMOUNT)),
  })).toBeChecked();
  expect(screen.getByRole('radio', { name: en.SupportPage.customDonationOption })).not.toBeChecked();
  expect(screen.queryByRole('textbox', { name: en.SupportPage.customDonationAmount })).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: en.SupportPage.summaryHeading }))
    .getByText(formatCurrency(Number(DEFAULT_DONATION_AMOUNT)))).toBeInTheDocument();
});

it('lets the donor switch presets and enter a custom amount without retaining the prior preset', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);

  const secondPreset = screen.getByRole('radio', { name: formatCurrency(10) });
  await user.click(secondPreset);
  expect(secondPreset).toBeChecked();
  expect(screen.getByRole('radio', { name: formatCurrency(5) })).not.toBeChecked();
  const summary = screen.getByRole('region', { name: en.SupportPage.summaryHeading });
  expect(within(summary).getByText(formatCurrency(10))).toBeInTheDocument();

  const custom = screen.getByRole('radio', { name: en.SupportPage.customDonationOption });
  await user.click(custom);
  expect(custom).toBeChecked();
  // Other empty summary fields also say "Not provided"; inspect the amount
  // row specifically so this check fails only for stale donation amounts.
  expect(within(summary).getByText(en.SupportPage.donationAmount).nextElementSibling)
    .toHaveTextContent(en.SupportPage.notProvided);
  const input = screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount });
  expect(input).toHaveValue('');
  await user.type(input, '12.50');
  expect(within(summary).getByText(formatCurrency(12.5))).toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: formatCurrency(25) }));
  expect(screen.queryByRole('textbox', { name: en.SupportPage.customDonationAmount })).not.toBeInTheDocument();
  expect(within(summary).getByText(formatCurrency(25))).toBeInTheDocument();
});

it('clears the default preset when custom is chosen and shows the existing amount error on blur', async () => {
  const user = userEvent.setup();
  render(<DonationForm />);

  // Fill unrelated required fields so only the donation amount can prevent
  // checkout. A lingering default preset must not satisfy custom selection.
  await user.type(screen.getByRole('textbox', { name: en.SupportPage.email }), 'donor@example.com');
  await user.type(screen.getByRole('textbox', { name: en.SupportPage.firstName }), 'Ada');
  await user.type(screen.getByRole('textbox', { name: en.SupportPage.lastName }), 'Lovelace');
  await user.type(screen.getByRole('textbox', { name: en.SupportPage.address }), '123 Main St');
  const continueButton = screen.getByRole('button', { name: en.SupportPage.continueToPayment });
  expect(continueButton).toBeEnabled();

  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  const customInput = screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount });
  expect(customInput).toHaveValue('');
  expect(continueButton).toBeDisabled();
  await user.click(screen.getByRole('radio', { name: formatCurrency(10) }));
  expect(continueButton).toBeEnabled();
  await user.click(screen.getByRole('radio', { name: en.SupportPage.customDonationOption }));
  // The existing validation is shown after leaving the custom text input,
  // not merely after leaving its radio option.
  await user.click(screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount }));
  await user.click(screen.getByRole('textbox', { name: en.SupportPage.firstName }));
  expect(screen.getByText(en.SupportPage.donationAmountError)).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: en.SupportPage.customDonationAmount }))
    .toHaveAttribute('aria-invalid', 'true');
  expect(continueButton).toBeDisabled();
});

it('supports keyboard radio navigation and shows the Japanese labels and USD prices', async () => {
  mockLocale = 'ja';
  const user = userEvent.setup();
  render(<DonationForm />);

  const first = screen.getByRole('radio', { name: formatCurrency(5, 'ja-JP') });
  first.focus();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: formatCurrency(10, 'ja-JP') })).toBeChecked();
  await user.keyboard('{ArrowRight}{ArrowRight}');
  const custom = screen.getByRole('radio', { name: ja.SupportPage.customDonationOption });
  expect(custom).toBeChecked();
  expect(screen.getByRole('textbox', { name: ja.SupportPage.customDonationAmount })).toBeInTheDocument();
});