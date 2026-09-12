import Image from 'next/image';
import type { Event } from '@/types/event';
import { useParams } from 'next/navigation';


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

// Generates a Google Calendar add-event link from event data
function generateGoogleCalendarLink(event: Event): string {
  const formatDateForCalendar = (datetime: string): string => {
    return new Date(datetime)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.000Z', 'Z');
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.titleEn,
    dates: `${formatDateForCalendar(event.startDatetime)}/${formatDateForCalendar(event.endDatetime)}`,
    details: event.descriptionEn,
    location: event.locationEn,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Checks if two ISO datetime strings fall on the same calendar day
function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function EventDetail({ event }: EventDetailProps) {
  const { locale } = useParams();
  const title = locale === 'ja' ? event.titleJa || event.titleEn : event.titleEn;
  const description = locale === 'ja' ? event.descriptionJa || event.descriptionEn : event.descriptionEn;
  const location = locale === 'ja' ? event.locationJa || event.locationEn : event.locationEn;
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
            alt={event.media.altText ?? title}
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
        {title}
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

        {/* Google Calendar link */}
        <a
          href={generateGoogleCalendarLink(event)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--color-gray-mid)',
            textDecoration: 'none',
            alignSelf: 'flex-start',
          }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          Google Calendar
        </a>

        {/* Location */}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-mid)',
          margin: 0,
        }}>
          📍 {location}
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
      {description && (
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body)',
          color: 'var(--color-gray-dark)',
          lineHeight: 1.7,
        }}>
          {description.split('\n').map((paragraph, index) => (
            <p key={index} style={{ marginBottom: 'var(--space-4)' }}>
              {paragraph}
            </p>
          ))}
        </div>
      )}

    </article>
  );
}
