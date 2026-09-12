'use client';

import type { Event } from '@/types/event';

const INVALID_LOCATIONS = ['tbd', 'tba', '', 'unknown', 'online', 'virtual'];

function isValidLocation(location: string): boolean {
  return !INVALID_LOCATIONS.includes(location.toLowerCase().trim());
}

interface EventMapProps {
  event: Event;
}

export function EventMap({ event }: EventMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const shouldShowMap = event.locationEn && isValidLocation(event.locationEn) && apiKey;

  if (!shouldShowMap) return null;

  const mapSrc = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(event.locationEn)}&zoom=14`;

  return (
    <div style={{
      width: '100%',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      border: '0.5px solid var(--color-gray-light)',
      marginBottom: 'var(--space-4)',
    }}>
      <iframe
        title={`Map of ${event.locationEn}`}
        src={mapSrc}
        width="100%"
        height="250"
        style={{ border: 0, display: 'block' }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
