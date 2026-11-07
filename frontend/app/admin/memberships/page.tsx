'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from 'next/link';
import { useVisibleTableRevisionPolling } from '@/hooks/useVisibleTableRevisionPolling';
import { fetchFinancialRecords } from '@/services/financialRecordSearch';
import { fetchSavedMembership } from '@/services/manualMembership';
import { downloadMembershipImportTemplate } from '@/services/membershipImportTemplate';
import { ManualMembershipForm } from '@/components/admin/ManualMembershipForm';
import { MembershipCsvReview } from '@/components/admin/MembershipCsvReview';
import { DataExportMenu, type ExportFieldOption, type ExportFormat } from "@/components/admin/DataExportMenu";
import { MembershipDetailDrawer, type MembershipEntry } from "@/components/admin/MembershipDetailDrawer";
import { membershipDisplayStatus } from "@/components/admin/membershipDisplayStatus";
import { PostPages } from "@/components/content/Pagination";
import { PostTable, PostTableColumn, SortDirection } from "@/components/content/PostGeneratedData";
import { downloadCsv, type CsvColumn } from "@/utils/exportCsv";
import { downloadXlsx, type XlsxColumn } from "@/utils/exportXlsx";
import { createMembershipXlsxCell, membershipCsvValue } from '@/utils/membershipExport';
import {
  compareMembershipValues,
  formatMembershipAmount,
  formatMembershipDate,
  membershipAmount,
  parseMembershipDate,
} from '@/utils/membershipValues';

type SortColumn =
  | "last_name"
  | "membership_type"
  | "amount_paid"
  | "payment_status"
  | "start_date"
  | "end_date";

// This ordered catalog supplies both the field checkboxes and the exported column headings.
// keyof keeps every selectable field tied to an actual value returned by the membership API.
const membershipExportFields: ExportFieldOption<keyof MembershipEntry>[] = [
  { key: "membership_id", label: "Membership ID" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "membership_type", label: "Membership type" },
  { key: "amount_paid", label: "Amount paid" },
  { key: "payment_status", label: "Payment status" },
  { key: "reference_id", label: "Reference ID" },
  { key: "start_date", label: "Start date" },
  { key: "end_date", label: "End date" },
  { key: "renewal_date", label: "Renewal date" },
  { key: "status", label: "Record status" },
  { key: "notes", label: "Notes" },
  { key: "created_at", label: "Created at" },
  { key: "updated_at", label: "Updated at" },
];

// Start with the same high-value fields shown in the summary table; admins can add detail fields.
const defaultMembershipExportFields: (keyof MembershipEntry)[] = [
  "start_date",
  "first_name",
  "last_name",
  "payment_status",
  "membership_type",
  "amount_paid",
  "end_date",
];

// Spreadsheet widths are defined per API field because XLSX columns need explicit readable sizing.
const membershipExportColumnWidths: Partial<Record<keyof MembershipEntry, number>> = {
  membership_id: 15,
  first_name: 18,
  last_name: 18,
  email: 30,
  phone: 18,
  membership_type: 20,
  amount_paid: 16,
  payment_status: 18,
  reference_id: 22,
  start_date: 14,
  end_date: 14,
  renewal_date: 14,
  status: 16,
  notes: 40,
  created_at: 22,
  updated_at: 22,
};

