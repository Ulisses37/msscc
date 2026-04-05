import createMiddleware from 'next-intl/middleware';

/**
 * i18n Middleware Configuration.
 * Handles automatic redirection and locale detection for English and Japanese.
 */
export default createMiddleware({
  // A list of all locales that are supported. en = English and ja = Japanese
  locales: ['en', 'ja'],

  // Used when no locale matches
  defaultLocale: 'en',
});

export const config = {
  // Match only internationalized pathnames
  matcher: ['/', '/(ja|en)/:path*'],
};
