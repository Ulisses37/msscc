'use client';

// React Next.js
import React from 'react';

// Third-Party
import { useTranslations } from 'next-intl';

// Project utilities/hooks
import { Link, usePathname } from '@/i18n/routing';

/**
 * This exports the general view's public navbar to navigate to pages like home, events, etc.
 *
 */

export const PublicNavbar = () => {
  const t = useTranslations('Navbar');
  const pathname = usePathname();

  // Define our navigation links
  const navLinks = [
    { name: t('home'), href: '/' },
    { name: t('events'), href: '/events' },
    { name: t('support'), href: '/support' },
    { name: t('membership'), href: '/membership' },
    { name: t('about'), href: '/about' },
    { name: t('partners'), href: '/partners' },
  ] as const;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-center space-x-8 px-4">
        {navLinks.map((link) => {
          // Check if the current path matches the link to highlight it
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              // Highlight code
              className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                isActive
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                  : 'text-gray-600'
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
