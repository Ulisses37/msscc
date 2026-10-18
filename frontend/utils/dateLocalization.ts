export type PublicLocale = 'en' | 'ja';

/** Return the browser locale used for public English and Japanese date displays. */
export function getDateLocale(locale: string | string[] | undefined): string {
  return locale === 'ja' ? 'ja-JP' : 'en-US';
}

/** Format an ISO date using the active public-site locale. */
export function formatLocalizedDate(
  datetime: string,
  locale: string | string[] | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(getDateLocale(locale), options).format(new Date(datetime));
}