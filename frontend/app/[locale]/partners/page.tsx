'use client';

import React from 'react';
import Link from 'next/link';  // To be used if partner objects have links to their websites or profiles
import { samplePartnerLinks } from './sampleData';

// Shared link styles from global style guide
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
          {samplePartnerLinks.map((partner) => (
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
