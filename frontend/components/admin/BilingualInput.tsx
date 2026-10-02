'use client';

// React
import React, { useState } from 'react';

import { RichTextInput } from '@/components/admin/RichTextInput';
import { getRichTextPlainText } from '@/utils/richText';

interface BilingualInputProps {
    labelEn: string;
    labelJa: string;
    valueEn: string;
    valueJa: string;
    onUpdateEn: (val: string) => void;
    onUpdateJa: (val: string) => void;
    title?: string; // Optional title like "Header" or "Board Member Name"
    onTranslate: () => Promise<void>; // For deepl button
    onDelete: () => void; // For delete button
}

/**
 * Reusable textbox components for side-by-side English and Japanese text entry.
 */
export default function BilingualInput({
    labelEn,
    labelJa,
    valueEn,
    valueJa,
    onUpdateEn,
    onUpdateJa,
    title,
    onTranslate,
    onDelete,
}: BilingualInputProps) {
    // State to show that the translation is processing
    const [isTranslating, setIsTranslating] = useState(false);

    const handleTranslationClick = async () => {
        setIsTranslating(true);
        try {
            await onTranslate();
        } finally {
            setIsTranslating(false);
        }
    };

    return (
      <div className="group relative border border-msscc-gray-light p-6 rounded-md bg-white shadow-none">

        {/* DELETE BUTTON */}
        <button
            onClick={onDelete}
            className="absolute top-3 right-3 p-1.5 text-msscc-gray-mid hover:text-msscc-pink hover:bg-msscc-pink/10 rounded-full transition-all opacity-0 group-hover:opacity-100"
            title="Remove Block"
            type="button"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

          {title && (
              <div className="flex justify-between items-center mb-6">
                  <span className="text-eyebrow tracking-eyebrow uppercase text-msscc-pink font-bold">
                      {title}
                  </span>
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* English Textbox */}
              <RichTextInput
                  label={labelEn}
                  language="en"
                  value={valueEn}
                  onUpdate={onUpdateEn}
              />

              {/* Japanese Textbox */}
              <RichTextInput
                label={labelJa}
                language="ja"
                value={valueJa}
                onUpdate={onUpdateJa}
                headerAction={(
                  <button
                    type="button"
                    onClick={handleTranslationClick}
                    disabled={isTranslating || !getRichTextPlainText(valueEn).trim()}
                    className={`rounded border px-3 py-1.5 text-[10px] font-bold uppercase
                      tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50
                      ${isTranslating
                        ? 'border-msscc-gray-light bg-gray-100 text-msscc-gray-mid'
                        : 'border-msscc-teal/30 bg-msscc-teal/10 text-msscc-teal hover:bg-msscc-teal hover:text-white active:scale-95 active:transform'}`}
                  >
                    {isTranslating ? 'Translating...' : 'Translate to Japanese'}
                  </button>
                )}
              />
          </div>
      </div>
    );
}
