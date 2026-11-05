'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { createManualMembership, ManualMembershipSaveError } from '@/services/manualMembership';
import { manualMembershipSchema } from '@/utils/manualMembershipValidation';
import {
  MANUAL_MEMBERSHIP_STATUSES,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_STATUSES,
} from '@/types/manualMembership';

import type { ManualMembershipInput } from '@/types/manualMembership';

interface ManualMembershipFormProps {
  onCancel: () => void;
  onCreated: (record: { membershipId: number }) => void;
}

interface FieldDefinition {
  key: keyof ManualMembershipInput;
  label: string;
  required?: boolean;
  type?: 'email' | 'date' | 'amount' | 'textarea';
  options?: readonly string[];
  maxLength?: number;
}

const FIELD_GROUPS: { title: string; fields: FieldDefinition[] }[] = [
  {
    title: 'Member details',
    fields: [
      { key: 'firstName', label: 'First name', required: true, maxLength: 255 },
      { key: 'lastName', label: 'Last name', required: true, maxLength: 255 },
      { key: 'email', label: 'Email', type: 'email', maxLength: 254 },
      { key: 'phone', label: 'Phone', maxLength: 255 },
      { key: 'address', label: 'Address', type: 'textarea' },
    ],
  },
  {
    title: 'Membership information',
    fields: [
      { key: 'membershipType', label: 'Membership type', required: true, maxLength: 255 },
      {
        key: 'status', label: 'Record status', required: true,
        options: MANUAL_MEMBERSHIP_STATUSES,
      },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'renewalDate', label: 'Renewal date', type: 'date' },
    ],
  },
  {
    title: 'Payment information',
    fields: [
      { key: 'membershipPrice', label: 'Membership price (USD)', type: 'amount' },
      { key: 'amountPaid', label: 'Amount paid (USD)', type: 'amount' },
      { key: 'paymentStatus', label: 'Payment status', options: MANUAL_PAYMENT_STATUSES },
      { key: 'paymentMethod', label: 'Payment method', options: MANUAL_PAYMENT_METHODS },
      { key: 'referenceId', label: 'Reference', maxLength: 255 },
      { key: 'notes', label: 'Notes', type: 'textarea', maxLength: 500 },
    ],
  },
];

const INITIAL_VALUES: Record<keyof ManualMembershipInput, string> = {
  firstName: '', lastName: '', email: '', phone: '', address: '', membershipType: '',
  status: 'unknown', membershipPrice: '', amountPaid: '', startDate: '', endDate: '',
  renewalDate: '', paymentStatus: '', paymentMethod: '', referenceId: '', notes: '',
};

const CONTROL_CLASS = 'mt-1 w-full rounded-md border border-msscc-gray-light p-2 '
  + 'text-msscc-gray-dark focus:border-msscc-pink focus:outline-none focus:ring-2 '
  + 'focus:ring-msscc-pink';
const BUTTON_CLASS = 'rounded-md border border-msscc-gray-light px-4 py-2 '
  + 'focus-visible:ring-2 focus-visible:ring-msscc-pink disabled:opacity-50';

function optionLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

