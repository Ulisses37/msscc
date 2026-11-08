'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { confirmDonationCsv, DonationCsvReviewRejected, previewDonationCsv } from '@/services/donationImportPreview';
import { fetchSavedDonation } from '@/services/manualDonation';
import type { DonationCsvConfirmation, DonationCsvPreview } from '@/services/donationImportPreview';
import type { DonationEntry } from '@/components/admin/DonationDetailDrawer';

// The server owns parsing; this order only labels normalized, authorized data.
// It must stay aligned with the donation-only template and contract tests.
const HEADERS = [
  'amount', 'donation_date', 'is_anonymous', 'payment_method',
  'donor_first_name', 'donor_last_name', 'donor_email', 'address',
  'external_reference', 'message',
] as const;

interface DonationCsvReviewProps {
  embedded?: boolean;
  onConfirmed: () => void;
  onViewSavedDonation: (donation: DonationEntry) => void;
}

/** Review donations and use the server's receipt to inspect saved records. */
export function DonationCsvReview({ embedded = false, onConfirmed, onViewSavedDonation }: DonationCsvReviewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DonationCsvPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmationAttempted, setConfirmationAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<DonationCsvConfirmation | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailInFlight = useRef(false);
  const [reviewRejected, setReviewRejected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const requestVersion = useRef(0);
  // Prevent double submissions before React can disable the button.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!reviewOpen) return;
    // The portal keeps the wide CSV table out of the page layout. Restore the
    // previous scroll state and focus even when success removes the trigger.
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const uploadButton = uploadRef.current;
    const reopenButton = reopenRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setPortalTarget(document.body);
    return () => {
      document.body.style.overflow = previousOverflow;
      (previousFocus?.isConnected ? previousFocus
        : reopenButton?.isConnected ? reopenButton : uploadButton)?.focus();
    };
  }, [reviewOpen]);

  useEffect(() => {
    if (portalTarget && reviewOpen) headingRef.current?.focus();
  }, [portalTarget, reviewOpen]);

  function closeDialog() {
    // A pending confirmation may already have committed. Do not dismiss the
    // only retry context before its response is known.
    if (!inFlight.current) setReviewOpen(false);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
    );
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first
      || document.activeElement === headingRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
    setSelectedImportId(null);
    setLoadingDetail(false);
    setDetailError(null);
    detailInFlight.current = false;
    setConfirmationAttempted(false);
    setReviewOpen(false);
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
      if (version === requestVersion.current) {
        setConfirmation(result);
        setReviewOpen(false);
        setSelectedImportId(result.donation_ids[0]);
        // A retry that returns an existing batch is still a successful receipt:
        // refresh the active list rather than assuming its cached rows include it.
        onConfirmed();
      }
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

  async function viewImportedDonation() {
    if (!confirmation || selectedImportId === null || detailInFlight.current
      || !confirmation.donation_ids.includes(selectedImportId)) return;
    detailInFlight.current = true;
    const version = requestVersion.current;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      // A receipt contains IDs, not display data. The authorized detail API
      // returns current saved facts even if search/pagination hides this row.
      const donation = await fetchSavedDonation(selectedImportId);
      if (version === requestVersion.current) onViewSavedDonation(donation);
    } catch {
      if (version === requestVersion.current) {
        setDetailError('The batch was saved, but its donation details could not be loaded. Try viewing it again.');
      }
    } finally {
      if (version === requestVersion.current) {
        detailInFlight.current = false;
        setLoadingDetail(false);
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
      if (version === requestVersion.current) {
        setPreview(next);
        setReviewOpen(true);
      }
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
      className={embedded ? 'mt-5 min-w-0 max-w-full [overflow-wrap:anywhere]'
        : 'mb-6 min-w-0 max-w-full rounded-md border border-msscc-gray-light p-4 [overflow-wrap:anywhere]'}>
      <h4 id="donation-csv-review-title" className="font-heading text-lg text-msscc-teal">
        Review donation CSV
      </h4>
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
        <button ref={uploadRef} type="button" disabled={!file || loading || confirming ||
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
      {error && !reviewOpen && <p role="alert" className="mt-3 text-msscc-danger">{error}</p>}
      {preview && !confirmation && !reviewOpen && <div className="mt-4 flex flex-col items-start gap-2">
        <p role="status">{reviewRejected ? 'Review rejected; upload and review the file again.'
          : confirmationAttempted ? 'Confirmation may have saved donations; reopen the review to retry.'
            : 'Review paused; no donations have been saved.'}</p>
        {!reviewRejected && <button ref={reopenRef} type="button" onClick={() => setReviewOpen(true)}
          className="rounded-md border border-msscc-pink px-4 py-2 text-msscc-pink">
          Reopen CSV review
        </button>}
      </div>}
      {/* Keep the committed receipt outside the dialog so viewing saved details
          never stacks two overlays or depends on the filtered donations list. */}
      {confirmation && <div className="mt-4 min-w-0 [overflow-wrap:anywhere]">
        <p role="status">
          {confirmation.already_imported ? 'This batch was already imported.' : 'Donation batch saved.'}
          {' '}Batch {confirmation.batch_id}: {confirmation.created_count} donations.
        </p>
        <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <label htmlFor="donation-csv-saved-id" className="block text-body-sm">Saved donation ID</label>
            <select id="donation-csv-saved-id" value={selectedImportId ?? ''} disabled={loadingDetail}
              onChange={(event) => {
                setSelectedImportId(Number(event.target.value));
                setDetailError(null);
              }} className="mt-1 w-full max-w-full rounded-md border border-msscc-gray-light px-3 py-2">
              {confirmation.donation_ids.map((id) => <option key={id} value={id}>Donation {id}</option>)}
            </select>
          </div>
          <button type="button" disabled={loadingDetail} onClick={() => void viewImportedDonation()}
            className="rounded-md border border-msscc-gray-light px-4 py-2 disabled:opacity-50">
            {loadingDetail ? 'Loading imported donation…' : 'View imported donation'}
          </button>
        </div>
        {detailError && <p role="alert" className="mt-2 text-msscc-danger">{detailError}</p>}
      </div>}
      {preview && reviewOpen && portalTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="donation-csv-dialog-title"
            onKeyDown={handleDialogKeyDown}
            className="flex max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-6xl flex-col overflow-x-hidden overflow-y-auto rounded-md bg-msscc-white shadow-xl sm:max-h-[calc(100dvh-3rem)] sm:overflow-hidden">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-msscc-gray-light p-3 sm:p-5">
              <h2 ref={headingRef} tabIndex={-1} id="donation-csv-dialog-title"
                className="font-heading text-xl text-msscc-teal">Donation CSV review</h2>
              <button type="button" disabled={confirming} onClick={closeDialog}
                className="rounded-md border border-msscc-gray-light px-3 py-1.5 disabled:opacity-50">
                Close review
              </button>
            </header>
            {/* On phones the header, review and actions scroll together so the
                fixed title and footer cannot crowd out the proposals. On wider
                screens only the review body scrolls, keeping actions visible. */}
            <div className="min-w-0 shrink-0 sm:min-h-0 sm:flex-1 sm:shrink sm:overflow-y-auto sm:overscroll-contain">
              <div className="min-w-0 p-3 [overflow-wrap:anywhere] sm:p-5">
                {error && <p role="alert" className="mb-3 text-msscc-danger">{error}</p>}
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
                {/* The ten columns cannot fit on a phone. Give the table readable
                    widths and scroll only this region. React renders uploaded
                    contact text literally, never as HTML or links. */}
                <p id="donation-csv-scroll-hint" className="mt-4 text-body-sm">
                  Scroll sideways to review all donation columns.
                </p>
                <div role="region" aria-label="Donation CSV proposals" tabIndex={0}
                  aria-describedby="donation-csv-scroll-hint"
                  className="mt-2 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-msscc-gray-light">
                  <table className="w-max min-w-full border-collapse text-left text-body-sm">
                    <caption className="whitespace-nowrap text-left">
                      Backend-validated donation proposals (read only)
                    </caption>
                    <thead><tr><th scope="col" className="min-w-20 whitespace-nowrap bg-msscc-gray-faint p-3 sm:sticky sm:left-0 sm:z-10">CSV row</th>{HEADERS.map((field) => (
                      <th scope="col" key={field} className="min-w-36 whitespace-nowrap bg-msscc-gray-faint p-3">{field}</th>
                    ))}</tr></thead>
                    <tbody>{preview.proposed_records.map((proposal) => (
                      <tr key={proposal.row} className="border-t border-msscc-gray-light">
                        <th scope="row" className="bg-msscc-white p-3 sm:sticky sm:left-0 sm:z-10">{proposal.row}</th>
                        {HEADERS.map((field) => (
                          <td key={field} className="max-w-64 whitespace-pre-wrap break-words p-3">
                            {proposal.values[field] === null || proposal.values[field] === undefined
                              ? 'Unknown' : String(proposal.values[field])}
                          </td>
                        ))}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
            <footer className="shrink-0 border-t border-msscc-gray-light bg-msscc-white p-3 sm:p-5">
              <p role="status" className="text-body-sm">
                {reviewRejected ? 'This review did not save donations. Upload and review again.'
                  : confirmationAttempted ? 'Confirmation may have saved donations; retry with the same file to check.'
                    : 'Review only; no donations have been saved.'}
                {preview.errors.length > 0 ? ' Errors require correction and re-upload.' : ''}
                {preview.warnings.length > 0 && !acknowledged
                  ? ' Acknowledge warnings before confirmation.' : ''}
              </p>
              {/* The signed review is only a prerequisite. The backend rechecks
                  the file, reviewer, warnings and all financial facts. */}
              {!reviewRejected && preview.review_token && preview.errors.length === 0 && (
                <button type="button" onClick={() => void confirm()} disabled={confirming ||
                  (preview.warnings.length > 0 && !acknowledged)}
                  className="mt-4 w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto">
                  {confirming ? 'Confirming…' : 'Confirm donation import'}
                </button>
              )}
            </footer>
          </div>
        </div>, portalTarget,
      )}
    </section>
  );
}