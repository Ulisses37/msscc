'use client';

import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ImageItem = {
  media_asset_id: number;
  file_key: string | null;
  file_url: string | null;
  file_name: string;
  file_type: string;
  alt_text_en: string;
  alt_text_ja: string;
  created_at: string;
};

type PageRecord = {
  page_id: number;
};

type MediaReferenceRecord = {
  media_asset?: number | null;
  is_published?: boolean;
  is_visible?: boolean;
};

{/** Allows for Exiting UI*/}
type ImageDeletionManagerProps = {
  onClose: () => void;
};

{/* Need to Query API for media assets across all models for warnings of dependencies from active instances*/}


export function ImageDeletionManager({ onClose }: ImageDeletionManagerProps) {
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [inUseMediaAssetIds, setInUseMediaAssetIds] = useState<number[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  {/* Fetch the list of media assets found in Database*/}
  const fetchImage = useCallback(async (clearMessage = true) => {
    setError(null);
    if (clearMessage) setMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/`);
      if (!response.ok) {
        throw new Error('Failed to load image list.');
      }
      const items = (await response.json()) as ImageItem[];
      setImageItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load image.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  {/* Fetch IDs of media assets currently in use by querying all relevant models*/}
  const fetchInUseMediaAssetIds = useCallback(async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    setError(null);

    try {
      const fetchJson = async <T,>(path: string): Promise<T> => {
        const response = await fetch(`${apiUrl}${path}`);
        if (!response.ok) throw new Error(`Failed to load ${path}.`);
        return response.json() as Promise<T>;
      };

      const [pages, boardMembers, events, staticImages, partners] = await Promise.all([
        fetchJson<PageRecord[]>('/api/page/get-all/'),
        fetchJson<MediaReferenceRecord[]>('/api/board-members/'),
        fetchJson<(MediaReferenceRecord & { is_published?: boolean })[]>('/api/events/'),
        fetchJson<MediaReferenceRecord[]>('/api/media/static-images/'),
        fetchJson<(MediaReferenceRecord & { is_visible?: boolean })[]>('/api/partners/'),
      ]);

      const contentByPage = await Promise.all(
        pages.map((page) =>
          fetchJson<MediaReferenceRecord[]>(`/api/content/page/${page.page_id}/`),
        ),
      );

      const referencedIds = [
        ...contentByPage.flat(),
        ...boardMembers,
        ...events.filter((event) => event.is_published !== false),
        ...staticImages,
        ...partners.filter((partner) => partner.is_visible !== false),
      ]
        .map((record) => record.media_asset)
        .filter((mediaAssetId): mediaAssetId is number => typeof mediaAssetId === 'number');

      setInUseMediaAssetIds([...new Set(referencedIds)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to determine media usage.');
    }
  }, []);

  useEffect(() => {
    fetchImage();
    fetchInUseMediaAssetIds();
  }, [fetchImage, fetchInUseMediaAssetIds]);

  {/*Flexibility for selecting images*/}
  const toggleSelection = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one image item to delete.');
      return;
    }

    const filteredIdsInUse = selectedIds.filter((id) => inUseMediaAssetIds.includes(id));
    const usageWarning = filteredIdsInUse.length > 0
      ? `\n\nWarning: ${filteredIdsInUse.length} selected image item(s) are currently in use.`
      : '';
    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected image item(s)? This cannot be undone.${usageWarning}`
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      for (const id of selectedIds) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/${id}/`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const responseBody = await response.json().catch(() => null);
          throw new Error(responseBody?.error || `Failed to delete image ${id}.`);
        }
      }

      setMessage(`Deleted ${selectedIds.length} image item(s).`);
      setSelectedIds([]);
      await fetchImage(false);
      await fetchInUseMediaAssetIds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete selected image items.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal((
    <div className="fixed left-0 top-0 z-[9999] flex h-[100dvh] w-[100vw] items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between rounded-t-2xl border-b border-msscc-teal-dark bg-msscc-teal-light p-5">
          <div>
            <p className="text-sm text-white">Select stored image items from the database.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/40 bg-white px-1 py-0 text-sm text-msscc-teal hover:bg-msscc-gray-faint"
          >
            X
          </button>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={handleDelete}
              disabled={selectedIds.length === 0 || isDeleting || isLoading}
              className="rounded-md bg-msscc-danger px-4 py-2 text-sm font-medium text-white disabled:bg-msscc-gray-light"
            >
              {isDeleting ? 'Deleting…' : `Delete selected (${selectedIds.length})`}
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200 shadow-sm">
              <span className="text-lg font-bold">✕</span>
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="mb-4 flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700 border border-emerald-200 shadow-md">
              <span className="font-medium flex-1">{message}</span>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="text-slate-700">
                    <th className="px-4 py-3">Select</th>
                    <th className="px-4 py-3">Filename</th>
                    <th className="px-4 py-3">Upload Date</th>
                    <th className="px-4 py-3">In Use</th>
                  </tr>
                </thead>
                <tbody>
                  {/*Load Images and check*/}
                  {imageItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        {isLoading ? 'Loading images…' : 'No stored images found.'}
                      </td>
                    </tr>
                  ) :
                  (imageItems.map((item) => {
                      const isInUse = inUseMediaAssetIds.includes(item.media_asset_id);

                      return (
                      <tr key={item.media_asset_id} className={`border-t border-msscc-gray-light ${isInUse ? 'bg-msscc-pink-faint' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.media_asset_id)}
                            onChange={() => toggleSelection(item.media_asset_id)}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          />
                          {selectedIds.includes(item.media_asset_id) && isInUse && (
                            <span
                              className="inline-flex h-4 w-3 items-center justify-center rounded-full bg-msscc-danger text-xs font-bold text-white"
                              title="Selected image is currently in use"
                              aria-label="Warning: selected image is currently in use"
                            >
                              !
                            </span>
                          )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{item.file_name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {isInUse ? (
                            <span className="rounded-full bg-msscc-pink-faint px-2 py-1 text-xs font-semibold text-msscc-danger">
                              In use
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Unused</span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}

                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
