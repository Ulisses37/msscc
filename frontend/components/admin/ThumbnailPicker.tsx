'use client';

import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import {
  CARD_IMAGE_RATIO,
  FULL_CROP,
  fitCropToRatio,
  getCropImageStyle,
} from '@/utils/thumbnailCrop';
import type { ThumbnailCrop } from '@/utils/thumbnailCrop';

interface ThumbnailPickerProps {
  imageUrl: string | null;
  crop: ThumbnailCrop;
  onChange: (crop: ThumbnailCrop) => void;
}

// Smallest crop allowed, as a percent of the image width.
const MIN_CROP_WIDTH = 20;

type CornerSign = 1 | -1;

interface Handle {
  corner: string;
  // Which way the corner sits from the opposite corner (+1 = right/below)
  sx: CornerSign;
  sy: CornerSign;
  position: string;
  cursor: string;
  align: string;
}

const HANDLES: Handle[] = [
  { corner: 'nw', sx: -1, sy: -1, position: 'left-0 top-0', cursor: 'cursor-nwse-resize', align: 'items-start justify-start' },
  { corner: 'ne', sx: 1, sy: -1, position: 'right-0 top-0', cursor: 'cursor-nesw-resize', align: 'items-start justify-end' },
  { corner: 'sw', sx: -1, sy: 1, position: 'bottom-0 left-0', cursor: 'cursor-nesw-resize', align: 'items-end justify-start' },
  { corner: 'se', sx: 1, sy: 1, position: 'bottom-0 right-0', cursor: 'cursor-nwse-resize', align: 'items-end justify-end' },
];

type DragState =
  | { mode: 'move'; startX: number; startY: number; origin: ThumbnailCrop }
  | { mode: 'resize'; sx: CornerSign; sy: CornerSign; anchorX: number; anchorY: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 100) / 100;

// Round for saving, without letting rounding push the crop past the image edge.
const roundCrop = (crop: ThumbnailCrop): ThumbnailCrop => {
  const x = round(crop.x);
  const y = round(crop.y);

  return {
    x,
    y,
    width: Math.min(round(crop.width), round(100 - x)),
    height: Math.min(round(crop.height), round(100 - y)),
  };
};

/**
 * Lets an admin choose which part of the uploaded image shows on the event
 * card: drag the box to move it, drag a corner to resize it. The box keeps the
 * card's proportions, and a live preview shows the result.
 */
