'use client';

import React, { useEffect, useState } from 'react';
import PostImage from './PostImage';

type GalleryMediaItem = {
  media_asset_id: number;
  file_url: string | null;
  file_name: string;
  file_type: string;
  is_visible_to_gallery: boolean;
};

type GalleryVisibilityManagerProps = {
  onClose: () => void;
};

export function GalleryVisibilityManager({ onClose }: GalleryVisibilityManagerProps) {
  const [items, setItems] = useState<GalleryMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    const loadMedia = async () => {
      setError(null);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to load media assets.');
        setItems((await response.json()) as GalleryMediaItem[]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load media assets.');
      } finally {
        setIsLoading(false);
      }
    };

    loadMedia();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const toggleGalleryVisibility = async (item: GalleryMediaItem) => {
    const switchedVisibility = !item.is_visible_to_gallery;
    setItemErrors((current) => {
      const next = { ...current };
      delete next[item.media_asset_id];
      return next;
    });
    setSavingIds((current) => [...current, item.media_asset_id]);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/media/${item.media_asset_id}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_visible_to_gallery: switchedVisibility }),
        },
      );

      const responseBody = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseBody?.is_visible_to_gallery?.[0] || 'Failed to update gallery visibility.');
      }

      setItems((current) => current.map((currentItem) =>
        currentItem.media_asset_id === item.media_asset_id
          ? { ...currentItem, is_visible_to_gallery: switchedVisibility }
          : currentItem,
      ));
    } catch (saveError) {
      setItemErrors((current) => ({
        ...current,
        [item.media_asset_id]: saveError instanceof Error
          ? saveError.message
          : 'Failed to update gallery visibility.',
      }));
    } finally {
      setSavingIds((current) => current.filter((id) => id !== item.media_asset_id));
    }
  };

  const visibleItems = items.filter((item) => item.is_visible_to_gallery);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gallery-visibility-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 rounded-t-2xl border-b border-msscc-teal-dark bg-msscc-teal-light p-4 sm:p-5">
          <div>
            <p className="mt-2 text-sm text-white/90">
              Select stored images to display for the Gallery-Slideshow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/40 bg-white px-2 py-1 text-sm text-msscc-teal transition-colors hover:bg-msscc-gray-faint focus:outline-none focus:ring-2 focus:ring-msscc-pink-light"
            aria-label="Close gallery manager"
          >
            X
          </button>
        </div>

        {isLoading && <p className="text-sm text-msscc-gray-mid p-2">  Loading…</p>}
        {error && <p className="text-sm text-msscc-danger">{error}</p>}
        {!isLoading && !error && items.length === 0 && (
          <p className="text-sm text-msscc-gray-mid p-2">No stored images found.</p>
        )}

        {!isLoading && !error && items.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3 p-2 sm:grid-cols-3 sm:p-3 lg:grid-cols-4">
              {items.map((item) => {
                const isSaving = savingIds.includes(item.media_asset_id);
                const itemError = itemErrors[item.media_asset_id];
                const isSelected = item.is_visible_to_gallery;

                return (
                  <button
                    key={item.media_asset_id}
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isSaving}
                    onClick={() => toggleGalleryVisibility(item)}
                    className={`group rounded-md border-2 p-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-msscc-pink-light disabled:cursor-wait disabled:opacity-60 ${
                      isSelected
                        ? 'border-msscc-pink bg-msscc-pink-faint ring-2 ring-msscc-pink-light'
                        : 'border-msscc-gray-light hover:border-msscc-pink-light'
                    }`}
                  >
                    <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded border border-msscc-gray-light bg-msscc-gray-faint">
                      {item.file_url ? (
                        <PostImage
                          mediaID={item.media_asset_id}
                          configVariant="thumbnail"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-center text-[10px] text-msscc-gray-mid">No preview</span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs font-medium text-msscc-gray-dark" title={item.file_name}>
                      {item.file_name}
                    </p>
                    <p className="mt-1 text-[10px] text-msscc-gray-mid">
                      {isSaving ? 'Saving…' : isSelected ? 'Selected' : 'Not selected'}
                    </p>
                    {itemError && <p className="mt-1 text-[10px] text-msscc-danger">{itemError}</p>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!isLoading && !error && visibleItems.length > 0 && (
          <div className="mt-1.5 mb-4 rounded-md border border-msscc-gray-light bg-msscc-pink-faint px-3 pb-3 pt-4 sm:px-4 sm:pb-9">
            <p className="mb-2 pb-1 text-sm font-heading text-msscc-pink-dark">Visible in gallery</p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {visibleItems.map((item) => {
                const isSaving = savingIds.includes(item.media_asset_id);
                return (
                  <button
                    key={item.media_asset_id}
                    type="button"
                    onClick={() => toggleGalleryVisibility(item)}
                    disabled={isSaving}
                    className="relative size-20 shrink-0 overflow-hidden rounded-md border-2 border-msscc-pink bg-msscc-gray-faint focus:outline-none focus:ring-2 focus:ring-msscc-pink-light disabled:cursor-wait disabled:opacity-60"
                    aria-label={`Remove ${item.file_name} from gallery`}
                  >
                    {item.file_url ? (
                      <div className="relative size-full">
                        <PostImage
                          mediaID={item.media_asset_id}
                          configVariant="thumbnail"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-msscc-gray-mid">Error: No Image</span>
                    )}
                    <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-msscc-pink text-xs font-semibold text-white">
                      ×
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
