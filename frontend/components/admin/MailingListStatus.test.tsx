/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';

import { fetchSubscriptionStatus } from '@/services/subscriptionStatusService';

import { MailingListStatus } from './MailingListStatus';
import type { SubscriptionStatus } from '@/types/subscriptionStatus';

jest.mock('@/services/subscriptionStatusService', () => ({ fetchSubscriptionStatus: jest.fn() }));

describe('MailingListStatus', () => {
  beforeEach(() => jest.mocked(fetchSubscriptionStatus).mockReset());

  it.each<[SubscriptionStatus, string]>([
    ['subscribed', 'Subscribed (confirmed)'], ['pending', 'Confirmation pending'],
    ['unsubscribed', 'Unsubscribed'], ['not_recorded', 'No recorded subscription'],
    ['email_unavailable', 'Email unavailable'],
  ])('displays %s distinctly', async (status, label) => {
    jest.mocked(fetchSubscriptionStatus).mockResolvedValue(status);
    render(<MailingListStatus resource="donations" recordId={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading status…');
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows lookup failure without implying an unsubscribe or missing consent', async () => {
    jest.mocked(fetchSubscriptionStatus).mockRejectedValue(new Error('failed'));
    render(<MailingListStatus resource="memberships" recordId={1} />);
    expect(await screen.findByText('Status unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Unsubscribed')).not.toBeInTheDocument();
    expect(screen.queryByText('No recorded subscription')).not.toBeInTheDocument();
  });

  it('fetches current status again when details reopen', async () => {
    jest.mocked(fetchSubscriptionStatus).mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('subscribed');
    const first = render(<MailingListStatus resource="memberships" recordId={1} />);
    await screen.findByText('Confirmation pending');
    first.unmount();
    render(<MailingListStatus resource="memberships" recordId={1} />);
    await screen.findByText('Subscribed (confirmed)');
    expect(fetchSubscriptionStatus).toHaveBeenCalledTimes(2);
  });

  it('aborts stale requests and never shows another record status', async () => {
    let resolveOld: (status: SubscriptionStatus) => void = () => {};
    jest.mocked(fetchSubscriptionStatus).mockImplementationOnce(() => new Promise((resolve) => {
      resolveOld = resolve;
    })).mockResolvedValueOnce('pending');
    const view = render(<MailingListStatus resource="donations" recordId={1} />);
    const signal = jest.mocked(fetchSubscriptionStatus).mock.calls[0][2];
    view.rerender(<MailingListStatus resource="donations" recordId={2} />);
    await screen.findByText('Confirmation pending');
    await act(async () => resolveOld('subscribed'));
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('Confirmation pending');
    view.unmount();
    expect(jest.mocked(fetchSubscriptionStatus).mock.calls[1][2].aborted).toBe(true);
  });
});