'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter and useParams
import { getEvents } from '@/services/eventService';
import type { Event } from '@/types/event';
import Button from '@/components/ui/Button'; // Using your Button component

export default function VolunteerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const { locale } = useParams(); // Get current locale (e.g., 'en')

  useEffect(() => {
    const fetchVolunteerEvents = async () => {
      const data = await getEvents();
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

      {loading && <p>Loading opportunities...</p>}
      {!loading && events.length === 0 && (
        <p style={{ color: 'var(--color-gray-mid)' }}>No Volunteers Needed at this time.</p>
      )}

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        {events.map((event) => (
          <div key={event.id} style={{ border: '1px solid var(--color-gray-light)', padding: 'var(--space-6)', borderRadius: '8px' }}>
            <h3>{event.title}</h3>
            <p><strong>Location:</strong> {event.location}</p>
            <p><strong>Time:</strong> {new Date(event.startDatetime).toLocaleString()}</p>
            <p><strong>Volunteers Needed:</strong> {event.volunteerSlots}</p>
            
            {/* Updated to use your Button component with a redirect */}
            <Button 
              text="Sign Up"
              onClick={() => router.push(`/${locale}/volunteer/${event.id}`)}
              padding="12px 24px"
            />
          </div>
        ))}
      </div>
    </main>
  );
}