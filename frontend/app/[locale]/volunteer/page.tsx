'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation'; // Added useRouter and useParams
import { getEvents } from '@/services/eventService';
import type { Event } from '@/types/event';
import Button from '@/components/ui/Button'; // Using your Button component
import { formatLocalizedDate } from '@/utils/dateLocalization';
import Link from 'next/link';

export default function VolunteerPage() {
  const t = useTranslations('VolunteerPage');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const { locale } = useParams(); // Get current locale (e.g., 'en')

  useEffect(() => {
    const fetchVolunteerEvents = async () => {
      const data = await getEvents();
      // Hide events that have already ended, matching the events page
      const needsVolunteers = data.filter(
        (e) =>
          e.volunteerSlots > 0
          && e.isPublished
          && new Date(e.endDatetime).getTime() >= Date.now(),
      );
      setEvents(needsVolunteers);
      setLoading(false);
    };
    fetchVolunteerEvents();
  }, []);

  return (
    <main style={{ maxWidth: '75rem', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
      <Link
        href={`/${locale}/events`}
        style={{
          display: 'inline-block',
          marginBottom: 'var(--space-6)',
          color: 'var(--color-teal)',
          textDecoration: 'none',
        }}
      >
        ← Back to Events
      </Link>
      <header style={{ borderBottom: '0.5px solid var(--color-gray-light)', marginBottom: 'var(--space-10)', paddingBottom: 'var(--space-6)' }}>
        <h2 style={{ color: '#dc2626', fontSize: 'var(--fs-heading-2)' }}>
          {t('heading')}
        </h2>
      </header>

      {loading && <p>{t('loading')}</p>}
      {!loading && events.length === 0 && (
        <p style={{ color: 'var(--color-gray-mid)' }}>{t('empty')}</p>
      )}

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        {events.map((event) => (
          <div key={event.id} style={{ border: '1px solid var(--color-gray-light)', padding: 'var(--space-6)', borderRadius: '8px' }}>
            <h3>{locale === 'ja' ? event.titleJa || event.titleEn : event.titleEn}</h3>
            <p>
              <strong>{t('location')}</strong>{' '}
              {locale === 'ja' ? event.locationJa || event.locationEn : event.locationEn}
            </p>
            <p>
              <strong>{t('time')}</strong>{' '}
              {/* Keep the existing browser timezone while localizing the visible date and time. */}
              {formatLocalizedDate(event.startDatetime, locale, {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
            <p><strong>{t('volunteersNeeded')}</strong> {event.volunteerSlots}</p>

            {/* Updated to use your Button component with a redirect */}
            <Button
              text={t('signUp')}
              onClick={() => router.push(`/${locale}/volunteer/${event.id}`)}
              padding="12px 24px"
            />
          </div>
        ))}
      </div>
    </main>
  );
}
