//Retrieve image list for preview
//Accept Modeltype for backend routing
'use client';

import React, { useEffect, useState } from "react";

type ModelType = "media" | "events" | "board-members" | "partners";

type ImageRecord = {
  id: number;
  media_asset_id: number | null;
  file_url: string | null;
  display_name?: string;
  title?: string;
};

type RetrieveImageListProps = {
  modelType: ModelType;
};

const MODEL_API_ENDPOINTS: Record<ModelType, string> = {
  "media": `${process.env.NEXT_PUBLIC_API_URL}/api/media/`,
  "events": `${process.env.NEXT_PUBLIC_API_URL}/api/events/`,
  "board-members": `${process.env.NEXT_PUBLIC_API_URL}/api/board-members/`,
  "partners": `${process.env.NEXT_PUBLIC_API_URL}/api/partners/`,
};

export function RetrieveImageList({ modelType }: RetrieveImageListProps) {
  const [imageRecords, setImageRecords] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImageRecords = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const endpoint = MODEL_API_ENDPOINTS[modelType];
        const response = await fetch(endpoint);

        if (!response.ok) {
          throw new Error('Failed to load image list.');
        }

        const data = await response.json();

        // Map records based on model type
        const mapped: ImageRecord[] = data.map((record: Record<string, unknown>) => {
          const id = modelType === "events" ? (record.event_id as number) :
                     modelType === "board-members" ? (record.board_member_id as number) :
                     modelType === "partners" ? (record.partner_id as number) :
                     (record.media_asset_id as number);

          // For media model, use file_url directly
          // For other models, we need to fetch the media_asset_id
          if (modelType === "media") {
            return {
              id,
              media_asset_id: record.media_asset_id as number | null,
              file_url: record.file_url as string | null,
              display_name: record.file_name as string | undefined,
            };
          }

          return {
            id,
            media_asset_id: record.media_asset as number | null,
            file_url: null,
            display_name: record.display_name as string | undefined,
            title: record.title as string | undefined,
          };
        });

        setImageRecords(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load images.');
      } finally {
        setIsLoading(false);
      }
    };

    if (modelType) {
      fetchImageRecords();
    }
  }, [modelType]);

  if (isLoading) {
    return <div className="p-4 text-sm text-slate-500">Loading images…</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {imageRecords.map((record) => (
        <div key={record.id} className="border rounded p-3">
          <p className="text-sm font-medium mb-2">
            {record.title || record.display_name || `ID: ${record.id}`}
          </p>
          {record.file_url ? (
            <img
              src={record.file_url}
              alt={record.display_name || record.title || 'Image'}
              className="max-w-full h-auto rounded"
            />
          ) : record.media_asset_id ? (
            <p className="text-xs text-slate-400">
              Media Asset ID: {record.media_asset_id}
            </p>
          ) : (
            <p className="text-xs text-slate-400">No image</p>
          )}
        </div>
      ))}
      {imageRecords.length === 0 && !isLoading && (
        <p className="col-span-2 text-sm text-slate-500">No images found.</p>
      )}
    </div>
  );
}


