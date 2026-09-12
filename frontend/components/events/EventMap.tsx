'use client';

import { useEffect, useState } from 'react';
import type { Event } from '@/types/event';

const INVALID_LOCATIONS = ['tbd', 'tba', '', 'unknown', 'online', 'virtual'];

function isValidLocation(location: string): boolean {
  return !INVALID_LOCATIONS.includes(location.toLowerCase().trim());
}

interface EventMapProps {
  event: Event;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// Geocode a location string using Google Geocoding API
async function geocodeLocation(
  location: string,
  apiKey: string,
): Promise<Coordinates | null> {
  try {
    const encoded = encodeURIComponent(location);
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`,
    );
    const data = await res.json();
    if (data.status !== 'OK' || !data.results.length) return null;
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  } catch {
    return null;
  }
}

export function EventMap({ event }: EventMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const [coords, setCoords] = useState<Coordinates | null>(null);

  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const shouldShowMap = event.locationEn && isValidLocation(event.locationEn) && apiKey;

  useEffect(() => {
    if (!shouldShowMap) return;

    geocodeLocation(event.locationEn, apiKey).then((result) => {
      if (result) {
        setCoords(result);
      } else {
        setGeocodeFailed(true);
      }
    });
  }, [event.locationEn, apiKey]);

  if (!shouldShowMap || geocodeFailed) return null;

  // Loading placeholder while geocoding
  if (!coords) {
    return (
      <div style={{
        width: '100%',
        height: '250px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-gray-faint)',
        border: '0.5px solid var(--color-gray-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-4)',
      }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-mid)',
          margin: 0,
        }}>
          Loading map...
        </p>
      </div>
    );
  }

  const mapSrc = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${coords.lat},${coords.lng}&zoom=14`;

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
