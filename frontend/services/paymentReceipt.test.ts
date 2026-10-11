const originalFetch = global.fetch;
const reference = 'DON-00000042';
let getPaymentReceipt: typeof import('@/services/paymentService').getPaymentReceipt;

beforeAll(async () => {
  // The service captures its API base URL at import time; isolate these tests
  // from a developer's .env and from earlier module imports.
  process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
  jest.resetModules();
  ({ getPaymentReceipt } = await import('@/services/paymentService'));
});
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; jest.clearAllMocks(); });

const valid = {
  payment_purpose: 'donation', amount: '12.50', currency: 'usd',
  completed_at: '2026-10-10T15:30:00Z', confirmation_reference: reference,
};

it('reads only safe receipt fields from a no-cache request', async () => {
  // Simulate an API that accidentally adds private fields: the service must
  // return its allowlist rather than forwarding the whole response to React.
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({
    ...valid, client_secret: 'private', donor_email: 'private@example.com',
  }) } as Response);
  await expect(getPaymentReceipt(reference)).resolves.toEqual({
    paymentPurpose: 'donation', amount: '12.50', currency: 'usd',
    completedAt: valid.completed_at, confirmationReference: reference,
  });
  expect(global.fetch).toHaveBeenCalledWith(
    `https://api.example.test/api/payments/receipt/?confirmation_reference=${reference}`,
    { method: 'GET', cache: 'no-store' },
  );
});

it('accepts a safe membership option and optional backend donation purpose', async () => {
  const memberReference = `MEM-${'a'.repeat(32)}`;
  jest.mocked(global.fetch).mockResolvedValueOnce({ ok: true, json: async () => ({
    ...valid, payment_purpose: 'membership', confirmation_reference: memberReference,
    membership_option: 'student',
  }) } as Response).mockResolvedValueOnce({ ok: true, json: async () => ({
    ...valid, donation_purpose: 'Community programs',
  }) } as Response);
  await expect(getPaymentReceipt(memberReference)).resolves.toMatchObject({ membershipOption: 'student' });
  await expect(getPaymentReceipt(reference)).resolves.toMatchObject({ donationPurpose: 'Community programs' });
});

it.each(['pi_secret', 'DON-1', 'MEM-incorrect'])('rejects malformed %s without a request', async (value) => {
  await expect(getPaymentReceipt(value)).rejects.toThrow('Unable to retrieve receipt.');
  expect(global.fetch).not.toHaveBeenCalled();
});

it.each([
  null, {}, { ...valid, amount: 12.5 }, { ...valid, confirmation_reference: 'DON-00000043' },
  { ...valid, payment_purpose: 'membership' }, { ...valid, completed_at: 'invalid' },
  { ...valid, currency: 'secret' }, { ...valid, donation_purpose: { private: true } },
])('rejects invalid payload %p without exposing its content', async (value) => {
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => value } as Response);
  await expect(getPaymentReceipt(reference)).rejects.toThrow('Unable to retrieve receipt.');
});

it('hides HTTP and network errors', async () => {
  jest.mocked(global.fetch).mockResolvedValueOnce({ ok: false } as Response)
    .mockRejectedValueOnce(new Error('private backend detail'));
  await expect(getPaymentReceipt(reference)).rejects.toThrow('Unable to retrieve receipt.');
  await expect(getPaymentReceipt(reference)).rejects.toThrow('Unable to retrieve receipt.');
});