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
    <div className="max-w-5xl mx-auto p-6 space-y-5 ">
      <header className="mb-6 w-full border-b border-msscc-gray-light pb-4">
        <h1 className="font-heading text-display text-msscc-teal">Documentation & Help</h1>
      </header>

      {/* General Site Knowledge */}
      <div className="bg-msscc-gray-faint rounded-md p-4 border-2 border-msscc-pink-light">
        <div className="text-heading-2">General Site Information</div>
        <div className="pb-1">When referring to MSSCC site, there are two different sides:</div>
        <div className="pl-4">
          The User-Side is the public facing part of the websites that clients, visitors and donators will see.
          <br />
          This is where visitors can see the MSSCC programs, events, donation options, and supporters.
        </div>
        <div className="pl-4 pb-2">&ensp;-&ensp;It is primarily made up of the <p className="inline text-msscc-teal font-bold text-lg">Teal</p> color scheme.</div>
        <div className="pl-4">
          The Admin-Side is the MSSCC member only side that requires an email and password to access.
          <br />
          This side is where MSSCC members can manage important information like page contents, financial records, and events and their volunteers.
        </div>
        <div className="pl-4">&ensp;-&ensp;It is primarily made up of the <p className="inline text-msscc-pink font-bold text-lg">Pink </p> color scheme.</div>
      </div>

      {/* User-Side Information */}
      <div className="bg-msscc-gray-faint rounded-md p-4 border-2 border-msscc-pink-light">
        <div className="text-heading-2">User-Side Information</div>
        More text to come.
      </div>

      {/* Admin-Side Information */}
      <div className="bg-msscc-gray-faint rounded-md p-4 border-2 border-msscc-pink-light">
        <div className="text-heading-2">Admin-Side Information</div>
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
      <section className="text-center">
        <h2 className="text-xl font-bold mb-2">Need Technical Assistance?</h2>
        <p className="text-gray-700 mb-6">
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
          className="fixed inset-0 z- flex items-center justify-center bg-black/40 backdrop-blur-md"
          style={{ margin: 0, padding: 0 }} // Ensures no inherited spacing
        >
          <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-lg overflow-hidden border border-gray-100">
            <SupportForm onClose={() => setIsSupportModalOpen(false)} />
          </div>
        </div>
      )}

    </div>
  );
}
