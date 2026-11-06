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
