'use client';

// React Next.js
import React, { useEffect, useState } from 'react';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Define our navigation links
  const navLinks = [
    { name: t('home'), href: '/' },
    { name: t('events'), href: '/events' },
    { name: t('support'), href: '/support' },
    { name: t('membership'), href: '/membership' },
    { name: t('about'), href: '/about' },
    { name: t('partners'), href: '/partners' },
  ] as const;

  const isLinkActive = (href: string) =>
    href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-msscc-teal shadow-sm" aria-label={t('menu')}>
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="public-mobile-menu"
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-btn tracking-btn text-white transition-colors hover:bg-msscc-teal-dark"
        >
          <span>{t('menu')}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            {isMenuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        {isMenuOpen && (
          <div id="public-mobile-menu" className="max-h-[70vh] overflow-y-auto border-t border-white/20">
            {navLinks.map((link) => {
              const isActive = isLinkActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block border-b border-white/15 px-4 py-3 text-nav !text-white transition-colors last:border-b-0 hover:bg-msscc-teal-dark ${
                    isActive ? 'bg-msscc-teal-dark font-bold' : 'opacity-80'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="container mx-auto hidden flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-3 lg:flex">
        {navLinks.map((link) => {
          // Check if the current path matches the link to highlight it
          const isActive = isLinkActive(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              // Highlight code
              className={`text-sm font-medium transition-colors ${
                isActive
                  ? '!text-white border-b-2 border-white pb-1'
                  : '!text-white/70 hover:text-white'
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
