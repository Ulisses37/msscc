"use client";
import { useState } from "react";
import { AdminRecord } from "./sampleData";

interface PermissionCardProps {
  permission: AdminRecord;
  isExecutive: boolean;
}

export default function PermissionCard ({ permission, isExecutive }: PermissionCardProps) {
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
        <p key={perm.permissionName}>
          {PermissionIcon({ permissionName: perm.permissionName, hasPermission: perm.hasPermission, isExecutive })}
        </p>
      ))}
      </div>
    </div>
  );
}

function PermissionIcon({ permissionName, hasPermission, isExecutive }: { permissionName: string, hasPermission: boolean, isExecutive: boolean }) {
  const [active, setActive] = useState(hasPermission);

  if(isExecutive) {
    return (
      <button onClick={() => setActive(!active)}
        className={`${active ? "bg-green-500 hover:bg-green-700" : "bg-gray-500 hover:bg-gray-700 opacity-50"} text-white font-bold py-2 px-4`}>
        {permissionName}
      </button>
    );
  }else{
    return hasPermission
      ? <span className="text-green-600 font-bold border-2 p-1  border-green-600 rounded-sm">{permissionName}</span>
      : null;
  }
}

<script>
  const
</script>
