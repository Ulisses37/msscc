'use client';

// React
import React, { useState } from 'react';

interface BilingualInputProps {
    labelEn: string;
    labelJa: string;
    valueEn: string;
    valueJa: string;
    onUpdateEn: (val: string) => void;
    onUpdateJa: (val: string) => void;
    title?: string; // Optional title like "Header" or "Board Member Name"
    onTranslate: () => Promise<void>; // For deepl button
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
      <div className="relative border border-msscc-gray-light p-6 rounded-md bg-white shadow-none">
          {title && (
              <div className="flex justify-between items-center mb-6">
                  <span className="text-eyebrow tracking-eyebrow uppercase text-msscc-pink font-bold">
                      {title}
                  </span>
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* English Textbox */}
              <div>
                  <div className="flex items-end mb-2 h-9">
                    <label className="block text-label tracking-label text-msscc-gray-mid uppercase mb-2">
                        {labelEn}
                    </label>
                  </div>
                  <textarea
                      className="w-full p-4 border border-msscc-gray-light rounded-md font-body text-body focus:ring-focus-admin outline-none"
                      rows={4}
                      value={valueEn}
                      onChange={(e) => onUpdateEn(e.target.value)}
                  />
              </div>

              {/* Japanese Textbox */}
              <div>
                  {/* Translate Button */}
                  <div className="flex justify-between items-end mb-2 h-9">
                  <label className="block text-label tracking-label text-msscc-gray-mid uppercase">
                      {labelJa}
                  </label>

                  <button
                          onClick={handleTranslationClick}
                          disabled={isTranslating || !valueEn}
                          className={`text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded border transition-all
                            ${isTranslating
                                ? 'bg-gray-100 text-msscc-gray-mid border-msscc-gray-light'
                                : 'bg-msscc-teal/10 text-msscc-teal border-msscc-teal/30 hover:bg-msscc-teal hover:text-white active:transform active:scale-95'}
                            disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                          {isTranslating ? 'Translating...' : 'Translate to Japanese'}
                      </button>
                  </div>

                  <textarea
                      className="w-full p-4 border border-msscc-gray-light rounded-md font-jp text-body bg-white focus:ring-focus-admin outline-none"
                      rows={4}
                      value={valueJa}
                      onChange={(e) => onUpdateJa(e.target.value)}
                  />
              </div>
          </div>
      </div>
    );
}
