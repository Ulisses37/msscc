'use client';

import React, { useCallback, useEffect, useState } from "react";
import { PostPages } from "@/components/content/Pagination";
import { PostTable } from "@/components/content/PostGeneratedData";

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
  status : string;
  //notes : string;
  //created_at : string;
  //updated_at : string;
};

//Will Host entire data set, pulled from backend, to be dispersed to table and page functions.
export default function AdminMembershipsPage() {
  const [error, setError] = useState<string | null>(null);
  const [membershipItems, setMembershipItems] = useState<MembershipEntry[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

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
            <PostTable membershipEntries={paginate(membershipItems, currentPage, itemsPerPage)} />
            <PostPages currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>)
        }
      </main>
    </div>
  );
}
