'use client';

import React from "react";

type PostPagesProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  pageSizeOptions: number[];
  onItemsPerPageChange: (itemsPerPage: number) => void;
};

export function PostPages({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  pageSizeOptions,
  onItemsPerPageChange,
}: PostPagesProps) {
  const handleItemsPerPageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextItemsPerPage = Number(event.target.value);

    if (Number.isInteger(nextItemsPerPage) && nextItemsPerPage > 0) {
      onItemsPerPageChange(nextItemsPerPage);
    }
  };

  return (
    <div className="mt-5 flex w-full flex-col gap-4 border-t border-msscc-gray-light pt-4 text-body-sm text-msscc-gray-mid sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          className="rounded-sm border border-msscc-gray-light px-3 py-2 text-msscc-gray-dark transition-colors hover:border-msscc-teal hover:text-msscc-teal disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span className="px-2 py-2">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="rounded-sm border border-msscc-gray-light px-3 py-2 text-msscc-gray-dark transition-colors hover:border-msscc-teal hover:text-msscc-teal disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
      <label className="flex items-center gap-2">
        <span>Entries per page:</span>
        <select
          value={itemsPerPage}
          onChange={handleItemsPerPageChange}
          className="rounded-sm border border-msscc-gray-light bg-white px-3 py-2 text-msscc-gray-dark outline-none focus:border-msscc-teal focus:ring-1 focus:ring-msscc-teal"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
