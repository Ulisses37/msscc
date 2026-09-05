'use client';

// React and Next.js Imports
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

// Components
import { IntegerInput } from '@/components/ui/IntegerInput';
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';

// Types
import type { DbContentBlock } from '@/types/content';

// Project Utilities
import { fetchPageContent } from '@/utils/content';

export default function SupportPage() {
  {/*
    * Placeholder for IntegerInput component to demo functionality. Will be replaced with actual payment form/functionality in the future.
  */}
  const [donation, setDonation] = useState<number | ''>('');
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>([]);
  const params = useParams();
  const locale = params?.locale;

  // Fetch text content from the database to display on page
  useEffect(() => {
  const loadPageContent = async () => {
    try {
      const data = await fetchPageContent('support');
      setContentBlocks(data);
    } catch (error) {
      console.error('Error fetching page content:', error);
    }
  };

  loadPageContent();
}, []);

  return (
    <main className="mx-auto max-w-content px-6 py-10">
    {/* Display Staff-Editable Content Blocks */}
    <section className="mb-10 w-full max-w-[1200px] space-y-6">
      {contentBlocks.map((block) => (
        <ContentBlockRenderer
          key={block.content_id}
          block={block}
          locale={String(locale)}
        />
      ))}
    </section>

      <section className="w-full mt-16 pl-6 pr-6">
          <h2 className="text-2xl font-bold text-[#264653] mt-16 mb-6">
            Support us Today
          </h2>
          <div className="max-w-[600px]">
            {/* Example form submission component
            *PlaceHolder to Demo IntegerInput component functionality. Will be replaced with actual payment form in the future.
            */}
            <IntegerInput value={donation} onChange={setDonation} label="Donation Amount" placeholder="Enter a number" min={0} />
          </div>

      </section>

      {/* WEBSITE FOOTER: Moved outside the section to match the header style */}
      <footer className="w-full max-w-[1200px] mt-16 pt-8 border-t border-gray-200 text-center text-sm text-gray-500">
        Matsuyama-Sacramento Sister City Corporation
      </footer>

    </main>
  );
}
