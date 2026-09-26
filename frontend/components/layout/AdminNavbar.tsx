'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavLinks } from '@/config/adminNavLinks';

export const AdminNavbar = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Collapse the mobile menu after a navigation so the next page is not obscured.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const isLinkActive = (href: string) =>
    href === '/admin/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="w-full bg-msscc-pink" aria-label="Admin navigation">
      {/* Phones and tablets use a toggle plus a vertically scrollable link list. */}
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-controls="admin-mobile-menu"
          onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark"
        >
          <span>Admin menu</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            {isMenuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>

        {isMenuOpen && (
          <div id="admin-mobile-menu" className="max-h-[70vh] overflow-y-auto border-t border-white/20">
            {adminNavLinks.map((link) => {
              const isActive = isLinkActive(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block border-b border-white/15 px-4 py-3 text-nav-admin !text-white transition-colors last:border-b-0 hover:bg-msscc-pink-dark ${
                    isActive ? 'bg-msscc-pink-dark font-bold' : 'opacity-80'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* The full navigation replaces the toggle when the viewport reaches `lg`. */}
      <div className="container mx-auto hidden flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-3 lg:flex">
        {adminNavLinks.map((link) => {
          const isActive = isLinkActive(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative text-nav-admin font-medium !text-white transition-opacity hover:opacity-100 ${
                isActive ? 'opacity-100' : 'opacity-70'
              }`}
            >
              {link.label}
              {isActive && (
                <span className="absolute -bottom-1 left-0 w-full border-b-2 border-white" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
