'use client';

import React from 'react';

import { RichTextInput } from '@/components/admin/RichTextInput';
import type { ImageAlignment, ImageWidth } from '@/types/content';

interface ImageBlockInputProps {
  contentEn: string;
  contentJa: string;
  imageUrl: string | null;
  imageAlignment: ImageAlignment;
  imageWidth: ImageWidth;
  onUpdateEn: (value: string) => void;
  onUpdateJa: (value: string) => void;
  onUpdateAlignment: (value: ImageAlignment) => void;
  onUpdateWidth: (value: ImageWidth) => void;
  onSelectFile: (file: File) => void;
  onDelete: () => void;
}

export default function ImageBlockInput({
  contentEn,
  contentJa,
  imageUrl,
  imageAlignment,
  imageWidth,
  onUpdateEn,
  onUpdateJa,
  onUpdateAlignment,
  onUpdateWidth,
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

      {/* Update alignment in the parent block so preview and save use the same value. */}
      <fieldset className="mb-6">
        <legend className="mb-2 text-label uppercase text-msscc-gray-mid">
          Image Alignment
        </legend>
        <div className="flex flex-wrap gap-2">
          {(['left', 'center', 'right'] as const).map((alignment) => {
            const isSelected = imageAlignment === alignment;

            return (
              <button
                key={alignment}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onUpdateAlignment(alignment)}
                className={`rounded-sm border px-4 py-2 text-btn capitalize ${
                  isSelected
                    ? 'border-msscc-pink bg-msscc-pink text-white'
                    : 'border-msscc-gray-light bg-white text-msscc-gray-dark'
                }`}
              >
                {alignment}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Update width in the parent block so preview and save use the same value. */}
      <fieldset className="mb-6">
        <legend className="mb-2 text-label uppercase text-msscc-gray-mid">
          Image Width
        </legend>
        <div className="flex flex-wrap gap-2">
          {([25, 50, 75, 100] as const).map((width) => {
            const isSelected = imageWidth === width;

            return (
              <button
                key={width}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onUpdateWidth(width)}
                className={`rounded-sm border px-4 py-2 text-btn ${
                  isSelected
                    ? 'border-msscc-pink bg-msscc-pink text-white'
                    : 'border-msscc-gray-light bg-white text-msscc-gray-dark'
                }`}
              >
                {width}%
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Input fields for image caption */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RichTextInput
          label="English Caption"
          language="en"
          value={contentEn}
          onUpdate={onUpdateEn}
        />

        <RichTextInput
          label="Japanese Caption"
          language="ja"
          value={contentJa}
          onUpdate={onUpdateJa}
        />
      </div>
    </div>
  );
}
