import React from "react";
import { sampleDonationData } from "./sampleData";

export default function AdminDonationsPage() {
  return(
    <div className="p-6">
      <header className="mb-6">
        <h1>View Donations</h1>
      </header>

      <main>
        <table>
          <tbody>
            {sampleDonationData.map((donation, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="px-4 py-2">{donation.date}</td>
                <td className="px-4 py-2">{donation.name}</td>
                <td className="px-4 py-2">{donation.paymentMethod}</td>
                <td className="px-4 py-2">{donation.frequency}</td>
                <td className="px-4 py-2">{donation.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
