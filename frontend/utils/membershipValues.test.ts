import {
  compareMembershipValues,
  formatMembershipAmount,
  formatMembershipDate,
  membershipAmount,
  parseMembershipDate,
  parseMembershipTimestamp,
} from './membershipValues';

describe('membership values', () => {
  it.each([null, undefined, '', ' ', 'invalid', NaN, Infinity])(
    'does not invent a payment for %p', (value) => {
      expect(membershipAmount(value)).toBeNull();
      expect(formatMembershipAmount(value)).toBe('Unknown');
    },
  );

  it.each([0, '0', '0.00'])('preserves known zero %p', (value) => {
    expect(membershipAmount(value)).toBe(0);
    expect(formatMembershipAmount(value)).toBe('$0.00');
  });

  it.each([null, undefined, '', 'invalid', '2026-02-29', '2026-04-31', '2026-13-01'])(
    'rejects missing or impossible dates %p', (value) => {
      expect(parseMembershipDate(value)).toBeNull();
      expect(formatMembershipDate(value)).toBe('Not provided');
    },
  );

  it('preserves the local calendar day and accepts leap days', () => {
    expect(formatMembershipDate('2024-02-29')).toBe('February 29, 2024');
    expect(parseMembershipDate('2026-01-01')?.getDate()).toBe(1);
  });

  it.each([null, undefined, '', 'invalid', '2026-02-30T12:00:00Z', '2026-01-01T24:00:00Z'])(
    'rejects missing or invalid timestamps %p', (value) => {
      expect(parseMembershipTimestamp(value)).toBeNull();
      expect(formatMembershipDate(value, true)).toBe('Not provided');
    },
  );

  it('accepts an API timestamp', () => {
    expect(parseMembershipTimestamp('2026-01-01T12:30:00Z')?.toISOString())
      .toBe('2026-01-01T12:30:00.000Z');
  });

  it.each([1, -1])('keeps unknown values last with direction %p', (direction) => {
    expect(compareMembershipValues(null, 0, direction)).toBe(1);
    expect(compareMembershipValues(0, null, direction)).toBe(-1);
    expect(compareMembershipValues(null, null, direction)).toBe(0);
    expect(compareMembershipValues(0, 10, direction)).toBe(-10 * direction);
    expect(compareMembershipValues(null, 'paid', direction)).toBe(1);
  });
});