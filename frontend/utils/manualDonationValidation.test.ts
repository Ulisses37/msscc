import { manualDonationSchema, validateManualDonation } from './manualDonationValidation';

const minimum = { amount: '35.00', donationDate: '1990-01-02' };

describe('manual donation input validation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 4, 12));
  });

  afterEach(() => jest.useRealTimers());

  it('requires known financial facts but does not invent contacts or anonymity', () => {
    expect(validateManualDonation(minimum)).toEqual({
      ...minimum, currency: 'usd', donorFirstName: null, donorLastName: null,
      donorEmail: null, address: null, isAnonymous: false, paymentMethod: null,
      externalReference: '', message: '',
    });
  });

  it.each(['amount', 'donationDate'])('requires %s', (field) => {
    for (const value of [undefined, null, '', '   ']) {
      expect(manualDonationSchema.safeParse({ ...minimum, [field]: value }).success).toBe(false);
    }
  });

  it('accepts only positive amounts within supported monetary precision', () => {
    for (const amount of ['0', '0.00', '-0.01', '1.001', '100000000.00', 'NaN', 'Infinity', 35]) {
      expect(manualDonationSchema.safeParse({ ...minimum, amount }).success).toBe(false);
    }
    for (const amount of ['0.01', '35', '99999999.99']) {
      expect(validateManualDonation({ ...minimum, amount }).amount).toBe(amount);
    }
    expect(validateManualDonation({ ...minimum, amount: ' 35.00 ' }).amount).toBe('35.00');
  });

  it('rejects invalid or future dates and accepts today and historical leap days', () => {
    for (const donationDate of [
      '2025-02-29', '0000-01-01', '2020-13-01', 'not-a-date',
      '2026-11-05', '2026-11-04T00:00:00Z',
    ]) {
      expect(manualDonationSchema.safeParse({ ...minimum, donationDate }).success).toBe(false);
    }
    for (const donationDate of ['2024-02-29', '2026-11-04']) {
      expect(validateManualDonation({ ...minimum, donationDate }).donationDate).toBe(donationDate);
    }
  });

  it.each(['donorFirstName', 'donorLastName', 'donorEmail', 'address'])(
    'normalizes optional %s without inventing an identity', (field) => {
      for (const value of [undefined, null, '', ' \n ']) {
        const result = validateManualDonation({ ...minimum, [field]: value });
        expect(result[field as keyof typeof result]).toBeNull();
        expect(result.isAnonymous).toBe(false);
      }
    },
  );

  it('preserves Unicode names and addresses and normalizes supplied email', () => {
    const result = validateManualDonation({
      ...minimum, donorFirstName: ' 松山 ', donorLastName: " O'Neil ",
      donorEmail: ' DONOR@EXAMPLE.TEST ', address: ' 123 Example Street\n松山市 ',
    });
    expect(result.donorFirstName).toBe('松山');
    expect(result.donorLastName).toBe("O'Neil");
    expect(result.donorEmail).toBe('donor@example.test');
    expect(result.address).toBe('123 Example Street\n松山市');
  });

  it('rejects invalid contacts and overlong text', () => {
    for (const [field, value] of [
      ['donorEmail', 'invalid'], ['donorEmail', 'a'.repeat(250) + '@example.test'],
      ['donorFirstName', 'a'.repeat(256)], ['donorLastName', 'a'.repeat(256)],
      ['address', 123], ['donorFirstName', 123],
      ['externalReference', 'a'.repeat(256)], ['message', 'a'.repeat(501)],
    ]) {
      expect(manualDonationSchema.safeParse({ ...minimum, [field]: value }).success).toBe(false);
    }
  });

  it('discards anonymous names/address but retains a supplied email internally', () => {
    const result = validateManualDonation({
      ...minimum, isAnonymous: true, donorFirstName: 'Forged', donorLastName: 'Identity',
      address: 'Private address', donorEmail: ' DONOR@EXAMPLE.TEST ',
    });
    expect(result.donorFirstName).toBeNull();
    expect(result.donorLastName).toBeNull();
    expect(result.address).toBeNull();
    expect(result.donorEmail).toBe('donor@example.test');
    expect(validateManualDonation({ ...minimum, isAnonymous: true }).donorEmail).toBeNull();
    for (const isAnonymous of ['true', 1, null]) {
      expect(manualDonationSchema.safeParse({ ...minimum, isAnonymous }).success).toBe(false);
    }
  });

  it('records received methods or unknown without inferring a method from reference text', () => {
    for (const paymentMethod of [undefined, null, 'cash', 'check', 'card', 'bank_transfer']) {
      const result = validateManualDonation({
        ...minimum, paymentMethod, externalReference: ' cash receipt ', message: ' Historical note ',
      });
      expect(result.paymentMethod).toBe(paymentMethod ?? null);
      expect(result.externalReference).toBe('cash receipt');
      expect(result.message).toBe('Historical note');
    }
    for (const paymentMethod of ['', 'unknown', 'credit_card', 'unsupported']) {
      expect(manualDonationSchema.safeParse({ ...minimum, paymentMethod }).success).toBe(false);
    }
  });

  it('rejects unsupported currency and server-controlled checkout or payment facts', () => {
    expect(manualDonationSchema.safeParse({ ...minimum, currency: 'jpy' }).success).toBe(false);
    for (const [field, value] of [
      ['recordSource', 'checkout'], ['paymentStatus', 'pending'], ['referenceId', 'DON-00000001'],
      ['stripePaymentIntentId', 'forged'], ['stripeCheckoutSessionId', 'forged'],
      ['completedAt', '1990-01-02'], ['receiptSentAt', '1990-01-02'],
      ['contributeToProcessingCosts', true], ['processingCostContribution', '1.00'],
      ['totalAmount', '36.00'],
    ]) {
      expect(manualDonationSchema.safeParse({ ...minimum, [field]: value }).success).toBe(false);
    }
  });
});