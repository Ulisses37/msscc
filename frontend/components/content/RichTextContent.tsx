import React from 'react';

import { parseRichText } from '@/utils/richText';
import type { RichTextNode } from '@/utils/richText';

interface RichTextContentProps {
  value: string;
}

/**
 * Displays saved rich text with its Bold, Italic, and line break formatting.
 *
 * richText.ts first converts the saved text into safe, known pieces.
 * This component then turns those pieces into React elements that can
 * be displayed on the website.
 *
 * Used by ContentBlockRenderer.tsx for:
 * - Headers
 * - Subheaders
 * - Paragraphs
 * - Captions
 * - Image captions
 */

// Break the saved text into known formatting pieces, then display them.
export function RichTextContent({ value }: RichTextContentProps) {
  return <>{renderNodes(parseRichText(value))}</>;
}

/**
 * Turn each parsed text/formatting piece into something React can display.
 */
function renderNodes(nodes: RichTextNode[]): React.ReactNode[] {
  // Create the formatting ourselves instead of putting stored HTML directly into the page.
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;

    // Normal text does not need any formatting.
    if (node.type === 'text') return <React.Fragment key={key}>{node.value}</React.Fragment>;
    // Display saved line breaks.
    if (node.type === 'br') return <br key={key} />;
    // Display bold content.
    if (node.type === 'strong') return <strong key={key}>{renderNodes(node.children)}</strong>;

    // The only remaining supported type is italic.
    return <em key={key}>{renderNodes(node.children)}</em>;
  });
}
