'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataExportMenu, type ExportFieldOption, type ExportFormat } from "@/components/admin/DataExportMenu";
import { MembershipDetailDrawer, type MembershipEntry } from "@/components/admin/MembershipDetailDrawer";
import { PostPages } from "@/components/content/Pagination";
import { PostTable, PostTableColumn, SortDirection } from "@/components/content/PostGeneratedData";
import { downloadCsv, type CsvColumn } from "@/utils/exportCsv";
import { downloadXlsx, type XlsxCell, type XlsxColumn } from "@/utils/exportXlsx";
import { formatCurrency } from "@/utils/formatCurrency";

type SortColumn =
  | "last_name"
  | "membership_type"
  | "amount_paid"
  | "payment_status"
  | "start_date"
  | "end_date";

// Only these record fields are included in the membership search. Keeping the
// list separate makes it clear which API values can produce a table match.
const searchableMembershipFields: (keyof MembershipEntry)[] = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "membership_type",
  "payment_status",
  "reference_id",
  "status",
  "notes",
];

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

const defaultMembershipExportFields: (keyof MembershipEntry)[] = [
  "start_date",
  "first_name",
  "last_name",
  "payment_status",
  "membership_type",
  "amount_paid",
  "end_date",
];

const membershipExportColumnWidths: Record<keyof MembershipEntry, number> = {
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

function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Number.isNaN(date.getTime()) ? null : date;
}

function createMembershipXlsxCell(membership: MembershipEntry, field: keyof MembershipEntry): XlsxCell {
  const value = membership[field];

  if (value === null || value === undefined || value === "") return null;

  if (field === "membership_id") {
    return { value: Number(value), type: Number, format: "0" };
  }

  if (field === "amount_paid") {
    const amount = Number(value);

    return Number.isFinite(amount)
      ? { value: amount, type: Number, format: "[$$-409]#,##0.00" }
      : { value: String(value), type: String, format: "@" };
  }

  if (field === "start_date" || field === "end_date" || field === "renewal_date") {
    const date = parseDateOnly(String(value));

    return date
      ? { value: date, type: Date, format: "mm/dd/yyyy" }
      : { value: String(value), type: String, format: "@" };
  }

  if (field === "created_at" || field === "updated_at") {
    const date = new Date(String(value));

    return Number.isNaN(date.getTime())
      ? { value: String(value), type: String, format: "@" }
      : { value: date, type: Date, format: "mm/dd/yyyy h:mm AM/PM" };
  }

  return {
    value: String(value),
    type: String,
    format: "@",
    wrap: field === "notes",
    alignVertical: field === "notes" ? "top" : "center",
  };
}

//Will Host entire data set, pulled from backend, to be dispersed to table and page functions.
export default function AdminMembershipsPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipItems, setMembershipItems] = useState<MembershipEntry[]>([]);
  // Controlled input state keeps the visible search value and table filter in sync.
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  // Keep the complete selected API record so the drawer always shows data from the row the admin chose.
  const [selectedMembership, setSelectedMembership] = useState<MembershipEntry | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [selectedExportFields, setSelectedExportFields] = useState<(keyof MembershipEntry)[]>(defaultMembershipExportFields);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const pageSizeOptions = [5, 10, 15, 20];

  //Maps to PostGeneratedData.tsx, defines the columns to be displayed in the table, their headers, widths, and any custom rendering logic.
  const columns: PostTableColumn<MembershipEntry, SortColumn>[] = [
    { key: "start_date", header: "Date Paid", width: 150 },
    { key: "last_name", header: "Name", width: 220, render: (_value, membership) => `${membership.last_name}, ${membership.first_name}` },
    { key: "payment_status", header: "Payment Status", width: 200 },
    { key: "membership_type", header: "Membership", width: 180, render: (value) => <span className="capitalize">{String(value)}</span> },
    { key: "amount_paid", header: "Amount", width: 140, render: (value) => formatCurrency(Number(value)) },
    {
      key: "end_date",
      header: "Status",
      width: 190,
      render: (_value, membership) => {
        const expired = new Date(`${membership.end_date}T23:59:59`).getTime() < Date.now();
        return <span className={`inline-flex rounded-md px-4 py-1 text-sm font-bold ${expired ? "bg-red-200 text-red-900" : "bg-green-200 text-green-900"}`}>{expired ? "Expired" : "Active"}</span>;
      },
    },
  ];


  const paginate = (entries: MembershipEntry[], currentPage: number, itemsPerPage: number): MembershipEntry[] => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return entries.slice(startIndex, startIndex + itemsPerPage);
  };

  const fetchMemberships = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/memberships/`);
      if (!response.ok) {
        throw new Error('Failed to load membership list.');
      }
      const items = (await response.json()) as MembershipEntry[];

      setMembershipItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load membership list.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter before sorting and pagination so every page and export operates on
  // the same case-insensitive set of matching membership records.
  const filteredMembershipItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    // An empty (or whitespace-only) search restores the complete table.
    if (!normalizedQuery) {
      return membershipItems;
    }

    return membershipItems.filter((membership) => {
      const searchableValues = searchableMembershipFields.map((field) => membership[field]);
      // Also support searches such as "Jane Doe" across the two name fields.
      searchableValues.push(`${membership.first_name} ${membership.last_name}`);

      return searchableValues.some((value) =>
        String(value ?? "").toLocaleLowerCase().includes(normalizedQuery),
      );
    });
  }, [membershipItems, searchQuery]);

  const sortedMembershipItems = useMemo(() => {
    if (sortColumn === null) {
      return filteredMembershipItems;
    }

    const sortedItems = [...filteredMembershipItems];

    sortedItems.sort((x, y) => {
      const direction = sortDirection === "ascending" ? 1 : -1;

      switch (sortColumn) {
        case "start_date":
          return direction * (
            new Date(x.start_date).getTime() -
            new Date(y.start_date).getTime()
          );

        case "last_name": {
          const xName =
            `${x.last_name} ${x.first_name}`;

          const yName =
            `${y.last_name} ${y.first_name}`;

          return direction * xName.localeCompare(yName);
        }

        case "payment_status":
          return direction * x.payment_status.localeCompare(
            y.payment_status,
          );

        case "membership_type":
          return direction * x.membership_type.localeCompare(
            y.membership_type,
          );

        case "amount_paid":
          return direction * (Number(x.amount_paid) - Number(y.amount_paid));

        case "end_date":
          return direction * (
            new Date(x.end_date).getTime() -
            new Date(y.end_date).getTime()
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
        getValue: (membership) => membership[field],
      }));

      downloadCsv(`memberships-${dateStamp}.csv`, sortedMembershipItems, selectedColumns);
      return;
    }

    const selectedColumns: XlsxColumn<MembershipEntry>[] = selectedFieldOptions.map(({ field, header }) => ({
      header,
      width: membershipExportColumnWidths[field],
      getCell: (membership) => createMembershipXlsxCell(membership, field),
    }));

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

  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const hasMemberships = membershipItems.length > 0;
  const hasSearchResults = sortedMembershipItems.length > 0;

  return(
    <div className="min-h-screen bg-msscc-white p-0 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-[1.75rem] text-msscc-teal sm:text-display">View Memberships</h1>
      </header>

      <main className="w-full">
        {error && <div className="mb-4 border border-msscc-danger bg-red-50 p-4 text-msscc-danger">{error}</div>}
        {exportError && <div role="alert" className="mb-4 border border-msscc-danger bg-red-50 p-4 text-msscc-danger">{exportError}</div>}
        {isLoading && !error && <div className="border border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">Loading memberships...</div>}
        {!isLoading && hasMemberships && (
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
              </div>
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
