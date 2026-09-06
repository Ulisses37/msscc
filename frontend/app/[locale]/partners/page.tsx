'use client';

// React and Next Imports
import React, { useEffect, useState }from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';  // To be used if partner objects have links to their websites or profiles


// Components
import { ContentBlockRenderer } from '@/components/content/ContentBlockRenderer';
import { PartnerCard } from './PartnerCard';


// Types
import type { DbContentBlock } from '@/types/content';

// Utils Imports
import { fetchPageContent } from '@/utils/content';

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
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="partner-link"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: 'var(--font-body)',
        color: hovered ? 'var(--color-teal)' : 'var(--color-gray-dark)',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
        cursor: 'pointer',
        transition: 'color 0.15s ease',
      }}
    >
      {name}
    </Link>
  );
}

export default function PartnersPage() {
  const [contentBlocks, setContentBlocks] = useState<DbContentBlock[]>([]);
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const params = useParams();
  const locale = params?.locale;
  const isJapanese = locale === 'ja';

  // Fetch text content from the database to display on page
  useEffect(() => {
    const loadPageContent = async () => {
      try {
        const data = await fetchPageContent('partners');
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
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans flex flex-col items-center">
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

      {/* Partner Links */}
      <section style={{
        padding: 'var(--space-10) var(--space-6)',
        maxWidth: '75rem',
        width: '100%',
        borderBottom: '0.5px solid var(--color-gray-light)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: '#dc2626',
          fontSize: 'var(--fs-heading-2)',
          marginBottom: 'var(--space-4)',
        }}>
          Partner Links
        </h2>
        <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-gray-dark)' }}>
          We are proud to celebrate our partner organizations and sponsors.
        </p>
        <ul style={{ listStyle: 'disc', paddingLeft: 'var(--space-10)', lineHeight: 1.7 }}>
          {partnerLinks.map((partner) => (
            <li key={partner.id} style={{ marginBottom: 'var(--space-2)' }}>
              <PartnerLink name={partner.name} href={partner.websiteUrl} />
            </li>
          ))}
        </ul>
      </section>

      {/* Donors and Sponsors */}
      {/* Section Header and description */}
      <section style={{
        padding: 'var(--space-6) var(--space-6)',
        maxWidth: '75rem',
        width: '100%',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: '#dc2626',
          fontSize: 'var(--fs-heading-2)',
          marginBottom: 'var(--space-4)',
        }}>
          Donor and Sponsor Acknowledgment
        </h2>
        <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-gray-dark)' }}>
          We extend our sincerest thanks to the generous members, individuals, businesses, and organizations that support our success.
        </p>
      </section>

      {/* Donors and Sponsors side by side */}
      <section style={{
        padding: 'var(--space-4) var(--space-6)',
        maxWidth: '75rem',
        width: '100%',
        display: 'flex',
        gap: 'var(--space-6)',
      }}>

        {/* Donors box */}
        <div style={{
          flex: 1,
          alignSelf: 'flex-start',
          border: '0.5px solid var(--color-gray-light)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-gray-faint)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            color: '#dc2626',
            fontSize: 'var(--fs-heading-2)',
            marginBottom: 'var(--space-4)',
          }}>
            Donors
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>
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
        <div style={{
          flex: 1,
          alignSelf: 'flex-start',
          border: '0.5px solid var(--color-gray-light)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--color-gray-faint)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            color: '#dc2626',
            fontSize: 'var(--fs-heading-2)',
            marginBottom: 'var(--space-4)',
          }}>
            Sponsors
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>
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
