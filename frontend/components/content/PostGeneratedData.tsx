'use client';

import React, { ReactNode } from "react";

export type PostTableColumn<T, ColumnKey extends keyof T = keyof T> = {
  key: ColumnKey;
  header: string;
  width?: number;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
};

export type SortDirection = "ascending" | "descending";

type PostTableProps<T, ColumnKey extends keyof T = keyof T> = {
  dataEntries: T[];
  columns: PostTableColumn<T, ColumnKey>[];
  selectedColumn?: ColumnKey | null;
  sortDirection?: SortDirection;
  onSort?: (column: ColumnKey) => void;
};

function getColumnButtonClasses<T, ColumnKey extends keyof T>(column: PostTableColumn<T, ColumnKey>, selectedColumn: ColumnKey | null | undefined): string {
  const baseClasses = "flex h-full w-full items-center justify-center px-4 py-2 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200";
  const selectedClasses = "bg-[#dbe3ea] font-bold text-slate-800 underline hover:bg-[#ced9e2]";
  const unselectedClasses = "bg-transparent text-slate-700 hover:bg-[#e8edf2] hover:text-slate-900";
  return `${baseClasses} ${selectedColumn === column.key ? selectedClasses : unselectedClasses}`;
}

export function PostTable<T extends object, ColumnKey extends keyof T = keyof T>({ dataEntries, columns, selectedColumn = null, sortDirection = "ascending", onSort }: PostTableProps<T, ColumnKey>) {
  return (
    <div className="p-6">
      <div className="flex justify-center overflow-x-auto">
        <div className="inline-block rounded border border-gray-300 bg-gray-50 p-2">
          <table className="w-auto border-separate border-spacing-y-1">
            <thead>
              <tr className="divide-x divide-gray-300 text-left">
                {columns.map((column) => {
                  const isSortable = column.sortable !== false && Boolean(onSort);
                  const header = <span className="block w-full px-4 py-2 text-center text-sm font-semibold">{column.header}</span>;
                  return (
                    <th key={String(column.key)} className="p-0" aria-sort={selectedColumn === column.key ? sortDirection : "none"} style={column.width ? { width: column.width, minWidth: column.width } : undefined}>
                      {isSortable ? (
                        <button type="button" onClick={() => onSort?.(column.key)} className={getColumnButtonClasses(column, selectedColumn)}>
                          {header}
                        </button>
                      ) : header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {dataEntries.map((row, rowIndex) => (
                <tr key={rowIndex} className="bg-white hover:bg-gray-50">
                  {columns.map((column, columnIndex) => (
                    <td key={String(column.key)} className={`px-6 py-3 text-center border-y border-gray-300 ${columnIndex === 0 ? "rounded-l-md border-l" : ""} ${columnIndex === columns.length - 1 ? "rounded-r-md border-r" : ""}`} style={column.width ? { width: column.width, minWidth: column.width } : undefined}>
                      {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
