'use client';

import React, { useCallback, useEffect, useState } from "react";

export function PostPages({ data, itemsPerPage, currentPage, totalPages, onPageChange }: { data: any[]; itemsPerPage: number; currentPage: number; totalPages: number; onPageChange: (page: number) => void; }) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return data.slice(startIndex, endIndex);
}
