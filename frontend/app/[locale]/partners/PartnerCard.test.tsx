/** @jest-environment jsdom */

import '@testing-library/jest-dom';

import { render, screen } from '@testing-library/react';

import { PartnerCard } from './PartnerCard';

describe('PartnerCard', () => {
  it('keeps the logo dimensions and direct storage URL', () => {
    const imageUrl = 'https://example.test/logo.png?signature=test';
    const { container } = render(
      <PartnerCard name="Partner" imageUrl={imageUrl} visitWebsiteLabel="Visit website" />,
    );

    const logo = container.querySelector('img');
    expect(logo).toHaveAttribute('src', imageUrl);
    expect(logo).toHaveAttribute('width', '32');
    expect(logo).toHaveAttribute('height', '32');
    expect(logo).toHaveAttribute('aria-hidden', 'true');
    expect(logo).toHaveClass('object-contain');
    expect(screen.getByText('Partner')).toBeInTheDocument();
  });

  it('renders without a logo when no image URL is available', () => {
    const { container } = render(
      <PartnerCard name="Partner" visitWebsiteLabel="Visit website" />,
    );

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('Partner')).toBeInTheDocument();
  });
});