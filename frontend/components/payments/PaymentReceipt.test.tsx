/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';

import { PaymentReceipt } from '@/components/payments/PaymentReceipt';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';
import { getPaymentReceipt, type PaymentReceipt as Receipt } from '@/services/paymentService';

jest.mock('@/services/paymentService', () => ({ getPaymentReceipt: jest.fn() }));
// Exercise the real translation keys for both languages without a provider;
// only the HTTP boundary is mocked in these component-level tests.
jest.mock('next-intl', () => ({
  useTranslations: (namespace: 'PaymentReceipt' | 'MembershipPage.options') =>
    (key: string) => {
      const messages = selectedLocale === 'ja' ? ja : en;
      return namespace === 'PaymentReceipt'
        ? messages.PaymentReceipt[key as keyof typeof en.PaymentReceipt]
        : messages.MembershipPage.options[key as keyof typeof en.MembershipPage.options];
    },
}));

let selectedLocale: 'en' | 'ja' = 'en';
const donationReference = 'DON-00000042';
const membershipReference = `MEM-${'a'.repeat(32)}`;
const donation: Receipt = {
  paymentPurpose: 'donation', amount: '12.50', currency: 'usd',
  completedAt: '2026-10-10T15:30:00Z', confirmationReference: donationReference,
};

beforeEach(() => {
  selectedLocale = 'en';
  jest.mocked(getPaymentReceipt).mockReset();
});

it('shows a loading state then only safe donation fields, and an optional purpose', async () => {
  let finish!: (receipt: Receipt) => void;
  jest.mocked(getPaymentReceipt).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  render(<PaymentReceipt reference={donationReference} locale="en" />);
  expect(screen.getByRole('status')).toHaveTextContent(en.PaymentReceipt.loading);
  await act(async () => finish({ ...donation, amount: '13.18', baseAmount: '12.50',
    processingCostContribution: '0.68', totalAmount: '13.18', donationPurpose: 'Community programs' }));
  expect(screen.getByText('$12.50')).toBeInTheDocument();
  expect(screen.getByText('$0.68')).toBeInTheDocument();
  expect(screen.getByText('$13.18')).toBeInTheDocument();
  expect(screen.getByText('October 10, 2026')).toBeInTheDocument();
  expect(screen.getByText(donationReference)).toBeInTheDocument();
  expect(screen.getByText('Community programs')).toBeInTheDocument();
  expect(screen.queryByText('pi_private')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('formats the membership option, currency, and date in Japanese', async () => {
  selectedLocale = 'ja';
  jest.mocked(getPaymentReceipt).mockResolvedValue({
    ...donation, paymentPurpose: 'membership', confirmationReference: membershipReference,
    membershipOption: 'family',
  });
  render(<PaymentReceipt reference={membershipReference} locale="ja" />);
  expect(await screen.findByText(ja.MembershipPage.options.family)).toBeInTheDocument();
  expect(screen.getByText(new Intl.NumberFormat('ja', { style: 'currency', currency: 'USD' }).format(12.5))).toBeInTheDocument();
  expect(screen.getByText(new Intl.DateTimeFormat('ja', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(donation.completedAt)))).toBeInTheDocument();
  expect(screen.queryByText(ja.PaymentReceipt.donationPurpose)).not.toBeInTheDocument();
});

it('shows a completed membership’s saved processing contribution', async () => {
  jest.mocked(getPaymentReceipt).mockResolvedValue({
    ...donation, paymentPurpose: 'membership', confirmationReference: membershipReference,
    membershipOption: 'student', amount: '20.91', baseAmount: '20.00',
    processingCostContribution: '0.91', totalAmount: '20.91',
  });
  render(<PaymentReceipt reference={membershipReference} locale="en" />);
  expect(await screen.findByText('$20.91')).toBeInTheDocument();
  expect(screen.getByText('$20.00')).toBeInTheDocument();
  expect(screen.getByText('$0.91')).toBeInTheDocument();
});

it('shows a safe message when receipt data is unavailable', async () => {
  jest.mocked(getPaymentReceipt).mockRejectedValue(new Error('pi_secret_private'));
  render(<PaymentReceipt reference={donationReference} locale="en" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(en.PaymentReceipt.unavailable);
  expect(screen.queryByText('pi_secret_private')).not.toBeInTheDocument();
});

it('ignores a late response after the reference changes', async () => {
  // The first request completes last; it must not overwrite the new receipt.
  let finish!: (receipt: Receipt) => void;
  jest.mocked(getPaymentReceipt)
    .mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }))
    .mockResolvedValueOnce({ ...donation, confirmationReference: 'DON-00000043' });
  const view = render(<PaymentReceipt reference={donationReference} locale="en" />);
  view.rerender(<PaymentReceipt reference="DON-00000043" locale="en" />);
  await act(async () => finish(donation));
  expect(await screen.findByText('DON-00000043')).toBeInTheDocument();
  expect(screen.queryByText(donationReference)).not.toBeInTheDocument();
});