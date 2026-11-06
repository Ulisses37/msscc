/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MembershipForm } from '@/components/membership/MembershipForm';
import { subscribeToUpdates } from '@/services/emailService';
import en from '@/messages/en.json';
import ja from '@/messages/ja.json';

let mockLocale: 'en' | 'ja' | null = null;
jest.mock('next-intl', () => ({
  useTranslations: () => (key: keyof typeof en.MembershipPage) =>
    mockLocale === null ? key : (mockLocale === 'ja' ? ja : en).MembershipPage[key],
}));

jest.mock('@/services/emailService', () => ({ subscribeToUpdates: jest.fn() }));

beforeEach(() => {
  mockLocale = null;
  jest.mocked(subscribeToUpdates).mockReset().mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('MembershipForm address handoff', () => {
  it('requires a nonblank address and publishes the latest trimmed address', async () => {
    const user = userEvent.setup();
    const onInformationChange = jest.fn();
    const onContinueToPayment = jest.fn();
    render(
      <MembershipForm
        selectedOptionId="student"
        contributeToProcessingCosts={false}
        onContributionChange={jest.fn()}
        isQuoteReady={true}
        onValidityChange={jest.fn()}
        onInformationChange={onInformationChange}
        isInformationLocked={false}
        isPreparingPayment={false}
        isPaymentSessionReady={false}
        onContinueToPayment={onContinueToPayment}
      >
        <span>Summary</span>
      </MembershipForm>,
    );
    await user.type(screen.getByLabelText('email'), 'maya@example.test');
    await user.type(screen.getByLabelText('firstName'), 'Maya');
    await user.type(screen.getByLabelText('lastName'), 'Chen');
    const address = screen.getByLabelText('address');
    const continueButton = screen.getByRole('button', { name: 'continueToPayment' });
    expect(continueButton).toBeDisabled();
    await user.type(address, '   ');
    await user.tab();
    expect(continueButton).toBeDisabled();
    expect(onInformationChange).toHaveBeenLastCalledWith(null);
    await user.clear(address);
    await user.type(address, '  123 Main Street  ');
    await waitFor(() => expect(onInformationChange).toHaveBeenLastCalledWith({
      firstName: 'Maya', lastName: 'Chen', email: 'maya@example.test', phone: '',
      address: '123 Main Street',
    }));
    expect(continueButton).toBeEnabled();
    await user.type(address, ' Apt 2');
    await waitFor(() => expect(onInformationChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ address: '123 Main Street   Apt 2' }),
    ));
    await user.click(continueButton);
    expect(onContinueToPayment).toHaveBeenCalledTimes(1);
  });
});

describe('MembershipForm mailing-list feedback', () => {
  async function setup(locale: 'en' | 'ja' = 'en') {
    mockLocale = locale;
    const messages = (locale === 'ja' ? ja : en).MembershipPage;
    const onContinueToPayment = jest.fn();
    const props = {
      selectedOptionId: 'student' as const,
      contributeToProcessingCosts: false,
      onContributionChange: jest.fn(),
      isQuoteReady: true,
      onValidityChange: jest.fn(),
      onInformationChange: jest.fn(),
      isInformationLocked: false,
      isPreparingPayment: false,
      isPaymentSessionReady: false,
      onContinueToPayment,
      children: <span>Summary</span>,
    };
    const view = render(<MembershipForm {...props} />);
    const user = userEvent.setup();
    for (const [label, value] of [
      [messages.email, 'MAYA@example.test'],
      [messages.firstName, 'Maya'],
      [messages.lastName, 'Chen'],
      [messages.address, '123 Main Street'],
    ]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const button = screen.getByRole('button', { name: messages.continueToPayment });
    const consent = screen.getByRole('checkbox', { name: /MSSCC/ });
    return { ...view, props, user, messages, button, consent, onContinueToPayment };
  }

  it.each(['en', 'ja'] as const)('shows confirmation guidance in %s without claiming payment', async (locale) => {
    const { user, consent, button, messages, onContinueToPayment } = await setup(locale);
    expect(screen.getByText(messages.mailingListConsentDetail)).toBeInTheDocument();
    await user.click(consent);
    await user.click(button);
    expect(await screen.findByRole('status')).toHaveTextContent(messages.mailingListAccepted);
    expect(subscribeToUpdates).toHaveBeenCalledWith('maya@example.test', 'membership');
    expect(onContinueToPayment).toHaveBeenCalledTimes(1);
    await user.click(button);
    expect(subscribeToUpdates).toHaveBeenCalledTimes(1);
  });

  it('does nothing for unchecked consent, including after toggling it off', async () => {
    const { user, consent, button, onContinueToPayment } = await setup();
    await user.click(consent);
    await user.click(consent);
    await user.click(button);
    expect(subscribeToUpdates).not.toHaveBeenCalled();
    expect(onContinueToPayment).toHaveBeenCalledTimes(1);
  });

  it('deduplicates pending requests across clicks and rerenders without blocking payment', async () => {
    let resolve!: () => void;
    jest.mocked(subscribeToUpdates).mockReturnValue(new Promise<void>((done) => { resolve = done; }));
    const { user, consent, button, messages, props, rerender, onContinueToPayment } = await setup();
    await user.click(consent);
    await user.click(button);
    rerender(<MembershipForm {...props} />);
    await user.click(button);
    expect(subscribeToUpdates).toHaveBeenCalledTimes(1);
    expect(onContinueToPayment).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent(messages.mailingListPending);
    await act(async () => resolve());
  });

  it.each(['en', 'ja'] as const)('keeps payment available after a signup failure in %s', async (locale) => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.mocked(subscribeToUpdates).mockRejectedValue(new Error('private-provider-detail'));
    const { user, consent, button, messages, onContinueToPayment } = await setup(locale);
    await user.click(consent);
    await user.click(button);
    expect(await screen.findByRole('status')).toHaveTextContent(messages.mailingListFailed);
    expect(screen.queryByText(/private-provider-detail/)).not.toBeInTheDocument();
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onContinueToPayment).toHaveBeenCalledTimes(2);
  });

  it('hides feedback for a previous email address', async () => {
    const { user, consent, button, messages } = await setup();
    await user.click(consent);
    await user.click(button);
    await screen.findByRole('status');
    fireEvent.change(screen.getByLabelText(messages.email), {
      target: { value: 'other@example.test' },
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each(['en', 'ja'] as const)('requires all contact fields except phone in %s', async (locale) => {
    const { messages, button } = await setup(locale);
    expect(screen.getByText(messages.contactRequirements)).toBeVisible();
    const phone = screen.getByLabelText(messages.phoneOptional);
    expect(phone).not.toBeRequired();
    expect(phone).toHaveValue('');
    expect(button).toBeEnabled();
    for (const label of [messages.email, messages.firstName, messages.lastName, messages.address]) {
      const field = screen.getByLabelText(label);
      expect(field).toBeRequired();
      const original = (field as HTMLInputElement).value;
      fireEvent.change(field, { target: { value: '   ' } });
      fireEvent.blur(field);
      expect(button).toBeDisabled();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      fireEvent.change(field, { target: { value: original } });
      expect(button).toBeEnabled();
    }
  });
});