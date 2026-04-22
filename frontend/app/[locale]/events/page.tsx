'use client';

import { EventCard } from './EventCard';
import type { Event } from '@/types/event';
import { sampleEvents } from './sampleData';

export default function EventsPage() {
  // Filter and sort inline for now — fetching logic added in next subtask
  const events: Event[] = sampleEvents.filter((e) => e.isPublished);

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

      {/* Event List Grid */}
      <div className="flex flex-col gap-6">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

    </main>
  );
}
