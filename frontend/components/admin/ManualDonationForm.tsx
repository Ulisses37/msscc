'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { createManualDonation, ManualDonationSaveError } from '@/services/manualDonation';
import { manualDonationSchema } from '@/utils/manualDonationValidation';

import type { ManualDonationInput } from '@/types/manualDonation';

interface ManualDonationFormProps {
  onCancel: () => void;
  onCreated: (record: { donationId: number }) => void;
}

interface FieldDefinition {
  key: Exclude<keyof ManualDonationInput, 'isAnonymous' | 'currency'>;
  label: string;
  required?: boolean;
  type?: 'email' | 'date' | 'amount' | 'textarea' | 'select';
  maxLength?: number;
  identity?: boolean;
}

const FIELDS: FieldDefinition[] = [
  { key: 'amount', label: 'Donation amount (USD)', required: true, type: 'amount' },
  { key: 'donationDate', label: 'Donation date', required: true, type: 'date' },
  { key: 'paymentMethod', label: 'Payment method', type: 'select' },
  { key: 'donorFirstName', label: 'First name', maxLength: 255, identity: true },
  { key: 'donorLastName', label: 'Last name', maxLength: 255, identity: true },
  { key: 'donorEmail', label: 'Email', type: 'email', maxLength: 254 },
  { key: 'address', label: 'Address', type: 'textarea', identity: true },
  { key: 'externalReference', label: 'External reference', maxLength: 255 },
  { key: 'message', label: 'Message', type: 'textarea', maxLength: 500 },
];

const INITIAL_VALUES = {
  amount: '', donationDate: '', paymentMethod: '', donorFirstName: '', donorLastName: '',
  donorEmail: '', address: '', externalReference: '', message: '',
};
const BUTTON_CLASS = 'rounded-md border border-msscc-gray-light px-4 py-2 '
  + 'focus-visible:ring-2 focus-visible:ring-msscc-pink disabled:opacity-50';
const CONTROL_CLASS = 'mt-1 w-full rounded-md border border-msscc-gray-light p-2 '
  + 'text-msscc-gray-dark focus:outline-none focus:ring-2 focus:ring-msscc-pink';

