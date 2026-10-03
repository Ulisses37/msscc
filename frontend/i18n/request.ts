import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

/**
 * Supported locales for the website.
 * 'en' - English
 * 'ja' - Japanese
 */
const LOCALES = ['en', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

/**
 * Check whether a requested locale is supported by the website.
 */
function isLocale(locale: string | undefined): locale is Locale {
  return locale !== undefined && LOCALES.includes(locale as Locale);
}

/**
 * i18n Request Configuration (next-intl v4.x)
 * This function is called on every server-side request to provide
 * the correct translation messages to Server Components.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // In next-intl v4, the locale is provided as a promise that must be awaited.
  const locale = await requestLocale;

  // Validation: If the language in the URL is not supported,
  // we trigger a 404 to prevent the app from rendering in an unknown state.
  if (!isLocale(locale)) {
    notFound();
  }

  try {
    // Dynamic import of the translation JSON files.
    const messages = (await import(`../messages/${locale}.json`)).default;

    return {
      locale,
      messages,
    };
  } catch (error) {
    // Fallback: If a JSON file is missing or corrupted,
    // log the error and trigger a 404.
    console.error(`[i18n/request.ts] Failed to load messages for: ${locale}`, error);
    notFound();
  }
});