//Will Host entire data set, pulled from backend, to be dispersed to table and page functions.
export default function AdminMembershipsPage() {
  const [isAddingMembership, setIsAddingMembership] = useState(false);
  const [creationMessage, setCreationMessage] = useState<string | null>(null);
  const [savedMembershipId, setSavedMembershipId] = useState<number | null>(null);
  const [isOpeningSavedMembership, setIsOpeningSavedMembership] = useState(false);
  const [savedDetailsError, setSavedDetailsError] = useState<string | null>(null);
  const openingSavedMembership = useRef(false);
  const [openingImportedId, setOpeningImportedId] = useState<number | null>(null);
  const [importedDetailsError, setImportedDetailsError] = useState<string | null>(null);
  const openingImportedMembership = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipItems, setMembershipItems] = useState<MembershipEntry[]>([]);
  // Controlled input state keeps the visible search value and table filter in sync.
  const [searchQuery, setSearchQuery] = useState("");
  const requestVersion = useRef(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  // Keep the complete selected API record so the drawer always shows data from the row the admin chose.
  const [selectedMembership, setSelectedMembership] = useState<MembershipEntry | null>(null);
  // Export preferences live on the page while the reusable menu only renders and updates the controls.
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [selectedExportFields, setSelectedExportFields] = useState<(keyof MembershipEntry)[]>(defaultMembershipExportFields);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const pageSizeOptions = [5, 10, 15, 20];

  //Maps to PostGeneratedData.tsx, defines the columns to be displayed in the table, their headers, widths, and any custom rendering logic.
  const columns: PostTableColumn<MembershipEntry, SortColumn>[] = [
    {
      key: 'start_date', header: 'Start date', width: 150,
      render: (_value, membership) => formatMembershipDate(membership.start_date),
    },
    { key: "last_name", header: "Name", width: 220, render: (_value, membership) => `${membership.last_name}, ${membership.first_name}` },
    {
      key: 'payment_status', header: 'Payment Status', width: 200,
      render: (_value, membership) => membership.payment_status?.trim() || 'Not provided',
    },
    { key: "membership_type", header: "Membership", width: 180, render: (value) => <span className="capitalize">{String(value)}</span> },
    {
      key: 'amount_paid', header: 'Amount', width: 140,
      render: (_value, membership) => formatMembershipAmount(membership.amount_paid),
    },
    {
      key: "end_date",
      header: "Status",
      width: 190,
      render: (_value, membership) => {
        const displayStatus = membershipDisplayStatus(membership);
        return <span className={`inline-flex rounded-md px-4 py-1 text-sm font-bold ${displayStatus === "Active" ? "bg-green-200 text-green-900" : "bg-red-200 text-red-900"}`}>{displayStatus}</span>;
      },
    },
  ];


  const paginate = (entries: MembershipEntry[], currentPage: number, itemsPerPage: number): MembershipEntry[] => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return entries.slice(startIndex, startIndex + itemsPerPage);
  };

  const fetchMemberships = useCallback(async () => {
    const version = ++requestVersion.current;
    setError(null);
    setIsLoading(true);
    try {
      const items = await fetchFinancialRecords<MembershipEntry>('memberships', searchQuery);
      if (version === requestVersion.current) setMembershipItems(items);
    } catch (err) {
      if (version === requestVersion.current) {
        setError(err instanceof Error ? err.message : 'Unable to load membership list.');
      }
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [searchQuery]);

  useVisibleTableRevisionPolling('memberships', fetchMemberships, 3000, isAddingMembership);

  // Matching happens only in the authorized backend; sorting and export use its results.
  const filteredMembershipItems = membershipItems;

  const sortedMembershipItems = useMemo(() => {
    if (sortColumn === null) {
      return filteredMembershipItems;
    }

    const sortedItems = [...filteredMembershipItems];

    sortedItems.sort((x, y) => {
      const direction = sortDirection === "ascending" ? 1 : -1;

      switch (sortColumn) {
        case "start_date":
          return compareMembershipValues(
            parseMembershipDate(x.start_date)?.getTime() ?? null,
            parseMembershipDate(y.start_date)?.getTime() ?? null, direction,
          );

        case "last_name": {
          const xName =
            `${x.last_name} ${x.first_name}`;

          const yName =
            `${y.last_name} ${y.first_name}`;

          return direction * xName.localeCompare(yName);
        }

        case "payment_status":
          return compareMembershipValues(
            x.payment_status?.trim() || null, y.payment_status?.trim() || null, direction,
          );

        case "membership_type":
          return direction * x.membership_type.localeCompare(
            y.membership_type,
          );

        case "amount_paid":
          return compareMembershipValues(
            membershipAmount(x.amount_paid), membershipAmount(y.amount_paid), direction,
          );

        case "end_date":
          return compareMembershipValues(
            parseMembershipDate(x.end_date)?.getTime() ?? null,
            parseMembershipDate(y.end_date)?.getTime() ?? null, direction,
          );

        default:
          return 0;
      }
    });

    return sortedItems;
  }, [filteredMembershipItems, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedMembershipItems.length / itemsPerPage));

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

  async function handleExport(format: ExportFormat, fields: (keyof MembershipEntry)[]) {
    setExportError(null);
    // Preserve the field-picker order and translate API keys into administrator-friendly headings.
    const selectedFieldOptions = fields.map((field) => {
      const fieldOption = membershipExportFields.find((option) => option.key === field);

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
      const selectedColumns: CsvColumn<MembershipEntry>[] = selectedFieldOptions.map(({ field, header }) => ({
        header,
        getValue: (membership) => membershipCsvValue(membership, field),
      }));

      // Export the complete filtered/sorted result set, not only the currently paginated table page.
      downloadCsv(`memberships-${dateStamp}.csv`, sortedMembershipItems, selectedColumns);
      return;
    }

    const selectedColumns: XlsxColumn<MembershipEntry>[] = selectedFieldOptions.map(({ field, header }) => ({
      header,
      width: membershipExportColumnWidths[field] ?? 20,
      getCell: (membership) => createMembershipXlsxCell(membership, field),
    }));

    // XLSX generation loads an additional browser library, so expose progress and recoverable errors.
    setIsExporting(true);
    try {
      await downloadXlsx(`memberships-${dateStamp}.xlsx`, "Memberships", sortedMembershipItems, selectedColumns);
    } catch (err) {
      console.error("Unable to export memberships as XLSX.", err);
      setExportError("Unable to create the XLSX export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  const closeMembershipDetails = useCallback(() => {
    // Clearing the selection unmounts the drawer without changing the membership or table data.
    setSelectedMembership(null);
  }, []);

  async function openSavedMembership() {
    if (savedMembershipId === null || openingSavedMembership.current) return;
    openingSavedMembership.current = true;
    setIsOpeningSavedMembership(true);
    setSavedDetailsError(null);
    try {
      const record = await fetchSavedMembership(savedMembershipId);
      setSelectedMembership(record);
    } catch {
      setSavedDetailsError(
        'The record was saved, but its details could not be loaded. Please try again.',
      );
    } finally {
      openingSavedMembership.current = false;
      setIsOpeningSavedMembership(false);
    }
  }

  async function openImportedMembership(id: number) {
    if (openingImportedMembership.current) return;
    openingImportedMembership.current = true;
    setOpeningImportedId(id);
    setImportedDetailsError(null);
    try {
      // The list can be filtered or paginated. Ask the authorized detail API
      // for committed facts instead of finding a row in the visible table.
      setSelectedMembership(await fetchSavedMembership(id));
    } catch {
      setImportedDetailsError('The batch was saved, but details could not be loaded. Try this record again.');
    } finally {
      openingImportedMembership.current = false;
      setOpeningImportedId(null);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void fetchMemberships(), 300);
    return () => {
      clearTimeout(timer);
      requestVersion.current += 1;
    };
  }, [fetchMemberships]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const hasMemberships = membershipItems.length > 0 || Boolean(searchQuery);
  const hasSearchResults = sortedMembershipItems.length > 0;

  return(
    <div className="min-h-screen min-w-0 bg-msscc-white p-0 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-[1.75rem] text-msscc-teal sm:text-display">View Memberships</h1>
      </header>

      <main className="min-w-0 w-full">
        <section aria-labelledby="membership-entry-title" className="mb-6 min-w-0 max-w-full rounded-md border border-msscc-gray-light p-4">
          <h2 id="membership-entry-title" className="font-heading text-heading-3 text-msscc-teal">Add memberships</h2>
          <p className="mt-2 text-body-sm">Add one membership manually, or download a template to review and import multiple memberships.</p>
          {creationMessage && <p role="status" className="mt-4">{creationMessage}</p>}
          {savedMembershipId !== null && (
            <div className="mt-4">
              <button type="button" disabled={isOpeningSavedMembership}
                onClick={() => void openSavedMembership()}
                className="rounded-md border border-msscc-pink px-4 py-2 text-msscc-pink focus-visible:ring-2 focus-visible:ring-msscc-pink disabled:opacity-50">
                {isOpeningSavedMembership ? 'Loading saved membership…' : 'View saved membership'}
              </button>
              {savedDetailsError && (
                <p role="alert" className="mt-2 text-msscc-danger">{savedDetailsError}</p>
              )}
            </div>
          )}
          {!isAddingMembership ? (
            <button type="button" className="mt-4 rounded-md bg-msscc-pink px-4 py-2 text-msscc-white focus-visible:ring-2 focus-visible:ring-msscc-pink"
              onClick={() => setIsAddingMembership(true)}>Add membership</button>
          ) : (
            <ManualMembershipForm
              onCancel={() => setIsAddingMembership(false)}
              onCreated={({ membershipId }) => {
                setIsAddingMembership(false);
                setCreationMessage('Membership record saved.');
                setSavedMembershipId(membershipId);
                setSavedDetailsError(null);
                // Refresh the current query without inserting or merging a guessed table row.
                void fetchMemberships();
              }}
            />
          )}
          {/* These are one CSV workflow, separate from both single-entry saving
              and the table's record-export menu. Preview alone never writes. */}
          <div role="group" aria-labelledby="membership-csv-group-title"
            className="mt-6 min-w-0 border-t border-msscc-gray-light pt-5">
            <h3 id="membership-csv-group-title" className="font-heading text-heading-3 text-msscc-teal">Import from CSV</h3>
            <p className="mt-2 text-body-sm">
              Download the template, fill one membership per row, then upload it to review.
              Correct errors in the file and acknowledge any warnings before confirming.
              Preview does not save records; Confirm saves the whole batch.
            </p>
            <p className="mt-2 text-body-sm">
              Need field formats or supported values? See <Link href="/admin/documentation"
                className="text-msscc-pink underline">Documentation &amp; Help</Link> under Finances.
            </p>
            <button type="button" className="mt-4 w-full rounded-md bg-msscc-pink px-4 py-2 text-msscc-white disabled:opacity-50 sm:w-auto"
              disabled={isDownloadingTemplate}
              onClick={async () => {
                setTemplateError(null);
                setIsDownloadingTemplate(true);
                try {
                  await downloadMembershipImportTemplate();
                } catch {
                  setTemplateError('Unable to download the template. Check your finance access and try again.');
                } finally {
                  setIsDownloadingTemplate(false);
                }
              }}>
              {isDownloadingTemplate ? 'Downloading template…' : 'Download membership CSV template'}
            </button>
            {templateError && <p role="alert" className="mt-2 text-msscc-danger">{templateError}</p>}
            <MembershipCsvReview embedded
              onConfirmed={() => {
                // Refresh with the existing search text; never change an admin's
                // filter merely to make the imported rows appear in the table.
                setImportedDetailsError(null);
                void fetchMemberships();
              }}
              onOpenSavedMembership={(id) => void openImportedMembership(id)}
              openingMembershipId={openingImportedId}
              savedDetailsError={importedDetailsError}
            />
          </div>
        </section>
        {error && <div className="mb-4 border border-msscc-danger bg-red-50 p-4 text-msscc-danger">{error}</div>}
        {exportError && <div role="alert" className="mb-4 border border-msscc-danger bg-red-50 p-4 text-msscc-danger">{exportError}</div>}
        {isLoading && !error && <div className="border border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">Loading memberships...</div>}
        {hasMemberships && (
          <>
            {/* Stack search and export controls on small screens, then align them on wider screens. */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full max-w-sm">
                <label htmlFor="membership-search" className="mb-2 block text-label uppercase tracking-label text-msscc-gray-mid">
                  Search memberships
                </label>
                {/* The relative wrapper anchors the decorative icon while the input remains full-width and labeled. */}
                <div className="relative">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-msscc-gray-mid">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                  </svg>
                  <input
                    id="membership-search"
                    type="search"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search memberships..."
                    className="w-full rounded-md border border-msscc-gray-light bg-msscc-white py-2.5 pl-9 pr-3 text-body-sm text-msscc-gray-dark outline-none placeholder:text-msscc-gray-mid focus:border-msscc-pink focus:shadow-focus-admin"
                  />
                </div>
                <p className="mt-1 text-body-sm text-msscc-gray-mid">
                  Search by name, email, or phone. Up to 100 matches are shown and exported.
                </p>
              </div>
              {/* The shared menu connects format/field controls to this page's membership export handler. */}
              <DataExportMenu
                entityLabel="memberships"
                fields={membershipExportFields}
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
                  dataEntries={paginate(sortedMembershipItems, currentPage, itemsPerPage)}
                  columns={columns}
                  selectedColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  getRowKey={(membership) => membership.membership_id}
                  isRowSelected={(membership) => membership.membership_id === selectedMembership?.membership_id}
                  onRowSelect={setSelectedMembership}
                />
                <PostPages currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} pageSizeOptions={pageSizeOptions} onItemsPerPageChange={handleItemsPerPageChange} />
              </>
            ) : (
              <div className="border border-dashed border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">
                No matching memberships found.
              </div>
            )}
          </>)
        }
        {!isLoading && !hasMemberships && !error && <div className="border border-dashed border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">No memberships found.</div>}
      </main>

      {/* Only mount the viewport-level drawer after a row has supplied its membership record. */}
      {selectedMembership && (
        <MembershipDetailDrawer
          membership={selectedMembership}
          onClose={closeMembershipDetails}
        />
      )}
    </div>
  );
}
