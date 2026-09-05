import type { DbContentBlock } from '@/types/content';

interface ContentBlockRendererProps {
  block: DbContentBlock;
  locale: string;
}

/**
 * Placed on each main public page.
 * Needed to render text creation from the Page Edit page onto the public pages.
 */

export function ContentBlockRenderer({
  block,
  locale,
}: ContentBlockRendererProps) {
    // Determine the currently active language
    const content = locale === 'ja'
    ? block.content_ja
    : block.content_en;

    // Format the text based on their BlockType
    switch (block.content_type) {
      case 'header':
        return (
          <h2 className="font-heading text-[64px] font-normal text-[#D72638]">
            {content}
          </h2>
        );

      case 'paragraph':
        return (
          <p className="whitespace-pre-line font-heading text-[18px] font-normal text-[#000000]">
            {content}
          </p>
        );

      case 'caption':
        return (
          <p className="font-body text-caption text-msscc-gray-mid">
            {content}
          </p>
        );

      default:
        return null;
    }
}
