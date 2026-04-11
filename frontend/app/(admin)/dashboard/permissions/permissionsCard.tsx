"use client";
import { useState } from "react";
import { AdminRecord, PermissionRecord } from "./sampleData";


export default function PermissionCard ({ adminInformation, currentUserInformation }: {adminInformation:AdminRecord, currentUserInformation: AdminRecord | null }) {
  console.log("Rendering PermissionCard for:", adminInformation, "Current User Executive Status:", currentUserInformation);
  return (
    <div className = "border rounded-md p-6 flex divide-x bg-msscc-white h-32 items-center">
      <div className = "basis-2/12">
        <h1 className = "text-black text-3xl">{adminInformation.name}</h1>
        {adminInformation.executive && <p className = "text-gray-500">Executive</p>}
      </div>
      <p className = "basis-3/12 flex items justify-center text-black text-2xl">{adminInformation.email}</p>

      {/* Permissions Grid*/}
      <div className = "basis-7/12 flex-col gap-4 pl-4 grid grid-cols-3">
      {adminInformation.permissionsList.slice().sort((a, b) => Number(b.hasPermission) - Number(a.hasPermission))
      .map((perm) => (
        <p key={perm.permissionName}>
          {PermissionIcon({ currentPermission: perm, isExecutiveView: currentUserInformation?.executive ?? false })}
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
        text-white border-2 p-1.5 font-bold text-lg rounded-sm h-10 text-center`}>
        {currentPermission.permissionName}
      </button>
    );
  }else{ // Non Executive view
    if (currentPermission.hasPermission) {
      return (
          <span className="text-green-600 font-bold border-2 p-1 text-lg border-green-600 rounded-sm inline-block h-10 text-center">{currentPermission.permissionName}</span>
      )
    }
  }
}
