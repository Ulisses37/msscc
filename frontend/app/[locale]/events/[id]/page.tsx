'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getEventById } from '@/services/eventService';
import { EventDetail } from '@/components/events/EventDetails';
import type { Event } from '@/types/event';

export default function EventDetailPage() {
  const { id, locale } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      const data = await getEventById(Number(id));

      if (!data || !data.isPublished) {
        setNotFound(true);
      } else {
        setEvent(data);
      }

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
    </main>
  );
}
