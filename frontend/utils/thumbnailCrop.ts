import type { CSSProperties } from 'react';

/** A crop rectangle, as percentages (0-100) of the image's width and height. */
export interface ThumbnailCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The event card's image box on desktop: 400px wide by 264px tall.
export const CARD_IMAGE_RATIO = 400 / 264;

// The whole image. With object-fit: cover the card then shows a centered crop, as it does today.
export const FULL_CROP: ThumbnailCrop = { x: 0, y: 0, width: 100, height: 100 };

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

/** Force a crop to stay inside the image: finite numbers, 1–100% size, never past an edge. */
export function sanitizeCrop(crop: ThumbnailCrop): ThumbnailCrop {
  const width = Number.isFinite(crop.width) ? clamp(crop.width, 1, 100) : 100;
  const height = Number.isFinite(crop.height) ? clamp(crop.height, 1, 100) : 100;
  return {
    x: clamp(crop.x, 0, 100 - width),
    y: clamp(crop.y, 0, 100 - height),
    width,
    height,
  };
}

/** Styles that make an <img> show only the crop, filling its box. */
export function getCropImageStyle(rawCrop: ThumbnailCrop): CSSProperties {
  const crop = sanitizeCrop(rawCrop);
  const right = 100 - (crop.x + crop.width);
  const bottom = 100 - (crop.y + crop.height);

  return {
    objectFit: 'cover',
    objectViewBox: `inset(${crop.y}% ${right}% ${bottom}% ${crop.x}%)`,
  } as CSSProperties;
}

/**
 * Reshapes a crop to the card's proportions: the largest card-shaped
 * rectangle that fits inside it, centered. This is what the card shows.
 */
export function fitCropToRatio(crop: ThumbnailCrop, imageAspect: number): ThumbnailCrop {
  // An image that hasn't loaded (or has no size) gives a bad ratio, so leave the crop alone.
  if (!Number.isFinite(imageAspect) || imageAspect <= 0 || crop.width <= 0 || crop.height <= 0) {
    return sanitizeCrop(crop);
  }
  // Width divided by height of a card-shaped crop, measured in percent of the image.
  const ratio = CARD_IMAGE_RATIO / imageAspect;

  if (crop.width / crop.height > ratio) {
    const width = crop.height * ratio;
    return { ...crop, x: crop.x + (crop.width - width) / 2, width };
  }

  const height = crop.width / ratio;
  return { ...crop, y: crop.y + (crop.height - height) / 2, height };
}
