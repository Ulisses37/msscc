/**
 * Defines the type of text blocks created in the Page Edit page
 */
export type BlockType = 'header' | 'paragraph' | 'caption';

/**
 * Defines the data structure of a text block created in the Page Edit page
 */
export interface ContentBlock{
  id: string;
  type: BlockType;
  contentEn: string;
  contentJa: string;
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
}
