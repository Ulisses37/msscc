'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { getCropImageStyle, sanitizeCrop } from '@/utils/thumbnailCrop';
import type { ThumbnailCrop } from '@/utils/thumbnailCrop';

interface CroppedImageProps {
  src: string;
  alt: string;
  crop: ThumbnailCrop;
  /** Same meaning as next/image `sizes`: the box's width at each breakpoint. */
  sizes: string;
}

// Firefox does not support object-view-box. If we cannot tell, assume it works.
function supportsObjectViewBox(): boolean {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return true;
  return CSS.supports('object-view-box', 'inset(0)');
}

// Largest part of the crop that has the box's proportions, centered.
// This matches what object-fit: cover does inside object-view-box.
function fitToBox(crop: ThumbnailCrop, imageAspect: number, boxRatio: number): ThumbnailCrop {
  const ratio = boxRatio / imageAspect;

  if (crop.width / crop.height > ratio) {
    const width = crop.height * ratio;
    return { ...crop, x: crop.x + (crop.width - width) / 2, width };
  }

  const height = crop.width / ratio;
  return { ...crop, y: crop.y + (crop.height - height) / 2, height };
}

/**
 * Shows only the cropped part of an image, filling its positioned parent.
 * Chrome and Safari use object-view-box. Firefox gets the same result by
 * scaling and offsetting the image inside a clipped box.
 */
export default function CroppedImage({ src, alt, crop, sizes }: CroppedImageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Start true so the server and first client render match.
  const [viewBoxSupported, setViewBoxSupported] = useState(true);
  const [boxRatio, setBoxRatio] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<{ src: string; aspect: number } | null>(null);

  useEffect(() => {
    setViewBoxSupported(supportsObjectViewBox());
  }, []);

  // Only the fallback needs the box's shape.
  useEffect(() => {
    if (viewBoxSupported) return;
    const box = boxRef.current;
    if (!box) return;

    const measure = () => {
      const { width, height } = box.getBoundingClientRect();
      if (width > 0 && height > 0) setBoxRatio(width / height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [viewBoxSupported]);

  let style: CSSProperties;
  let imageSizes = sizes;

  if (viewBoxSupported) {
    style = {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      ...getCropImageStyle(crop),
    };
  } else {
    const aspect = loaded && loaded.src === src ? loaded.aspect : null;
    const base = sanitizeCrop(crop);
    const ready = aspect !== null && boxRatio !== null;
    const shown = ready ? fitToBox(base, aspect, boxRatio) : base;

    style = {
      position: 'absolute',
      objectFit: 'fill',
      maxWidth: 'none',
      width: `${10000 / shown.width}%`,
      height: `${10000 / shown.height}%`,
      left: `${(-shown.x * 100) / shown.width}%`,
      top: `${(-shown.y * 100) / shown.height}%`,
      // Hidden until the sizes are known, so there is no flash of the wrong crop.
      visibility: ready ? 'visible' : 'hidden',
    };
    // The image is drawn larger than its box when cropped, so ask for a bigger file.
    imageSizes = '100vw';
  }

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      {/* width/height only tell Next the image's shape. The style below sets the real size. */}
      <Image
        src={src}
        alt={alt}
        width={1600}
        height={1600}
        sizes={imageSizes}
        style={style}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth && naturalHeight) {
            setLoaded({ src, aspect: naturalWidth / naturalHeight });
          }
        }}
      />
    </div>
  );
}