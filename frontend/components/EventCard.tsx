'use client';

import Image from 'next/image';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import type { Event } from '@/types/event';

interface EventCardProps {
  event: Event;
}

// Formats ISO datetime string to readable date
function formatDate(datetime: string): string {
  return new Date(datetime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Formats ISO datetime string to readable time
function formatTime(datetime: string): string {
  return new Date(datetime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Truncates description to a max character length
function truncate(text: string, maxLength: number = 100): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function EventCard({ event }: EventCardProps) {
  const eventUrl = `/events/${event.id}`;

  return (
    <div
      style={{
        border: '0.5px solid var(--color-gray-light)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-white)',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
      }}
    >

      {/* Image — links to event detail page */}
      <Link href={eventUrl} style={{ flexShrink: 0, position: 'relative', display: 'block' }}>
        {event.media?.fileUrl ? (
          <Image
            src={event.media.fileUrl}
            alt={event.media.altText ?? event.title}
            width={400}
            height={300}
            style={{ width: '400px', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          // Placeholder when no image is provided
          <div style={{
            width: '400px',
            height: '100%',
            minHeight: '150px',
            backgroundColor: 'var(--color-gray-faint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-gray-mid)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Date badge — always visible regardless of image */}
        <div style={{
          position: 'absolute',
          bottom: 'var(--space-2)',
          left: 'var(--space-2)',
          backgroundColor: 'rgba(38, 70, 83, 0.85)',
          color: 'var(--color-white)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-caption)',
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          lineHeight: 1.4,
        }}>
          <div>{formatDate(event.startDatetime)}</div>
        </div>

      </Link>

      {/* Card body */}
      <div style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        flex: 1,
      }}>

        {/* Title — links to event detail page */}
        <Link
          href={eventUrl}
          style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--color-teal)',
            fontSize: 'var(--fs-heading-3)',
            textDecoration: 'none',
            lineHeight: 1.3,
          }}
        >
          {event.title}
        </Link>

        {/* Time range */}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-mid)',
          margin: 0,
        }}>
          {formatTime(event.startDatetime)} – {formatTime(event.endDatetime)}
        </p>

        {/* Truncated description */}
        {event.description && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--color-gray-dark)',
            margin: 0,
            lineHeight: 1.6,
          }}>
            {truncate(event.description)}
          </p>
        )}

        {/* Volunteer slots */}
        {event.volunteerSlots > 0 && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--color-teal)',
            margin: 0,
          }}>
            {event.volunteerSlots} volunteer slot{event.volunteerSlots !== 1 ? 's' : ''} available
          </p>
        )}

        {/* View Details button — pushes to bottom of card */}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)' }}>
          <Link href={eventUrl}>
            <Button text="View Event →" />
          </Link>
        </div>

      </div>
    </div>
  );
}
