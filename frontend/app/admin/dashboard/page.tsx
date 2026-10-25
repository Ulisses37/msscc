'use client';

import { useEffect, useState } from 'react';

import { fetchLocalStorageAdmin } from '@/components/admin/AdminPermssionHandler';
import { DeepLUsageMeter } from '@/components/admin/DeepLUsageMeter';

import { getEvents } from '@/services/eventService';
import type { Event } from '@/types/event';


import { DonationEntry } from '@/components/admin/DonationDetailDrawer';
import { fetchFinancialRecords } from '@/services/financialRecordSearch';

import { AvailablePages, EventCarousel, DonationCarousel } from './pageDisplay';

type LocalAdminInfo = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  permissionData: Record<string, boolean>;
};

export default function Dashboard() {
  const [localAdmin, setLocalAdmin] = useState<LocalAdminInfo | null>(null);

  const [events, setEvents] = useState<Event[]>([]);
  const [donations, setDonations] = useState<DonationEntry[]>([]);

  useEffect(() => {
    setLocalAdmin(fetchLocalStorageAdmin() ?? null);
    fetchEvents().then(setEvents);
    fetchFinancialRecords<DonationEntry>('donations', "").then(setDonations);
  }, []);

  if (!localAdmin) return null;

  return (
    <div>
      <div className="flex flex-col lg:flex-row bg-msscc-white font-body text-msscc-gray-dark">
        {/* Left Panel */}
        <aside className="w-full lg:w-48 flex-shrink-0 flex flex-col lg:self-start bg-msscc-pink-light">
          <div className="w-full bg-msscc-pink px-4 py-2 text-white">
            <div className="text-xl break-words">
              {localAdmin.firstName + ' ' + localAdmin.lastName}
            </div>
            <div className="text-sm text-gray-200 break-all">
              {localAdmin.email}
            </div>
          </div>
        </aside>

        {/* Center */}
        <div className="w-full min-w-0 px-4 py-4 lg:py-0 lg:px-0 lg:mx-4 lg:self-start">
          {/* Page list */}
          <div className="mb-12">
            <div className="text-msscc-pink-dark text-2xl lg:text-3xl font-bold border-b-4 border-msscc-pink-light">
              Your Pages
            </div>
            {Object.entries(localAdmin.permissionData)
              .filter(([, allowed]) => allowed)
              .map(([page]) => (
              <AvailablePages key={page} CategoryTitle={page} />
            ))}
          </div>
        </ div>

        {/* Right Panel */}
        <aside className="w-full lg:w-48 flex-shrink-0 flex flex-col sm:flex-row lg:flex-col lg:self-start gap-4 px-4 pb-4 lg:px-0 lg:pb-0 lg:mr-8">
          {/* Visit Counter */}
          <div className="bg-msscc-pink px-4 py-2 text-white text-center sm:flex-1 lg:flex-none">
            <div className="text-5xl">00</div>
            <div className="text-sm text-gray-200">Site Visits</div>
          </div>

          {/* Cloud Storage Capacity */}
          <div className="items-center flex bg-msscc-pink py-4 flex-col sm:flex-1 lg:flex-none">
            <div className="flex flex-row justify-center items-center gap-3 mb-3">
              <ProgressBar percent={72} />
              <div className="text-white items-center flex flex-col">
                <div className="text-2xl">00</div>
                <div className="text-base">Gb Free</div>
              </div>
            </div>
            <div className="text-gray-200">Image Storage Capacity</div>
          </div>

          {/* Keep translation quota visible beside the other dashboard capacity information. */}
          <DeepLUsageMeter />
        </aside>
      </div>

        {/* Front end preview */}
        <div>
          <div className="min-w-0 px-4 py-4 lg:py-0 lg:px-0 lg:mx-16 flex flex-col gap-4">
            <EventCarousel data={events} />
            <DonationCarousel data={donations}/>
          </div>
        </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="w-6 h-16 bg-msscc-gray-light overflow-hidden flex flex-col justify-end"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="w-full bg-blue-600 transition-all duration-500"
        style={{ height: `${clamped}%` }}
      />
    </div>
  );
}

async function fetchEvents(){
  try {
    const data = await getEvents();

    // Filter to published only, then sort by startDatetime ascending
    const sorted = data
      .sort((a, b) =>
      new Date(b.startDatetime).getTime() - new Date(a.startDatetime).getTime(),
      );
      return(sorted);
  } catch (error) {
    console.error("Error fetching events:", error);
  }
  return [];
}
