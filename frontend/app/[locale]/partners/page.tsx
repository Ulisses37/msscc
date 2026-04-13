'use client';

import React, { useState }from 'react';
import Link from 'next/link';  // To be used if partner objects have links to their websites or profiles
import { samplePartnerLinks, sampleDonors, sampleSponsors } from './sampleData';
import { PartnerCard } from './PartnerCard';

interface PartnerLinkProps {
  name: string;
  href: string;
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
  return (
    <main className="min-h-screen bg-[#fdfdfd] text-[#1a1a1a] p-10 font-sans flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-[1200px] text-center mb-16 pb-8 border-b border-[#1a1a1a]">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-[#264653]">
          Partner Page
        </h1>
      </header>

      {/* Connecting with the Community */}
      <section style={{
        padding: 'var(--space-6) var(--space-6)',
        maxWidth: '75rem',
        width: '100%',
        margin: '0 auto',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: '#dc2626',
          fontSize: 'var(--fs-heading-2)',
          marginBottom: 'var(--space-4)',
        }}>
          Connecting with the Community
        </h2>
        <p style={{
          fontSize: 'var(--fs-body)',
          color: 'var(--color-gray-dark)',
          maxWidth: '56.25rem',
          lineHeight: 1.7,
        }}>
          Partners are the foundation of the Matsuyama-Sacramento Sister City Corporation, helping to
          strengthen cultural connections and educational exchanges between our communities. Their support
          ensures that we continue fostering mutual understanding, global citizenship, and meaningful
          opportunities for individuals to engage with and represent our region abroad.
        </p>
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
          {samplePartnerLinks.map((partner) => (
            <li key={partner.name} style={{ marginBottom: 'var(--space-2)' }}>
              <PartnerLink name={partner.name} href={partner.href} />

              {/* If this partner has a pair, render it separated by "and" */}
              {partner.pair && (
                <>
                  <span style={{
                    color: 'var(--color-gray-dark)',
                    fontFamily: 'var(--font-body)',
                    margin: '0 var(--space-2)'}}
                    >and</span>
                  <PartnerLink name={partner.name} href={partner.href} />
                </>
              )}
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
            {sampleDonors.map((donor) => (
              <PartnerCard
                key={donor.name}
                name={donor.name}
                imageUrl={donor.imageUrl}
                description={donor.description}
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
            {sampleSponsors.map((sponsor) => (
              <PartnerCard
                key={sponsor.name}
                name={sponsor.name}
                imageUrl={sponsor.imageUrl}
                description={sponsor.description}
                websiteUrl={sponsor.websiteUrl}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
