/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CreatePartnerProp, EditPartnerProp } from './partnersComponents';
import type { PartnerProp } from './partnersComponents';

jest.mock('@/components/ui/ImportImage', () => ({
  ImportImage: () => <div />,
}));

jest.mock('@/components/ui/PostImage', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: () => <div />,
}));

const PARTNER: PartnerProp = {
  PartnerID: 7,
  Name: 'MSSCC',
  NameJP: '',
  Category: 'partner',
  CategoryJP: 'パートナー',
  MediaAsset: null,
  MediaVisible: true,
  ContributionAmount: 0,
  Website: 'msscc.org',
  isVisible: true,
  DisplayOrder: 1,
};

describe('partner popup validation', () => {
  it('requires a partner English name and valid website before enabling Add', async () => {
    const user = userEvent.setup();

    render(
      <CreatePartnerProp
        PType="partner"
        onChange={jest.fn()}
        InitialDisplayOrder={1}
        UsedDisplayOrders={[]}
      />,
    );

    const addButton = screen.getByRole('button', { name: 'Add' });
    const nameInput = screen.getByLabelText('Name (English)');
    const websiteInput = screen.getByLabelText('Website');

    expect(addButton).toBeDisabled();

    await user.click(nameInput);
    await user.tab();
    expect(nameInput).toHaveAccessibleDescription('Name (English) is required.');

    await user.type(nameInput, 'MSSCC');
    await user.type(websiteInput, 'www');
    await user.tab();

    expect(websiteInput)
      .toHaveAccessibleDescription('Enter a valid website URL with a domain and top-level domain.');
    expect(addButton).toBeDisabled();

    await user.clear(websiteInput);
    await user.type(websiteInput, 'msscc.org');

    expect(websiteInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(addButton).toBeEnabled();
  });

  it('allows a donor without a website after the English name is supplied', async () => {
    const user = userEvent.setup();

    render(
      <CreatePartnerProp
        PType="donor"
        onChange={jest.fn()}
        InitialDisplayOrder={1}
        UsedDisplayOrders={[]}
      />,
    );

    const addButton = screen.getByRole('button', { name: 'Add' });

    await user.type(screen.getByLabelText('Name (English)'), 'Donor Name');

    expect(addButton).toBeEnabled();
  });

  it('disables Save and displays an inline error after an English name is cleared', async () => {
    const user = userEvent.setup();

    render(
      <EditPartnerProp
        partner={PARTNER}
        onChange={jest.fn()}
        UsedDisplayOrders={[1]}
      />,
    );

    const saveButton = screen.getByRole('button', { name: 'Save' });
    const nameInput = screen.getByLabelText('Name (English)');

    expect(saveButton).toBeEnabled();

    await user.clear(nameInput);
    await user.tab();

    expect(nameInput).toHaveAccessibleDescription('Name (English) is required.');
    expect(saveButton).toBeDisabled();
  });

  it('shows a website error and disables Save when an edited partner URL is incomplete', async () => {
    const user = userEvent.setup();

    render(
      <EditPartnerProp
        partner={PARTNER}
        onChange={jest.fn()}
        UsedDisplayOrders={[1]}
      />,
    );

    const saveButton = screen.getByRole('button', { name: 'Save' });
    const websiteInput = screen.getByLabelText('Website URL');

    await user.clear(websiteInput);
    await user.type(websiteInput, 'www');
    await user.tab();

    expect(websiteInput)
      .toHaveAccessibleDescription('Enter a valid website URL with a domain and top-level domain.');
    expect(saveButton).toBeDisabled();
  });
});