'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PostPages } from "@/components/content/Pagination";
import { PostTable, PostTableColumn, SortDirection } from "@/components/content/PostGeneratedData";
import { formatCurrency } from "@/utils/formatCurrency";

//Data Fetched
type DonationEntry = {
  //donation_id : number;
  donor_first_name : string;
  donor_last_name : string;
  //donor_email : string;
  amount : number;
  donation_date : string;
  //is_anonymous : boolean;
  //message : string;
  payment_status : string;
  //reference_id : number;
  //created_at : string;
};

type SortColumn =
  | "donor_last_name"
  | "amount"
  | "donation_date"
  | "payment_status";

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

    const sortedDonationItems = useMemo(() => {
      if (sortColumn === null) {
        return donationItems;
      }

      const sortedItems = [...donationItems];

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
            return direction * (x.amount - y.amount);

          default:
            return 0;
        }
      });

      return sortedItems;
    }, [donationItems, sortColumn, sortDirection]);

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

    useEffect(() => {
      fetchDonations();
    }, [fetchDonations]);

    useEffect(() => {
      setTotalPages(Math.ceil(donationItems.length / itemsPerPage));
    }, [donationItems, itemsPerPage]);

    useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages);
      }
      if (currentPage < 1) {
        setCurrentPage(1);
      }
    }, [currentPage, totalPages]);

  return(
    <div className="min-h-screen bg-msscc-white p-0 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 md:mb-8">
        <h1 className="font-heading text-[1.75rem] text-msscc-teal sm:text-display">View Donations</h1>
      </header>

      <main className="w-full">
        {error && <div className="text-red-600 mb-4">Error: {error}</div>}
                {donationItems.length === 0 && !error && <div className="text-center font-bold border border-gray-300 bg-gray-100 p-4">No donations found.</div>}
                {donationItems.length > 0 && (
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
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search donations..."
                          className="w-full rounded-md border border-msscc-gray-light bg-msscc-white py-2.5 pl-9 pr-3 text-body-sm text-msscc-gray-dark outline-none placeholder:text-msscc-gray-mid focus:border-msscc-pink focus:shadow-focus-admin"
                        />
                      </div>
                    </div>
                    <PostTable dataEntries={paginate(sortedDonationItems, currentPage, itemsPerPage)} columns={columns} selectedColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <PostPages currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} pageSizeOptions={pageSizeOptions} onItemsPerPageChange={handleItemsPerPageChange} />
                  </>)
                }
      </main>
    </div>
  );
}
