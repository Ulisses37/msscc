import { formatDonationName } from '@/utils/formatDonationName';

describe('donation admin name column', () => {
  it('shows an anonymous record without a leading comma or doubled name', () => {
    expect(formatDonationName({ donor_first_name: 'Anonymous', donor_last_name: '' }))
      .toBe('Anonymous');
  });

  it('preserves the existing Last, First format for an ordinary donation', () => {
    expect(formatDonationName({ donor_first_name: 'Ada', donor_last_name: 'Lovelace' }))
      .toBe('Lovelace, Ada');
  });

  it.each([
    [null, null, 'Not provided'], ['', '  ', 'Not provided'],
    [' Ada ', null, 'Ada'], [null, ' Lovelace ', 'Lovelace'],
  ])('formats missing or partial names (%p, %p)', (first, last, expected) => {
    expect(formatDonationName({ donor_first_name: first, donor_last_name: last }))
      .toBe(expected);
  });

  it('uses the anonymity flag instead of accidentally exposing supplied names', () => {
    expect(formatDonationName({
      donor_first_name: 'Private', donor_last_name: 'Identity', is_anonymous: true,
    })).toBe('Anonymous');
  });

  it('supports first-last headings without changing the table ordering', () => {
    const donor = { donor_first_name: 'Ada', donor_last_name: 'Lovelace' };
    expect(formatDonationName(donor, 'first-last')).toBe('Ada Lovelace');
    expect(formatDonationName(donor)).toBe('Lovelace, Ada');
  });
});