"use client";
import { SampleAdminRecordData } from "./sampleData";
import PermissionCard from "./permissionsCard";
import { useState } from "react";

export default function AdminPermissionPage() {
  const [isExecutive, setIsExecutive] = useState(false);

  return (
    <div className="flex justify-center min-h-screen">
      <div className="border w-[70%] rounded-md p-6 flex flex-col gap-4 bg-zinc-300">
                <button
          onClick={() => setIsExecutive(!isExecutive)}
          className={`${isExecutive ? "bg-green-500" : "bg-gray-500"} text-white font-bold py-2 px-4 rounded`}>
          {isExecutive ? "Executive View" : "Standard View"}
        </button>
        <div className="mb-10 flex justify-center align-center">
          <p className="text-6xl font-bold text-black font-serif">Permissions</p>
        </div>
        {SampleAdminRecordData.map((record) => (
          <PermissionCard key={record.email} permission={record} isExecutive={isExecutive} />
        ))}
      </div>
    </div>
  );
}
