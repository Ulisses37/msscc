'use client';

import { useEffect, useState } from 'react';
import { getEvents } from '@/services/eventService';
import { EventCard } from '../../../components/EventCard';
import type { Event } from '@/types/event';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      const data = await getEvents();

      // Filter to published only, then sort by startDatetime ascending
      const sorted = data
        .filter((event) => event.isPublished)
        .sort((a, b) =>
          new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime(),
        );

      setEvents(sorted);
      setLoading(false);
    };

    fetchEvents();
  }, []);

  return (
    <main style={{
      fontFamily: 'var(--font-body)',
      maxWidth: '75rem',
      margin: '0 auto',
      padding: 'var(--space-10) var(--space-6)',
    }}>

      {/* Header */}
      <header style={{
        borderBottom: '0.5px solid var(--color-gray-light)',
        marginBottom: 'var(--space-10)',
        paddingBottom: 'var(--space-6)',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: '#dc2626',
          fontSize: 'var(--fs-heading-2)',
          marginBottom: 'var(--space-4)',
        }}>
          Events and Activities
        </h2>
      </header>

      {/* Loading state */}
      {loading && (
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-gray-mid)',
          fontSize: 'var(--fs-body)',
        }}>
          Loading events...
        </p>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <p style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--color-gray-mid)',
          fontSize: 'var(--fs-body)',
        }}>
          No upcoming events at this time. Please check back soon.
        </p>
      )}

      {/* Responsive event grid */}
      {!loading && events.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateRows: 'repeat(auto-fill, minmax(280px, 1fr))',
          gridAutoFlow: 'column',
          gap: 'var(--space-6)',
          maxHeight: '100vh',
          overflowY: 'auto',
        }}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

    </main>
  );
}

