import { getAdminRequestHeaders } from '@/services/adminRequestHeaders';

export interface MembershipCsvIssue {
  row: number;
  field?: string;
  reason?: string;
  message: string;
}

export interface MembershipCsvProposal {
  row: number;
  values: Record<string, string | null>;
}

export interface MembershipCsvPreview {
  record_type: 'membership';
  row_count: number;
  proposed_records: MembershipCsvProposal[];
  errors: MembershipCsvIssue[];
  warnings: MembershipCsvIssue[];
  review_token?: string | null;
}

export interface MembershipCsvConfirmation {
  record_type: 'membership';
  batch_id: string;
  created_count: number;
  membership_ids: number[];
  already_imported: boolean;
}

/** A known rejection happened before the backend could commit the batch. */
export class MembershipCsvReviewRejected extends Error {
  constructor(public readonly reason: 'review' | 'access') {
    super(reason === 'access'
      ? 'Finance access is required to confirm this import. Sign in again before reviewing.'
      : 'The review was rejected or expired. Upload and review the CSV again before confirming.');
    this.name = 'MembershipCsvReviewRejected';
  }
}

/** Send the original file again; proposals in the browser never become save input. */
export async function confirmMembershipCsv(
  file: File, token: string, acknowledgeWarnings: boolean,
): Promise<MembershipCsvConfirmation> {
  let headers: Record<string, string>;
  try {
    headers = getAdminRequestHeaders();
  } catch {
    // No request was sent, so there is no possibly committed transaction to
    // recover. Unlike a lost response, this is a definite access failure.
    throw new MembershipCsvReviewRejected('access');
  }
  const form = new FormData();
  form.append('file', file);
  form.append('review_token', token);
  form.append('acknowledge_warnings', String(acknowledgeWarnings));
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/import/confirm/`,
      { method: 'POST', headers, body: form, cache: 'no-store' },
    );
    // These responses are issued before persistence. An unexpected response,
    // server failure, or lost connection cannot prove the transaction failed.
    if (response.status === 400 || response.status === 409) {
      throw new MembershipCsvReviewRejected('review');
    }
    if (response.status === 401 || response.status === 403) {
      throw new MembershipCsvReviewRejected('access');
    }
    if (!response.ok) throw new Error('Confirmation outcome unknown.');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('record_type' in data)
      || data.record_type !== 'membership' || !('batch_id' in data)
      || typeof data.batch_id !== 'string' || !('created_count' in data)
      || typeof data.created_count !== 'number' || !('membership_ids' in data)
      || !Array.isArray(data.membership_ids)
      || data.membership_ids.length !== data.created_count
      || !data.membership_ids.every((id) => Number.isSafeInteger(id) && id > 0)
      || !('already_imported' in data) || typeof data.already_imported !== 'boolean') {
      throw new Error('Invalid confirmation.');
    }
    return data as MembershipCsvConfirmation;
  } catch (error) {
    if (error instanceof MembershipCsvReviewRejected) throw error;
    // A network error can mean the server committed but the reply was lost.
    // Keep the selected file and token for a safe, idempotent retry.
    throw new Error('Confirmation status is uncertain. Retry with the same reviewed file.');
  }
}

/** The backend interprets CSV facts; the browser never parses or persists them. */
export async function previewMembershipCsv(file: File): Promise<MembershipCsvPreview> {
  try {
    // FormData sets its own multipart boundary. Explicit JSON content-type
    // would prevent Django from reading the file and bypass the CSV contract.
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/import/preview/`,
      { method: 'POST', headers: getAdminRequestHeaders(), body: form, cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Preview request failed.');
    const data: unknown = await response.json();
    // Reject the wrong resource/shape rather than showing a donation response
    // or treating an incomplete server response as a reviewable membership.
    if (!data || typeof data !== 'object' || !('record_type' in data)
      || data.record_type !== 'membership' || !('proposed_records' in data)
      || !Array.isArray(data.proposed_records) || !('errors' in data)
      || !Array.isArray(data.errors) || !('warnings' in data)
      || !Array.isArray(data.warnings) || !('row_count' in data)
      || typeof data.row_count !== 'number') {
      throw new Error('Invalid preview response.');
    }
    return data as MembershipCsvPreview;
  } catch {
    // Raw server responses, upload contents, and auth tokens are private. A
    // stable error also prevents DRF exception text reaching the admin UI.
    console.error('Unable to preview membership CSV.');
    throw new Error('Unable to review the CSV. Check your finance access and try again.');
  }
}
