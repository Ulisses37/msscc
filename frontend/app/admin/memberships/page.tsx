'use client';

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PostPages } from "@/components/content/Pagination";
import { PostTable, PostTableColumn, SortDirection } from "@/components/content/PostGeneratedData";
import { formatCurrency } from "@/utils/formatCurrency";

//Data Fetched
type MembershipEntry = {
  //membership_id : number;
  first_name : string;
  last_name : string;
  //email : string;
  //phone : string;
  membership_type : string;
  amount_paid : number;
  payment_status : string;
  //reference_id : number;
  start_date : string;
  end_date : string;
  //status : string;
  //notes : string;
  //created_at : string;
  //updated_at : string;
};

type SortColumn =
  | "last_name"
  | "membership_type"
  | "amount_paid"
  | "payment_status"
  | "start_date"
  | "end_date";

//Will Host entire data set, pulled from backend, to be dispersed to table and page functions.
export default function AdminMembershipsPage() {
  const [error, setError] = useState<string | null>("Error: List Failed to Load Properly");
  const [membershipItems, setMembershipItems] = useState<MembershipEntry[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
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
        const expired = new Date(membership.end_date).getTime() < Date.now();
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

    }
  }, []);

  const sortedMembershipItems = useMemo(() => {
    if (sortColumn === null) {
      return membershipItems;
    }

    const sortedItems = [...membershipItems];

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
          return direction * (x.amount_paid - y.amount_paid);

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
  }, [membershipItems, sortColumn, sortDirection]);

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
    fetchMemberships();
  }, [fetchMemberships]);

  useEffect(() => {
    setTotalPages(Math.ceil(membershipItems.length / itemsPerPage));
  }, [membershipItems, itemsPerPage]);

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
        <h1>View Memberships</h1>
      </header>

      <main>
        {error && <div className="text-red-600 mb-4">Error: {error}</div>}
        {membershipItems.length === 0 && !error && <div className="text-center font-bold border border-gray-300 bg-gray-100 p-4">No memberships found.</div>}
        {membershipItems.length > 0 && (
          <>
            <PostTable dataEntries={paginate(sortedMembershipItems, currentPage, itemsPerPage)} columns={columns} selectedColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
            <PostPages currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} itemsPerPage={itemsPerPage} pageSizeOptions={pageSizeOptions} onItemsPerPageChange={handleItemsPerPageChange} />
          </>)
        }
      </main>
    </div>
  );
}
