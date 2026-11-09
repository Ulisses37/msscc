// The payment-service boundary is tested with synthetic responses only: no
// Stripe session, card input, webhook, or shared development data is created.
const originalFetch = global.fetch;
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const donationReference = 'DON-00000042';
const membershipReference = `MEM-${'a'.repeat(32)}`;
let createPaymentSession: typeof import('./paymentService').createPaymentSession;
let getPaymentReceipt: typeof import('./paymentService').getPaymentReceipt;

beforeAll(async () => {
  // This module captures the API URL at import time; isolate tests from local
  // developer configuration without inspecting any environment files.
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  jest.resetModules();
  ({ createPaymentSession, getPaymentReceipt } = await import('./paymentService'));
});
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; });
afterAll(() => {
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

describe('createPaymentSession for donations', () => {
  const request = { amount: '5.00', currency: 'usd', paymentPurpose: 'Donation', internalReference: donationReference };

  it('uses the saved reference and no card or client-derived total, and maps only session fields', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
      session_id: 'cs_test_example', client_secret: 'cs_test_secret', private_field: 'ignored',
    }) } as Response);
    await expect(createPaymentSession(request)).resolves.toEqual({
      sessionId: 'cs_test_example', clientSecret: 'cs_test_secret',
    });
    const [url, options] = jest.mocked(global.fetch).mock.calls[0];
    expect(url).toBe('https://api.example.test/api/payments/session/');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options?.body as string)).toEqual({
      amount: '5.00', currency: 'usd', payment_purpose: 'Donation', internal_reference: donationReference,
    });
  });

  it.each([
    ['HTTP failure', { ok: false, json: async () => ({ detail: 'private-backend-detail' }) }],
    ['missing session', { ok: true, json: async () => ({ client_secret: 'cs_test_secret' }) }],
    ['missing secret', { ok: true, json: async () => ({ session_id: 'cs_test_example' }) }],
    ['invalid JSON', { ok: true, json: async () => { throw new Error('private-response-detail'); } }],
  ])('rejects %s with a generic error instead of exposing provider data', async (_reason, response) => {
    jest.mocked(global.fetch).mockResolvedValue(response as Response);
    await expect(createPaymentSession(request)).rejects.toThrow('Unable to create the payment session.');
  });
});

describe('getPaymentReceipt for donation and membership', () => {
  const completedDonation = {
    payment_purpose: 'donation', amount: '5.61', base_amount: '5.00',
    processing_cost_contribution: '0.61', total_amount: '5.61', currency: 'usd',
    completed_at: '2026-10-10T15:30:00Z', confirmation_reference: donationReference,
    donation_purpose: 'Community programs',
  };

  it('maps only allowlisted saved fields after a no-cache lookup', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
      ...completedDonation, client_secret: 'private', donor_email: 'private@example.test',
    }) } as Response);
    await expect(getPaymentReceipt(donationReference)).resolves.toEqual({
      paymentPurpose: 'donation', amount: '5.61', baseAmount: '5.00',
      processingCostContribution: '0.61', totalAmount: '5.61', currency: 'usd',
      completedAt: completedDonation.completed_at, confirmationReference: donationReference,
      donationPurpose: 'Community programs',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.test/api/payments/receipt/?confirmation_reference=DON-00000042',
      { method: 'GET', cache: 'no-store' },
    );
  });

  it('accepts a legacy completed membership without an optional price breakdown', async () => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
      payment_purpose: 'membership', amount: '20.00', currency: 'usd',
      completed_at: completedDonation.completed_at, confirmation_reference: membershipReference,
      membership_option: 'student', private_field: 'ignored',
    }) } as Response);
    await expect(getPaymentReceipt(membershipReference)).resolves.toEqual({
      paymentPurpose: 'membership', amount: '20.00', currency: 'usd',
      completedAt: completedDonation.completed_at, confirmationReference: membershipReference,
      membershipOption: 'student',
    });
  });

  it.each(['pi_secret', 'DON-123', `MEM-${'A'.repeat(32)}`])(
    'rejects an invalid reference %s without contacting the backend', async (reference) => {
      await expect(getPaymentReceipt(reference)).rejects.toThrow('Unable to retrieve receipt.');
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['wrong payment type', { payment_purpose: 'membership' }],
    ['mismatched reference', { confirmation_reference: 'DON-00000043' }],
    ['missing saved base', { base_amount: undefined }],
    ['inconsistent saved total', { total_amount: '5.62' }],
    ['inconsistent charged amount', { amount: '5.62' }],
    ['invalid currency', { currency: 'usd_private' }],
    ['invalid timestamp', { completed_at: 'not-a-date' }],
    ['oversize purpose', { donation_purpose: 'x'.repeat(201) }],
  ])('rejects %s instead of rendering an untrusted receipt', async (_reason, changes) => {
    jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
      ...completedDonation, ...changes,
    }) } as Response);
    await expect(getPaymentReceipt(donationReference)).rejects.toThrow('Unable to retrieve receipt.');
  });

  it.each(['HTTP error', 'network error', 'invalid JSON'])(
    'hides %s details from the receipt consumer', async (failure) => {
      if (failure === 'network error') {
        jest.mocked(global.fetch).mockRejectedValue(new Error('private-network-detail'));
      } else {
        jest.mocked(global.fetch).mockResolvedValue({ ok: failure !== 'HTTP error',
          json: async () => { throw new Error('private-response-detail'); },
        } as Response);
      }
      await expect(getPaymentReceipt(donationReference)).rejects.toThrow('Unable to retrieve receipt.');
    },
  );
});