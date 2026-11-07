'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVisibleTableRevisionPolling } from '@/hooks/useVisibleTableRevisionPolling';
import { fetchFinancialRecords } from '@/services/financialRecordSearch';
import { fetchSavedDonation } from '@/services/manualDonation';
import { downloadDonationImportTemplate } from '@/services/donationImportTemplate';
import { ManualDonationForm } from '@/components/admin/ManualDonationForm';
import { DonationCsvReview } from '@/components/admin/DonationCsvReview';
import { DataExportMenu, type ExportFieldOption, type ExportFormat } from "@/components/admin/DataExportMenu";
import { DonationDetailDrawer, type DonationEntry } from "@/components/admin/DonationDetailDrawer";
import { PostPages } from "@/components/content/Pagination";
import { PostTable, PostTableColumn, SortDirection } from "@/components/content/PostGeneratedData";
import { downloadCsv, type CsvColumn } from "@/utils/exportCsv";
import { downloadXlsx, type XlsxCell, type XlsxColumn } from "@/utils/exportXlsx";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDonationName } from "@/utils/formatDonationName";

type SortColumn =
  | "donor_last_name"
  | "amount"
  | "donation_date"
  | "payment_status";

// This ordered catalog supplies both the field checkboxes and the exported column headings.
// keyof keeps every selectable field tied to an actual value returned by the donation API.
const donationExportFields: ExportFieldOption<keyof DonationEntry>[] = [
  { key: "donation_id", label: "Donation ID" },
  { key: "donor_first_name", label: "First name" },
  { key: "donor_last_name", label: "Last name" },
  { key: "donor_email", label: "Email" },
  { key: "amount", label: "Base donation" },
  { key: "processing_cost_contribution", label: "Processing-cost contribution" },
  { key: "total_amount", label: "Total payment" },
  { key: "donation_date", label: "Donation date" },
  { key: "is_anonymous", label: "Anonymous" },
  { key: "message", label: "Message" },
  { key: "payment_status", label: "Payment status" },
  { key: "reference_id", label: "Reference ID" },
  { key: "created_at", label: "Created at" },
];

// Preserve the existing default export columns for downstream consumers;
// admins can explicitly select contribution and total when reconciling payments.
const defaultDonationExportFields: (keyof DonationEntry)[] = [
  "donation_date",
  "donor_first_name",
  "donor_last_name",
  "payment_status",
  "amount",
];

// Spreadsheet widths are defined per API field because XLSX columns need explicit readable sizing.
const donationExportColumnWidths: Partial<Record<keyof DonationEntry, number>> = {
  donation_id: 15,
  donor_first_name: 18,
  donor_last_name: 18,
  donor_email: 30,
  amount: 16,
  processing_cost_contribution: 22,
  total_amount: 18,
  donation_date: 16,
  is_anonymous: 14,
  message: 40,
  payment_status: 18,
  reference_id: 22,
  created_at: 22,
};

// Parse date-only API values in local time so spreadsheet dates do not shift across time zones.
function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Number.isNaN(date.getTime()) ? null : date;
}

// Convert API values to native spreadsheet cell types so Excel can sort and format them correctly.
// Unparseable values fall back to text rather than being dropped from the export.
function createDonationXlsxCell(donation: DonationEntry, field: keyof DonationEntry): XlsxCell {
  const value = donation[field];

  if (value === null || value === undefined || value === "") return null;

  if (field === "donation_id") {
    return { value: Number(value), type: Number, format: "0" };
  }

  // Preserve numeric currency cells for all three saved amounts; exporting
  // fees as text would prevent spreadsheet reconciliation and summation.
  if (field === "amount" || field === "processing_cost_contribution" || field === "total_amount") {
    const amount = Number(value);

    return Number.isFinite(amount)
      ? { value: amount, type: Number, format: "[$$-409]#,##0.00" }
      : { value: String(value), type: String, format: "@" };
  }

  if (field === "donation_date") {
    const date = parseDateOnly(String(value));

    return date
      ? { value: date, type: Date, format: "mm/dd/yyyy" }
      : { value: String(value), type: String, format: "@" };
  }

  if (field === "created_at") {
    const date = new Date(String(value));

    return Number.isNaN(date.getTime())
      ? { value: String(value), type: String, format: "@" }
      : { value: date, type: Date, format: "mm/dd/yyyy h:mm AM/PM" };
  }

  if (field === "is_anonymous") {
    return { value: Boolean(value), type: Boolean };
  }

  return {
    value: String(value),
    type: String,
    format: "@",
    wrap: field === "message",
    alignVertical: field === "message" ? "top" : "center",
  };
}

  //Will Host entire data set, pulled from backend, to be dispersed to table and page functions.
