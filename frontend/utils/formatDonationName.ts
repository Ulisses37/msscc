import type { DonationEntry } from '@/components/admin/DonationDetailDrawer';

/** Keep Last, First for ordinary donors; omit the dangling comma for anonymous donors. */
export function formatDonationName(donation: Pick<DonationEntry, 'donor_first_name' | 'donor_last_name'>): string {
  return donation.donor_last_name
    ? `${donation.donor_last_name}, ${donation.donor_first_name}`
    : donation.donor_first_name;
}