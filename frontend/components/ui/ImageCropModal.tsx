'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropModalProps {
  file: File;
  aspect?: number;
  title?: string;
  /** Called with the cropped file (or the original, if the whole image was kept). */
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

type CornerSign = 1 | -1;

interface Handle {
  corner: string;
  sx: CornerSign;
  sy: CornerSign;
  position: string;
  cursor: string;
  align: string;
}

const HANDLES: Handle[] = [
  {
    corner: 'nw',
    sx: -1,
    sy: -1,
    position: 'left-0 top-0',
    cursor: 'cursor-nwse-resize',
    align: 'items-start justify-start',
  },
  {
    corner: 'ne',
    sx: 1,
    sy: -1,
    position: 'right-0 top-0',
    cursor: 'cursor-nesw-resize',
    align: 'items-start justify-end',
  },
  {
    corner: 'sw',
    sx: -1,
    sy: 1,
    position: 'bottom-0 left-0',
    cursor: 'cursor-nesw-resize',
    align: 'items-end justify-start',
  },
  {
    corner: 'se',
    sx: 1,
    sy: 1,
    position: 'bottom-0 right-0',
    cursor: 'cursor-nwse-resize',
    align: 'items-end justify-end',
  },
];

type DragState =
  | { mode: 'move'; startX: number; startY: number; origin: Crop }
  | { mode: 'resize'; sx: CornerSign; sy: CornerSign; anchorX: number; anchorY: number };

const MAX_OUTPUT_SIDE = 2000;
const MIN_SIZE = 5;
const MIN_FIXED_WIDTH = 10;
const MAX_VIEW_HEIGHT_VH = 50;

const OUTPUT_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 100) / 100;

const roundCrop = (crop: Crop): Crop => {
  const x = round(crop.x);
  const y = round(crop.y);

  return {
    x,
    y,
    width: Math.min(round(crop.width), round(100 - x)),
    height: Math.min(round(crop.height), round(100 - y)),
  };
};

function getInitialCrop(ratio: number | null): Crop {
  if (ratio === null) return { x: 0, y: 0, width: 100, height: 100 };

  const width = Math.min(100, 100 * ratio);
  const height = width / ratio;
  return { x: (100 - width) / 2, y: (100 - height) / 2, width, height };
}

function getOutputName(fileName: string, type: string): string {
  const base =
    fileName
      .replace(/\.[^./\\]+$/, '')
      .replace(/-cropped-\d+$/, '') || 'image';
  return `${base}-cropped-${Date.now()}.${OUTPUT_EXTENSIONS[type]}`;
}

