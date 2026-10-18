import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

import { getRichTextPlainText } from '@/utils/richText';
import { formatLocalizedDate } from '@/utils/dateLocalization';

import { RichTextContent } from '@/components/content/RichTextContent';
import Button from '@/components/ui/Button';

import type { ImageAlignment, ImageWidth } from '@/types/content';
import type { Event, EventImage } from '@/types/event';

// Match the saved admin controls so public photos keep their configured presentation.
const IMAGE_ALIGNMENT_CLASSES: Record<ImageAlignment, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const IMAGE_WIDTH_CLASSES: Record<ImageWidth, string> = {
  25: 'w-1/4',
  50: 'w-1/2',
  75: 'w-3/4',
  100: 'w-full',
};

interface EventDetailProps {
  event: Event;
  eventImages?: EventImage[];
  onVolunteer?: () => void;
}

// Formats ISO datetime string to readable date and time
function formatDateTime(
  datetime: string,
  locale: string | string[] | undefined,
): string {
  return formatLocalizedDate(datetime, locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Generates a Google Calendar add-event link from event data
function generateGoogleCalendarLink(event: Event, locale: string | string[] | undefined): string {
  const formatDateForCalendar = (datetime: string): string => {
    return new Date(datetime)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.000Z', 'Z');
  };

  // Calendar content follows the page language, with English as the existing fallback.
  const isJapanese = locale === 'ja';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: isJapanese ? event.titleJa || event.titleEn : event.titleEn,
    dates: `${formatDateForCalendar(event.startDatetime)}/${formatDateForCalendar(event.endDatetime)}`,
    details: isJapanese ? event.descriptionJa || event.descriptionEn : event.descriptionEn,
    location: isJapanese ? event.locationJa || event.locationEn : event.locationEn,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Checks if two ISO datetime strings fall on the same calendar day
function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function EventDetail({
  event,
  eventImages = [],
  onVolunteer,
}: EventDetailProps) {
  const t = useTranslations('EventDetailPage');
  const { locale } = useParams();
  const title = locale === 'ja' ? event.titleJa || event.titleEn : event.titleEn;
  const description = locale === 'ja' ? event.descriptionJa || event.descriptionEn : event.descriptionEn;
  const location = locale === 'ja' ? event.locationJa || event.locationEn : event.locationEn;
  const isPastEvent = new Date(event.endDatetime).getTime() < Date.now();
  return (
    <article style={{
      maxWidth: '75rem',
      margin: '0 auto',
      fontFamily: 'var(--font-body)',
    }}>

      {/* Hero image */}
      {event.media?.fileUrl && (
        <>
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

          {/* Button below image */}
          {!isPastEvent && onVolunteer && (
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <Button text={t('volunteerForEvent')} width="auto" padding="12px 24px"
              onClick={onVolunteer} />
            </div>
          )}
        </>
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
            ? formatDateTime(event.startDatetime, locale)
            : `${formatDateTime(event.startDatetime, locale)} – ${formatDateTime(event.endDatetime, locale)}`
          }
        </p>

        {/* Google Calendar link */}
        <a
          href={generateGoogleCalendarLink(event, locale)}
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
          {t('googleCalendar')}
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
        {!isPastEvent && event.volunteerSlots > 0 && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--color-teal)',
            margin: 0,
          }}>
            {t('volunteerSlots', { count: event.volunteerSlots })}
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
            {t('addToGoogleCalendar')}
          </a>
        )}

      </div>

      {/* Button below location if no image, below description if description exists */}
      {!event.media?.fileUrl && !isPastEvent && onVolunteer && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <Button
            text={t('volunteerForEvent')}
            width="auto"
            padding="12px 24px"
            onClick={onVolunteer}
          />
        </div>
      )}

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

      {eventImages.map((eventImage) => {
        // Japanese pages fall back to English when a translated caption is unavailable.
        const caption = locale === 'ja'
          ? eventImage.captionJa || eventImage.captionEn
          : eventImage.captionEn;
        const alignmentClass = IMAGE_ALIGNMENT_CLASSES[eventImage.imageAlignment];
        const widthClass = IMAGE_WIDTH_CLASSES[eventImage.imageWidth];

        // Deleted media assets can leave valid EventImage records without a usable file URL.
        if (!eventImage.mediaUrl) return null;

        return (
          <figure
            key={eventImage.id}
            className={`${alignmentClass} mt-6`}
          >
            <img
              src={eventImage.mediaUrl}
              alt={getRichTextPlainText(caption) || title}
              className={`inline-block h-auto max-w-full rounded-md ${widthClass}`}
            />

            {caption && (
              <figcaption className="mt-2 font-body text-caption text-msscc-gray-mid">
                <RichTextContent value={caption} />
              </figcaption>
            )}
          </figure>
        );
      })}

    </article>
  );
}
