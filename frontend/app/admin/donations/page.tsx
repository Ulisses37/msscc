'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DonationDetailDrawer, type DonationEntry } from "@/components/admin/DonationDetailDrawer";
import { PostPages } from "@/components/content/Pagination";
import { PostTable, PostTableColumn, SortDirection } from "@/components/content/PostGeneratedData";
import { formatCurrency } from "@/utils/formatCurrency";

type SortColumn =
  | "donor_last_name"
  | "amount"
  | "donation_date"
  | "payment_status";

const searchableDonationFields: (keyof DonationEntry)[] = [
  "donor_first_name",
  "donor_last_name",
  "donor_email",
  "payment_status",
  "reference_id",
  "message",
];

  //Will Host entire data set, pulled from backend, to be dispersed to table and page functions.
export default function AdminDonationsPage() {
  const [error, setError] = useState<string | null>("Error: List Failed to Load Properly");
  const [donationItems, setDonationItems] = useState<DonationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [selectedDonation, setSelectedDonation] = useState<DonationEntry | null>(null);
  const pageSizeOptions = [5, 10, 15, 20];

  //Maps to PostGeneratedData.tsx, defines the columns to be displayed in the table, their headers, widths, and any custom rendering logic.
  const columns: PostTableColumn<DonationEntry, SortColumn>[] = [
    { key: "donation_date", header: "Date", width: 150 },
    { key: "donor_last_name", header: "Name", width: 220, render: (_value, donation) => `${donation.donor_last_name}, ${donation.donor_first_name}` },
    { key: "payment_status", header: "Payment Status", width: 200 },
    { key: "amount", header: "Amount", width: 180, render: (value) => formatCurrency(Number(value)) },
  ];

  const paginate = (entries: DonationEntry[], currentPage: number, itemsPerPage: number): DonationEntry[] => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return entries.slice(startIndex, startIndex + itemsPerPage);
    };

    const fetchDonations = useCallback(async () => {
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/donations/`);
        if (!response.ok) {
          throw new Error('Failed to load donation list.');
        }
        const items = (await response.json()) as DonationEntry[];

        setDonationItems(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load donation list.');
      } finally {

      }
    }, []);

    const filteredDonationItems = useMemo(() => {
      const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

      if (!normalizedQuery) {
        return donationItems;
      }

      return donationItems.filter((donation) => {
        const searchableValues = searchableDonationFields.map((field) => donation[field]);
        searchableValues.push(`${donation.donor_first_name} ${donation.donor_last_name}`);

        return searchableValues.some((value) =>
          String(value ?? "").toLocaleLowerCase().includes(normalizedQuery),
        );
      });
    }, [donationItems, searchQuery]);

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
            const xName =
              `${x.donor_last_name} ${x.donor_first_name}`;

            const yName =
              `${y.donor_last_name} ${y.donor_first_name}`;

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
      setCurrentPage(1);
    }

    const closeDonationDetails = useCallback(() => {
      setSelectedDonation(null);
    }, []);

    useEffect(() => {
      fetchDonations();
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

    const hasDonations = donationItems.length > 0;
    const hasSearchResults = sortedDonationItems.length > 0;

  return(
    <div className="min-h-screen bg-msscc-white p-0 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-[1.75rem] text-msscc-teal sm:text-display">View Donations</h1>
      </header>

      <main className="w-full">
        {error && <div className="text-red-600 mb-4">Error: {error}</div>}
                {!hasDonations && !error && <div className="border border-dashed border-msscc-gray-light py-12 text-center text-body-sm text-msscc-gray-mid">No donations found.</div>}
                {hasDonations && (
                  <>
                    <div className="mb-6 max-w-sm">
                      <label htmlFor="donation-search" className="mb-2 block text-label uppercase tracking-label text-msscc-gray-mid">
                        Search donations
                      </label>
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
                    </div>
                    {hasSearchResults ? (
                      <>
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

      {selectedDonation && (
        <DonationDetailDrawer
          donation={selectedDonation}
          onClose={closeDonationDetails}
        />
      )}
    </div>
  );
}
