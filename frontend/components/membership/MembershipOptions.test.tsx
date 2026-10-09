/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MembershipOptions } from '@/components/membership/MembershipOptions';
import {
  MEMBERSHIP_OPTIONS,
  type MembershipOptionId,
} from '@/constants/membershipOptions';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';

type MembershipMessages = typeof enMessages;

// Tests switch this reference to exercise both locales while keeping the mock
// local to this feature instead of expanding global Jest infrastructure.
let mockMessages: MembershipMessages = enMessages;

// Resolve next-intl-style nested paths and fail loudly when a component asks
// for a missing key, so a locale test cannot pass with incomplete messages.
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
  // Throwing for unknown paths makes both locale renders fail on missing keys.
  useTranslations: (namespace: string) => (key: string) =>
    getMessage(mockMessages, `${namespace}.${key}`),
}));

function ControlledOptions({ locale = 'en' }: { locale?: 'en' | 'ja' }) {
  // Mirror MembershipPage's contract: the options report an ID, while their
  // parent owns the selected value and sends it back as a controlled prop.
  const [selectedOptionId, setSelectedOptionId] =
    useState<MembershipOptionId | null>(null);

  return (
    <MembershipOptions
      locale={locale}
      selectedOptionId={selectedOptionId}
      onOptionChange={setSelectedOptionId}
    />
  );
}

describe('MembershipOptions', () => {
  beforeEach(() => {
    mockMessages = enMessages;
  });

  it('displays every translated membership option and price', () => {
    render(
      <MembershipOptions
        locale="en"
        selectedOptionId={null}
        onOptionChange={jest.fn()}
      />,
    );

    for (const option of MEMBERSHIP_OPTIONS) {
      const label = enMessages.MembershipPage.options[option.id];
      const price = new Intl.NumberFormat('en', {
        style: 'currency',
        currency: option.currency,
      }).format(option.displayPriceInCents / 100);

      // The wrapping label contains both name and price, so the radio's full
      // accessible name starts with the translated membership name.
      expect(
        screen.getByRole('radio', { name: new RegExp(`^${label}`) }),
      ).toBeInTheDocument();
      expect(screen.getByText(price)).toBeInTheDocument();
    }
  });

  it('reports the selected option and reflects controlled page state', async () => {
    const user = userEvent.setup();
    render(<ControlledOptions />);
    const studentOption = screen.getByRole('radio', {
      name: new RegExp(`^${enMessages.MembershipPage.options.student}`),
    });

    expect(studentOption).not.toBeChecked();
    await user.click(studentOption);
    expect(studentOption).toBeChecked();
  });

  it('shows and clears the required selection error accessibly', async () => {
    const user = userEvent.setup();
    const onOptionChange = jest.fn();
    const { rerender } = render(
      <>
        <MembershipOptions
          locale="en"
          selectedOptionId={null}
          onOptionChange={onOptionChange}
        />
        <button type="button">Outside control</button>
      </>,
    );
    const option = screen.getByRole('radio', {
      name: new RegExp(`^${enMessages.MembershipPage.options.student}`),
    });
    // Leave the entire fieldset. Moving focus between radios inside the group
    // must not mark the required membership selection as touched.
    option.focus();
    await user.click(screen.getByRole('button', { name: 'Outside control' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      enMessages.MembershipPage.membershipRequired,
    );
    expect(option.closest('fieldset')).toHaveAttribute('aria-invalid', 'true');

    // Simulate the parent accepting a valid controlled selection. Validation
    // output should clear based on the updated prop without local selection.
    rerender(
      <>
        <MembershipOptions
          locale="en"
          selectedOptionId="student"
          onOptionChange={onOptionChange}
        />
        <button type="button">Outside control</button>
      </>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(option.closest('fieldset')).toHaveAttribute('aria-invalid', 'false');
  });

  it('loads Japanese membership messages without missing-message errors', () => {
    mockMessages = jaMessages;

    render(
      <MembershipOptions
        locale="ja"
        selectedOptionId={null}
        onOptionChange={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('group', {
        name: jaMessages.MembershipPage.optionsHeading,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', {
        name: new RegExp(`^${jaMessages.MembershipPage.options.student}`),
      }),
    ).toBeInTheDocument();
    // Every language must provide the same stable membership option IDs.
    expect(Object.keys(jaMessages.MembershipPage.options).sort()).toEqual(
      Object.keys(enMessages.MembershipPage.options).sort(),
    );
  });
});
