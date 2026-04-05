// Third-party
import { useTranslations } from 'next-intl';

/**
 * Custom hook for accessing translations.
 * * @param namespace - The top-level key in the JSON files (e.g., 'Navbar')
 */
export function useTranslation(namespace?: string) {
  return useTranslations(namespace);
}
