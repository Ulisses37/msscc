import type { DonationEntry } from '@/components/admin/DonationDetailDrawer';

/** Distinguish anonymous donors from missing names, preserving ordinary name ordering. */
export function formatDonationName(
  donation: Pick<DonationEntry, 'donor_first_name' | 'donor_last_name'>
    & Partial<Pick<DonationEntry, 'is_anonymous'>>,
  order: 'last-first' | 'first-last' = 'last-first',
): string {
  if (donation.is_anonymous) return 'Anonymous';
  const first = donation.donor_first_name?.trim() ?? '';
  const last = donation.donor_last_name?.trim() ?? '';
  if (!first || !last) return first || last || 'Not provided';
  return order === 'first-last' ? `${first} ${last}` : `${last}, ${first}`;
}