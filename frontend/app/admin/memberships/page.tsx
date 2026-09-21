'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MembershipDetailDrawer, type MembershipEntry } from "@/components/admin/MembershipDetailDrawer";
import { PostPages } from "@/components/content/Pagination";
import { PostTable, PostTableColumn, SortDirection } from "@/components/content/PostGeneratedData";
import { formatCurrency } from "@/utils/formatCurrency";

type SortColumn =
  | "last_name"
  | "membership_type"
  | "amount_paid"
  | "payment_status"
  | "start_date"
  | "end_date";

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

//Will Host entire data set, pulled from backend, to be dispersed to table and page functions.
export default function AdminMembershipsPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [membershipItems, setMembershipItems] = useState<MembershipEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [selectedMembership, setSelectedMembership] = useState<MembershipEntry | null>(null);
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

  const filteredMembershipItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return membershipItems;
    }

    return membershipItems.filter((membership) => {
      const searchableValues = searchableMembershipFields.map((field) => membership[field]);
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
    setCurrentPage(1);
  }

  const closeMembershipDetails = useCallback(() => {
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
        {isLoading && !error && <div className="border border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">Loading memberships...</div>}
        {!isLoading && hasMemberships && (
          <>
            <div className="mb-6 max-w-sm">
              <label htmlFor="membership-search" className="mb-2 block text-label uppercase tracking-label text-msscc-gray-mid">
                Search memberships
              </label>
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
            {hasSearchResults ? (
              <>
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

      {selectedMembership && (
        <MembershipDetailDrawer
          membership={selectedMembership}
          onClose={closeMembershipDetails}
        />
      )}
    </div>
  );
}
