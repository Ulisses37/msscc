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

type StaticImageRecord = MediaReferenceRecord & {
  static_image_id: number;
  display_name: string;
};

{/** Allows for Exiting UI*/}
type ImageDeletionManagerProps = {
  onClose: () => void;
  /** Force the compact image list when the manager is used in a constrained layout. */
  mobileLayout?: boolean;
};

{/* Need to Query API for media assets across all models for warnings of dependencies from active instances*/}


export function ImageDeletionManager({ onClose, mobileLayout = false }: ImageDeletionManagerProps) {
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [inUseMediaAssetIds, setInUseMediaAssetIds] = useState<number[]>([]);
  const [staticImages, setStaticImages] = useState<StaticImageRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 900px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

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

      const [pages, boardMembers, events, eventImages, staticImages, partners] = await Promise.all([
        fetchJson<PageRecord[]>('/api/page/get-all/'),
        fetchJson<MediaReferenceRecord[]>('/api/board-members/'),
        fetchJson<(MediaReferenceRecord & { is_published?: boolean })[]>('/api/events/'),
        fetchJson<MediaReferenceRecord[]>('/api/events/images/'),
        fetchJson<StaticImageRecord[]>('/api/media/static-images/'),
        fetchJson<(MediaReferenceRecord & { is_visible?: boolean })[]>('/api/partners/'),
      ]);

      setStaticImages(staticImages);

      const contentByPage = await Promise.all(
        pages.map((page) =>
          fetchJson<MediaReferenceRecord[]>(`/api/content/page/${page.page_id}/`),
        ),
      );

      const referencedIds = [
        ...contentByPage.flat(),
        ...boardMembers,
        ...events.filter((event) => event.is_published !== false),
        ...eventImages,
        ...staticImages,
        ...partners.filter((partner) => partner.is_visible !== false),
      ]
        .map((record) => record.media_asset)
        .filter((mediaAssetId): mediaAssetId is number => typeof mediaAssetId === 'number');

      setInUseMediaAssetIds(Array.from(new Set(referencedIds)));
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
    if (staticImages.some((staticImage) => staticImage.media_asset === id)) return;
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) {
      setError('Please select at least one image item to delete.');
      return;
    }

    const protectedIds = new Set(
      staticImages
        .map((staticImage) => staticImage.media_asset)
        .filter((id): id is number => typeof id === 'number'),
    );
    const deletableIds = selectedIds.filter((id) => !protectedIds.has(id));
    if (deletableIds.length === 0) {
      setError('Selected media assets are linked to static images and cannot be deleted.');
      return;
    }

    const filteredIdsInUse = deletableIds.filter((id) => inUseMediaAssetIds.includes(id));
    const usageWarning = filteredIdsInUse.length > 0
      ? `\n\nWarning: ${filteredIdsInUse.length} selected image item(s) are currently in use.`
      : '';
    const confirmed = window.confirm(
      `Delete ${deletableIds.length} selected image item(s)? This cannot be undone.${usageWarning}`
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setMessage(null);

    try {
      for (const id of deletableIds) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/${id}/`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const responseBody = await response.json().catch(() => null);
          throw new Error(responseBody?.error || `Failed to delete image ${id}.`);
        }
      }

      setMessage(`Deleted ${deletableIds.length} image item(s).`);
      setSelectedIds([]);
      await fetchImage(false);
      await fetchInUseMediaAssetIds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete selected image items.');
    } finally {
      setIsDeleting(false);
    }
  };

  const useMobileLayout = mobileLayout || isMobileViewport;

  const getStaticImageIdsForMedia = (mediaAssetId: number) =>
    staticImages
      .filter((staticImage) => staticImage.media_asset === mediaAssetId)
      .map((staticImage) => staticImage.static_image_id);

  const renderEmptyState = (className: string) => (
    <div className={className}>
      {isLoading ? 'Loading images…' : 'No stored images found.'}
    </div>
  );

  const renderMobileImageList = () => (
    <div className="max-h-[55dvh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
      {imageItems.length === 0
        ? renderEmptyState('px-4 py-10 text-center text-slate-500')
        : imageItems.map((item) => {
            const isInUse = inUseMediaAssetIds.includes(item.media_asset_id);
            const isSelected = selectedIds.includes(item.media_asset_id);
            const staticImageIds = getStaticImageIdsForMedia(item.media_asset_id);
            const isProtected = staticImageIds.length > 0;
            const protectionTitle = `Protected by StaticImage ${staticImageIds.join(', ')}`;

            return (
              <div
                key={item.media_asset_id}
                className={`flex min-w-0 items-center gap-3 border-t border-msscc-gray-light p-3 first:border-t-0 ${
                  isProtected ? 'bg-red-50' : isInUse ? 'bg-msscc-pink-faint' : 'bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isProtected}
                  onChange={() => toggleSelection(item.media_asset_id)}
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-slate-900"
                  aria-label={isProtected ? `${item.file_name} is protected by a static image` : `Select ${item.file_name}`}
                />
                {item.file_url ? (
                  <img
                    src={item.file_url}
                    alt={item.alt_text_en || item.file_name}
                    className="h-14 w-14 shrink-0 rounded-md border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center text-[10px] text-slate-400">
                    No preview
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  {isProtected ? (
                    <span className="mt-1 inline-flex rounded-full bg-msscc-danger-faint px-2 py-0.5 text-[11px] font-semibold text-msscc-danger" title={protectionTitle}>
                      Protected Image
                    </span>
                  ) : isInUse ? (
                    <span className="mt-1 inline-flex rounded-full bg-msscc-pink-faint px-2 py-0.5 text-[11px] font-semibold text-msscc-danger">
                      In use
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex text-[11px] text-slate-500">Unused</span>
                  )}
                </div>
                {isProtected && (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
                    title={protectionTitle}
                    aria-label={protectionTitle}
                  >
                    !
                  </span>
                )}
                {isSelected && isInUse && !isProtected && (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-msscc-danger text-xs font-bold text-white"
                    title="Selected image is currently in use"
                    aria-label="Warning: selected image is currently in use"
                  >
                    !
                  </span>
                )}
              </div>
            );
          })}
    </div>
  );

  const renderDesktopImageTable = () => (
    <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="text-slate-700">
            <th className="px-4 py-3">Select</th>
            <th className="px-4 py-3">Filename</th>
            <th className="px-4 py-3">Upload Date</th>
            <th className="px-4 py-3">In Use</th>
          </tr>
        </thead>
        <tbody>
          {imageItems.length === 0
            ? <tr><td colSpan={4}>{renderEmptyState('px-4 py-10 text-center text-slate-500')}</td></tr>
            : imageItems.map((item) => {
                const isInUse = inUseMediaAssetIds.includes(item.media_asset_id);
                const isSelected = selectedIds.includes(item.media_asset_id);
                const staticImageIds = getStaticImageIdsForMedia(item.media_asset_id);
                const isProtected = staticImageIds.length > 0;
                const protectionTitle = `Protected by StaticImage ${staticImageIds.join(', ')}`;

                return (
                  <tr key={item.media_asset_id} className={`border-t border-msscc-gray-light ${isProtected ? 'bg-msscc-danger-faint' : isInUse ? 'bg-msscc-pink-faint' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isProtected}
                          onChange={() => toggleSelection(item.media_asset_id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900"
                          aria-label={isProtected ? `${item.file_name} is protected by a static image` : `Select ${item.file_name}`}
                        />
                        {isProtected ? (
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white" title={protectionTitle} aria-label={protectionTitle}>!</span>
                        ) : isSelected && isInUse && (
                          <span className="inline-flex h-4 w-3 items-center justify-center rounded-full bg-msscc-danger text-xs font-bold text-white" title="Selected image is currently in use" aria-label="Warning: selected image is currently in use">!</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.file_url ? (
                          <img
                            src={item.file_url}
                            alt={item.alt_text_en || item.file_name}
                            className="h-10 w-10 shrink-0 rounded-md border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center text-[9px] text-slate-400">
                            No preview
                          </div>
                        )}
                        <span className="truncate" title={item.file_name}>{item.file_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{new Date(item.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {isProtected ? <span className="rounded-full bg-msscc-danger-faint px-2 py-1 text-xs font-semibold text-msscc-danger" title={protectionTitle}>Protected Image</span> : isInUse ? <span className="rounded-full bg-msscc-pink-faint px-2 py-1 text-xs font-semibold text-msscc-danger">In use</span> : <span className="text-xs text-slate-500">Unused</span>}
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );

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

        <div className="p-3 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
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

          <div className="overflow-hidden rounded-xl border border-slate-200">
            {useMobileLayout ? renderMobileImageList() : renderDesktopImageTable()}
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}
