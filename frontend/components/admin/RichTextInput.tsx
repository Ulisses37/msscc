'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import { sanitizeRichText } from '@/utils/richText';

interface RichTextInputProps {
  label: string;
  value: string;
  onUpdate: (value: string) => void;
  language: 'en' | 'ja';
  headerAction?: React.ReactNode;
}

// Tracks whether the current cursor/selection is bold or italic.
interface FormatState {
  bold: boolean;
  italic: boolean;
}

/**
 * Reusable text editor with Bold and Italic formatting.
 *
 * This replaces the normal text input used by the page editor with a
 * contentEditable field and a small formatting toolbar.
 *
 * Main responsibilities:
 * - Let the user type and select text.
 * - Apply Bold or Italic to the selected text.
 * - Keep the cursor/selection in place when a toolbar button is clicked.
 * - Convert the browser's generated HTML into the format used by our app.
 *
 * Used by:
 * - BilingualInput.tsx for normal text content.
 * - ImageBlockInput.tsx for image captions.
 * - richText.ts for cleaning and parsing the formatted text.
 */
export function RichTextInput({
  label,
  value,
  onUpdate,
  language,
  headerAction,
}: RichTextInputProps) {
  const labelId = useId();
  const editorRef = useRef<HTMLDivElement>(null);
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
  });

// Update the editor when the parent gives us new content.
// Only replace the editor's HTML when it actually changed,
// otherwise the cursor would jump while the user types.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const sanitizedValue = sanitizeRichText(value);
    const sanitizedEditorValue = serializeEditorContent(editor);

    if (sanitizedEditorValue !== sanitizedValue) editor.innerHTML = sanitizedValue;
  }, [value]);

  /**
 * Update the Bold and Italic buttons to match the current cursor/selection.
 */
  const updateFormatState = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    // Reset the toolbar if the cursor is outside this editor.
    if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) {
      setFormatState({ bold: false, italic: false });
      return;
    }

    // Ask the browser whether the current text is bold or italic.
    setFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
    });
  }, []);

  // Check the toolbar whenever the user's cursor or text selection changes.
  useEffect(() => {
    document.addEventListener('selectionchange', updateFormatState);
    return () => document.removeEventListener('selectionchange', updateFormatState);
  }, [updateFormatState]);

  /**
   * Convert the editor contents into our stored format and send it to the parent.
   */
  const emitValue = () => {
    const editor = editorRef.current;
    if (!editor) return;

    onUpdate(serializeEditorContent(editor));
  };

  /**
   * Apply Bold or Italic to the current text selection.
   */
  const applyFormat = (command: 'bold' | 'italic') => {
    // Put the cursor back in the editor before applying the format.
    editorRef.current?.focus();
    // Ask the browser to apply the selected formatting.
    document.execCommand(command, false);
    // Save the newly formatted content and update the toolbar.
    emitValue();
    updateFormatState();
  };

  /**
   * Paste only plain text so outside websites cannot insert unwanted
   * formatting, links, or other HTML into the editor.
   */
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    // Import text only so copied websites cannot add styles, links, or unsafe markup.
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    emitValue();
  };

  return (
    <div>
      <div className="mb-2 flex min-h-9 items-end justify-between gap-2">
        <label
          id={labelId}
          className="block text-label uppercase text-msscc-gray-mid"
        >
          {label}
        </label>
        {headerAction}
      </div>
      <div className="overflow-hidden rounded-md border border-msscc-gray-light bg-white focus-within:ring-focus-admin">
        <div className="flex gap-1 border-b border-msscc-gray-light bg-msscc-gray-light/20 p-2">
          <FormatButton
            label="Bold"
            isActive={formatState.bold}
            onMouseDown={(event) => {
              event.preventDefault();
              applyFormat('bold');
            }}
          >
            <strong aria-hidden="true">B</strong>
          </FormatButton>
          <FormatButton
            label="Italic"
            isActive={formatState.italic}
            onMouseDown={(event) => {
              event.preventDefault();
              applyFormat('italic');
            }}
          >
            <em aria-hidden="true">I</em>
          </FormatButton>
        </div>

        {/* Editable area that supports formatted text. */}
        <div
          ref={editorRef}
          role="textbox"
          aria-labelledby={labelId}
          aria-multiline="true"
          contentEditable
          suppressContentEditableWarning
          lang={language}
          onBlur={emitValue}
          onInput={emitValue}
          onKeyUp={updateFormatState}
          onPaste={handlePaste}
          className={`min-h-32 w-full whitespace-pre-wrap p-4 text-body outline-none ${
            language === 'ja' ? 'font-jp' : 'font-body'
          }`}
        />
      </div>
    </div>
  );
}

interface FormatButtonProps {
  children: React.ReactNode;
  label: string;
  isActive: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Button used for a text-formatting option such as Bold or Italic.
 */
function FormatButton({
  children,
  label,
  isActive,
  onMouseDown,
}: FormatButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isActive} // Shows if formatting option is currently active
      onMouseDown={onMouseDown}
      className={`flex h-8 w-8 items-center justify-center rounded-sm border text-body ${
        isActive
          ? 'border-msscc-pink bg-msscc-pink text-white'
          : 'border-msscc-gray-light bg-white text-msscc-gray-dark'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Convert the browser's editor HTML into the small format used by our app.
 *
 * Browsers may create different HTML for the same action, so this function
 * converts everything into only:
 *
 * <strong> for bold
 * <em> for italic
 * <br> for line breaks
 */
function serializeEditorContent(editor: HTMLDivElement): string {
  // Convert each editor node into the HTML string used by our app.
  const serializeNodes = (nodes: Node[]): string =>
    nodes.map((node, index) => serializeNode(node, index)).join('');

  /**
   * Convert one piece of the editor into our standard HTML.
   */
  const serializeNode = (node: Node, index: number): string => {
    // Normal text: escape special HTML characters.
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return '';

    const content = serializeNodes(Array.from(node.childNodes));

    // Keep line breaks as <br>.
    if (node.tagName === 'BR') return '<br>';
    // Convert both browser versions of bold into <strong>.
    if (node.tagName === 'STRONG' || node.tagName === 'B') return `<strong>${content}</strong>`;
    // Convert both browser versions of italic into <em>.
    if (node.tagName === 'EM' || node.tagName === 'I') return `<em>${content}</em>`;
    // Browsers may use DIV or P for new lines, so turn them into <br>.
    if (node.tagName === 'DIV' || node.tagName === 'P') {
      return `${index > 0 ? '<br>' : ''}${content}`;
    }

    return content;
  };

  return sanitizeRichText(
    serializeNodes(Array.from(editor.childNodes)).replace(/(?:<br>)+$/, ''),
  );
}

/**
 * Escape characters that could be interpreted as HTML. Protects certain characters from accidentally becoming html markups.
 *
 * Example:
 * < becomes &lt;
 * & becomes &amp;
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
