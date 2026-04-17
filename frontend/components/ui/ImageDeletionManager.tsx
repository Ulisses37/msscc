'use client';

import React, { useCallback, useEffect, useState } from "react";

type ImageItem = {
  media_asset_id: number;
  file_key: string | null;
  file_url: string | null;
  file_name: string;
  file_type: string;
  alt_text: string;
  created_at: string;
};

{/** Allows for Exiting UI*/}
type ImageDeletionManagerProps = {
  onClose: () => void;
};

export function ImageDeletionManager({ onClose }: ImageDeletionManagerProps) {
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

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

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected image item(s)? This cannot be undone.`
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete selected image items.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-sm text-slate-600">Select stored image items from the database.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            X
          </button>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={handleDelete}
              disabled={selectedIds.length === 0 || isDeleting || isLoading}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400"
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
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="px-4 py-3">Select</th>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Upload Date</th>
                </tr>
              </thead>
              <tbody>
                {imageItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      {isLoading ? 'Loading images…' : 'No stored images found.'}
                    </td>
                  </tr>
                ) :

                (imageItems.map((item) => (
                    <tr key={item.media_asset_id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.media_asset_id)}
                          onChange={() => toggleSelection(item.media_asset_id)}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900"
                        />
                      </td>
                      <td className="px-4 py-3">{item.file_name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}

              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
