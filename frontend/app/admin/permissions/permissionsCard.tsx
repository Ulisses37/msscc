"use client";
import { AdminRecord, PermissionRecord } from "./adminRecord";
import { useState, useEffect } from 'react';
import { isValidEmail } from '@/utils/emailValidation';
import { fetchLocalStorageAdmin, getToolTip } from "@/components/admin/AdminPermssionHandler";

// text-base keeps iOS Safari from zooming in when an input is focused
const inputClass =
  "mt-1 w-full rounded-md border border-msscc-gray-light bg-msscc-white px-3 py-2 text-base font-normal text-msscc-gray-dark outline-none placeholder:text-msscc-gray-mid focus:border-msscc-pink focus:shadow-focus-admin";

const labelClass = "text-label tracking-label text-msscc-gray-mid";
const errorClass = "mt-1 text-label text-msscc-danger";

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
    className={`mx-2 my-2 flex flex-1 flex-col rounded-sm border border-msscc-gray-light bg-msscc-white font-body text-msscc-gray-dark sm:flex-row ${
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
      {/* Name / email / rank: on top on phones, left column from sm up */}
      <div className="flex w-full flex-col border-msscc-gray-light px-2 pb-0 pt-2 sm:my-2 sm:w-64 sm:shrink-0 sm:border-r sm:py-0">
        <div className="break-words font-heading text-heading-2 text-msscc-teal">
          {adminInformation.first_name + " " + adminInformation.last_name}
        </div>
        <div className="break-all text-body-sm text-msscc-gray-mid">
          {adminInformation.email}
        </div>
        <div className="pt-1 text-right sm:mt-auto">
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
              className="group min-w-28 rounded-sm px-2 py-1 text-xs tracking-btn text-msscc-pink-dark transition-colors hover:bg-msscc-danger hover:text-white"
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
                className="min-w-28 rounded-sm bg-msscc-pink px-2 py-1 text-xs tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
              >
                Promote Admin
              </button>
            )
          )}
        </div>
      </div>

      <div className="mx-4 border-t border-msscc-gray-light sm:hidden" />

      {/* Permission icons: 2 columns on phones, 3 from sm up */}
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 p-2 sm:grid-cols-3">
        {visiblePermissions.map(([permissionName, hasPermission]) => (
          <div key={permissionName} className="min-w-0" onClick={(e) => e.stopPropagation()}>
            <PermissionIcon
              currentPermission={{ permissionName, hasPermission }}
              onToggle={() => onPermissionToggle(adminInformation.id, permissionName)}
            />
          </div>
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
        ${currentPermission.hasPermission
          ? "bg-msscc-pink hover:bg-msscc-pink-dark"
          : "bg-msscc-gray-mid hover:bg-msscc-gray-dark"}
        flex h-10 w-full cursor-pointer items-center justify-center overflow-hidden rounded-sm px-1
        text-center text-body-sm leading-tight text-white break-words transition-colors
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
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onClick={() => setPType("")}
    >
      <div
      className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-md bg-msscc-white p-4 font-body text-msscc-gray-dark sm:p-6"
      onClick={(e) => e.stopPropagation()}
      >
          {
          pType =="update" ?
           <h2 className="mb-4 break-all border-b border-msscc-gray-light pb-3 font-heading text-heading-2 text-msscc-teal">Update
           <span className="block break-all">{email}</span>
           </h2>
            : <h2 className="mb-4 border-b border-msscc-gray-light pb-3 font-heading text-heading-2 text-msscc-teal">Create New Admin</h2>
          }
        {/* Editable fields */}
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>First Name
            <input
              type="text"
              value={firstName || ""}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={(e)=>setFirstName(e.target.value)}
              className={inputClass}
            />
            </label>
            {firstName == "" &&
            <div className={errorClass}>First Name cannot be empty</div>
            }
          </div>
          <div>
            <label className={labelClass}>Last Name
            <input
              type="text"
              value={lastName || ""}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={(e)=>setLastName(e.target.value)}
              className={inputClass}
            />
            </label>
            {lastName == "" &&
            <div className={errorClass}>Last Name cannot be empty</div>
            }
          </div>
          <div className="gap-0">
            <label className={labelClass}>Email
            <input
              type="text"
              value={email|| ""}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e)=>setEmail(e.target.value)}
              className={inputClass}
            />
            </label>
            {email == "" &&
            <div className={errorClass}>Email cannot be empty</div>
            }
            {(!isValidEmail(email || "") && email != null) &&
            <div className={errorClass}>Email is invalid</div>
            }
          </div>
        </div>

        {/* Validation and Submission: stacked on phones, a row from sm up */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
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
          className="w-full rounded-sm bg-msscc-pink px-4 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark disabled:cursor-not-allowed disabled:bg-msscc-gray-light disabled:text-msscc-gray-mid"
        >
          {pType =="update" ? "Save" : "Create"}
        </button>
        <button
          onClick={() => setPType("")}
          className="w-full rounded-sm border border-msscc-gray-light bg-msscc-white px-4 py-2 text-btn tracking-btn text-msscc-gray-dark transition-colors hover:border-msscc-pink hover:text-msscc-pink"
        >
          Cancel
        </button>
        <button
          onClick={() => confirmAndDelete({selectedAdmin: selectedAdmin})}
          className="w-full rounded-sm bg-msscc-danger px-4 py-2 text-btn tracking-btn text-white transition-colors hover:opacity-90"
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
