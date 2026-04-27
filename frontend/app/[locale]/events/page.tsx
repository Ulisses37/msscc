'use client';

import { useEffect, useState } from 'react';
import { getEvents } from '@/services/eventService';
import { EventCard } from '../../../components/events/EventCard';
import type { Event } from '@/types/event';
import Button from '@/components/ui/Button';
import { useParams, useRouter } from 'next/navigation';

/**
 * EventsPage Component
 * Displays a list of published events and a link to volunteer opportunities.
 */
export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const router = useRouter();
  const locale = params?.locale;

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await getEvents();

      // Filter to published only, then sort by startDatetime ascending
      const sorted = data
        .filter((event) => event.isPublished)
        .sort((a, b) =>
          new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime(),
        );

        setEvents(sorted);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Check if there are any volunteer opportunities among the events
  const hasVolunteerOpportunities = events.some(
    (event) => event.volunteerSlots > 0
  );

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

      {/* Volunteer Opportunities Section */}
      <div style={{ marginTop: 'var(--space-10)', borderTop: '1px solid var(--color-gray-light)', paddingTop: 'var(--space-8)' }}>
        {hasVolunteerOpportunities ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-gray-dark)' }}>
              Interested in helping out? We have positions available!
            </p>
            <Button
              text="View Volunteer Opportunities"
              width="300px" // Adjusted from 100% to look more professional
              height="48px"
              fontSize="14px"
              onClick={() => router.push(`/${locale}/volunteer`)}
            />
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--color-gray-mid)' }}>
            No volunteer opportunities exist at this time.
        )}
      </div>
    </main>
  );
}
