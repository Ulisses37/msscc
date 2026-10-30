/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BoardOfDirectors from './page';

const originalFetch = global.fetch;

describe('BoardOfDirectors officer creation', () => {
  beforeEach(() => {
    // The page loads board members and media together before rendering its dynamic grids.
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) as jest.MockedFunction<
      typeof fetch
    >;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('opens the existing officer editor with a blank unsaved record', async () => {
    const user = userEvent.setup();

    render(<BoardOfDirectors />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Add officer' }));

    expect(screen.getByLabelText('Name (English)')).toHaveValue('');
    expect(screen.getByLabelText('Role (English)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });
});