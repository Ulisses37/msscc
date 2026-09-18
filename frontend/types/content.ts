/**
 * Defines the type of text blocks created in the Page Edit page
 */
export type BlockType = 'header' | 'subheader' | 'paragraph' | 'caption' | 'image';

/**
 * Defines the data structure of a text block created in the Page Edit page
 */
export interface ContentBlock{
  id: string;
  type: BlockType;
  contentEn: string;
  contentJa: string;

  // For image blocks
  mediaAssetId?: number | null; // ID of image in backend
  mediaUrl?: string | null; // Used to preview/display image
  file?: File | null; // Used to display image locally if not yet saved to backend yet
}

/**
 * Defines the structure the data received from the backend will become
 */
export interface DbContentBlock {
  content_id: number;
  page_id: number;
  display_order: number;
  content_type: BlockType;
  content_en: string;
  content_ja: string;

  // For image blocks
  media_asset: number | null;
  media_url: string | null;
}
