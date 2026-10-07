'use client';

// React and Next Imports
import React, { useEffect, useState }from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';  // To be used if partner objects have links to their websites or profiles


// Components
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';
import { PartnerCard } from './PartnerCard';
import { FallBack } from '@/components/content/ContentFallBack'


// Types
import type { DbContentBlock } from '@/types/content';

// Utils Imports
import { fetchPageContent, getCachedPageContent, } from '@/utils/content';
import { usePreviewBlocks } from '@/hooks/usePreviewBlocks';

interface PartnerLinkProps {
  name: string;
  href: string;
}

interface PartnerRecord {
  id: number;
  name: string;
  categoryEn: string;
  category: string;
  imageUrl?: string;
  websiteUrl?: string;
}

function PartnerLink({ name, href }: PartnerLinkProps) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-words font-body text-msscc-gray-dark underline underline-offset-[3px] transition-colors hover:text-msscc-teal"
    >
      {name}
    </Link>
  );
}

export default function PartnersPage() {
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>(getCachedPageContent('partners'),);
  const previewReceivedRef = usePreviewBlocks(setContentBlocks);
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const params = useParams();
  const locale = params?.locale;
  const isJapanese = locale === 'ja';

  // Fetch text content from the database to display on page
  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('partners');
        if (previewReceivedRef.current) return;
        setContentBlocks(data);
      } catch (error) {
        console.error('Error fetching page content:', error);
      }
    };

    loadPageContent();
  }, []);

  // fetch partners and images from database instead of relying on sampleData
  useEffect(() => {
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/partners/`).then(res => res.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/`).then(res => res.json()),
    ])
      .then(([partnerRecords, mediaAssets]: [unknown[], unknown[]]) => {
        const mediaById = new Map(
          (mediaAssets as {media_asset_id: number; file_url: string | null}[])
            .map(m => [m.media_asset_id, m])
        );

        const mappedPartners: PartnerRecord[] = (partnerRecords as {
          partner_id: number;
          display_name_en: string;
          display_name_ja: string;
          category_en: string;
          category_ja: string;
          website_url: string | null;
          is_visible: boolean;
          display_order: number;
          media_asset: number | null;
        }[])
          .filter(partner => partner.is_visible)
          .sort((a, b) => a.display_order - b.display_order)
          .map(partner => ({
            id: partner.partner_id,
            name: isJapanese && partner.display_name_ja ? partner.display_name_ja : partner.display_name_en,
            categoryEn: partner.category_en,
            category: isJapanese && partner.category_ja ? partner.category_ja : partner.category_en,
            websiteUrl: partner.website_url ?? undefined,
            imageUrl: partner.media_asset
              ? mediaById.get(partner.media_asset)?.file_url ?? undefined
              : undefined,
          }));

        setPartners(mappedPartners);
      })
      .catch(error => console.error('Error fetching partners:', error));
  // refetch data every time the locale changes
  }, [isJapanese]);

  const partnerLinks = partners.filter(
    (partner): partner is PartnerRecord & { websiteUrl: string } =>
      ['partner', 'partners'].includes(partner.categoryEn.toLowerCase()) &&
      Boolean(partner.websiteUrl)
  );
  const donors = partners.filter(partner => ['donor', 'donors'].includes(partner.categoryEn.toLowerCase()));
  const sponsors = partners.filter(partner => ['sponsor', 'sponsors'].includes(partner.categoryEn.toLowerCase()));

  return (
    <main className="flex min-h-screen min-w-0 max-w-full flex-col items-center bg-[#fdfdfd] p-4 font-sans text-[#1a1a1a] sm:p-6 lg:p-10">
      {/* Mobile-first padding preserves readable gutters, while width constraints prevent child
          content from expanding the page beyond narrow viewports. */}
      {/* Staff-entered headings use a fixed 64px size, so this page scales them on narrow screens.
          Emergency wrapping also keeps long English and Japanese content inside the viewport. */}
      <section
        className="mx-auto w-full min-w-0 max-w-content px-4 py-8 [overflow-wrap:anywhere] sm:px-6 sm:py-10 [&_h2]:text-[clamp(2rem,10vw,4rem)]"
      >
        {contentBlocks.map((block) => (
          <ContentBlockRenderer
            key={block.content_id}
            block={block}
            locale={String(locale)}
          />
        ))}
        {!contentBlocks.length && <FallBack source="partners" />}
      </section>

      {/* Partner Links */}
      {/* Long partner names may contain few natural break points, so links can wrap without
          widening the section or causing horizontal page scrolling. */}
      <section className="w-full min-w-0 max-w-content border-b border-msscc-gray-light px-4 py-8 sm:px-6 sm:py-10">
        <h2 className="mb-4 break-words font-heading text-heading-2 text-[#dc2626]">
          Partner Links
        </h2>
        <p className="mb-4 break-words text-body leading-loose text-msscc-gray-dark">
          We are proud to celebrate our partner organizations and sponsors.
        </p>
        <ul className="list-disc space-y-2 break-words pl-6 leading-loose sm:pl-10">
          {partnerLinks.map((partner) => (
            <li key={partner.id}>
              <PartnerLink name={partner.name} href={partner.websiteUrl} />
            </li>
          ))}
        </ul>
      </section>

      {/* Donors and Sponsors */}
      {/* Keep acknowledgment copy separate from the responsive card groups below. */}
      <section className="w-full min-w-0 max-w-content px-4 py-6 sm:px-6">
        <h2 className="mb-4 break-words font-heading text-heading-2 text-[#dc2626]">
          Donor and Sponsor Acknowledgment
        </h2>
        <p className="mb-4 break-words text-body leading-loose text-msscc-gray-dark">
          We extend our sincerest thanks to the generous members, individuals, businesses, and organizations that support our success.
        </p>
      </section>

      {/* Stack groups until tablet width so neither card column is squeezed on mobile. */}
      <section className="flex w-full min-w-0 max-w-content flex-col gap-6 px-4 py-4 sm:px-6 md:flex-row">

        {/* Donors box */}
        <div className="w-full min-w-0 self-start rounded-lg border border-msscc-gray-light bg-msscc-gray-faint p-4 sm:p-6 md:flex-1">
          <h2 className="mb-4 break-words font-heading text-heading-2 text-[#dc2626]">
            Donors
          </h2>
          <div className="flex min-w-0 flex-col gap-3">
            {donors.map((donor) => (
              <PartnerCard
                key={donor.id}
                name={donor.name}
                imageUrl={donor.imageUrl}
                websiteUrl={donor.websiteUrl}
              />
            ))}
          </div>
        </div>

        {/* Sponsors box */}
        <div className="w-full min-w-0 self-start rounded-lg border border-msscc-gray-light bg-msscc-gray-faint p-4 sm:p-6 md:flex-1">
          <h2 className="mb-4 break-words font-heading text-heading-2 text-[#dc2626]">
            Sponsors
          </h2>
          <div className="flex min-w-0 flex-col gap-3">
            {sponsors.map((sponsor) => (
              <PartnerCard
                key={sponsor.id}
                name={sponsor.name}
                imageUrl={sponsor.imageUrl}
                websiteUrl={sponsor.websiteUrl}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
