import { formatLocalizedDate, getDateLocale } from '@/utils/dateLocalization';

describe('public date localization', () => {
  it('maps supported route locales to browser date locales', () => {
    expect(getDateLocale('en')).toBe('en-US');
    expect(getDateLocale('ja')).toBe('ja-JP');
  });

  it('falls back to English for an unavailable route locale', () => {
    expect(getDateLocale(undefined)).toBe('en-US');
    expect(getDateLocale('fr')).toBe('en-US');
  });

  it('formats the same event date for English and Japanese displays', () => {
    const datetime = '2026-10-17T12:00:00';
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    expect(formatLocalizedDate(datetime, 'en', options)).toBe('October 17, 2026');
    expect(formatLocalizedDate(datetime, 'ja', options)).toBe('2026年10月17日');
  });
});