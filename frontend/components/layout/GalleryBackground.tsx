'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type MouseEvent } from 'react';

type GalleryImage = {
  media_asset_id: number;
  file_url: string | null;
  file_name: string;
  alt_text_en?: string;
};

const DISPLAY_TIME_MS = 8000;
const MANUAL_GRACE_TIME_MS = 2000;
const FADE_TIME_MS = 1000;

export default function GalleryBackground() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioningFrom, setTransitioningFrom] = useState<number | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isPillExpanded, setIsPillExpanded] = useState(false);
  const [timerDelay, setTimerDelay] = useState(DISPLAY_TIME_MS);
  const [timerGeneration, setTimerGeneration] = useState(0);
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const viewerWasOpen = useRef(false);

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
    if (prefersReducedMotion || images.length < 2 || isViewerOpen) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((currentIndex) => {
        setTransitioningFrom(currentIndex);
        return (currentIndex + 1) % images.length;
      });
      setTimerDelay(DISPLAY_TIME_MS);
      setTimerGeneration((generation) => generation + 1);
    }, timerDelay);

    return () => window.clearTimeout(timer);
  }, [images.length, isViewerOpen, prefersReducedMotion, timerDelay, timerGeneration]);

  useEffect(() => {
    if (transitioningFrom === null) return;

    const timer = window.setTimeout(() => setTransitioningFrom(null), FADE_TIME_MS);
    return () => window.clearTimeout(timer);
  }, [transitioningFrom]);

  useEffect(() => {
    if (isViewerOpen) {
      viewerWasOpen.current = true;
      closeButtonRef.current?.focus();
      return;
    }

    if (viewerWasOpen.current) {
      viewerWasOpen.current = false;
      setTimerDelay(DISPLAY_TIME_MS);
      setTimerGeneration((generation) => generation + 1);
      previewButtonRef.current?.focus();
    }
  }, [isViewerOpen]);

  useEffect(() => {
    if (!isViewerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsViewerOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen]);

  if (images.length === 0) return null;

  const activeImage = images[activeIndex];
  const previousImage = transitioningFrom === null ? null : images[transitioningFrom];

  const changeImage = (direction: -1 | 1) => {
    setActiveIndex((currentIndex) => {
      setTransitioningFrom(currentIndex);
      return (currentIndex + direction + images.length) % images.length;
    });
    setTimerDelay(DISPLAY_TIME_MS + MANUAL_GRACE_TIME_MS);
    setTimerGeneration((generation) => generation + 1);
  };

  const closeViewer = () => setIsViewerOpen(false);

  const handleViewerBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeViewer();
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
            sizes="100vw"
            className="object-cover animate-gallery-fade-out"
          />
        )}

        <Image
          key={`gallery-active-${activeImage.media_asset_id}`}
          src={activeImage.file_url as string}
          alt=""
          fill
          priority={activeIndex === 0}
          sizes="100vw"
          className={`object-cover ${
            previousImage && !prefersReducedMotion ? 'animate-gallery-fade-in' : ''
          }`}
        />

        <div className="absolute inset-0 bg-white/35" />
      </div>

      {images.length > 1 && (
        <div className="fixed bottom-4 right-3 z-20 flex items-end gap-1">
          {isPillExpanded && (
            <>
              <div className="flex flex-col items-center rounded-full border border-msscc-teal/20 bg-white/60 p-0.5 shadow-sm backdrop-blur-sm">
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
                <button
                  ref={previewButtonRef}
                  type="button"
                  onClick={() => setIsViewerOpen(true)}
                  className="flex size-8 items-center justify-center rounded-full text-sm leading-none text-msscc-teal transition-colors hover:bg-msscc-teal/10 focus:outline-none focus:ring-2 focus:ring-msscc-teal/30"
                  aria-label="View current gallery image"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.75 8.25v-4.5h4.5M3.75 3.75 9 9M20.25 8.25v-4.5h-4.5M20.25 3.75 15 9M3.75 15.75v4.5h4.5M3.75 20.25 9 15M20.25 15.75v4.5h-4.5M20.25 20.25 15 15" />
                  </svg>
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
            </>
          )}

          <button
            type="button"
            onClick={() => setIsPillExpanded((expanded) => !expanded)}
            className="flex size-6 items-center justify-center rounded-full bg-white/45 text-xs text-msscc-teal opacity-70 shadow-sm transition-colors hover:bg-msscc-teal/10 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-msscc-teal/30"
            aria-expanded={isPillExpanded}
            aria-label={isPillExpanded ? 'Collapse gallery controls' : 'Expand gallery controls'}
          >
            {isPillExpanded ? '−' : '+'}
          </button>
        </div>
      )}

      {isViewerOpen && (
        <div
          role="presentation"
          onMouseDown={handleViewerBackdropMouseDown}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={activeImage.alt_text_en || activeImage.file_name || 'Gallery image'}
            className="relative aspect-video w-[92vw] max-w-[960px] max-h-[80vh] overflow-hidden rounded-lg bg-black/80 shadow-xl"
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeViewer}
              className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-lg leading-none text-white transition-colors hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white/80"
              aria-label="Close gallery image viewer"
            >
              ×
            </button>
            <Image
              src={activeImage.file_url as string}
              alt={activeImage.alt_text_en || activeImage.file_name}
              fill
              sizes="(max-width: 960px) 92vw, 960px"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
