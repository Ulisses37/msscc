import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

/** Fetch the authorized backend contract, not an existing membership record export. */
export async function downloadMembershipImportTemplate(): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/import/template/`,
      { headers: getAdminRequestHeaders(), cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Template request failed.');
    const file = await response.blob();
    const url = URL.createObjectURL(file);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'membership-import-template.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    // Do not log response bodies or credentials from a private admin request.
    console.error('Unable to download the membership import template.');
    throw new Error('Unable to download the template. Check your finance access and try again.');
  }
}
