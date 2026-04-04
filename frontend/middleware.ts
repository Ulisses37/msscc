// Next.js / next-intl
import createMiddleware from 'next-intl/middleware';

/**
 * i18n Middleware Configuration.
 * Handles automatic redirection and locale detection for English and Japanese.
 * Follows MSSCC Style Guide: 2-space indent, single quotes, required semicolons.
 */
export default createMiddleware({
  // A list of all locales that are supported. en = English and ja = Japanese.
  locales: ['en', 'ja'],

  // Sets the default locale to English.
  defaultLocale: 'en',
});

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(ja|en)/:path*'],
};
