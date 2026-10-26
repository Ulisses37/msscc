'use client';

import { useState } from 'react';

interface PageAccordionProps {
  pageName: string;
  pageDescription: string;
  pageInstructions: string[];
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
            open ? 'rotate-0' : 'rotate-90'
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
        <ul className="list-disc space-y-2 break-words pb-4 pl-7 pr-2 pt-2 text-xs text-gray-700 sm:space-y-1 sm:pl-10 sm:text-sm">
          {pageInstructions.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
