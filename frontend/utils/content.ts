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
    `${process.env.NEXT_PUBLIC_API_URL}/api/page/get-by-slug/${pageSlug}/`,
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
