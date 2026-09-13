'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';
import { DonationForm } from '@/components/support/DonationForm';

import type { DbContentBlock } from '@/types/content';

import { fetchPageContent } from '@/utils/content';

export default function SupportPage() {
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>([]);
  const params = useParams();
  const locale = params?.locale;

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
      <section className="mb-10 w-full max-w-[1200px] space-y-6">
        {contentBlocks.map((block) => (
          <ContentBlockRenderer
            key={block.content_id}
            block={block}
            locale={String(locale)}
          />
        ))}
      </section>

      <DonationForm />

      <footer className="mt-16 w-full max-w-[1200px] border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
        Matsuyama-Sacramento Sister City Corporation
      </footer>
    </main>
  );
}