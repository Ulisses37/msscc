'use client';

import React, { useEffect, useState } from "react";

type ImageItem = {
  media_asset_id: number;
  file_key: string | null;
  file_url: string | null;
  file_name: string;
  file_type: string;
  alt_text: string;
  created_at: string;
};

async function fetchImageById(id: number): Promise<ImageItem> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/media/${id}/`);

  if (!response.ok) {
    throw new Error(`Failed to load image.`);
  }

  return response.json() as Promise<ImageItem>;
}

type PostImageProps = {
  mediaID: number;
  className?: string;
};

export default function PostImage({ mediaID, className }: PostImageProps) {
  const [image, setImage] = useState<ImageItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaID) return;

    const fetchImage = async () => {
      setError(null);
      setIsLoading(true);

      try {
        const item = await fetchImageById(mediaID);
        setImage(item);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load image.');
        setImage(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();
  }, [mediaID]);

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
    <img
      src={image.file_url}
      alt={image.alt_text || image.file_name}
      className={className ?? "w-auto h-auto"}
    />
  );
}

