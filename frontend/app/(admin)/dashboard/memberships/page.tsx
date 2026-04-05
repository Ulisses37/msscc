import React from "react";

export default function AdminMembershipsPage() {
  return(
    <div className="p-6">
      <header className="mb-6">
        <h1>View Memberships</h1>
      </header>

      <main>
        <table className="overflow-x-auto rounded border border-gray-300">
          <tbody className="min-w-full">
            <tr className="border-b border-gray-200">
              <td className="px-4 py-2">col 1</td>
              <td className="px-4 py-2">col 2</td>
              <td className="px-4 py-2">col 3</td>
              <td className="px-4 py-2">col 4</td>
              <td className="px-4 py-2">col 5</td>
              <td className="px-4 py-2">col 6</td>
            </tr>

            <tr className="border-b border-gray-200">
              <td className="px-4 py-2">col 1</td>
              <td className="px-4 py-2">col 2</td>
              <td className="px-4 py-2">col 3</td>
              <td className="px-4 py-2">col 4</td>
              <td className="px-4 py-2">col 5</td>
              <td className="px-4 py-2">col 6</td>
            </tr>
          </tbody>
        </table>
      </main>
    </div>
  );
}
