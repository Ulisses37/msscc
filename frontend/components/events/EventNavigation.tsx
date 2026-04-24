'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Event } from '@/types/event';

interface EventNavigationProps {
  previousEvent: Event | null;
  nextEvent: Event | null;
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

interface NavLinkProps {
  event: Event;
  direction: 'previous' | 'next';
  locale: string;
}

// Individual nav link with hover state
function NavLink({ event, direction, locale }: NavLinkProps) {
  const [hovered, setHovered] = useState(false);
  const isPrevious = direction === 'previous';

  return (
    <Link
      href={`/${locale}/events/${event.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-1)',
        textDecoration: 'none',
        alignItems: isPrevious ? 'flex-start' : 'flex-end',
        alignSelf: 'flex-start',
        width: 'fit-content',
        padding: 'var(--space-4)',
        transition: 'border-color 0.15s ease',
      }}
    >
      {/* Direction label */}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-caption)',
        color: 'var(--color-gray-mid)',
        textTransform: 'uppercase',
        letterSpacing: 'var(--letter-spacing-label)',
      }}>
        {isPrevious ? '← Previous' : 'Next →'}
      </span>

      {/* Event title */}
      <span style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--fs-body-sm)',
        color: hovered ? 'var(--color-teal-dark)' : 'var(--color-teal)',
        transition: 'color 0.15s ease',
        textAlign: isPrevious ? 'left' : 'right',
      }}>
        {event.title}
      </span>

      {/* Formatted start date */}
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-caption)',
        color: 'var(--color-gray-mid)',
      }}>
        {formatDate(event.startDatetime)}
      </span>
    </Link>
  );
}

export function EventNavigation({ previousEvent, nextEvent }: EventNavigationProps) {
  const { locale } = useParams();

  // Nothing to render if no adjacent events
  if (!previousEvent && !nextEvent) return null;

  return (
    <nav
      aria-label="Event navigation"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 'var(--space-10)',
        marginTop: 'var(--space-10)',
        paddingTop: 'var(--space-6)',
        borderTop: '0.5px solid var(--color-gray-light)',
        maxWidth: '75rem',
    margin: 'var(--space-10) auto 0',
      }}
    >
      {/* Previous event */}
      {previousEvent ? (
        <NavLink
          event={previousEvent}
          direction="previous"
          locale={locale as string}
        />
      ) : (
        // Empty placeholder to keep next event on the right
        <div/>
      )}

      {/* Next event */}
      {nextEvent ? (
        <NavLink
          event={nextEvent}
          direction="next"
          locale={locale as string}
        />
      ) : (
        // Empty placeholder to keep previous event on the left
        <div/>
      )}
    </nav>
  );
}
