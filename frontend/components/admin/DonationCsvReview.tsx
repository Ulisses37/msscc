'use client';

import { useRef, useState } from 'react';

import { confirmDonationCsv, DonationCsvReviewRejected, previewDonationCsv } from '@/services/donationImportPreview';
import type { DonationCsvConfirmation, DonationCsvPreview } from '@/services/donationImportPreview';

// The server owns parsing; this order only labels normalized, authorized data.
// It must stay aligned with the donation-only template and contract tests.
const HEADERS = [
  'amount', 'donation_date', 'is_anonymous', 'payment_method',
  'donor_first_name', 'donor_last_name', 'donor_email', 'address',
  'external_reference', 'message',
] as const;

/** Review donation proposals and warnings without exposing a save action. */
export function DonationCsvReview() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DonationCsvPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmationAttempted, setConfirmationAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<DonationCsvConfirmation | null>(null);
  const [reviewRejected, setReviewRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  // Prevent double submissions before React can disable the button.
  const inFlight = useRef(false);

  function clearReview() {
    // A pending response from an earlier file must never resurrect its
    // proposals or acknowledgment after cancel, selection or re-upload.
    requestVersion.current += 1;
    setPreview(null);
    setAcknowledged(false);
    setLoading(false);
    setError(null);
    setReviewRejected(false);
    setConfirmation(null);
    setConfirmationAttempted(false);
    inFlight.current = false;
  }

  async function confirm() {
    if (!file || !preview?.review_token || preview.errors.length || confirmation
      || reviewRejected || (preview.warnings.length && !acknowledged) || inFlight.current) return;
    inFlight.current = true;
    const version = requestVersion.current;
    setConfirming(true);
    // Once sent, even an error cannot establish that the server did not commit.
    setConfirmationAttempted(true);
    setError(null);
    try {
      const result = await confirmDonationCsv(file, preview.review_token, acknowledged);
      if (version === requestVersion.current) setConfirmation(result);
    } catch (failure) {
      if (version === requestVersion.current) {
        if (failure instanceof DonationCsvReviewRejected) {
          setReviewRejected(true);
          setError(failure.message);
        } else {
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
    // Even the same filename can carry changed cells; always request a fresh
    // server review and require fresh acknowledgment of its warning set.
    clearReview();
    inFlight.current = true;
    const version = requestVersion.current;
    setLoading(true);
    try {
      const next = await previewDonationCsv(file);
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
    <section aria-labelledby="donation-csv-review-title"
      className="mb-6 min-w-0 max-w-full rounded-md border border-msscc-gray-light p-4 [overflow-wrap:anywhere]">
      <h2 id="donation-csv-review-title" className="font-heading text-heading-3 text-msscc-teal">
        Review donation CSV
      </h2>
      <p className="mt-2 text-body-sm">
        Upload the fixed donation template to review proposed records. Only Confirm saves a batch.
      </p>
      <label htmlFor="donation-csv-file" className="mt-4 block text-body-sm">Donation CSV file</label>
      <input id="donation-csv-file" type="file" accept=".csv,text/csv"
        className="mt-2 block w-full min-w-0 max-w-full text-body-sm"
        disabled={confirming || (confirmationAttempted && !reviewRejected && !confirmation)}
        onChange={(event) => {
          // Changing the picker makes the previously displayed review stale.
          clearReview();
          setFile(event.target.files?.[0] ?? null);
        }} />
      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={!file || loading || confirming ||
          (confirmationAttempted && !reviewRejected && !confirmation)}
          onClick={() => void upload()}
          className="w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto">
          {loading ? 'Reviewing CSV…' : 'Upload and review CSV'}
        </button>
        {(preview || error) && <button type="button" disabled={confirming ||
          (confirmationAttempted && !reviewRejected && !confirmation)} onClick={clearReview}
          className="w-full rounded-md border border-msscc-gray-light px-4 py-2 sm:w-auto">
          Cancel review
        </button>}
      </div>
      {error && <p role="alert" className="mt-3 text-msscc-danger">{error}</p>}
      {preview && <div className="mt-6 min-w-0 max-w-full [overflow-wrap:anywhere]">
        <p>Donation preview: {preview.row_count} data rows, {preview.proposed_records.length} valid proposals.</p>
        {preview.errors.length > 0 && <div role="alert" className="mt-3">
          {/* Only the source CSV can be corrected; do not permit editing a
              browser copy of facts that the backend has not revalidated. */}
          <h3>Errors: correct the source CSV and re-upload it.</h3>
          <ul className="list-disc pl-5">{preview.errors.map((issue, index) => (
            <li key={`${issue.row}-${issue.field}-${index}`}>
              Row {issue.row}, {issue.field}: {issue.message}
            </li>
          ))}</ul>
        </div>}
        {preview.warnings.length > 0 && <div className="mt-3">
          <h3>Potential duplicates (not confirmed matches)</h3>
          <ul className="list-disc pl-5">{preview.warnings.map((issue, index) => (
            <li key={`${issue.row}-${issue.reason}-${index}`}>Row {issue.row}: {issue.message}</li>
          ))}</ul>
          <label className="mt-3 flex gap-2">
            <input type="checkbox" checked={acknowledged}
              disabled={confirming || (confirmationAttempted && !reviewRejected && !confirmation)}
              onChange={(event) => setAcknowledged(event.target.checked)} />
            I have reviewed these donation warnings.
          </label>
        </div>}
        {/* The ten columns cannot fit on a phone. Let the table grow to its
            readable intrinsic width and scroll ONLY this bounded region; min-w-full
            alone squeezed each header into a one-letter-wide vertical column.
            React renders uploaded contact text literally, never as HTML or links. */}
        <p id="donation-csv-scroll-hint" className="mt-4 text-body-sm">
          Scroll sideways to review all donation columns.
        </p>
        <div role="region" aria-label="Donation CSV proposals" tabIndex={0}
          aria-describedby="donation-csv-scroll-hint"
          className="mt-2 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
          <table className="w-max min-w-full border-collapse text-left text-body-sm">
            <caption className="whitespace-nowrap text-left">
              Backend-validated donation proposals (read only)
            </caption>
            <thead><tr><th scope="col" className="whitespace-nowrap p-2">CSV row</th>{HEADERS.map((field) => (
              <th scope="col" key={field} className="whitespace-nowrap p-2">{field}</th>
            ))}</tr></thead>
            <tbody>{preview.proposed_records.map((proposal) => (
              <tr key={proposal.row} className="border-t border-msscc-gray-light">
                <th scope="row" className="p-2">{proposal.row}</th>
                {HEADERS.map((field) => (
                  <td key={field} className="max-w-64 whitespace-pre-wrap break-words p-2">
                    {proposal.values[field] === null || proposal.values[field] === undefined
                      ? 'Unknown' : String(proposal.values[field])}
                  </td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
        {!confirmation && <p role="status" className="mt-4">
          {reviewRejected ? 'This review did not save donations. Upload and review again.'
            : confirmationAttempted ? 'Confirmation may have saved donations; retry with the same file to check.'
              : 'Review only; no donations have been saved.'}
          {preview.errors.length > 0 ? ' Errors require correction and re-upload.' : ''}
          {preview.warnings.length > 0 && !acknowledged
            ? ' Acknowledge warnings before confirmation.' : ''}
        </p>}
        {/* The signed review is only a prerequisite. The backend rechecks the
            file, reviewer, warnings and all financial facts before saving. */}
        {!confirmation && !reviewRejected && preview.review_token && preview.errors.length === 0 && (
          <button type="button" onClick={() => void confirm()} disabled={confirming ||
            (preview.warnings.length > 0 && !acknowledged)}
            className="mt-4 w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto">
            {confirming ? 'Confirming…' : 'Confirm donation import'}
          </button>
        )}
        {confirmation && <p role="status" className="mt-4">
          {confirmation.already_imported ? 'This batch was already imported.' : 'Donation batch saved.'}
          {' '}Batch {confirmation.batch_id}: {confirmation.created_count} donations.
        </p>}
      </div>}
    </section>
  );
}