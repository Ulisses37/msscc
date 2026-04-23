"use client";
import { useState } from "react";
import { AdminRecord, PermissionRecord } from "./adminRecord";

function formatPermissionKey(key: string): string {
    return key
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export default function PermissionCard ({ adminInformation, currentUserInformation }: {adminInformation:AdminRecord, currentUserInformation: AdminRecord | null }) {
  console.log("Rendering PermissionCard for:", adminInformation, "Current User Executive Status:", currentUserInformation);
  return (
    <div className={`border rounded-md p-6 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x min-h-32 items-center ${currentUserInformation?.email === adminInformation.email ? 'bg-yellow-100' : 'bg-white'}`}>
      <div className = "basis-2/12 w-full md:w-auto">
        <h1 className = "text-black text-[clamp(0.75rem,2vw,1.875rem)]">{adminInformation.first_name} {adminInformation.last_name}</h1>
        {adminInformation.is_executive && <p className = "text-gray-500 text-[clamp(0.5rem,1vw,1rem)]">Executive</p>}
      </div>
      <p className = "basis-3/12 w-full md:w-auto flex items-center justify-center text-black text-[clamp(0.5rem,1.5vw,1.5rem)]">{adminInformation.email}</p>

      {/* Permissions Grid*/}
      <div className = "basis-7/12 w-full md:w-auto gap-2 md:gap-4 pl-4 grid grid-cols-2 md:grid-cols-3">
      {Object.entries(adminInformation.permissions).slice().sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([permissionName, hasPermission]) => (
        <p key={permissionName}>
          {PermissionIcon({ currentPermission: { permissionName, hasPermission }, isExecutiveView: currentUserInformation?.is_executive ?? false })}
        </p>
      ))}
      </div>
    </div>
  );
}

function PermissionIcon({currentPermission, isExecutiveView}: {currentPermission: PermissionRecord, isExecutiveView: boolean}) {
  const [active, setActive] = useState(currentPermission.hasPermission);

  if(isExecutiveView) { // Executive View if logged in and user is Executive
    return (
      <button onClick={() => setActive(!active)}
        className={`${active ? "bg-green-500 hover:bg-green-700 border-green-500 hover:border-green-700": "bg-gray-500 hover:bg-gray-700 border-gray-500 hover:border-gray-500 opacity-50"}
        text-white border-2 p-1 md:p-1.5 text-[clamp(0.5rem,1.2vw,1.125rem)] rounded-sm inline-flex items-center justify-center leading-none h-8 md:h-10 w-full text-center`}>
        {formatPermissionKey(currentPermission.permissionName)}
      </button>
    );
  }else{ // Non Executive view
    if (currentPermission.hasPermission) {
      return (
          <span className="text-green-600 border-2 p-1 md:p-1.5 text-[clamp(0.5rem,1.2vw,1.125rem)]  border-green-600 rounded-sm inline-flex items-center justify-center leading-none h-8 md:h-10 w-full text-center">
          {formatPermissionKey(currentPermission.permissionName)}</span>
      )
    }else{
      return (
        <span className="invisible text-green-600 border-2 p-1 md:p-1.5 text-[clamp(0.5rem,1.2vw,1.125rem)]  border-green-600 rounded-sm inline-flex items-center justify-center leading-none h-8 md:h-10 w-full text-center">
          {formatPermissionKey(currentPermission.permissionName)}</span>
      )
    }
  }
}
