/** @jest-environment jsdom */
import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';

import { MembershipPaymentResult } from '@/components/membership/MembershipPaymentResult';
import enMessages from '@/messages/en.json';
import { getMembershipPaymentStatus } from '@/services/paymentService';

const reference = `MEM-${'a'.repeat(32)}`;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof enMessages.MembershipPaymentResult) => enMessages.MembershipPaymentResult[key],
}));
jest.mock('@/services/paymentService', () => ({ getMembershipPaymentStatus: jest.fn() }));

describe('MembershipPaymentResult basic flow', () => {
  beforeEach(() => jest.mocked(getMembershipPaymentStatus).mockReset());

  it('shows loading, then the database-confirmed result without a new payment option', async () => {
    // Keep the first status request unresolved to observe the initial state;
    // returning "complete" must not offer another payment attempt.
    let finish!: (status: 'complete') => void;
    jest.mocked(getMembershipPaymentStatus).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    expect(screen.getByText(enMessages.MembershipPaymentResult.loading)).toBeInTheDocument();
    finish('complete');
    expect(await screen.findByText(enMessages.MembershipPaymentResult.complete)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(getMembershipPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it.each(['failed', 'canceled'] as const)('offers a fresh form for %s only after status is confirmed', async (status) => {
    jest.mocked(getMembershipPaymentStatus).mockResolvedValue(status);
    render(<MembershipPaymentResult locale="en" confirmationReference={reference} />);
    expect(await screen.findByText(enMessages.MembershipPaymentResult[status])).toBeInTheDocument();
    expect(screen.getByRole('link', { name: enMessages.MembershipPaymentResult.returnToPayment })).toHaveAttribute('href', '/en/membership');
  });

  it('never requests status for a malformed reference', async () => {
    render(<MembershipPaymentResult locale="en" confirmationReference="pi_secret" />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(enMessages.MembershipPaymentResult.statusError));
    expect(getMembershipPaymentStatus).not.toHaveBeenCalled();
  });
});