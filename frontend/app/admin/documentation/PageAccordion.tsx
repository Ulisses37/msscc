'use client';

import React, { useState } from 'react';
import type { Instruction, InstructionVariant } from './pageDocumentation';

interface PageAccordionProps {
  pageName: string;
  pageDescription: string;
  pageInstructions: Instruction[];
}

// Full class names so Tailwind can detect them
const COLOR_CLASSES: Record<string, string> = {
  pink: 'text-msscc-pink font-semibold',
  teal: 'text-msscc-teal font-semibold',
  green: 'text-green-600 font-semibold',
  red: 'text-red-600 font-semibold',
  gray: 'text-gray-500',
};

const VARIANT_STYLES: Record<InstructionVariant, { box: string; label: string }> = {
  note: { box: 'border-l-4 border-blue-400 bg-blue-50 text-blue-900', label: 'Note' },
  tip: { box: 'border-l-4 border-green-500 bg-green-50 text-green-900', label: 'Tip' },
  warning: { box: 'border-l-4 border-red-500 bg-red-50 text-red-900', label: 'Warning' },
};

// Matches **bold**, *italic*, or {color|text}
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|\{(?:pink|teal|green|red|gray)\|[^}]+\})/g;

function renderInline(text: string): React.ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    const color = part.match(/^\{(\w+)\|([^}]+)\}$/);
    if (color) {
      return (
        <span key={i} className={COLOR_CLASSES[color[1]]}>
          {color[2]}
        </span>
      );
    }
    return part;
  });
}

export default function PageAccordion({
  pageName,
  pageDescription,
  pageInstructions,
}: PageAccordionProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-msscc-gray-light last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-msscc-pink-light/40 sm:gap-4 sm:py-4"
      >
        <div className="min-w-0">
          <div className="break-words text-sm font-semibold text-msscc-pink sm:text-base">{pageName}</div>
          <div className="break-words text-xs text-gray-600 sm:text-sm">{pageDescription}</div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 ${
            open ? 'rotate-0' : '-rotate-90'
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul className="space-y-2 break-words pb-4 pl-4 pr-2 pt-2 text-xs text-gray-700 sm:pl-6 sm:text-sm">
          {pageInstructions.map((item, i) => {
            if (typeof item === 'string') {
              return (
                <li key={i} className="ml-4 list-disc">
                  {renderInline(item)}
                </li>
              );
            }
            const style = item.variant ? VARIANT_STYLES[item.variant] : null;
            return (
              <li
                key={i}
                className={style ? `list-none rounded-r-md px-3 py-2 ${style.box}` : 'ml-4 list-disc'}
              >
                {style && <span className="mr-1 font-bold">{style.label}:</span>}
                {renderInline(item.text)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
