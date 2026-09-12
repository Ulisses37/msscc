'use client';

import React, {} from "react";
//import { sampleMembershipData } from "@/app/admin/memberships/sampleData";
import { formatCurrency } from "@/utils/formatCurrency";

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

type PostTableProps = {
  membershipEntries: MembershipEntry[];
  selectedColumn: SortColumn | null;
  onSort: (column: SortColumn) => void;
};

type SortColumn =
  | "last_name"
  | "membership_type"
  | "amount_paid"
  | "payment_status"
  | "start_date"
  | "end_date";

const getActiveStatus = (isExpired: boolean) => {
  if (!isExpired) {
    return "inline-flex rounded-md px-4 py-1 text-sm font-bold bg-green-200 text-green-900";
  }

  return "inline-flex rounded-md px-4 py-1 text-sm font-bold bg-red-200 text-red-900";
};

function isExpired(
  expirationDate: string | null | undefined,
): boolean {
  if (!expirationDate) {
    return false;
  }

  const expiration = new Date(expirationDate);

  if (Number.isNaN(expiration.getTime())) {
    console.error(
      "Invalid expiration date:",
      expirationDate,
    );

    return false;
  }

  return Date.now() > expiration.getTime();
}

const columnWidths = {
  date: 150,
  name: 220,
  paymentStatus: 200,
  reference: 180,
  amount: 140,
  status: 190,
};


//Potentially Stylize the highlighted column with a different background color
//   or font weight to indicate that it is the currently sorted column.
//This can help users quickly identify which column is being used for sorting.
//Could use State active Column to track the currently sorted column and apply
//   conditional styling based on that state.
export function PostTable({ membershipEntries, selectedColumn, onSort }: PostTableProps) {
  return (
    <div className="p-6">
      <div className="overflow-x-auto flex justify-center">
        <div className="inline-block rounded border border-gray-300 bg-gray-50 p-2">
          <table className="w-auto border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left">
                <th className="px-6 py-2 text-sm font-semibold"
                  aria-sort={selectedColumn === "start_date" ? "ascending" : "none"}
                  style={{ width: columnWidths.date, minWidth: columnWidths.date }}>
                    <button
                      type="button"
                      onClick={() => onSort("start_date")}
                      className={
                        selectedColumn === "start_date"
                          ? "font-bold underline"
                          : ""
                      }
                    >
                      Date Paid
                    </button>
                </th>
                <th className="px-6 py-2 text-sm font-semibold"
                  aria-sort={selectedColumn === "last_name" ? "ascending" : "none"}
                  style={{ width: columnWidths.name, minWidth: columnWidths.name }}>
                    <button
                      type="button"
                      onClick={() => onSort("last_name")}
                      className={
                        selectedColumn === "last_name"
                          ? "font-bold underline"
                          : ""
                      }
                    >
                      Name
                    </button>
                </th>
                <th className="px-6 py-2 text-sm font-semibold"
                  aria-sort={selectedColumn === "payment_status" ? "ascending" : "none"}
                  style={{ width: columnWidths.paymentStatus, minWidth: columnWidths.paymentStatus }}>
                    <button
                      type="button"
                      onClick={() => onSort("payment_status")}
                      className={
                        selectedColumn === "payment_status"
                          ? "font-bold underline"
                          : ""
                      }
                    >
                      Payment Status
                    </button>
                </th>
                <th className="px-6 py-2 text-sm font-semibold"
                  aria-sort={selectedColumn === "membership_type" ? "ascending" : "none"}
                  style={{ width: columnWidths.reference, minWidth: columnWidths.reference }}>
                    <button
                      type="button"
                      onClick={() => onSort("membership_type")}
                      className={
                        selectedColumn === "membership_type"
                          ? "font-bold underline"
                          : ""
                      }
                    >
                      Membership
                    </button>
                </th>
                <th className="px-6 py-2 text-sm font-semibold"
                  aria-sort={selectedColumn === "amount_paid" ? "ascending" : "none"}
                  style={{ width: columnWidths.amount, minWidth: columnWidths.amount }}>
                    <button
                      type="button"
                      onClick={() => onSort("amount_paid")}
                      className={
                        selectedColumn === "amount_paid"
                          ? "font-bold underline"
                          : ""
                      }
                    >
                      Amount Paid
                    </button>
                </th>
                <th className="px-6 py-2 text-sm font-semibold"
                  aria-sort={selectedColumn === "end_date" ? "ascending" : "none"}
                  style={{ width: columnWidths.status, minWidth: columnWidths.status }}>
                    <button
                      type="button"
                      onClick={() => onSort("end_date")}
                      className={
                        selectedColumn === "end_date"
                          ? "font-bold underline"
                          : ""
                      }
                    >
                      Membership
                    </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {membershipEntries.map((membership, index) => (
                <tr key={index} className="bg-white hover:bg-gray-50">
                  <td className="px-6 py-3 border-y border-l border-gray-300 rounded-l-md" style={{ width: columnWidths.date, minWidth: columnWidths.date }}>
                    {membership.start_date}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300" style={{ width: columnWidths.name, minWidth: columnWidths.name }}>
                    {membership.last_name}, {membership.first_name}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300" style={{ width: columnWidths.paymentStatus, minWidth: columnWidths.paymentStatus }}>
                    {membership.payment_status}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300 capitalize" style={{ width: columnWidths.reference, minWidth: columnWidths.reference }}>
                    {membership.membership_type}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300" style={{ width: columnWidths.amount, minWidth: columnWidths.amount }}>
                    {formatCurrency(membership.amount_paid)}
                  </td>
                  <td className="px-6 py-3 border-y border-r border-gray-300 rounded-r-md" style={{ width: columnWidths.status, minWidth: columnWidths.status }}>
                    <span className={isExpired(membership.end_date) ? "inline-flex rounded-md px-4 py-1 text-sm font-bold bg-red-200 text-red-900" : getActiveStatus(isExpired(membership.end_date))}>
                      {isExpired(membership.end_date) ? "Expired" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

}
