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
  const sortableColumns = columns.filter((column) => column.sortable !== false);

  const handleMobileSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextColumn = sortableColumns.find((column) => String(column.key) === event.target.value);

    if (nextColumn) {
      onSort?.(nextColumn.key);
    }
  };

  return (
    <>
      <div className="md:hidden">
        {onSort && (
          <div className="mb-3 flex items-end gap-2">
            <label className="min-w-0 flex-1 text-label uppercase tracking-label text-msscc-gray-mid">
              <span className="mb-1 block">Sort by</span>
              <select
                value={selectedColumn === null ? "" : String(selectedColumn)}
                onChange={handleMobileSortChange}
                className="w-full bg-white px-3 py-2 text-body-sm normal-case tracking-normal text-msscc-gray-dark"
              >
                <option value="" disabled>Choose a field</option>
                {sortableColumns.map((column) => (
                  <option key={String(column.key)} value={String(column.key)}>{column.header}</option>
                ))}
              </select>
            </label>
            {selectedColumn !== null && (
              <button
                type="button"
                onClick={() => onSort(selectedColumn)}
                aria-label={`Change to ${sortDirection === "ascending" ? "descending" : "ascending"} order`}
                className="rounded-md border border-msscc-gray-light bg-white px-3 py-2 text-body-sm text-msscc-gray-dark transition-colors hover:border-msscc-teal hover:text-msscc-teal"
              >
                {sortDirection === "ascending" ? "Ascending ↑" : "Descending ↓"}
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {dataEntries.map((row, rowIndex) => (
            <article key={rowIndex} className="overflow-hidden rounded-md border border-msscc-gray-light bg-white">
              <dl>
                {columns.map((column) => (
                  <div key={String(column.key)} className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-b border-msscc-gray-light px-4 py-3 last:border-b-0">
                    <dt className="text-eyebrow font-semibold uppercase tracking-eyebrow text-msscc-gray-mid">{column.header}</dt>
                    <dd className="min-w-0 break-words text-body-sm text-msscc-gray-dark">
                      {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? "")}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </div>

      <div className="hidden w-full overflow-x-auto rounded-sm border border-msscc-gray-light bg-white md:block">
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
    </>
  );
}
