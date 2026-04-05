'use client';

// React Next.js
import React from 'react';

// Third-Party
import { useTranslations } from 'next-intl';

// Project utilities/hooks
import { Link } from '@/i18n/routing';

export const PublicNavbar = () => {
  const t = useTranslations('Navbar');

  // Define our navigation links
  const navLinks = [
    { name: t('home'), href: '/' },
    { name: t('events'), href: '/events' },
    { name: t('donate'), href: '/donate' },
    { name: t('membership'), href: '/membership' },
    { name: t('about'), href: '/about' },
    { name: t('partners'), href: '/partners' },
    { name: t('volunteer'), href: '/volunteer' },
  ] as const;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-center space-x-8 px-4">
        {navLinks.map((link) => {

          return (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
            >
              {link.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
