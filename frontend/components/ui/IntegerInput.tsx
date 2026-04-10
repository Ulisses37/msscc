'use client';

import { parse } from 'path';
import { ChangeEvent } from 'react';
import { number } from 'zod';

interface IntegerInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  label?: string;
  placeholder?: string;
  id?: string;
  min?: number;
  max?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export function IntegerInput({
  value,
  onChange,
  label,
  placeholder,
  id,
  min,
  max,
  required = false,
  disabled = false,
  className,
  error,
}: IntegerInputProps) {
  const inputId = id || 'integer-input';

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;

    if (raw === '') {
      onChange('');
      return;
    }

    //Needs Positive Values for Donation amount.
    if (!/^\d+$/.test(raw)) {
      return;
    }

    let parsed = Number(raw);
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;

    onChange(parsed);
  };


  {/* Calls a function to handle input changes for integers*/}
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}

      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        className={`block w-full rounded border px-3 py-2 text-sm shadow-sm outline-none transition
          ${error
            ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
            : 'border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200'
          }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}

      />

      {error && (
        <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
