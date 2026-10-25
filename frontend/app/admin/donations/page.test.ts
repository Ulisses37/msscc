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
});