'use client';

import { useRef, useState } from 'react';

import {
  confirmMembershipCsv, MembershipCsvReviewRejected, previewMembershipCsv,
} from '@/services/membershipImportPreview';

import type { MembershipCsvConfirmation, MembershipCsvPreview } from '@/services/membershipImportPreview';

// Mirror the backend's ordered template for display, not for parsing. Only
// backend-normalized values returned by the authorized preview are rendered.
const HEADERS = [
  'first_name', 'last_name', 'membership_type', 'status', 'email', 'phone', 'address',
  'membership_price', 'amount_paid', 'start_date', 'end_date', 'renewal_date',
  'payment_status', 'payment_method', 'reference_id', 'notes',
] as const;

/** Review and confirm only with a signed, server-revalidated CSV decision. */
type MembershipCsvReviewProps = {
  embedded?: boolean;
  onConfirmed?: (result: MembershipCsvConfirmation) => void;
  onOpenSavedMembership?: (membershipId: number) => void;
  openingMembershipId?: number | null;
  savedDetailsError?: string | null;
};

export function MembershipCsvReview({
  embedded = false, onConfirmed, onOpenSavedMembership, openingMembershipId, savedDetailsError,
}: MembershipCsvReviewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MembershipCsvPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmationAttempted, setConfirmationAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<MembershipCsvConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewRejected, setReviewRejected] = useState(false);
  const requestVersion = useRef(0);
  // The ref closes the double-click window before React re-renders the
  // disabled button; requestVersion independently rejects obsolete results.
  const inFlight = useRef(false);

  function clearReview() {
    // A pending response cannot resurrect an old review after cancel/file change.
    // Acknowledgment belongs only to the precise file and warning set shown.
    requestVersion.current += 1;
    setPreview(null);
    setAcknowledged(false);
    setError(null);
    setReviewRejected(false);
    setLoading(false);
    setConfirmation(null);
    setConfirmationAttempted(false);
    inFlight.current = false;
  }

  async function confirm() {
    if (!file || !preview?.review_token || preview.errors.length || confirmation
      || (preview.warnings.length && !acknowledged) || inFlight.current) return;
    inFlight.current = true;
    const version = requestVersion.current;
    setConfirming(true);
    // After a request starts, even a failed response cannot prove that the
    // transaction did not commit. Never revert to a "nothing saved" claim.
    setConfirmationAttempted(true);
    setError(null);
    try {
      const result = await confirmMembershipCsv(file, preview.review_token, acknowledged);
      if (version === requestVersion.current) {
        setConfirmation(result);
        onConfirmed?.(result);
      }
    } catch (failure) {
      if (version === requestVersion.current) {
        if (failure instanceof MembershipCsvReviewRejected) {
          // A definite rejection invalidates this review for saving. Re-upload
          // to receive a fresh signed token and current warning set.
          setReviewRejected(true);
          setError(failure.message);
        } else {
          // Keep the exact file/token for a retry: a dropped reply may follow
          // a successful commit. Do not instruct the admin to start over.
          setError('Confirmation status is uncertain. Retry with the same reviewed file to check the batch.');
        }
      }
    } finally {
      if (version === requestVersion.current) {
        inFlight.current = false;
        setConfirming(false);
      }
    }
  }

  async function upload() {
    if (!file || inFlight.current) return;
    // Re-upload is a fresh backend review even when the filename is unchanged;
    // warnings can change as other admins create memberships.
    clearReview();
    inFlight.current = true;
    const version = requestVersion.current;
    setLoading(true);
    try {
      const next = await previewMembershipCsv(file);
      if (version === requestVersion.current) setPreview(next);
    } catch {
      if (version === requestVersion.current) {
        setError('Unable to review the CSV. Check your finance access and try again.');
      }
    } finally {
      if (version === requestVersion.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }

  return (
    <section aria-labelledby="membership-csv-review-title"
      className={embedded ? 'mt-5 min-w-0 max-w-full' : 'mb-6 min-w-0 max-w-full rounded-md border border-msscc-gray-light p-4'}>
      <h4 id="membership-csv-review-title" className="font-heading text-lg text-msscc-teal">Review membership CSV</h4>
      <label htmlFor="membership-csv-file" className="mt-4 block text-body-sm">Membership CSV file</label>
      <input id="membership-csv-file" type="file" accept=".csv,text/csv" className="mt-2 block w-full min-w-0 max-w-full text-body-sm"
        disabled={confirming}
        onChange={(event) => {
          // Never leave an old file's warnings or acknowledgment visible while
          // the picker points to a different CSV, including an empty selection.
          clearReview();
          setFile(event.target.files?.[0] ?? null);
        }} />
      {/* A native file picker can have an intrinsic width wider than a phone.
          Stack the actions until there is room; never squeeze labels into columns. */}
      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={!file || loading || confirming} onClick={() => void upload()}
          className="w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto">
          {loading ? 'Reviewing CSV…' : 'Upload and review CSV'}
        </button>
        {(preview || error) && <button type="button" disabled={confirming} onClick={clearReview}
          className="w-full rounded-md border border-msscc-gray-light px-4 py-2 sm:w-auto">Cancel review</button>}
      </div>
      {error && <p role="alert" className="mt-3 text-msscc-danger">{error}</p>}
      {preview && (
        <div className="mt-6 min-w-0 max-w-full [overflow-wrap:anywhere]">
          <p>Membership preview: {preview.row_count} data rows, {preview.proposed_records.length} valid proposals.</p>
          {preview.errors.length > 0 && <div role="alert" className="mt-3">
            {/* Errors are locations only; the admin fixes and re-uploads the source CSV. */}
            <h3>Errors: correct the source CSV and re-upload it.</h3>
            <ul className="list-disc pl-5">{preview.errors.map((issue, index) => (
              <li key={`${issue.row}-${issue.field}-${index}`}>Row {issue.row}, {issue.field}: {issue.message}</li>
            ))}</ul>
          </div>}
          {preview.warnings.length > 0 && <div className="mt-3">
            {/* Acknowledgment is local review state, NOT permission to save. */}
            <h3>Potential duplicates (not confirmed matches)</h3>
            <ul className="list-disc pl-5">{preview.warnings.map((issue, index) => (
              <li key={`${issue.row}-${issue.reason}-${index}`}>Row {issue.row}: {issue.message}</li>
            ))}</ul>
            <label className="mt-3 flex gap-2">
              <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
              I have reviewed these warnings and still want to confirm this import.
            </label>
          </div>}
          {/* The 16-column preview scrolls inside the panel, not the whole page. */}
          <div className="mt-4 max-w-full overflow-x-auto">
            {/* React escapes uploaded text, including tags in names/notes. Do not
                use innerHTML or let CSV values become links or executable markup. */}
            <table className="min-w-full border-collapse text-left text-body-sm">
              <caption className="text-left">Backend-validated membership proposals (read only)</caption>
              <thead><tr><th scope="col" className="p-2">CSV row</th>{HEADERS.map((field) => (
                <th scope="col" key={field} className="p-2">{field}</th>
              ))}</tr></thead>
              <tbody>{preview.proposed_records.map((proposal) => (
                <tr key={proposal.row} className="border-t border-msscc-gray-light">
                  <th scope="row" className="p-2">{proposal.row}</th>
                  {HEADERS.map((field) => (
                    <td key={field} className="p-2 whitespace-pre-wrap">{proposal.values[field] ?? 'Unknown'}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!confirmation && <p role="status" className="mt-4">
            {reviewRejected ? 'This review did not save records. Upload and review the file again.'
              : confirmationAttempted ? 'Confirmation may have saved records; retry with the same file to check.'
              : 'Review only; no records have been saved.'}
            {/* Confirmation needs a separately authorized, server-bound batch;
                preview acknowledgment alone cannot create financial records. */}
            {preview.errors.length > 0 ? ' Errors require correction and re-upload.' : ''}
            {preview.warnings.length > 0 && !acknowledged ? ' Acknowledge warnings before future confirmation.' : ''}
          </p>}
          {/* The signed review token is only a prerequisite: the backend checks
              its owner, original file, current warnings and every row again. */}
          {!confirmation && !reviewRejected && preview.review_token && preview.errors.length === 0 && (
            <button type="button" onClick={() => void confirm()} disabled={confirming ||
              (preview.warnings.length > 0 && !acknowledged)}
              className="mt-4 w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto">
              {confirming ? 'Confirming…' : 'Confirm membership import'}
            </button>
          )}
          {confirmation && <div role="status" className="mt-4">
            <p>{confirmation.already_imported ? 'This batch was already imported.' : 'Membership batch saved.'}
              {' '}Batch {confirmation.batch_id}: {confirmation.created_count} memberships.</p>
            {/* IDs come from the committed batch receipt, not the filtered or
                paginated table. Load private saved details only on demand. */}
            {onOpenSavedMembership && <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {confirmation.membership_ids.map((id) => (
                <li key={id}><button type="button" disabled={openingMembershipId !== null && openingMembershipId !== undefined}
                  onClick={() => onOpenSavedMembership(id)}
                  className="w-full rounded-md border border-msscc-pink px-3 py-2 text-msscc-pink disabled:opacity-50 sm:w-auto">
                  {openingMembershipId === id ? 'Loading membership…' : `View saved membership ${id}`}
                </button></li>
              ))}
            </ul>}
            {savedDetailsError && <p role="alert" className="mt-2 text-msscc-danger">{savedDetailsError}</p>}
          </div>}
        </div>
      )}
    </section>
  );
}
