"use client";
import { isValid } from "zod/v3";
import { AdminRecord, PermissionRecord } from "./adminRecord";
import { useState, useEffect } from 'react';
import { isValidEmail } from '@/utils/emailValidation';

function formatPermissionKey(key: string): string {
    return key
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export function PermissionCard (
  { adminInformation, currentUserInformation, onPermissionToggle }:
  {adminInformation:AdminRecord, currentUserInformation: AdminRecord | null, onPermissionToggle: (id: number, permissionName: string) => void })
  {

  return (
    <div className={`border rounded-md p-6 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x min-h-32 items-center ${currentUserInformation?.email === adminInformation.email ? 'bg-yellow-100' : 'bg-white'}`}>
      <div className = "basis-2/12 w-full md:w-auto">
        <h1 className = "text-black text-[clamp(0.75rem,2vw,1.25rem)]">{adminInformation.first_name} {adminInformation.last_name}</h1>
        {adminInformation.is_executive && <p className = "text-gray-500 text-[clamp(0.5rem,1vw,1rem)]">Executive</p>}
      </div>
      <p className = "basis-3/12 w-full md:w-auto flex items-center justify-center text-black text-[clamp(0.5rem,1.5vw,1.0rem)]">{adminInformation.email}</p>

      {/* Permissions Grid*/}
      <div className = "basis-6/12 w-full md:w-auto gap-2 md:gap-4 pl-4 grid grid-cols-2 md:grid-cols-3">
      {Object.entries(adminInformation.permissions).slice()
      .map(([permissionName, hasPermission]) => (
      <p key={permissionName}>
        {PermissionIcon({
            currentPermission: { permissionName, hasPermission },
            isExecutiveView: currentUserInformation?.is_executive ?? false,
            onToggle: () => onPermissionToggle(adminInformation.id, permissionName)
        })}
      </p>
      ))}
      </div>
      {/*Create and Delete*/}
      <div className="flex-col basis-1/12 pl-4 gap-2">
        <div
        className="bg-gray-500 hover:bg-gray-600 text-white text-center py-2 px-4 cursor-pointer"
        >Edit</div>
        <div
        className="bg-red-500 hover:bg-red-600 text-white text-center py-2 px-4 cursor-pointer"
        onClick={() => confirmAndDelete({selectedAdmin: adminInformation})}
        >Delete</div>
      </div>

    </div>
  );
}

function PermissionIcon({ currentPermission, isExecutiveView, onToggle }: {
    currentPermission: PermissionRecord,
    isExecutiveView: boolean,
    onToggle: () => void
  }) {

  if(isExecutiveView) { // Executive View if logged in and user is Executive
    return (
      <button onClick={onToggle}
        className={`${currentPermission.hasPermission ? "bg-green-500 hover:bg-green-700 border-green-500 hover:border-green-700": "bg-gray-500 hover:bg-gray-700 border-gray-500 hover:border-gray-500 opacity-50"}
        text-white border-2 p-1 md:p-1 text-[clamp(0.25rem,1.2vw,0.75rem)] rounded-sm inline-flex items-center justify-center leading-none h-8 md:h-10 w-full text-center`}>
        {formatPermissionKey(currentPermission.permissionName)}
      </button>
    );
  }else{ // Non Executive view
    if (currentPermission.hasPermission) {
      return (
          <span className="text-green-600 border-2 p-1 md:p-1 text-[clamp(0.5rem,1.2vw,1.0rem)]  border-green-600 rounded-sm inline-flex items-center justify-center leading-none h-8 md:h-10 w-full text-center">
          {formatPermissionKey(currentPermission.permissionName)}</span>
      )
    }else{
      return (
        <span className="invisible text-red-200 p-1 md:p-1 text-[clamp(0.5rem,1.2vw,1.0rem)]  inline-flex items-center justify-center leading-none h-8 md:h-10 w-full text-center">
          Developer Placeholder</span>
      )
    }
  }
}


export function NewAdminPopup({
  currentAdminList,
  isOpen,
} : {
  currentAdminList : AdminRecord[];
  isOpen: (value:boolean) => void;
}){
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string>("");

  useEffect(() =>{
      function handleKeyDown(e: KeyboardEvent){
        if (e.key === "Escape"){
          isOpen(false);
        }
      }
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen])
  useEffect(() => {
  if (submissionError) {
    window.alert(submissionError);
  }
}, [submissionError]);
  return(
    <div
    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    onClick={() => isOpen(false)}
    >
      <div
      className="bg-white rounded p-6 w-96"
      onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          Add New Admin
        </h2>

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
        <div className="flex">
        <button
          onClick={async() => await validateAndSubmit(
            {
            firstName: firstName || "",
            lastName: lastName || "",
            email: email || "",
            currentAdminList: currentAdminList,
            setSubmissionError: setSubmissionError,
            }
          )}
          disabled={firstName == "" || lastName == "" || email == "" || !isValidEmail(email || "")}
          className="mx-12 mt-4 w-full bg-blue-500 text-white font-semibold px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
        >
          Add
        </button>
        <button
          onClick={() => isOpen(false)}
          className="mx-12 mt-4 w-full bg-gray-500 text-white font-semibold px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
        </div>
      </div>
    </div>
  )
}

async function validateAndSubmit({
  firstName,
  lastName,
  email,
  currentAdminList,
  setSubmissionError
} : {
  firstName: string;
  lastName: string;
  email: string;
  currentAdminList: AdminRecord[];
  setSubmissionError : (value: string) => void;
}){
  if (currentAdminList.some((admin) => admin.email.toLowerCase() === email.toLowerCase())){
    setSubmissionError(email + " is already in use.");
    return;
  }
  if (
    currentAdminList.some((admin) => admin.first_name.toLowerCase() === firstName.toLowerCase())
    &&
    currentAdminList.some((admin) => admin.last_name.toLowerCase() === lastName.toLowerCase())
  ){
    setSubmissionError(firstName + " " + lastName + " already has an account.");
    return;
  }

  const token = localStorage.getItem("msscc_access_token");

    try {
    const res = await fetch("http://localhost:8000/api/admins/create/", {
      method: "POST",
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

    if (res.status === 201) {
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

async function confirmAndDelete({
  selectedAdmin,
} : {
  selectedAdmin : AdminRecord;
}){
  const token = localStorage.getItem("msscc_access_token");

  const confirmationOne = window.confirm("Are you sure you want to delete:\n"
     + selectedAdmin.email + "\n" + selectedAdmin.last_name + ", " + selectedAdmin.first_name);

  if (!confirmationOne){
    window.alert("Canceling Delete")
    return;
  }

  const confirmationTwo = window.confirm("Are you sure you want to delete the admin account?\nThis action cannot be undone.")

  if(!confirmationTwo){
    window.alert("Canceling Delete Request")
    return;
  }

  window.alert("Admin has been deleted");
}