/** Enter and review manual facts without checkout defaults or external-service actions. */
export function ManualMembershipForm({ onCancel, onCreated }: ManualMembershipFormProps) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof ManualMembershipInput, string>>>({});
  const [review, setReview] = useState<ManualMembershipInput | null>(null);
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
  }, [review, portalTarget]);

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!submissionStarted.current) onCancel();
    }
    if (event.key !== 'Tab') return;
    const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input, textarea, select',
    );
    if (!controls?.length) {
      event.preventDefault();
      return;
    }
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

  function reviewValues(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = manualMembershipSchema.safeParse({
      ...values,
      paymentStatus: values.paymentStatus || null,
      paymentMethod: values.paymentMethod || null,
    });
    setSaveError(null);
    if (!result.success) {
      const nextErrors: typeof errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ManualMembershipInput;
        nextErrors[key] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setReview(result.data);
  }

  async function saveMembership() {
    // State alone does not guard two clicks dispatched before React renders again.
    if (!review || submissionStarted.current) return;
    submissionStarted.current = true;
    setIsSaving(true);
    setSaveError(null);
    let record: { membershipId: number };
    try {
      record = await createManualMembership(review);
    } catch (error) {
      setSaveError(error instanceof ManualMembershipSaveError
        ? error.message : 'Unable to save the record. Your entries are preserved.');
      if (error instanceof ManualMembershipSaveError
        && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors);
        setReview(null);
      }
      submissionStarted.current = false;
      setIsSaving(false);
      return;
    }
    // Leave the guard set after success, even if the parent takes time to close the form.
    onCreated(record);
  }

  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-msscc-gray-dark/40 p-2 sm:p-6">
    <div ref={dialogRef} role="dialog" aria-modal="true"
      aria-labelledby="manual-membership-title" onKeyDown={handleDialogKeyDown}
      className="flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-msscc-gray-light bg-msscc-white sm:max-h-[calc(100dvh-3rem)]">
      <header className="shrink-0 border-b border-msscc-gray-light px-4 py-3 sm:px-5">
      <h2 id="manual-membership-title" ref={headingRef} tabIndex={-1}
        className="font-heading text-heading-2 text-msscc-teal">
        {review ? 'Review membership' : 'Add membership'}
      </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
      <p id="manual-membership-help" className="mb-2 text-body-sm">
        Enter a historical membership or a current offline payment. Required fields are marked
        “required”. Other facts are optional and may be unknown: leave them blank rather than guess.
        Choose Unknown record status if it is not known. A recorded active status with an unknown
        expiration does not establish current eligibility.
      </p>
      <p className="mb-3 text-body-sm">
        Record origin: Manual entry. Payment method is recorded separately. Saving does not process
        a payment, send a receipt, or obtain consent for or change mailing-list subscriptions.
      </p>
      {saveError && <p role="alert" className="mb-4 text-msscc-danger">{saveError}</p>}
      {!review ? (
        <form id="manual-membership-entry" noValidate onSubmit={reviewValues}
          aria-describedby="manual-membership-help">
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="mb-4 text-msscc-danger">
              Please correct the highlighted fields. Your entries have been preserved.
            </p>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-3">
          {FIELD_GROUPS.map((group) => (
            <fieldset key={group.title} className="min-w-0">
              <legend className="mb-3 w-full border-b border-msscc-gray-light pb-2 font-bold">
                {group.title}
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {group.fields.map((field) => {
                  const id = `manual-${field.key}`;
                  const controlProps = {
                    id,
                    name: field.key,
                    value: values[field.key],
                    required: field.required,
                    'aria-invalid': Boolean(errors[field.key]),
                    'aria-describedby': errors[field.key] ? `${id}-error` : undefined,
                    className: CONTROL_CLASS,
                    onChange: (event: React.ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                    >) => setValues((previous) => ({
                      ...previous, [field.key]: event.target.value,
                    })),
                  };
                  return (
                    <div key={field.key}
                      className={field.type === 'textarea' ? 'sm:col-span-2 lg:col-span-1' : ''}>
                      <label htmlFor={id} className="text-body-sm">
                        {field.label} ({field.required ? 'required' : 'optional'})
                      </label>
                      {field.options ? (
                        <select {...controlProps}>
                          {!field.required && <option value="">Unknown / not provided</option>}
                          {field.options.map((option) => (
                            <option key={option} value={option}>{optionLabel(option)}</option>
                          ))}
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
            </fieldset>
          ))}
          </div>
        </form>
      ) : (
        <div aria-busy={isSaving} className="grid items-start gap-5 lg:grid-cols-3">
          {FIELD_GROUPS.map((group) => (
            <section key={group.title} aria-label={group.title} className="min-w-0">
              <h3 className="mb-3 border-b border-msscc-gray-light pb-2 font-bold">
                {group.title}
              </h3>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {group.fields.map((field) => {
                  const value = review[field.key];
                  const display = value === null || value === ''
                    ? field.key === 'referenceId' ? 'Generated on save' : 'Unknown / not provided'
                    : field.options ? optionLabel(value) : value;
                  return (
                    <div key={field.key} className={field.type === 'textarea'
                      ? 'min-w-0 sm:col-span-2 lg:col-span-1' : 'min-w-0'}>
                      <dt className="text-body-sm text-msscc-gray-mid">{field.label}</dt>
                      <dd className="whitespace-pre-wrap break-words">{display}</dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>
      )}
      </div>
      <footer className="flex shrink-0 flex-wrap gap-3 border-t border-msscc-gray-light bg-msscc-white px-4 py-3 sm:px-5">
        {!review ? (
          <>
            <button type="submit" form="manual-membership-entry"
              className={`${BUTTON_CLASS} bg-msscc-pink text-msscc-white`}>
              Review membership
            </button>
            <button type="button" onClick={onCancel} className={BUTTON_CLASS}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" disabled={isSaving} onClick={() => void saveMembership()}
              className={`${BUTTON_CLASS} bg-msscc-pink text-msscc-white`}>
              {isSaving ? 'Saving membership…' : 'Confirm and save membership'}
            </button>
            <button type="button" disabled={isSaving} onClick={() => setReview(null)}
              className={BUTTON_CLASS}>Back to edit</button>
            <button type="button" disabled={isSaving} onClick={onCancel}
              className={BUTTON_CLASS}>Cancel</button>
          </>
        )}
      </footer>
    </div>
    </div>,
    portalTarget,
  );
}