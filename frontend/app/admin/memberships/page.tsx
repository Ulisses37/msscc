import React from "react";

import{PostTable} from "@/components/content/PostGeneratedData";


export default function AdminMembershipsPage() {
  return(
    <div className="p-6">
      <header className="mb-6">
        <h1>View Memberships</h1>
      </header>

      <PostTable />

    </div>
  );
}
