'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSignupsBySlotId, VolunteerSignup } from '@/services/volunteerService';

function formatDateTime(datetime: string): string {
  return new Date(datetime).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VolunteerSignupsPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event_id');
  const [signups, setSignups] = useState<VolunteerSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSignups = async () => {
      try {
        const data = await getSignupsBySlotId(Number(id));
        setSignups(data || []);
      } catch (err) {
        console.error('Failed to fetch volunteer signups:', err);
        setError('Failed to load volunteer signups.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSignups();
  }, [id]);

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: 'var(--color-gray-faint)',
      fontFamily: 'var(--font-body)',
    }}>

      {/* Back link */}
      <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
        <Link
          href={eventId ? `/admin/volunteer/${eventId}` : '/admin/events'}
          style={{
            color: 'var(--color-gray-dark)',
            fontSize: 'var(--fs-body-sm)',
            textDecoration: 'none',
          }}
          onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          ← Back
        </Link>
      </div>

      {/* Main content area */}
      <div style={{
        margin: '0 var(--space-6)',
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-md)',
        minHeight: '70vh',
        padding: 'var(--space-6)',
      }}>

        <h2 style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--color-teal)',
          fontSize: 'var(--fs-heading-3)',
          marginBottom: 'var(--space-6)',
        }}>
          Volunteer Signups
        </h2>

        {/* Loading state */}
        {isLoading && (
          <p style={{ color: 'var(--color-gray-mid)', fontSize: 'var(--fs-body-sm)' }}>
            Loading signups...
          </p>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 'var(--fs-body-sm)' }}>
            {error}
          </p>
        )}

        {/* Empty state */}
        {!isLoading && !error && signups.length === 0 && (
          <p style={{ color: 'var(--color-gray-mid)', fontSize: 'var(--fs-body-sm)' }}>
            No one has signed up for this shift yet.
          </p>
        )}

        {/* Signup list */}
        {!isLoading && !error && signups.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}>
            {signups.map((signup) => (
              <div
                key={signup.volunteer_signup_id}
                style={{
                  border: '0.5px solid var(--color-gray-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4) var(--space-6)',
                  backgroundColor: 'var(--color-white)',
                }}
              >
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--fs-body-sm)',
                  color: 'var(--color-gray-dark)',
                  fontWeight: 700,
                  margin: 0,
                }}>
                  {signup.first_name} {signup.last_name}
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--color-gray-mid)',
                  margin: 0,
                }}>
                  {signup.email} · {signup.phone}
                </p>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--fs-caption)',
                  color: 'var(--color-gray-mid)',
                  margin: 0,
                }}>
                  Status: {signup.status} · Signed up {formatDateTime(signup.submitted_at)}
                </p>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