/** Dialog for cropping an image before it is uploaded. */
export default function ImageCropModal({
  file,
  aspect,
  title = 'Crop image',
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const pressStartedOnBackdropRef = useRef(false);

  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  const ratio = aspect && natural ? aspect / (natural.width / natural.height) : null;
  const isFixedShape = Boolean(aspect);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, []);

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
    if (!pointer || !crop) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { mode: 'move', startX: pointer.x, startY: pointer.y, origin: crop };
  };

  const handleResizeStart = (event: PointerEvent<HTMLSpanElement>, handle: Handle) => {
    const pointer = getPointerPercent(event);
    if (!pointer || !crop) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      mode: 'resize',
      sx: handle.sx,
      sy: handle.sy,
      anchorX: handle.sx > 0 ? crop.x : crop.x + crop.width,
      anchorY: handle.sy > 0 ? crop.y : crop.y + crop.height,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const pointer = getPointerPercent(event);
    if (!drag || !pointer) return;

    if (drag.mode === 'move') {
      setCrop(
        roundCrop({
          ...drag.origin,
          x: clamp(drag.origin.x + pointer.x - drag.startX, 0, 100 - drag.origin.width),
          y: clamp(drag.origin.y + pointer.y - drag.startY, 0, 100 - drag.origin.height),
        }),
      );
      return;
    }

    if (ratio === null) {
      const nx =
        drag.sx > 0
          ? clamp(pointer.x, Math.min(drag.anchorX + MIN_SIZE, 100), 100)
          : clamp(pointer.x, 0, Math.max(drag.anchorX - MIN_SIZE, 0));
      const ny =
        drag.sy > 0
          ? clamp(pointer.y, Math.min(drag.anchorY + MIN_SIZE, 100), 100)
          : clamp(pointer.y, 0, Math.max(drag.anchorY - MIN_SIZE, 0));

      setCrop(
        roundCrop({
          x: Math.min(drag.anchorX, nx),
          y: Math.min(drag.anchorY, ny),
          width: Math.abs(nx - drag.anchorX),
          height: Math.abs(ny - drag.anchorY),
        }),
      );
      return;
    }

    const dx = drag.sx * (pointer.x - drag.anchorX);
    const dy = drag.sy * (pointer.y - drag.anchorY);
    const maxWidth = Math.min(
      drag.sx > 0 ? 100 - drag.anchorX : drag.anchorX,
      (drag.sy > 0 ? 100 - drag.anchorY : drag.anchorY) * ratio,
    );
    const width = clamp(Math.max(dx, dy * ratio), Math.min(MIN_FIXED_WIDTH, maxWidth), maxWidth);
    const height = width / ratio;

    setCrop(
      roundCrop({
        x: drag.sx > 0 ? drag.anchorX : drag.anchorX - width,
        y: drag.sy > 0 ? drag.anchorY : drag.anchorY - height,
        width,
        height,
      }),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!crop) return;

    const step = event.shiftKey ? 10 : 1;
    const { x, y, width, height } = crop;
    let next: Crop;

    switch (event.key) {
      case 'ArrowLeft':
        next = { ...crop, x: clamp(x - step, 0, 100 - width) };
        break;
      case 'ArrowRight':
        next = { ...crop, x: clamp(x + step, 0, 100 - width) };
        break;
      case 'ArrowUp':
        next = { ...crop, y: clamp(y - step, 0, 100 - height) };
        break;
      case 'ArrowDown':
        next = { ...crop, y: clamp(y + step, 0, 100 - height) };
        break;
      case '+':
      case '=':
      case '-':
      case '_': {
        const delta = event.key === '+' || event.key === '=' ? step : -step;
        const minWidth = ratio ? MIN_FIXED_WIDTH : MIN_SIZE;
        const maxWidth = ratio ? Math.min(100, 100 * ratio) : 100;
        const nextWidth = clamp(width + delta, Math.min(minWidth, maxWidth), maxWidth);
        const nextHeight = ratio ? nextWidth / ratio : clamp(height + delta, MIN_SIZE, 100);

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
    setCrop(roundCrop(next));
  };

  const handleConfirm = () => {
    const image = imageRef.current;
    if (!image || !natural || !crop) return;

    setError('');
    if (crop.width >= 99.9 && crop.height >= 99.9) {
      onConfirm(file);
      return;
    }

    const sw = Math.max(1, Math.round((crop.width / 100) * natural.width));
    const sh = Math.max(1, Math.round((crop.height / 100) * natural.height));
    const sx = Math.min(Math.round((crop.x / 100) * natural.width), natural.width - sw);
    const sy = Math.min(Math.round((crop.y / 100) * natural.height), natural.height - sh);
    const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(sw, sh));
    const outWidth = Math.max(1, Math.round(sw * scale));
    const outHeight = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext('2d');

    if (!context) {
      setError('This browser could not crop the image. Try "Use original" instead.');
      return;
    }

    context.drawImage(image, sx, sy, sw, sh, 0, 0, outWidth, outHeight);

    const type = file.type in OUTPUT_EXTENSIONS ? file.type : 'image/png';
    setIsWorking(true);
    canvas.toBlob(
      (blob) => {
        setIsWorking(false);
        if (!blob) {
          setError('Could not crop this image. Please try a different one.');
          return;
        }

        onConfirm(new File([blob], getOutputName(file.name, type), { type }));
      },
      type,
      0.92,
    );
  };

  const imageAspect = natural ? natural.width / natural.height : 4 / 3;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="image-crop-title"
      onClose={onCancel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') event.stopPropagation();
      }}
      onPointerDown={(event) => {
        pressStartedOnBackdropRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressStartedOnBackdropRef.current && event.target === event.currentTarget) onCancel();
      }}
      className="m-auto max-h-[90vh] w-[min(92vw,720px)] overflow-y-auto rounded-md border border-msscc-gray-light bg-msscc-white p-0 text-msscc-gray-dark backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 id="image-crop-title" className="font-heading text-heading-2 text-msscc-teal">
            {title}
          </h2>
          <p className="mt-1 text-body-sm text-msscc-gray-mid">
            {isFixedShape
              ? 'Move and resize the box to choose the part to keep. It always stays the same shape.'
              : 'Drag the box to move it. Drag a corner to resize it.'}
          </p>
        </div>

        <div className="flex justify-center">
          <div
            ref={imageBoxRef}
            onPointerMove={handlePointerMove}
            onPointerUp={() => {
              dragRef.current = null;
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            className="relative touch-none select-none overflow-hidden rounded-sm bg-msscc-gray-faint ring-1 ring-msscc-gray-light"
            style={{
              aspectRatio: `${natural?.width ?? 4} / ${natural?.height ?? 3}`,
              width: `min(100%, ${MAX_VIEW_HEIGHT_VH * imageAspect}vh)`,
            }}
          >
            {url && (
              // A picked file uses a local preview URL, which next/image does not optimize.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imageRef}
                src={url}
                alt="Image to crop"
                draggable={false}
                onLoad={(event) => {
                  const { naturalWidth, naturalHeight } = event.currentTarget;
                  if (naturalWidth && naturalHeight) {
                    setNatural({ width: naturalWidth, height: naturalHeight });
                    setCrop(
                      getInitialCrop(aspect ? aspect / (naturalWidth / naturalHeight) : null),
                    );
                  }
                }}
                className="pointer-events-none block h-full w-full"
              />
            )}

            {crop && (
              <div
                role="group"
                tabIndex={0}
                aria-label="Crop area. Use the arrow keys to move it, and plus or minus to resize it."
                onPointerDown={handleMoveStart}
                onKeyDown={handleKeyDown}
                className="absolute cursor-move border-2 border-white focus:outline-none focus-visible:border-msscc-teal"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                }}
              >
                {HANDLES.map((handle) => (
                  <span
                    key={handle.corner}
                    aria-hidden="true"
                    onPointerDown={(event) => handleResizeStart(event, handle)}
                    className={`absolute flex ${handle.position} ${handle.cursor} ${handle.align}`}
                    style={{ width: 'min(2rem, 45%)', height: 'min(2rem, 45%)' }}
                  >
                    <span
                      className="border-2 border-msscc-teal bg-white"
                      style={{ width: 'min(0.875rem, 100%)', height: 'min(0.875rem, 100%)' }}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <p role="alert" className="text-body-sm text-msscc-danger">{error}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-msscc-gray-light pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => crop && setCrop(getInitialCrop(ratio))}
            className="self-start text-caption text-msscc-teal underline"
          >
            Reset
          </button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-sm border border-msscc-gray-light px-5 py-2 text-btn tracking-btn text-msscc-gray-dark transition-colors hover:border-msscc-teal"
            >
              Cancel
            </button>
            {!isFixedShape && (
              <button
                type="button"
                onClick={() => onConfirm(file)}
                className="rounded-sm border border-msscc-teal px-5 py-2 text-btn tracking-btn text-msscc-teal transition-colors hover:bg-msscc-gray-faint"
              >
                Use original
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!crop || isWorking}
              className="rounded-sm bg-msscc-pink px-5 py-2 text-btn tracking-btn text-white transition-colors hover:bg-msscc-pink-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isWorking ? 'Cropping...' : 'Apply crop'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}