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

  console.log(adminList);
  useEffect(() => {
    filterAdmins().then(setAdminList);
    console.log(adminList);
  }, []);
  return(
    <div className="flex flex-col w-full items-center">
      <header className="mb-6 border-b border-msscc-gray-light pb-4 w-full">
        <h1 className="font-heading text-2xl text-msscc-teal sm:text-display">Partners, Donors, & Sponsors</h1>
      </header>
      <div className="items-start w-full flex-row flex">
        {/*Div for asides*/}
        <div className="flex-col flex gap-2 items-center">
          {/*Current Logged in Admin Info*/}
          <aside className="w-full lg:w-64 border-msscc-gray-light bg-msscc-pink mr-4 rounded-sm">
            <div className="text-xl text-white pl-1 pt-2 border-b-2 border-msscc-gray-light mx-2 font-bold">
              {logInType}
            </div>
            <div className="mt-2 ml-2 text-msscc-gray-faint">
                Name:
              </div>
            <div className="mx-2 bg-msscc-pink-light pl-1 rounded-sm">
              <div className="texl-xl text-white">
                {logInAdmin?.firstName + " " + logInAdmin?.lastName}
              </div>
            </div>
            <div className="mt-2 ml-2 text-msscc-gray-faint">
                Email:
            </div>
            <div className="mx-2 bg-msscc-pink-light pl-1 rounded-sm">
                <div
                  className="text-md text-white mb-3 truncate"
                  title={logInAdmin?.email}>
                {logInAdmin?.email}
              </div>
            </div>
          </aside>
        </div>
        <div className="bg-msscc-gray-faint w-full flex flex-col rounded-md">
          <div className="flex flex-1 mt-2 mx-2 items-center">
            <div className="text-2xl text-msscc-teal-dark">
              Admin List
            </div>
            {/*Update and New Admin*/}

            <div className="justify-end flex flex-1 gap-4">
              {logInType === "Developer Admin" &&
              <div
                className="w-24 rounded-md text-white py-2 text-center bg-green-500 hover:bg-green-600 cursor-pointer disabled"
                onClick={()=>{setSelectedAdmin(null); setAdminPopUpType("create")}}
              >
                Add
              </div>
              }
              <div
                className="w-24 rounded-md text-white py-2 text-center bg-blue-400 hover:bg-blue-600 cursor-pointer disabled"
                onClick={()=> updateDatabase()}
              >
                Update
              </div>
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
      console.log(res);

      const allAdminList: AdminRecord[] = await res.json();
      console.log(allAdminList);

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

