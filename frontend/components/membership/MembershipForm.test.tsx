/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MembershipForm } from '@/components/membership/MembershipForm';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/services/emailService', () => ({ subscribeToUpdates: jest.fn() }));

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