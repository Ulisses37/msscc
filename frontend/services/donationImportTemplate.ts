import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

/** Fetch the finance-authorized donation template, never an existing record export. */
export async function downloadDonationImportTemplate(): Promise<void> {
  try {
    // Use the same authenticated admin headers as other finance requests. The
    // public/record-export CSV routes are not valid donation import templates.
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/import/template/`,
      { headers: getAdminRequestHeaders(), cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Template request failed.');
    const file = await response.blob();
    // A temporary object URL allows a normal browser download without putting
    // the bearer token in a navigation URL or exposing it to another origin.
    const url = URL.createObjectURL(file);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'donation-import-template.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      // Revoke even if the browser refuses the download or link.click throws;
      // otherwise repeated admin downloads retain unnecessary blob URLs.
      URL.revokeObjectURL(url);
    }
  } catch {
    // Do not print private response bodies or bearer credentials on failures.
    console.error('Unable to download the donation import template.');
    throw new Error('Unable to download the template. Check your finance access and try again.');
  }
}