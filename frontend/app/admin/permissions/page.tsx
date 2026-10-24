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
      <header className="mb-6 border-b border-msscc-gray-light pb-4 w-full">
        <h1 className="font-heading text-2xl text-msscc-teal sm:text-display">Admin Permissions</h1>
      </header>

      {/* Stacked on phones and tablets, side by side from lg up */}
      <div className="flex w-full flex-col lg:flex-row lg:items-start">
        {/*Div for asides*/}
        <div className="flex w-full flex-col items-center gap-2 lg:w-auto lg:shrink-0">
          {/*Current Logged in Admin Info*/}
          <aside className="mb-4 w-full rounded-sm border-msscc-gray-light bg-msscc-pink lg:mb-0 lg:mr-4 lg:w-64">
            <div className="text-xl text-white pl-1 pt-2 border-b-2 border-msscc-gray-light mx-2 font-bold">
              {logInType}
            </div>
            <div className="mt-2 ml-2 text-msscc-gray-faint">
                Name:
              </div>
            <div className="mx-2 bg-msscc-pink-light pl-1 rounded-sm">
              <div className="text-xl text-white break-words">
                {logInAdmin?.firstName + " " + logInAdmin?.lastName}
              </div>
            </div>
            <div className="mt-2 ml-2 text-msscc-gray-faint">
                Email:
            </div>
            <div className="mx-2 bg-msscc-pink-light pl-1 rounded-sm">
                <div
                  className="text-base text-white mb-3 truncate"
                  title={logInAdmin?.email}>
                {logInAdmin?.email}
              </div>
            </div>
          </aside>
        </div>

        <div className="bg-msscc-gray-faint w-full min-w-0 flex flex-col rounded-md">
          {/* Toolbar: sticks to the top on phones/tablets, normal from lg up.
              If you have a fixed site header, change top-0 to its height (e.g. top-16). */}
          <div className="sticky top-0 z-20 flex items-center gap-2 rounded-t-md bg-msscc-gray-faint px-2 py-2 shadow-sm lg:static lg:shadow-none">
  <div className="whitespace-nowrap text-lg text-msscc-teal-dark sm:text-2xl">
    Admin List
  </div>
  <div className="flex flex-1 justify-end gap-2 sm:gap-4">
    {logInType === "Developer Admin" && (
      <button
        type="button"
        className="w-12 rounded-md bg-green-500 py-1 text-center text-xs text-white hover:bg-green-600 sm:w-24 sm:py-2 sm:text-base"
        onClick={() => { setSelectedAdmin(null); setAdminPopUpType("create"); }}
      >
        Add
      </button>
    )}
    <button
      type="button"
      className="w-12 rounded-md bg-blue-400 py-1 text-center text-xs text-white hover:bg-blue-600 sm:w-24 sm:py-2 sm:text-base"
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