/** Review already received donation facts before an explicit, guarded save. */
export function ManualDonationForm({ onCancel, onCreated }: ManualDonationFormProps) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [review, setReview] = useState<ManualDonationInput | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ManualDonationInput, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const submissionStarted = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setPortalTarget(document.body);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    headingRef.current?.focus();
  }, [portalTarget, review]);

  function openReview() {
    setSaveError(null);
    const result = manualDonationSchema.safeParse({
      ...values, currency: 'usd', isAnonymous, paymentMethod: values.paymentMethod || null,
      ...(isAnonymous ? { donorFirstName: null, donorLastName: null, address: null } : {}),
    });
    if (!result.success) {
      const nextErrors: Partial<Record<keyof ManualDonationInput, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ManualDonationInput;
        nextErrors[field] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setReview(result.data);
  }

  async function saveDonation() {
    if (!review || submissionStarted.current) return;
    submissionStarted.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const record = await createManualDonation(review);
      onCreated(record);
    } catch (error) {
      if (error instanceof ManualDonationSaveError) {
        setSaveError(error.message);
        if (Object.keys(error.fieldErrors).length) {
          setErrors(error.fieldErrors);
          setReview(null);
        }
      } else {
        console.error('Unable to finish the donation save interaction.');
        setSaveError('Unable to confirm the save. Check the donation list before retrying.');
      }
    } finally {
      submissionStarted.current = false;
      setIsSaving(false);
    }
  }

  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="manual-donation-title"
        aria-describedby="manual-donation-explanation" aria-busy={isSaving}
        className="flex max-h-full w-full max-w-4xl flex-col rounded-lg bg-msscc-white shadow-xl"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            if (!submissionStarted.current) onCancel();
          }
          if (event.key !== 'Tab') return;
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), '
            + 'textarea:not(:disabled)',
          );
          if (!controls?.length) {
            event.preventDefault();
            headingRef.current?.focus();
            return;
          }
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first
            || document.activeElement === headingRef.current)) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (document.activeElement === last
            || document.activeElement === headingRef.current)) {
            event.preventDefault();
            first.focus();
          }
        }}>
        <header className="shrink-0 border-b border-msscc-gray-light px-5 py-4">
          <h2 id="manual-donation-title" ref={headingRef} tabIndex={-1}
            className="font-heading text-heading-2 text-msscc-teal">
            {review ? 'Review donation' : 'Add donation'}
          </h2>
          <p id="manual-donation-explanation" className="mt-2 text-body-sm">
            Record an already received donation. This does not charge the donor, send a receipt,
            or change mailing-list subscriptions. The entered USD amount is the recorded total,
            with no added processing-cost contribution.
          </p>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">
          {saveError && <p role="alert" className="mb-4 text-msscc-danger">{saveError}</p>}
          {!review ? (
            <form id="manual-donation-entry" noValidate onSubmit={(event) => {
              event.preventDefault();
              openReview();
            }}>
              <label className="mb-3 flex items-center gap-2">
                <input type="checkbox" checked={isAnonymous}
                  onChange={(event) => setIsAnonymous(event.target.checked)} />
                Anonymous donation
              </label>
              <p className="mb-4 text-body-sm">
                Historical contact information is optional. Missing names do not mean anonymous.
                Anonymous donations retain no names or address. A supplied email may be retained
                internally in encrypted storage. Avoid identifying information in the message.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.filter((field) => !isAnonymous || !field.identity).map((field) => {
                  const id = `manual-donation-${field.key}`;
                  const controlProps = {
                    id, value: values[field.key], className: CONTROL_CLASS,
                    required: field.required,
                    'aria-invalid': Boolean(errors[field.key]),
                    'aria-describedby': errors[field.key] ? `${id}-error` : undefined,
                    onChange: (event: React.ChangeEvent<
                      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                    >) => setValues((previous) => ({ ...previous, [field.key]: event.target.value })),
                  };
                  return (
                    <div key={field.key} className="min-w-0">
                      <label htmlFor={id}>
                        {field.label} ({field.required ? 'required' : 'optional'})
                      </label>
                      {field.type === 'select' ? (
                        <select {...controlProps}>
                          <option value="">Unknown / not recorded</option>
                          <option value="cash">Cash</option>
                          <option value="check">Check</option>
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea {...controlProps} maxLength={field.maxLength} rows={3} />
                      ) : (
                        <input {...controlProps} maxLength={field.maxLength}
                          type={field.type === 'amount' ? 'text' : field.type ?? 'text'}
                          inputMode={field.type === 'amount' ? 'decimal' : undefined} />
                      )}
                      {errors[field.key] && (
                        <p id={`${id}-error`} className="mt-1 text-body-sm text-msscc-danger">
                          {errors[field.key]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </form>
          ) : (
            <section aria-label="Donation facts">
              <p className="mb-4">Nothing is created until you confirm and save.</p>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt>Anonymous</dt><dd>{review.isAnonymous ? 'Yes' : 'No'}</dd></div>
                {FIELDS.map((field) => {
                  const value = review[field.key];
                  const display = field.identity && review.isAnonymous
                    ? 'Not retained for anonymous donations'
                    : value === null || value === '' ? 'Unknown / not provided'
                      : field.key === 'amount' ? `${value} USD`
                        : field.key === 'paymentMethod' ? value === 'cash' ? 'Cash' : 'Check' : value;
                  return (
                    <div key={field.key} className="min-w-0">
                      <dt className="text-body-sm text-msscc-gray-mid">{field.label}</dt>
                      <dd className="whitespace-pre-wrap break-words">{display}</dd>
                    </div>
                  );
                })}
                <div><dt>Internal reference</dt><dd>Generated on save</dd></div>
                <div><dt>Record origin</dt><dd>Manual entry</dd></div>
                <div><dt>Payment status</dt><dd>Completed, already received</dd></div>
              </dl>
            </section>
          )}
        </div>
        <footer className="flex shrink-0 flex-wrap gap-3 border-t border-msscc-gray-light p-4">
          {!review ? (
            <button type="submit" form="manual-donation-entry"
              className={`${BUTTON_CLASS} bg-msscc-pink text-msscc-white`}>Review donation</button>
          ) : (
            <>
              <button type="button" disabled={isSaving} onClick={() => void saveDonation()}
                className={`${BUTTON_CLASS} bg-msscc-pink text-msscc-white`}>
                {isSaving ? 'Saving donation…' : 'Confirm and save donation'}
              </button>
              <button type="button" disabled={isSaving} onClick={() => setReview(null)}
                className={BUTTON_CLASS}>Back to edit</button>
            </>
          )}
          <button type="button" disabled={isSaving} onClick={onCancel}
            className={BUTTON_CLASS}>Cancel</button>
        </footer>
      </div>
    </div>,
    portalTarget,
  );
}
