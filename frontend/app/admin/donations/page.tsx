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
    <div className="p-6">
      <header className="mb-6">
        <h1>View Donations</h1>
      </header>

      <main>
        {error && <div className="text-red-600 mb-4">Error: {error}</div>}
                {donationItems.length === 0 && !error && <div className="text-center font-bold border border-gray-300 bg-gray-100 p-4">No donations found.</div>}
                {donationItems.length > 0 && (
                  <>
                    <PostTable dataEntries={paginate(sortedDonationItems, currentPage, itemsPerPage)} columns={columns} selectedColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                    <PostPages currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} pageSizeOptions={pageSizeOptions} onItemsPerPageChange={handleItemsPerPageChange} />
                  </>)
                }
      </main>
    </div>
  );
}
