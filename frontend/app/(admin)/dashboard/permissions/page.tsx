"use client";
import { SampleAdminRecordData } from "./sampleData";
import PermissionCard from "./permissionsCard";

export default function AdminPermissionPage() {
  return (
    <div className="flex justify-center min-h-screen">
      <div className="border w-[70%] rounded-md p-6 flex flex-col gap-4 bg-zinc-300">
        <div className="mb-10 flex justify-center align-center">
          <p className="text-6xl font-bold text-black font-serif">Permissions</p>
        </div>
        {SampleAdminRecordData.map((record) => (
          <PermissionCard key={record.email} permission={record} />
        ))}
      </div>
    </div>
  );
}
