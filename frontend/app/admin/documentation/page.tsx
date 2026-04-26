// app/admin/documentation/page.tsx
'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import SupportForm from '@/components/ui/SupportForm';

export default function AdminDocumentationPage() {
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  //list of permisons with breif description of each
  const permissions = [
  { name: 'Page Edit', desc: 'Change contents on public pages.' },
  { name: 'Send Emails', desc: 'Manage and send to the mailing list.' },
  { name: 'Translation Edit', desc: 'Modify Japanese translations.' },
  { name: 'Event Manipulation', desc: 'Add, delete, and modify events.' },
  { name: 'View Member Records', desc: 'Access the member database.' },
  ];

  return (
    
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      <h1>Documentation Page</h1>

      {/* Section 1: Roles & Permissions */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Admin Roles & Permissions</h2>
        <div className="prose text-gray-700">
          <p>
            Administrative access is restricted to authorized personnel. Certain permisions may be restricted to certain admins. 

            <br />For permision assignments there are two main kinds of admins
            <br />Executive Admin: Full access to all system settings and user management.
            <br />General Admin: Access to the Dashboard and Media library.

            <br />Here is a explinaiton of each of the permissions that an admin can have, and what they do.
          </p>
        </div>

        {/* show description of each permission */}
        {permissions.map((p) => (
          <div key={p.name} className="p-4 border rounded-lg bg-white shadow-sm">
            <h4 className="font-bold text-[#d72638]">{p.name}</h4>
            <p className="text-sm text-gray-600">{p.desc}</p>
          </div>
        ))}
      </section>


      {/* common admin tasks , temporary for explinations*/}

      {/* edit events */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Editing Events</h2>
        <p className="text-gray-700">
          temp info, not yet implimented
          
        </p>
      </section>

      {/* sending emails */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Sending Emails</h2>
        <p className="text-gray-700">
          this is to be implimented
        </p>
      </section>



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