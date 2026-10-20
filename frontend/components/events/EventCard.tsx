'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Button from '@/components/ui/Button';
import type { Event } from '@/types/event';
import { useParams } from 'next/navigation';
import { formatLocalizedDate } from '@/utils/dateLocalization';
import { getCropImageStyle } from '@/utils/thumbnailCrop';

interface EventCardProps {
  event: Event;
}

// Formats ISO datetime string to readable date
function formatDate(datetime: string, locale: string | string[] | undefined): string {
  return formatLocalizedDate(datetime, locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Formats ISO datetime string to readable time
function formatTime(datetime: string, locale: string | string[] | undefined): string {
  return formatLocalizedDate(datetime, locale, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Truncates description to a max character length
function truncate(text: string, maxLength: number = 100): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function EventCard({ event }: EventCardProps) {
  const t = useTranslations('EventDetailPage');
  const { locale } = useParams();
  const eventUrl = `/${locale}/events/${event.id}`;
  const title = locale === 'ja' ? event.titleJa || event.titleEn : event.titleEn;
  const description = locale === 'ja' ? event.descriptionJa || event.descriptionEn : event.descriptionEn;
  const isPastEvent = new Date(event.endDatetime).getTime() < Date.now();

  return (
    <div
      className="flex shrink-0 flex-col sm:min-h-[264px] sm:flex-row"
      style={{
        border: '0.5px solid var(--color-gray-light)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-white)',
        overflow: 'hidden',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
      }}
    >

      {/* Image — links to event detail page */}
      <Link href={eventUrl} className="h-[260px] w-full sm:h-auto sm:w-[400px]" style={{ flexShrink: 0, position: 'relative', display: 'block' }}>
        {event.media?.fileUrl ? (
          // `fill` sizes the image to the box and cover crops it, so the image can't change the card's size
          <Image
            src={event.media.fileUrl}
            alt={event.media.altText ?? title}
            fill
            sizes="(min-width: 640px) 400px, 100vw"
            style={getCropImageStyle(event.thumbnailCrop)}
          />
        ) : (
          // Placeholder when no image is provided
          <div className="w-full h-[260px] sm:w-[400px] sm:h-full" style={{
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
        <div className="max-w-[90%]" style={{
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
          {/* Locale changes the visible date language without changing the stored event time. */}
          <div>{formatDate(event.startDatetime, locale)}</div>
        </div>

      </Link>

      {/* Card body */}
      <div className="min-w-0" style={{
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
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            // Cap long titles at two lines so they can't stretch the card
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </Link>

        {/* Time range */}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          color: 'var(--color-gray-mid)',
          margin: 0,
        }}>
          {formatTime(event.startDatetime, locale)} – {formatTime(event.endDatetime, locale)}
        </p>

        {/* Truncated description */}
        {description && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            color: 'var(--color-gray-dark)',
            margin: 0,
            lineHeight: 1.6,
            // Cap at three lines for the same reason
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {truncate(description)}
          </p>
        )}

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

        {/* View Details button — pushes to bottom of card */}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)' }}>
          <Link href={eventUrl}>
            <Button text={t('viewEvent')} />
          </Link>
        </div>

      </div>
    </div>
  );
}
