'use client';

import { useEffect, useState } from 'react';

import { fetchLocalStorageAdmin } from '@/components/admin/AdminPermssionHandler';
import { DeepLUsageMeter } from '@/components/admin/DeepLUsageMeter';

import { getEvents } from '@/services/eventService';
import type { Event } from '@/types/event';


import { DonationEntry } from '@/components/admin/DonationDetailDrawer';
import { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';
import { fetchFinancialRecords } from '@/services/financialRecordSearch';

import { AvailablePages, EventCarousel, DonationCarousel, MembershipCarousel } from './pageDisplay';



type LocalAdminInfo = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  permissionData: Record<string, boolean>;
  isExecutive: boolean;
};

export default function Dashboard() {
  const [localAdmin, setLocalAdmin] = useState<LocalAdminInfo | null>(null);

  const [events, setEvents] = useState<Event[]>([]);
  const [donations, setDonations] = useState<DonationEntry[]>([]);
  const [memberships, setMemberships] = useState<MembershipEntry[]>([]);

  useEffect(() => {
    setLocalAdmin(fetchLocalStorageAdmin() ?? null);
    fetchEvents().then(setEvents);
    fetchFinancialRecords<DonationEntry>('donations', "").then(setDonations);
    fetchFinancialRecords<MembershipEntry>('memberships', "").then(setMemberships);
  }, []);

  if (!localAdmin) return null;

  return (
    <div>
      <div className="flex min-h-dvh flex-col bg-msscc-white font-body text-msscc-gray-dark lg:flex-row">
        {/* Left Panel */}
        <aside className="flex w-full flex-shrink-0 flex-col bg-msscc-pink-light lg:w-48 lg:self-start">
          <div className="w-full bg-msscc-pink px-4 py-2 text-white">
            <div className="break-words font-heading text-heading-2">
              {localAdmin.firstName + ' ' + localAdmin.lastName}
            </div>
            <div className="break-all text-body-sm text-msscc-gray-faint">
              {localAdmin.email}
            </div>
          </div>
        </aside>

        {/* Center */}
        <div className="w-full min-w-0 px-4 py-4 lg:mx-4 lg:px-0 lg:py-0">
          <h1 className="border-b border-msscc-gray-light pb-2 font-heading text-display text-msscc-teal">
            Your Pages
          </h1>
          {Object.entries(localAdmin.permissionData)
            .filter(([, allowed]) => allowed || localAdmin.isExecutive)
            .map(([page]) => (
              <AvailablePages key={page} CategoryTitle={page} />
            ))}
        </div>

        {/* Right Panel */}
        <aside className="flex w-full flex-shrink-0 flex-col gap-4 px-4 pb-4 sm:flex-row lg:mr-8 lg:w-48 lg:flex-col lg:self-start lg:px-0 lg:pb-0">
          {/* Visit Counter */}
          <div className="rounded-sm bg-msscc-pink px-4 py-2 text-center text-white sm:flex-1 lg:flex-none">
            <div className="text-4xl font-body">00</div>
            <div className="text-label tracking-label text-msscc-gray-faint">Site Visits</div>
          </div>

          {/* Cloud Storage Capacity */}
          <div className="flex flex-col items-center rounded-sm bg-msscc-pink py-4 sm:flex-1 lg:flex-none">
            <div className="mb-3 flex flex-row items-center justify-center gap-3">
              <ProgressBar percent={72} />
              <div className="flex flex-col items-center text-white">
                <div className="text-4xl font-body">00</div>
                <div className="text-body-sm">Gb Free</div>
              </div>
            </div>
            <div className="text-label tracking-label text-msscc-gray-faint">
              Image Storage Capacity
            </div>
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
            <MembershipCarousel data={memberships}/>
          </div>
      </div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div
      className="flex h-16 w-6 flex-col justify-end overflow-hidden rounded-sm bg-msscc-gray-light"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="w-full bg-msscc-teal transition-all duration-500"
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
