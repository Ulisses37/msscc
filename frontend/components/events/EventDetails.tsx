import Image from 'next/image';
import type { Event } from '@/types/event';

interface EventDetailProps {
  event: Event;
}

// Formats ISO datetime string to readable date and time
function formatDateTime(datetime: string): string {
  return new Date(datetime).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Checks if two ISO datetime strings fall on the same calendar day
function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function EventDetail({ event }: EventDetailProps) {
  return (
    <article style={{
      maxWidth: '75rem',
      margin: '0 auto',
      fontFamily: 'var(--font-body)',
    }}>

      {/* Hero image */}
      {event.media?.fileUrl && (
        <div style={{
          width: '100%',
          aspectRatio: '16 / 9',
          position: 'relative',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          marginBottom: 'var(--space-10)',
        }}>
          <Image
            src={event.media.fileUrl}
            alt={event.media.altText ?? event.title}
            fill
            style={{ objectFit: 'cover' }}
            priority
          />
        </div>
      )}

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-heading)',
        color: 'var(--color-teal)',
        fontSize: 'var(--fs-display)',
        marginBottom: 'var(--space-6)',
        lineHeight: 1.2,
      }}>
        {event.title}
      </h1>

      {/* Metadata */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        marginBottom: 'var(--space-4)',
        paddingBottom: 'var(--space-4)',
      }}>

        {/* Date — shows both start and end if they differ */}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-mid)',
          margin: 0,
        }}>
          {isSameDay(event.startDatetime, event.endDatetime)
            ? formatDateTime(event.startDatetime)
            : `${formatDateTime(event.startDatetime)} – ${formatDateTime(event.endDatetime)}`
          }
        </p>

        {/* Location */}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-mid)',
          margin: 0,
        }}>
          📍 {event.location}
        </p>

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

        {/* Calendar link */}
        {event.calendarLink && (
          <a
            href={event.calendarLink ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--fs-body-sm)',
              color: 'var(--color-teal)',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              alignSelf: 'flex-start',
            }}
          >
            Add to Google Calendar →
          </a>
        )}

      </div>

      {/* Full description — preserves line breaks */}
      {event.description && (
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body)',
          color: 'var(--color-gray-dark)',
          lineHeight: 1.7,
        }}>
          {event.description.split('\n').map((paragraph, index) => (
            <p key={index} style={{ marginBottom: 'var(--space-4)' }}>
              {paragraph}
            </p>
          ))}
        </div>
      )}

    </article>
  );
}
