'use client';

import React from 'react';
import Link from 'next/link';  // To be used if partner objects have links to their websites or profiles

// interface Partner {
//   id: number;
//   name: string;
//   description: string;
//   image?: string;
//   category: string;
//   link?: string;
// }

// Sample data - Replace with your actual data
// Sample code - to be replaced with actual code
// Partner layout can be adjusted as connecting a partner object array from database into page

// External Partner Links
const PARTNER_LINKS: { name: string; href: string; pair?: { name: string; href: string } }[] = [
  { name: 'City of Sacramento',                           href: 'https://www.cityofsacramento.gov/mayor-council'                                },
  { name: 'Consulate-General of Japan, San Francisco',    href: 'https://www.sf.us.emb-japan.go.jp/itprtop_en/index.html'                      },
  { name: 'Japanese American Citizens League Sacramento', href: 'https://www.facebook.com/sacjacl/'                                            },
  { name: 'California-Japan Sister Cities Network',       href: 'https://www.caljapansistercities.org'                                         },
  { name: 'Matsuyama International Center (MIC)',         href: 'https://www.mic.ehime.jp/MIC/Foreigner/Matsuyama%20International%20Center.html'},
  { name: 'Sacramento Camellia Society',                  href: 'https://camelliasocietyofsacramento.org'                                      },
  { name: 'Sacramento Boy Scout Troop 50B',               href: 'https://www.buddhistchurch.org/organizations'                                 },
  { name: 'Sacramento Buddhist Church',                   href: 'https://www.buddhistchurch.org'                                               },
  { name: 'Orchard Elementary School',                    href: 'https://orchard.trusd.net',
    pair: { name: 'Matsuyama Elementary School',          href: 'https://matsuyama.scusd.edu' }                                                },
  { name: 'C.K. McClatchy High School',                   href: 'https://ckm.scusd.edu',
    pair: { name: 'Rosemont High School',                 href: 'https://rosemont.scusd.edu' }                                                 },
  { name: 'Sacramento Tree Foundation',                   href: 'https://sactree.org',
    pair: { name: 'Hanami Line',                          href: 'https://sactree.org/hanami/' }                                                },
];

// ── Shared link styles from global style guide ───────────────────────────────
const externalLinkStyle: React.CSSProperties = {
  color: 'var(--color-gray-dark)',
  textDecoration: 'none',
  transition: 'color 0.15s ease, opacity 0.15s ease',
  fontFamily: 'var(--font-body)',
};

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
        padding: 'var(--space-10) var(--space-6)',
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
          {PARTNER_LINKS.map((partner) => (
            <li key={partner.name} style={{ marginBottom: 'var(--space-2)' }}>
              <Link
                href={partner.href}
                target="_blank"
                rel="noopener noreferrer"
                style={externalLinkStyle}
              >
                {partner.name}
              </Link>

              {/* If this partner has a pair, render it separated by "and" */}
              {partner.pair && (
                <>
                  <span style={{
                    color: 'var(--color-gray-dark)',
                    fontFamily: 'var(--font-body)',
                    margin: '0 var(--space-2)'}}
                    >and</span>
                  <Link
                    href={partner.pair.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={externalLinkStyle}
                  >
                    {partner.pair.name}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

    </main>
  );
}
