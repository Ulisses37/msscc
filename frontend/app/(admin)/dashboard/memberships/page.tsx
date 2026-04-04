import React from "react";
import { sampleMembershipData } from "./sampleData";

export default function AdminMembershipsPage() {
  return(
    <div className="p-6">
      <header className="mb-6">
        <h1>View Memberships</h1>
      </header>

      <main>
        <table className="overflow-x-auto rounded border border-gray-300">
          <tbody className="min-w-full">
            {sampleMembershipData.map((membership, index) => (
              <tr key={index} className="border-b border-gray-200">
                <td className="px-4 py-2">{membership.date}</td>
                <td className="px-4 py-2">{membership.name}</td>
                <td className="px-4 py-2">{membership.paymentMethod}</td>
                <td className="px-4 py-2">{membership.level}</td>
                <td className="px-4 py-2">{membership.amount}</td>
                <td className="px-4 py-2">{membership.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