export default function ThumbnailPicker({ imageUrl, crop, onChange }: ThumbnailPickerProps) {
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  // Remember which image the aspect belongs to, so a new image never reuses an old ratio.
  const [loadedImage, setLoadedImage] = useState<{ url: string; aspect: number } | null>(null);
  const imageAspect = loadedImage && loadedImage.url === imageUrl ? loadedImage.aspect : null;
  // Very tall images get a minimum width so the crop box is big enough to use.
  const isTall = imageAspect !== null && imageAspect < 0.5;

  // The crop as actually shown: the stored crop reshaped to the card's proportions.
  const displayCrop = imageAspect ? fitCropToRatio(crop, imageAspect) : null;
  // Width divided by height of a card-shaped crop, in percent of the image.
  const ratio = imageAspect ? CARD_IMAGE_RATIO / imageAspect : null;

  // Pointer position as a percentage of the displayed image.
  const getPointerPercent = (event: PointerEvent<HTMLElement>) => {
    const rect = imageBoxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
    };
  };

  const handleMoveStart = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = getPointerPercent(event);
    if (!pointer || !displayCrop) return;

    // Capture keeps the drag going even if the pointer leaves the box.
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: 'move',
      startX: pointer.x,
      startY: pointer.y,
      origin: displayCrop,
    };
  };

  const handleResizeStart = (event: PointerEvent<HTMLSpanElement>, handle: Handle) => {
    const pointer = getPointerPercent(event);
    if (!pointer || !displayCrop) return;

    // Don't also start a move
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: 'resize',
      sx: handle.sx,
      sy: handle.sy,
      // The opposite corner stays fixed while this corner moves.
      anchorX: handle.sx > 0 ? displayCrop.x : displayCrop.x + displayCrop.width,
      anchorY: handle.sy > 0 ? displayCrop.y : displayCrop.y + displayCrop.height,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const pointer = getPointerPercent(event);
    if (!drag || !pointer || !ratio) return;

    if (drag.mode === 'move') {
      onChange(
        roundCrop({
          ...drag.origin,
          x: clamp(drag.origin.x + pointer.x - drag.startX, 0, 100 - drag.origin.width),
          y: clamp(drag.origin.y + pointer.y - drag.startY, 0, 100 - drag.origin.height),
        }),
      );
      return;
    }

    // Resize: the card's proportions are locked, so the width decides the height.
    const dx = drag.sx * (pointer.x - drag.anchorX);
    const dy = drag.sy * (pointer.y - drag.anchorY);
    const maxWidth = Math.min(
      drag.sx > 0 ? 100 - drag.anchorX : drag.anchorX,
      (drag.sy > 0 ? 100 - drag.anchorY : drag.anchorY) * ratio,
    );
    const width = clamp(
      Math.max(dx, dy * ratio),
      Math.min(MIN_CROP_WIDTH, maxWidth),
      maxWidth,
    );
    const height = width / ratio;

    onChange(
      roundCrop({
        x: drag.sx > 0 ? drag.anchorX : drag.anchorX - width,
        y: drag.sy > 0 ? drag.anchorY : drag.anchorY - height,
        width,
        height,
      }),
    );
  };

  const handlePointerEnd = () => {
    dragRef.current = null;
  };

  // Arrow keys move the box, + and - resize it. Shift makes the steps bigger.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!displayCrop || !ratio) return;

    const step = event.shiftKey ? 10 : 1;
    const { x, y, width, height } = displayCrop;
    let next: ThumbnailCrop;

    switch (event.key) {
      case 'ArrowLeft':
        next = { ...displayCrop, x: clamp(x - step, 0, 100 - width) };
        break;
      case 'ArrowRight':
        next = { ...displayCrop, x: clamp(x + step, 0, 100 - width) };
        break;
      case 'ArrowUp':
        next = { ...displayCrop, y: clamp(y - step, 0, 100 - height) };
        break;
      case 'ArrowDown':
        next = { ...displayCrop, y: clamp(y + step, 0, 100 - height) };
        break;
      case '+':
      case '=':
      case '-':
      case '_': {
        // Resize around the center, keeping the card's proportions.
        const grows = event.key === '+' || event.key === '=';
        const maxWidth = Math.min(100, 100 * ratio);
        const nextWidth = clamp(
          width + (grows ? step : -step),
          Math.min(MIN_CROP_WIDTH, maxWidth),
          maxWidth,
        );
        const nextHeight = nextWidth / ratio;

        next = {
          x: clamp(x + width / 2 - nextWidth / 2, 0, 100 - nextWidth),
          y: clamp(y + height / 2 - nextHeight / 2, 0, 100 - nextHeight),
          width: nextWidth,
          height: nextHeight,
        };
        break;
      }
      default:
        return;
    }

    event.preventDefault();
    onChange(roundCrop(next));
  };

  if (!imageUrl) {
    return (
      <p className="text-body-sm text-msscc-gray-mid">
        Upload an image to choose which part shows on the event card.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      {/* Crop area: drag the box to move it, drag a corner to resize it */}
      <div>
        <p className="mb-2 text-eyebrow uppercase tracking-eyebrow text-msscc-gray-mid">
          Thumbnail crop
        </p>

        <div className="max-h-[60vh] overflow-y-auto">
        <div
          ref={imageBoxRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          // touch-none stops the page scrolling while a finger drags on the image
          className="relative inline-block max-w-full touch-none select-none overflow-hidden rounded-sm border border-msscc-gray-light"
        >
          {/* A plain img is used because the picked file is a local preview URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Uploaded event image"
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth && naturalHeight && imageUrl) {
                const aspect = naturalWidth / naturalHeight;
                setLoadedImage({ url: imageUrl, aspect });

                // ── START NEW ──
                // Store the crop the way it is shown, so what is saved matches the preview.
                const fitted = roundCrop(fitCropToRatio(crop, aspect));
                const differs =
                  Math.abs(fitted.x - crop.x) > 0.01 ||
                  Math.abs(fitted.y - crop.y) > 0.01 ||
                  Math.abs(fitted.width - crop.width) > 0.01 ||
                  Math.abs(fitted.height - crop.height) > 0.01;
                if (differs) onChange(fitted);
                // ── END NEW ──
              }
            }}
            className={`pointer-events-none block h-auto max-w-full ${
              isTall ? 'w-[220px]' : 'max-h-[360px] w-auto'
            }`}
          />

          {displayCrop && (
            <div
              role="group"
              tabIndex={0}
              aria-label="Crop area. Use the arrow keys to move it, and plus or minus to resize it."
              onPointerDown={handleMoveStart}
              onKeyDown={handleKeyDown}
              className="absolute cursor-move border-2 border-white focus:outline-none focus-visible:border-msscc-teal"
              style={{
                left: `${displayCrop.x}%`,
                top: `${displayCrop.y}%`,
                width: `${displayCrop.width}%`,
                height: `${displayCrop.height}%`,
                // Darkens everything outside the crop box
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              }}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle.corner}
                  aria-hidden="true"
                  onPointerDown={(event) => handleResizeStart(event, handle)}
                  className={`absolute flex h-8 w-8 ${handle.position} ${handle.cursor} ${handle.align}`}
                  // Full size on normal boxes, but never more than 45% of a small one
                  style={{ width: 'min(2rem, 45%)', height: 'min(2rem, 45%)' }}
                >
                  <span
                    className="h-3.5 w-3.5 border-2 border-msscc-teal bg-white"
                    style={{ width: 'min(0.875rem, 100%)', height: 'min(0.875rem, 100%)' }}
                  />
                </span>
              ))}
            </div>
          )}
        </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-caption text-msscc-gray-mid">
            Drag the box to move it. Drag a corner to resize it.
          </p>
          <button
            type="button"
            onClick={() => onChange(FULL_CROP)}
            className="text-caption text-msscc-teal underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Live preview of the card-sized crop */}
      <div className="w-full max-w-[400px]">
        <p className="mb-2 text-eyebrow uppercase tracking-eyebrow text-msscc-gray-mid">
          Card preview
        </p>

        <div
          className="w-full overflow-hidden rounded-sm border border-msscc-gray-light bg-msscc-gray-faint"
          style={{ aspectRatio: CARD_IMAGE_RATIO }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Event card preview"
            className="h-full w-full"
            style={getCropImageStyle(displayCrop ?? FULL_CROP)}
          />
        </div>
      </div>
    </div>
  );
}
