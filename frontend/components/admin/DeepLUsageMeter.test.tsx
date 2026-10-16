/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';

import { DeepLUsageMeter } from '@/components/admin/DeepLUsageMeter';

const originalFetch = global.fetch;

describe('DeepLUsageMeter', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('shows loading before rendering provider usage and limits', async () => {
    // Keep the promise pending long enough to verify the initial dashboard state.
    let resolveResponse: ((response: Response) => void) | undefined;
    jest.mocked(global.fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );

    render(<DeepLUsageMeter />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading DeepL usage...');

    resolveResponse?.({
      ok: true,
      json: async () => ({
        characterCount: 400_000,
        characterLimit: 500_000,
        remainingCharacters: 100_000,
        usagePercentage: 80,
      }),
    } as Response);

    await waitFor(() => {
      expect(screen.getByText('400,000 / 500,000 characters')).toBeInTheDocument();
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByText('100,000 left')).toBeInTheDocument();
  });

  it('hides the meter and shows an error when usage is unavailable', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: false, status: 502 } as Response);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    render(<DeepLUsageMeter />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'DeepL usage is currently unavailable.',
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});