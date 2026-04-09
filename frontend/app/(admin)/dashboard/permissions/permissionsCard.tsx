"use client";
import { AdminRecord } from "./sampleData";

interface PermissionCardProps {
  permission: AdminRecord;
}

export default function PermissionCard ({ permission }: PermissionCardProps) {
  console.log(permission);  // check what's actually being passed
  console.log(permission.permissionsList);  // check if this is undefined
  return (
    <div className = "border rounded-md p-6 flex divide-x bg-msscc-white h-32 items-center">
      <div className = "basis-2/12">
        <h1 className = "text-black text-3xl">{permission.name}</h1>
        {permission.executive && <p className = "text-gray-500">Executive</p>}
      </div>
      <p className = "basis-3/12 flex items justify-center text-black text-2xl">{permission.email}</p>

      {/* Permissions Grid*/}
      <div className = "basis-7/12 flex-col gap-2 pl-4 grid grid-cols-3">
      {permission.permissionsList.slice().sort((a, b) => Number(b.hasPermission) - Number(a.hasPermission))
      .map((perm) => (
        <p key={perm.permissionName} className={perm.hasPermission ? "text-green-600" : "text-gray-400"}>
        {perm.permissionName}
        </p>
      ))}
      </div>
    </div>
  );
}

