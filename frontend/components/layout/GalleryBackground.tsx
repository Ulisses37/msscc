'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type GalleryImage = {
  media_asset_id: number;
  file_url: string | null;
  file_name: string;
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

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-1/2 z-0 h-[70vh] min-h-[240px] max-h-[680px] -translate-y-1/2 overflow-hidden opacity-[0.18] blur-[1px]"
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
  );
}
