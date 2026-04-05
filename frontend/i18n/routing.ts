// Third-party libraries
import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // The supported languages of the website. en = English and ja = Japanese
  locales: ['en', 'ja'],

  // Set English as default to guarantee a link appears properly
  defaultLocale: 'en',

  // Define the pathnames so the website knows where to navigate to
  pathnames: {
    '/': '/',

    // Navbar Links
    '/about': '/about',
    '/events': '/events',
    '/donate': '/donate',
    '/membership': '/membership',
    '/partners': '/partners',
    '/volunteer': '/volunteer',

    // In case other pages are created, create the pathnames below this comment
  },
});

/**
 * An export to help create routings for the general view pages
 * Contains a list ofpathnames and also keeps /en or /ja in mind when creating links
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
