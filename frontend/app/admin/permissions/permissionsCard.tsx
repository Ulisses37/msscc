"use client";
import { AdminRecord, PermissionRecord } from "./adminRecord";
import { useState, useEffect } from 'react';
import { isValidEmail } from '@/utils/emailValidation';
import { fetchLocalStorageAdmin, getToolTip } from "@/components/admin/AdminPermssionHandler";

function formatPermissionKey(key: string): string {
    return key
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function PermissionCard(
  {
    adminInformation,
    logInType,
    onPermissionToggle,
    setAdminPopUpType,
    setSelectedAdmin,
  } : {
    adminInformation:AdminRecord,
    logInType: string;
    onPermissionToggle: (id: number, permissionName: string) => void
    setSelectedAdmin: (selectedAdmin: AdminRecord) => void
    setAdminPopUpType: (pType: string) => void
  }){
  const visiblePermissions = Object.entries(adminInformation.permissions).filter(
    ([permissionName]) => !(logInType === "Admin" && permissionName === "Permissions")
  );
  const canEdit = logInType !== "Admin";
  return(
  <div
    className={`bg-white mx-2 my-2 flex flex-1 border-2 border-msscc-gray-light ${
      canEdit ? "cursor-pointer hover:bg-msscc-pink-faint" : ""
    }`}
    onClick={
      canEdit
       ? () => {
          setSelectedAdmin(adminInformation);
          setAdminPopUpType("update");
        }
      : undefined
    }
  >
      <div className="px-2 my-2 border-r-2 border-msscc-gray-light w-64">
        <div className="text-xl">
          {adminInformation.first_name + " " + adminInformation.last_name}
        </div>
        <div className="text-sm text-gray-500">
          {adminInformation.email}
        </div>
        <div className="text-right pt-2">
          {adminInformation.is_executive ? (
      <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        confirmAndPromote({
          selectedAdmin: adminInformation,
          moteType: "demote",
        });
      }}
      className="group min-w-28 rounded px-2 py-1 text-xs font-bold text-msscc-pink-dark hover:bg-red-500 hover:text-white"
    >
      <span className="group-hover:hidden">Executive Admin</span>
      <span className="hidden group-hover:inline">Demote Admin</span>
      </button>
      ) : (
      logInType === "Developer Admin" && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          confirmAndPromote({
            selectedAdmin: adminInformation,
            moteType: "promote",
          });
        }}
        className="min-w-28 rounded bg-green-500 px-2 py-1 text-xs font-bold text-white hover:bg-green-600"
      >
        Promote Admin
      </button>
      )
    )}
  </div>

      </div>
      <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 p-2">
        {visiblePermissions.map(([permissionName, hasPermission]) => (
          <p key={permissionName} onClick={(e) => e.stopPropagation()}>
            {PermissionIcon({
              currentPermission: { permissionName, hasPermission },
              onToggle: () => onPermissionToggle(adminInformation.id, permissionName),
            })}
          </p>
        ))}
      </div>
    </div>
  );
}



function PermissionIcon({ currentPermission, onToggle }: {
    currentPermission: PermissionRecord,
    onToggle: () => void
  }) {
    return (
      <div
      className={`
        ${currentPermission.hasPermission ? "bg-green-500 hover:bg-green-700" : "bg-gray-400 hover:bg-gray-600"}
        cursor-pointer text-white text-[clamp(0.25rem, 1.2vw, 0.75rem)] rounded-sm py-1 w-full text-center
        `}
      onClick={onToggle}
      title={getToolTip(currentPermission.permissionName)}
      >
        {formatPermissionKey(currentPermission.permissionName)}
      </div>
    );
}

export function AdminPopup({
  currentAdminList,
  setPType,
  pType,
  selectedAdmin,
} : {
  currentAdminList : AdminRecord[];
  setPType: (pType: string) => void;
  pType: string;
  selectedAdmin: AdminRecord | null;
}){
  const [firstName, setFirstName] = useState<string | null>(selectedAdmin?.first_name || null);
  const [lastName, setLastName] = useState<string | null>(selectedAdmin?.last_name || null);
  const [email, setEmail] = useState<string | null>(selectedAdmin?.email || null);
  const [submissionError, setSubmissionError] = useState<string>("");

  useEffect(() =>{
      function handleKeyDown(e: KeyboardEvent){
        if (e.key === "Escape"){
          setPType("");
        }
      }
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setPType])
  useEffect(() => {
  if (submissionError) {
    window.alert(submissionError);
  }
}, [submissionError]);
  return(
    <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onClick={() => setPType("")}
    >
      <div
      className="bg-white rounded p-6 w-96"
      onClick={(e) => e.stopPropagation()}
      >
          {
          pType =="update" ?
           <h2 className="text-xl font-bold mb-4">Update {email} </h2>
            : <h2 className="text-xl font-bold mb-4"> Create New Admin </h2>
          }
        {/* Editable fields */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-semibold">First Name
            <input
              type="text"
              value={firstName || ""}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={(e)=>setFirstName(e.target.value)}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
            </label>
            {firstName == "" &&
            <div className="text-red-500 text-xs"> First Name cannot be empty </div>
            }
          </div>
          <div>
            <label className="text-sm font-semibold">Last Name
            <input
              type="text"
              value={lastName || ""}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={(e)=>setLastName(e.target.value)}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
            </label>
            {lastName == "" &&
            <div className="text-red-500 text-xs"> Last Name cannot be empty </div>
            }
          </div>
          <div className="gap-0">
            <label className="text-sm font-semibold">Email
            <input
              type="text"
              value={email|| ""}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e)=>setEmail(e.target.value)}
              className="w-full border rounded px-2 py-1 mt-1 font-normal"
            />
            </label>
            {email == "" &&
            <div className="text-red-500 text-xs"> Email cannot be empty </div>
            }
            {(!isValidEmail(email || "") && email != null) &&
            <div className="text-red-500 text-xs"> Email is invalid</div>
            }
          </div>
        </div>

        {/* Validation and Submission */ }
        <div className="flex flex-row gap-4">
        <button
          onClick={async() => await validateAndSubmit(
            {
            firstName: firstName || "",
            lastName: lastName || "",
            email: email || "",
            currentAdminList: currentAdminList,
            pType: pType,
            admin_id: selectedAdmin?.id || null,
            setSubmissionError: setSubmissionError,
            }
          )}
          disabled={firstName == "" || lastName == "" || email == "" || !isValidEmail(email || "")}
          className="mt-4 w-full bg-blue-500  font-semibold px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-200 disabled:cursor-not-allowed"
        >
          {pType =="update" ? <p className="text-white"> Save </p> : <p className="text-white">Create</p>}
        </button>
        <button
          onClick={() => setPType("")}
          className="mt-4 w-full bg-gray-500 text-white font-semibold px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={() => confirmAndDelete({selectedAdmin: selectedAdmin})}
          className="mt-4 w-full bg-red-500 text-white font-semibold px-4 py-2 rounded hover:bg-red-600"
        >
          Delete
        </button>
        </div>
      </div>
    </div>
  )
}

