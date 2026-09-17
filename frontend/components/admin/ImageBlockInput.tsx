'use client';

import React, { useState } from 'react';

interface ImageBlockInputProps {
  contentEn: string;
  contentJa: string;
  imageUrl: string | null;
  onUpdateEn: (value: string) => void;
  onUpdateJa: (value: string) => void;
  onSelectFile: (file: File) => void;
  onDelete: () => void;
}

export default function ImageBlockInput({
  contentEn,
  contentJa,
  imageUrl,
  onUpdateEn,
  onUpdateJa,
  onSelectFile,
  onDelete,
}: ImageBlockInputProps) {
  return (
    <div className="group relative border border-msscc-gray-light p-6 rounded-md bg-white">
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-3 right-3"
      >
        Remove
      </button>

      <div className="mb-6">
        <label className="block mb-2 text-label uppercase text-msscc-gray-mid">
          Image
        </label>

        {/* Handle file selection */}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onSelectFile(file);
            }
          }}
        />
      </div>

      {/* Handle displaying the image */}
      {imageUrl && (
        <div className="mb-6">
          <img
            src={imageUrl}
            alt="Selected image preview"
            className="max-h-64 max-w-full object-contain"
          />
        </div>
      )}

      {/* Input fields for image caption */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block mb-2 text-label uppercase text-msscc-gray-mid">
            English Caption
          </label>
          <textarea
            className="w-full p-4 border border-msscc-gray-light rounded-md"
            rows={4}
            value={contentEn}
            onChange={(e) => onUpdateEn(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-2 text-label uppercase text-msscc-gray-mid">
            Japanese Caption
          </label>
          <textarea
            className="w-full p-4 border border-msscc-gray-light rounded-md"
            rows={4}
            value={contentJa}
            onChange={(e) => onUpdateJa(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
