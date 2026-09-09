'use client';

import React, {} from "react";

export function PostPages({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  return (
    <div className="flex justify-center mt-4">
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
  )
}
