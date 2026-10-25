"use client";
import { AdminRecord } from "./adminRecord";
import { PermissionCard, AdminPopup } from "./permissionsCard";
import { useEffect, useState } from "react";
import { fetchLocalStorageAdmin } from "@/components/admin/AdminPermssionHandler";


export default function AdminPermissionPage(){
  const logInAdmin = fetchLocalStorageAdmin();
  const logInType = getLogInType();

  const [adminList, setAdminList] = useState<AdminRecord[]>([]);

  const [selectedAdmin, setSelectedAdmin] = useState<AdminRecord | null>(null);
  const [adminPopupType, setAdminPopUpType] = useState<string>("")

  useEffect(() => {
    filterAdmins().then(setAdminList);
  }, []);

  return(
    <div className="flex min-h-dvh w-full flex-col items-center bg-msscc-white px-2 py-4 font-body text-msscc-gray-dark sm:p-6 md:p-10">
      <header className="mb-6 w-full border-b border-msscc-gray-light pb-4">
        <h1 className="font-heading text-display text-msscc-teal">Admin Permissions</h1>
      </header>

      {/* Stacked on phones and tablets, side by side from lg up */}
      <div className="flex w-full flex-col lg:flex-row lg:items-start">
        {/*Div for asides*/}
        <div className="flex w-full flex-col items-center gap-2 lg:w-auto lg:shrink-0">
          {/*Current Logged in Admin Info*/}
          <aside className="mb-4 w-full rounded-sm bg-msscc-pink pb-3 lg:mb-0 lg:mr-4 lg:w-64">
            <div className="mx-2 border-b-2 border-msscc-gray-light pl-1 pt-2 font-heading text-heading-2 text-white">
              {logInType}
            </div>

            <div className="mb-1 ml-2 mt-2 text-label tracking-label text-msscc-gray-faint">
              Name
            </div>
            <div className="mx-2 rounded-sm bg-msscc-pink-light pl-1">
              <div className="break-words text-body-sm text-white">
                {logInAdmin?.firstName + " " + logInAdmin?.lastName}
              </div>
            </div>

            <div className="mb-1 ml-2 mt-2 text-label tracking-label text-msscc-gray-faint">
              Email
            </div>
            <div className="mx-2 rounded-sm bg-msscc-pink-light pl-1">
              <div
                className="truncate text-body-sm text-white"
                title={logInAdmin?.email}
              >
                {logInAdmin?.email}
              </div>
            </div>
          </aside>
        </div>

        <div className="flex w-full min-w-0 flex-col rounded-md bg-msscc-gray-faint">
          {/* Toolbar: sticks to the top on phones/tablets, normal from lg up.
              If you have a fixed site header, change top-0 to its height (e.g. top-16). */}
          <div className="sticky top-0 z-20 flex items-center gap-2 rounded-t-md bg-msscc-gray-faint px-2 py-2 shadow-sm lg:static lg:shadow-none">
            <h2 className="font-heading text-heading-2 text-msscc-teal">
              Admin List
            </h2>
<div className="flex flex-1 justify-end gap-2 sm:gap-4">
  {logInType === "Developer Admin" && (
    <button
      type="button"
      className="rounded-sm bg-msscc-pink px-2 py-1 text-center text-xs tracking-btn text-white transition-colors hover:bg-msscc-pink-dark sm:px-5 sm:py-2 sm:text-btn"
      onClick={() => { setSelectedAdmin(null); setAdminPopUpType("create"); }}
    >
      Add
    </button>
  )}
  <button
    type="button"
    className="rounded-sm bg-msscc-pink px-2 py-1 text-center text-xs tracking-btn text-white transition-colors hover:bg-msscc-pink-dark sm:px-5 sm:py-2 sm:text-btn"
    onClick={() => updateDatabase()}
  >
    Update
  </button>
</div>
          </div>

          {adminList.map((record) => (
            <PermissionCard
              key={record.id}
              adminInformation={record}
              onPermissionToggle={handlePermissionToggle}
              setSelectedAdmin={setSelectedAdmin}
              setAdminPopUpType={setAdminPopUpType}
              logInType={logInType}
            />
          ))}
        </div>

        {adminPopupType != "" && <AdminPopup
          currentAdminList = {adminList}
          setPType = {setAdminPopUpType}
          pType = {adminPopupType}
          selectedAdmin = {selectedAdmin}
        />
        }
      </div>
    </div>
  );

  function handlePermissionToggle(id: number, permissionName: string) {
    setAdminList(prev =>
        prev.map(record => {
            if (record.id !== id) return record;
            return {
                ...record,
                permissions: {
                    ...record.permissions,
                    [permissionName]: !record.permissions[permissionName]
                }
            };
        })
    );
  }

  function updateDatabase() {
    Promise.all(
        adminList.map(record =>
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admins/${record.id}/permissions/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permissions: record.permissions }),
            })
        )
    ).then(() => {
        window.location.reload();
    });
  }

  function getLogInType(){
    if (logInAdmin?.email == "msscc.scrumlords.dev@gmail.com"){
      return "Developer Admin";
    }else if (logInAdmin?.isExecutive){
      return "Executive Admin"
    }
    return "Admin"
  }

  async function filterAdmins() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admins/`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const allAdminList: AdminRecord[] = await res.json();

      return allAdminList.filter(a => {
        const isDeveloper = a.email === "msscc.scrumlords.dev@gmail.com";
        const isSelf = a.email === logInAdmin?.email;

        switch (logInType) {
          case "Developer Admin":
            return !isDeveloper;
          case "Executive Admin":
            return (!isDeveloper && !a.is_executive);
          default: // "Admin"
            return !isDeveloper && !a.is_executive && !isSelf;
        }
    }).sort((a, b) =>
      Number(b.is_executive) - Number(a.is_executive) ||
      a.first_name.localeCompare(b.first_name) ||
      a.last_name.localeCompare(b.last_name)
    );
    } catch (error) {
      console.error("Error fetching admins:", error);
      return [];
    }
  }
}
