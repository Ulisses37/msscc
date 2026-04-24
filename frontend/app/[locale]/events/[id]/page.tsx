'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getEventById, getEvents } from '@/services/eventService';
import { EventDetail } from '@/components/events/EventDetails';
import type { Event } from '@/types/event';
import { EventNavigation } from '@/components/events/EventNavigation';

export default function EventDetailPage() {
  const { id, locale } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [previousEvent, setPreviousEvent] = useState<Event | null>(null);
  const [nextEvent, setNextEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchEvent = async () => {
      const data = await getEventById(Number(id));

      if (!data || !data.isPublished) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setEvent(data);

      // Fetch all published events, sort chronologically, find adjacent events
      const allEvents = await getEvents();
      const sorted = allEvents
        .filter((e) => e.isPublished)
        .sort((a, b) =>
          new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime(),
        );

      const currentIndex = sorted.findIndex((e) => e.id === Number(id));
      setPreviousEvent(currentIndex > 0 ? sorted[currentIndex - 1] : null);
      setNextEvent(currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null);

      setLoading(false);
    };

    fetchEvent();
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <main style={{
        fontFamily: 'var(--font-body)',
        maxWidth: '75rem',
        margin: '0 auto',
        padding: 'var(--space-10) var(--space-6)',
      }}>
        <p style={{
          color: 'var(--color-gray-mid)',
          fontSize: 'var(--fs-body)',
        }}>
          Loading event...
        </p>
      </main>
    );
  }

  // 404 state
  if (notFound) {
    return (
      <main style={{
        fontFamily: 'var(--font-body)',
        maxWidth: '75rem',
        margin: '0 auto',
        padding: 'var(--space-10) var(--space-6)',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--color-teal)',
          fontSize: 'var(--fs-display)',
          marginBottom: 'var(--space-4)',
        }}>
          Event Not Found
        </h1>
        <p style={{
          color: 'var(--color-gray-mid)',
          fontSize: 'var(--fs-body)',
          marginBottom: 'var(--space-6)',
        }}>
          This event does not exist or is no longer available.
        </p>
        <Link
          href={`/${locale}/events`}
          style={{
            color: 'var(--color-teal)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-body-sm)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}
        >
          ← Back to events
        </Link>
      </main>
    );
  }

  return (
    <main style={{
      fontFamily: 'var(--font-body)',
      maxWidth: '75rem',
      margin: '0 auto',
      padding: 'var(--space-10) var(--space-6)',
    }}>

      {/* Back to events link */}
      <Link
        href={`/${locale}/events`}
        style={{
          color: 'var(--color-teal)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-body-sm)',
          textDecoration: 'none',
          display: 'inline-block',
          marginBottom: 'var(--space-6)',
        }}
        onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
        onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
      >
        ← Back to events
      </Link>

      {event && <EventDetail event={event} />}

      {/* Previous / next navigation */}
      <EventNavigation
        previousEvent={previousEvent}
        nextEvent={nextEvent}
      />

    </main>
  );
}
