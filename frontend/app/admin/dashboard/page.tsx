'use client';

import { useEffect, useState } from 'react';

import { fetchLocalStorageAdmin } from '@/components/admin/AdminPermssionHandler';
import { DeepLUsageMeter } from '@/components/admin/DeepLUsageMeter';

import { getEvents } from '@/services/eventService';
import type { Event } from '@/types/event';


import { DonationEntry } from '@/components/admin/DonationDetailDrawer';
import { MembershipEntry } from '@/components/admin/MembershipDetailDrawer';
import { fetchDashboardFinancialRecords } from '@/services/financialRecordSearch';

import { AvailablePages, EventCarousel, DonationCarousel, MembershipCarousel, CurrentAdmin } from './pageDisplay';
import { SiteAnalytics, MembershipCounter, FinanceCounter } from './analytics';
import { ImageStorage } from './imageStorage';



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
    fetchDashboardFinancialRecords<DonationEntry>('donations').then(setDonations);
    fetchDashboardFinancialRecords<MembershipEntry>('memberships').then(setMemberships);
  }, []);

  if (!localAdmin) return null;

  return (
    <div>
      <div className="flex flex-col bg-msscc-white font-body text-msscc-gray-dark lg:flex-row lg:mb-8">
        {/* Left Panel */}
        <aside className="flex w-full flex-shrink-0 flex-col gap-4 px-4 pb-4 sm:flex-row lg:ml-8 lg:w-48 lg:flex-col lg:self-start lg:px-0 lg:pb-0">
          {/* Local Admin info */}
          <CurrentAdmin localAdmin ={localAdmin}/>

          {/* Cloud Storage Capacity */}
          <ImageStorage/>

          {/* Keep translation quota visible beside the other dashboard capacity information. */}
          <DeepLUsageMeter />
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
          <SiteAnalytics/>

          {/* Finances Counter */}
          <FinanceCounter/>

          {/* Membership Counter */}
          <MembershipCounter/>

        </aside>
      </div>

        {/* Front end preview */}
        <div>
          <div className="min-w-0 px-4 py-4 lg:py-0 lg:px-0 lg:mx-16 flex flex-col gap-4">
            <EventCarousel data={events} />
            <MembershipCarousel data={memberships}/>
            <DonationCarousel data={donations}/>
          </div>
      </div>
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



