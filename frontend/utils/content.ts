import type { DbContentBlock } from '@/types/content';

interface PageContentResponse {
  content: DbContentBlock[];
}

/**
 * Fetch content from the database associated with the passed page slug.
 */

export async function fetchPageContent(
  pageSlug: string,
): Promise<DbContentBlock[]> {
  const response = await fetch(
    `http://127.0.0.1:8000/api/page/get-by-slug/${pageSlug}/`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch page content: ${response.status}`);
  }

  const data: PageContentResponse = await response.json();

  return data.content;
}
