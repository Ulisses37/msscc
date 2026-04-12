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
//

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
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Our Partners</h1>
          <p className="text-lg text-blue-100 max-w-2xl">
            Collaborating with leading organizations to create meaningful impact
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Introduction Section */}
        <section className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Strategic Partnerships</h2>
          <p className="text-gray-600 max-w-3xl mx-auto text-lg">
            We work with dedicated partners who share our vision and values. Together, we advance
            our mission and create positive change in our community.
          </p>
        </section>

        {/* Partners Grid */}
        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PARTNERS_DATA.map((partner) => (
              <div
                key={partner.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
              >
                {/* Partner Image Placeholder */}
                <div className="w-full h-40 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  {partner.image ? (
                    <img
                      src={partner.image}
                      alt={partner.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 text-4xl font-bold">{partner.name[0]}</div>
                  )}
                </div>

                {/* Partner Content */}
                <div className="p-6">
                  <div className="mb-2">
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                      {partner.category}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{partner.name}</h3>
                  <p className="text-gray-600 text-sm mb-4">{partner.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="bg-blue-50 rounded-lg p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            Interested in Partnership?
          </h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            We're always looking for organizations that share our values and vision. Get in touch
            with us to explore collaboration opportunities.
          </p>
          <button className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Contact Us
          </button>
        </section>
      </main>

      {/* Footer Section */}
      <footer className="bg-gray-900 text-gray-300 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>&copy; 2026 MSSCC. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
