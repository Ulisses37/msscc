'use client';

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/utils/formatCurrency";

export type DonationEntry = {
  donation_id: number;
  donor_first_name: string;
  donor_last_name: string;
  donor_email: string;
  amount: number | string;
  donation_date: string;
  is_anonymous: boolean;
  message: string;
  payment_status: string;
  reference_id: string;
  created_at: string;
};

type DonationDetailDrawerProps = {
  donation: DonationEntry;
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
  const sectionId = `donation-${title.toLocaleLowerCase().replaceAll(" ", "-")}`;

  return (
    <section className="min-w-0" aria-labelledby={sectionId}>
      <h3
        id={sectionId}
        className="border-b-2 border-msscc-pink-light pb-2 font-heading text-heading-3 text-msscc-teal"
      >
        {title}
      </h3>
      <dl>{children}</dl>
    </section>
  );
}

export function DonationDetailDrawer({ donation, onClose }: DonationDetailDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const hasEmail = Boolean(donation.donor_email?.trim());

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!portalTarget) return;

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
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      previouslyFocusedElement?.focus();
    };
  }, [onClose, portalTarget]);

  if (!portalTarget) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-[100dvw] max-w-[100dvw] justify-end overflow-hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/45"
        onClick={onClose}
        aria-label="Close donation details"
        tabIndex={-1}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-detail-title"
        className="relative flex h-full w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-msscc-white sm:max-w-xl sm:border-l sm:border-msscc-gray-light"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-msscc-gray-light px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="mb-1 text-eyebrow font-semibold uppercase tracking-eyebrow text-msscc-pink-dark">Donation details</p>
            <h2 id="donation-detail-title" className="break-words font-heading text-heading-2 text-msscc-teal">
              {displayValue(`${donation.donor_first_name} ${donation.donor_last_name}`.trim())}
            </h2>
            <p className="mt-1 text-caption text-msscc-gray-mid">Donation #{donation.donation_id}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close donation details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-msscc-gray-light text-2xl leading-none text-msscc-gray-mid transition-colors hover:border-msscc-pink hover:text-msscc-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-msscc-pink"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <div className="min-h-0 min-w-0 flex-1 space-y-7 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          <DetailSection title="Donor">
            <DetailField label="First name" value={donation.donor_first_name} />
            <DetailField label="Last name" value={donation.donor_last_name} />
            <DetailField label="Email" value={donation.donor_email} />
            <DetailField label="Anonymous" value={donation.is_anonymous ? "Yes" : "No"} />
          </DetailSection>

          <DetailSection title="Donation">
            <DetailField label="Date" value={formatDate(donation.donation_date)} />
            <DetailField label="Amount" value={formatCurrency(Number(donation.amount))} />
            <DetailField label="Message" value={donation.message} preserveWhitespace />
          </DetailSection>

          <DetailSection title="Payment">
            <DetailField label="Payment status" value={donation.payment_status} />
            <DetailField label="Reference ID" value={donation.reference_id} />
          </DetailSection>

          <DetailSection title="Record information">
            <DetailField label="Donation ID" value={donation.donation_id} />
            <DetailField label="Created" value={formatDateTime(donation.created_at)} />
          </DetailSection>
        </div>

        <footer className="shrink-0 border-t border-msscc-gray-light bg-msscc-white px-4 py-3 sm:px-6 sm:py-4">
          <button
            type="button"
            disabled
            title={hasEmail ? "Email action coming soon" : "No email address is available"}
            className="w-full rounded-md bg-msscc-pink px-4 py-3 text-btn tracking-btn text-msscc-white opacity-55 disabled:cursor-not-allowed"
          >
            {hasEmail ? "Email donor" : "Email unavailable"}
          </button>
          <p className="mt-2 text-center text-caption text-msscc-gray-mid">Donor email actions are coming soon.</p>
        </footer>
      </aside>
    </div>,
    portalTarget,
  );
}
