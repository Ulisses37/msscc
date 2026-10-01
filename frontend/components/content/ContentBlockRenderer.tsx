import type { DbContentBlock, ImageWidth } from '@/types/content';

const IMAGE_ALIGNMENT_CLASSES = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

const IMAGE_WIDTH_CLASSES: Record<ImageWidth, string> = {
  25: 'w-1/4',
  50: 'w-1/2',
  75: 'w-3/4',
  100: 'w-full',
};

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

        case 'subheader':
        return (
          <h4 className="font-heading text-[18px] font-bold text-msscc-gray-dark">
            {content}
          </h4>
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

      case 'image':
        const alignmentClass = IMAGE_ALIGNMENT_CLASSES[block.image_alignment] ?? 'text-left';
        const widthClass = IMAGE_WIDTH_CLASSES[block.image_width] ?? 'w-full';

        // Align the figure so the image and its caption move together.
        return (
          <figure className={alignmentClass}>
            {/* Apply width to the image without constraining its caption. */}
            {block.media_url && (
              <img
                src={block.media_url}
                alt={content}
                className={`inline-block h-auto max-w-full ${widthClass}`}
              />
            )}

            {content && (
              <figcaption className="font-body text-caption text-msscc-gray-mid">
                {content}
              </figcaption>
            )}
          </figure>
        );

      default:
        return null;
    }
}
