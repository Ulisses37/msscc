'use client';

import { useEffect, useId, useRef, useState } from "react";

export type ExportFormat = "csv" | "xlsx";

export type ExportFieldOption<FieldKey extends string> = {
  key: FieldKey;
  label: string;
};

type DataExportMenuProps<FieldKey extends string> = {
  entityLabel: string;
  fields: ExportFieldOption<FieldKey>[];
  format: ExportFormat;
  selectedFields: FieldKey[];
  onFormatChange: (format: ExportFormat) => void;
  onSelectedFieldsChange: (fields: FieldKey[]) => void;
  onExport?: (format: ExportFormat, fields: FieldKey[]) => void;
  isExporting?: boolean;
};

export function DataExportMenu<FieldKey extends string>({
  entityLabel,
  fields,
  format,
  selectedFields,
  onFormatChange,
  onSelectedFieldsChange,
  onExport,
  isExporting = false,
}: DataExportMenuProps<FieldKey>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const formatGroupName = useId();
  const allFieldsSelected = fields.length > 0 && selectedFields.length === fields.length;
  const someFieldsSelected = selectedFields.length > 0 && !allFieldsSelected;

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someFieldsSelected;
    }
  }, [isOpen, someFieldsSelected]);

  function handleFieldChange(field: FieldKey, checked: boolean) {
    const nextFields = checked
      ? fields.filter((option) => option.key === field || selectedFields.includes(option.key)).map((option) => option.key)
      : selectedFields.filter((selectedField) => selectedField !== field);

    onSelectedFieldsChange(nextFields);
  }

  function handleSelectAllChange(checked: boolean) {
    onSelectedFieldsChange(checked ? fields.map((field) => field.key) : []);
  }

  return (
    <div ref={containerRef} className="relative flex flex-col items-stretch sm:ml-auto sm:items-end">
      <span className="mb-2 block text-label uppercase tracking-label text-msscc-gray-mid sm:text-right">
        Export {entityLabel}
      </span>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-msscc-teal px-3 py-2 text-caption font-semibold text-white transition-colors hover:bg-msscc-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-msscc-pink focus-visible:ring-offset-2 sm:w-auto"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Export
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div
          id={panelId}
          role="group"
          aria-label={`Export ${entityLabel} options`}
          className="absolute right-0 top-full z-20 mt-2 w-max max-w-[calc(100vw-2rem)] rounded-md border border-msscc-gray-light bg-white p-3 shadow-lg"
        >
          <fieldset>
            <legend className="text-caption font-semibold uppercase tracking-label text-msscc-gray-mid">Format</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["csv", "xlsx"] as const).map((option) => (
                <label
                  key={option}
                  className={`cursor-pointer rounded-md border px-2 py-1.5 text-center text-caption font-semibold uppercase transition-colors ${format === option ? "border-msscc-teal bg-msscc-teal text-white" : "border-msscc-gray-light text-msscc-gray-dark hover:border-msscc-teal"}`}
                >
                  <input
                    type="radio"
                    name={formatGroupName}
                    value={option}
                    checked={format === option}
                    onChange={() => onFormatChange(option)}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-3">
            <legend className="sr-only">Fields</legend>
            <div className="flex items-center justify-between gap-4">
              <span aria-hidden="true" className="text-caption font-semibold uppercase tracking-label text-msscc-gray-mid">Fields</span>
              <div className="flex items-center gap-3">
                <span className="text-caption text-msscc-gray-mid">{selectedFields.length} selected</span>
                <label className="flex cursor-pointer items-center gap-1.5 text-caption text-msscc-gray-dark">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allFieldsSelected}
                    onChange={(event) => handleSelectAllChange(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-msscc-gray-light text-msscc-teal focus:ring-msscc-pink"
                  />
                  Select all
                </label>
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-md border border-msscc-gray-light/60 bg-msscc-gray-faint/60 p-2 sm:grid-cols-[repeat(2,max-content)]">
              {fields.map((field) => (
                <label key={field.key} className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-caption text-msscc-gray-dark hover:bg-msscc-gray-light/40">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field.key)}
                    onChange={(event) => handleFieldChange(field.key, event.target.checked)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-msscc-gray-light text-msscc-teal focus:ring-msscc-pink"
                  />
                  <span className="break-words leading-tight">{field.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-3 flex justify-end border-t border-msscc-gray-light pt-3">
            <button
              type="button"
              disabled={!onExport || selectedFields.length === 0 || isExporting}
              onClick={() => onExport?.(format, selectedFields)}
              className="rounded-md bg-msscc-pink px-3 py-2 text-caption font-semibold text-white transition-colors hover:bg-msscc-pink-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-msscc-pink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-msscc-gray-light disabled:text-msscc-gray-mid"
            >
              {isExporting ? "Exporting..." : `Export ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
