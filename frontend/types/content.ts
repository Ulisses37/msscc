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
