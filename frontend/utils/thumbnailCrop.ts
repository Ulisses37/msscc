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

/** Styles that make an <img> show only the crop, filling its box. */
export function getCropImageStyle(crop: ThumbnailCrop): CSSProperties {
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
  // Width divided by height of a card-shaped crop, measured in percent of the image.
  const ratio = CARD_IMAGE_RATIO / imageAspect;

  if (crop.width / crop.height > ratio) {
    const width = crop.height * ratio;
    return { ...crop, x: crop.x + (crop.width - width) / 2, width };
  }

  const height = crop.width / ratio;
  return { ...crop, y: crop.y + (crop.height - height) / 2, height };
}
