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
          className={`${isExecutive ? "bg-green-500" : "bg-gray-500"} text-white py-2 px-4`}>
          {isExecutive ? "Executive View" : "Standard View"}
        </button>
        <div className="m-5 flex justify-between align-center">
          <div className="w-32"/> {/* Spacing */}
          <p className="text-6xl font-bold text-black font-serif">Permissions</p>
          <div className="w-32">
          {isExecutive ?
            <button className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 self-right rounded"
            onClick={() => updateDatabase()}>
                Update
            </button>
          : <div className="w-32"/>}
          </div>
        </div>
        {SampleAdminRecordData.map((record) => (
          <PermissionCard key={record.email} permission={record} isExecutive={isExecutive} />
        ))}
      </div>
    </div>
  );

  function updateDatabase(){
      // Update database logic here
      console.log('Database updated');
  }
}
