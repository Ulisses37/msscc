'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type GalleryImage = {
  media_asset_id: number;
  file_url: string | null;
  file_name: string;
  file_type?: string;
  alt_text_en?: string;
};

const DISPLAY_TIME_MS = 8000;
const FADE_TIME_MS = 1000;

export default function GalleryBackground() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioningFrom, setTransitioningFrom] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadGallery = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/media/?is_visible_to_gallery=true`,
          { cache: 'no-store', signal: controller.signal },
        );

        if (!response.ok) return;

        const galleryImages = (await response.json() as GalleryImage[])
          .filter((image) => image.file_url);
        setImages(galleryImages);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // The normal page background is the fallback when the gallery is unavailable.
      }
    };

    loadGallery();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || images.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => {
        setTransitioningFrom(currentIndex);
        return (currentIndex + 1) % images.length;
      });
    }, DISPLAY_TIME_MS);

    return () => window.clearInterval(timer);
  }, [images.length, prefersReducedMotion]);

  useEffect(() => {
    if (transitioningFrom === null) return;

    const timer = window.setTimeout(() => setTransitioningFrom(null), FADE_TIME_MS);
    return () => window.clearTimeout(timer);
  }, [transitioningFrom]);

  if (images.length === 0) return null;

  const activeImage = images[activeIndex];
  const previousImage = transitioningFrom === null ? null : images[transitioningFrom];
  const isJfif = (image: GalleryImage) =>
    image.file_type?.toLowerCase() === 'image/jfif' || /\.jfif$/i.test(image.file_name);

  const changeImage = (direction: -1 | 1) => {
    setActiveIndex((currentIndex) => {
      setTransitioningFrom(currentIndex);
      return (currentIndex + direction + images.length) % images.length;
    });
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-1/2 z-0 h-[80vh] min-h-[240px] max-h-[680px] -translate-y-1/2 overflow-hidden opacity-[0.18] blur-[1px]"
      >
        {previousImage && !prefersReducedMotion && (
          <Image
            key={`gallery-previous-${previousImage.media_asset_id}`}
            src={previousImage.file_url as string}
            alt=""
            fill
            unoptimized={isJfif(previousImage)}
            sizes="100vw"
            className="object-cover animate-gallery-fade-out"
          />
        )}

        <Image
          key={`gallery-active-${activeImage.media_asset_id}`}
          src={activeImage.file_url as string}
          alt=""
          fill
          unoptimized={isJfif(activeImage)}
          priority={activeIndex === 0}
          sizes="100vw"
          className={`object-cover ${
            previousImage && !prefersReducedMotion ? 'animate-gallery-fade-in' : ''
          }`}
        />

        <div className="absolute inset-0 bg-white/35" />
      </div>

      {images.length > 1 && (
        <div
          className="fixed bottom-8 right-4 z-20 flex flex-col items-center rounded-full border border-msscc-teal/20 bg-white/60 p-0.5 shadow-sm backdrop-blur-sm"
        >
          <span className="px-2 pt-0.5 text-center text-[9px] leading-none text-msscc-teal/70">
            Background Gallery
          </span>
          <div
            role="group"
            aria-label="Gallery controls"
            className="flex items-center gap-0.5"
          >
            <button
              type="button"
              onClick={() => changeImage(-1)}
              className="flex size-7 items-center justify-center rounded-full text-base leading-none text-msscc-teal transition-colors hover:bg-msscc-teal/10 focus:outline-none focus:ring-2 focus:ring-msscc-teal/30"
              aria-label="Show previous gallery image"
            >
              ‹
            </button>
            <span
              className="min-w-8 px-0.5 text-center text-[10px] tabular-nums text-msscc-teal/75"
              aria-live="polite"
            >
              {activeIndex + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={() => changeImage(1)}
              className="flex size-7 items-center justify-center rounded-full text-base leading-none text-msscc-teal transition-colors hover:bg-msscc-teal/10 focus:outline-none focus:ring-2 focus:ring-msscc-teal/30"
              aria-label="Show next gallery image"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </>
  );
}
