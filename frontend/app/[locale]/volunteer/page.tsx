'use client';

import { useEffect, useState } from 'react';
import { getEvents } from '@/services/eventService';
import { VolunteerSignupForm } from '@/components/volunteers/VolunteerSignupForm';
import type { Event } from '@/types/event';

export default function VolunteerPage() {
  // State management for event data, loading status, and modal visibility
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchVolunteerEvents = async () => {
      const data = await getEvents();
      // Filter for events with slots and that are published
      const needsVolunteers = data.filter(e => e.volunteerSlots > 0 && e.isPublished);
      setEvents(needsVolunteers);
      setLoading(false);
    };
    fetchVolunteerEvents();
  }, []);

  return (
    <main style={{ maxWidth: '75rem', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
      <header style={{ borderBottom: '0.5px solid var(--color-gray-light)', marginBottom: 'var(--space-10)', paddingBottom: 'var(--space-6)' }}>
        <h2 style={{ color: '#dc2626', fontSize: 'var(--fs-heading-2)' }}>Volunteer Opportunities</h2>
      </header>

      {/* Loading & Empty States */}
      {loading && <p>Loading opportunities...</p>}
      {!loading && events.length === 0 && (
        <p style={{ color: 'var(--color-gray-mid)' }}>No Volunteers Needed at this time.</p>
      )}

      {/* Events Grid Display */}
      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        {events.map((event) => (
          <div key={event.id} style={{ border: '1px solid var(--color-gray-light)', padding: 'var(--space-6)', borderRadius: '8px' }}>
            <h3>{event.title}</h3>
            <p><strong>Location:</strong> {event.location}</p>
            <p><strong>Time:</strong> {new Date(event.startDatetime).toLocaleString()}</p>
            <p><strong>Volunteers Needed:</strong> {event.volunteerSlots}</p>
            {/* Trigger for the Signup Modal */}
            <button 
              onClick={() => setSelectedEvent(event)}
              style={{ backgroundColor: '#dc2626', color: 'white', padding: '10px 20px', border: 'none', cursor: 'pointer' }}
            >
              Sign Up
            </button>
          </div>
        ))}
      </div>
      {/* Conditional Rendering of the Signup Form Overlay */}
      {selectedEvent && (
        <VolunteerSignupForm 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
        />
      )}
    </main>
  );
}