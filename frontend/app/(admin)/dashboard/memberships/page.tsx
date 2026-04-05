import React from "react";
import { sampleMembershipData } from "./sampleData";
import { formatCurrency } from "@/utils/formatCurrency";


const getStatusClasses = (status: "active" | "inactive"): string => {
  if (status === "active") {
    return "inline-flex rounded-md px-4 py-1 text-sm font-bold bg-green-200 text-green-900";
  }

  return "inline-flex rounded-md px-4 py-1 text-sm font-bold bg-red-200 text-red-900";
};

export default function AdminMembershipsPage() {
  return(
    <div className="p-6">
      <header className="mb-6">
        <h1>View Memberships</h1>
      </header>

      <main>
        <div className="overflow-x-auto">

        <div className="inline-block rounded border border-gray-300 bg-gray-50 p-2">
          <table className="w-auto border-separate border-spacing-y-1">
            <thead>
              <tr>
                <th className="px-2 py-2 text-sm font-semibold">col title 1</th>
                <th className="px-2 py-2 text-sm font-semibold">col title 2</th>
                <th className="px-2 py-2 text-sm font-semibold">col title 3</th>
                <th className="px-2 py-2 text-sm font-semibold">col title 4</th>
                <th className="px-2 py-2 text-sm font-semibold">col title 5</th>
                <th className="px-2 py-2 text-sm font-semibold">col title 6</th>
              </tr>
            </thead>
            <tbody>
              {sampleMembershipData.map((membership, index) => (
                <tr key={index} className="bg-white hover:bg-gray-50">
                  <td className="px-4 py-3 border-y border-l border-gray-300 rounded-l-md">
                    {membership.date}
                  </td>

                  <td className="px-4 py-3 border-y border-gray-300">
                    {membership.name}
                  </td>

                  <td className="px-4 py-3 border-y border-gray-300">
                    {membership.paymentMethod}
                  </td>

                  <td className="px-4 py-3 border-y border-gray-300 capitalize">
                    {membership.level}
                  </td>

                  <td className="px-4 py-3 border-y border-gray-300">
                    {formatCurrency(membership.amount)}
                  </td>

                  <td className="px-4 py-3 border-y border-r border-gray-300 rounded-r-md">
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
      </main>
    </div>
  );
}
