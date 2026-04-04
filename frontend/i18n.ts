// Next.js
import { notFound } from 'next/navigation';
// Third-party
import { getRequestConfig } from 'next-intl/server';

//i18n Configuration.
const LOCALES = ['en', 'ja'] as const;
type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async ({ locale }) => {
  // Validation check ensures locale is a string and supported.
  // Show not found if an invalid language is given
  if (!locale || !LOCALES.includes(locale as Locale)) {
    notFound();
  }

  return {
    // Fetch the translations in either en.json or ja.json
    locale: locale as Locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
