//Take id from table Static image and display the image in the post.
// This is for static images that are never duplicated into other object instances and are used in multiple places across the site,
// such as background images, icons, or decorative elements.

'use client';

import React, { useEffect, useState } from "react";
import PostImage from "./PostImage";
import { SelectedConfig } from "./ImageConfiguration";

type StaticImageItem = {
  static_image_id: number;
  label : string;
  media_asset: number;
};

async function fetchStaticImageById(id: number): Promise<StaticImageItem> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/static-images/${id}/`);

  if (!response.ok) {
    throw new Error(`Failed to load static object from API.`);
  }

  return response.json() as Promise<StaticImageItem>;
}

type PostStaticMediaProps = {
  staticImageId: number;
  className?: string;
  configVariant?: SelectedConfig;
};

export default function PostStaticMedia({ staticImageId, className , configVariant }: PostStaticMediaProps) {
  const placeholder = 0; // ID of a default placeholder static image to use when no valid ID is provided
  const [staticImage, setStaticImage] = useState<StaticImageItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const fetchedId = staticImageId || placeholder; // Use provided ID or fallback to placeholder
    const fetchStaticObject = async () => {
      setError(null);
      setIsLoading(true);
      try {
        const staticObject = await fetchStaticImageById(fetchedId);
        setStaticImage(staticObject);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Static Retrieval Error');
        setStaticImage(null);
      } finally {
        setIsLoading(false);
      }

    };

    fetchStaticObject();
  }, [staticImageId]);

  if (isLoading) {
    return <div>Loading.</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!staticImage) {
    return <div>No media asset associated with this static image.</div>;
  }

  return (
    <PostImage mediaID={staticImage.media_asset} className={className} configVariant={configVariant} />
  );
}
