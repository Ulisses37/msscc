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
  const baseClasses = "flex h-full w-full items-center justify-start px-4 py-3 text-left text-eyebrow font-semibold tracking-eyebrow uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-msscc-teal";
  const selectedClasses = "text-msscc-teal hover:bg-[#ead6e8]";
  const unselectedClasses = "text-msscc-gray-mid hover:bg-[#ead6e8] hover:text-msscc-gray-dark";
  return `${baseClasses} ${selectedColumn === column.key ? selectedClasses : unselectedClasses}`;
}

export function PostTable<T extends object, ColumnKey extends keyof T = keyof T>({ dataEntries, columns, selectedColumn = null, sortDirection = "ascending", onSort }: PostTableProps<T, ColumnKey>) {
  return (
    <div className="w-full overflow-x-auto rounded-sm border border-msscc-gray-light bg-white">
      <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-msscc-gray-light bg-msscc-gray-faint">
                {columns.map((column) => {
                  const isSortable = column.sortable !== false && Boolean(onSort);
                  const header = <span className="block w-full text-left text-eyebrow font-semibold tracking-eyebrow uppercase text-msscc-gray-mid">{column.header}</span>;
                  return (
                    <th key={String(column.key)} className="p-0" aria-sort={selectedColumn === column.key ? sortDirection : "none"} style={column.width ? { width: column.width, minWidth: column.width } : undefined}>
                      {isSortable ? (
                        <button type="button" onClick={() => onSort?.(column.key)} className={getColumnButtonClasses(column, selectedColumn)}>
                          {header}
                        </button>
                      ) : (
                        <div className="px-4 py-3">{header}</div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {dataEntries.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-msscc-gray-light last:border-b-0 hover:bg-msscc-pink-faint">
                  {columns.map((column, columnIndex) => (
                    <td key={String(column.key)} className={`px-4 py-3 text-left text-body-sm text-msscc-gray-dark ${columnIndex === 0 ? "font-medium" : ""}`} style={column.width ? { width: column.width, minWidth: column.width } : undefined}>
                      {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
      </table>
    </div>
  );
}