export default function AdminDonationsPage() {
  const [isAddingDonation, setIsAddingDonation] = useState(false);
  // Template failures belong to the import section, not the existing table or
  // single-record form; keep their loading/error state independent.
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [creationMessage, setCreationMessage] = useState<string | null>(null);
  const [savedDonationId, setSavedDonationId] = useState<number | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const detailRequestStarted = useRef(false);
  const [error, setError] = useState<string | null>("Error: List Failed to Load Properly");
  const [donationItems, setDonationItems] = useState<DonationEntry[]>([]);
  // Controlled input state keeps the visible search value and table filter in sync.
  const [searchQuery, setSearchQuery] = useState("");
  const requestVersion = useRef(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  // Keep the complete selected API record so the drawer always shows data from the row the admin chose.
  const [selectedDonation, setSelectedDonation] = useState<DonationEntry | null>(null);
  // Export preferences live on the page while the reusable menu only renders and updates the controls.
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [selectedExportFields, setSelectedExportFields] = useState<(keyof DonationEntry)[]>(defaultDonationExportFields);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const pageSizeOptions = [5, 10, 15, 20];

  //Maps to PostGeneratedData.tsx, defines the columns to be displayed in the table, their headers, widths, and any custom rendering logic.
  const columns: PostTableColumn<DonationEntry, SortColumn>[] = [
    { key: "donation_date", header: "Date", width: 150 },
    // Anonymous rows have no last name; ordinary rows keep Last, First.
    { key: "donor_last_name", header: "Name", width: 220, render: (_value, donation) => formatDonationName(donation) },
    { key: "payment_status", header: "Payment Status", width: 200 },
    { key: "amount", header: "Amount", width: 180, render: (value) => formatCurrency(Number(value)) },
  ];

  const paginate = (entries: DonationEntry[], currentPage: number, itemsPerPage: number): DonationEntry[] => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return entries.slice(startIndex, startIndex + itemsPerPage);
    };

    const fetchDonations = useCallback(async () => {
      const version = ++requestVersion.current;
      setError(null);
      try {
        const items = await fetchFinancialRecords<DonationEntry>('donations', searchQuery);
        if (version === requestVersion.current) setDonationItems(items);
      } catch (err) {
        if (version === requestVersion.current) {
          setError(err instanceof Error ? err.message : 'Unable to load donation list.');
        }
      }
    }, [searchQuery]);

    useVisibleTableRevisionPolling('donations', fetchDonations, 3000, isAddingDonation);

    // Matching happens only in the authorized backend; sorting and export use its results.
    const filteredDonationItems = donationItems;

    const sortedDonationItems = useMemo(() => {
      if (sortColumn === null) {
        return filteredDonationItems;
      }

      const sortedItems = [...filteredDonationItems];

      sortedItems.sort((x, y) => {
        const direction = sortDirection === "ascending" ? 1 : -1;

        switch (sortColumn) {
          case "donation_date":
            return direction * (
              new Date(x.donation_date).getTime() -
              new Date(y.donation_date).getTime()
            );

          case "donor_last_name": {
            const xName = formatDonationName(x);
            const yName = formatDonationName(y);

            return direction * xName.localeCompare(yName);
          }

          case "payment_status":
            return direction * x.payment_status.localeCompare(
              y.payment_status,
            );

          case "amount":
            return direction * (Number(x.amount) - Number(y.amount));

          default:
            return 0;
        }
      });

      return sortedItems;
    }, [filteredDonationItems, sortColumn, sortDirection]);

    function handleSort(column: SortColumn){
      setCurrentPage(1);
      if (sortColumn === column) {
        setSortDirection((currentDirection) => currentDirection === "ascending" ? "descending" : "ascending");
      } else {
        setSortDirection("ascending");
      }
      setSortColumn(column);
    }

    function handleItemsPerPageChange(nextItemsPerPage: number) {
      setItemsPerPage(nextItemsPerPage);
      setCurrentPage(1);
    }

    function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
      setSearchQuery(event.target.value);
      // Start at the first page so a valid result is not hidden on a later page.
      setCurrentPage(1);
    }

    async function handleExport(format: ExportFormat, fields: (keyof DonationEntry)[]) {
      setExportError(null);
      // Preserve the field-picker order and translate API keys into administrator-friendly headings.
      const selectedFieldOptions = fields.map((field) => {
        const fieldOption = donationExportFields.find((option) => option.key === field);

        return {
          field,
          header: fieldOption?.label ?? String(field),
        };
      });
      const now = new Date();
      const dateStamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      if (format === "csv") {
        const selectedColumns: CsvColumn<DonationEntry>[] = selectedFieldOptions.map(({ field, header }) => ({
          header,
          getValue: (donation) => donation[field],
        }));

        // Export the complete filtered/sorted result set, not only the currently paginated table page.
        downloadCsv(`donations-${dateStamp}.csv`, sortedDonationItems, selectedColumns);
        return;
      }

      const selectedColumns: XlsxColumn<DonationEntry>[] = selectedFieldOptions.map(({ field, header }) => ({
        header,
        width: donationExportColumnWidths[field] ?? 20,
        getCell: (donation) => createDonationXlsxCell(donation, field),
      }));

      // XLSX generation loads an additional browser library, so expose progress and recoverable errors.
      setIsExporting(true);
      try {
        await downloadXlsx(`donations-${dateStamp}.xlsx`, "Donations", sortedDonationItems, selectedColumns);
      } catch (err) {
        console.error("Unable to export donations as XLSX.", err);
        setExportError("Unable to create the XLSX export. Please try again.");
      } finally {
        setIsExporting(false);
      }
    }

    const closeDonationDetails = useCallback(() => {
      // Clearing the selection unmounts the drawer without changing the donation or table data.
      setSelectedDonation(null);
    }, []);

    async function viewSavedDonation() {
      if (savedDonationId === null || detailRequestStarted.current) return;
      detailRequestStarted.current = true;
      setIsLoadingSaved(true);
      setDetailError(null);
      try {
        setSelectedDonation(await fetchSavedDonation(savedDonationId));
      } catch {
        setDetailError(
          'The record was saved, but its details could not be loaded. Please try again.',
        );
      } finally {
        detailRequestStarted.current = false;
        setIsLoadingSaved(false);
      }
    }

    useEffect(() => {
      const timer = setTimeout(() => void fetchDonations(), 300);
      return () => {
        clearTimeout(timer);
        requestVersion.current += 1;
      };
    }, [fetchDonations]);

    useEffect(() => {
      setTotalPages(Math.max(1, Math.ceil(filteredDonationItems.length / itemsPerPage)));
    }, [filteredDonationItems, itemsPerPage]);

    useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
      if (currentPage < 1) {
        setCurrentPage(1);
      }
    }, [currentPage, totalPages]);

    const hasDonations = donationItems.length > 0 || Boolean(searchQuery);
    const hasSearchResults = sortedDonationItems.length > 0;

  return(
    <div className="min-h-screen bg-msscc-white p-0 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-[1.75rem] text-msscc-teal sm:text-display">View Donations</h1>
      </header>

      <main className="w-full">
        {/* Put import instructions alongside the existing donation workflow,
            but do not couple this header-only download to record export. */}
        <section aria-labelledby="donation-import-template-title"
          className="mb-6 min-w-0 max-w-full rounded-md border border-msscc-gray-light p-4 [overflow-wrap:anywhere]">
          <h2 id="donation-import-template-title" className="font-heading text-heading-3 text-msscc-teal">
            Donation CSV import template
          </h2>
          <p className="mt-2 text-body-sm">
            Download the fixed, donation-only CSV template. Keep all ten columns in order; one data row
            represents one already-received offline or historical donation. This is not the configurable
            CSV/XLSX record export. Downloading the template does not save donations.
          </p>
          <p className="mt-2 text-body-sm">Exact ordered columns:</p>
          {/* The ten-column header is meant to be copied verbatim; horizontal
              scrolling avoids wrapping commas into confusing mobile lines. */}
          <p className="mt-1 max-w-full overflow-x-auto whitespace-nowrap text-body-sm">
            <code>amount,donation_date,is_anonymous,payment_method,donor_first_name,donor_last_name,donor_email,address,external_reference,message</code>
          </p>
          <p className="mt-2 text-body-sm">
            Required: amount (known, positive USD decimal up to 99,999,999.99), donation_date
            (YYYY-MM-DD, or US month-first MM-DD-YYYY or MM/DD/YYYY, not in the future), and is_anonymous
            (true or false in any letter case; surrounding
            spaces are ignored). Blank, yes, no, and unknown are not accepted. Amounts allow up to two
            decimal places, without currency symbols, thousands separators, or exponent notation.
            Payment status is always completed because these payments have already been received; it is
            not a CSV column. Currency is USD. No online processing fees are calculated.
          </p>
          <p className="mt-2 text-body-sm">
            Optional: payment_method (cash or check, or blank if unknown), donor_first_name,
            donor_last_name, donor_email, address, external_reference, and message. Blank historical
            contact details remain unknown and do not make a non-anonymous donation anonymous.
            Anonymous donations retain no donor names or address, so leave those cells blank; an
            optional email may still be retained internally. The template contains no example people.
          </p>
          <p className="mt-2 text-body-sm">
            UTF-8 CSV limit: 1,048,576 bytes and 500 data rows. Cell character limits: amount 11,
            donation_date 10, is_anonymous 32 before normalization, payment_method 20, donor names 255 each,
            donor_email 254, address 500, external_reference 255, and message 500.
            This import does not charge payments, send receipts, or enroll anyone in a mailing list.
          </p>
          <p className="mt-2 text-body-sm">
            Fill the template and upload it below for a read-only review. Correct errors in the
            source CSV and re-upload; warnings may indicate repeated or possible existing gifts,
            but an email match alone is not proof. Review and acknowledge warnings explicitly.
            Only Confirm saves the entire reviewed batch. The manual donation form below is for
            a single record, not a CSV upload.
          </p>
          <p className="mt-2 text-body-sm">
            Team setup, the complete CSV field guide, and the planned workflow are tracked in
            docs/donation-csv-import.md. This page and the CSV template are supplied by application
            code, not seeded database content.
          </p>
          {/* The backend owns both the header order and the authorization check;
              never build a template from the unrelated configurable export. */}
          <button type="button" disabled={isDownloadingTemplate}
            className="mt-4 w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto"
            onClick={async () => {
              // A failed private request should clear only this section's
              // message; it must not disturb a saved donation or table filter.
              setTemplateError(null);
              setIsDownloadingTemplate(true);
              try {
                await downloadDonationImportTemplate();
              } catch {
                setTemplateError('Unable to download the template. Check your finance access and try again.');
              } finally {
                setIsDownloadingTemplate(false);
              }
            }}>
            {isDownloadingTemplate ? 'Downloading template…' : 'Download donation CSV template'}
          </button>
          {templateError && <p role="alert" className="mt-2 text-msscc-danger">{templateError}</p>}
        </section>
        {/* Review is read-only and stays separate from the existing single-record
            form and configurable exports. No callback here can save a batch. */}
        <DonationCsvReview />
        {creationMessage && <p role="status" className="mb-4">{creationMessage}</p>}
        {savedDonationId !== null && (
          <button type="button" onClick={() => void viewSavedDonation()}
            disabled={isLoadingSaved}
            className="mb-4 rounded-md border border-msscc-gray-light px-4 py-2 disabled:opacity-50">
            {isLoadingSaved ? 'Loading saved donation…' : 'View saved donation'}
          </button>
        )}
        {detailError && <p role="alert" className="mb-4 text-msscc-danger">{detailError}</p>}
        {!isAddingDonation ? (
          <button type="button" onClick={() => setIsAddingDonation(true)}
            className="mb-4 rounded-md bg-msscc-pink px-4 py-2 text-msscc-white focus-visible:ring-2 focus-visible:ring-msscc-pink">
            Add donation
          </button>
        ) : (
          <ManualDonationForm onCancel={() => setIsAddingDonation(false)}
            onCreated={({ donationId }) => {
              setIsAddingDonation(false);
              setCreationMessage('Donation record saved.');
              setSavedDonationId(donationId);
              setDetailError(null);
              void fetchDonations();
            }} />
        )}
        {error && <div className="text-red-600 mb-4">Error: {error}</div>}
                {exportError && <div role="alert" className="mb-4 border border-msscc-danger bg-red-50 p-4 text-msscc-danger">{exportError}</div>}
                {!hasDonations && !error && <div className="border border-dashed border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">No donations found.</div>}
                {hasDonations && (
                  <>
                    {/* Stack search and export controls on small screens, then align them on wider screens. */}
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="w-full max-w-sm">
                        <label htmlFor="donation-search" className="mb-2 block text-label uppercase tracking-label text-msscc-gray-mid">
                          Search donations
                        </label>
                        {/* The relative wrapper anchors the decorative icon while the input remains full-width and labeled. */}
                        <div className="relative">
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-msscc-gray-mid">
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-4-4" />
                          </svg>
                          <input
                            id="donation-search"
                            type="search"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            placeholder="Search donations..."
                            className="w-full rounded-md border border-msscc-gray-light bg-msscc-white py-2.5 pl-9 pr-3 text-body-sm text-msscc-gray-dark outline-none placeholder:text-msscc-gray-mid focus:border-msscc-pink focus:shadow-focus-admin"
                          />
                        </div>
                        <p className="mt-1 text-body-sm text-msscc-gray-mid">
                          Search by name or email. Up to 100 matches are shown and exported.
                        </p>
                      </div>
                      {/* The shared menu connects format/field controls to this page's donation export handler. */}
                      <DataExportMenu
                        entityLabel="donations"
                        fields={donationExportFields}
                        format={exportFormat}
                        selectedFields={selectedExportFields}
                        onFormatChange={setExportFormat}
                        onSelectedFieldsChange={setSelectedExportFields}
                        onExport={handleExport}
                        isExportDisabled={!hasSearchResults}
                        isExporting={isExporting}
                      />
                    </div>
                    {/* Keep the search control visible while replacing an empty result table with clear feedback. */}
                    {hasSearchResults ? (
                      <>
                        {/* Stable backend IDs keep the visual selection attached to the correct row after sorting. */}
                        <PostTable
                          dataEntries={paginate(sortedDonationItems, currentPage, itemsPerPage)}
                          columns={columns}
                          selectedColumn={sortColumn}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                          getRowKey={(donation) => donation.donation_id}
                          isRowSelected={(donation) => donation.donation_id === selectedDonation?.donation_id}
                          onRowSelect={setSelectedDonation}
                        />
                        <PostPages currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} pageSizeOptions={pageSizeOptions} onItemsPerPageChange={handleItemsPerPageChange} />
                      </>
                    ) : (
                      <div className="border border-dashed border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">
                        No matching donations found.
                      </div>
                    )}
                  </>)
                }
      </main>

      {/* Only mount the viewport-level drawer after a row has supplied its donation record. */}
      {selectedDonation && (
        <DonationDetailDrawer
          donation={selectedDonation}
          onClose={closeDonationDetails}
        />
      )}
    </div>
  );
}
