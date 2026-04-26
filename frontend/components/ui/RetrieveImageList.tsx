'use client';

import React, { useEffect, useState } from "react";
import PostImage from "./PostImage";

type ModelType = "media" | "events" | "board-members" | "partners" | "static-images";

type ImageRecord = {
  id: number;
  media_asset_id: number | null;
  file_url: string | null;
  display_name?: string;
  title?: string;
};

type RetrieveImageListProps = {
  modelType: ModelType | null;
  onSelect?: (mediaAssetId: number, modelId: number) => void;
  selectedId?: number | null;
  selectedModelId?: number | null;
};

const MODEL_API_ENDPOINTS: Record<ModelType, string> = {
  "events": `${process.env.NEXT_PUBLIC_API_URL}/api/events/`,
  "board-members": `${process.env.NEXT_PUBLIC_API_URL}/api/board-members/`,
  "partners": `${process.env.NEXT_PUBLIC_API_URL}/api/partners/`,
  "media": `${process.env.NEXT_PUBLIC_API_URL}/api/media/`,
  "static-images": `${process.env.NEXT_PUBLIC_API_URL}/api/static-images/`,
};

export function RetrieveImageList({ modelType, onSelect, selectedId, selectedModelId }: RetrieveImageListProps) {
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
          if (modelType === "media") {
            return {
              id: record.media_asset_id as number,
              media_asset_id: record.media_asset_id as number,
              file_url: record.file_url ?? null,
              display_name: record.file_name as string | undefined,
            };
          }

          // Other models: events, board-members, partners, static-images
          const id = modelType === "events" ? (record.event_id as number) :
                     modelType === "board-members" ? (record.board_member_id as number) :
                     modelType === "partners" ? (record.partner_id as number) :
                     (record.static_image_id as number);

          return {
            id,
            media_asset_id: record.media_asset as number | null,
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

  /* List for Clarity, Provides Objects given a ModelType */
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {imageRecords.map((record) => {
        const mediaAssetId = record.media_asset_id ?? 0;
        const isSelected = selectedId === mediaAssetId;
        const isModel = selectedModelId === record.id;

        // Recursively render image from model's media_asset_id
        return (
          <div //Have Section decide Highlights from User Select
            key={record.id}
            className={`flex flex-col
            border rounded-lg
            overflow-hidden
            cursor-pointer
            transition-all
            bg-white
            h-full ${
              (isSelected && isModel) || (isSelected && modelType === "media")
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:ring-1 hover:ring-slate-300'
            }`}
            onClick={() => onSelect?.(mediaAssetId, record.id)}
          >
            {/* Grid items populates here begins here*/}
            <div className="p-3 pb-2">
              <p className="text-sm font-medium truncate">
                {record.title || record.display_name || `ID: ${record.id}`}
              </p>
            </div>

            <div className="px-3 pb-3 flex-1">
              <div className="w-full aspect-square bg-slate-100 rounded flex items-center justify-center overflow-hidden">
                {record.media_asset_id ? (
                  <PostImage
                    mediaID={mediaAssetId}
                    configVariant="thumbnail"
                  />
                ) : (
                  <div className="text-slate-500 text-sm text-center px-4">
                    No image available
                  </div>
                )}
              </div>
            </div>

          </div>
        );
      })}
      {imageRecords.length === 0 && !isLoading && (
        <p className="col-span-full text-sm text-slate-500">No images found.</p>
      )}
    </div>
  );
}
