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
    <div className="relative flex items-center justify-center mt-4 w-full">
      <div className="flex items-center justify-center gap-2">
        <button
          className="px-4 py-2 mx-1 bg-gray-300 rounded disabled:opacity-50"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span className="px-4 py-2 mx-1">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="px-4 py-2 mx-1 bg-gray-300 rounded disabled:opacity-50"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </button>
      </div>
      <label className="absolute right-0 flex items-center gap-2">
        <span>Entries per page:</span>
        <select
          value={itemsPerPage}
          onChange={handleItemsPerPageChange}
          className="px-2 py-2 border border-gray-300 rounded"
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
