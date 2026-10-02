/**
 * Shared helper functions for handling bold and italic text.
 *
 * This file acts as the middleman for our rich-text system. It makes sure
 * only the formatting we support is kept, converts formatting into a
 * consistent format, removes formatting when plain text is needed, and
 * prepares formatted text so React can safely display it.
 *
 * Used by:
 * - RichTextInput.tsx to clean and standardize text from the editor.
 * - RichContent.tsx to prepare saved text for display.
 * - BilingualInput.tsx to get plain text when checking translation content.
 * - ContentBlockRenderer.tsx to get plain text for image alt text.
 * - The DeepL translation route to preserve only supported formatting
 *   before and after translation.
 */

/**
 * Represents the pieces of formatted text that our app knows how to display.
 *
 * - text: normal text
 * - strong: bold text
 * - em: italic text
 * - br: a line break
 */
export type RichTextNode =
  | { type: 'text'; value: string }
  | { type: 'strong' | 'em'; children: RichTextNode[] }
  | { type: 'br' };

// Finds HTML-like tags so we can check and clean them before rendering.
const RICH_TEXT_TAG_PATTERN = /<\/?[a-z][^>]*>/gi;
// Only allow the small set of tags our editor supports.
const ALLOWED_TAG_PATTERN = /^<\s*(\/?)\s*(strong|b|em|i|br)\s*\/?\s*>$/i;

/**
 * Cleans formatted text so the app only keeps the tags we support.
 *
 * Bold and italic can be written using either:
 * - <strong> or <b> for bold
 * - <em> or <i> for italic
 *
 * These are converted into our standard <strong> and <em> forms.
 * Any other HTML tags or attributes are removed.
 */
export function sanitizeRichText(value: string): string {
  return value.replace(RICH_TEXT_TAG_PATTERN, (tag) => {
    const match = tag.match(ALLOWED_TAG_PATTERN);

    if (!match) return ''; // Remove any tag that isn't supported by our editor.

    const isClosing = match[1] === '/';
    const rawTagName = match[2].toLowerCase();
    // Store bold and italic using one consistent tag name.
    const tagName = rawTagName === 'b' ? 'strong' : rawTagName === 'i' ? 'em' : rawTagName;

    if (tagName === 'br') return '<br>';

    return isClosing ? `</${tagName}>` : `<${tagName}>`;
  });
}

/**
 * Removes formatting and returns only the readable text.
 *
 * This is useful when another part of the app needs plain text,
 * such as checking whether text exists or creating image alt text.
 */
export function getRichTextPlainText(value: string): string {
  return decodeHtmlEntities(sanitizeRichText(value).replace(/<br>/gi, '\n').replace(/<[^>]+>/g, ''));
}

/**
 * Break formatted text into pieces that React can render safely.
 *
 * For example:
 * "Hello <strong>world</strong>"
 *
 * becomes:
 * normal text → bold text
 *
 * We use React elements instead of rendering raw HTML directly.
 */
export function parseRichText(value: string): RichTextNode[] {
  const tokens = sanitizeRichText(value).split(/(<\/?(?:strong|em)>|<br>)/gi);
  const root: RichTextNode[] = [];

  // Keeps track of which formatting tag is currently open.
  // This lets us handle things like italic text containing bold text.
  const stack: Array<{ type: 'strong' | 'em'; children: RichTextNode[] }> = [];

  // Decide where the next piece of text should be placed.
  // If a formatting tag is open, add it inside that tag.
  const currentChildren = (): RichTextNode[] =>
    stack.length > 0 ? stack[stack.length - 1].children : root;

  tokens.forEach((token) => {
    if (!token) return;

    const normalizedToken = token.toLowerCase();

    if (normalizedToken === '<br>') {
      currentChildren().push({ type: 'br' });
      return;
    }

    if (normalizedToken === '<strong>' || normalizedToken === '<em>') {
      const node: { type: 'strong' | 'em'; children: RichTextNode[] } = {
        type: normalizedToken === '<strong>' ? 'strong' : 'em',
        children: [],
      };
      currentChildren().push(node);
      stack.push(node);
      return;
    }

    if (normalizedToken === '</strong>' || normalizedToken === '</em>') {
      const closingType = normalizedToken === '</strong>' ? 'strong' : 'em';

      if (stack[stack.length - 1]?.type === closingType) stack.pop();
      return;
    }

    currentChildren().push({ type: 'text', value: decodeHtmlEntities(token) });
  });

  return root;
}

/**
 * Converts HTML-escaped characters back into normal text.
 *
 * For example:
 * &amp; → &
 * &lt;  → <
 * &gt;  → >
 */
function decodeHtmlEntities(value: string): string {
  // Decode text only after we've finished checking which HTML tags are allowed.
  return value.replace(
    /&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, code: string) => {
      const normalizedCode = code.toLowerCase();

      if (normalizedCode.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(normalizedCode.slice(2), 16));
      }

      if (normalizedCode.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(normalizedCode.slice(1), 10));
      }

      const namedEntities: Record<string, string> = {
        amp: '&',
        apos: "'",
        gt: '>',
        lt: '<',
        nbsp: '\u00a0',
        quot: '"',
      };

      return namedEntities[normalizedCode] ?? entity;
    },
  );
}
