import {
  createManualDonation, fetchSavedDonation, ManualDonationSaveError,
} from './manualDonation';

import type { ManualDonationInput } from '@/types/manualDonation';

const originalFetch = global.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const input: ManualDonationInput = {
  donorFirstName: 'Maya', donorLastName: 'Donor', donorEmail: 'donor@example.test',
  address: 'Historical address', amount: '35.00', currency: 'usd', donationDate: '1990-01-02',
  paymentMethod: 'check', isAnonymous: false, externalReference: 'Ledger 42', message: '',
};

describe('manual donation service boundaries', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, value: { getItem: jest.fn().mockReturnValue('test-admin-token') },
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true, status: 201, json: async () => ({ donation_id: 42 }),
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
    jest.restoreAllMocks();
  });

  it('sends only allowlisted facts even when runtime input contains extra properties', async () => {
    const extraInput = {
      ...input, paymentStatus: 'pending', recordSource: 'checkout', totalAmount: '999.00',
      processingCostContribution: '1.00', subscribe: true, reference_id: 'forged',
    };
    await expect(createManualDonation(extraInput)).resolves.toEqual({ donationId: 42 });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = jest.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/manual/`);
    expect(options).toMatchObject({
      method: 'POST', headers: {
        Authorization: 'Bearer test-admin-token', 'Content-Type': 'application/json',
      },
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      donor_first_name: 'Maya', donor_last_name: 'Donor', donor_email: 'donor@example.test',
      address: 'Historical address', amount: '35.00', currency: 'usd', donation_date: '1990-01-02',
      payment_method: 'check', is_anonymous: false, external_reference: 'Ledger 42', message: '',
    });
  });

  it('omits identifying fields for anonymous input even without form validation', async () => {
    await createManualDonation({ ...input, isAnonymous: true });
    const body = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).not.toHaveProperty('donor_first_name');
    expect(body).not.toHaveProperty('donor_last_name');
    expect(body).not.toHaveProperty('address');
    expect(body).toMatchObject({ is_anonymous: true, donor_email: 'donor@example.test' });
    expect(input.donorFirstName).toBe('Maya');
  });

  it.each([null, 0, -1, 1.5, '42', Number.MAX_SAFE_INTEGER + 1, undefined])(
    'does not confirm creation for invalid saved ID %p', async (donationId) => {
      jest.mocked(fetch).mockResolvedValue({
        ok: true, status: 201, json: async () => ({ donation_id: donationId }),
      } as Response);
      await expect(createManualDonation(input)).rejects.toBeInstanceOf(ManualDonationSaveError);
      await expect(createManualDonation(input)).rejects.toThrow('Check the donation list');
      expect(console.error).toHaveBeenCalledWith(
        'Unable to complete the manual donation save request.',
      );
    },
  );

  it('treats malformed creation JSON as an uncertain save without leaking its contents', async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: true, status: 201, json: async () => { throw new Error('private-response'); },
    } as unknown as Response);
    await expect(createManualDonation(input)).rejects.toThrow('Check the donation list');
    expect(console.error).toHaveBeenCalledWith(
      'Unable to complete the manual donation save request.',
    );
  });

  it('retrieves saved facts by ID with authenticated uncached access', async () => {
    const saved = { donation_id: 42, amount: '35.00', record_source: 'manual' };
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => saved } as Response);
    await expect(fetchSavedDonation(42)).resolves.toEqual(saved);
    expect(fetch).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/42/`,
      { headers: { Authorization: 'Bearer test-admin-token' }, cache: 'no-store' },
    );
  });

  it.each(['id', 'http', 'network', 'json', 'auth'])(
    'reports safe retryable detail errors for %s failures', async (kind) => {
      if (kind === 'auth') jest.mocked(localStorage.getItem).mockReturnValue(null);
      if (kind === 'network') jest.mocked(fetch).mockRejectedValue(new Error('private-response'));
      if (kind === 'http') jest.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      if (kind === 'id' || kind === 'json') jest.mocked(fetch).mockResolvedValue({
        ok: true, json: async () => {
          if (kind === 'json') throw new Error('private-response');
          return { donation_id: 99 };
        },
      } as Response);
      await expect(fetchSavedDonation(42)).rejects.toThrow(
        'The record was saved, but its details could not be loaded. Please try again.',
      );
      expect(console.error).toHaveBeenCalledWith('Unable to load the saved donation details.');
      if (kind === 'auth') expect(fetch).not.toHaveBeenCalled();
    },
  );
});