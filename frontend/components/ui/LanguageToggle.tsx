'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';

/**
 * LanguageToggle Component
 * * Provides a UI switcher between English (en) and Japanese (ja).
 * Uses a split-button design to highlight the currently active locale.
 */
export function LanguageToggle() {
  const locale = useLocale();
  const pathname = usePathname();

  /**
   * Updates the URL to the selected language.
   * @param nextLocale - The language code to switch to ('en' | 'ja').
   */
  const switchLanguage = (nextLocale: string) => {
    // Optimization: Skip navigation if the selected language is already active.
    if (nextLocale === locale) return;

    // Pathname manipulation:
    // next-intl patterns usually follow: /locale/path/to/page
    // .split('/') results in ["", "locale", "path", ...]
    const segments = pathname.split('/');
    segments[1] = nextLocale;

    const newPath = segments.join('/') || '/';

    // Force a hard refresh to re-run i18n/request.ts on the server
    window.location.href = newPath;
  };

  // Shared button styles for consistency
  const baseBtnStyle = "px-3 py-1 transition-colors text-xs sm:text-sm font-medium focus:outline-none";
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
