'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TransitionEvent,
} from 'react';

type GalleryImage = {
  media_asset_id: number;
  file_url: string | null;
  file_name: string;
  alt_text_en?: string;
};

type GallerySlot = 0 | 1;
type TransitionPhase = 'waiting' | 'crossfading';
type GalleryTransition = {
  fromSlot: GallerySlot;
  toSlot: GallerySlot;
  targetIndex: number;
  phase: TransitionPhase;
};

const DISPLAY_TIME_MS = 8000;
const MANUAL_GRACE_TIME_MS = 2000;
const FADE_TIME_MS = 1000;


// Functionality works such that one image is visible at a time while the next image is staged in a hidden slot,
// ensuring smooth transitions without replacing the current image prematurely.
export default function GalleryBackground() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleSlot, setVisibleSlot] = useState<GallerySlot>(0);
  const [slotImages, setSlotImages] = useState<[number | null, number | null]>([0, null]);
  const [imageStatus, setImageStatus] = useState<Record<number, 'loaded' | 'failed'>>({});
  const [galleryTransition, setGalleryTransition] = useState<GalleryTransition | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [timerDelay, setTimerDelay] = useState(DISPLAY_TIME_MS);
  const [timerGeneration, setTimerGeneration] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);//Pill Related Gallery Viewer State
  const [isPillExpanded, setIsPillExpanded] = useState(false);
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
        // Reset the two-slot renderer whenever the gallery data is refreshed.
        setImages(galleryImages);
        setActiveIndex(0);
        setVisibleSlot(0);
        setSlotImages([0, null]);
        setImageStatus({});
        setGalleryTransition(null);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        // The normal page background is the fallback when the gallery is unavailable.
      }
    };

    loadGallery();
    return () => controller.abort();
  }, []);

  const findNextImageIndex = useCallback((direction: -1 | 1) => {
    if (images.length < 2) return null;

    for (let offset = 1; offset < images.length; offset += 1) {
      const candidateIndex =
        (activeIndex + direction * offset + images.length * 2) % images.length;
      const candidate = images[candidateIndex];

      if (candidate && imageStatus[candidate.media_asset_id] !== 'failed') {
        return candidateIndex;
      }
    }

    return null;
  }, [activeIndex, imageStatus, images]);

  const requestImageChange = useCallback((direction: -1 | 1) => {
    if (galleryTransition !== null) return;

    const nextIndex = findNextImageIndex(direction);
    if (nextIndex === null) return;

    const toSlot: GallerySlot = visibleSlot === 0 ? 1 : 0;
    // Stage the requested image in the hidden slot; the current image remains visible while it loads.
    setSlotImages((currentSlots) => {
      const nextSlots: [number | null, number | null] = [...currentSlots];
      nextSlots[toSlot] = nextIndex;
      return nextSlots;
    });
    setGalleryTransition({
      fromSlot: visibleSlot,
      toSlot,
      targetIndex: nextIndex,
      phase: 'waiting',
    });
  }, [findNextImageIndex, galleryTransition, visibleSlot]);

  const finishTransition = useCallback(() => {
    if (!galleryTransition) return;

    // Commit the staged slot only after its crossfade has completed.
    // Flickering solution: Keep until loaded and switched to the new image.
    setActiveIndex(galleryTransition.targetIndex);
    setVisibleSlot(galleryTransition.toSlot);
    setSlotImages((currentSlots) => {
      const nextSlots: [number | null, number | null] = [...currentSlots];
      nextSlots[galleryTransition.fromSlot] = null;
      return nextSlots;
    });
    setGalleryTransition(null);
  }, [galleryTransition]);

  const handleImageLoad = (image: GalleryImage) => {
    setImageStatus((currentStatus) => ({
      ...currentStatus,
      [image.media_asset_id]: 'loaded',
    }));
  };

  const handleImageError = (image: GalleryImage) => {
    setImageStatus((currentStatus) => ({
      ...currentStatus,
      [image.media_asset_id]: 'failed',
    }));

    if (!galleryTransition || galleryTransition.targetIndex !== images.indexOf(image)) return;

    setSlotImages((currentSlots) => {
      const nextSlots: [number | null, number | null] = [...currentSlots];
      nextSlots[galleryTransition.toSlot] = null;
      return nextSlots;
    });
    setGalleryTransition(null);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || images.length < 2 || isViewerOpen) return;

    // Timers pause while a staged image is loading or crossfading.
    const timer = window.setTimeout(() => {
      requestImageChange(1);
      setTimerDelay(DISPLAY_TIME_MS);
      setTimerGeneration((generation) => generation + 1);
    }, timerDelay);

    return () => window.clearTimeout(timer);
  }, [
    images.length,
    isViewerOpen,
    prefersReducedMotion,
    timerDelay,
    timerGeneration,
    galleryTransition,
    activeIndex,
    visibleSlot,
    imageStatus,
    requestImageChange,
  ]);

  useEffect(() => {
    if (!galleryTransition || galleryTransition.phase !== 'waiting') return;

    const targetImage = images[galleryTransition.targetIndex];
    if (!targetImage || imageStatus[targetImage.media_asset_id] !== 'loaded') return;

    // Loading is the readiness gate that prevents Firefox from fading out to an empty frame.
    // Premature loading or switching causes flickering of the old image.
    setGalleryTransition((currentTransition) =>
      currentTransition?.phase === 'waiting'
        ? { ...currentTransition, phase: 'crossfading' }
        : currentTransition,
    );
  }, [galleryTransition, imageStatus, images]);

  useEffect(() => {
    if (!galleryTransition || galleryTransition.phase !== 'crossfading') return;

    if (prefersReducedMotion) {
      finishTransition();
      return;
    }

    const fallbackTimer = window.setTimeout(finishTransition, FADE_TIME_MS + 100);
    return () => window.clearTimeout(fallbackTimer);
  }, [finishTransition, galleryTransition, prefersReducedMotion]);


  //Pill States: Controls the operations of pill buttons in the gallery viewer.
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
  const handleTransitionEnd = (event: TransitionEvent<HTMLImageElement>) => {
    if (
      event.propertyName === 'opacity' &&
      galleryTransition?.phase === 'crossfading' &&
      event.currentTarget.dataset.slot === String(galleryTransition.toSlot)
    ) {
      finishTransition();
    }
  };

  const changeImage = (direction: -1 | 1) => {
    requestImageChange(direction);
    setTimerDelay(DISPLAY_TIME_MS + MANUAL_GRACE_TIME_MS);
    setTimerGeneration((generation) => generation + 1);
  };

  const closeViewer = () => setIsViewerOpen(false);

  const handleViewerBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeViewer();
  };

  //Function:
  //Render the gallery background with the current and staged images.
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-1/2 z-0 isolate h-[80vh] min-h-[240px] max-h-[680px] -translate-y-1/2 overflow-hidden opacity-[0.18] blur-[1px]"
      >
        {slotImages.map((imageIndex, slotIndex) => {
          if (imageIndex === null) return null;

          const image = images[imageIndex];
          if (!image) return null;

          const slot = slotIndex as GallerySlot;
          const isTransitionFrom = galleryTransition?.fromSlot === slot;
          const isTransitionTo = galleryTransition?.toSlot === slot;
          const isCrossfading = galleryTransition?.phase === 'crossfading';
          const isWaiting = galleryTransition?.phase === 'waiting';

          // State transitions.
          // Determine the appropriate CSS class for the image based on its transition state.
          // Opacity, visibility, and Z-index based on Final incoming image and its compeltion before loading/swapping
          const imageState =
            isTransitionFrom && isWaiting
              ? 'gallery-image--outgoing-pending'
              : isTransitionFrom && isCrossfading
                ? 'gallery-image--outgoing'
                : isTransitionTo && isWaiting
                  ? 'gallery-image--incoming-pending'
                  : isTransitionTo && isCrossfading
                    ? 'gallery-image--incoming'
                    : slot === visibleSlot
                      ? 'gallery-image--current'
                      : '';

          return (
            // Each slot keeps its DOM identity; only its image source and opacity state change.
            // Two images are rendered at a time: the current visible image and the staged incoming image.
            // Removal once the transition is complete.
            <Image
              key={`gallery-slot-${slot}`}
              data-slot={slot}
              src={image.file_url as string}
              alt=""
              fill
              priority={imageIndex === 0}
              loading="eager"
              sizes="100vw"
              onLoad={() => handleImageLoad(image)}
              onError={() => handleImageError(image)}
              onTransitionEnd={handleTransitionEnd}
              className={`gallery-image ${slot === visibleSlot ? 'z-[1]' : 'z-[2]'} object-cover ${imageState}`}
            />
          );
        })}

        <div className="absolute inset-0 z-[3] bg-white/35" />
      </div>


      {/* Pill controls for the gallery viewer */}
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

      {/* Gallery image viewer/expanded inspector */}
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
