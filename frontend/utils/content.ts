import type { DbContentBlock } from '@/types/content';

interface PageContentResponse {
  content: DbContentBlock[];
}

// Content Cache that maps each page slug to their content blocks
const pageContentCache = new Map<string, DbContentBlock[]>();

/**
 * Fetch content from the database associated with the passed page slug.
 */

export async function fetchPageContent(
  pageSlug: string,
): Promise<DbContentBlock[]> {
  const cachedContent = pageContentCache.get(pageSlug);

  // End the function immediately if cached content already exists
  if (cachedContent) {
    return cachedContent;
  }

  // Proceed to fetch data from the database if there is no cached content
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/page/get-by-slug/${pageSlug}/`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch page content: ${response.status}`);
  }

  const data: PageContentResponse = await response.json();

  // After fetching is done, set the fetched content into the cache
  pageContentCache.set(pageSlug, data.content);

  return data.content;
}

/**
 * Return any cached content associated with a page slug
 */

export function getCachedPageContent(
  pageSlug: string,
): DbContentBlock[] {
  return pageContentCache.get(pageSlug) ?? [];
}
