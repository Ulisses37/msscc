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
  review_token?: string | null;
}

export interface DonationCsvConfirmation {
  record_type: 'donation';
  batch_id: string;
  created_count: number;
  donation_ids: number[];
  already_imported: boolean;
}

/** Only 400/409/401/403 prove confirmation was rejected before saving. */
export class DonationCsvReviewRejected extends Error {
  constructor(public readonly reason: 'review' | 'access') {
    super(reason === 'access'
      ? 'Finance access is required to confirm this import. Sign in again before reviewing.'
      : 'The review was rejected or expired. Upload and review the CSV again before confirming.');
    this.name = 'DonationCsvReviewRejected';
  }
}

/** Send the original file again, not browser-supplied proposals or warnings. */
export async function confirmDonationCsv(
  file: File, token: string, acknowledgeWarnings: boolean,
): Promise<DonationCsvConfirmation> {
  let headers: Record<string, string>;
  try {
    headers = getAdminRequestHeaders();
  } catch {
    // No request was sent; unlike a lost reply, this cannot have saved rows.
    throw new DonationCsvReviewRejected('access');
  }
  const form = new FormData();
  form.append('file', file);
  form.append('review_token', token);
  form.append('acknowledge_warnings', String(acknowledgeWarnings));
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/import/confirm/`,
      { method: 'POST', headers, body: form, cache: 'no-store' },
    );
    if (response.status === 400 || response.status === 409) {
      throw new DonationCsvReviewRejected('review');
    }
    if (response.status === 401 || response.status === 403) {
      throw new DonationCsvReviewRejected('access');
    }
    if (!response.ok) throw new Error('Confirmation outcome unknown.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('record_type' in data)
      || data.record_type !== 'donation' || !('batch_id' in data)
      || typeof data.batch_id !== 'string' || !('created_count' in data)
      || typeof data.created_count !== 'number' || !Number.isSafeInteger(data.created_count)
      || data.created_count < 1
      || !('donation_ids' in data) || !Array.isArray(data.donation_ids)
      || data.donation_ids.length !== data.created_count
      || !data.donation_ids.every((id) => Number.isSafeInteger(id) && id > 0)
      || !('already_imported' in data) || typeof data.already_imported !== 'boolean') {
      throw new Error('Invalid confirmation receipt.');
    }
    return data as DonationCsvConfirmation;
  } catch (error) {
    if (error instanceof DonationCsvReviewRejected) throw error;
    // A lost reply may follow a committed transaction: retain the SAME file
    // and token for the server's idempotent retry, not a fresh import.
    throw new Error('Confirmation status is uncertain. Retry with the same reviewed file.');
  }
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