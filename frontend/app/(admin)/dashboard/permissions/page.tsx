"use client";
import { SampleAdminRecordData } from "./sampleData";
import PermissionCard from "./permissionsCard";

export default function AdminPermissionPage() {
  return (
    <div className="flex justify-center min-h-screen">
      <div className="border w-[70%] rounded-md p-6 flex flex-col gap-4">
        {SampleAdminRecordData.map((record) => (
          <PermissionCard key={record.email} permission={record} />
        ))}
      </div>
    </div>
  );
}
