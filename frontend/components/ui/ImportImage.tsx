'use client';

import { ChangeEvent } from 'react';

interface ImportImageProps {
  onChange: (file: File | null) => void;
  label?: string;
  id?: string;
  className?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
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
}: ImportImageProps) {
  const inputId = id || 'import-image';

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onChange(file);
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
        disabled={disabled}
        required={required}
        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 disabled:opacity-50"
      />
    </div>
  );
}
