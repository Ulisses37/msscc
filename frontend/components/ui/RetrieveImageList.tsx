//Retrieve image list for preview
//Accept Modeltype for backend routing
'use client';

import React, { useEffect, useState } from "react";
import PostImage from "./PostImage";

type ModelType = "events" | "board-members" | "partners";

type ImageRecord = {
  id: number;
  media_asset_id: number | null;
  file_url: string | null;
  display_name?: string;
  title?: string;
};

type RetrieveImageListProps = {
  modelType: ModelType | null;
};

const MODEL_API_ENDPOINTS: Record<ModelType, string> = {
  "events": `${process.env.NEXT_PUBLIC_API_URL}/api/events/`,
  "board-members": `${process.env.NEXT_PUBLIC_API_URL}/api/board-members/`,
  "partners": `${process.env.NEXT_PUBLIC_API_URL}/api/partners/`,
};

export function RetrieveImageList({ modelType }: RetrieveImageListProps) {
  const [imageRecords, setImageRecords] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // When null, clear records and show nothing
    if (modelType === null) {
      setImageRecords([]);
      setError(null);
      return;
    }

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

  // When null, show nothing
  if (modelType === null) {
    return null;
  }

  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading images…</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">Error: {error}</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {imageRecords.map((record) => (
        <div key={record.id} className="border rounded p-3">
          <p className="text-sm font-medium mb-2">
            {record.title || record.display_name || `ID: ${record.id}`}
          </p>
          {record.media_asset_id ? (
            <PostImage mediaID={record.media_asset_id} />
          ) : (
            <div className="w-[300px] h-[300px] flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
              No image available
            </div>
          )}
        </div>
      ))}
      {imageRecords.length === 0 && !isLoading && (
        <p className="col-span-2 text-sm text-slate-500">No images found.</p>
      )}
    </div>
  );
}


