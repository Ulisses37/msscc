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
};

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

export function PostTable({ membershipEntries }: PostTableProps) {
  return (
    <div className="p-6">
      <div className="overflow-x-auto flex justify-center">
        <div className="inline-block rounded border border-gray-300 bg-gray-50 p-2">
          <table className="w-auto border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left">
                <th className="px-6 py-2 text-sm font-semibold" style={{ width: columnWidths.date, minWidth: columnWidths.date }}>Date Paid</th>
                <th className="px-6 py-2 text-sm font-semibold" style={{ width: columnWidths.name, minWidth: columnWidths.name }}>Name</th>
                <th className="px-6 py-2 text-sm font-semibold" style={{ width: columnWidths.paymentStatus, minWidth: columnWidths.paymentStatus }}>Payment Status</th>
                <th className="px-6 py-2 text-sm font-semibold" style={{ width: columnWidths.reference, minWidth: columnWidths.reference }}>Reference</th>
                <th className="px-6 py-2 text-sm font-semibold" style={{ width: columnWidths.amount, minWidth: columnWidths.amount }}>Amount</th>
                <th className="px-6 py-2 text-sm font-semibold" style={{ width: columnWidths.status, minWidth: columnWidths.status }}>Membership</th>
              </tr>
            </thead>
            <tbody>
              {membershipEntries.map((membership, index) => (
                <tr key={index} className="bg-white hover:bg-gray-50">
                  <td className="px-6 py-3 border-y border-l border-gray-300 rounded-l-md" style={{ width: columnWidths.date, minWidth: columnWidths.date }}>
                    {membership.start_date}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300" style={{ width: columnWidths.name, minWidth: columnWidths.name }}>
                    {membership.first_name} {membership.last_name}
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
