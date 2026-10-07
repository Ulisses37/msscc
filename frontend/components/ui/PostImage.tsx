'use client';

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageLayout, SelectedConfig } from "./ImageConfiguration";

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

// A cache that maps the media asset ID to the media asset's information
const imageCache = new Map<number, ImageItem>();

async function fetchImageById(id: number, forceRefresh = false): Promise<ImageItem> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/${id}/`, {
    cache: forceRefresh ? 'no-store' : 'default',
  });

  if (!response.ok) {
    throw new Error(`Failed to load image.`);
  }

  return response.json() as Promise<ImageItem>;
}

type PostImageProps = {
  mediaID: number;
  className?: string;
  configVariant?: SelectedConfig;
  refreshKey?: number;
};

export default function PostImage({ mediaID, className, configVariant, refreshKey = 0 }: PostImageProps) {
  const [image, setImage] = useState<ImageItem | null>(() => imageCache.get(mediaID) ?? null,);
  const [isLoading, setIsLoading] = useState(() => !imageCache.has(mediaID),);
  const [error, setError] = useState<string | null>(null);
  const previousRefreshKey = useRef(refreshKey);
  const layout = configVariant ? ImageLayout[configVariant] : ImageLayout.content; // Default to 'content' layout if no config provided

  useEffect(() => {
    if (!mediaID) return;

    const shouldRefresh = previousRefreshKey.current !== refreshKey;
    previousRefreshKey.current = refreshKey;

    if (shouldRefresh) {
      imageCache.delete(mediaID);
    }

    const cachedImage = imageCache.get(mediaID);

    // Set cached image and skip loading
    if (cachedImage) {
      setError(null);
      setImage(cachedImage);
      setIsLoading(false);
      return;
    }

    const fetchImage = async () => {
      setError(null);
      setIsLoading(true);

      try {
        const item = await fetchImageById(mediaID, shouldRefresh);
        imageCache.set(mediaID, item);
        setImage(item);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load image.');
        setImage(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [mediaID, refreshKey]);

  if (isLoading) {
    return <div>Loading…</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (!image || !image.file_url) {
    return null;
  }

  return (
    <Image
      src={image.file_url}
      alt={image.alt_text_en || image.file_name}
      fill={layout.mode === "fill"}
      width={layout.mode !== "fill" ? layout.width : undefined}
      height={layout.mode !== "fill" ? layout.height : undefined}
      className={className ? className : layout.imageClassName}
    />
  );
}

