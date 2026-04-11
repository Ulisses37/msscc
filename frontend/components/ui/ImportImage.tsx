'use client';

import { ChangeEvent, useState } from 'react';

interface ImportImageProps {
  onChange: (file: File | null) => void;
  label?: string;
  id?: string;
  className?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  autoUpload?: boolean;
  onUploadSuccess?: (url: string) => void;
  onUploadError?: (error: string) => void;
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
  autoUpload = true,
  onUploadSuccess,
  onUploadError,
}: ImportImageProps) {
  const inputId = id || 'import-image';
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-image/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onUploadSuccess?.(data.url);
    } catch (error) {
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onChange(file);
    if (file && autoUpload) {
      uploadFile(file);
    }
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        disabled={disabled || uploading}
        required={required}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 disabled:opacity-50"
        aria-label={label || 'Import image'}
      />
      {uploading && <p className="text-sm text-blue-600 mt-1">Uploading...</p>}
    </div>
  );
}
