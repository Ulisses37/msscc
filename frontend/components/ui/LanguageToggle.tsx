'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';

/**
 * LanguageToggle Component
 * * Provides a UI switcher between English (en) and Japanese (ja).
 * Uses a split-button design to highlight the currently active locale.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  /**
   * Updates the URL to the selected language.
   * @param nextLocale - The language code to switch to ('en' | 'ja').
   */
  const switchLanguage = (nextLocale: 'en' | 'ja') => {
    // End function if nextLocale is the same as the currently active locale.
    if (nextLocale === locale) return;

    router.replace(pathname, { locale: nextLocale });
  };

  // Shared button styles for consistency
  const baseBtnStyle = "whitespace-nowrap px-2 py-1 text-[0.6875rem] font-medium transition-colors focus:outline-none sm:px-3 sm:text-sm";
  const activeStyle = "bg-[#264653] text-white";
  const inactiveStyle = "bg-white text-[#264653] hover:bg-teal-50";

  return (
    <nav
      className="flex items-center overflow-hidden rounded border border-[#264653]"
      aria-label="Language selection"
    >
      {/* English Option */}
      <button
        onClick={() => switchLanguage('en')}
        className={`${baseBtnStyle} ${locale === 'en' ? activeStyle : inactiveStyle}`}
        aria-pressed={locale === 'en'}
        aria-label="Switch to English"
      >
        ENG
      </button>

      {/* Vertical Divider */}
      <div className="h-4 w-[1px] bg-[#264653] opacity-30" aria-hidden="true" />

      {/* Japanese Option */}
      <button
        onClick={() => switchLanguage('ja')}
        className={`${baseBtnStyle} ${locale === 'ja' ? activeStyle : inactiveStyle}`}
        aria-pressed={locale === 'ja'}
        aria-label="日本語に切り替え"
      >
        日本語
      </button>
    </nav>
  );
}
