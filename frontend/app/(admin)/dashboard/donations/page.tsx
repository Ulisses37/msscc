import React from "react";
import { sampleDonationData } from "./sampleData";
import { formatCurrency } from "@/utils/formatCurrency";

export default function AdminDonationsPage() {
  return(
    <div className="p-6">
      <header className="mb-6">
        <h1>View Donations</h1>
      </header>

      <main>
        <div className="overflow-x-auto">
          <div className="inline-block rounded border border-gray-300 bg-gray-50 p-2">
            <table className="w-auto border-separate border-spacing-y-1">
              <tbody>
                {sampleDonationData.map((donation, index) => (
                  <tr key={index} className="bg-white hover:bg-gray-50">
                    <td className="px-4 py-3 border-y border-l border-gray-300 rounded-l-md">
                      {donation.date}
                    </td>

                    <td className="px-4 py-3 border-y border-gray-300">
                      {donation.name}
                    </td>

                    <td className="px-4 py-3 border-y border-gray-300">
                      {donation.paymentMethod}
                    </td>

                    <td className="px-4 py-3 border-y border-gray-300 capitalize">
                      {donation.frequency}
                    </td>

                    <td className="px-4 py-3 border-y border-r border-gray-300 rounded-r-md">
                      {formatCurrency(donation.amount)}
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
