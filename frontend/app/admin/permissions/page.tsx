"use client";
import { AdminRecord} from "./adminRecord";
import PermissionCard from "./permissionsCard";
import { useEffect, useState } from "react";




export default function AdminPermissionPage() {
  const [adminRecords, setAdminRecords] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserInformation, setCurrentLogIn] = useState<AdminRecord | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/admins/")
        .then(res => res.json())
        .then((data: AdminRecord[]) => {
            setAdminRecords(data);
            setLoading(false);
        });
  }, []);

  console.log("adminRecords:", adminRecords);
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

          <div className="m-5 flex items-center">
            <div className="flex-1 shrink"/> {/* Spacing */}
            <p className="text-[clamp(2.5rem,4vw,3.75rem)] font-bold text-black font-serif shrink-0">Permissions</p>
            <div className="flex-1 shrink justify-end align-right flex">
              {currentUserInformation?.is_executive &&
              <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold rounded whitespace-nowrap
              text-[clamp(0.75rem,1.2vw,1rem)] py-[clamp(0.25rem,0.5vw,0.5rem)] px-[clamp(0.75rem,1vw,1rem)]"
              onClick={() => updateDatabase()}>
              Update
              </button>
            }
            </div>
          </div>
        {adminRecords.map((record) => (
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
    return adminRecords.find(record => record.email === logInEmail) ?? null;
  }
}
