'use client';

import React, { useCallback, useEffect, useState } from "react";
import { sampleMembershipData } from "@/app/admin/memberships/sampleData";
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
  //start_date : string;
  //end_date : string;
  status : string;
  //notes : string;
  created_at : string;
  //updated_at : string;
};

type PostTableProps = {
  membershipEntries: MembershipEntry[];
};

const getStatusClasses = (status: "active" | "inactive"): string => {
  if (status === "active") {
    return "inline-flex rounded-md px-4 py-1 text-sm font-bold bg-green-200 text-green-900";
  }

  return "inline-flex rounded-md px-4 py-1 text-sm font-bold bg-red-200 text-red-900";
};


export function PostTable({ membershipEntries }: PostTableProps) {
  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <div className="inline-block rounded border border-gray-300 bg-gray-50 p-2">
          <table className="w-auto border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left">
                <th className="px-6 py-2 text-sm font-semibold">Date</th>
                <th className="px-6 py-2 text-sm font-semibold">Name</th>
                <th className="px-6 py-2 text-sm font-semibold">Payment Method</th>
                <th className="px-6 py-2 text-sm font-semibold">Reference</th>
                <th className="px-6 py-2 text-sm font-semibold">Amount</th>
                <th className="px-6 py-2 text-sm font-semibold">Membership Status</th>
              </tr>
            </thead>
            <tbody>
              {sampleMembershipData.map((membership, index) => (
                <tr key={index} className="bg-white hover:bg-gray-50">
                  <td className="px-6 py-3 border-y border-l border-gray-300 rounded-l-md">
                    {membership.date}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300">
                    {membership.name}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300">
                    {membership.paymentMethod}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300 capitalize">
                    {membership.level}
                  </td>
                  <td className="px-6 py-3 border-y border-gray-300">
                    {formatCurrency(membership.amount)}
                  </td>
                  <td className="px-6 py-3 border-y border-r border-gray-300 rounded-r-md">
                    <span className={getStatusClasses(membership.status)}>
                      {membership.status === "active" ? "Active" : "Inactive"}
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
