'use client';

// React and Next Imports
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import img from '@/assets/Illustration.jpg';

// Components
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';

// Types
import type { DbContentBlock } from '@/types/content';

// Project Utilities
import { fetchPageContent } from '@/utils/content';

/**
 * This is the general view home page
 *
 */

export default function HomePage() {
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>([]);
  const params = useParams();
  const locale = params?.locale;

  // Fetch text content from the database to display on page
  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('home');
        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

    loadPageContent();
  }, []);

  return (
    <main>
      {/* Display Staff-Editable Content Blocks */}
      <section className="mx-auto max-w-content px-6 py-10">
        {contentBlocks.map((block) => (
          <ContentBlockRenderer
            key={block.content_id}
            block={block}
            locale={String(locale)}
          />
        ))}
      </section>
    </main>
  );
}
