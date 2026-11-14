'use client';

import { ChangeEvent, useRef, useState } from 'react';

import ImageCropModal from '@/components/ui/ImageCropModal';

interface ImportImageProps {
  onChange: (file: File | null) => void;
  label?: string;
  id?: string;
  className?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Opens a crop dialog after a file is chosen. Ignored when `multiple` is set. */
  enableCrop?: boolean;
  /** Width divided by height (1 = square). Leave out for a free-form crop. */
  cropAspect?: number;
}

export function ImportImage({
  onChange,
  label,
  id,
  className,
  accept = 'image/*',
  multiple = false,
  disabled = false,
  required = false,
  enableCrop = false,
  cropAspect,
}: ImportImageProps) {
  const inputId = id || 'import-image';
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    if (file && enableCrop && !multiple) {
      setPendingFile(file);
      return;
    }

    onChange(file);
  };

  const handleCropCancel = () => {
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        className="block w-full text-xs text-slate-500 file:mr-0 file:mb-2 file:rounded file:border-0 file:bg-slate-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-100 disabled:opacity-50 sm:file:mr-4 sm:file:mb-0 sm:text-sm sm:file:text-sm"
      />
      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          aspect={cropAspect}
          onConfirm={(croppedFile) => {
            setPendingFile(null);
            onChange(croppedFile);
          }}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
