import { manualMembershipSchema, validateManualMembership } from './manualMembershipValidation';

import {
  MANUAL_MEMBERSHIP_STATUSES,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_STATUSES,
} from '@/types/manualMembership';

const minimum = {
  firstName: ' 松山 ', lastName: "O'Neil", membershipType: 'Historical lifetime', status: 'unknown',
};

describe('manual membership input validation', () => {
  it('preserves unknowns without checkout defaults', () => {
    const result = validateManualMembership(minimum);
    expect(result.firstName).toBe('松山');
    expect(result.membershipType).toBe('Historical lifetime');
    expect(result.status).toBe('unknown');
    for (const field of [
      'email', 'phone', 'address', 'membershipPrice', 'amountPaid', 'startDate',
      'endDate', 'renewalDate', 'paymentStatus', 'paymentMethod',
    ]) {
      expect(result[field as keyof typeof result]).toBeNull();
    }
    expect(result.referenceId).toBe('');
    expect(result.notes).toBe('');
  });

  it.each(['firstName', 'lastName', 'membershipType', 'status'])('requires %s', (field) => {
    for (const value of [undefined, null, '', '   ']) {
      expect(manualMembershipSchema.safeParse({ ...minimum, [field]: value }).success).toBe(false);
    }
  });

  it('accepts exactly the supported choices', () => {
    for (const [field, choices] of [
      ['status', MANUAL_MEMBERSHIP_STATUSES],
      ['paymentStatus', [...MANUAL_PAYMENT_STATUSES, null]],
      ['paymentMethod', [...MANUAL_PAYMENT_METHODS, null]],
    ] as const) {
      for (const value of choices) {
        expect(manualMembershipSchema.safeParse({ ...minimum, [field]: value }).success).toBe(true);
      }
      expect(manualMembershipSchema.safeParse({ ...minimum, [field]: 'unsupported' }).success)
        .toBe(false);
    }
  });

  it.each(['email', 'phone', 'address'])('normalizes optional %s', (field) => {
    for (const value of [undefined, null, '', ' \n ']) {
      const result = validateManualMembership({ ...minimum, [field]: value });
      expect(result[field as keyof typeof result]).toBeNull();
    }
  });

  it('validates and normalizes supplied email', () => {
    expect(validateManualMembership({ ...minimum, email: ' MEMBER@EXAMPLE.TEST ' }).email)
      .toBe('member@example.test');
    expect(manualMembershipSchema.safeParse({ ...minimum, email: 'invalid' }).success).toBe(false);
  });

  it.each(['membershipPrice', 'amountPaid'])('validates %s without losing zero', (field) => {
    for (const value of ['-0.01', '1.001', '100000000.00', 'NaN', 'Infinity']) {
      expect(manualMembershipSchema.safeParse({ ...minimum, [field]: value }).success).toBe(false);
    }
    const result = validateManualMembership({ ...minimum, membershipPrice: '73.25', amountPaid: '0' });
    expect(result.membershipPrice).toBe('73.25');
    expect(result.amountPaid).toBe('0');
  });

  it.each(['startDate', 'endDate', 'renewalDate'])('rejects invalid %s', (field) => {
    for (const value of ['2025-02-29', '0000-01-01', '2020-13-01', 'not-a-date']) {
      expect(manualMembershipSchema.safeParse({ ...minimum, [field]: value }).success).toBe(false);
    }
  });

  it('compares only known start and end dates', () => {
    expect(manualMembershipSchema.safeParse({
      ...minimum, startDate: '2020-01-02', endDate: '2020-01-01',
    }).success).toBe(false);
    for (const dates of [
      { startDate: '2020-01-01' }, { endDate: '2020-01-01' },
      { startDate: '2020-01-01', endDate: '2020-01-01' },
    ]) {
      expect(manualMembershipSchema.safeParse({ ...minimum, ...dates }).success).toBe(true);
    }
  });

  it('does not infer payment method from completed offline payment or reference', () => {
    const result = validateManualMembership({
      ...minimum, amountPaid: '35.00', paymentStatus: 'completed', referenceId: 'cash receipt',
    });
    expect(result.paymentMethod).toBeNull();
    expect(result.startDate).toBeNull();
  });
});