export async function validateAndSubmit({
  firstName,
  lastName,
  email,
  currentAdminList,
  pType,
  admin_id,
  setSubmissionError
} : {
  firstName: string;
  lastName: string;
  email: string;
  currentAdminList: AdminRecord[];
  admin_id: number | null;
  pType: string;
  setSubmissionError : (value: string) => void;
}){
  if (pType != "update"){
    if (currentAdminList.some((admin) => admin.email.toLowerCase() === email.toLowerCase())){
      setSubmissionError(email + " is already in use.");
      return;
    }
    if (
      currentAdminList.some(
        (a) =>
          a.first_name.toLowerCase() === firstName.toLowerCase() &&
          a.last_name.toLowerCase() === lastName.toLowerCase()
      )
    ){
      setSubmissionError(firstName + " " + lastName + " already has an account.");
      return;
    }
  }

  const token = localStorage.getItem("msscc_access_token");
  const url = (pType == "update") ?
  `${process.env.NEXT_PUBLIC_API_URL}/api/admins/update/${admin_id}`
  :
  `${process.env.NEXT_PUBLIC_API_URL}/api/admins/create/`

  const method = (pType == "update") ? "PATCH" : "POST"

    try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: email,
      }),
    });

    if (res.ok) {
      window.location.reload();
      return;
    }

    if (res.status === 400) {
      const data = await res.json();
      const message =
        data.email?.[0] ||
        data.first_name?.[0] ||
        data.last_name?.[0] ||
        "Could not create admin. Please check the form and try again.";
      setSubmissionError(message);
      return;
    }

    if (res.status === 401) {
      setSubmissionError("You are not authorized to perform this action. Please log in again.");
      return;
    }

    setSubmissionError("Something went wrong. Please try again.");
  } catch {
    setSubmissionError("Network error. Please check your connection and try again.");
  }
}

export async function confirmAndDelete({
  selectedAdmin,
} : {
  selectedAdmin : AdminRecord | null;
}){
  if (!selectedAdmin) return;
  const token = localStorage.getItem("msscc_access_token");


  const confirmationOne = window.confirm("Are you sure you want to delete the admin account?\nThis action cannot be undone.")

  if(!confirmationOne){
    return;
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admins/delete/${selectedAdmin.id}`,{
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}`} : {}),
      }
    });

    if (res.ok){
      window.alert("Admin has been deleted");
      window.location.reload();
      return;
    }

    if (res.status === 400){
      const data = await res.json();
      window.alert(data.detail);
      return;
    }

    if (res.status === 401) {
      window.alert("Authentication failed. Please log in again.");
      return;
    }

    if (res.status === 404){
      window.alert("Admin has already been deleted");
    }
  } catch {
    window.alert("Network Error. Please reload the page and try again.");
  }
}

export async function confirmAndPromote(
  {
    selectedAdmin,
    moteType,
  }:{
    selectedAdmin: AdminRecord;
    moteType: "promote" | "demote";
}){
  const token = localStorage.getItem("msscc_access_token");
  const devEmail = fetchLocalStorageAdmin()?.email;

  if(devEmail != "msscc.scrumlords.dev@gmail.com") return; // not approved dev email

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admins/promote-executive/${selectedAdmin.id}`,
      {
        method: "PATCH",
        headers:{
          "Content-Type" : "application/json",
          ...(token ? { Authorization: `Bearer ${token}`} : {}),
        },
        body: JSON.stringify({ is_executive: moteType === "promote"}),
      });


    if (res.ok){
      window.location.reload();
      return;
    }

    if (res.status === 400){
      const data = await res.json();
      window.alert(data.detail);
      return;
    }

    if (res.status === 401) {
      window.alert("Authentication failed. Please log in again.");
      return;
    }

    if (res.status === 403 || res.status === 404) {
      const data = await res.json();
      window.alert(data.detail);
      return;
    }

  } catch{
    window.alert("Network Error. Please reload the page and try again.");
  }
}

