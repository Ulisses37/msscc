// app/admin/documentation/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import SupportForm from '@/components/ui/SupportForm';

import { pageList } from './pageDocumentation';
import { fetchLocalStorageAdmin } from '@/components/admin/AdminPermssionHandler';
import PageAccordion from './PageAccordion';

type LocalAdminInfo = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  permissionData: Record<string, boolean>;
  isExecutive: boolean;
};


export default function AdminDocumentationPage() {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  const [localAdmin, setLocalAdmin] = useState<LocalAdminInfo | null>(null);

  useEffect(() => {
    setLocalAdmin(fetchLocalStorageAdmin() ?? null);
  }, []);

  return (
<div className="mx-auto max-w-5xl space-y-4 p-4 text-sm sm:space-y-5 sm:p-6 sm:text-base">
  <header className="mb-4 w-full border-b border-msscc-gray-light pb-4 sm:mb-6">
    <h1 className="font-heading text-2xl text-msscc-teal sm:text-4xl md:text-display">
      Documentation & Help
    </h1>
  </header>

  {/* General Site Knowledge */}
  <div className="rounded-md border-2 border-msscc-gray-mid bg-msscc-gray-faint p-3 sm:p-4">
    <div className="text-lg sm:text-heading-2">General Site Information</div>
    <div className="pb-1">When referring to MSSCC site, there are two different sides:</div>

    <div className="pl-3 sm:pl-4">
      <p className="text-sm sm:text-base">The User-Side is the public facing part of the websites that clients, visitors and donators will see.</p>
      <p className="text-sm sm:text-base">This is where visitors can see the MSSCC programs, events, donation options, and supporters.</p>
    </div>
    <div className="pb-2 pl-3 sm:pl-4">
      &ensp;-&ensp;It is primarily made up of the <span className="text-base font-bold text-msscc-teal sm:text-lg">Teal</span> color scheme.
    </div>

    <div className="pl-3 sm:pl-4">
      <p className="text-sm sm:text-base">The Admin-Side is the MSSCC member only side that requires an email and password to access.</p>
      <p className="text-sm sm:text-base">This side is where MSSCC members can manage important information like page contents, financial records, and events and their volunteers.</p>
    </div>
    <div className="pl-3 sm:pl-4">
      &ensp;-&ensp;It is primarily made up of the <span className="text-base font-bold text-msscc-pink sm:text-lg">Pink</span> color scheme.
    </div>
  </div>

  {/* User-Side Information */}
  <div className="rounded-md border-2 border-msscc-teal-light bg-msscc-teal-faint p-3 sm:p-4">
    <div className="text-lg sm:text-heading-2">User-Side Information</div>
    More text to come.
  </div>

  {/* Admin-Side Information */}
  <div className="rounded-md border-2 border-msscc-pink-light bg-msscc-pink-faint p-3 sm:p-4">
    <div className="text-lg sm:text-heading-2">Admin-Side Information</div>
          {localAdmin &&
            pageList
              .filter(
                (page) => localAdmin.permissionData[page.pageName] || localAdmin.isExecutive
              )
              .map((page) => (
              <PageAccordion
                key={page.pageName}
                pageName={page.pageName}
                pageDescription={page.pageDescription}
                pageInstructions={page.pageInstructions}
              />
        ))}
      </div>

      {/* Support Section - setup for linked task */}
      <section className="px-2 text-center">
        <h2 className="mb-2 text-lg font-bold sm:text-xl">Need Technical Assistance?</h2>
        <p className="mb-4 text-sm text-gray-700 sm:mb-6 sm:text-base">
          If you encounter issues with the membership database or the administrative dashboard, please contact support.
        </p>
        <Button
          text="Contact Support"
          padding="12px 32px"
          fontSize="16px"
          onClick={() => setIsSupportModalOpen(true)}
        />
      </section>

      {/* Support Form*/}
      {isSupportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-2xl">
            <SupportForm onClose={() => setIsSupportModalOpen(false)} />
          </div>
      </div>
      )}
    </div>
  );
}
