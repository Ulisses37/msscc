'use client';

// React and Next Imports
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ContentStateTransition } from '@/components/content/ContentFallBack';

// Components
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';

// Types
import type { DbContentBlock } from '@/types/content';

// Project Utilities
import { fetchPageContent, getCachedPageContent, } from '@/utils/content';
import { usePreviewBlocks } from '@/hooks/usePreviewBlocks';
import { useDelayedFallback } from '@/hooks/useDelayedFallback';
import { useTrackVisit } from '@/utils/siteAnalytics';

/**
 * This is the general view home page
 *
 */

export default function HomePage() {
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>(getCachedPageContent('home'),);
  const previewReceivedRef = usePreviewBlocks(setContentBlocks);
  const contentDisplayState = useDelayedFallback(contentBlocks.length);
  const params = useParams();
  const locale = params?.locale;

  // Fetch text content from the database to display on page
  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('home');
        if (previewReceivedRef.current) return;
        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

   loadPageContent();
  }, []);

  useTrackVisit(); // increment site visits

  return (
    <main>
      {/* Display Staff-Editable Content Blocks */}
      <section className="mx-auto max-w-content px-6 py-10">
        <ContentStateTransition state={contentDisplayState} source="home">
          {contentBlocks.map((block) => (
            <ContentBlockRenderer
              key={block.content_id}
              block={block}
              locale={String(locale)}
            />
          ))}
        </ContentStateTransition>
      </section>
    </main>
  );
}
