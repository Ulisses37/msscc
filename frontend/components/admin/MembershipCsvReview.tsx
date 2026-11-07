'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const requestVersion = useRef(0);
  // The ref closes the double-click window before React re-renders the
  // disabled button; requestVersion independently rejects obsolete results.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!reviewOpen) return;
    // Use a portal so a wide CSV table cannot stretch the membership page.
    // Restore the prior scroll state and focus after dismissal, including when
    // a successful confirmation replaces the dialog with a saved-batch result.
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    const uploadButton = uploadRef.current;
    const reopenButton = reopenRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setPortalTarget(document.body);
    return () => {
      document.body.style.overflow = previousOverflow;
      // The review trigger can disappear after a successful save. Fall back
      // to the upload action, which remains mounted outside the dialog.
      (previouslyFocused?.isConnected ? previouslyFocused
        : reopenButton?.isConnected ? reopenButton : uploadButton)?.focus();
    };
  }, [reviewOpen]);

  useEffect(() => {
    if (portalTarget && reviewOpen) headingRef.current?.focus();
  }, [portalTarget, reviewOpen]);

  function closeDialog() {
    // A confirmation may have committed even before its response arrives.
    // Never hide the only retry context while that request is unresolved.
    if (!confirming) setReviewOpen(false);
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
    setReviewOpen(false);
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
        setReviewOpen(false);
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
        <button ref={uploadRef} type="button" disabled={!file || loading || confirming} onClick={() => void upload()}
          className="w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto">
          {loading ? 'Reviewing CSV…' : 'Upload and review CSV'}
        </button>
        {(preview || error || confirmation) && <button type="button" disabled={confirming} onClick={clearReview}
          className="w-full rounded-md border border-msscc-gray-light px-4 py-2 sm:w-auto">Cancel review</button>}
      </div>
      {error && !reviewOpen && <p role="alert" className="mt-3 text-msscc-danger">{error}</p>}
      {preview && !confirmation && !reviewOpen && (
        <div className="mt-4 flex flex-col items-start gap-2">
          <p role="status">
            {reviewRejected ? 'Review rejected; upload and review the file again.'
              : confirmationAttempted ? 'Confirmation may have saved records; reopen the review to retry.'
              : 'Review paused; no records have been saved.'}
          </p>
          {!reviewRejected && <button ref={reopenRef} type="button"
            onClick={() => setReviewOpen(true)}
            className="rounded-md border border-msscc-pink px-4 py-2 text-msscc-pink">
            Reopen CSV review
          </button>}
        </div>
      )}
      {/* A committed receipt stays outside the modal: saved-record buttons can
          open the existing detail drawer without creating stacked dialogs. */}
      {confirmation && <div role="status" className="mt-4 [overflow-wrap:anywhere]">
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
      {preview && reviewOpen && portalTarget && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-msscc-gray-dark/40 p-2 sm:p-6">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="csv-preview-title"
            onKeyDown={handleDialogKeyDown}
            className="flex max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-7xl flex-col overflow-x-hidden overflow-y-auto rounded-md border border-msscc-gray-light bg-msscc-white shadow-lg sm:max-h-[calc(100dvh-3rem)] sm:overflow-hidden">
            {/* A long heading and Close cannot share a phone-width row without
                clipping the button. The whole dialog scrolls on phones, so
                stacking them does not permanently take space from the table. */}
            <header className="flex min-w-0 shrink-0 flex-col items-stretch gap-3 border-b border-msscc-gray-light p-3 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <h2 id="csv-preview-title" ref={headingRef} tabIndex={-1}
                className="font-heading text-heading-3 text-msscc-teal">Review membership CSV</h2>
              <button type="button" disabled={confirming} onClick={closeDialog}
                className="w-full min-w-0 rounded-md border border-msscc-gray-light px-3 py-2 focus-visible:ring-2 focus-visible:ring-msscc-pink disabled:opacity-50 sm:w-auto sm:shrink-0">
                Close review
              </button>
            </header>
            {/* On phones the entire dialog scrolls so the tall title and save
                controls can move away from the data. At wider widths only the
                review body scrolls, keeping the actions visible. */}
            <div className="min-w-0 shrink-0 p-3 sm:min-h-0 sm:flex-1 sm:shrink sm:overflow-y-auto sm:p-5">
              <div className="min-w-0 max-w-full [overflow-wrap:anywhere]">
          <p>Membership preview: {preview.row_count} data rows, {preview.proposed_records.length} valid proposals.</p>
          {error && <p role="alert" className="mt-3 text-msscc-danger">{error}</p>}
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
          {/* A wide, fixed-layout CSV needs its own scroll container: the
              surrounding dialog and page must never expand to table width. */}
          <p id="csv-scroll-hint" className="mt-4 text-body-sm text-msscc-gray-mid">Scroll sideways to view all columns.</p>
          <div role="region" aria-label="Membership CSV proposals" aria-describedby="csv-scroll-hint"
            tabIndex={0} className="mt-2 max-w-full overflow-x-auto rounded-md border border-msscc-gray-light">
            {/* React escapes uploaded text, including tags in names/notes. Do not
                use innerHTML or let CSV values become links or executable markup. */}
            <table className="w-max min-w-full border-collapse text-left text-body-sm">
              <caption className="text-left">Backend-validated membership proposals (read only)</caption>
              {/* A sticky row label hides the first data column on phones; only
                  pin it once the viewport has room for both columns. */}
              <thead><tr><th scope="col" className="min-w-20 bg-msscc-gray-faint p-3 whitespace-nowrap sm:sticky sm:left-0 sm:z-10">CSV row</th>{HEADERS.map((field) => (
                <th scope="col" key={field} className="min-w-36 bg-msscc-gray-faint p-3 whitespace-nowrap">{field}</th>
              ))}</tr></thead>
              <tbody>{preview.proposed_records.map((proposal) => (
                <tr key={proposal.row} className="border-t border-msscc-gray-light">
                  <th scope="row" className="bg-msscc-white p-3 sm:sticky sm:left-0 sm:z-10">{proposal.row}</th>
                  {HEADERS.map((field) => (
                    <td key={field} className="max-w-64 p-3 whitespace-pre-wrap break-words">{proposal.values[field] ?? 'Unknown'}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
              </div>
            </div>
            {/* On phones this footer scrolls with the review; on wider screens
                it stays visible. The server enforces file binding and warning
                acknowledgment independently of either layout. */}
            <footer className="shrink-0 border-t border-msscc-gray-light bg-msscc-white p-3 sm:p-5">
              <p role="status" className="text-body-sm">
                {reviewRejected ? 'This review did not save records. Upload and review the file again.'
                  : confirmationAttempted ? 'Confirmation may have saved records; retry with the same file to check.'
                    : 'Review only; no records have been saved.'}
                {/* Confirmation needs a separately authorized, server-bound batch;
                    preview acknowledgment alone cannot create financial records. */}
                {preview.errors.length > 0 ? ' Errors require correction and re-upload.' : ''}
                {preview.warnings.length > 0 && !acknowledged ? ' Acknowledge warnings before future confirmation.' : ''}
              </p>
              {/* The signed review token is only a prerequisite: the backend checks
                  its owner, original file, current warnings and every row again. */}
              {!reviewRejected && preview.review_token && preview.errors.length === 0 && (
                <button type="button" onClick={() => void confirm()} disabled={confirming ||
                  (preview.warnings.length > 0 && !acknowledged)}
                  className="mt-4 w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto">
                  {confirming ? 'Confirming…' : 'Confirm membership import'}
                </button>
              )}
            </footer>
          </div>
        </div>, portalTarget,
      )}
    </section>
  );
}
