"use client";
import { AdminRecord, SampleAdminRecordData } from "./sampleData";
import PermissionCard from "./permissionsCard";
import { useState } from "react";


export default function AdminPermissionPage() {
  const [currentUserInformation, setCurrentLogIn] = useState<AdminRecord | null>(null);

  return (
    <div className="flex justify-center min-h-screen">
      <div className="border w-full md:w-[70%] max-w-[1400px] rounded-md p-6 flex flex-col gap-4 bg-zinc-300">
          <button
            onClick={() => setCurrentLogIn(getCurrentUser("JaneDoe@gmail.com"))}
            className="bg-green-500 text-white py-2 px-4 m-2">
            Log in as Jane Doe (Executive)
          </button>

          <button
            onClick={() => setCurrentLogIn(getCurrentUser("AlexNguyen@gmail.com"))}
            className="bg-green-500 text-white py-2 px-4 m-2">
            Log in as Alex Nguyen (Non-Executive)
          </button>

          <button
            onClick={() => setCurrentLogIn(null)}
            className="bg-gray-500 text-white py-2 px-4 m-2">
            Log out
          </button>

        <div className="m-5 flex justify-between align-center">
          <div className="w-32"/> {/* Spacing */}
          <p className="text-6xl font-bold text-black font-serif">Permissions</p>
          <div className="w-32">
          {currentUserInformation?.executive ?
            <button className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 self-right rounded"
            onClick={() => updateDatabase()}>
                Update
            </button>
          : <div className="w-32"/>}
          </div>
        </div>
        {SampleAdminRecordData.map((record) => (
          <PermissionCard key={record.email} adminInformation={record} currentUserInformation={currentUserInformation ?? null} />
        ))}
      </div>
    </div>
  );

  function updateDatabase(){
      // Update database logic here
      console.log('Database updated');
  }

  function getCurrentUser(logInEmail: string){
    return SampleAdminRecordData.find(record => record.email === logInEmail) ?? null;
  }
}
