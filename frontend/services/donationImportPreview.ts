import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

export interface DonationCsvIssue {
  row: number;
  field?: string;
  reason?: string;
  message: string;
}

export interface DonationCsvProposal {
  row: number;
  values: Record<string, string | boolean | null>;
}

export interface DonationCsvPreview {
  record_type: 'donation';
  row_count: number;
  proposed_records: DonationCsvProposal[];
  errors: DonationCsvIssue[];
  warnings: DonationCsvIssue[];
}

/** Send the original file for authorized, read-only backend validation. */
export async function previewDonationCsv(file: File): Promise<DonationCsvPreview> {
  try {
    // FormData sets its multipart boundary. Supplying JSON Content-Type would
    // prevent the server from finding the file and enforcing the CSV contract.
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/import/preview/`,
      { method: 'POST', headers: getAdminRequestHeaders(), body: form, cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Preview request failed.');
    const data: unknown = await response.json();
    // Never display a wrong-resource or incomplete response as a donation
    // review. The backend, not the browser, is authoritative for parsed facts.
    if (!data || typeof data !== 'object' || !('record_type' in data)
      || data.record_type !== 'donation' || !('row_count' in data)
      || typeof data.row_count !== 'number' || !Number.isSafeInteger(data.row_count)
      || data.row_count < 0
      || !('proposed_records' in data) || !Array.isArray(data.proposed_records)
      || !('errors' in data) || !Array.isArray(data.errors)
      || !('warnings' in data) || !Array.isArray(data.warnings)) {
      throw new Error('Invalid preview response.');
    }
    return data as DonationCsvPreview;
  } catch {
    // Do not log uploaded contacts, raw server errors or authorization headers.
    console.error('Unable to preview donation CSV.');
    throw new Error('Unable to review the CSV. Check your finance access and try again.');
  }
}