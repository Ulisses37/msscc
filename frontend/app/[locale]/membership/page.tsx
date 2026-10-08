'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';
import { FallBack } from '@/components/content/ContentFallBack';
import { MembershipOptions } from '@/components/membership/MembershipOptions';
import Button from '@/components/ui/Button';

import type { MembershipOptionId } from '@/constants/membershipOptions';
import type { DbContentBlock } from '@/types/content';

import { usePreviewBlocks } from '@/hooks/usePreviewBlocks';
import { fetchPageContent, getCachedPageContent } from '@/utils/content';

export default function MembershipPage() {
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>(
    getCachedPageContent('membership'),
  );

  const [selectedOptionId, setSelectedOptionId] =
    useState<MembershipOptionId | null>(null);

  const previewReceivedRef = usePreviewBlocks(setContentBlocks);
  const params = useParams();
  const locale = String(params?.locale ?? 'en');

  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('membership');

        if (previewReceivedRef.current) {
          return;
        }

        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

    loadPageContent();
  }, []);

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/media/`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch media list');
      }

      const items = await response.json();

      const formItem = items.find(
        (item: { file_name: string; file_url: string }) =>
          item.file_name === 'Printable_Membership_Form.pdf',
      );

      if (!formItem?.file_url) {
        alert('Membership form not found on the server.');
        return;
      }

      const fileResponse = await fetch(formItem.file_url);
      const blob = await fileResponse.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Membership_Form.pdf');

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <main className="w-full min-w-0 max-w-full">
      {/* Staff-editable membership content */}
      <section
        className="
          mx-auto w-full min-w-0 max-w-content
          px-4 py-8
          [overflow-wrap:anywhere]
          sm:px-6 sm:py-10
          [&_h2]:text-[clamp(2rem,10vw,4rem)]
        "
      >
        {contentBlocks.map((block) => (
          <ContentBlockRenderer
            key={block.content_id}
            block={block}
            locale={locale}
          />
        ))}

        {!contentBlocks.length && <FallBack source="membership" />}
      </section>

      {/* Printable membership form */}
      <div className="mb-6 px-4 text-center">
        <Button
          text="Print Membership Form"
          padding="12px 24px"
          fontSize="16px"
          onClick={handleDownload}
        />
      </div>

      {/* Membership selection */}
      <section className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-10 sm:px-6">
        <MembershipOptions
          locale={locale}
          selectedOptionId={selectedOptionId}
          onOptionChange={setSelectedOptionId}
        />
      </section>
    </main>
  );
}