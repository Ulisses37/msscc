'use client';

import React from 'react';
import Link from 'next/link';  // To be used if partner objects have links to their websites or profiles

interface Partner {
  id: number;
  name: string;
  description: string;
  image?: string;
  category: string;
  link?: string;
}

// Sample data - Replace with your actual data
// Sample code - to be replaced with actual code
// Partner layout can be adjusted as connecting a partner object array from database into page

const PARTNERS_DATA: Partner[] = [
  {
    id: 1,
    name: 'Partner One',
    description: 'Leading organization in their field with a commitment to excellence.',
    category: 'Technology',
    image: '/images/partner1.jpg',
    link: '#',
  },
  {
    id: 2,
    name: 'Partner Two',
    description: 'Dedicated to innovation and sustainable practices.',
    category: 'Innovation',
    image: '/images/partner2.jpg',
    link: '#',
  },
  {
    id: 3,
    name: 'Partner Three',
    description: 'Global leader in providing quality services and solutions.',
    category: 'Services',
    image: '/images/partner3.jpg',
    link: '#',
  },
  {
    id: 4,
    name: 'Partner Four',
    description: 'Committed to supporting community initiatives and growth.',
    category: 'Community',
    image: '/images/partner4.jpg',
    link: '#',
  },
];


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



    </main>
  );
}
