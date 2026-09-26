'use client';

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/utils/formatCurrency";

export type MembershipEntry = {
  membership_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  membership_type: string;
  amount_paid: number | string;
  payment_status: string;
  reference_id: string;
  start_date: string;
  end_date: string;
  renewal_date: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type MembershipDetailDrawerProps = {
  membership: MembershipEntry;
  onClose: () => void;
};

type DetailFieldProps = {
  label: string;
  value: string | number | null | undefined;
  preserveWhitespace?: boolean;
};

function displayValue(value: DetailFieldProps["value"]): string {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "Not provided";
  }

  return String(value);
}

function formatDate(value: string): string {
  if (!value) return "Not provided";

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string): string {
  if (!value) return "Not provided";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function DetailField({ label, value, preserveWhitespace = false }: DetailFieldProps) {
  // Labels stack above values on small screens so long values never force horizontal drawer scrolling.
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 border-b border-msscc-gray-light py-3 last:border-b-0 sm:grid-cols-[minmax(6.75rem,0.8fr)_minmax(0,1.2fr)] sm:gap-3">
      <dt className="text-label uppercase tracking-label text-msscc-gray-mid">{label}</dt>
      <dd className={`min-w-0 max-w-full [overflow-wrap:anywhere] text-body-sm text-msscc-gray-dark ${preserveWhitespace ? "whitespace-pre-wrap" : ""}`}>
        {displayValue(value)}
      </dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0" aria-labelledby={`membership-${title.toLocaleLowerCase().replaceAll(" ", "-")}`}>
      <h3
        id={`membership-${title.toLocaleLowerCase().replaceAll(" ", "-")}`}
        className="border-b-2 border-msscc-pink-light pb-2 font-heading text-heading-3 text-msscc-teal"
      >
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

export function MembershipDetailDrawer({ membership, onClose }: MembershipDetailDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const expired = new Date(`${membership.end_date}T23:59:59`).getTime() < Date.now();
  const membershipStatus = expired ? "Expired" : "Active";
  const hasEmail = Boolean(membership.email?.trim());

  useEffect(() => {
    // Portaling to document.body separates the fixed drawer from wide/scrollable admin table containers.
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!portalTarget) return;

    // Treat the drawer as a modal: preserve page state, stop background scrolling, and move focus to Close.
    const previouslyFocusedElement = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      // Restore the table's prior scroll and focus behavior when the drawer is closed or unmounted.
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      previouslyFocusedElement?.focus();
    };
  }, [onClose, portalTarget]);

  if (!portalTarget) return null;

  // Dynamic viewport units keep the close button and content inside the visible mobile browser area.
  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] max-w-[100dvw] justify-end overflow-hidden" role="presentation">
      {/* The backdrop provides a pointer-based close path while the header button remains keyboard accessible. */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/45"
        onClick={onClose}
        aria-label="Close membership details"
        tabIndex={-1}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-detail-title"
        className="relative flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-msscc-white sm:max-w-xl sm:border-l sm:border-msscc-gray-light"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-msscc-gray-light px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="mb-1 text-eyebrow font-semibold uppercase tracking-eyebrow text-msscc-pink-dark">Membership details</p>
            <h2 id="membership-detail-title" className="break-words font-heading text-heading-2 text-msscc-teal">
              {displayValue(`${membership.first_name} ${membership.last_name}`.trim())}
            </h2>
            <p className="mt-1 text-caption text-msscc-gray-mid">Membership #{membership.membership_id}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close membership details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-msscc-gray-light text-2xl leading-none text-msscc-gray-mid transition-colors hover:border-msscc-pink hover:text-msscc-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-msscc-pink"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="min-h-0 min-w-0 flex-1 space-y-7 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <DetailSection title="Member">
            <DetailField label="First name" value={membership.first_name} />
            <DetailField label="Last name" value={membership.last_name} />
            <DetailField label="Email" value={membership.email} />
            <DetailField label="Phone" value={membership.phone} />
          </DetailSection>

          <DetailSection title="Membership">
            <DetailField label="Type" value={membership.membership_type} />
            <DetailField label="Start date" value={formatDate(membership.start_date)} />
            <DetailField label="End date" value={formatDate(membership.end_date)} />
            <DetailField label="Renewal date" value={formatDate(membership.renewal_date)} />
            <DetailField label="Current status" value={membershipStatus} />
            <DetailField label="Record status" value={membership.status} />
          </DetailSection>

          <DetailSection title="Payment">
            <DetailField label="Amount paid" value={formatCurrency(Number(membership.amount_paid))} />
            <DetailField label="Payment status" value={membership.payment_status} />
            <DetailField label="Reference ID" value={membership.reference_id} />
          </DetailSection>

          <DetailSection title="Additional information">
            <DetailField label="Notes" value={membership.notes} preserveWhitespace />
          </DetailSection>

          <DetailSection title="Record information">
            <DetailField label="Membership ID" value={membership.membership_id} />
            <DetailField label="Created" value={formatDateTime(membership.created_at)} />
            <DetailField label="Updated" value={formatDateTime(membership.updated_at)} />
          </DetailSection>
        </div>

        <footer className="shrink-0 border-t border-msscc-gray-light bg-msscc-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled
              title={hasEmail ? "Email action coming soon" : "No email address is available"}
              className="rounded-md bg-msscc-pink px-4 py-3 text-btn tracking-btn text-msscc-white opacity-55 disabled:cursor-not-allowed"
            >
              {hasEmail ? "Email member" : "Email unavailable"}
            </button>
            <button
              type="button"
              disabled
              title="Cancellation action coming soon"
              className="rounded-md border border-msscc-danger px-4 py-3 text-btn tracking-btn text-msscc-danger opacity-55 disabled:cursor-not-allowed"
            >
              Mark as cancelled
            </button>
          </div>
          <p className="mt-2 text-center text-caption text-msscc-gray-mid">Member actions are coming soon.</p>
        </footer>
      </aside>
    </div>,
    portalTarget,
  );
}
