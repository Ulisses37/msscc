'use client';

// React
import React from 'react';

interface BilingualInputProps {
    labelEn: string;
    labelJa: string;
    valueEn: string;
    valueJa: string;
    onUpdateEn: (val: string) => void;
    onUpdateJa: (val: string) => void;
    title?: string; // Optional title like "Header" or "Board Member Name"
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
    title
}: BilingualInputProps) {
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
                  <label className="block text-label tracking-label text-msscc-gray-mid uppercase mb-2">
                      {labelEn}
                  </label>
                  <textarea
                      className="w-full p-4 border border-msscc-gray-light rounded-md font-body text-body focus:ring-focus-admin outline-none"
                      rows={4}
                      value={valueEn}
                      onChange={(e) => onUpdateEn(e.target.value)}
                  />
              </div>

              {/* Japanese Textbox */}
              <div>
                  <label className="block text-label tracking-label text-msscc-gray-mid uppercase mb-2">
                      {labelJa}
                  </label>
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
